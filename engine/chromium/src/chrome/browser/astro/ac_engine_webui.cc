// Copyright 2026 Oxy. Apache-2.0.

#include "chrome/browser/astro/ac_engine_webui.h"

#include <map>
#include <memory>
#include <optional>
#include <set>
#include <string>
#include <string_view>
#include <utility>

#include "base/base64.h"
#include "base/containers/fixed_flat_map.h"
#include "base/containers/fixed_flat_set.h"
#include "base/files/file_path.h"
#include "base/functional/bind.h"
#include "base/memory/raw_ptr.h"
#include "base/memory/weak_ptr.h"
#include "base/no_destructor.h"
#include "base/values.h"
#include "base/json/json_reader.h"
#include "base/json/json_writer.h"
#include "chrome/browser/astro/ac_profile_tabs.h"
#include "chrome/browser/astro/public/ac_engine.h"
#include "chrome/browser/profiles/profile.h"
#include "components/prefs/pref_service.h"
#include "content/public/browser/browser_task_traits.h"
#include "content/public/browser/browser_thread.h"
#include "content/public/browser/web_ui.h"
#include "content/public/browser/web_ui_message_handler.h"
#include "net/base/net_errors.h"
#include "net/http/http_response_headers.h"
#include "net/http/http_util.h"
#include "net/traffic_annotation/network_traffic_annotation.h"
#include "services/network/public/cpp/resource_request.h"
#include "services/network/public/cpp/shared_url_loader_factory.h"
#include "services/network/public/cpp/simple_url_loader.h"
#include "services/network/public/mojom/url_response_head.mojom.h"
#include "url/gurl.h"

