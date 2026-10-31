// Copyright 2026 Oxy. Apache-2.0.

#include "ui/ozone/platform/oxyos/ozone_platform_oxyos.h"

#include <memory>
#include <utility>

#include "base/functional/bind.h"
#include "ui/base/ime/linux/input_method_auralinux.h"
#include "ui/base/ime/linux/linux_input_method_context_factory.h"
#include "ui/display/types/native_display_delegate.h"
#include "ui/events/ozone/layout/keyboard_layout_engine_manager.h"
#include "ui/events/ozone/layout/xkb/xkb_evdev_codes.h"
#include "ui/events/ozone/layout/xkb/xkb_keyboard_layout_engine.h"
#include "ui/ozone/common/stub_overlay_manager.h"
#include "ui/ozone/platform/oxyos/oxyos_connection.h"
#include "ui/ozone/platform/oxyos/oxyos_cursor_factory.h"
#include "ui/ozone/platform/oxyos/oxyos_gpu.h"
#include "ui/ozone/platform/oxyos/oxyos_input_method_context.h"
#include "ui/ozone/platform/oxyos/oxyos_keymap.h"
#include "ui/ozone/platform/oxyos/oxyos_screen.h"
#include "ui/ozone/platform/oxyos/oxyos_surface_factory.h"
#include "ui/ozone/platform/oxyos/oxyos_surface_host.h"
#include "ui/ozone/platform/oxyos/oxyos_window.h"
#include "ui/ozone/public/ozone_platform.h"
#include "ui/ozone/public/stub_input_controller.h"
#include "ui/ozone/public/system_input_injector.h"
#include "ui/platform_window/platform_window_init_properties.h"

namespace ui {

namespace {

class OzonePlatformOxyos : public OzonePlatform {
 public:
  OzonePlatformOxyos() {
    properties_.set_parent_for_non_top_level_windows = true;
    properties_.app_modal_dialogs_use_event_blocker = true;
    properties_.supports_global_screen_coordinates = false;
    runtime_properties_.supports_server_side_window_decorations = true;
  }
  OzonePlatformOxyos(const OzonePlatformOxyos&) = delete;
  OzonePlatformOxyos& operator=(const OzonePlatformOxyos&) = delete;
  ~OzonePlatformOxyos() override = default;

  SurfaceFactoryOzone* GetSurfaceFactoryOzone() override {
    return surface_factory_.get();
  }
  OverlayManagerOzone* GetOverlayManager() override {
    return overlay_manager_.get();
  }
  CursorFactory* GetCursorFactory() override { return cursor_factory_.get(); }
  InputController* GetInputController() override {
    return input_controller_.get();
  }
  GpuPlatformSupportHost* GetGpuPlatformSupportHost() override {
    return surface_host_.get();
  }
  std::unique_ptr<SystemInputInjector> CreateSystemInputInjector() override {
    return nullptr;
  }
  std::unique_ptr<PlatformWindow> CreatePlatformWindow(
      PlatformWindowDelegate* delegate,
      PlatformWindowInitProperties properties) override {
    auto window =
        std::make_unique<OxyOSWindow>(delegate, connection_.get(), properties);
    window->Initialize();
    return window;
  }
  std::unique_ptr<display::NativeDisplayDelegate> CreateNativeDisplayDelegate()
      override {
    return nullptr;
  }
  std::unique_ptr<PlatformScreen> CreateScreen() override {
    return std::make_unique<OxyOSScreen>(connection_.get());
  }
  void InitScreen(PlatformScreen* screen) override {}
  std::unique_ptr<InputMethod> CreateInputMethod(
      ImeKeyEventDispatcher* ime_key_event_dispatcher,
      gfx::AcceleratedWidget widget) override {
    return std::make_unique<InputMethodAuraLinux>(ime_key_event_dispatcher,
                                                  widget);
  }
  bool IsWindowCompositingSupported() const override { return true; }

  PlatformClipboard* GetPlatformClipboard() override {
    return connection_ ? connection_->clipboard() : nullptr;
  }

