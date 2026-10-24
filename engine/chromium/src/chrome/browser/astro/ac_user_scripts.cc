// Copyright 2026 Oxy. Apache-2.0.

#include <limits>
#include <memory>
#include <optional>
#include <string>
#include <string_view>
#include <utility>
#include <vector>

#include "base/containers/fixed_flat_set.h"
#include "base/files/file.h"
#include "base/files/file_path.h"
#include "base/files/file_path_watcher.h"
#include "base/files/file_util.h"
#include "base/files/important_file_writer.h"
#include "base/functional/bind.h"
#include "base/json/json_reader.h"
#include "base/no_destructor.h"
#include "base/strings/strcat.h"
#include "base/strings/string_number_conversions.h"
#include "base/strings/string_split.h"
#include "base/strings/string_util.h"
#include "base/task/sequenced_task_runner.h"
#include "base/task/thread_pool.h"
#include "base/threading/platform_thread.h"
#include "base/time/time.h"
#include "base/values.h"
#include "build/build_config.h"
#include "chrome/browser/astro/ac_engine.h"
#include "chrome/browser/astro/ac_scripts_policy.h"
#include "content/public/browser/browser_task_traits.h"
#include "content/public/browser/browser_thread.h"

#if BUILDFLAG(IS_POSIX)
#include <errno.h>
#include <sys/file.h>
#include <sys/stat.h>
#endif

#if BUILDFLAG(IS_WIN)
#include <windows.h>
#endif

namespace astro {
namespace {

constexpr char kTopic[] = "userScripts";
constexpr int64_t kManifestLimit = 1 << 20;
constexpr size_t kStatusLimit = 1 << 20;
constexpr size_t kGenerationLimit = 64;
constexpr int kLockAttempts = 200;
constexpr base::TimeDelta kLockRetry = base::Milliseconds(50);

constexpr auto kTopKeys = base::MakeFixedFlatSet<std::string_view>(
    {"content_scripts", "description", "manifest_version", "name",
     "version"});
constexpr auto kEntryKeys = base::MakeFixedFlatSet<std::string_view>(
    {"all_frames", "css", "exclude_globs", "exclude_matches", "include_globs",
     "js", "match_about_blank", "match_origin_as_fallback", "matches",
     "run_at", "world"});
constexpr std::string_view kStringListKeys[] = {
    "matches", "exclude_matches", "include_globs", "exclude_globs", "js", "css"};
constexpr std::string_view kFlagKeys[] = {"all_frames", "match_about_blank",
                                          "match_origin_as_fallback"};
constexpr auto kRunAts = base::MakeFixedFlatSet<std::string_view>(
    {"document_end", "document_idle", "document_start"});
constexpr auto kWorlds =
    base::MakeFixedFlatSet<std::string_view>({"ISOLATED", "MAIN"});

const scoped_refptr<base::SequencedTaskRunner>& Sequence() {
  static base::NoDestructor<scoped_refptr<base::SequencedTaskRunner>> sequence(
      base::ThreadPool::CreateSequencedTaskRunner(
          {base::MayBlock(), base::TaskPriority::USER_VISIBLE,
           base::TaskShutdownBehavior::SKIP_ON_SHUTDOWN}));
  return *sequence;
}

base::FilePath ScriptsDir() {
  const base::FilePath folder = ScriptsFolder();
  return folder.empty() ? base::FilePath() : folder.DirName();
}

enum class Kind { kMissing, kFile, kFolder, kOther };

#if BUILDFLAG(IS_POSIX)
Kind KindOf(const base::FilePath& path) {
  struct stat info;
  if (lstat(path.value().c_str(), &info) != 0) {
    return Kind::kMissing;
  }
  switch (info.st_mode & S_IFMT) {
    case S_IFREG:
      return Kind::kFile;
    case S_IFDIR:
      return Kind::kFolder;
    default:
      return Kind::kOther;
  }
}

std::string Stamp(const base::FilePath& path, bool with_time) {
  struct stat info;
  if (lstat(path.value().c_str(), &info) != 0) {
    return "-";
  }
  const std::string node = base::StrCat(
      {base::NumberToString(info.st_ino), ":",
       base::NumberToString(static_cast<int64_t>(info.st_mode))});
  base::File::Info times;
  if (!with_time || !base::GetFileInfo(path, &times)) {
    return node;
  }
  return base::StrCat(
      {base::NumberToString(
           times.last_modified.ToDeltaSinceWindowsEpoch().InMicroseconds()),
       ":", node});
}

base::FilePath ExtensionPath(const base::FilePath& dir) {
  const base::FilePath parent = dir.DirName();
  const base::FilePath real = base::MakeAbsoluteFilePath(parent);
  return (real.empty() ? parent : real)
      .Append(dir.BaseName())
      .Append(FILE_PATH_LITERAL("extension"));
}

class SharedLock {
 public:
  explicit SharedLock(base::File file) : file_(std::move(file)) {}
  ~SharedLock() {
    if (held_) {
      flock(file_.GetPlatformFile(), LOCK_UN);
    }
  }

