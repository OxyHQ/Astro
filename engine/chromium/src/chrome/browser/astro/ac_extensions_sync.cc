// Copyright 2026 Oxy. Apache-2.0.

#include "chrome/browser/astro/ac_extensions_sync.h"

#include <algorithm>
#include <map>
#include <memory>
#include <optional>
#include <set>
#include <string>
#include <utility>
#include <vector>

#include "base/functional/bind.h"
#include "base/strings/string_number_conversions.h"
#include "base/strings/string_util.h"
#include "base/strings/utf_string_conversions.h"
#include "base/memory/weak_ptr.h"
#include "base/scoped_observation.h"
#include "base/task/sequenced_task_runner.h"
#include "base/values.h"
#include "base/version.h"
#include "chrome/browser/extensions/extension_management.h"
#include "chrome/browser/extensions/extension_service.h"
#include "chrome/browser/extensions/extension_util.h"
#include "chrome/browser/extensions/sync/extension_sync_util.h"
#include "chrome/browser/profiles/profile.h"
#include "chrome/browser/ui/toolbar/toolbar_actions_model.h"
#include "components/crx_file/id_util.h"
#include "content/public/browser/browser_context.h"
#include "extensions/browser/api/management/management_api.h"
#include "extensions/browser/api/management/management_api_delegate.h"
#include "extensions/browser/disable_reason.h"
#include "extensions/browser/extension_prefs.h"
#include "extensions/browser/extension_registrar.h"
#include "extensions/browser/extension_registry.h"
#include "extensions/browser/extension_registry_observer.h"
#include "extensions/browser/extension_system.h"
#include "extensions/browser/extension_util.h"
#include "extensions/browser/crx_installer.h"
#include "extensions/browser/delayed_install_manager.h"
#include "extensions/browser/install/crx_install_error.h"
#include "extensions/browser/pref_names.h"
#include "components/prefs/pref_service.h"
#include "extensions/browser/management_policy.h"
#include "extensions/browser/pending_extension_info.h"
#include "extensions/browser/pending_extension_manager.h"
#include "extensions/browser/permissions/permissions_updater.h"
#include "extensions/browser/uninstall_reason.h"
#include "extensions/common/extension.h"
#include "extensions/common/extension_urls.h"
#include "extensions/common/manifest_handlers/permissions_parser.h"
#include "extensions/common/permissions/api_permission_set.h"
#include "extensions/common/permissions/permission_message_provider.h"
#include "extensions/common/permissions/permission_set.h"
#include "extensions/common/permissions/permissions_data.h"

extern void (*g_astro_sync_installer_created)(
    content::BrowserContext* context,
    const std::string& extension_id,
    extensions::CrxInstaller* installer);
extern void (*g_astro_crx_installing)(content::BrowserContext* context,
                                      extensions::CrxInstaller* installer,
                                      const extensions::Extension* extension);

namespace astro {
namespace {

using extensions::Extension;
using extensions::ExtensionPrefs;
using extensions::ExtensionRegistry;
namespace reason = extensions::disable_reason;

bool Syncable(content::BrowserContext* context, const Extension* extension) {
  return extension && extension->is_extension() && !extension->is_theme() &&
         extension->from_webstore() &&
         extensions::sync_util::ShouldSync(context, extension);
}

bool AllowSyncInstall(const Extension* extension,
                      content::BrowserContext* context) {
  return Syncable(context, extension);
}

bool PendingFromSync(Profile* profile, const std::string& id) {
  const extensions::PendingExtensionInfo* info =
      extensions::PendingExtensionManager::Get(profile)->GetById(id);
  return info && info->is_from_sync();
}

const Extension* Installed(Profile* profile, const std::string& id) {
  return ExtensionRegistry::Get(profile)->GetExtensionById(
      id, ExtensionRegistry::EVERYTHING);
}

const extensions::ManagementAPIDelegate* Management(Profile* profile) {
  return extensions::ManagementAPI::GetFactoryInstance()
      ->Get(profile)
      ->GetDelegate();
}

extensions::ManagementPolicy* Policy(Profile* profile) {
  return extensions::ExtensionSystem::Get(profile)->management_policy();
}

const extensions::PermissionSet& Required(const Extension* extension) {
  return extensions::PermissionsParser::GetRequiredPermissions(extension);
}

bool Approved(Profile* profile, const Extension* extension) {
  ExtensionPrefs* prefs = ExtensionPrefs::Get(profile);
  if (prefs->HasDisableReason(extension->id(),
                              reason::DISABLE_PERMISSIONS_INCREASE)) {
    return false;
  }
  std::unique_ptr<const extensions::PermissionSet> granted =
      prefs->GetGrantedPermissions(extension->id());
  std::unique_ptr<const extensions::PermissionSet> runtime =
      prefs->GetRuntimeGrantedPermissions(extension->id());
  if (!granted) {
    granted = std::make_unique<extensions::PermissionSet>();
  }
  if (!runtime) {
    runtime = std::make_unique<extensions::PermissionSet>();
  }
  std::unique_ptr<const extensions::PermissionSet> total =
      extensions::PermissionSet::CreateUnion(*granted, *runtime);
  return !extensions::PermissionMessageProvider::Get()->IsPrivilegeIncrease(
      *total, Required(extension), extension->GetType());
}

std::string PermissionFingerprint(const Extension* extension) {
  std::vector<std::string> parts;
  for (const extensions::PermissionID& permission :
       extensions::PermissionMessageProvider::Get()->GetAllPermissionIDs(
           Required(extension), extension->GetType())) {
    parts.push_back(
        base::NumberToString(static_cast<int>(permission.id())) + ":" +
        base::UTF16ToUTF8(permission.parameter()));
  }
  std::sort(parts.begin(), parts.end());
  return base::JoinString(parts, "\n");
}

struct Approval {
  base::Version version;
  std::vector<std::string> fingerprints;

