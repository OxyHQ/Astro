// Copyright 2026 Oxy. Apache-2.0.

#include <map>
#include <memory>
#include <optional>
#include <set>
#include <string>
#include <variant>
#include <vector>

#include "base/functional/bind.h"
#include "base/memory/raw_ptr.h"
#include "base/memory/weak_ptr.h"
#include "base/no_destructor.h"
#include "base/task/single_thread_task_runner.h"
#include "chrome/browser/astro/ac_host.h"
#include "chrome/browser/permissions/system/system_permission_settings.h"
#include "components/permissions/embedded_permission_prompt_flow_model.h"
#include "components/permissions/permission_prompt.h"
#include "components/permissions/permission_request.h"
#include "components/permissions/permission_util.h"
#include "components/permissions/request_type.h"
#include "content/public/browser/web_contents.h"

extern std::unique_ptr<permissions::PermissionPrompt> (
    *g_astro_create_permission_prompt)(
    content::WebContents* web_contents,
    permissions::PermissionPrompt::Delegate* delegate,
    bool* default_handling);

namespace astro {
namespace {

const char* KindName(permissions::RequestType type) {
  using permissions::RequestType;
  switch (type) {
    case RequestType::kCameraStream:
      return "camera";
    case RequestType::kMicStream:
      return "microphone";
    case RequestType::kCameraPanTiltZoom:
      return "cameraPanTiltZoom";
    case RequestType::kGeolocation:
      return "location";
    case RequestType::kNotifications:
      return "notifications";
    case RequestType::kClipboard:
      return "clipboard";
    case RequestType::kMidiSysex:
      return "midi";
    case RequestType::kMultipleDownloads:
      return "multipleDownloads";
    case RequestType::kLocalFonts:
      return "localFonts";
    case RequestType::kIdleDetection:
      return "idleDetection";
    case RequestType::kStorageAccess:
    case RequestType::kTopLevelStorageAccess:
      return "storageAccess";
    case RequestType::kWindowManagement:
      return "windowManagement";
    case RequestType::kFileSystemAccess:
      return "fileSystem";
    case RequestType::kKeyboardLock:
      return "keyboardLock";
    case RequestType::kPointerLock:
      return "pointerLock";
    case RequestType::kRegisterProtocolHandler:
      return "protocolHandler";
    case RequestType::kSensors:
      return "sensors";
    case RequestType::kLocalNetwork:
    case RequestType::kLoopbackNetwork:
      return "localNetwork";
    case RequestType::kVrSession:
      return "vr";
    case RequestType::kArSession:
      return "ar";
    case RequestType::kHandTracking:
      return "handTracking";
    case RequestType::kIdentityProvider:
      return "identityProvider";
    case RequestType::kWebAppInstallation:
      return "webAppInstallation";
    case RequestType::kCapturedSurfaceControl:
      return "capturedSurfaceControl";
    case RequestType::kDiskQuota:
      return "diskQuota";
    default:
      return nullptr;
  }
}

class PermissionPrompt;

std::map<std::string, base::WeakPtr<PermissionPrompt>>& Prompts() {
  static base::NoDestructor<std::map<std::string, base::WeakPtr<PermissionPrompt>>>
      prompts;
  return *prompts;
}

using Variant = permissions::EmbeddedPermissionPromptFlowModel::Variant;

enum class Step { kAsk, kAlreadyAllowed, kSystemPrompt, kAcknowledge };

Step StepOf(permissions::PermissionPrompt::Delegate* delegate) {
  permissions::EmbeddedPermissionPromptFlowModel* flow =
      delegate->GetEmbeddedPromptFlowModel();
  if (!flow) {
    return Step::kAsk;
  }
  const bool later_step = delegate->WasCurrentRequestAlreadyDisplayed();
  switch (flow->prompt_variant()) {
    case Variant::kOsPrompt:
      return Step::kSystemPrompt;
    case Variant::kAsk:
    case Variant::kPreviouslyDenied:
      return later_step ? Step::kAcknowledge : Step::kAsk;
    case Variant::kPreviouslyGranted:
      return later_step ? Step::kAcknowledge : Step::kAlreadyAllowed;
    case Variant::kOsSystemSettings:
    case Variant::kAdministratorGranted:
    case Variant::kAdministratorDenied:
    case Variant::kUninitialized:
      return Step::kAcknowledge;
  }
  return Step::kAcknowledge;
}

class PermissionPrompt : public permissions::PermissionPrompt {
 public:
  PermissionPrompt(content::WebContents* contents, Delegate* delegate)
      : delegate_(delegate), step_(StepOf(delegate)) {
    static int last_id = 0;
    id_ = "p" + std::to_string(++last_id);
    Prompts()[id_] = weak_factory_.GetWeakPtr();
    switch (step_) {
      case Step::kAsk:
      case Step::kAlreadyAllowed:
        AskHost(contents);
        break;
      case Step::kSystemPrompt:
        PostToSelf(&PermissionPrompt::AskSystem);
        break;
      case Step::kAcknowledge:
        PostToSelf(&PermissionPrompt::Acknowledge);
        break;
    }
  }

  ~PermissionPrompt() override {
    Prompts().erase(id_);
    if (asked_host_ && !answered_) {
      base::SingleThreadTaskRunner::GetCurrentDefault()->PostTask(
          FROM_HERE, base::BindOnce(
                         [](std::string id) {
                           HostEvent("permissionDismissed",
                                     base::DictValue().Set("id", id));
                         },
                         id_));
    }
  }

