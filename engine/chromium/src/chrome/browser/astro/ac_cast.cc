// Copyright 2026 Oxy. Apache-2.0.

#include <map>
#include <memory>
#include <set>
#include <string>
#include <utility>
#include <vector>

#include "base/functional/bind.h"
#include "base/functional/callback.h"
#include "base/functional/callback_helpers.h"
#include "base/memory/raw_ptr.h"
#include "base/memory/weak_ptr.h"
#include "base/no_destructor.h"
#include "base/scoped_observation.h"
#include "base/task/single_thread_task_runner.h"
#include "base/values.h"
#include "build/build_config.h"
#include "chrome/browser/astro/ac_chrome_ui.h"
#include "chrome/browser/astro/ac_host.h"
#include "chrome/browser/astro/ac_profile_tabs.h"
#include "chrome/browser/media/router/media_router_feature.h"
#include "chrome/browser/profiles/profile.h"
#include "chrome/browser/profiles/profile_observer.h"
#include "chrome/browser/ui/media_router/cast_dialog_controller.h"
#include "chrome/browser/ui/media_router/cast_dialog_model.h"
#include "chrome/browser/ui/media_router/media_cast_mode.h"
#include "chrome/browser/ui/media_router/media_router_ui.h"
#include "chrome/browser/ui/media_router/ui_media_sink.h"
#include "components/media_router/browser/media_router.h"
#include "components/media_router/browser/media_router_dialog_controller.h"
#include "components/media_router/browser/media_router_factory.h"
#include "components/media_router/browser/media_router_metrics.h"
#include "components/media_router/browser/media_routes_observer.h"
#include "components/media_router/common/media_route.h"
#include "content/public/browser/web_contents.h"

#if !BUILDFLAG(IS_MAC)
#include "astro/core/ac_test_media_route_provider.h"
#endif

extern bool (*g_astro_wants_cast_dialog)(content::WebContents* initiator);
extern bool (*g_astro_cast_dialog)(
    content::WebContents* initiator,
    media_router::MediaRouterUI* ui,
    base::ScopedClosureRunner* fullscreen_blocker);

namespace astro {
namespace {

void MaybeRegisterTestMediaRouteProvider(Profile* profile) {
#if !BUILDFLAG(IS_MAC)
  astrocore::MaybeRegisterTestMediaRouteProvider(profile);
#endif
}

const char* SinkState(media_router::UIMediaSinkState state) {
  switch (state) {
    case media_router::UIMediaSinkState::AVAILABLE:
      return "available";
    case media_router::UIMediaSinkState::CONNECTING:
      return "connecting";
    case media_router::UIMediaSinkState::CONNECTED:
      return "connected";
    case media_router::UIMediaSinkState::DISCONNECTING:
      return "disconnecting";
    case media_router::UIMediaSinkState::UNAVAILABLE:
      return "unavailable";
  }
  return "unavailable";
}

class CastDialog;

std::map<int, std::unique_ptr<CastDialog>>& Live() {
  static base::NoDestructor<std::map<int, std::unique_ptr<CastDialog>>> live;
  return *live;
}

class CastDialog : public media_router::CastDialogController::Observer {
 public:
  CastDialog(content::WebContents* initiator,
             media_router::MediaRouterUI* ui,
             base::ScopedClosureRunner fullscreen_blocker)
      : initiator_(initiator->GetWeakPtr()),
        ui_(ui->GetWeakPtr()),
        fullscreen_blocker_(std::move(fullscreen_blocker)) {
    static int last_id = 0;
    id_ = ++last_id;
  }
  ~CastDialog() override { Detach(); }

  int id() const { return id_; }

  void Start() {
    if (!initiator_ || !HostShowsTab(initiator_.get())) {
      return Close();
    }
    if (ui_) {
      ui_->AddObserver(this);
    }
    announced_ = true;
    Notify();
  }

  void StartCasting(const std::string& sink_id, int cast_mode) {
    if (ui_) {
      ui_->StartCasting(sink_id,
                        static_cast<media_router::MediaCastMode>(cast_mode));
    }
  }

  void StopCasting(const std::string& route_id) {
    if (ui_) {
      ui_->StopCasting(route_id);
    }
  }

  void Close() {
    if (!open_) {
      return;
    }
    if (initiator_) {
      media_router::MediaRouterDialogController::GetOrCreateForWebContents(
          initiator_.get())
          ->HideMediaRouterDialog();
    }
    if (open_) {
      Detach();
      Notify();
      Forget();
    }
  }