  bool Matches(const Extension* extension) const {
    return version.IsValid() && extension->version() == version &&
           std::ranges::find(fingerprints, PermissionFingerprint(extension)) !=
               fingerprints.end();
  }
};

bool Pinned(Profile* profile, const std::string& id) {
  const extensions::ExtensionIdList pinned =
      ExtensionPrefs::Get(profile)->GetPinnedExtensions();
  return std::ranges::find(pinned, id) != pinned.end();
}

bool ForcePinned(Profile* profile, const std::string& id) {
  ToolbarActionsModel* model = ToolbarActionsModel::Get(profile);
  return model && model->IsActionForcePinned(id);
}

void SetPinned(Profile* profile, const std::string& id, bool pin) {
  if (ForcePinned(profile, id) || Pinned(profile, id) == pin) {
    return;
  }
  ExtensionPrefs* prefs = ExtensionPrefs::Get(profile);
  extensions::ExtensionIdList pinned = prefs->GetPinnedExtensions();
  if (pin) {
    pinned.push_back(id);
  } else {
    std::erase(pinned, id);
  }
  prefs->SetPinnedExtensions(pinned);
}

void CheckForUpdatesSoon(Profile* profile) {
  if (extensions::ExtensionService* service =
          extensions::ExtensionSystem::Get(profile)->extension_service()) {
    service->CheckForUpdatesSoon();
  }
}

constexpr char kSyncDelayed[] = "astro_sync_delayed";
constexpr char kSyncDesired[] = "astro_sync_desired";
constexpr char kSyncApproval[] = "astro_sync_approval";

Approval ApprovalFrom(const base::DictValue* dict) {
  Approval approval;
  if (!dict) {
    return approval;
  }
  const std::string* version = dict->FindString("v");
  const base::ListValue* fingerprints = dict->FindList("fps");
  if (!version || !fingerprints) {
    return approval;
  }
  approval.version = base::Version(*version);
  for (const base::Value& fingerprint : *fingerprints) {
    if (fingerprint.is_string()) {
      approval.fingerprints.push_back(fingerprint.GetString());
    }
  }
  return approval;
}

bool UserIntent(extensions::UninstallReason why) {
  return why == extensions::UNINSTALL_REASON_USER_INITIATED ||
         why == extensions::UNINSTALL_REASON_MANAGEMENT_API ||
         why == extensions::UNINSTALL_REASON_CHROME_WEBSTORE;
}

void SyncInstallerCreated(content::BrowserContext* context,
                          const std::string& id,
                          extensions::CrxInstaller* installer);
void CrxInstalling(content::BrowserContext* context,
                   extensions::CrxInstaller* installer,
                   const extensions::Extension* extension);

class ExtensionSync : public ProfileState,
                      public extensions::ExtensionRegistryObserver {
 public:
  explicit ExtensionSync(Profile* profile) : ProfileState(profile) {
    if (!g_astro_sync_installer_created) {
      g_astro_sync_installer_created = &SyncInstallerCreated;
    }
    if (!g_astro_crx_installing) {
      g_astro_crx_installing = &CrxInstalling;
    }
    observation_.Observe(ExtensionRegistry::Get(profile));
    for (const auto& extension :
         ExtensionRegistry::Get(profile)->GenerateInstalledExtensionsSet()) {
      if (Prefs()->ReadPrefAsDict(extension->id(), kSyncDesired)) {
        SettleSoon(extension->id());
      }
    }
  }

  ~ExtensionSync() override { Release(); }

  base::DictValue State() {
    Profile* p = profile();
    extensions::ExtensionRegistrar* registrar =
        extensions::ExtensionRegistrar::Get(p);
    base::ListValue list;
    for (const auto& extension :
         ExtensionRegistry::Get(p)->GenerateInstalledExtensionsSet()) {
      const std::string& id = extension->id();
      const bool syncable = Syncable(p, extension.get());
      base::DictValue entry;
      entry.Set("id", id);
      entry.Set("syncable", syncable);
      if (syncable) {
        entry.Set("version", extension->version().GetString());
        entry.Set("approved", Approved(p, extension.get()));
        entry.Set("fingerprint", PermissionFingerprint(extension.get()));
        entry.Set("enabled", registrar->IsExtensionEnabled(id));
        entry.Set("userDisabled",
                  Prefs()->HasDisableReason(id, reason::DISABLE_USER_ACTION));
        entry.Set("incognito", extensions::util::IsIncognitoEnabled(id, p));
        entry.Set("pinned", Pinned(p, id));
      }
      list.Append(std::move(entry));
    }
    base::ListValue pending;
    for (const std::string& id :
         extensions::PendingExtensionManager::Get(p)
             ->GetPendingIdsForUpdateCheck()) {
      if (PendingFromSync(p, id)) {
        pending.Append(id);
      }
    }
    base::ListValue settling;
    for (const std::string& id : settling_) {
      settling.Append(id);
    }
    base::ListValue queued;
    if (const base::DictValue* all =
            &p->GetPrefs()->GetDict(extensions::pref_names::kExtensions)) {
      for (const auto [id, entry] : *all) {
        if (entry.is_dict() && entry.GetDict().FindDict(kSyncDesired) &&
            !Installed(p, id)) {
          queued.Append(id);
        }
      }
    }
    base::ListValue intents;
    for (auto& [id, kind] : intents_) {
      intents.Append(base::DictValue().Set("id", id).Set("kind", kind));
    }
    intents_.clear();
    return base::DictValue()
        .Set("ready", extensions::ExtensionSystem::Get(p)->is_ready())
        .Set("extensions", std::move(list))
        .Set("pending", std::move(pending))
        .Set("settling", std::move(settling))
        .Set("queued", std::move(queued))
        .Set("intents", std::move(intents));
  }

  base::DictValue Apply(const std::string& id, const base::DictValue& args) {
    const base::DictValue* record = args.FindDict("record");
    if (!record) {
      return base::DictValue().Set("state", "invalid");
    }
    if (record->FindBool("removed").value_or(false)) {
      return Cancel(id);
    }
    const base::DictValue* approval = args.FindDict("approval");
    if (const Extension* extension = Installed(profile(), id)) {
      return Reconcile(extension, *record, approval);
    }
    return Install(id, *record, approval);
  }

 private:
  ExtensionPrefs* Prefs() { return ExtensionPrefs::Get(profile()); }

 public:
  void TrackSyncInstaller(extensions::CrxInstaller* installer) {
    sync_installers_[installer] = base::WrapRefCounted(installer);
    installer->AddInstallerCallback(
        base::BindOnce(&ExtensionSync::SyncInstallerDone,
                       weak_factory_.GetWeakPtr(),
                       reinterpret_cast<uintptr_t>(installer)));
  }

  void Installing(extensions::CrxInstaller* installer,
                  const Extension* extension) {
    if (!extension) {
      return;
    }
    if (sync_installers_.contains(installer)) {
      completing_[installer] = base::WrapRefCounted(extension);
      return;
    }
    scoped_refptr<const Extension> manual = base::WrapRefCounted(extension);
    manual_.push_back(manual);
    base::SequencedTaskRunner::GetCurrentDefault()->PostTask(
        FROM_HERE, base::BindOnce(&ExtensionSync::ManualSettled,
                                  weak_factory_.GetWeakPtr(), manual));
  }

 private:
  void SyncInstallerDone(
      uintptr_t key,
      const std::optional<extensions::CrxInstallError>& error) {
    auto* identity = reinterpret_cast<extensions::CrxInstaller*>(key);
    auto found = sync_installers_.find(identity);
    if (found == sync_installers_.end()) {
      return;
    }
    scoped_refptr<extensions::CrxInstaller> installer = found->second;
    sync_installers_.erase(found);
    scoped_refptr<const Extension> own;
    if (auto completing = completing_.find(identity);
        completing != completing_.end()) {
      own = completing->second;
      completing_.erase(completing);
    }
    if (error || !own || Installed(profile(), own->id())) {
      return;
    }
    if (extensions::DelayedInstallManager::Get(profile())
            ->GetPendingExtensionUpdate(own->id()) == own.get()) {
      Prefs()->UpdateExtensionPref(own->id(), kSyncDelayed, base::Value(true));
    }
  }

  void ManualSettled(scoped_refptr<const Extension> manual) {
    std::erase(manual_, manual);
    bool delayed = false;
    if (extensions::DelayedInstallManager::Get(profile())
                ->GetPendingExtensionUpdate(manual->id()) == manual.get() &&
        Prefs()->ReadPrefAsBoolean(manual->id(), kSyncDelayed, &delayed)) {
      Prefs()->UpdateExtensionPref(manual->id(), kSyncDelayed, std::nullopt);
    }
  }

  bool FromSyncInstaller(const Extension* extension) {
    for (const auto& manual : manual_) {
      if (manual.get() == extension) {
        return false;
      }
    }
    for (const auto& [installer, installing] : completing_) {
      if (installing.get() == extension) {
        return true;
      }
    }
    bool delayed = false;
    return Prefs()->ReadPrefAsBoolean(extension->id(), kSyncDelayed,
                                      &delayed) &&
           delayed;
  }

  void Release() override {
    observation_.Reset();
    completing_.clear();
    manual_.clear();
    sync_installers_.clear();
    weak_factory_.InvalidateWeakPtrs();
  }

  void OnShutdown(ExtensionRegistry* registry) override {
    observation_.Reset();
  }

  void OnExtensionInstalled(content::BrowserContext* context,
                            const Extension* extension,
                            bool is_update) override {
    const std::string id = extension->id();
    const bool from_sync = FromSyncInstaller(extension);
    bool delayed = false;
    if (Prefs()->ReadPrefAsBoolean(id, kSyncDelayed, &delayed)) {
      Prefs()->UpdateExtensionPref(id, kSyncDelayed, std::nullopt);
    }
    const bool desired = Prefs()->ReadPrefAsDict(id, kSyncDesired) != nullptr;
    if (from_sync) {
      if (desired) {
        SettleSoon(id);
      }
      return;
    }
    if (desired) {
      Prefs()->UpdateExtensionPref(id, kSyncDesired, std::nullopt);
    }
    if (is_update && Prefs()->ReadPrefAsDict(id, kSyncApproval)) {
      SettleSoon(id);
    }
    if (!is_update && Syncable(profile(), extension)) {
      Intent(id, "installed");
    }
  }

  void OnExtensionUninstalled(content::BrowserContext* context,
                              const Extension* extension,
                              extensions::UninstallReason why) override {
    if (UserIntent(why) && Syncable(profile(), extension)) {
      Intent(extension->id(), "uninstalled");
    }
  }

  void Intent(const std::string& id, const std::string& kind) {
    intents_[id] = kind;
    Emit("extensions.sync", profile(),
         base::DictValue().Set("id", id).Set("kind", kind));
  }

  void SettleSoon(const std::string& id) {
    settling_.insert(id);
    base::SequencedTaskRunner::GetCurrentDefault()->PostTask(
        FROM_HERE, base::BindOnce(&ExtensionSync::Settle,
                                  weak_factory_.GetWeakPtr(), id));
  }

  void Settle(const std::string& id) {
    settling_.erase(id);
    std::optional<base::DictValue> desired;
    if (const base::DictValue* stored =
            Prefs()->ReadPrefAsDict(id, kSyncDesired)) {
      desired = stored->Clone();
    }
    const Approval stored_approval =
        ApprovalFrom(Prefs()->ReadPrefAsDict(id, kSyncApproval));
    const Approval approval =
        desired ? ApprovalFrom(desired->FindDict("approval")) : stored_approval;
    const Extension* extension = Installed(profile(), id);
    if (!extension || !Syncable(profile(), extension)) {
      return;
    }
    Prefs()->UpdateExtensionPref(id, kSyncDesired, std::nullopt);
    if (approval.Matches(extension)) {
      GrantApproved(extension);
    }
    extension = Installed(profile(), id);
    if (extension && stored_approval.version.IsValid() &&
        extension->version().CompareTo(stored_approval.version) >= 0) {
      Prefs()->UpdateExtensionPref(id, kSyncApproval, std::nullopt);
    }
    if (!extension) {
      return;
    }
    const base::DictValue* record =
        desired ? desired->FindDict("record") : nullptr;
    if (std::optional<bool> pin =
            record ? record->FindBool("pin") : std::nullopt) {
      SetPinned(profile(), id, *pin);
    }
  }

  void GrantApproved(const Extension* extension) {
    const std::string id = extension->id();
    ExtensionPrefs* prefs = Prefs();
    if (!prefs->HasDisableReason(id, reason::DISABLE_PERMISSIONS_INCREASE)) {
      return;
    }
    extensions::PermissionsUpdater(profile()).GrantActivePermissions(extension);
    prefs->RemoveDisableReason(id, reason::DISABLE_PERMISSIONS_INCREASE);
    if (prefs->GetDisableReasons(id).empty() &&
        !Policy(profile())->MustRemainDisabled(extension, nullptr)) {
      extensions::ExtensionRegistrar::Get(profile())->EnableExtension(id);
    }
  }

  base::DictValue Cancel(const std::string& id) {
    if (Installed(profile(), id)) {
      return base::DictValue().Set("state", "kept");
    }
    if (Prefs()->ReadPrefAsDict(id, kSyncDesired)) {
      Prefs()->UpdateExtensionPref(id, kSyncDesired, std::nullopt);
    }
    if (!PendingFromSync(profile(), id)) {
      return base::DictValue().Set("state", "absent");
    }
    extensions::PendingExtensionManager::Get(profile())->Remove(id);
    return base::DictValue().Set("state", "cancelled");
  }

  void PresetPrefs(const std::string& id, const base::DictValue& record) {
    Profile* p = profile();
    if (!record.FindBool("on").value_or(true)) {
      Prefs()->AddDisableReason(id, reason::DISABLE_USER_ACTION);
    } else {
      Prefs()->RemoveDisableReason(id, reason::DISABLE_USER_ACTION);
    }
    extensions::util::SetIsIncognitoEnabled(
        id, p, record.FindBool("inc").value_or(false));
    SetPinned(p, id, record.FindBool("pin").value_or(false));
  }

  base::DictValue Install(const std::string& id,
                          const base::DictValue& record,
                          const base::DictValue* approval) {
    Profile* p = profile();
    if (extensions::ExtensionManagementFactory::GetForBrowserContext(p)
            ->BlocklistedByDefault()) {
      return base::DictValue().Set("state", "blocked");
    }
    extensions::PendingExtensionManager* pending =
        extensions::PendingExtensionManager::Get(p);
    if (pending->IsIdPending(id) && !PendingFromSync(p, id)) {
      return base::DictValue().Set("state", "pending");
    }
    PresetPrefs(id, record);
    base::DictValue desired;
    desired.Set("record", record.Clone());
    if (approval) {
      desired.Set("approval", approval->Clone());
    }
    Prefs()->UpdateExtensionPref(id, kSyncDesired,
                                 base::Value(std::move(desired)));
    if (PendingFromSync(p, id)) {
      return base::DictValue().Set("state", "pending");
    }
    if (!pending->AddFromSync(id, extension_urls::GetWebstoreUpdateUrl(),
                              base::Version(), &AllowSyncInstall, false)) {
      Prefs()->UpdateExtensionPref(id, kSyncDesired, std::nullopt);
      return base::DictValue().Set("state", "refused");
    }
    CheckForUpdatesSoon(p);
    return base::DictValue().Set("state", "pending");
  }

  base::DictValue Reconcile(const Extension* extension,
                            const base::DictValue& record,
                            const base::DictValue* approval_dict) {
    Profile* p = profile();
    const std::string id = extension->id();
    if (!Syncable(p, extension) ||
        !Policy(p)->UserMayModifySettings(extension, nullptr)) {
      return base::DictValue().Set("state", "kept");
    }
    const Approval approval = ApprovalFrom(approval_dict);
    ExtensionPrefs* prefs = Prefs();
    if (prefs->ReadPrefAsDict(id, kSyncDesired)) {
      prefs->UpdateExtensionPref(id, kSyncDesired, std::nullopt);
    }
    extensions::ExtensionRegistrar* registrar =
        extensions::ExtensionRegistrar::Get(p);
    if (std::optional<bool> on = record.FindBool("on")) {
      if (!*on && !prefs->HasDisableReason(id, reason::DISABLE_USER_ACTION)) {
        if (registrar->IsExtensionEnabled(id)) {
          Management(p)->DisableExtension(p, nullptr, id,
                                          reason::DISABLE_USER_ACTION);
        } else {
          prefs->AddDisableReason(id, reason::DISABLE_USER_ACTION);
        }
      } else if (*on &&
                 prefs->HasDisableReason(id, reason::DISABLE_USER_ACTION)) {
        prefs->RemoveDisableReason(id, reason::DISABLE_USER_ACTION);
        const Extension* current = Installed(p, id);
        if (current && !registrar->IsExtensionEnabled(id) &&
            prefs->GetDisableReasons(id).empty() &&
            !Policy(p)->MustRemainDisabled(current, nullptr)) {
          registrar->EnableExtension(id);
        }
      }
    }
    extension = Installed(p, id);
    if (!extension) {
      return base::DictValue().Set("state", "absent");
    }
    if (std::optional<bool> incognito = record.FindBool("inc");
        incognito && extensions::util::CanBeIncognitoEnabled(extension) &&
        extensions::util::IsIncognitoEnabled(id, p) != *incognito) {
      extensions::util::SetIsIncognitoEnabled(id, p, *incognito);
    }
    if (std::optional<bool> pin = record.FindBool("pin")) {
      SetPinned(p, id, *pin);
    }
    extension = Installed(p, id);
    if (extension && approval.Matches(extension)) {
      GrantApproved(extension);
    }
    extension = Installed(p, id);
    if (extension && approval_dict && approval.version.IsValid() &&
        extension->version().CompareTo(approval.version) < 0) {
      prefs->UpdateExtensionPref(id, kSyncApproval,
                                 base::Value(approval_dict->Clone()));
      CheckForUpdatesSoon(p);
      return base::DictValue().Set("state", "updating");
    }
    return base::DictValue().Set("state", "installed");
  }

  std::set<std::string> settling_;
  std::map<std::string, std::string> intents_;
  base::ScopedObservation<ExtensionRegistry,
                          extensions::ExtensionRegistryObserver>
      observation_{this};
  std::map<extensions::CrxInstaller*, scoped_refptr<extensions::CrxInstaller>>
      sync_installers_;
  std::map<extensions::CrxInstaller*, scoped_refptr<const Extension>>
      completing_;
  std::vector<scoped_refptr<const Extension>> manual_;
  base::WeakPtrFactory<ExtensionSync> weak_factory_{this};
};

void SyncInstallerCreated(content::BrowserContext* context,
                          const std::string& id,
                          extensions::CrxInstaller* installer) {
  Profile* profile = Profile::FromBrowserContext(context);
  if (profile && !profile->IsOffTheRecord()) {
    StateFor<ExtensionSync>(profile).TrackSyncInstaller(installer);
  }
}

void CrxInstalling(content::BrowserContext* context,
                   extensions::CrxInstaller* installer,
                   const extensions::Extension* extension) {
  Profile* profile = Profile::FromBrowserContext(context);
  if (profile && !profile->IsOffTheRecord()) {
    StateFor<ExtensionSync>(profile).Installing(installer, extension);
  }
}

}
}

using astro::Call;

AC_ENGINE_CALL(ac_extensions_sync_state) {
  Call call(profile_dir, args_json, reply, context);
  if (!call) {
    return;
  }
  call.TakeReply().Send(
      astro::StateFor<astro::ExtensionSync>(call.profile()).State());
}

AC_ENGINE_CALL(ac_extensions_sync_apply) {
  Call call(profile_dir, args_json, reply, context);
  if (!call) {
    return;
  }
  const std::string id = call.String("id");
  if (!crx_file::id_util::IdIsValid(id)) {
    return call.TakeReply().Error("not an extension id");
  }
  call.TakeReply().Send(astro::StateFor<astro::ExtensionSync>(call.profile())
                            .Apply(id, call.args()));
}
