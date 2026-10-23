// Copyright 2026 Oxy. Apache-2.0.

#include <map>
#include <optional>
#include <string>
#include <utility>

#include "base/functional/bind.h"
#include "base/memory/weak_ptr.h"
#include "base/no_destructor.h"
#include "base/strings/utf_string_conversions.h"
#include "base/task/single_thread_task_runner.h"
#include "base/task/thread_pool.h"
#include "build/build_config.h"
#include "chrome/browser/astro/ac_host.h"
#include "chrome/browser/external_protocol/external_protocol_handler.h"
#include "chrome/browser/profiles/profile.h"
#include "content/public/browser/render_frame_host.h"
#include "content/public/browser/weak_document_ptr.h"
#include "content/public/browser/web_contents.h"
#include "services/network/public/cpp/is_potentially_trustworthy.h"
#include "url/gurl.h"
#include "url/origin.h"

#if BUILDFLAG(IS_LINUX)
#include "base/command_line.h"
#include "base/environment.h"
#include "base/files/file_path.h"
#include "base/files/file_util.h"
#include "base/nix/xdg_util.h"
#include "base/process/launch.h"
#include "base/strings/string_split.h"
#include "base/strings/string_util.h"
#endif

extern bool (*g_astro_external_protocol_dialog)(
    const GURL& url,
    content::WebContents* web_contents,
    const std::optional<url::Origin>& initiating_origin,
    content::WeakDocumentPtr initiator_document,
    const std::u16string& program_name);

