// Copyright 2026 Oxy. Apache-2.0.

#include <map>
#include <memory>
#include <string>
#include <utility>
#include <vector>

#include "base/command_line.h"
#include "base/functional/bind.h"
#include "base/functional/callback.h"
#include "base/functional/callback_helpers.h"
#include "base/memory/weak_ptr.h"
#include "base/no_destructor.h"
#include "base/strings/utf_string_conversions.h"
#include "base/task/single_thread_task_runner.h"
#include "base/values.h"
#include "chrome/browser/astro/ac_chrome_ui.h"
#include "chrome/browser/astro/ac_host.h"
#include "chrome/browser/ui/bluetooth/chrome_bluetooth_chooser_controller.h"
#include "components/permissions/bluetooth_chooser_controller.h"
#include "components/permissions/chooser_controller.h"
#include "content/public/browser/bluetooth_chooser.h"
#include "content/public/browser/render_frame_host.h"
#include "content/public/browser/web_contents.h"

extern bool (*g_astro_device_chooser)(
    content::WebContents* contents,
    std::unique_ptr<permissions::ChooserController>* controller,
    base::ScopedClosureRunner* fullscreen_blocker,
    base::OnceClosure* close_closure);

namespace astro {
namespace {

constexpr char kTestBluetoothChooserSwitch[] = "astro-test-bluetooth-chooser";

class DeviceChooser;

std::map<int, std::unique_ptr<DeviceChooser>>& Live() {
  static base::NoDestructor<std::map<int, std::unique_ptr<DeviceChooser>>> live;
  return *live;
}

base::ListValue& TestEvents() {
  static base::NoDestructor<base::ListValue> events;
  return *events;
}

class DeviceChooser : public permissions::ChooserController::View {
 public:
  DeviceChooser(std::unique_ptr<permissions::ChooserController> controller,
                content::WebContents* contents,
                base::ScopedClosureRunner fullscreen_blocker)
      : controller_(std::move(controller)),
        contents_(contents->GetWeakPtr()),
        fullscreen_blocker_(std::move(fullscreen_blocker)) {
    static int last_id = 0;
    id_ = ++last_id;
    controller_->set_view(this);
  }

  ~DeviceChooser() override {
    if (controller_) {
      controller_->set_view(nullptr);
    }
  }

  int id() const { return id_; }
  base::WeakPtr<DeviceChooser> GetWeakPtr() {
    return weak_factory_.GetWeakPtr();
  }
  permissions::ChooserController* controller() const {
    return open_ ? controller_.get() : nullptr;
  }

  void Select(int index) {
    if (!open_ || !controller_) {
      return;
    }
    std::vector<size_t> indices;
    if (index >= 0 && static_cast<size_t>(index) < controller_->NumOptions()) {
      indices.push_back(static_cast<size_t>(index));
    } else if (!controller_->BothButtonsAlwaysEnabled()) {
      return;
    }
    std::unique_ptr<permissions::ChooserController> controller = Finish();
    controller->Select(indices);
    Release(std::move(controller));
  }

  void Cancel() {
    if (!open_ || !controller_) {
      return;
    }
    std::unique_ptr<permissions::ChooserController> controller = Finish();
    controller->Cancel();
    Release(std::move(controller));
  }

  void Refresh() {
    if (open_ && controller_) {
      controller_->RefreshOptions();
    }
  }

  void OpenSettings() {
    if (open_ && controller_ &&
        controller_->ShouldShowAdapterUnauthorizedView()) {
      controller_->OpenPermissionPreferences();
    }
  }

  void CloseFromChrome() {
    if (open_) {
      Release(Finish());
    }
  }

  void Announce() {
    if (!contents_ || !HostShowsTab(contents_.get())) {
      return Cancel();
    }
    announced_ = true;
    Changed();
  }

  void OnOptionsInitialized() override { Changed(); }
  void OnOptionAdded(size_t index) override { Changed(); }
  void OnOptionRemoved(size_t index) override { Changed(); }
  void OnOptionUpdated(size_t index) override { Changed(); }
  void OnAdapterEnabledChanged(bool enabled) override {
    adapter_on_ = enabled;
    Changed();
  }
  void OnAdapterAuthorizationChanged(bool authorized) override {
    authorized_ = authorized;
    Changed();
  }
  void OnRefreshStateChanged(bool refreshing) override {
    refreshing_ = refreshing;
    Changed();
  }

