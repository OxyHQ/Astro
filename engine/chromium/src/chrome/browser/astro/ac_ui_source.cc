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
#include "base/strings/string_util.h"
#include "base/task/thread_pool.h"
#include "content/public/browser/web_ui_data_source.h"
#include "services/network/public/mojom/content_security_policy.mojom.h"

namespace astro {
namespace {

std::optional<base::FilePath> Resolve(const base::FilePath& dir,
                                      const std::string& path) {
  const std::string relative =
      path.substr(0, path.find_first_of("?#"));
  if (relative.find("..") != std::string::npos ||
      relative.find('\\') != std::string::npos ||
      base::StartsWith(relative, "/")) {
    return std::nullopt;
  }
  return dir.AppendASCII(relative.empty() ? "index.html" : relative);
}

bool ShouldServe(const base::FilePath& dir, const std::string& path) {
  std::optional<base::FilePath> file = Resolve(dir, path);
  return file && base::PathExists(*file) && !base::DirectoryExists(*file);
}

void Serve(const base::FilePath& dir,
           const std::string& path,
           content::WebUIDataSource::GotDataCallback done) {
  std::optional<base::FilePath> file = Resolve(dir, path);
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

}

void ServeUiFromDisk(content::WebUIDataSource* source) {
  base::FilePath dir =
      base::CommandLine::ForCurrentProcess()->GetSwitchValuePath(
          kAstroUiDirSwitch);
  if (dir.empty()) {
    base::FilePath exe_dir;
    if (!base::PathService::Get(base::DIR_EXE, &exe_dir)) {
      return;
    }
    dir = exe_dir.AppendASCII(kAstroUiDirName);
    if (!base::PathExists(dir.AppendASCII("index.html"))) {
      return;
    }
  }
  source->SetRequestFilter(base::BindRepeating(&ShouldServe, dir),
                           base::BindRepeating(&Serve, dir));
  source->OverrideContentSecurityPolicy(
      network::mojom::CSPDirectiveName::RequireTrustedTypesFor, "");
  source->OverrideContentSecurityPolicy(
      network::mojom::CSPDirectiveName::TrustedTypes, "");
}

}
