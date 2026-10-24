// Copyright 2026 Oxy. Apache-2.0.

#include "chrome/browser/astro/ac_updater.h"

#include <algorithm>
#include <cstdint>
#include <memory>
#include <optional>
#include <string>
#include <utility>
#include <vector>

#include "base/base64.h"
#include "base/base_paths.h"
#include "base/callback_list.h"
#include "base/command_line.h"
#include "base/environment.h"
#include "base/files/file_enumerator.h"
#include "base/files/file_path.h"
#include "base/files/file_util.h"
#include "base/files/memory_mapped_file.h"
#include "base/functional/bind.h"
#include "base/no_destructor.h"
#include "base/path_service.h"
#include "base/process/process_handle.h"
#include "base/strings/string_number_conversions.h"
#include "base/strings/string_util.h"
#include "base/strings/utf_string_conversions.h"
#include "base/task/sequenced_task_runner.h"
#include "base/task/thread_pool.h"
#include "build/build_config.h"
#include "chrome/browser/astro/ac_host.h"
#include "chrome/browser/browser_process.h"
#include "chrome/browser/lifetime/application_lifetime.h"
#include "chrome/browser/lifetime/browser_shutdown.h"
#include "chrome/browser/lifetime/termination_notification.h"
#include "chrome/common/chrome_paths.h"
#include "chrome/common/chrome_switches.h"
#include "components/version_info/version_info.h"
#include "crypto/hash.h"
#include "net/base/load_flags.h"
#include "net/base/net_errors.h"
#include "net/traffic_annotation/network_traffic_annotation.h"
#include "services/network/public/cpp/resource_request.h"
#include "services/network/public/cpp/shared_url_loader_factory.h"
#include "services/network/public/cpp/simple_url_loader.h"
#include "third_party/boringssl/src/include/openssl/curve25519.h"
#include "url/gurl.h"
#include "url/url_constants.h"

#if BUILDFLAG(IS_WIN)
#include "base/process/launch.h"
#endif

