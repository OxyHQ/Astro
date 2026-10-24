// Copyright 2026 Oxy. Apache-2.0.

#include "chrome/browser/astro/ac_extensions.h"

#include <map>
#include <set>
#include <memory>
#include <string>
#include <utility>

#include "base/base64.h"
#include "base/files/file_path.h"
#include "base/files/file_util.h"
#include "base/functional/callback_helpers.h"
#include "base/functional/bind.h"
#include "base/memory/scoped_refptr.h"
#include "base/memory/weak_ptr.h"
#include "base/strings/utf_string_conversions.h"
#include "base/task/sequenced_task_runner.h"
#include "base/task/thread_pool.h"
#include "chrome/browser/astro/ac_scripts_policy.h"
#include "chrome/browser/extensions/api/developer_private/extension_info_generator.h"
#include "chrome/browser/extensions/extension_install_prompt.h"
#include "chrome/browser/extensions/extension_management.h"
#include "chrome/browser/extensions/extension_util.h"
#include "chrome/browser/ui/browser_window/public/browser_window_interface.h"
#include "chrome/browser/ui/browser_window/public/browser_window_interface_iterator.h"
#include "chrome/browser/ui/tabs/tab_strip_model.h"
#include "chrome/browser/ui/toolbar/toolbar_actions_model.h"
#include "chrome/common/extensions/api/developer_private.h"
#include "content/public/browser/web_contents.h"
#include "extensions/browser/install_prompt_data.h"
#include "extensions/browser/api/management/management_api.h"
#include "extensions/browser/api/management/management_api_delegate.h"
#include "extensions/browser/install/crx_install_error.h"
#include "extensions/browser/crx_installer.h"
#include "extensions/browser/extension_prefs.h"
#include "extensions/browser/extension_registrar.h"
#include "extensions/browser/extension_registry.h"
#include "extensions/browser/extension_system.h"
#include "extensions/browser/management_policy.h"
#include "extensions/browser/permissions_manager.h"
#include "extensions/browser/permissions/scripting_permissions_modifier.h"
#include "extensions/browser/requirements_checker.h"
#include "extensions/browser/uninstall_reason.h"
#include "extensions/browser/unpacked_installer.h"
#include "extensions/browser/disable_reason.h"
#include "extensions/common/api/extension_action/action_info.h"
#include "extensions/common/extension.h"
#include "extensions/common/file_util.h"
#include "extensions/common/manifest.h"
#include "extensions/common/manifest_handlers/icons_handler.h"
#include "extensions/common/manifest_handlers/options_page_info.h"
#include "extensions/common/manifest_handlers/permissions_parser.h"
#include "extensions/common/permissions/permission_set.h"

namespace astro {
namespace {

namespace developer = extensions::api::developer_private;
using extensions::Extension;
using extensions::ExtensionRegistry;

const Extension* Find(Profile* profile, const std::string& id) {
  return ExtensionRegistry::Get(profile)->GetExtensionById(
      id, ExtensionRegistry::EVERYTHING);
}

const extensions::ManagementAPIDelegate* ManagementDelegate(Profile* profile) {
  return extensions::ManagementAPI::GetFactoryInstance()
      ->Get(profile)
      ->GetDelegate();
}

base::DictValue Entry(const developer::ExtensionInfo& info) {
  base::ListValue permissions;
  for (const auto& permission : info.permissions.simple_permissions) {
    permissions.Append(permission.message);
  }
  base::ListValue sites;
  base::Value site_access;
  if (const auto& hosts = info.permissions.runtime_host_permissions) {
    site_access = base::Value(developer::ToString(hosts->host_access));
    for (const auto& host : hosts->hosts) {
      if (host.granted) {
        sites.Append(host.host);
      }
    }
  }
  base::ListValue errors;
  for (const auto& error : info.manifest_errors) {
    errors.Append(error.message);
  }
  for (const auto& error : info.runtime_errors) {
    errors.Append(error.message);
  }
  auto optional = [](const std::optional<std::string>& value) {
    return value ? base::Value(*value) : base::Value();
  };
  return base::DictValue()
      .Set("id", info.id)
      .Set("name", info.name)
      .Set("version", info.version)
      .Set("description", info.description)
      .Set("enabled", info.state == developer::ExtensionState::kEnabled)
      .Set("state", developer::ToString(info.state))
      .Set("icon", info.icon_url)
      .Set("permissions", std::move(permissions))
      .Set("siteAccess", std::move(site_access))
      .Set("sites", std::move(sites))
      .Set("optionsUrl", info.options_page ? base::Value(info.options_page->url)
                                           : base::Value())
      .Set("location", developer::ToString(info.location))
      .Set("path", optional(info.path))
      .Set("homepageUrl", info.home_page.url.empty()
                              ? base::Value()
                              : base::Value(info.home_page.url))
      .Set("incognito", info.incognito_access.is_active)
      .Set("fileAccess", info.file_access.is_active)
      .Set("pinned", info.pinned_to_toolbar.value_or(false))
      .Set("mayModify", info.user_may_modify)
      .Set("blockedByPolicy", info.disable_reasons.blocked_by_policy)
      .Set("errors", std::move(errors));
}

content::WebContents* PromptTab(Profile* profile) {
  content::WebContents* tab = nullptr;
  ForEachCurrentBrowserWindowInterfaceOrderedByActivation(
      [&](BrowserWindowInterface* window) {
        if (window->GetProfile() != profile || !window->GetTabStripModel()) {
          return true;
        }
        tab = window->GetTabStripModel()->GetActiveWebContents();
        return !tab;
      });
  return tab;
}

class ExtensionsState : public ProfileState {
 public:
  explicit ExtensionsState(Profile* profile) : ProfileState(profile) {}