  void OnModelUpdated(const media_router::CastDialogModel& model) override {
    base::ListValue sinks;
    for (const media_router::UIMediaSink& sink : model.media_sinks()) {
      int modes = 0;
      for (media_router::MediaCastMode mode : sink.cast_modes) {
        modes |= static_cast<int>(mode);
      }
      sinks.Append(
          base::DictValue()
              .Set("id", sink.id)
              .Set("name", sink.friendly_name)
              .Set("status", sink.GetStatusTextForDisplay())
              .Set("state", SinkState(sink.state))
              .Set("icon", static_cast<int>(sink.icon_type))
              .Set("modes", modes)
              .Set("routeId",
                   sink.route ? sink.route->media_route_id() : std::string())
              .Set("issue",
                   sink.issue ? sink.issue->info().title : std::string()));
    }
    header_ = model.dialog_header();
    permission_rejected_ = model.is_permission_rejected();
    sinks_ = std::move(sinks);
    Notify();
  }

  void OnCastingStarted() override {
    casting_started_ = true;
    Notify();
  }

  void OnControllerDestroying() override {
    ui_.reset();
    Detach();
    Notify();
    Forget();
  }

 private:
  base::DictValue State() const {
    return base::DictValue()
        .Set("id", id_)
        .Set("open", open_)
        .Set("header", header_)
        .Set("permissionRejected", permission_rejected_)
        .Set("castingStarted", casting_started_)
        .Set("sinks", sinks_.Clone());
  }

  void Notify() {
    if (announced_ && initiator_) {
      HostTabEvent(initiator_.get(), "castDialog", State());
    }
  }

  void Detach() {
    if (ui_) {
      ui_->RemoveObserver(this);
      ui_.reset();
    }
    open_ = false;
    fullscreen_blocker_.RunAndReset();
  }

  void Forget() {
    base::SingleThreadTaskRunner::GetCurrentDefault()->PostTask(
        FROM_HERE, base::BindOnce([](int id) { Live().erase(id); }, id_));
  }