namespace astro {
namespace {

using Done = base::OnceCallback<void(base::Value)>;

constexpr int64_t kMaxInstallerSize = int64_t{1} << 30;
constexpr int kProgressSteps = 200;
constexpr base::FilePath::CharType kUpdatesFolder[] =
    FILE_PATH_LITERAL("Astro Updates");

constexpr net::NetworkTrafficAnnotationTag kUpdateAnnotation =
    net::DefineNetworkTrafficAnnotation("astro_update_download", R"(
      semantics {
        sender: "Astro updater"
        description:
          "Downloads a newer version of Astro's Windows installer, listed in "
          "Astro's update feed, so it can be installed when Astro quits."
        trigger:
          "An automatic update check found a newer version and automatic "
          "downloads are on, or the user asked to check for or install an "
          "update."
        data: "None."
        destination: OTHER
      }
      policy {
        cookies_allowed: NO
        setting:
          "Settings > General > Updates: automatic checks and downloads."
        policy_exception_justification: "Not implemented."
      })");

struct Signed {
  int64_t length = 0;
  std::string signature;
  std::string public_key;
};

struct Verification {
  bool ok = false;
  std::string error;
  std::string sha256;
};

struct PendingInstall {
  base::FilePath installer;
  std::string sha256;
};

struct UpdaterState {
  std::unique_ptr<network::SimpleURLLoader> download;
  std::string downloading;
  std::optional<PendingInstall> on_quit;
  base::CallbackListSubscription terminating;
  bool installing = false;
};

UpdaterState& State() {
  static base::NoDestructor<UpdaterState> state;
  return *state;
}

void Fail(Done done, const std::string& error) {
  std::move(done).Run(base::Value(base::DictValue().Set("error", error)));
}

bool ValidVersion(const std::string& version) {
  return !version.empty() && version.size() <= 40 &&
         std::ranges::all_of(version, [](char c) {
           return base::IsAsciiAlphaNumeric(c) || c == '.' || c == '-';
         });
}

base::FilePath UpdatesDirectory() {
  base::FilePath user_data;
  if (!base::PathService::Get(chrome::DIR_USER_DATA, &user_data)) {
    return base::FilePath();
  }
  return user_data.Append(kUpdatesFolder);
}

base::FilePath InstallerPath(const std::string& version) {
  const base::FilePath directory = UpdatesDirectory();
  return directory.empty() ? directory
                           : directory.AppendASCII("Astro-" + version +
                                                   "-windows-x64-setup.exe");
}

base::FilePath PartialPath(const base::FilePath& installer) {
  return installer.AddExtensionASCII("download");
}

std::optional<Signed> SignedFrom(const base::DictValue& args) {
  const std::string* signature = args.FindString("signature");
  const std::string* key = args.FindString("publicKey");
  if (!signature || !key || signature->empty() || key->empty()) {
    return std::nullopt;
  }
  Signed expected;
  expected.length = std::max<int64_t>(
      0, static_cast<int64_t>(args.FindDouble("length").value_or(0)));
  expected.signature = *signature;
  expected.public_key = *key;
  return expected;
}

bool IsInstalledCopy() {
#if BUILDFLAG(IS_WIN)
  base::FilePath exe;
  if (!base::PathService::Get(base::FILE_EXE, &exe)) {
    return false;
  }
  return base::PathExists(exe.DirName()
                              .AppendASCII(version_info::GetVersionNumber())
                              .AppendASCII("Installer")
                              .AppendASCII("setup.exe"));
#else
  return false;
#endif
}

base::Value Info() {
  std::unique_ptr<base::Environment> env = base::Environment::Create();
  const bool isolated =
      base::CommandLine::ForCurrentProcess()->HasSwitch(
          switches::kUserDataDir) ||
      env->HasVar("ASTRO_DATA_DIR") ||
      env->GetVar("ASTRO_BACKGROUND").value_or("") == "1";
  base::DictValue info;
  info.Set("supported", static_cast<bool>(BUILDFLAG(IS_WIN)));
  info.Set("installed", IsInstalledCopy());
  info.Set("isolated", isolated);
  if (std::optional<std::string> feed = env->GetVar("ASTRO_UPDATE_FEED_URL");
      feed && !feed->empty()) {
    info.Set("feed", *feed);
  }
  return base::Value(std::move(info));
}

Verification Verify(const base::FilePath& path, const Signed& expected) {
  Verification result;
  std::optional<std::vector<uint8_t>> signature =
      base::Base64Decode(expected.signature);
  std::optional<std::vector<uint8_t>> key =
      base::Base64Decode(expected.public_key);
  if (!signature || signature->size() != ED25519_SIGNATURE_LEN || !key ||
      key->size() != ED25519_PUBLIC_KEY_LEN) {
    result.error = "the update's signature or the public key is malformed";
    return result;
  }
  base::MemoryMappedFile file;
  if (!file.Initialize(path)) {
    result.error = "couldn't read the update";
    return result;
  }
  base::span<const uint8_t> bytes = file.bytes();
  if (bytes.empty() ||
      (expected.length > 0 &&
       bytes.size() != static_cast<uint64_t>(expected.length))) {
    result.error = "the update's size doesn't match the feed";
    return result;
  }
  if (!ED25519_verify(bytes.data(), bytes.size(), signature->data(),
                      key->data())) {
    result.error = "the update's signature doesn't match";
    return result;
  }
  result.sha256 = base::HexEncode(crypto::hash::Sha256(bytes));
  result.ok = true;
  return result;
}

void RemoveOthers(const base::FilePath& directory, const base::FilePath& keep) {
  base::FileEnumerator files(directory, false, base::FileEnumerator::FILES);
  for (base::FilePath file = files.Next(); !file.empty(); file = files.Next()) {
    if (file != keep) {
      base::DeleteFile(file);
    }
  }
}

Verification PrepareDownload(const base::FilePath& installer,
                             const Signed& expected) {
  Verification result;
  if (!base::CreateDirectory(installer.DirName())) {
    result.error = "couldn't create the updates folder";
    return result;
  }
  RemoveOthers(installer.DirName(), installer);
  if (base::PathExists(installer)) {
    Verification existing = Verify(installer, expected);
    if (existing.ok) {
      return existing;
    }
    base::DeleteFile(installer);
  }
  return result;
}

Verification FinishDownload(const base::FilePath& installer,
                            const Signed& expected) {
  const base::FilePath partial = PartialPath(installer);
  Verification result = Verify(partial, expected);
  if (result.ok && !base::ReplaceFile(partial, installer, nullptr)) {
    result.ok = false;
    result.error = "couldn't keep the update";
  }
  if (!result.ok) {
    base::DeleteFile(partial);
  }
  return result;
}

base::Value Verified(const base::FilePath& installer,
                     const Verification& verification) {
  return base::Value(base::DictValue()
                         .Set("ok", true)
                         .Set("path", installer.AsUTF8Unsafe())
                         .Set("sha256", verification.sha256));
}

void ReportProgress(const std::string& version,
                    int64_t total,
                    int64_t* last_step,
                    uint64_t received) {
  const int64_t step =
      total > 0 ? static_cast<int64_t>(received) * kProgressSteps / total
                : static_cast<int64_t>(received >> 20);
  if (step == *last_step) {
    return;
  }
  *last_step = step;
  HostEvent("updaterProgress",
            base::DictValue()
                .Set("version", version)
                .Set("received", static_cast<double>(received))
                .Set("total", static_cast<double>(total)));
}

void Downloaded(const base::FilePath& installer,
                const Signed& expected,
                Done done,
                base::FilePath written) {
  UpdaterState& state = State();
  std::unique_ptr<network::SimpleURLLoader> loader = std::move(state.download);
  state.downloading.clear();
  if (written.empty()) {
    const int error = loader ? loader->NetError() : net::ERR_FAILED;
    base::ThreadPool::PostTask(
        FROM_HERE, {base::MayBlock()},
        base::GetDeleteFileCallback(PartialPath(installer)));
    return Fail(std::move(done),
                "couldn't download the update (" +
                    net::ErrorToShortString(error) + ")");
  }
  base::ThreadPool::PostTaskAndReplyWithResult(
      FROM_HERE, {base::MayBlock(), base::TaskPriority::USER_VISIBLE},
      base::BindOnce(&FinishDownload, installer, expected),
      base::BindOnce(
          [](const base::FilePath& installer, Done done,
             Verification verification) {
            if (!verification.ok) {
              return Fail(std::move(done), verification.error);
            }
            std::move(done).Run(Verified(installer, verification));
          },
          installer, std::move(done)));
}

void StartDownload(const GURL& url,
                   const base::FilePath& installer,
                   const Signed& expected,
                   const std::string& version,
                   Done done,
                   Verification existing) {
  UpdaterState& state = State();
  if (existing.ok || !existing.error.empty()) {
    state.downloading.clear();
    if (existing.ok) {
      return std::move(done).Run(Verified(installer, existing));
    }
    return Fail(std::move(done), existing.error);
  }
  auto request = std::make_unique<network::ResourceRequest>();
  request->url = url;
  request->credentials_mode = network::mojom::CredentialsMode::kOmit;
  request->load_flags = net::LOAD_DISABLE_CACHE;
  std::unique_ptr<network::SimpleURLLoader> loader =
      network::SimpleURLLoader::Create(std::move(request), kUpdateAnnotation);
  loader->SetOnDownloadProgressCallback(base::BindRepeating(
      &ReportProgress, version, expected.length,
      base::Owned(std::make_unique<int64_t>(-1))));
  network::SimpleURLLoader* raw = loader.get();
  state.download = std::move(loader);
  raw->DownloadToFile(
      g_browser_process->shared_url_loader_factory().get(),
      base::BindOnce(&Downloaded, installer, expected, std::move(done)),
      PartialPath(installer),
      expected.length > 0 ? expected.length : kMaxInstallerSize);
}

void Download(const base::DictValue& args, Done done) {
  const std::string* version = args.FindString("version");
  const std::string* url_string = args.FindString("url");
  std::optional<Signed> expected = SignedFrom(args);
  const GURL url(url_string ? *url_string : std::string());
  if (!version || !ValidVersion(*version) || !expected || !url.is_valid() ||
      !url.SchemeIs(url::kHttpsScheme)) {
    return Fail(std::move(done), "not a valid update");
  }
  UpdaterState& state = State();
  if (!state.downloading.empty()) {
    return Fail(std::move(done), state.downloading == *version
                                     ? "already downloading this update"
                                     : "another update is downloading");
  }
  const base::FilePath installer = InstallerPath(*version);
  if (installer.empty()) {
    return Fail(std::move(done), "no user data folder");
  }
  state.downloading = *version;
  base::ThreadPool::PostTaskAndReplyWithResult(
      FROM_HERE, {base::MayBlock(), base::TaskPriority::USER_VISIBLE},
      base::BindOnce(&PrepareDownload, installer, *expected),
      base::BindOnce(&StartDownload, url, installer, *expected, *version,
                     std::move(done)));
}

#if BUILDFLAG(IS_WIN)
std::wstring PowerShellQuoted(const std::wstring& text) {
  std::wstring quoted = L"'";
  for (wchar_t c : text) {
    quoted += c;
    if (c == L'\'' || c == 0x2018 || c == 0x2019 || c == 0x201A ||
        c == 0x201B) {
      quoted += c;
    }
  }
  return quoted + L"'";
}

bool LaunchInstaller(const PendingInstall& pending, bool relaunch) {
  base::FilePath exe;
  base::FilePath system;
  if (!base::PathService::Get(base::FILE_EXE, &exe) ||
      !base::PathService::Get(base::DIR_SYSTEM, &system) ||
      pending.sha256.empty()) {
    return false;
  }
  std::wstring script =
      L"$ErrorActionPreference = 'SilentlyContinue'\n"
      L"$app = " +
      PowerShellQuoted(exe.DirName().value()) +
      L"\n"
      L"$installer = " +
      PowerShellQuoted(pending.installer.value()) +
      L"\n"
      L"Wait-Process -Id " +
      base::NumberToWString(base::GetCurrentProcId()) +
      L" -Timeout 120\n"
      L"$deadline = (Get-Date).AddSeconds(60)\n"
      L"while ((Get-Date) -lt $deadline -and (Get-Process | Where-Object { "
      L"$_.Path -and $_.Path.StartsWith($app + '\\', "
      L"[StringComparison]::OrdinalIgnoreCase) })) { Start-Sleep "
      L"-Milliseconds 250 }\n"
      L"if ((Get-FileHash -LiteralPath $installer -Algorithm SHA256).Hash "
      L"-eq '" +
      base::ASCIIToWide(pending.sha256) +
      L"') { Start-Process -FilePath $installer -Wait }\n"
      L"Remove-Item -LiteralPath $installer -Force\n";
  if (relaunch) {
    script += L"Start-Process -FilePath " +
              PowerShellQuoted(exe.value()) + L"\n";
  }
  base::CommandLine command(system.Append(L"WindowsPowerShell")
                                .Append(L"v1.0")
                                .Append(L"powershell.exe"));
  command.AppendArg("-NoProfile");
  command.AppendArg("-NonInteractive");
  command.AppendArg("-ExecutionPolicy");
  command.AppendArg("Bypass");
  command.AppendArg("-WindowStyle");
  command.AppendArg("Hidden");
  command.AppendArg("-EncodedCommand");
  command.AppendArg(base::Base64Encode(base::as_byte_span(script)));
  base::LaunchOptions options;
  options.start_hidden = true;
  options.feedback_cursor_off = true;
  return base::LaunchProcess(command, options).IsValid();
}
#else
bool LaunchInstaller(const PendingInstall&, bool) {
  return false;
}
#endif

void InstallOnQuit() {
  UpdaterState& state = State();
  if (state.installing || !state.on_quit ||
      browser_shutdown::GetShutdownType() ==
          browser_shutdown::ShutdownType::kEndSession) {
    return;
  }
  state.installing = true;
  LaunchInstaller(*state.on_quit, false);
}

void Install(const base::DictValue& args, bool now, Done done) {
  const std::string* version = args.FindString("version");
  std::optional<Signed> expected = SignedFrom(args);
  if (!version || !ValidVersion(*version) || !expected) {
    return Fail(std::move(done), "not a valid update");
  }
  const base::FilePath installer = InstallerPath(*version);
  if (installer.empty() || State().installing) {
    return Fail(std::move(done), "can't install now");
  }
  base::ThreadPool::PostTaskAndReplyWithResult(
      FROM_HERE, {base::MayBlock(), base::TaskPriority::USER_BLOCKING},
      base::BindOnce(&Verify, installer, *expected),
      base::BindOnce(
          [](const base::FilePath& installer, bool now, Done done,
             Verification verification) {
            if (!verification.ok) {
              return Fail(std::move(done), verification.error);
            }
            UpdaterState& state = State();
            PendingInstall pending{installer, verification.sha256};
            if (!now) {
              state.on_quit = std::move(pending);
              if (!state.terminating) {
                state.terminating = browser_shutdown::AddAppTerminatingCallback(
                    base::BindOnce(&InstallOnQuit));
              }
              return std::move(done).Run(Verified(installer, verification));
            }
            if (state.installing || !LaunchInstaller(pending, true)) {
              return Fail(std::move(done), "couldn't start the installer");
            }
            state.installing = true;
            state.on_quit.reset();
            std::move(done).Run(Verified(installer, verification));
            base::SequencedTaskRunner::GetCurrentDefault()->PostTask(
                FROM_HERE, base::BindOnce(&chrome::AttemptUserExit));
          },
          installer, now, std::move(done)));
}

void Clean(const base::DictValue& args, Done done) {
  const std::string* keep = args.FindString("keep");
  base::FilePath kept;
  if (keep && ValidVersion(*keep)) {
    kept = InstallerPath(*keep);
  }
  UpdaterState& state = State();
  if (state.on_quit && state.on_quit->installer != kept) {
    state.on_quit.reset();
  }
  const base::FilePath directory = UpdatesDirectory();
  if (directory.empty() || !state.downloading.empty()) {
    return std::move(done).Run(base::Value(false));
  }
  base::ThreadPool::PostTaskAndReplyWithResult(
      FROM_HERE, {base::MayBlock(), base::TaskPriority::BEST_EFFORT},
      base::BindOnce(
          [](const base::FilePath& directory, const base::FilePath& kept) {
            RemoveOthers(directory, kept);
            return base::Value(true);
          },
          directory, kept),
      std::move(done));
}

}

void UpdaterCall(const std::string& method,
                 const base::DictValue& args,
                 Done done) {
  if (method == "info") {
    base::ThreadPool::PostTaskAndReplyWithResult(
        FROM_HERE, {base::MayBlock(), base::TaskPriority::USER_VISIBLE},
        base::BindOnce(&Info), std::move(done));
    return;
  }
  if (method == "download") {
    Download(args, std::move(done));
  } else if (method == "install") {
    Install(args, true, std::move(done));
  } else if (method == "installOnQuit") {
    Install(args, false, std::move(done));
  } else if (method == "clean") {
    Clean(args, std::move(done));
  } else {
    Fail(std::move(done), "unknown updater call");
  }
}

}
