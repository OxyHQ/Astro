// Copyright 2026 Oxy. Apache-2.0.

#include <map>
#include <string>
#include <utility>

#include "base/base64.h"
#include "base/memory/ref_counted_memory.h"
#include "base/memory/scoped_refptr.h"
#include "base/memory/weak_ptr.h"
#include "base/no_destructor.h"
#include "base/strings/utf_string_conversions.h"
#include "chrome/browser/astro/ac_host.h"
#include "chrome/browser/astro/ac_profile_tabs.h"
#include "chrome/browser/profiles/profile.h"
#include "content/public/browser/web_contents.h"
#include "extensions/browser/extension_install_prompt_client.h"
#include "extensions/browser/install_prompt_data.h"
#include "extensions/common/extension.h"
#include "third_party/skia/include/core/SkBitmap.h"

extern bool (*g_astro_extension_install_prompt)(
    Profile* profile,
    content::WebContents* parent,
    const extensions::InstallPromptData& prompt,
    extensions::ExtensionInstallPromptClient::DoneCallback* done_callback);

extern bool (*g_astro_extension_installed)(
    Profile* profile,
    scoped_refptr<const extensions::Extension> extension,
    const SkBitmap* icon);

namespace astro {
namespace {

using InstallDone = extensions::ExtensionInstallPromptClient::DoneCallback;

struct PendingInstall {
  InstallDone done;
  base::WeakPtr<Profile> profile;
};

std::map<std::string, PendingInstall>& InstallPrompts() {
  static base::NoDestructor<std::map<std::string, PendingInstall>> prompts;
  return *prompts;
}

const char* PromptTypeName(extensions::InstallPromptData::PromptType type) {
  switch (type) {
    case extensions::InstallPromptData::INSTALL_PROMPT:
      return "install";
    case extensions::InstallPromptData::RE_ENABLE_PROMPT:
      return "re-enable";
    case extensions::InstallPromptData::PERMISSIONS_PROMPT:
      return "permissions";
    case extensions::InstallPromptData::EXTERNAL_INSTALL_PROMPT:
      return "external";
    case extensions::InstallPromptData::REMOTE_INSTALL_PROMPT:
      return "remote";
    case extensions::InstallPromptData::REPAIR_PROMPT:
      return "repair";
    default:
      return "other";
  }
}

bool AskHost(Profile* profile,
             content::WebContents* parent,
             const extensions::InstallPromptData& prompt,
             InstallDone* done_callback) {
  const extensions::Extension* extension = prompt.extension();
  if (!extension || !done_callback || done_callback->is_null()) {
    return false;
  }
  static int last_id = 0;
  const std::string request_id = "install" + std::to_string(++last_id);
  base::ListValue permissions;
  for (size_t i = 0; i < prompt.GetPermissionCount(); ++i) {
    permissions.Append(base::UTF16ToUTF8(prompt.GetPermission(i)));
  }
  std::string icon;
  if (!prompt.icon().IsEmpty()) {
    if (auto png = prompt.icon().As1xPNGBytes(); png && png->size()) {
      icon = "data:image/png;base64," +
             base::Base64Encode(base::span<const uint8_t>(*png));
    }
  }
  base::DictValue payload =
      base::DictValue()
          .Set("requestId", request_id)
          .Set("profile",
               ProfileNameForPath(profile->GetOriginalProfile()->GetPath()))
          .Set("id", extension->id())
          .Set("name", extension->name())
          .Set("version", extension->VersionString())
          .Set("type", PromptTypeName(prompt.type()))
          .Set("icon", icon)
          .Set("permissions", std::move(permissions));
  InstallPrompts()[request_id] = {std::move(*done_callback),
                                  profile->GetWeakPtr()};
  if (parent && HostShowsTab(parent)) {
    HostTabEvent(parent, "installPrompt", std::move(payload));
  } else {
    payload.Set("browserId", 0);
    HostEvent("installPrompt", std::move(payload));
  }
  return true;
}

bool ExtensionInstalled(Profile*,
                        scoped_refptr<const extensions::Extension>,
                        const SkBitmap*) {
  return true;
}

}

void InstallExtensionPrompts() {
  g_astro_extension_install_prompt = &AskHost;
  g_astro_extension_installed = &ExtensionInstalled;
}

void ResolveExtensionInstallPrompt(const std::string& request_id,
                                   bool accepted) {
  auto it = InstallPrompts().find(request_id);
  if (it == InstallPrompts().end()) {
    return;
  }
  PendingInstall pending = std::move(it->second);
  InstallPrompts().erase(it);
  if (!pending.profile) {
    return;
  }
  using Payload = extensions::ExtensionInstallPromptClient::DoneCallbackPayload;
  using Result = extensions::ExtensionInstallPromptClient::Result;
  std::move(pending.done)
      .Run(Payload(accepted ? Result::ACCEPTED : Result::USER_CANCELED));
}

}