  void List(Reply reply) {
    auto generator =
        std::make_unique<extensions::ExtensionInfoGenerator>(profile());
    extensions::ExtensionInfoGenerator* raw = generator.get();
    const int key = Keep(std::move(generator));
    raw->CreateExtensionsInfo(
        true, true,
        base::BindOnce(&ExtensionsState::Listed, weak_factory_.GetWeakPtr(),
                       key, std::move(reply)));
  }

  void Enable(const Extension* extension, Reply reply) {
    const std::string id = extension->id();
    if (extensions::ExtensionPrefs::Get(profile())->HasDisableReason(
            id, extensions::disable_reason::DISABLE_UNSUPPORTED_REQUIREMENT)) {
      auto checker = std::make_unique<extensions::RequirementsChecker>(
          base::WrapRefCounted(extension));
      extensions::RequirementsChecker* raw = checker.get();
      const int key = Keep(std::move(checker));
      raw->Start(base::BindOnce(&ExtensionsState::RequirementsChecked,
                                weak_factory_.GetWeakPtr(), key, id,
                                std::move(reply)));
      return;
    }
    CheckPermissionsIncrease(id, std::move(reply));
  }

 private:
  void Release() override {
    weak_factory_.InvalidateWeakPtrs();
    kept_.clear();
  }

  int Keep(std::unique_ptr<void, void (*)(void*)> owned) {
    kept_.emplace(++next_key_, std::move(owned));
    return next_key_;
  }
  template <typename T>
  int Keep(std::unique_ptr<T> owned) {
    return Keep(std::unique_ptr<void, void (*)(void*)>(
        owned.release(), [](void* p) { delete static_cast<T*>(p); }));
  }
  void Drop(int key) {
    auto it = kept_.find(key);
    if (it == kept_.end()) {
      return;
    }
    base::SequencedTaskRunner::GetCurrentDefault()->PostTask(
        FROM_HERE,
        base::BindOnce([](std::unique_ptr<void, void (*)(void*)>) {},
                       std::move(it->second)));
    kept_.erase(it);
  }

  void Listed(int key,
              Reply reply,
              extensions::ExtensionInfoGenerator::ExtensionInfoList infos) {
    Drop(key);
    base::ListValue list;
    for (const auto& info : infos) {
      if (info.type == developer::ExtensionType::kExtension) {
        base::DictValue entry = Entry(info);
        const Extension* extension = Find(profile(), info.id);
        if (extension && !info.disable_reasons.blocked_by_policy &&
            info.state != developer::ExtensionState::kEnabled &&
            extensions::ExtensionSystem::Get(profile())
                ->management_policy()
                ->MustRemainDisabled(extension, nullptr)) {
          entry.Set("blockedByPolicy", true);
        }
        list.Append(std::move(entry));
      }
    }
    reply.Send(base::DictValue().Set("extensions", std::move(list)));
  }