  void Resolve(const std::string& result, bool remember) {
    if (!asked_host_ || answered_) {
      return;
    }
    answered_ = true;
    base::SingleThreadTaskRunner::GetCurrentDefault()->PostTask(
        FROM_HERE, base::BindOnce(&PermissionPrompt::Apply,
                                  weak_factory_.GetWeakPtr(), result, remember));
  }

  bool UpdateAnchor() override { return true; }
  TabSwitchingBehavior GetTabSwitchingBehavior() override {
    return TabSwitchingBehavior::kKeepPromptAlive;
  }
  permissions::PermissionPromptDisposition GetPromptDisposition() const override {
    return permissions::PermissionPromptDisposition::CUSTOM_MODAL_DIALOG;
  }
  bool IsAskPrompt() const override { return step_ == Step::kAsk; }
  std::optional<gfx::Rect> GetViewBoundsInScreen() const override {
    return std::nullopt;
  }
  std::vector<permissions::ElementAnchoredBubbleVariant> GetPromptVariants()
      const override {
    return {};
  }
  std::optional<permissions::feature_params::PermissionElementPromptPosition>
  GetPromptPosition() const override {
    return std::nullopt;
  }

 private:
  void AskHost(content::WebContents* contents) {
    asked_host_ = true;
    base::ListValue kinds;
    std::set<std::string> seen;
    for (const auto& request : delegate_->Requests()) {
      if (const char* kind = KindName(request->request_type());
          kind && seen.insert(kind).second) {
        kinds.Append(kind);
      }
    }
    base::DictValue request =
        base::DictValue()
            .Set("id", id_)
            .Set("origin", delegate_->GetRequestingOrigin().spec())
            .Set("permissions", std::move(kinds));
    base::SingleThreadTaskRunner::GetCurrentDefault()->PostTask(
        FROM_HERE,
        base::BindOnce(
            [](base::WeakPtr<PermissionPrompt> prompt,
               base::WeakPtr<content::WebContents> contents,
               base::DictValue request) {
              if (prompt && contents) {
                HostTabEvent(contents.get(), "permission", std::move(request));
              }
            },
            weak_factory_.GetWeakPtr(), contents->GetWeakPtr(),
            std::move(request)));
  }

  void PostToSelf(void (PermissionPrompt::*step)()) {
    base::SingleThreadTaskRunner::GetCurrentDefault()->PostTask(
        FROM_HERE, base::BindOnce(step, weak_factory_.GetWeakPtr()));
  }

  bool Current() const { return delegate_->GetCurrentPrompt() == this; }

  void Apply(const std::string& result, bool remember) {
    if (!Current()) {
      return;
    }
    Delegate* delegate = delegate_;
    const PromptOptions options(std::monostate{});
    if (step_ == Step::kAlreadyAllowed) {
      if (result == "deny" && remember) {
        delegate->Deny(options);
      } else {
        delegate->Dismiss(options);
      }
      return;
    }
    if (result == "accept") {
      bool one_time = !remember;
      for (const auto& request : delegate->Requests()) {
        one_time &= permissions::PermissionUtil::DoesSupportTemporaryGrants(
            request->GetContentSettingsType());
      }
      if (one_time) {
        delegate->AcceptThisTime(options);
      } else {
        delegate->Accept(options);
      }
    } else if (result == "deny" && remember) {
      delegate->Deny(options);
    } else {
      delegate->Dismiss(options);
    }
  }

  void AskSystem() {
    if (!Current()) {
      return;
    }
    std::vector<ContentSettingsType> types;
    for (const auto& request : delegate_->Requests()) {
      types.push_back(request->GetContentSettingsType());
    }
    pending_system_answers_ = types.size();
    for (ContentSettingsType type : types) {
      system_permission_settings::Request(
          type, base::BindOnce(&PermissionPrompt::OnSystemAnswer,
                               weak_factory_.GetWeakPtr(), types));
    }
  }

  void OnSystemAnswer(std::vector<ContentSettingsType> types) {
    if (pending_system_answers_ == 0 || --pending_system_answers_ > 0 ||
        !Current()) {
      return;
    }
    for (ContentSettingsType type : types) {
      if (system_permission_settings::CanPrompt(type)) {
        return;
      }
    }
    delegate_->AdvanceOrFinalizeEmbeddedPromptFlow();
  }

  void Acknowledge() {
    if (Current()) {
      delegate_->Dismiss(PromptOptions(std::monostate{}));
    }
  }

  const raw_ptr<Delegate> delegate_;
  const Step step_;
  std::string id_;
  bool asked_host_ = false;
  bool answered_ = false;
  size_t pending_system_answers_ = 0;
  base::WeakPtrFactory<PermissionPrompt> weak_factory_{this};
};

std::unique_ptr<permissions::PermissionPrompt> CreatePrompt(
    content::WebContents* contents,
    permissions::PermissionPrompt::Delegate* delegate,
    bool* default_handling) {
  if (!HostShowsTab(contents)) {
    *default_handling = true;
    return nullptr;
  }
  *default_handling = false;
  return std::make_unique<PermissionPrompt>(contents, delegate);
}

}

void InstallPermissionPrompts() {
  g_astro_create_permission_prompt = &CreatePrompt;
}

void ResolvePermission(const std::string& request_id,
                       const std::string& result,
                       bool remember) {
  auto it = Prompts().find(request_id);
  if (it != Prompts().end() && it->second) {
    it->second->Resolve(result, remember);
  }
}

}