  bool TryTake() {
    if (flock(file_.GetPlatformFile(), LOCK_SH | LOCK_NB) == 0) {
      held_ = true;
    }
    return held_;
  }

  bool Contended() const { return errno == EWOULDBLOCK; }

 private:
  base::File file_;
  bool held_ = false;
};
#elif BUILDFLAG(IS_WIN)
Kind KindOf(const base::FilePath& path) {
  const DWORD attributes = ::GetFileAttributesW(path.value().c_str());
  if (attributes == INVALID_FILE_ATTRIBUTES) {
    return Kind::kMissing;
  }
  if (attributes & FILE_ATTRIBUTE_REPARSE_POINT) {
    return Kind::kOther;
  }
  return (attributes & FILE_ATTRIBUTE_DIRECTORY) ? Kind::kFolder : Kind::kFile;
}

std::string Stamp(const base::FilePath& path, bool with_time) {
  base::File::Info info;
  if (KindOf(path) == Kind::kMissing || !base::GetFileInfo(path, &info)) {
    return "-";
  }
  const std::string node = base::NumberToString(
      info.creation_time.ToDeltaSinceWindowsEpoch().InMicroseconds());
  if (!with_time) {
    return node;
  }
  return base::StrCat(
      {base::NumberToString(
           info.last_modified.ToDeltaSinceWindowsEpoch().InMicroseconds()),
       ":", node});
}

base::FilePath ExtensionPath(const base::FilePath& dir) {
  const base::FilePath folder = dir.Append(FILE_PATH_LITERAL("extension"));
  const base::FilePath absolute = base::MakeAbsoluteFilePath(folder);
  return absolute.empty() ? folder : absolute;
}

class SharedLock {
 public:
  explicit SharedLock(base::File file) : file_(std::move(file)) {}
  ~SharedLock() {
    if (held_) {
      file_.Unlock();
    }
  }

  bool TryTake() {
    error_ = file_.Lock(base::File::LockMode::kShared);
    held_ = error_ == base::File::FILE_OK;
    return held_;
  }

  bool Contended() const { return error_ == base::File::FILE_ERROR_IN_USE; }