  void RequirementsChecked(int key,
                           std::string id,
                           Reply reply,
                           const extensions::PreloadCheck::Errors& errors) {
    if (!errors.empty()) {
      Drop(key);
      return reply.Error("The extension's requirements aren't met");
    }
    Drop(key);
    CheckPermissionsIncrease(id, std::move(reply));
  }

  void CheckPermissionsIncrease(const std::string& id, Reply reply) {
    const Extension* extension = Find(profile(), id);
    if (!extension) {
      return reply.Error("No such extension");
    }
    if (!extensions::ExtensionPrefs::Get(profile())
             ->DidExtensionEscalatePermissions(id)) {
      return Finish(id, std::move(reply), true);
    }
    content::WebContents* tab = PromptTab(profile());
    if (!tab) {
      return reply.Error("Open a window to re-enable this extension");
    }
    const int key = ++next_key_;
    std::unique_ptr<extensions::InstallPromptDelegate> prompt =
        ManagementDelegate(profile())->SetEnabledFunctionDelegate(
            tab, profile(), extension,
            base::BindOnce(&ExtensionsState::Prompted,
                           weak_factory_.GetWeakPtr(), key, id,
                           std::move(reply)));
    if (!answered_.erase(key)) {
      kept_.emplace(key, std::unique_ptr<void, void (*)(void*)>(
                             prompt.release(), [](void* p) {
                               delete static_cast<
                                   extensions::InstallPromptDelegate*>(p);
                             }));
    }
  }

  void Prompted(int key, std::string id, Reply reply, bool allowed) {
    if (kept_.count(key)) {
      Drop(key);
    } else {
      answered_.insert(key);
    }
    Finish(id, std::move(reply), allowed);
  }

  void Finish(const std::string& id, Reply reply, bool allowed) {
    if (!allowed) {
      return reply.Error("The user didn't re-enable the extension");
    }
    if (!Find(profile(), id)) {
      return reply.Error("No such extension");
    }
    ManagementDelegate(profile())->EnableExtension(profile(), id);
    reply.Ok();
  }

  std::map<int, std::unique_ptr<void, void (*)(void*)>> kept_;
  std::set<int> answered_;
  int next_key_ = 0;
  base::WeakPtrFactory<ExtensionsState> weak_factory_{this};
};

bool UserMayModify(Profile* profile, const Extension* extension) {
  return extensions::ExtensionSystem::Get(profile)
      ->management_policy()
      ->UserMayModifySettings(extension, nullptr);
}

void LiftPolicyBlockIfAllowed(Profile* profile, const std::string& id) {
  const Extension* extension = Find(profile, id);
  extensions::ExtensionPrefs* prefs = extensions::ExtensionPrefs::Get(profile);
  if (!extension ||
      !prefs->HasDisableReason(
          id, extensions::disable_reason::DISABLE_BLOCKED_BY_POLICY) ||
      extensions::ExtensionSystem::Get(profile)
          ->management_policy()
          ->MustRemainDisabled(extension, nullptr)) {
    return;
  }
  if (prefs->GetDisableReasons(id) ==
      extensions::DisableReasonSet(
          {extensions::disable_reason::DISABLE_BLOCKED_BY_POLICY})) {
    extensions::ExtensionRegistrar::Get(profile)->EnableExtension(id);
    return;
  }
  prefs->RemoveDisableReason(
      id, extensions::disable_reason::DISABLE_BLOCKED_BY_POLICY);
}

}
}

using astro::Call;
using astro::Reply;

#define AC_EXTENSIONS_CALL()                         \
  Call call(profile_dir, args_json, reply, context); \
  if (!call) {                                       \
    return;                                          \
  }

AC_ENGINE_CALL(ac_extensions_list) {
  AC_EXTENSIONS_CALL();
  astro::StateFor<astro::ExtensionsState>(call.profile())
      .List(call.TakeReply());
}