  base::WeakPtr<content::WebContents> initiator_;
  base::WeakPtr<media_router::MediaRouterUI> ui_;
  base::ScopedClosureRunner fullscreen_blocker_;
  int id_ = 0;
  bool open_ = true;
  bool announced_ = false;
  bool casting_started_ = false;
  bool permission_rejected_ = false;
  std::u16string header_;
  base::ListValue sinks_;
};

CastDialog* Find(int id) {
  auto it = Live().find(id);
  return it == Live().end() ? nullptr : it->second.get();
}

class RoutesWatcher : public media_router::MediaRoutesObserver,
                      public ProfileObserver {
 public:
  RoutesWatcher(media_router::MediaRouter* router, Profile* profile)
      : media_router::MediaRoutesObserver(router), profile_(profile) {
    profile_observation_.Observe(profile);
  }

  void AddName(const std::string& name) { names_.insert(name); }

  void Announce() { OnRoutesUpdated(router()->GetCurrentRoutes()); }

  void OnRoutesUpdated(
      const std::vector<media_router::MediaRoute>& routes) override {
    base::ListValue list;
    for (const media_router::MediaRoute& route : routes) {
      list.Append(base::DictValue()
                      .Set("id", route.media_route_id())
                      .Set("sink", route.media_sink_id())
                      .Set("description", route.description())
                      .Set("source", route.media_source().id()));
    }
    for (const std::string& name : names_) {
      HostEvent("castRoutes", base::DictValue()
                                  .Set("profile", name)
                                  .Set("routes", list.Clone()));
    }
  }

  void OnProfileWillBeDestroyed(Profile* profile) override;

  media_router::MediaRouter* media_router() const { return router(); }

 private:
  raw_ptr<Profile> profile_;
  std::set<std::string> names_;
  base::ScopedObservation<Profile, ProfileObserver> profile_observation_{this};
};

std::map<Profile*, std::unique_ptr<RoutesWatcher>>& Watchers() {
  static base::NoDestructor<std::map<Profile*, std::unique_ptr<RoutesWatcher>>>
      watchers;
  return *watchers;
}

void RoutesWatcher::OnProfileWillBeDestroyed(Profile* profile) {
  profile_observation_.Reset();
  Watchers().erase(profile);
}

void Watch(const std::string& name, Profile* profile) {
  MaybeRegisterTestMediaRouteProvider(profile);
  if (!profile || !media_router::MediaRouterEnabled(profile)) {
    return;
  }
  std::unique_ptr<RoutesWatcher>& watcher = Watchers()[profile];
  if (!watcher) {
    media_router::MediaRouter* router =
        media_router::MediaRouterFactory::GetApiForBrowserContext(profile);
    if (!router) {
      Watchers().erase(profile);
      return;
    }
    watcher = std::make_unique<RoutesWatcher>(router, profile);
  }
  watcher->AddName(name);
  watcher->Announce();
}

void WatchCastRoutes(const std::string& name) {
  const size_t at = name.find('@');
  const bool off_the_record = at != std::string::npos;
  WithProfile(off_the_record ? name.substr(at + 1) : name,
              base::BindOnce(
                  [](std::string name, bool off_the_record, Profile* profile) {
                    if (profile && off_the_record) {
                      profile = profile->GetPrimaryOTRProfile(true);
                    }
                    Watch(name, profile);
                  },
                  name, off_the_record));
}

void TerminateCastRoute(const std::string& route_id) {
  for (auto& [profile, watcher] : Watchers()) {
    for (const media_router::MediaRoute& route :
         watcher->media_router()->GetCurrentRoutes()) {
      if (route.media_route_id() == route_id) {
        watcher->media_router()->TerminateRoute(route_id);
        return;
      }
    }
  }
}

bool WantsCastDialog(content::WebContents* initiator) {
  return initiator && HostShowsTab(initiator);
}

bool HandleCastDialog(content::WebContents* initiator,
                      media_router::MediaRouterUI* ui,
                      base::ScopedClosureRunner* fullscreen_blocker) {
  if (!ui || !fullscreen_blocker || !WantsCastDialog(initiator)) {
    return false;
  }
  auto dialog = std::make_unique<CastDialog>(initiator, ui,
                                             std::move(*fullscreen_blocker));
  const int id = dialog->id();
  Live()[id] = std::move(dialog);
  base::SingleThreadTaskRunner::GetCurrentDefault()->PostTask(
      FROM_HERE, base::BindOnce(
                     [](int id) {
                       if (CastDialog* dialog = Find(id)) {
                         dialog->Start();
                       }
                     },
                     id));
  return true;
}

bool ShowCastDialog(content::WebContents* contents) {
  if (!contents ||
      !media_router::MediaRouterEnabled(contents->GetBrowserContext())) {
    return false;
  }
  MaybeRegisterTestMediaRouteProvider(
      Profile::FromBrowserContext(contents->GetBrowserContext()));
  media_router::MediaRouterDialogController::GetOrCreateForWebContents(contents)
      ->ShowMediaRouterDialog(
          media_router::MediaRouterDialogActivationLocation::TOOLBAR);
  return true;
}

void CastCall(const std::string& method,
              const base::DictValue& params,
              content::WebContents* tab,
              base::OnceCallback<void(base::Value)> done) {
  if (method == "showCastDialog") {
    return std::move(done).Run(base::Value(ShowCastDialog(tab)));
  }
  if (method == "watchCastRoutes") {
    if (const std::string* profile = params.FindString("profile")) {
      WatchCastRoutes(*profile);
    }
  } else if (method == "terminateCastRoute") {
    if (const std::string* route = params.FindString("route")) {
      TerminateCastRoute(*route);
    }
  } else if (CastDialog* dialog = Find(params.FindInt("id").value_or(0))) {
    const std::string* sink = params.FindString("sink");
    const std::string* route = params.FindString("route");
    if (method == "startCasting" && sink) {
      dialog->StartCasting(*sink, params.FindInt("mode").value_or(0));
    } else if (method == "stopCasting" && route) {
      dialog->StopCasting(*route);
    } else if (method == "closeCastDialog") {
      dialog->Close();
    }
  }
  std::move(done).Run(base::Value());
}

}

void InstallCastDialog() {
  g_astro_wants_cast_dialog = &WantsCastDialog;
  g_astro_cast_dialog = &HandleCastDialog;
}

void ChromeUICall(const std::string& method,
                  const base::DictValue& params,
                  content::WebContents* tab,
                  base::OnceCallback<void(base::Value)> done) {
  base::Value result;
  if (DeviceChooserCall(method, params, tab, &result)) {
    return std::move(done).Run(std::move(result));
  }
  CastCall(method, params, tab, std::move(done));
}

}
