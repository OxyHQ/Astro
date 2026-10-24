// Copyright 2026 Oxy. Apache-2.0.

#include <algorithm>
#include <optional>
#include <string>
#include <string_view>
#include <utility>
#include <vector>

#include "base/base_paths.h"
#include "base/command_line.h"
#include "base/environment.h"
#include "base/files/file_path.h"
#include "base/files/file_util.h"
#include "base/files/important_file_writer.h"
#include "base/functional/bind.h"
#include "base/json/json_reader.h"
#include "base/no_destructor.h"
#include "base/path_service.h"
#include "base/rand_util.h"
#include "base/strings/cstring_view.h"
#include "base/strings/strcat.h"
#include "base/strings/string_number_conversions.h"
#include "base/strings/string_split.h"
#include "base/strings/string_util.h"
#include "base/strings/utf_string_conversions.h"
#include "base/task/sequenced_task_runner.h"
#include "base/task/thread_pool.h"
#include "base/values.h"
#include "build/build_config.h"
#include "chrome/browser/astro/ac_ui_source.h"
#include "chrome/browser/astro/ac_engine.h"
#include "chrome/common/chrome_switches.h"
#include "content/public/browser/browser_thread.h"

#if BUILDFLAG(IS_WIN)
#include <windows.h>

#include "base/base_paths_win.h"
#include "base/win/registry.h"
#endif