AC_ENGINE_CALL(ac_extensions_install) {
  AC_EXTENSIONS_CALL();
  const std::string path = call.String("path");
  if (!base::FilePath::FromUTF8Unsafe(path).IsAbsolute()) {
    return call.TakeReply().Error("an absolute path required");
  }
  Profile* profile = call.profile();
  if (extensions::ExtensionManagementFactory::GetForBrowserContext(profile)
          ->BlocklistedByDefault()) {
    return call.TakeReply().Error(
        "Extension installation is blocked by policy.");
  }
  base::FilePath load_path = base::FilePath::FromUTF8Unsafe(path);
  const bool scripts = astro::NamesScriptsFolder(load_path);
  base::ScopedClosureRunner scripts_install;
  if (scripts) {
    if (std::optional<std::string> problem =
            astro::ScriptsFolderInstallProblem(load_path)) {
      return call.TakeReply().Error(*problem);
    }
    load_path = astro::ScriptsFolder();
    scripts_install = astro::BeginScriptsInstall();
  }
  extensions::util::SetDeveloperModeForProfile(profile, true);
  scoped_refptr<extensions::UnpackedInstaller> installer =
      extensions::UnpackedInstaller::Create(profile);
  installer->set_be_noisy_on_failure(false);
  installer->set_completion_callback(base::BindOnce(
      [](base::WeakPtr<Profile> profile, bool scripts,
         base::ScopedClosureRunner scripts_install, Reply reply,
         const extensions::Extension* extension, const base::FilePath&,
         const std::u16string& error) {
        scripts_install.RunAndReset();
        if (!extension) {
          return reply.Error(error.empty()
                                 ? std::string("Could not load the extension")
                                 : base::UTF16ToUTF8(error));
        }
        const std::string id = extension->id();
        if (!profile) {
          return reply.Error("The profile closed");
        }
        if (scripts && extension->path() != astro::ScriptsFolder()) {
          std::u16string ignored;
          astro::ManagementDelegate(profile.get())
              ->UninstallExtension(profile.get(), id,
                                   extensions::UNINSTALL_REASON_INTERNAL_MANAGEMENT,
                                   &ignored);
          return reply.Error(
              "Astro Scripts: Scripts/extension changed while it was "
              "installing");
        }
        astro::LiftPolicyBlockIfAllowed(profile.get(), id);
        reply.Send(base::DictValue().Set("id", id));
      },
      profile->GetWeakPtr(), scripts, std::move(scripts_install),
      call.TakeReply()));
  installer->Load(load_path);
}

namespace astro {
namespace {

std::string PackagePath(const GURL& url) {
  return url.is_valid() && url.path().size() > 1
             ? std::string(url.path().substr(1))
             : std::string();
}

base::Value IconDataUrl(const Extension& extension) {
  const base::FilePath icon =
      extensions::IconsInfo::GetIconResource(&extension, 128,
                                             ExtensionIconSet::Match::kBigger)
          .GetFilePath();
  std::string bytes;
  if (icon.empty() || !base::ReadFileToString(icon, &bytes)) {
    return base::Value();
  }
  const bool svg = icon.MatchesExtension(FILE_PATH_LITERAL(".svg"));
  return base::Value(std::string(svg ? "data:image/svg+xml;base64,"
                                     : "data:image/png;base64,") +
                     base::Base64Encode(bytes));
}

base::DictValue InspectUnpacked(const base::FilePath& path) {
  std::u16string error;
  scoped_refptr<const Extension> extension = extensions::file_util::LoadExtension(
      path, extensions::mojom::ManifestLocation::kUnpacked,
      Extension::FOLLOW_SYMLINKS_ANYWHERE, &error);
  if (!extension) {
    return base::DictValue().Set(
        "error", error.empty() ? std::string("Could not read the extension")
                               : base::UTF16ToUTF8(error));
  }
  const extensions::PermissionSet& required =
      extensions::PermissionsParser::GetRequiredPermissions(extension.get());
  const extensions::PermissionSet& optional =
      extensions::PermissionsParser::GetOptionalPermissions(extension.get());
  base::ListValue permissions;
  for (const extensions::APIPermission* permission : required.apis()) {
    permissions.Append(permission->name());
  }
  for (const extensions::ManifestPermission* permission :
       required.manifest_permissions()) {
    permissions.Append(permission->name());
  }
  base::ListValue optional_permissions;
  for (const extensions::APIPermission* permission : optional.apis()) {
    optional_permissions.Append(permission->name());
  }
  base::ListValue hosts;
  std::set<std::string> seen;
  for (const extensions::URLPatternSet* set :
       {&required.explicit_hosts(), &required.scriptable_hosts()}) {
    for (std::string& pattern : set->ToStringVector()) {
      if (seen.insert(pattern).second) {
        hosts.Append(std::move(pattern));
      }
    }
  }
  const extensions::ActionInfo* action =
      extensions::ActionInfo::GetExtensionActionInfo(extension.get());
  const std::string popup = action ? PackagePath(action->default_popup_url)
                                   : std::string();
  const std::string options = PackagePath(
      extensions::OptionsPageInfo::GetOptionsPage(extension.get()));
  const std::string* description =
      extension->manifest()->FindStringPath("description");
  return base::DictValue()
      .Set("id", extension->id())
      .Set("name", extension->name())
      .Set("shortName", extension->short_name())
      .Set("version", extension->VersionString())
      .Set("description", description ? *description : std::string())
      .Set("manifestVersion", extension->manifest_version())
      .Set("icon", IconDataUrl(*extension))
      .Set("permissions", std::move(permissions))
      .Set("optionalPermissions", std::move(optional_permissions))
      .Set("hostPermissions", std::move(hosts))
      .Set("hasAction", action != nullptr)
      .Set("popup", popup.empty() ? base::Value() : base::Value(popup))
      .Set("optionsPage", options.empty() ? base::Value() : base::Value(options))
      .Set("sidePanel", base::Value())
      .Set("path", path.AsUTF8Unsafe());
}

}
}