 private:
  base::File file_;
  base::File::Error error_ = base::File::FILE_OK;
  bool held_ = false;
};
#endif

std::optional<std::string> ReadSmall(const base::FilePath& path,
                                     size_t limit) {
  if (KindOf(path) != Kind::kFile) {
    return std::nullopt;
  }
  std::string text;
  if (!base::ReadFileToStringWithMaxSize(path, &text, limit)) {
    return std::nullopt;
  }
  return text;
}

std::optional<int> ReadGeneration(const base::FilePath& path) {
  const std::optional<std::string> text = ReadSmall(path, kGenerationLimit);
  int generation = 0;
  if (!text || !base::StringToInt(base::TrimWhitespaceASCII(
                                      *text, base::TRIM_ALL),
                                  &generation)) {
    return std::nullopt;
  }
  return generation;
}

std::string GenerationText(const base::FilePath& path) {
  return ReadSmall(path, kGenerationLimit).value_or("-");
}

std::string Signature(const base::FilePath& dir) {
  return base::StrCat(
      {GenerationText(dir.Append(FILE_PATH_LITERAL("generation"))), "|",
       Stamp(dir.Append(FILE_PATH_LITERAL("extension")), false)});
}

std::string Token(const base::FilePath& dir) {
  const base::FilePath extension = dir.Append(FILE_PATH_LITERAL("extension"));
  return base::StrCat(
      {Stamp(dir, true), "|",
       GenerationText(dir.Append(FILE_PATH_LITERAL("generation"))), "|",
       GenerationText(extension.Append(FILE_PATH_LITERAL("generation"))), "|",
       Stamp(extension, false)});
}

std::optional<std::string> FileProblem(const base::FilePath& root,
                                       const std::string& relative,
                                       const std::string& at) {
  const std::vector<std::string> parts = base::SplitString(
      relative, "/", base::KEEP_WHITESPACE, base::SPLIT_WANT_ALL);
  bool malformed = relative.empty() ||
                   relative.find('\0') != std::string::npos ||
                   relative.find('\\') != std::string::npos;
  for (const std::string& part : parts) {
    malformed = malformed || part.empty() || part == "." || part == "..";
  }
  if (malformed) {
    return base::StrCat({at, ": \"", relative,
                         "\" must be a plain relative path inside the "
                         "extension"});
  }
  base::FilePath path = root;
  for (size_t i = 0; i < parts.size(); ++i) {
    path = path.Append(base::FilePath::FromUTF8Unsafe(parts[i]));
    const Kind kind = KindOf(path);
    if (kind == Kind::kMissing) {
      return base::StrCat({at, ": \"", relative, "\" is missing"});
    }
    const Kind wanted = i + 1 == parts.size() ? Kind::kFile : Kind::kFolder;
    if (kind != wanted) {
      return base::StrCat({at, ": \"", relative,
                           "\" must be a plain file, not a link"});
    }
  }
  return std::nullopt;
}

std::optional<std::string> EntryProblem(const base::FilePath& extension,
                                        const base::Value& item,
                                        size_t index) {
  const std::string at =
      base::StrCat({"content_scripts[", base::NumberToString(index), "]"});
  const base::DictValue* entry = item.GetIfDict();
  if (!entry) {
    return at + " must be an object";
  }
  std::optional<std::string> extra;
  for (const auto [key, value] : *entry) {
    if (!kEntryKeys.contains(key) && (!extra || key < *extra)) {
      extra = key;
    }
  }
  if (extra) {
    return base::StrCat({at, " may not contain \"", *extra, "\""});
  }
  for (std::string_view key : kStringListKeys) {
    const base::Value* value = entry->Find(key);
    if (!value) {
      continue;
    }
    const base::ListValue* list = value->GetIfList();
    bool strings = !!list;
    for (size_t i = 0; list && i < list->size(); ++i) {
      strings = strings && (*list)[i].is_string();
    }
    if (!strings) {
      return base::StrCat({at, ".", key, " must be a list of strings"});
    }
  }
  for (std::string_view key : kFlagKeys) {
    const base::Value* value = entry->Find(key);
    if (value && !value->is_bool()) {
      return base::StrCat({at, ".", key, " must be true or false"});
    }
  }
  if (const base::Value* run_at = entry->Find("run_at");
      run_at && !(run_at->is_string() && kRunAts.contains(run_at->GetString()))) {
    return at +
           ".run_at must be document_start, document_end or document_idle";
  }
  if (const base::Value* world = entry->Find("world");
      world && !(world->is_string() && kWorlds.contains(world->GetString()))) {
    return at + ".world must be ISOLATED or MAIN";
  }
  for (std::string_view key : {"js", "css"}) {
    const base::ListValue* files = entry->FindList(key);
    for (size_t i = 0; files && i < files->size(); ++i) {
      if (std::optional<std::string> problem = FileProblem(
              extension, (*files)[i].GetString(), base::StrCat({at, ".", key}))) {
        return problem;
      }
    }
  }
  return std::nullopt;
}

std::optional<std::string> ManifestProblem(const base::FilePath& extension) {
  const base::FilePath path = extension.Append(FILE_PATH_LITERAL("manifest.json"));
  std::optional<int64_t> size = base::GetFileSize(path);
  if (KindOf(path) != Kind::kFile || !size) {
    return "manifest.json is missing or isn't a plain file";
  }
  if (*size > kManifestLimit) {
    return "manifest.json is too large";
  }
  std::optional<std::string> text = ReadSmall(path, kManifestLimit);
  std::optional<base::Value> parsed =
      text ? base::JSONReader::Read(*text, base::JSON_PARSE_RFC)
           : std::nullopt;
  if (!parsed || !parsed->is_dict()) {
    return "manifest.json isn't a JSON object";
  }
  const base::DictValue& manifest = parsed->GetDict();
  std::optional<std::string> extra;
  for (const auto [key, value] : manifest) {
    if (!kTopKeys.contains(key) && (!extra || key < *extra)) {
      extra = key;
    }
  }
  if (extra) {
    return base::StrCat({"manifest.json may not contain \"", *extra, "\""});
  }
  const base::Value* version = manifest.Find("manifest_version");
  if (!version || !(version->is_int() || version->is_double()) ||
      version->GetDouble() != 3) {
    return "manifest_version must be 3";
  }
  if (!manifest.FindString("name")) {
    return "name must be a string";
  }
  if (!manifest.FindString("version")) {
    return "version must be a string";
  }
  if (const base::Value* description = manifest.Find("description");
      description && !description->is_string()) {
    return "description must be a string";
  }
  const base::ListValue* entries = manifest.FindList("content_scripts");
  if (!entries) {
    return "content_scripts must be a list";
  }
  for (size_t i = 0; i < entries->size(); ++i) {
    if (std::optional<std::string> problem =
            EntryProblem(extension, (*entries)[i], i)) {
      return problem;
    }
  }
  return std::nullopt;
}

base::DictValue Invalid(int generation,
                        const std::string& path,
                        std::string_view error) {
  return base::DictValue()
      .Set("state", "invalid")
      .Set("generation", generation)
      .Set("path", path)
      .Set("error", error);
}

base::DictValue Snapshot(const base::FilePath& dir) {
  const std::string path = ExtensionPath(dir).AsUTF8Unsafe();
  const std::optional<int> written =
      ReadGeneration(dir.Append(FILE_PATH_LITERAL("generation")));
  if (KindOf(dir) != Kind::kFolder) {
    return Invalid(written.value_or(0), path, "Scripts isn't a plain folder");
  }
  const base::FilePath extension = dir.Append(FILE_PATH_LITERAL("extension"));
  const Kind kind = KindOf(extension);
  if (kind == Kind::kMissing) {
    if (!written) {
      return base::DictValue().Set("state", "empty");
    }
    return base::DictValue()
        .Set("state", "absent")
        .Set("generation", *written)
        .Set("path", path);
  }
  const std::optional<int> inner =
      ReadGeneration(extension.Append(FILE_PATH_LITERAL("generation")));
  if (!inner) {
    return base::DictValue().Set("state", "pending");
  }
  if (*inner < written.value_or(std::numeric_limits<int>::min())) {
    return base::DictValue()
        .Set("state", "pending")
        .Set("generation", written.value_or(0));
  }
  if (kind != Kind::kFolder) {
    return Invalid(*inner, path, "Scripts/extension isn't a plain folder");
  }
  if (std::optional<std::string> problem = ManifestProblem(extension)) {
    return Invalid(*inner, path, *problem);
  }
  return base::DictValue()
      .Set("state", "ready")
      .Set("generation", *inner)
      .Set("path", path);
}

base::DictValue Read() {
  const base::FilePath dir = ScriptsDir();
  if (dir.empty()) {
    return base::DictValue()
        .Set("state", "invalid")
        .Set("error", "Astro has no data folder");
  }
  base::CreateDirectory(dir);
  const base::FilePath lock_path = dir.Append(FILE_PATH_LITERAL(".lock"));
  const Kind lock_kind = KindOf(lock_path);
  if (lock_kind != Kind::kFile && lock_kind != Kind::kMissing) {
    return base::DictValue().Set("state", "busy");
  }
  base::File file(lock_path,
                  base::File::FLAG_OPEN_ALWAYS | base::File::FLAG_READ);
  if (!file.IsValid()) {
    return base::DictValue().Set("state", "busy");
  }
  SharedLock lock(std::move(file));
  for (int attempt = 0;; ++attempt) {
    if (lock.TryTake()) {
      break;
    }
    if (!lock.Contended() || attempt == kLockAttempts - 1) {
      return base::DictValue().Set("state", "busy");
    }
    base::PlatformThread::Sleep(kLockRetry);
  }
  base::DictValue folder = Snapshot(dir);
  folder.Set("token", Token(dir));
  return folder;
}

base::DictValue ReadStatus() {
  const base::FilePath dir = ScriptsDir();
  base::DictValue reply;
  std::optional<std::string> text =
      dir.empty() ? std::nullopt
                  : ReadSmall(dir.Append(FILE_PATH_LITERAL("status.json")),
                              kStatusLimit);
  if (text && base::IsStringUTF8(*text)) {
    reply.Set("status", std::move(*text));
  } else {
    reply.Set("status", base::Value());
  }
  return reply;
}

base::DictValue WriteStatus(const std::string& json) {
  const base::FilePath dir = ScriptsDir();
  if (dir.empty()) {
    return base::DictValue().Set("error", "Astro has no data folder");
  }
  if (!base::CreateDirectory(dir) ||
      !base::ImportantFileWriter::WriteFileAtomically(
          dir.Append(FILE_PATH_LITERAL("status.json")), json)) {
    return base::DictValue().Set("error", "Couldn't write Scripts/status.json");
  }
  return base::DictValue().Set("ok", true);
}

void Announce() {
  content::GetUIThreadTaskRunner({})->PostTask(
      FROM_HERE, base::BindOnce([] { Emit(kTopic, nullptr, base::DictValue()); }));
}

class Watch {
 public:
  void Start() {
    if (watcher_) {
      return;
    }
    const base::FilePath dir = ScriptsDir();
    if (dir.empty()) {
      return;
    }
    base::CreateDirectory(dir);
    watcher_ = std::make_unique<base::FilePathWatcher>();
    signature_ = Signature(dir);
    if (!watcher_->Watch(dir, base::FilePathWatcher::Type::kRecursive,
                         base::BindRepeating(&Watch::Changed,
                                             base::Unretained(this), dir))) {
      watcher_.reset();
    }
  }

