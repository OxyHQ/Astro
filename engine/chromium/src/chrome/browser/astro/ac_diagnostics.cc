// Copyright 2026 Oxy. Apache-2.0.

#include "chrome/browser/astro/ac_diagnostics.h"

#include <algorithm>
#include <cstring>
#include <iterator>
#include <map>
#include <memory>
#include <optional>
#include <utility>
#include <vector>

#include "base/files/file_path.h"
#include "base/files/file_util.h"
#include "base/functional/bind.h"
#include "base/no_destructor.h"
#include "base/path_service.h"
#include "base/strings/string_number_conversions.h"
#include "base/strings/stringprintf.h"
#include "base/task/single_thread_task_runner.h"
#include "base/task/thread_pool.h"
#include "base/time/time.h"
#include "base/trace_event/trace_config.h"
#include "build/build_config.h"
#include "chrome/common/chrome_paths.h"
#include "components/crash/core/app/crashpad.h"
#include "content/public/browser/tracing_controller.h"
#include "third_party/crashpad/crashpad/client/crash_report_database.h"
#include "third_party/crashpad/crashpad/snapshot/cpu_context.h"
#include "third_party/crashpad/crashpad/snapshot/minidump/process_snapshot_minidump.h"
#include "third_party/crashpad/crashpad/util/file/file_reader.h"

#if BUILDFLAG(IS_LINUX)
#include <link.h>
#include <signal.h>
#endif

#if BUILDFLAG(IS_WIN)
#include <windows.h>
#endif