AC_ENGINE_CALL(ac_extensions_inspect) {
  AC_EXTENSIONS_CALL();
  const base::FilePath path = base::FilePath::FromUTF8Unsafe(call.String("path"));
  if (!path.IsAbsolute()) {
    return call.TakeReply().Error("an absolute path required");
  }
  base::ThreadPool::PostTaskAndReplyWithResult(
      FROM_HERE, {base::MayBlock(), base::TaskPriority::USER_VISIBLE},
      base::BindOnce(&astro::InspectUnpacked, path),
      base::BindOnce([](Reply reply,
                        base::DictValue info) { reply.Send(std::move(info)); },
                     call.TakeReply()));
}

AC_ENGINE_CALL(ac_extensions_install_crx) {
  AC_EXTENSIONS_CALL();
  const std::string path = call.String("path");
  if (!base::FilePath::FromUTF8Unsafe(path).IsAbsolute()) {
    return call.TakeReply().Error("an absolute path required");
  }
  Profile* profile = call.profile();
  if (extensions::ExtensionManagementFactory::GetForBrowserContext(profile)
          ->BlocklistedByDefault()) {
    return call.TakeReply().Error(
        "Extension installation is blocked by policy.");
  }
  scoped_refptr<extensions::CrxInstaller> installer =
      extensions::CrxInstaller::Create(
          profile, std::make_unique<ExtensionInstallPrompt>(
                       profile, gfx::NativeWindow(),
                       std::make_unique<extensions::InstallPromptData>(
                           extensions::InstallPromptData::UNSET_PROMPT_TYPE)));
  installer->set_off_store_install_allow_reason(
      extensions::CrxInstaller::OffStoreInstallAllowedFromSettingsPage);
  installer->AddInstallerCallback(base::BindOnce(
      [](Reply reply, scoped_refptr<extensions::CrxInstaller> installer,
         const std::optional<extensions::CrxInstallError>& error) {
        if (error) {
          return reply.Error(base::UTF16ToUTF8(error->message()));
        }
        reply.Send(base::DictValue().Set(
            "id", installer->extension() ? installer->extension()->id()
                                         : installer->expected_id()));
      },
      call.TakeReply(), installer));
  installer->InstallCrx(base::FilePath::FromUTF8Unsafe(path));
}