namespace astro {
namespace {

struct Pending {
  GURL url;
  base::WeakPtr<content::WebContents> contents;
  std::optional<url::Origin> origin;
  content::WeakDocumentPtr initiator;
  bool can_remember = false;
};

std::map<std::string, Pending>& PendingRequests() {
  static base::NoDestructor<std::map<std::string, Pending>> pending;
  return *pending;
}

#if BUILDFLAG(IS_LINUX)
std::string DesktopEntryName(const std::string& desktop_id) {
  std::unique_ptr<base::Environment> env = base::Environment::Create();
  std::vector<base::FilePath> dirs = {
      base::nix::GetXDGDirectory(env.get(), "XDG_DATA_HOME", ".local/share")};
  const std::string data_dirs =
      env->GetVar("XDG_DATA_DIRS").value_or("/usr/local/share:/usr/share");
  for (const std::string& dir : base::SplitString(
           data_dirs, ":", base::TRIM_WHITESPACE, base::SPLIT_WANT_NONEMPTY)) {
    dirs.emplace_back(dir);
  }
  for (const base::FilePath& dir : dirs) {
    std::string entry;
    if (!base::ReadFileToString(
            dir.Append("applications").Append(desktop_id), &entry)) {
      continue;
    }
    for (std::string_view line : base::SplitStringPiece(
             entry, "\n", base::TRIM_WHITESPACE, base::SPLIT_WANT_NONEMPTY)) {
      if (line.starts_with("Name=")) {
        return std::string(line.substr(5));
      }
    }
  }
  return std::string(base::RemoveSuffix(desktop_id, ".desktop").value_or(desktop_id));
}

std::u16string LinuxHandlerName(const std::string& scheme) {
  std::string desktop_id;
  if (!base::GetAppOutput({"xdg-mime", "query", "default",
                           "x-scheme-handler/" + scheme},
                          &desktop_id)) {
    return std::u16string();
  }
  desktop_id = std::string(
      base::TrimWhitespaceASCII(desktop_id, base::TRIM_ALL));
  return desktop_id.empty() ? std::u16string()
                            : base::UTF8ToUTF16(DesktopEntryName(desktop_id));
}
#endif

base::Value OrNull(const std::string& text) {
  return text.empty() ? base::Value() : base::Value(text);
}

void Ask(const GURL& url,
         base::WeakPtr<content::WebContents> weak_contents,
         const std::optional<url::Origin>& initiating_origin,
         content::WeakDocumentPtr initiator_document,
         const std::u16string& program_name) {
  content::WebContents* contents = weak_contents.get();
  if (!contents) {
    return;
  }
  const std::string name = base::UTF16ToUTF8(program_name);
  const bool has_app = !name.empty();
  const bool has_origin = initiating_origin && !initiating_origin->opaque();
  const std::string origin = has_origin ? initiating_origin->Serialize() : "";
  const std::string scheme(url.scheme());
  Profile* profile = Profile::FromBrowserContext(contents->GetBrowserContext());
  const bool can_remember =
      has_app && has_origin && !profile->IsOffTheRecord() &&
      network::IsOriginPotentiallyTrustworthy(*initiating_origin);
  static int last_id = 0;
  const std::string request_id = "x" + std::to_string(++last_id);
  if (has_app) {
    PendingRequests()[request_id] = {url, contents->GetWeakPtr(),
                                     initiating_origin, initiator_document,
                                     can_remember};
  }
  base::DictValue request =
      base::DictValue()
          .Set("id", request_id)
          .Set("url", url.spec())
          .Set("scheme", scheme)
          .Set("origin", OrNull(origin))
          .Set("app", OrNull(name))
          .Set("appPath", base::Value())
          .Set("icon", base::Value())
          .Set("title", has_app ? "Open “" + name + "”?"
                                : std::string("No application is set to open this link"))
          .Set("message",
               has_app ? (has_origin ? origin + " wants to open this application."
                                     : std::string("This page wants to open this application."))
                       : "This computer doesn’t have an app for “" + scheme +
                             ":” links.")
          .Set("remember",
               can_remember ? base::Value("Always allow " + origin +
                                          " to open links of this type in " + name)
                            : base::Value());
  base::SingleThreadTaskRunner::GetCurrentDefault()->PostTask(
      FROM_HERE,
      base::BindOnce(
          [](base::WeakPtr<content::WebContents> contents,
             base::DictValue request) {
            if (contents) {
              HostTabEvent(contents.get(), "externalApp", std::move(request));
            }
          },
          contents->GetWeakPtr(), std::move(request)));
}

bool AskHost(const GURL& url,
             content::WebContents* contents,
             const std::optional<url::Origin>& initiating_origin,
             content::WeakDocumentPtr initiator_document,
             const std::u16string& program_name) {
  if (!HostShowsTab(contents)) {
    return false;
  }
#if BUILDFLAG(IS_LINUX)
  base::ThreadPool::PostTaskAndReplyWithResult(
      FROM_HERE, {base::MayBlock(), base::TaskPriority::USER_VISIBLE},
      base::BindOnce(&LinuxHandlerName, std::string(url.scheme())),
      base::BindOnce(&Ask, url, contents->GetWeakPtr(), initiating_origin,
                     initiator_document));
#else
  Ask(url, contents->GetWeakPtr(), initiating_origin, initiator_document,
      program_name);
#endif
  return true;
}

}

void InstallExternalAppPrompts() {
  g_astro_external_protocol_dialog = &AskHost;
}

void ResolveExternalApp(const std::string& request_id,
                        bool open,
                        bool remember) {
  auto it = PendingRequests().find(request_id);
  if (it == PendingRequests().end()) {
    return;
  }
  Pending pending = std::move(it->second);
  PendingRequests().erase(it);
  content::WebContents* contents = pending.contents.get();
  if (!open || !contents || !pending.initiator.AsRenderFrameHostIfValid()) {
    return;
  }
  if (remember && pending.can_remember && pending.origin) {
    ExternalProtocolHandler::SetBlockState(
        std::string(pending.url.scheme()), *pending.origin,
        ExternalProtocolHandler::DONT_BLOCK,
        Profile::FromBrowserContext(contents->GetBrowserContext()));
  }
  ExternalProtocolHandler::LaunchUrlWithoutSecurityCheck(pending.url, contents,
                                                         pending.initiator);
}

}