namespace astro {
namespace {

constexpr char kCliDirSwitch[] = "astro-cli-dir";
constexpr char kBinDirVariable[] = "ASTRO_CLI_BIN_DIR";
constexpr size_t kVersionLimit = 64;

#if BUILDFLAG(IS_WIN)
constexpr base::FilePath::CharType kLauncher[] = FILE_PATH_LITERAL("astro.cmd");
constexpr wchar_t kEnvironmentKey[] = L"Environment";
constexpr wchar_t kPathValue[] = L"Path";
#else
constexpr base::FilePath::CharType kLauncher[] = FILE_PATH_LITERAL("astro");
constexpr char kPathLine[] = "export PATH=\"$HOME/.local/bin:$PATH\"\n";
#endif

const scoped_refptr<base::SequencedTaskRunner>& Sequence() {
  static base::NoDestructor<scoped_refptr<base::SequencedTaskRunner>> sequence(
      base::ThreadPool::CreateSequencedTaskRunner(
          {base::MayBlock(), base::TaskPriority::USER_VISIBLE,
           base::TaskShutdownBehavior::SKIP_ON_SHUTDOWN}));
  return *sequence;
}

std::optional<base::FilePath> EnvironmentPath(base::cstring_view name) {
  std::optional<std::string> value = base::Environment::Create()->GetVar(name);
  if (!value || value->empty()) {
    return std::nullopt;
  }
  base::FilePath path = base::FilePath::FromUTF8Unsafe(*value);
  return path.IsAbsolute() ? std::optional(path) : std::nullopt;
}

struct Places {
  base::FilePath cli;
  base::FilePath launcher;
  base::FilePath bin;
  bool default_bin = true;
  bool isolated = false;
};

Places Locate(const base::CommandLine& command_line) {
  Places places;
  const base::FilePath given = command_line.GetSwitchValuePath(kCliDirSwitch);
  if (!given.empty() && given.IsAbsolute()) {
    places.cli = given;
  } else if (base::FilePath beside = BesideEngine("cli"); !beside.empty()) {
    places.cli = beside;
  } else if (base::FilePath exe;
             base::PathService::Get(base::DIR_EXE, &exe)) {
    places.cli = exe.Append(FILE_PATH_LITERAL("cli"));
  }
  if (!places.cli.empty()) {
    places.launcher =
        places.cli.Append(FILE_PATH_LITERAL("bin")).Append(kLauncher);
  }
  places.isolated = command_line.HasSwitch(switches::kUserDataDir);
  if (std::optional<base::FilePath> bin = EnvironmentPath(kBinDirVariable)) {
    places.bin = *bin;
    places.default_bin = false;
    return places;
  }
#if BUILDFLAG(IS_WIN)
  if (base::FilePath local; base::PathService::Get(base::DIR_LOCAL_APP_DATA, &local)) {
    places.bin = local.Append(FILE_PATH_LITERAL("Oxy"))
                     .Append(FILE_PATH_LITERAL("Astro"))
                     .Append(FILE_PATH_LITERAL("bin"));
  }
#else
  places.bin = base::GetHomeDir()
                   .Append(FILE_PATH_LITERAL(".local"))
                   .Append(FILE_PATH_LITERAL("bin"));
#endif
  return places;
}

std::optional<std::string> BundledVersion(const Places& places) {
  std::string text;
  if (places.cli.empty() ||
      !base::ReadFileToStringWithMaxSize(
          places.cli.Append(FILE_PATH_LITERAL("VERSION")), &text,
          kVersionLimit)) {
    return std::nullopt;
  }
  const std::string version(base::TrimWhitespaceASCII(text, base::TRIM_ALL));
  if (version.empty() || !std::ranges::all_of(version, [](char c) {
        return base::IsAsciiAlphaNumeric(c) || c == '.' || c == '-';
      })) {
    return std::nullopt;
  }
  return version;
}

base::FilePath Shim(const Places& places) {
  return places.bin.Append(kLauncher);
}

#if BUILDFLAG(IS_WIN)
std::optional<std::string> ToConsoleText(const std::wstring& text) {
  BOOL lossy = FALSE;
  const int size = ::WideCharToMultiByte(
      CP_OEMCP, WC_NO_BEST_FIT_CHARS, text.data(), static_cast<int>(text.size()),
      nullptr, 0, nullptr, &lossy);
  if (size <= 0 || lossy) {
    return std::nullopt;
  }
  std::string out(size, '\0');
  ::WideCharToMultiByte(CP_OEMCP, WC_NO_BEST_FIT_CHARS, text.data(),
                        static_cast<int>(text.size()), out.data(), size,
                        nullptr, &lossy);
  return lossy ? std::nullopt : std::optional(out);
}

std::wstring FromConsoleText(const std::string& text) {
  const int size = ::MultiByteToWideChar(CP_OEMCP, 0, text.data(),
                                         static_cast<int>(text.size()),
                                         nullptr, 0);
  if (size <= 0) {
    return std::wstring();
  }
  std::wstring out(size, L'\0');
  ::MultiByteToWideChar(CP_OEMCP, 0, text.data(), static_cast<int>(text.size()),
                        out.data(), size);
  return out;
}

std::wstring ShimText(const Places& places) {
  return base::StrCat(
      {L"@echo off\r\n\"", places.launcher.value(), L"\" %*\r\n"});
}

std::optional<base::FilePath> ShimTarget(const base::FilePath& shim) {
  std::string bytes;
  if (!base::ReadFileToStringWithMaxSize(shim, &bytes, 4096)) {
    return std::nullopt;
  }
  const std::vector<std::wstring> lines =
      base::SplitString(FromConsoleText(bytes), L"\r\n",
                        base::TRIM_WHITESPACE, base::SPLIT_WANT_NONEMPTY);
  if (lines.size() != 2 || lines[0] != L"@echo off" ||
      !lines[1].starts_with(L'"') || !lines[1].ends_with(L"\" %*")) {
    return std::nullopt;
  }
  return base::FilePath(lines[1].substr(1, lines[1].size() - 5));
}

bool OursAt(const base::FilePath& target) {
  return base::EndsWith(target.value(), L"\\cli\\bin\\astro.cmd",
                        base::CompareCase::INSENSITIVE_ASCII);
}

std::optional<std::string> PlaceShim(const Places& places) {
  const base::FilePath shim = Shim(places);
  if (base::PathExists(shim)) {
    std::optional<base::FilePath> target = ShimTarget(shim);
    if (!target || !OursAt(*target)) {
      return base::StrCat({shim.AsUTF8Unsafe(),
                           " exists and isn't Astro's; remove it first"});
    }
  }
  const std::optional<std::string> text = ToConsoleText(ShimText(places));
  if (!text) {
    return "Astro's folder name can't be written in a command script; move "
           "Astro to a folder with a plainer name";
  }
  if (!base::CreateDirectory(places.bin)) {
    return "Couldn't create " + places.bin.AsUTF8Unsafe();
  }
  if (!base::ImportantFileWriter::WriteFileAtomically(shim, *text)) {
    return "Couldn't write " + shim.AsUTF8Unsafe();
  }
  return std::nullopt;
}

std::optional<base::FilePath> InstalledTarget(const Places& places) {
  return ShimTarget(Shim(places));
}

bool SamePath(const base::FilePath& a, const base::FilePath& b) {
  return base::EqualsCaseInsensitiveASCII(
      a.NormalizePathSeparators().StripTrailingSeparators().value(),
      b.NormalizePathSeparators().StripTrailingSeparators().value());
}

std::wstring Expanded(const std::wstring& entry) {
  std::wstring out(32768, L'\0');
  const DWORD used = ::ExpandEnvironmentStringsW(
      entry.c_str(), out.data(), static_cast<DWORD>(out.size()));
  if (used == 0 || used > out.size()) {
    return entry;
  }
  out.resize(used - 1);
  return out;
}

std::optional<std::string> AddToPath(const Places& places, bool* changed) {
  base::win::RegKey key;
  if (key.Create(HKEY_CURRENT_USER, kEnvironmentKey,
                 KEY_QUERY_VALUE | KEY_SET_VALUE) != ERROR_SUCCESS) {
    return "Couldn't open the user's environment settings";
  }
  DWORD type = REG_EXPAND_SZ;
  DWORD size = 0;
  std::wstring current;
  if (key.ReadValue(kPathValue, nullptr, &size, &type) == ERROR_SUCCESS &&
      size > 0) {
    if (type != REG_SZ && type != REG_EXPAND_SZ) {
      return "The user's Path setting isn't text";
    }
    std::vector<wchar_t> data(size / sizeof(wchar_t) + 1, L'\0');
    if (key.ReadValue(kPathValue, data.data(), &size, &type) != ERROR_SUCCESS) {
      return "Couldn't read the user's Path setting";
    }
    current = std::wstring(data.data());
  } else {
    type = REG_EXPAND_SZ;
  }
  for (const std::wstring& entry : base::SplitString(
           current, L";", base::TRIM_WHITESPACE, base::SPLIT_WANT_NONEMPTY)) {
    if (SamePath(base::FilePath(Expanded(entry)), places.bin)) {
      return std::nullopt;
    }
  }
  std::wstring updated = current;
  if (!updated.empty() && !updated.ends_with(L';')) {
    updated += L';';
  }
  updated += places.bin.value();
  if (key.WriteValue(kPathValue, updated.c_str(),
                     static_cast<DWORD>((updated.size() + 1) * sizeof(wchar_t)),
                     type) != ERROR_SUCCESS) {
    return "Couldn't update the user's Path setting";
  }
  ::SendMessageTimeoutW(HWND_BROADCAST, WM_SETTINGCHANGE, 0,
                        reinterpret_cast<LPARAM>(kEnvironmentKey),
                        SMTO_ABORTIFHUNG, 5000, nullptr);
  *changed = true;
  return std::nullopt;
}
#else
bool OursAt(const base::FilePath& target) {
  return base::EndsWith(target.value(), "/cli/bin/astro");
}

std::optional<base::FilePath> InstalledTarget(const Places& places) {
  base::FilePath target;
  if (!base::ReadSymbolicLink(Shim(places), &target)) {
    return std::nullopt;
  }
  return target;
}

bool SamePath(const base::FilePath& a, const base::FilePath& b) {
  return a.StripTrailingSeparators() == b.StripTrailingSeparators();
}

std::optional<std::string> PlaceShim(const Places& places) {
  const base::FilePath shim = Shim(places);
  if (base::IsLink(shim)) {
    std::optional<base::FilePath> target = InstalledTarget(places);
    if (!target || !OursAt(*target)) {
      return base::StrCat({shim.value(),
                           " links somewhere else; remove it first"});
    }
  } else if (base::PathExists(shim)) {
    return base::StrCat({shim.value(), " exists and isn't Astro's link; "
                                       "remove it first"});
  }
  if (!base::CreateDirectory(places.bin)) {
    return "Couldn't create " + places.bin.value();
  }
  const base::FilePath temp = places.bin.Append(base::StrCat(
      {".astro.", base::HexEncode(base::RandBytesAsVector(6))}));
  if (!base::CreateSymbolicLink(places.launcher, temp)) {
    return "Couldn't create a link in " + places.bin.value();
  }
  if (!base::ReplaceFile(temp, shim, nullptr)) {
    base::DeleteFile(temp);
    return "Couldn't link " + shim.value();
  }
  return std::nullopt;
}

std::optional<std::string> AddToPath(const Places& places,
                                     base::FilePath* rc_file) {
  std::optional<std::string> path =
      base::Environment::Create()->GetVar("PATH");
  for (const std::string& entry :
       base::SplitString(path.value_or(""), ":", base::TRIM_WHITESPACE,
                         base::SPLIT_WANT_NONEMPTY)) {
    if (SamePath(base::FilePath(entry), places.bin)) {
      return std::nullopt;
    }
  }
  const base::FilePath profile =
      base::GetHomeDir().Append(FILE_PATH_LITERAL(".profile"));
  std::string text;
  base::ReadFileToStringWithMaxSize(profile, &text, 1 << 20);
  if (text.find(".local/bin") != std::string::npos) {
    return std::nullopt;
  }
  const std::string line = text.empty() || text.ends_with('\n')
                               ? std::string(kPathLine)
                               : base::StrCat({"\n", kPathLine});
  if (!base::AppendToFile(profile, line)) {
    return "Couldn't add " + places.bin.value() + " to " + profile.value();
  }
  *rc_file = profile;
  return std::nullopt;
}
#endif

base::DictValue Status(const Places& places) {
  base::DictValue status;
  const std::optional<std::string> version = BundledVersion(places);
  status.Set("available", !places.launcher.empty() &&
                              base::PathExists(places.launcher));
  status.Set("binPath", Shim(places).AsUTF8Unsafe());
  const std::optional<base::FilePath> target = InstalledTarget(places);
  const bool installed = target && OursAt(*target);
  status.Set("installed", installed);
  status.Set("current", installed && SamePath(*target, places.launcher));
  if (version) {
    status.Set("version", *version);
  }
  return status;
}

base::DictValue Install(const Places& places) {
  base::DictValue result;
  base::ListValue lines;
  const auto fail = [&](std::string_view error) {
    result.Set("ok", false);
    result.Set("error", error);
    result.Set("lines", std::move(lines));
    return std::move(result);
  };
  if (places.isolated && places.default_bin) {
    return fail(
        "A test instance installs only with ASTRO_CLI_BIN_DIR set.");
  }
  if (places.launcher.empty() || !base::PathExists(places.launcher)) {
    return fail("The astro command isn't in this build of Astro.");
  }
  if (places.bin.empty()) {
    return fail("Astro can't find a folder for the astro command.");
  }
  const std::optional<std::string> version = BundledVersion(places);
  lines.Append("step link");
  if (version) {
    lines.Append("version " + *version);
  }
  if (std::optional<std::string> error = PlaceShim(places)) {
    return fail(*error);
  }
  if (places.default_bin) {
#if BUILDFLAG(IS_WIN)
    bool changed = false;
    if (std::optional<std::string> error = AddToPath(places, &changed)) {
      return fail(*error);
    }
    if (changed) {
      result.Set("rcFile", "Path (user environment)");
    }
#else
    base::FilePath rc_file;
    if (std::optional<std::string> error = AddToPath(places, &rc_file)) {
      return fail(*error);
    }
    if (!rc_file.empty()) {
      lines.Append("path " + rc_file.value());
      result.Set("rcFile", rc_file.value());
    }
#endif
  }
  const std::string bin_path = Shim(places).AsUTF8Unsafe();
  lines.Append("installed " + bin_path);
  result.Set("ok", true);
  result.Set("binPath", bin_path);
  if (version) {
    result.Set("version", *version);
  }
  result.Set("lines", std::move(lines));
  return result;
}

}
}

AC_ENGINE_CALL(ac_cli_install) {
  DCHECK_CURRENTLY_ON(content::BrowserThread::UI);
  astro::Reply out(reply, context);
  std::optional<base::Value> parsed =
      args_json && *args_json
          ? base::JSONReader::Read(args_json, base::JSON_PARSE_RFC)
          : std::nullopt;
  const std::string* method =
      parsed && parsed->is_dict() ? parsed->GetDict().FindString("method")
                                  : nullptr;
  if (!method || (*method != "status" && *method != "install")) {
    return out.Error("method must be status or install");
  }
  const astro::Places places =
      astro::Locate(*base::CommandLine::ForCurrentProcess());
  astro::Sequence()->PostTaskAndReplyWithResult(
      FROM_HERE,
      base::BindOnce(*method == "install" ? &astro::Install : &astro::Status,
                     places),
      base::BindOnce([](astro::Reply out,
                        base::DictValue result) { out.Send(std::move(result)); },
                     std::move(out)));
}