extern "C" {
void ac_engine_set_event_sink(ac_engine_event_t sink, void* context);
void ac_autofill_addresses(const char*, const char*, ac_engine_reply_t, void*);
void ac_autofill_card_number(const char*, const char*, ac_engine_reply_t, void*);
void ac_autofill_cards(const char*, const char*, ac_engine_reply_t, void*);
void ac_autofill_remove(const char*, const char*, ac_engine_reply_t, void*);
void ac_autofill_save_address(const char*, const char*, ac_engine_reply_t, void*);
void ac_autofill_save_card(const char*, const char*, ac_engine_reply_t, void*);
void ac_battery_saver(const char*, const char*, ac_engine_reply_t, void*);
void ac_bookmarks_apply(const char*, const char*, ac_engine_reply_t, void*);
void ac_bookmarks_tree(const char*, const char*, ac_engine_reply_t, void*);
void ac_bookmarks_watch(const char*, const char*, ac_engine_reply_t, void*);
void ac_browsing_data_clear(const char*, const char*, ac_engine_reply_t, void*);
void ac_cli_control(const char*, const char*, ac_engine_reply_t, void*);
void ac_components_list(const char*, const char*, ac_engine_reply_t, void*);
void ac_downloads_cancel(const char*, const char*, ac_engine_reply_t, void*);
void ac_downloads_list(const char*, const char*, ac_engine_reply_t, void*);
void ac_downloads_pause(const char*, const char*, ac_engine_reply_t, void*);
void ac_downloads_resume(const char*, const char*, ac_engine_reply_t, void*);
void ac_extensions_configure(const char*, const char*, ac_engine_reply_t, void*);
void ac_extensions_list(const char*, const char*, ac_engine_reply_t, void*);
void ac_extensions_reload(const char*, const char*, ac_engine_reply_t, void*);
void ac_extensions_set_enabled(const char*, const char*, ac_engine_reply_t, void*);
void ac_extensions_sync_apply(const char*, const char*, ac_engine_reply_t, void*);
void ac_extensions_sync_state(const char*, const char*, ac_engine_reply_t, void*);
void ac_extensions_uninstall(const char*, const char*, ac_engine_reply_t, void*);
void ac_extensions_watch_actions(const char*, const char*, ac_engine_reply_t, void*);
void ac_external_apps_allowances(const char*, const char*, ac_engine_reply_t, void*);
void ac_external_apps_remove(const char*, const char*, ac_engine_reply_t, void*);
void ac_favicons_get(const char*, const char*, ac_engine_reply_t, void*);
void ac_favicons_set(const char*, const char*, ac_engine_reply_t, void*);
void ac_history_add(const char*, const char*, ac_engine_reply_t, void*);
void ac_history_delete_urls(const char*, const char*, ac_engine_reply_t, void*);
void ac_history_import(const char*, const char*, ac_engine_reply_t, void*);
void ac_history_query(const char*, const char*, ac_engine_reply_t, void*);
void ac_history_watch(const char*, const char*, ac_engine_reply_t, void*);
void ac_memory_trim(const char*, const char*, ac_engine_reply_t, void*);
void ac_omnibox_opened(const char*, const char*, ac_engine_reply_t, void*);
void ac_passwords_add(const char*, const char*, ac_engine_reply_t, void*);
void ac_passwords_allow(const char*, const char*, ac_engine_reply_t, void*);
void ac_passwords_exceptions(const char*, const char*, ac_engine_reply_t, void*);
void ac_passwords_list(const char*, const char*, ac_engine_reply_t, void*);
void ac_passwords_remove(const char*, const char*, ac_engine_reply_t, void*);
void ac_passwords_reveal(const char*, const char*, ac_engine_reply_t, void*);
void ac_passwords_unlock(const char*, const char*, ac_engine_reply_t, void*);
void ac_passwords_update(const char*, const char*, ac_engine_reply_t, void*);
void ac_search_engines_list(const char*, const char*, ac_engine_reply_t, void*);
void ac_site_data_clear(const char*, const char*, ac_engine_reply_t, void*);
void ac_site_settings_get(const char*, const char*, ac_engine_reply_t, void*);
void ac_site_settings_origins(const char*, const char*, ac_engine_reply_t, void*);
void ac_site_settings_reset(const char*, const char*, ac_engine_reply_t, void*);
void ac_site_settings_set(const char*, const char*, ac_engine_reply_t, void*);
void ac_task_manager_open(const char*, const char*, ac_engine_reply_t, void*);
void ac_tasks_list(const char*, const char*, ac_engine_reply_t, void*);
void ac_zoom_list(const char*, const char*, ac_engine_reply_t, void*);
void ac_zoom_set(const char*, const char*, ac_engine_reply_t, void*);
}

