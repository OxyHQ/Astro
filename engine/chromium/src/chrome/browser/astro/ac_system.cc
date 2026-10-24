// Copyright 2026 Oxy. Apache-2.0.

#include "chrome/browser/astro/ac_system.h"

#include <iterator>
#include <string>
#include <utility>

#include "base/base_paths.h"
#include "base/command_line.h"
#include "base/files/file_path.h"
#include "base/files/file_util.h"
#include "base/functional/bind.h"
#include "base/memory/scoped_refptr.h"
#include "base/path_service.h"
#include "base/no_destructor.h"
#include "base/process/process_handle.h"
#include "base/task/cancelable_task_tracker.h"
#include "base/task/thread_pool.h"
#include "build/build_config.h"
#include "base/base64.h"
#include "base/strings/utf_string_conversions.h"
#include "chrome/browser/astro/ac_host.h"
#include "chrome/browser/astro/ac_system_state.h"
#include "chrome/browser/astro/ac_trash.h"
#include "chrome/browser/browser_process.h"
#include "chrome/browser/content_settings/host_content_settings_map_factory.h"
#include "chrome/browser/first_run/first_run.h"
#include "chrome/browser/icon_manager.h"
#include "chrome/browser/notifications/notification_display_service.h"
#include "chrome/browser/notifications/notification_display_service_factory.h"
#include "chrome/browser/notifications/notification_handler.h"
#include "chrome/browser/platform_util.h"
#include "ui/base/models/image_model.h"
#include "ui/gfx/codec/png_codec.h"
#include "ui/gfx/image/image.h"
#include "ui/gfx/image/image_skia.h"
#include "ui/gfx/image/image_skia_rep.h"
#include "ui/message_center/public/cpp/notification.h"
#include "ui/message_center/public/cpp/notification_delegate.h"
#include "ui/message_center/public/cpp/notifier_id.h"
#include "chrome/browser/profiles/profile.h"
#include "chrome/browser/profiles/profile_manager.h"
#include "components/content_settings/core/browser/host_content_settings_map.h"
#include "components/version_info/version_info.h"
#include "chrome/browser/shell_integration.h"
#include "url/gurl.h"

#if BUILDFLAG(IS_WIN)
#include <windows.h>

#include "base/win/registry.h"
#endif

#if BUILDFLAG(IS_LINUX)
#include "base/environment.h"
#include "base/nix/xdg_util.h"
#endif

namespace astro {
namespace {

using Done = base::OnceCallback<void(base::Value)>;

#if BUILDFLAG(IS_WIN)
constexpr wchar_t kRunKey[] = L"Software\\Microsoft\\Windows\\CurrentVersion\\Run";
constexpr wchar_t kRunValue[] = L"Astro";
#endif

#if BUILDFLAG(IS_LINUX)
base::FilePath AutostartFile() {
  std::unique_ptr<base::Environment> env = base::Environment::Create();
  return base::nix::GetXDGDirectory(env.get(), "XDG_CONFIG_HOME", ".config")
      .Append("autostart")
      .Append("astro-browser.desktop");
}
#endif

bool StartSystemDictation() {
#if BUILDFLAG(IS_WIN)
  INPUT keys[4] = {};
  for (INPUT& key : keys) {
    key.type = INPUT_KEYBOARD;
  }
  keys[0].ki.wVk = VK_LWIN;
  keys[1].ki.wVk = 'H';
  keys[2].ki.wVk = 'H';
  keys[2].ki.dwFlags = KEYEVENTF_KEYUP;
  keys[3].ki.wVk = VK_LWIN;
  keys[3].ki.dwFlags = KEYEVENTF_KEYUP;
  return SendInput(std::size(keys), keys, sizeof(INPUT)) == std::size(keys);
#else
  return false;
#endif
}

base::Value LaunchAtLoginStatus() {
#if BUILDFLAG(IS_WIN)
  base::win::RegKey key(HKEY_CURRENT_USER, kRunKey, KEY_QUERY_VALUE);
  return base::Value(key.HasValue(kRunValue) ? "enabled" : "notRegistered");
#elif BUILDFLAG(IS_LINUX)
  return base::Value(base::PathExists(AutostartFile()) ? "enabled"
                                                       : "notRegistered");
#else
  return base::Value("notFound");
#endif
}

base::Value SetLaunchAtLogin(bool enabled) {
  base::FilePath exe;
  if (!base::PathService::Get(base::FILE_EXE, &exe)) {
    return base::Value(false);
  }
#if BUILDFLAG(IS_WIN)
  base::win::RegKey key(HKEY_CURRENT_USER, kRunKey, KEY_SET_VALUE);
  if (!enabled) {
    return base::Value(key.DeleteValue(kRunValue) == ERROR_SUCCESS);
  }
  return base::Value(key.WriteValue(kRunValue,
                                    (L"\"" + exe.value() + L"\"").c_str()) ==
                     ERROR_SUCCESS);
#elif BUILDFLAG(IS_LINUX)
  const base::FilePath file = AutostartFile();
  if (!enabled) {
    return base::Value(base::DeleteFile(file));
  }
  const std::string entry = "[Desktop Entry]\nType=Application\nName=Astro\nExec=\"" +
                            exe.value() + "\"\nX-GNOME-Autostart-enabled=true\n";
  return base::Value(base::CreateDirectory(file.DirName()) &&
                     base::WriteFile(file, entry));
#else
  return base::Value(false);
#endif
}

class NotificationResponder : public message_center::NotificationDelegate {
 public:
  explicit NotificationResponder(std::string id) : id_(std::move(id)) {}

