// Copyright 2026 Oxy. Apache-2.0.

#include "chrome/browser/astro/ac_ui_source.h"

#include <optional>
#include <string>
#include <utility>

#include "base/command_line.h"
#include "base/files/file_path.h"
#include "base/files/file_util.h"
#include "base/functional/bind.h"
#include "base/memory/ref_counted_memory.h"
#include "base/path_service.h"
#include "base/strings/strcat.h"
#include "base/strings/string_util.h"
#include "base/task/thread_pool.h"
#include "build/build_config.h"
#include "chrome/browser/astro/ac_translate.h"
#include "chrome/browser/profiles/profile.h"
#include "content/public/browser/web_ui_data_source.h"
#include "services/network/public/mojom/content_security_policy.mojom.h"

#if !BUILDFLAG(IS_MAC)
#include "chrome/grit/astro_ui_resources.h"
#include "chrome/grit/astro_ui_resources_map.h"
#endif

namespace astro {
namespace {

constexpr char kInterfaceProfileDir[] = "Default";
constexpr char kHostPage[] = "<!doctype html><title>Astro</title>";

std::optional<base::FilePath> Resolve(const base::FilePath& dir,
                                      const base::FilePath& profile_dir,
                                      const std::string& path) {
  if (std::optional<base::FilePath> file = TranslationFile(profile_dir, path)) {
    return file;
  }
  if (dir.empty()) {
    return std::nullopt;
  }
  const std::string relative =
      path.substr(0, path.find_first_of("?#"));
  if (relative.find("..") != std::string::npos ||
      relative.find('\\') != std::string::npos ||
      base::StartsWith(relative, "/")) {
    return std::nullopt;
  }
  return dir.AppendASCII(relative.empty() ? "index.html" : relative);
}

bool ShouldServe(const base::FilePath& dir,
                 const base::FilePath& profile_dir,
                 const std::string& path) {
  if (TranslationFile(profile_dir, path)) {
    return true;
  }
  std::optional<base::FilePath> file = Resolve(dir, profile_dir, path);
  return file && base::PathExists(*file) && !base::DirectoryExists(*file);
}

void Serve(const base::FilePath& dir,
           const base::FilePath& profile_dir,
           const std::string& path,
           content::WebUIDataSource::GotDataCallback done) {
  std::optional<base::FilePath> file = Resolve(dir, profile_dir, path);
  if (!file) {
    std::move(done).Run(nullptr);
    return;
  }
  base::ThreadPool::PostTaskAndReplyWithResult(
      FROM_HERE, {base::MayBlock(), base::TaskPriority::USER_BLOCKING},
      base::BindOnce(
          [](base::FilePath file) -> scoped_refptr<base::RefCountedMemory> {
            std::string contents;
            if (!base::ReadFileToString(file, &contents)) {
              return nullptr;
            }
            return base::MakeRefCounted<base::RefCountedString>(
                std::move(contents));
          },
          *file),
      std::move(done));
}

void ServeFrom(content::WebUIDataSource* source,
               const base::FilePath& dir,
               const base::FilePath& profile_dir) {
  source->SetRequestFilter(base::BindRepeating(&ShouldServe, dir, profile_dir),
                           base::BindRepeating(&Serve, dir, profile_dir));
}

bool ServeFromPak(content::WebUIDataSource* source,
                  const base::FilePath& profile_dir) {
#if BUILDFLAG(IS_MAC)
  return false;
#else
  source->AddResourcePaths(kAstroUiResources);
  source->SetDefaultResource(IDR_ASTRO_UI_INDEX_HTML);
  ServeFrom(source, base::FilePath(), profile_dir);
  return true;
#endif
}

}

void ServeUi(content::WebUIDataSource* source, Profile* profile) {
  if (profile->IsOffTheRecord() ||
      profile->GetPath().BaseName().AsUTF8Unsafe() != kInterfaceProfileDir) {
    source->SetRequestFilter(
        base::BindRepeating([](const std::string&) { return true; }),
        base::BindRepeating([](const std::string&,
                               content::WebUIDataSource::GotDataCallback done) {
          std::move(done).Run(base::MakeRefCounted<base::RefCountedString>(
              std::string(kHostPage)));
        }));
    return;
  }
  const base::FilePath profile_dir = profile->GetPath();
  const base::FilePath dir =
      base::CommandLine::ForCurrentProcess()->GetSwitchValuePath(
          kAstroUiDirSwitch);
  if (!dir.empty()) {
    ServeFrom(source, dir, profile_dir);
  } else if (!ServeFromPak(source, profile_dir)) {
    return;
  }
  source->OverrideContentSecurityPolicy(
      network::mojom::CSPDirectiveName::RequireTrustedTypesFor, "");
  source->OverrideContentSecurityPolicy(
      network::mojom::CSPDirectiveName::TrustedTypes, "");
  source->OverrideContentSecurityPolicy(
      network::mojom::CSPDirectiveName::ScriptSrc,
      "script-src chrome://resources 'self' 'wasm-unsafe-eval';");
  source->OverrideContentSecurityPolicy(
      network::mojom::CSPDirectiveName::WorkerSrc, "worker-src 'self';");
  source->OverrideContentSecurityPolicy(
      network::mojom::CSPDirectiveName::ConnectSrc,
      base::StrCat({"connect-src chrome://webui-test chrome://resources "
                    "chrome://theme 'self' https://api.oxy.so wss://api.oxy.so "
                    "https://api.nilo.so wss://api.nilo.so",
                    dir.empty() ? "" : " ws://localhost:* ws://127.0.0.1:*",
                    ";"}));
}

base::FilePath BesideEngine(std::string_view relative) {
  for (const int key : {base::DIR_EXE, base::DIR_MODULE}) {
    base::FilePath dir;
    if (base::PathService::Get(key, &dir)) {
      const base::FilePath path = dir.AppendASCII(relative);
      if (base::PathExists(path)) {
        return path;
      }
    }
  }
  return base::FilePath();
}

}