AC_ENGINE_CALL(ac_extensions_set_enabled) {
  AC_EXTENSIONS_CALL();
  Profile* profile = call.profile();
  const std::string id = call.String("id");
  const bool enable = call.Bool("enabled");
  const extensions::Extension* extension = astro::Find(profile, id);
  if (!extension) {
    return call.TakeReply().Error("No such extension");
  }
  if (!astro::UserMayModify(profile, extension)) {
    return call.TakeReply().Error("The extension can't be changed");
  }
  extensions::ExtensionRegistry* registry =
      extensions::ExtensionRegistry::Get(profile);
  const bool enabled = registry->enabled_extensions().Contains(id) ||
                       registry->terminated_extensions().Contains(id);
  if (enable == enabled) {
    return call.TakeReply().Ok();
  }
  if (!enable) {
    astro::ManagementDelegate(profile)->DisableExtension(
        profile, nullptr, id,
        extensions::disable_reason::DISABLE_USER_ACTION);
    return call.TakeReply().Ok();
  }
  if (extensions::ExtensionSystem::Get(profile)
          ->management_policy()
          ->MustRemainDisabled(extension, nullptr)) {
    return call.TakeReply().Error("The extension can't be changed");
  }
  astro::StateFor<astro::ExtensionsState>(profile).Enable(
      extension, call.TakeReply());
}

AC_ENGINE_CALL(ac_extensions_uninstall) {
  AC_EXTENSIONS_CALL();
  Profile* profile = call.profile();
  const std::string id = call.String("id");
  const extensions::Extension* extension = astro::Find(profile, id);
  if (!extension) {
    return call.TakeReply().Error("No such extension");
  }
  if (!astro::UserMayModify(profile, extension) ||
      extensions::ExtensionSystem::Get(profile)
          ->management_policy()
          ->MustRemainInstalled(extension, nullptr)) {
    return call.TakeReply().Error("The extension can't be removed");
  }
  std::u16string error;
  if (!astro::ManagementDelegate(profile)->UninstallExtension(
          profile, id, extensions::UNINSTALL_REASON_MANAGEMENT_API, &error)) {
    return call.TakeReply().Error(error.empty() ? std::string("Not removed")
                                                : base::UTF16ToUTF8(error));
  }
  call.TakeReply().Ok();
}

AC_ENGINE_CALL(ac_extensions_reload) {
  AC_EXTENSIONS_CALL();
  const std::string id = call.String("id");
  if (!astro::Find(call.profile(), id)) {
    return call.TakeReply().Error("No such extension");
  }
  extensions::ExtensionRegistrar::Get(call.profile())
      ->ReloadExtensionWithQuietFailure(id);
  call.TakeReply().Ok();
}

AC_ENGINE_CALL(ac_extensions_configure) {
  AC_EXTENSIONS_CALL();
  Profile* profile = call.profile();
  const std::string id = call.String("id");
  if (!astro::Find(profile, id)) {
    return call.TakeReply().Error("No such extension");
  }
  if (std::optional<bool> pinned = call.args().FindBool("pinned")) {
    ToolbarActionsModel* model = ToolbarActionsModel::Get(profile);
    if (!model->HasAction(id)) {
      return call.TakeReply().Error(
          "Cannot pin an extension without an action");
    }
    if (model->IsActionPinned(id) != *pinned) {
      model->SetActionVisibility(id, *pinned);
    }
  }
  if (std::optional<bool> allow = call.args().FindBool("fileAccess")) {
    extensions::util::SetAllowFileAccess(id, profile, *allow);
  }
  if (std::optional<bool> allow = call.args().FindBool("incognito")) {
    extensions::util::SetIsIncognitoEnabled(id, profile, *allow);
  }
  if (const std::string* access = call.args().FindString("siteAccess")) {
    const extensions::Extension* extension = astro::Find(profile, id);
    extensions::PermissionsManager* manager =
        extensions::PermissionsManager::Get(profile);
    if (!extension || !manager->CanAffectExtension(*extension)) {
      return call.TakeReply().Error("Can't change this extension's site access");
    }
    extensions::ScriptingPermissionsModifier modifier(profile, extension);
    if (*access == "onClick") {
      modifier.SetWithholdHostPermissions(true);
      modifier.RemoveAllGrantedHostPermissions();
    } else if (*access == "specificSites") {
      if (manager->HasBroadGrantedHostPermissions(*extension)) {
        modifier.RemoveBroadGrantedHostPermissions();
      }
      modifier.SetWithholdHostPermissions(true);
    } else if (*access == "allSites") {
      modifier.SetWithholdHostPermissions(false);
    } else {
      return call.TakeReply().Error("unknown site access");
    }
  }
  call.TakeReply().Ok();
}