 private:
  base::DictValue State() const {
    base::DictValue state;
    state.Set("id", id_);
    state.Set("open", open_);
    base::ListValue options;
    const permissions::ChooserController* c = controller_.get();
    if (open_ && c) {
      const bool show_signal = c->ShouldShowIconBeforeText();
      for (size_t i = 0; i < c->NumOptions(); ++i) {
        options.Append(
            base::DictValue()
                .Set("name", c->GetOption(i))
                .Set("connected", c->IsConnected(i))
                .Set("paired", c->IsPaired(i))
                .Set("signal",
                     show_signal ? c->GetSignalStrengthLevel(i) : -1));
      }
      state.Set("title", c->GetTitle());
      state.Set("okLabel", c->GetOkButtonLabel());
      state.Set("cancelLabel", c->GetCancelButtonLabel());
      state.Set("noOptionsText", c->GetNoOptionsText());
      state.Set("scanningText", c->GetThrobberLabelAndTooltip().first);
      state.Set("refreshing", refreshing_);
      state.Set("canRefresh", c->ShouldShowReScanButton());
      state.Set("adapterOff", c->ShouldShowAdapterOffView() && !adapter_on_);
      state.Set("unauthorized",
                c->ShouldShowAdapterUnauthorizedView() && !authorized_);
      state.Set("bothButtonsEnabled", c->BothButtonsAlwaysEnabled());
      state.Set("showSignal", show_signal);
    }
    state.Set("options", std::move(options));
    return state;
  }

  void Changed() {
    if (announced_ && contents_) {
      HostTabEvent(contents_.get(), "deviceChooser", State());
    }
  }

  std::unique_ptr<permissions::ChooserController> Finish() {
    open_ = false;
    Changed();
    controller_->set_view(nullptr);
    std::unique_ptr<permissions::ChooserController> controller =
        std::move(controller_);
    base::SingleThreadTaskRunner::GetCurrentDefault()->PostTask(
        FROM_HERE, base::BindOnce([](int id) { Live().erase(id); }, id_));
    return controller;
  }

  static void Release(
      std::unique_ptr<permissions::ChooserController> controller) {
    base::SingleThreadTaskRunner::GetCurrentDefault()->PostTask(
        FROM_HERE,
        base::BindOnce([](std::unique_ptr<permissions::ChooserController>) {},
                       std::move(controller)));
  }