  const PlatformProperties& GetPlatformProperties() override {
    return properties_;
  }

  const PlatformRuntimeProperties& GetPlatformRuntimeProperties() override {
    if (connection_) {
      runtime_properties_.supports_native_pixmaps =
          oxyos_client_gpu_device(connection_->client(), nullptr) == 1;
    } else if (gpu_) {
      runtime_properties_.supports_native_pixmaps =
          gpu_->supports_native_pixmaps();
    }
    return runtime_properties_;
  }

  bool InitializeUI(const InitParams& params) override {
    connection_ = OxyOSConnection::Connect();
    if (!connection_) {
      return false;
    }
    keyboard_layout_engine_ =
        std::make_unique<XkbKeyboardLayoutEngine>(xkb_evdev_codes_);
    KeyboardLayoutEngineManager::SetKeyboardLayoutEngine(
        keyboard_layout_engine_.get());
    connection_->set_keyboard_layout_engine(keyboard_layout_engine_.get());
    connection_->set_keyboard_layout_callback(base::BindRepeating(
        [](XkbKeyboardLayoutEngine* engine, const std::string& names) {
          const std::optional<std::string> keymap = OxyOSKeymapFromNames(names);
          if (!keymap || !engine->SetCurrentLayoutFromBuffer(keymap->data(),
                                                             keymap->size())) {
            LOG(ERROR) << "No XKB keymap for the session's layout " << names;
          }
        },
        base::Unretained(keyboard_layout_engine_.get())));
    GetInputMethodContextFactoryForOzone() = base::BindRepeating(
        [](OxyOSConnection* connection,
           LinuxInputMethodContextDelegate* delegate)
            -> std::unique_ptr<LinuxInputMethodContext> {
          return std::make_unique<OxyOSInputMethodContext>(connection,
                                                           delegate);
        },
        base::Unretained(connection_.get()));
    cursor_factory_ = std::make_unique<OxyOSCursorFactory>();
    input_controller_ = std::make_unique<StubInputController>();
    overlay_manager_ = std::make_unique<StubOverlayManager>();
    surface_host_ = std::make_unique<OxyOSSurfaceHost>(connection_.get());
    connection_->set_surface_host(surface_host_.get());
    surface_host_->NameRenderNode();
    return true;
  }

  void InitializeGPU(const InitParams& params) override {
    gpu_ = std::make_unique<OxyOSGpu>();
    surface_factory_ = std::make_unique<OxyOSSurfaceFactory>(gpu_.get());
    if (!overlay_manager_) {
      overlay_manager_ = std::make_unique<StubOverlayManager>();
    }
  }

  void PostCreateMainMessageLoop(base::OnceCallback<void()> shutdown_cb,
                                 scoped_refptr<base::SingleThreadTaskRunner>
                                     user_input_task_runner) override {
    if (connection_) {
      connection_->StartProcessingEvents(std::move(shutdown_cb));
    }
  }

  void AddInterfaces(mojo::BinderMap* binders) override {
    if (gpu_) {
      gpu_->AddInterfaces(binders);
    }
  }

 private:
  PlatformProperties properties_;
  PlatformRuntimeProperties runtime_properties_;
  std::unique_ptr<OxyOSConnection> connection_;
  XkbEvdevCodes xkb_evdev_codes_;
  std::unique_ptr<XkbKeyboardLayoutEngine> keyboard_layout_engine_;
  std::unique_ptr<CursorFactory> cursor_factory_;
  std::unique_ptr<InputController> input_controller_;
  std::unique_ptr<OverlayManagerOzone> overlay_manager_;
  std::unique_ptr<OxyOSSurfaceHost> surface_host_;
  std::unique_ptr<OxyOSGpu> gpu_;
  std::unique_ptr<OxyOSSurfaceFactory> surface_factory_;
};

}

OzonePlatform* CreateOzonePlatformOxyos() {
  return new OzonePlatformOxyos();
}

}