namespace astro {
namespace {

using Done = base::OnceCallback<void(base::Value)>;

struct TracingStart {
  Done done;
  bool answered = false;
  int session = 0;
};

struct TracingState {
  bool tracing = false;
  int session = 0;
  std::weak_ptr<TracingStart> pending;
};

TracingState& Tracing() {
  static base::NoDestructor<TracingState> state;
  return *state;
}

constexpr int kTracingStartChecks = 100;

bool IsCurrent(const TracingStart& start) {
  return start.session == Tracing().session;
}

void AnswerTracingStart(const std::shared_ptr<TracingStart>& start,
                        bool started) {
  if (start->answered) {
    return;
  }
  start->answered = true;
  if (!started && IsCurrent(*start)) {
    Tracing().tracing = false;
  }
  std::move(start->done).Run(base::Value(started));
}

void WatchTracingStart(std::shared_ptr<TracingStart> start, int checks_left) {
  if (start->answered) {
    return;
  }
  if (!IsCurrent(*start)) {
    AnswerTracingStart(start, false);
    return;
  }
  content::TracingController* tracing =
      content::TracingController::GetInstance();
  if (!tracing->IsTracing()) {
    AnswerTracingStart(start, false);
    return;
  }
  if (checks_left == 0) {
    AnswerTracingStart(start, false);
    tracing->StopTracing(nullptr);
    return;
  }
  base::SingleThreadTaskRunner::GetCurrentDefault()->PostDelayedTask(
      FROM_HERE,
      base::BindOnce(&WatchTracingStart, std::move(start), checks_left - 1),
      base::Milliseconds(100));
}

void BeginTracing(Done done) {
  TracingState& state = Tracing();
  if (state.tracing) {
    std::move(done).Run(base::Value(false));
    return;
  }
  auto start = std::make_shared<TracingStart>();
  start->done = std::move(done);
  start->session = ++state.session;
  state.pending = start;
  state.tracing = content::TracingController::GetInstance()->StartTracing(
      base::trace_event::TraceConfig(),
      base::BindOnce(
          [](std::shared_ptr<TracingStart> start) {
            if (start->answered) {
              if (IsCurrent(*start) && !Tracing().tracing) {
                content::TracingController::GetInstance()->StopTracing(nullptr);
              }
              return;
            }
            AnswerTracingStart(start, true);
          },
          start));
  if (!state.tracing) {
    AnswerTracingStart(start, false);
    return;
  }
  WatchTracingStart(start, kTracingStartChecks);
}

base::FilePath TraceFile(bool keep) {
  base::FilePath folder;
  if (!keep ||
      !base::PathService::Get(chrome::DIR_DEFAULT_DOWNLOADS, &folder)) {
    if (!base::GetTempDir(&folder)) {
      return base::FilePath();
    }
  }
  if (!base::CreateDirectory(folder)) {
    return base::FilePath();
  }
  base::Time::Exploded now;
  base::Time::Now().LocalExplode(&now);
  return folder.AppendASCII(base::StringPrintf(
      "Astro Trace %04d-%02d-%02d at %02d.%02d.%02d.%03d.json", now.year,
      now.month, now.day_of_month, now.hour, now.minute, now.second,
      now.millisecond));
}

void StopTracingInto(bool keep, Done done, base::FilePath path) {
  if (path.empty()) {
    content::TracingController::GetInstance()->StopTracing(nullptr);
    std::move(done).Run(base::Value());
    return;
  }
  auto reply = std::make_shared<Done>(std::move(done));
  auto answer = base::BindOnce(
      [](base::FilePath path, bool keep, std::shared_ptr<Done> reply) {
        if (!*reply) {
          return;
        }
        if (keep) {
          std::move(*reply).Run(base::Value(path.AsUTF8Unsafe()));
          return;
        }
        base::ThreadPool::PostTask(
            FROM_HERE, {base::MayBlock(), base::TaskPriority::BEST_EFFORT},
            base::GetDeleteFileCallback(path));
        std::move(*reply).Run(base::Value());
      },
      path, keep, reply);
  const bool stopped = content::TracingController::GetInstance()->StopTracing(
      content::TracingController::CreateFileEndpoint(path, std::move(answer)));
  if (!stopped && *reply) {
    std::move(*reply).Run(base::Value());
  }
}

void EndTracing(bool keep, Done done) {
  TracingState& state = Tracing();
  if (!state.tracing) {
    std::move(done).Run(base::Value());
    return;
  }
  state.tracing = false;
  ++state.session;
  if (std::shared_ptr<TracingStart> pending = state.pending.lock()) {
    AnswerTracingStart(pending, false);
  }
  base::ThreadPool::PostTaskAndReplyWithResult(
      FROM_HERE, {base::MayBlock(), base::TaskPriority::USER_BLOCKING},
      base::BindOnce(&TraceFile, keep),
      base::BindOnce(&StopTracingInto, keep, std::move(done)));
}

constexpr size_t kMaxFrames = 64;
constexpr size_t kMaxReports = 5;
constexpr size_t kMaxReportsRead = 20;

struct LiveModule {
  uintptr_t start = 0;
  uintptr_t end = 0;
  std::vector<std::pair<uintptr_t, uintptr_t>> code;
};

std::string BaseName(const std::string& path) {
  const size_t slash = path.find_last_of("/\\");
  return slash == std::string::npos ? path : path.substr(slash + 1);
}

#if BUILDFLAG(IS_LINUX)
int AddLiveModule(dl_phdr_info* info, size_t, void* data) {
  auto* modules = static_cast<std::map<std::string, LiveModule>*>(data);
  std::string name = info->dlpi_name ? info->dlpi_name : "";
  if (name.empty()) {
    base::FilePath exe;
    if (!base::PathService::Get(base::FILE_EXE, &exe)) {
      return 0;
    }
    name = exe.value();
  }
  LiveModule module;
  module.start = UINTPTR_MAX;
  for (int i = 0; i < info->dlpi_phnum; ++i) {
    const ElfW(Phdr) & header = info->dlpi_phdr[i];
    if (header.p_type != PT_LOAD) {
      continue;
    }
    const uintptr_t low = info->dlpi_addr + header.p_vaddr;
    const uintptr_t high = low + header.p_memsz;
    module.start = std::min(module.start, low & ~uintptr_t{0xfff});
    module.end = std::max(module.end, high);
    if (header.p_flags & PF_X) {
      module.code.emplace_back(low, high);
    }
  }
  if (module.end > module.start) {
    modules->emplace(BaseName(name), std::move(module));
  }
  return 0;
}
#endif

std::optional<LiveModule> FindLiveModule(const std::string& name) {
#if BUILDFLAG(IS_LINUX)
  static base::NoDestructor<std::map<std::string, LiveModule>> modules([] {
    std::map<std::string, LiveModule> found;
    dl_iterate_phdr(&AddLiveModule, &found);
    return found;
  }());
  auto it = modules->find(name);
  if (it == modules->end()) {
    return std::nullopt;
  }
  return it->second;
#elif BUILDFLAG(IS_WIN)
  HMODULE handle =
      ::GetModuleHandleW(base::FilePath::FromUTF8Unsafe(name).value().c_str());
  if (!handle) {
    return std::nullopt;
  }
  const auto base = reinterpret_cast<uintptr_t>(handle);
  const auto* dos = reinterpret_cast<const IMAGE_DOS_HEADER*>(base);
  const auto* nt =
      reinterpret_cast<const IMAGE_NT_HEADERS*>(base + dos->e_lfanew);
  LiveModule module;
  module.start = base;
  module.end = base + nt->OptionalHeader.SizeOfImage;
  const IMAGE_SECTION_HEADER* section = IMAGE_FIRST_SECTION(nt);
  for (WORD i = 0; i < nt->FileHeader.NumberOfSections; ++i, ++section) {
    if (section->Characteristics & IMAGE_SCN_MEM_EXECUTE) {
      const uintptr_t low = base + section->VirtualAddress;
      module.code.emplace_back(low, low + section->Misc.VirtualSize);
    }
  }
  return module;
#else
  return std::nullopt;
#endif
}

bool FollowsCall(uintptr_t address) {
  const auto* p = reinterpret_cast<const uint8_t*>(address);
  if (p[-5] == 0xE8) {
    return true;
  }
  const auto indirect = [](uint8_t opcode, uint8_t modrm, uint8_t mod) {
    return opcode == 0xFF && (modrm & 0x38) == 0x10 && (modrm >> 6) == mod;
  };
  return indirect(p[-6], p[-5], 0) || indirect(p[-2], p[-1], 3) ||
         indirect(p[-3], p[-2], 1) || indirect(p[-4], p[-3], 1) ||
         indirect(p[-6], p[-5], 2) || indirect(p[-7], p[-6], 2) ||
         indirect(p[-3], p[-2], 0) || indirect(p[-7], p[-6], 0);
}

class Frames {
 public:
  explicit Frames(const crashpad::ProcessSnapshotMinidump& snapshot) {
    for (const crashpad::ModuleSnapshot* module : snapshot.Modules()) {
      Module entry;
      entry.name = BaseName(module->Name());
      entry.address = module->Address();
      entry.size = module->Size();
      entry.live = FindLiveModule(entry.name);
      modules_.push_back(std::move(entry));
    }
  }