  std::unique_ptr<permissions::ChooserController> controller_;
  base::WeakPtr<content::WebContents> contents_;
  base::ScopedClosureRunner fullscreen_blocker_;
  int id_ = 0;
  bool open_ = true;
  bool announced_ = false;
  bool refreshing_ = false;
  bool adapter_on_ = true;
  bool authorized_ = true;
  base::WeakPtrFactory<DeviceChooser> weak_factory_{this};
};

DeviceChooser* Find(int id) {
  auto it = Live().find(id);
  return it == Live().end() ? nullptr : it->second.get();
}

DeviceChooser* Adopt(std::unique_ptr<permissions::ChooserController> controller,
                     content::WebContents* contents,
                     base::ScopedClosureRunner fullscreen_blocker = {}) {
  auto chooser = std::make_unique<DeviceChooser>(
      std::move(controller), contents, std::move(fullscreen_blocker));
  DeviceChooser* raw = chooser.get();
  Live()[raw->id()] = std::move(chooser);
  base::SingleThreadTaskRunner::GetCurrentDefault()->PostTask(
      FROM_HERE, base::BindOnce(
                     [](base::WeakPtr<DeviceChooser> chooser) {
                       if (chooser) {
                         chooser->Announce();
                       }
                     },
                     raw->GetWeakPtr()));
  return raw;
}

bool AskHost(content::WebContents* contents,
             std::unique_ptr<permissions::ChooserController>* controller,
             base::ScopedClosureRunner* fullscreen_blocker,
             base::OnceClosure* close_closure) {
  if (!contents || !controller || !*controller || !fullscreen_blocker ||
      !close_closure || !HostShowsTab(contents)) {
    return false;
  }
  DeviceChooser* raw =
      Adopt(std::move(*controller), contents, std::move(*fullscreen_blocker));
  *close_closure = base::BindOnce(
      [](base::WeakPtr<DeviceChooser> chooser) {
        if (chooser) {
          chooser->CloseFromChrome();
        }
      },
      raw->GetWeakPtr());
  return true;
}

const char* EventName(content::BluetoothChooserEvent event) {
  switch (event) {
    case content::BluetoothChooserEvent::DENIED_PERMISSION:
      return "denied";
    case content::BluetoothChooserEvent::CANCELLED:
      return "cancelled";
    case content::BluetoothChooserEvent::SELECTED:
      return "selected";
    case content::BluetoothChooserEvent::RESCAN:
      return "rescan";
    case content::BluetoothChooserEvent::SHOW_OVERVIEW_HELP:
      return "overviewHelp";
    case content::BluetoothChooserEvent::SHOW_ADAPTER_OFF_HELP:
      return "adapterOffHelp";
    case content::BluetoothChooserEvent::SHOW_NEED_LOCATION_HELP:
      return "needLocationHelp";
  }
  return "unknown";
}

void DriveTestBluetoothChooser(int chooser_id, bool unauthorized) {
  DeviceChooser* chooser = Find(chooser_id);
  auto* controller =
      chooser ? static_cast<permissions::BluetoothChooserController*>(
                    chooser->controller())
              : nullptr;
  if (!controller) {
    return;
  }
  using content::BluetoothChooser;
  if (unauthorized) {
    controller->OnAdapterPresenceChanged(
        BluetoothChooser::AdapterPresence::UNAUTHORIZED);
    return;
  }
  controller->OnAdapterPresenceChanged(
      BluetoothChooser::AdapterPresence::POWERED_ON);
  controller->AddOrUpdateDevice("ac-test-device", false, u"Astro Test Device",
                                false, false, 3);
  controller->OnDiscoveryStateChanged(
      BluetoothChooser::DiscoveryState::IDLE);
}

bool ShowTestBluetoothChooser(content::WebContents* contents,
                              bool unauthorized) {
  if (!contents || !contents->GetPrimaryMainFrame() ||
      !base::CommandLine::ForCurrentProcess()->HasSwitch(
          kTestBluetoothChooserSwitch) ||
      !HostShowsTab(contents)) {
    return false;
  }
  auto chooser_id = std::make_shared<int>(0);
  auto handler = base::BindRepeating(
      [](std::shared_ptr<int> chooser_id, content::BluetoothChooserEvent event,
         const std::string& device) {
        TestEvents().Append(base::DictValue()
                                .Set("event", EventName(event))
                                .Set("device", device));
        if (event == content::BluetoothChooserEvent::RESCAN) {
          base::SingleThreadTaskRunner::GetCurrentDefault()->PostTask(
              FROM_HERE,
              base::BindOnce(&DriveTestBluetoothChooser, *chooser_id, false));
        }
      },
      chooser_id);
  DeviceChooser* chooser =
      Adopt(std::make_unique<ChromeBluetoothChooserController>(
                contents->GetPrimaryMainFrame(), handler),
            contents);
  *chooser_id = chooser->id();
  base::SingleThreadTaskRunner::GetCurrentDefault()->PostTask(
      FROM_HERE,
      base::BindOnce(&DriveTestBluetoothChooser, chooser->id(), unauthorized));
  return true;
}

}

void InstallDeviceChooser() {
  g_astro_device_chooser = &AskHost;
}

bool DeviceChooserCall(const std::string& method,
                       const base::DictValue& params,
                       content::WebContents* tab,
                       base::Value* result) {
  if (method == "devShowBluetoothChooser") {
    *result = base::Value(ShowTestBluetoothChooser(
        tab, params.FindBool("unauthorized").value_or(false)));
    return true;
  }
  if (method == "devChooserEvents") {
    *result = base::Value(TestEvents().Clone());
    return true;
  }
  if (method != "selectDevice" && method != "cancelDeviceChooser" &&
      method != "refreshDeviceChooser" && method != "openBluetoothSettings") {
    return false;
  }
  *result = base::Value();
  DeviceChooser* chooser = Find(params.FindInt("id").value_or(0));
  if (!chooser) {
    return true;
  }
  if (method == "selectDevice") {
    chooser->Select(params.FindInt("index").value_or(-1));
  } else if (method == "cancelDeviceChooser") {
    chooser->Cancel();
  } else if (method == "refreshDeviceChooser") {
    chooser->Refresh();
  } else {
    chooser->OpenSettings();
  }
  return true;
}

}