  void Stop() {
    watcher_.reset();
    signature_.clear();
  }

 private:
  void Rearm() {
    if (watcher_) {
      watcher_.reset();
      Start();
    }
  }

  void Changed(const base::FilePath& dir, const base::FilePath&, bool error) {
    if (error) {
      Sequence()->PostTask(FROM_HERE, base::BindOnce(&Watch::Rearm,
                                                     base::Unretained(this)));
    }
    const std::string now = Signature(dir);
    if (now == signature_) {
      return;
    }
    signature_ = now;
    Announce();
  }

  std::unique_ptr<base::FilePathWatcher> watcher_;
  std::string signature_;
};

Watch& Watcher() {
  static base::NoDestructor<Watch> watch;
  return *watch;
}

}
}

AC_ENGINE_CALL(ac_user_scripts) {
  DCHECK_CURRENTLY_ON(content::BrowserThread::UI);
  astro::Reply out(reply, context);
  std::optional<base::Value> parsed =
      args_json && *args_json ? base::JSONReader::Read(args_json,
                                                       base::JSON_PARSE_RFC)
                              : std::nullopt;
  if (!parsed || !parsed->is_dict()) {
    return out.Error("arguments are not a JSON object");
  }
  const base::DictValue& args = parsed->GetDict();
  const std::string* method = args.FindString("method");
  if (!method) {
    return out.Error("no method");
  }
  auto reply_later = [](astro::Reply out, base::DictValue result) {
    out.Send(std::move(result));
  };
  if (*method == "read") {
    astro::Sequence()->PostTaskAndReplyWithResult(
        FROM_HERE, base::BindOnce(&astro::Read),
        base::BindOnce(reply_later, std::move(out)));
  } else if (*method == "readStatus") {
    astro::Sequence()->PostTaskAndReplyWithResult(
        FROM_HERE, base::BindOnce(&astro::ReadStatus),
        base::BindOnce(reply_later, std::move(out)));
  } else if (*method == "writeStatus") {
    const std::string* json = args.FindString("json");
    if (!json || json->size() > astro::kStatusLimit) {
      return out.Error("writeStatus needs json");
    }
    astro::Sequence()->PostTaskAndReplyWithResult(
        FROM_HERE, base::BindOnce(&astro::WriteStatus, *json),
        base::BindOnce(reply_later, std::move(out)));
  } else if (*method == "watch") {
    const bool on = args.FindBool("on").value_or(false);
    astro::Sequence()->PostTask(
        FROM_HERE, base::BindOnce(
                       [](bool on) {
                         if (on) {
                           astro::Watcher().Start();
                         } else {
                           astro::Watcher().Stop();
                         }
                       },
                       on));
    out.Ok();
  } else {
    out.Error("unknown method");
  }
}