namespace astro {
namespace {

constexpr auto kCalls = base::MakeFixedFlatMap<std::string_view, ac_engine_call_t>({
    {"ac_autofill_addresses", &ac_autofill_addresses},
    {"ac_autofill_card_number", &ac_autofill_card_number},
    {"ac_autofill_cards", &ac_autofill_cards},
    {"ac_autofill_remove", &ac_autofill_remove},
    {"ac_autofill_save_address", &ac_autofill_save_address},
    {"ac_autofill_save_card", &ac_autofill_save_card},
    {"ac_battery_saver", &ac_battery_saver},
    {"ac_bookmarks_apply", &ac_bookmarks_apply},
    {"ac_bookmarks_tree", &ac_bookmarks_tree},
    {"ac_bookmarks_watch", &ac_bookmarks_watch},
    {"ac_browsing_data_clear", &ac_browsing_data_clear},
    {"ac_cli_control", &ac_cli_control},
    {"ac_components_list", &ac_components_list},
    {"ac_downloads_cancel", &ac_downloads_cancel},
    {"ac_downloads_list", &ac_downloads_list},
    {"ac_downloads_pause", &ac_downloads_pause},
    {"ac_downloads_resume", &ac_downloads_resume},
    {"ac_extensions_configure", &ac_extensions_configure},
    {"ac_extensions_list", &ac_extensions_list},
    {"ac_extensions_reload", &ac_extensions_reload},
    {"ac_extensions_set_enabled", &ac_extensions_set_enabled},
    {"ac_extensions_sync_apply", &ac_extensions_sync_apply},
    {"ac_extensions_sync_state", &ac_extensions_sync_state},
    {"ac_extensions_uninstall", &ac_extensions_uninstall},
    {"ac_extensions_watch_actions", &ac_extensions_watch_actions},
    {"ac_external_apps_allowances", &ac_external_apps_allowances},
    {"ac_external_apps_remove", &ac_external_apps_remove},
    {"ac_favicons_get", &ac_favicons_get},
    {"ac_favicons_set", &ac_favicons_set},
    {"ac_history_add", &ac_history_add},
    {"ac_history_delete_urls", &ac_history_delete_urls},
    {"ac_history_import", &ac_history_import},
    {"ac_history_query", &ac_history_query},
    {"ac_history_watch", &ac_history_watch},
    {"ac_memory_trim", &ac_memory_trim},
    {"ac_omnibox_opened", &ac_omnibox_opened},
    {"ac_passwords_add", &ac_passwords_add},
    {"ac_passwords_allow", &ac_passwords_allow},
    {"ac_passwords_exceptions", &ac_passwords_exceptions},
    {"ac_passwords_list", &ac_passwords_list},
    {"ac_passwords_remove", &ac_passwords_remove},
    {"ac_passwords_reveal", &ac_passwords_reveal},
    {"ac_passwords_unlock", &ac_passwords_unlock},
    {"ac_passwords_update", &ac_passwords_update},
    {"ac_search_engines_list", &ac_search_engines_list},
    {"ac_site_data_clear", &ac_site_data_clear},
    {"ac_site_settings_get", &ac_site_settings_get},
    {"ac_site_settings_origins", &ac_site_settings_origins},
    {"ac_site_settings_reset", &ac_site_settings_reset},
    {"ac_site_settings_set", &ac_site_settings_set},
    {"ac_task_manager_open", &ac_task_manager_open},
    {"ac_tasks_list", &ac_tasks_list},
    {"ac_zoom_list", &ac_zoom_list},
    {"ac_zoom_set", &ac_zoom_set},
});

constexpr char kEventListener[] = "astro-engine-event";
constexpr char kProfileTabListener[] = "astro-profile-tab";

constexpr auto kBoolPrefs = base::MakeFixedFlatSet<std::string_view>({
    "autofill.credit_card_enabled",
    "autofill.profile_enabled",
    "credentials_enable_service",
});

constexpr size_t kMaxFetchBody = 8 * 1024 * 1024;

constexpr net::NetworkTrafficAnnotationTag kFetchAnnotation =
    net::DefineNetworkTrafficAnnotation("astro_interface_fetch", R"(
      semantics {
        sender: "Astro interface"
        description:
          "Network requests Astro's own interface makes on Windows and Linux, "
          "where it runs as a page: search suggestions from the user's search "
          "engine and the feeds of live folders the user added."
        trigger: "Typing in the address bar, or opening a live folder."
        data: "The typed text for suggestions; nothing for feeds."
        destination: OTHER
      }
      policy {
        cookies_allowed: NO
        setting: "Turning off search suggestions or removing the live folder."
        policy_exception_justification: "Not implemented."
      })");

class EngineWebUIHandler;

std::set<EngineWebUIHandler*>& Handlers() {
  static base::NoDestructor<std::set<EngineWebUIHandler*>> handlers;
  return *handlers;
}

struct PendingReply {
  base::WeakPtr<EngineWebUIHandler> handler;
  base::Value callback_id;
};

void Replied(void* context, const char* json);
void Dispatched(void* context, const char* topic, const char* json);

class EngineWebUIHandler : public content::WebUIMessageHandler,
                           public ProfileTabsClient {
 public:
  explicit EngineWebUIHandler(Profile* profile) : profile_(profile) {
    Handlers().insert(this);
    static const bool installed = [] {
      ac_engine_set_event_sink(&Dispatched, nullptr);
      return true;
    }();
    (void)installed;
  }

  ~EngineWebUIHandler() override {
    Handlers().erase(this);
    ForgetProfileTabsClient(this);
  }

  void RegisterMessages() override {
    web_ui()->RegisterMessageCallback(
        "astroEngineCall", base::BindRepeating(&EngineWebUIHandler::HandleCall,
                                               base::Unretained(this)));
    web_ui()->RegisterMessageCallback(
        "astroFetch", base::BindRepeating(&EngineWebUIHandler::HandleFetch,
                                          base::Unretained(this)));
    web_ui()->RegisterMessageCallback(
        "astroPref", base::BindRepeating(&EngineWebUIHandler::HandlePref,
                                         base::Unretained(this)));
    web_ui()->RegisterMessageCallback(
        "astroProfileTabOpen",
        base::BindRepeating(&EngineWebUIHandler::HandleProfileTabOpen,
                            base::Unretained(this)));
    web_ui()->RegisterMessageCallback(
        "astroProfileTabGuest",
        base::BindRepeating(&EngineWebUIHandler::HandleProfileTabGuest,
                            base::Unretained(this)));
    web_ui()->RegisterMessageCallback(
        "astroProfileTabCommand",
        base::BindRepeating(&EngineWebUIHandler::HandleProfileTabCommand,
                            base::Unretained(this)));
    web_ui()->RegisterMessageCallback(
        "astroEngineTopics",
        base::BindRepeating(&EngineWebUIHandler::HandleTopics,
                            base::Unretained(this)));
  }

  void Reply(const base::Value& callback_id, std::string json) {
    if (IsJavascriptAllowed()) {
      ResolveJavascriptCallback(callback_id, base::Value(std::move(json)));
    }
  }

  void Deliver(const std::string& topic, const std::string& json) {
    if (IsJavascriptAllowed() && topics_.contains(topic)) {
      FireWebUIListener(kEventListener, base::Value(topic), base::Value(json));
    }
  }

  void OnProfileTabChanged(int tab_id, base::DictValue state) override {
    if (IsJavascriptAllowed()) {
      FireWebUIListener(kProfileTabListener, base::Value("changed"),
                        base::Value(tab_id), base::Value(std::move(state)));
    }
  }

  void OnProfileTabOpened(int tab_id,
                          int opener_id,
                          base::DictValue state) override {
    if (IsJavascriptAllowed()) {
      state.Set("opener", opener_id);
      FireWebUIListener(kProfileTabListener, base::Value("opened"),
                        base::Value(tab_id), base::Value(std::move(state)));
    }
  }

  void OnProfileTabClosed(int tab_id) override {
    if (IsJavascriptAllowed()) {
      FireWebUIListener(kProfileTabListener, base::Value("closed"),
                        base::Value(tab_id), base::Value(base::DictValue()));
    }
  }

 private:
  void HandleCall(const base::ListValue& args) {
    AllowJavascript();
    if (args.size() < 3 || args.size() > 4 || !args[1].is_string()) {
      return;
    }
    const base::Value& callback_id = args[0];
    const auto call = kCalls.find(args[1].GetString());
    if (call == kCalls.end()) {
      return Reply(callback_id, R"({"error":"not an engine call"})");
    }
    const std::string args_json =
        args[2].is_string() ? args[2].GetString() : std::string("{}");
    const std::string name =
        args.size() == 4 && args[3].is_string() ? args[3].GetString() : "";
    if (name.empty()) {
      return Run(call->second, callback_id.Clone(), args_json, profile_);
    }
    WithProfile(name, base::BindOnce(&EngineWebUIHandler::Run,
                                     weak_factory_.GetWeakPtr(), call->second,
                                     callback_id.Clone(), args_json));
  }

  void Run(ac_engine_call_t call,
           base::Value callback_id,
           std::string args_json,
           Profile* profile) {
    if (!profile) {
      return Reply(callback_id, R"({"error":"profile not loaded"})");
    }
    if (profile->IsOffTheRecord()) {
      return Reply(callback_id,
                   R"({"error":"no engine data for a private profile"})");
    }
    auto* pending =
        new PendingReply{weak_factory_.GetWeakPtr(), std::move(callback_id)};
    call(profile->GetPath().AsUTF8Unsafe().c_str(), args_json.c_str(),
         &Replied, pending);
  }

  void HandleProfileTabOpen(const base::ListValue& args) {
    AllowJavascript();
    if (args.size() != 3 || !args[1].is_string() || !args[2].is_string()) {
      return;
    }
    OpenProfileTab(
        this, args[1].GetString(), GURL(args[2].GetString()),
        base::BindOnce(
            [](base::WeakPtr<EngineWebUIHandler> self, base::Value callback_id,
               std::optional<int> tab_id) {
              if (self && self->IsJavascriptAllowed()) {
                self->ResolveJavascriptCallback(
                    callback_id,
                    tab_id ? base::Value(*tab_id) : base::Value());
              }
            },
            weak_factory_.GetWeakPtr(), args[0].Clone()));
  }

  void HandleProfileTabGuest(const base::ListValue& args) {
    AllowJavascript();
    if (args.size() != 2 || !args[1].is_int()) {
      return;
    }
    std::optional<std::string> guest =
        GuestIdForProfileTab(this, args[1].GetInt());
    ResolveJavascriptCallback(args[0],
                              guest ? base::Value(*guest) : base::Value());
  }

  void HandleProfileTabCommand(const base::ListValue& args) {
    if (args.size() != 3 || !args[0].is_int() || !args[1].is_string() ||
        !args[2].is_string()) {
      return;
    }
    ProfileTabCommand(this, args[0].GetInt(), args[1].GetString(),
                      args[2].GetString());
  }

  void HandleFetch(const base::ListValue& args) {
    AllowJavascript();
    if (args.size() != 5 || !args[1].is_string() || !args[2].is_string()) {
      return;
    }
    const base::Value& callback_id = args[0];
    GURL url(args[1].GetString());
    const std::string& method = args[2].GetString();
    if (!url.is_valid() || !url.SchemeIsHTTPOrHTTPS() ||
        (method != "GET" && method != "POST" && method != "HEAD")) {
      return ResolveJavascriptCallback(
          callback_id, base::DictValue().Set("error", "refused"));
    }
    auto request = std::make_unique<network::ResourceRequest>();
    request->url = url;
    request->method = method;
    request->credentials_mode = network::mojom::CredentialsMode::kOmit;
    if (args[3].is_dict()) {
      for (const auto [name, value] : args[3].GetDict()) {
        if (value.is_string() &&
            net::HttpUtil::IsValidHeaderName(name) &&
            net::HttpUtil::IsValidHeaderValue(value.GetString()) &&
            net::HttpUtil::IsSafeHeader(name, value.GetString())) {
          request->headers.SetHeader(name, value.GetString());
        }
      }
    }
    auto loader =
        network::SimpleURLLoader::Create(std::move(request), kFetchAnnotation);
    loader->SetAllowHttpErrorResults(true);
    if (args[4].is_string() && method == "POST") {
      std::string content_type;
      if (args[3].is_dict()) {
        if (const std::string* type = args[3].GetDict().FindString("Content-Type")) {
          content_type = *type;
        }
      }
      loader->AttachStringForUpload(
          args[4].GetString(),
          content_type.empty() ? "text/plain;charset=UTF-8" : content_type);
    }
    const int id = ++next_fetch_;
    network::SimpleURLLoader* raw = loader.get();
    fetches_[id] = std::move(loader);
    raw->DownloadToString(
        profile_->GetURLLoaderFactory().get(),
        base::BindOnce(&EngineWebUIHandler::Fetched, weak_factory_.GetWeakPtr(),
                       id, callback_id.Clone()),
        kMaxFetchBody);
  }

  void Fetched(int id,
               base::Value callback_id,
               std::optional<std::string> body) {
    auto found = fetches_.find(id);
    if (found == fetches_.end()) {
      return;
    }
    std::unique_ptr<network::SimpleURLLoader> loader = std::move(found->second);
    fetches_.erase(found);
    if (!IsJavascriptAllowed()) {
      return;
    }
    const network::mojom::URLResponseHead* head = loader->ResponseInfo();
    if (!head || !head->headers) {
      return ResolveJavascriptCallback(
          callback_id, base::DictValue().Set("error", net::ErrorToString(
                                                          loader->NetError())));
    }
    base::ListValue headers;
    size_t iterator = 0;
    std::string name;
    std::string value;
    while (head->headers->EnumerateHeaderLines(&iterator, &name, &value)) {
      headers.Append(base::ListValue().Append(name).Append(value));
    }
    ResolveJavascriptCallback(
        callback_id,
        base::DictValue()
            .Set("status", head->headers->response_code())
            .Set("headers", std::move(headers))
            .Set("body", body ? base::Value(base::Base64Encode(*body))
                              : base::Value()));
  }

  void HandlePref(const base::ListValue& args) {
    AllowJavascript();
    if (args.size() != 3 || !args[1].is_string()) {
      return;
    }
    const std::string& name = args[1].GetString();
    if (!kBoolPrefs.contains(name) || profile_->IsOffTheRecord()) {
      return ResolveJavascriptCallback(args[0], base::Value());
    }
    PrefService* prefs = profile_->GetPrefs();
    if (args[2].is_bool()) {
      prefs->SetBoolean(name, args[2].GetBool());
    }
    ResolveJavascriptCallback(args[0], base::Value(prefs->GetBoolean(name)));
  }

  void HandleTopics(const base::ListValue& args) {
    AllowJavascript();
    topics_.clear();
    if (args.size() == 1 && args[0].is_list()) {
      for (const base::Value& topic : args[0].GetList()) {
        if (topic.is_string()) {
          topics_.insert(topic.GetString());
        }
      }
    }
  }

  raw_ptr<Profile> profile_;
  std::set<std::string> topics_;
  std::map<int, std::unique_ptr<network::SimpleURLLoader>> fetches_;
  int next_fetch_ = 0;
  base::WeakPtrFactory<EngineWebUIHandler> weak_factory_{this};
};

void Replied(void* context, const char* json) {
  std::unique_ptr<PendingReply> pending(static_cast<PendingReply*>(context));
  std::string reply = json ? json : R"({"error":"bad reply from the engine"})";
  content::GetUIThreadTaskRunner({})->PostTask(
      FROM_HERE, base::BindOnce(
                     [](std::unique_ptr<PendingReply> pending,
                        std::string reply) {
                       if (pending->handler) {
                         pending->handler->Reply(pending->callback_id,
                                                 std::move(reply));
                       }
                     },
                     std::move(pending), std::move(reply)));
}

void Dispatched(void* context, const char* topic, const char* json) {
  if (!topic) {
    return;
  }
  std::string name = topic;
  std::string payload = json ? json : "{}";
  if (std::optional<base::DictValue> parsed =
          base::JSONReader::ReadDict(payload, base::JSON_PARSE_RFC)) {
    if (const std::string* path = parsed->FindString("profile")) {
      parsed->Set("profile",
                  ProfileNameForPath(base::FilePath::FromUTF8Unsafe(*path)));
      payload = base::WriteJson(*parsed).value_or(payload);
    }
  }
  content::GetUIThreadTaskRunner({})->PostTask(
      FROM_HERE, base::BindOnce(
                     [](std::string name, std::string payload) {
                       for (EngineWebUIHandler* handler : Handlers()) {
                         handler->Deliver(name, payload);
                       }
                     },
                     std::move(name), std::move(payload)));
}

}

std::unique_ptr<content::WebUIMessageHandler> CreateEngineWebUIHandler(
    Profile* profile) {
  return std::make_unique<EngineWebUIHandler>(profile);
}

}