  void AddExact(uint64_t pc) {
    if (const Module* module = Find(pc)) {
      Add(*module, pc);
    }
  }

  bool AddReturn(uint64_t value) {
    const Module* module = Find(value);
    if (!module || !IsReturnAddress(*module, value)) {
      return false;
    }
    Add(*module, value);
    return true;
  }

  size_t size() const { return frames_.size(); }
  bool full() const { return frames_.size() >= kMaxFrames; }
  base::ListValue Take() { return std::move(frames_); }

 private:
  struct Module {
    std::string name;
    uint64_t address = 0;
    uint64_t size = 0;
    std::optional<LiveModule> live;
  };

  const Module* Find(uint64_t address) const {
    for (const Module& module : modules_) {
      if (address >= module.address && address - module.address < module.size) {
        return &module;
      }
    }
    return nullptr;
  }

  bool IsReturnAddress(const Module& module, uint64_t value) const {
    if (!module.live) {
      return false;
    }
    const uint64_t offset = value - module.address;
    if (offset >= module.live->end - module.live->start) {
      return false;
    }
    const uintptr_t live = module.live->start + offset;
    for (const auto& [low, high] : module.live->code) {
      if (live >= low + 7 && live < high) {
        return FollowsCall(live);
      }
    }
    return false;
  }