  void Click(const std::optional<int>&,
             const std::optional<std::u16string>&) override {
    HostEvent("notificationResponse",
              base::DictValue().Set("id", id_).Set("action", "click"));
  }

  void Close(bool by_user) override {
    if (by_user) {
      HostEvent("notificationResponse",
                base::DictValue().Set("id", id_).Set("action", "close"));
    }
  }

 private:
  ~NotificationResponder() override = default;

  const std::string id_;
};

ui::ImageModel IconFrom(const std::string* data_url) {
  constexpr std::string_view kPrefix = "data:image/png;base64,";
  if (!data_url || !data_url->starts_with(kPrefix)) {
    return ui::ImageModel();
  }
  std::optional<std::vector<uint8_t>> png =
      base::Base64Decode(std::string_view(*data_url).substr(kPrefix.size()));
  return png ? ui::ImageModel::FromImage(gfx::Image::CreateFrom1xPNGBytes(*png))
             : ui::ImageModel();
}

base::Value Notify(Profile* profile, const base::DictValue& args) {
  const std::string* id = args.FindString("id");
  const std::string* title = args.FindString("title");
  if (!id || !title) {
    return base::Value(false);
  }
  const std::string* body = args.FindString("body");
  const std::string* subtitle = args.FindString("subtitle");
  const std::string* origin = args.FindString("origin");
  message_center::RichNotificationData rich;
  rich.silent = args.FindBool("silent").value_or(false);
  message_center::Notification notification(
      message_center::NOTIFICATION_TYPE_SIMPLE, *id, base::UTF8ToUTF16(*title),
      base::UTF8ToUTF16(body ? *body : std::string()),
      IconFrom(args.FindString("icon")),
      base::UTF8ToUTF16(subtitle ? *subtitle : std::string()),
      GURL(origin ? *origin : std::string()),
      message_center::NotifierId(message_center::NotifierType::APPLICATION,
                                 "astro"),
      rich, base::MakeRefCounted<NotificationResponder>(*id));
  NotificationDisplayServiceFactory::GetForProfile(profile)->Display(
      NotificationHandler::Type::TRANSIENT, notification, nullptr);
  return base::Value(*id);
}

constexpr float kFileIconScale = 2.0f;

IconLoader::IconSize FileIconSize(double points) {
  return points <= 16   ? IconLoader::SMALL
         : points <= 32 ? IconLoader::NORMAL
                        : IconLoader::LARGE;
}

base::CancelableTaskTracker& FileIconRequests() {
  static base::NoDestructor<base::CancelableTaskTracker> tracker;
  return *tracker;
}

base::Value FileIconDataUrl(gfx::Image image) {
  if (image.IsEmpty()) {
    return base::Value();
  }
  const gfx::ImageSkiaRep& rep =
      image.ToImageSkia()->GetRepresentation(kFileIconScale);
  if (rep.is_null()) {
    return base::Value();
  }
  std::optional<std::vector<uint8_t>> png =
      gfx::PNGCodec::EncodeBGRASkBitmap(rep.GetBitmap(), false);
  return png ? base::Value("data:image/png;base64," + base::Base64Encode(*png))
             : base::Value();
}

void FileIcon(const base::FilePath& path, double points, Done done) {
  IconManager* icons = g_browser_process->icon_manager();
  if (!icons || path.empty()) {
    return std::move(done).Run(base::Value());
  }
  icons->LoadIcon(path, FileIconSize(points), kFileIconScale,
                  base::BindOnce(&FileIconDataUrl).Then(std::move(done)),
                  &FileIconRequests());
}

void DefaultBrowserState(bool set, Done done) {
  auto worker = base::MakeRefCounted<shell_integration::DefaultBrowserWorker>();
  auto reply = base::BindOnce(
      [](Done done, shell_integration::DefaultWebClientState state) {
        std::move(done).Run(
            base::Value(state == shell_integration::IS_DEFAULT));
      },
      std::move(done));
  if (set) {
    worker->StartSetAsDefault(std::move(reply));
  } else {
    worker->StartCheckIsDefault(std::move(reply));
  }
}

}

void SystemCall(Profile* profile,
                const std::string& method,
                const base::DictValue& args,
                Done done) {
  const std::string* text = args.FindString("path");
  const base::FilePath path =
      base::FilePath::FromUTF8Unsafe(text ? *text : std::string());
  if (method == "openFile" || method == "revealFile" ||
      method == "fileExists" || method == "moveToTrash") {
    if (!path.IsAbsolute()) {
      return std::move(done).Run(base::Value(false));
    }
  }
  if (method == "openFile") {
    platform_util::OpenItem(
        profile, path, platform_util::OPEN_FILE,
        base::BindOnce(
            [](Done done, platform_util::OpenOperationResult result) {
              std::move(done).Run(
                  base::Value(result == platform_util::OPEN_SUCCEEDED));
            },
            std::move(done)));
  } else if (method == "revealFile") {
    platform_util::ShowItemInFolder(profile, path);
    std::move(done).Run(base::Value(true));
  } else if (method == "fileExists") {
    base::ThreadPool::PostTaskAndReplyWithResult(
        FROM_HERE, {base::MayBlock()},
        base::BindOnce([](base::FilePath path) { return base::Value(base::PathExists(path)); },
                       path),
        std::move(done));
  } else if (method == "moveToTrash") {
    MoveToTrash(path, base::BindOnce([](bool moved) {
                        return base::Value(moved);
                      }).Then(std::move(done)));
  } else if (method == "fileIcon") {
    FileIcon(path, args.FindDouble("size").value_or(32), std::move(done));
  } else if (method == "openExternal") {
    const std::string* url = args.FindString("url");
    const GURL target(url ? *url : std::string());
    if (target.is_valid() && !target.SchemeIsHTTPOrHTTPS() &&
        !target.SchemeIsFile()) {
      platform_util::OpenExternal(target);
      return std::move(done).Run(base::Value(true));
    }
    std::move(done).Run(base::Value(false));
  } else if (method == "notify") {
    std::move(done).Run(Notify(profile, args));
  } else if (method == "removeNotifications") {
    if (const base::ListValue* ids = args.FindList("ids")) {
      for (const base::Value& id : *ids) {
        if (id.is_string()) {
          NotificationDisplayServiceFactory::GetForProfile(profile)->Close(
              NotificationHandler::Type::TRANSIENT, id.GetString());
        }
      }
    }
    std::move(done).Run(base::Value(true));
  } else if (method == "isDefaultBrowser" || method == "setAsDefaultBrowser") {
    DefaultBrowserState(method == "setAsDefaultBrowser", std::move(done));
  } else if (method == "launchAtLoginStatus") {
    base::ThreadPool::PostTaskAndReplyWithResult(
        FROM_HERE, {base::MayBlock()}, base::BindOnce(&LaunchAtLoginStatus),
        std::move(done));
  } else if (method == "setLaunchAtLogin") {
    base::ThreadPool::PostTaskAndReplyWithResult(
        FROM_HERE, {base::MayBlock()},
        base::BindOnce(&SetLaunchAtLogin,
                       args.FindBool("enabled").value_or(false)),
        std::move(done));
  } else if (method == "systemState") {
    CurrentSystemState(std::move(done));
  } else if (method == "firstRun") {
    std::move(done).Run(base::Value(first_run::IsChromeFirstRun()));
  } else if (method == "startDictation") {
    std::move(done).Run(base::Value(StartSystemDictation()));
  } else if (method == "engineInfo") {
    std::move(done).Run(base::Value(
        base::DictValue()
            .Set("pid", static_cast<int>(base::GetCurrentProcId()))
            .Set("dataDirectory", profile->GetPath().DirName().AsUTF8Unsafe())
            .Set("engine", "webium")
            .Set("chromiumVersion", version_info::GetVersionNumber())
            .Set("lastUsedProfile", profile->GetBaseName().AsUTF8Unsafe())));
  } else if (method == "setAutoPictureInPicture") {
    const ContentSetting setting = args.FindBool("enabled").value_or(true)
                                       ? CONTENT_SETTING_ALLOW
                                       : CONTENT_SETTING_BLOCK;
    for (Profile* loaded :
         g_browser_process->profile_manager()->GetLoadedProfiles()) {
      if (!loaded->IsOffTheRecord()) {
        HostContentSettingsMapFactory::GetForProfile(loaded)
            ->SetDefaultContentSetting(
                ContentSettingsType::AUTO_PICTURE_IN_PICTURE, setting);
      }
    }
    std::move(done).Run(base::Value());
  } else {
    std::move(done).Run(base::Value());
  }
}

}