  void Add(const Module& module, uint64_t address) {
    frames_.Append(
        base::DictValue()
            .Set("image", module.name)
            .Set("offset", static_cast<double>(address - module.address)));
  }

  std::vector<Module> modules_;
  base::ListValue frames_;
};

class StackReader : public crashpad::MemorySnapshot::Delegate {
 public:
  bool MemorySnapshotDelegateRead(void* data, size_t size) override {
    const auto* bytes = static_cast<const uint8_t*>(data);
    bytes_.assign(bytes, bytes + size);
    return true;
  }

  std::optional<uint64_t> Word(uint64_t base, uint64_t address) const {
    if (address < base || address - base + 8 > bytes_.size()) {
      return std::nullopt;
    }
    uint64_t word;
    memcpy(&word, bytes_.data() + (address - base), sizeof(word));
    return word;
  }

  size_t size() const { return bytes_.size(); }

 private:
  std::vector<uint8_t> bytes_;
};

std::string ExceptionName(uint32_t code) {
#if BUILDFLAG(IS_WIN)
  switch (code) {
    case 0xC0000005:
      return "EXCEPTION_ACCESS_VIOLATION";
    case 0xC0000409:
      return "STATUS_STACK_BUFFER_OVERRUN";
    case 0x80000003:
      return "EXCEPTION_BREAKPOINT";
    case 0xC000001D:
      return "EXCEPTION_ILLEGAL_INSTRUCTION";
    case 0xC00000FD:
      return "EXCEPTION_STACK_OVERFLOW";
    case 0xC0000094:
      return "EXCEPTION_INT_DIVIDE_BY_ZERO";
    case 0xC0000420:
      return "STATUS_ASSERTION_FAILURE";
    case 0xE0000008:
      return "OUT_OF_MEMORY";
  }
  return base::StringPrintf("EXCEPTION_%08X", code);
#else
  switch (code) {
    case SIGSEGV:
      return "SIGSEGV";
    case SIGBUS:
      return "SIGBUS";
    case SIGILL:
      return "SIGILL";
    case SIGTRAP:
      return "SIGTRAP";
    case SIGABRT:
      return "SIGABRT";
    case SIGFPE:
      return "SIGFPE";
    case SIGSYS:
      return "SIGSYS";
  }
  return base::StringPrintf("SIGNAL_%u", code);
#endif
}

std::string ProcessType(const crashpad::ProcessSnapshotMinidump& snapshot) {
  for (const crashpad::ModuleSnapshot* module : snapshot.Modules()) {
    for (const crashpad::AnnotationSnapshot& annotation :
         module->AnnotationObjects()) {
      if (annotation.name == "ptype") {
        return std::string(annotation.value.begin(), annotation.value.end());
      }
    }
  }
  const auto& simple = snapshot.AnnotationsSimpleMap();
  auto it = simple.find("ptype");
  return it == simple.end() ? std::string() : it->second;
}

base::ListValue CrashFrames(const crashpad::ProcessSnapshotMinidump& snapshot,
                            const crashpad::ExceptionSnapshot& exception) {
  Frames frames(snapshot);
  const crashpad::CPUContext* context = exception.Context();
  if (!context || context->architecture != crashpad::kCPUArchitectureX86_64) {
    return frames.Take();
  }
  const crashpad::CPUContextX86_64& registers = *context->x86_64;
  frames.AddExact(registers.rip);
  const crashpad::MemorySnapshot* stack = nullptr;
  for (const crashpad::ThreadSnapshot* thread : snapshot.Threads()) {
    if (thread->ThreadID() == exception.ThreadID()) {
      stack = thread->Stack();
    }
  }
  StackReader reader;
  if (!stack || !stack->Read(&reader)) {
    return frames.Take();
  }
  const uint64_t base = stack->Address();
#if BUILDFLAG(IS_LINUX)
  uint64_t frame = registers.rbp;
  while (!frames.full()) {
    std::optional<uint64_t> next = reader.Word(base, frame);
    std::optional<uint64_t> ret = reader.Word(base, frame + 8);
    if (!next || !ret || *next <= frame || !frames.AddReturn(*ret)) {
      break;
    }
    frame = *next;
  }
  if (frames.size() > 2) {
    return frames.Take();
  }
#endif
  for (uint64_t at = std::max(registers.rsp, base);
       !frames.full() && at + 8 <= base + reader.size(); at += 8) {
    if (std::optional<uint64_t> word = reader.Word(base, at)) {
      frames.AddReturn(*word);
    }
  }
  return frames.Take();
}

std::optional<base::DictValue> ReadCrash(
    const crashpad::CrashReportDatabase::Report& report) {
  crashpad::FileReader file;
  if (!file.Open(report.file_path)) {
    return std::nullopt;
  }
  crashpad::ProcessSnapshotMinidump snapshot;
  if (!snapshot.Initialize(&file)) {
    return std::nullopt;
  }
  const crashpad::ExceptionSnapshot* exception = snapshot.Exception();
  if (!exception || ProcessType(snapshot) != "browser") {
    return std::nullopt;
  }
  base::DictValue crash;
  crash.Set("time", static_cast<double>(report.creation_time) * 1000);
  crash.Set("incidentId", report.uuid.ToString());
  crash.Set("exceptionType", ExceptionName(exception->Exception()));
  crash.Set("frames", CrashFrames(snapshot, *exception));
  return crash;
}

base::Value CrashReportsSince(double since_ms) {
  base::ListValue out;
  std::optional<base::FilePath> path =
      crash_reporter::GetCrashpadDatabasePath();
  if (!path) {
    return base::Value(std::move(out));
  }
  std::unique_ptr<crashpad::CrashReportDatabase> database =
      crashpad::CrashReportDatabase::InitializeWithoutCreating(*path);
  if (!database) {
    return base::Value(std::move(out));
  }
  std::vector<crashpad::CrashReportDatabase::Report> reports;
  std::vector<crashpad::CrashReportDatabase::Report> completed;
  database->GetPendingReports(&reports);
  database->GetCompletedReports(&completed);
  std::move(completed.begin(), completed.end(), std::back_inserter(reports));
  std::erase_if(reports, [since_ms](const auto& report) {
    return static_cast<double>(report.creation_time) * 1000 <= since_ms;
  });
  std::sort(reports.begin(), reports.end(), [](const auto& a, const auto& b) {
    return a.creation_time > b.creation_time;
  });
  std::vector<base::DictValue> crashes;
  for (size_t i = 0; i < reports.size() && i < kMaxReportsRead &&
                     crashes.size() < kMaxReports;
       ++i) {
    if (std::optional<base::DictValue> crash = ReadCrash(reports[i])) {
      crashes.push_back(std::move(*crash));
    }
  }
  for (auto it = crashes.rbegin(); it != crashes.rend(); ++it) {
    out.Append(std::move(*it));
  }
  return base::Value(std::move(out));
}

}

bool DiagnosticsCall(const std::string& method,
                     const base::DictValue& args,
                     Done& done) {
  if (method == "beginTracing") {
    BeginTracing(std::move(done));
  } else if (method == "endTracing") {
    EndTracing(args.FindBool("keep").value_or(false), std::move(done));
  } else if (method == "isTracing") {
    std::move(done).Run(base::Value(Tracing().tracing));
  } else if (method == "crashReports") {
    base::ThreadPool::PostTaskAndReplyWithResult(
        FROM_HERE, {base::MayBlock(), base::TaskPriority::BEST_EFFORT},
        base::BindOnce(&CrashReportsSince,
                       args.FindDouble("since").value_or(0)),
        std::move(done));
  } else {
    return false;
  }
  return true;
}

}
