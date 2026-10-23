// Copyright 2026 Oxy. Apache-2.0.

#include "chrome/browser/astro/ac_engine_webui.h"

#include <memory>
#include <set>
#include <string>
#include <string_view>
#include <utility>

#include "base/containers/fixed_flat_map.h"
#include "base/files/file_path.h"
#include "base/functional/bind.h"
#include "base/memory/raw_ptr.h"
#include "base/memory/weak_ptr.h"
#include "base/no_destructor.h"
#include "base/values.h"
#include "chrome/browser/astro/public/ac_engine.h"
#include "chrome/browser/profiles/profile.h"
#include "content/public/browser/browser_task_traits.h"
#include "content/public/browser/browser_thread.h"
#include "content/public/browser/web_ui.h"
#include "content/public/browser/web_ui_message_handler.h"

extern "C" {
void ac_engine_set_event_sink(ac_engine_event_t sink, void* context);
void ac_history_query(const char*, const char*, ac_engine_reply_t, void*);
void ac_history_add(const char*, const char*, ac_engine_reply_t, void*);
void ac_history_import(const char*, const char*, ac_engine_reply_t, void*);
void ac_history_delete_urls(const char*, const char*, ac_engine_reply_t, void*);
void ac_history_watch(const char*, const char*, ac_engine_reply_t, void*);
void ac_favicons_get(const char*, const char*, ac_engine_reply_t, void*);
void ac_favicons_set(const char*, const char*, ac_engine_reply_t, void*);
void ac_bookmarks_tree(const char*, const char*, ac_engine_reply_t, void*);
void ac_bookmarks_apply(const char*, const char*, ac_engine_reply_t, void*);
void ac_bookmarks_watch(const char*, const char*, ac_engine_reply_t, void*);
void ac_omnibox_opened(const char*, const char*, ac_engine_reply_t, void*);
void ac_task_manager_open(const char*, const char*, ac_engine_reply_t, void*);
void ac_battery_saver(const char*, const char*, ac_engine_reply_t, void*);
void ac_memory_trim(const char*, const char*, ac_engine_reply_t, void*);
void ac_cli_control(const char*, const char*, ac_engine_reply_t, void*);
void ac_extensions_watch_actions(const char*, const char*, ac_engine_reply_t, void*);
void ac_extensions_sync_state(const char*, const char*, ac_engine_reply_t, void*);
void ac_extensions_sync_apply(const char*, const char*, ac_engine_reply_t, void*);
}

namespace astro {
namespace {

constexpr auto kCalls = base::MakeFixedFlatMap<std::string_view, ac_engine_call_t>({
    {"ac_battery_saver", &ac_battery_saver},
    {"ac_bookmarks_apply", &ac_bookmarks_apply},
    {"ac_bookmarks_tree", &ac_bookmarks_tree},
    {"ac_bookmarks_watch", &ac_bookmarks_watch},
    {"ac_cli_control", &ac_cli_control},
    {"ac_extensions_sync_apply", &ac_extensions_sync_apply},
    {"ac_extensions_sync_state", &ac_extensions_sync_state},
    {"ac_extensions_watch_actions", &ac_extensions_watch_actions},
    {"ac_favicons_get", &ac_favicons_get},
    {"ac_favicons_set", &ac_favicons_set},
    {"ac_history_add", &ac_history_add},
    {"ac_history_delete_urls", &ac_history_delete_urls},
    {"ac_history_import", &ac_history_import},
    {"ac_history_query", &ac_history_query},
    {"ac_history_watch", &ac_history_watch},
    {"ac_memory_trim", &ac_memory_trim},
    {"ac_omnibox_opened", &ac_omnibox_opened},
    {"ac_task_manager_open", &ac_task_manager_open},
});

constexpr char kEventListener[] = "astro-engine-event";

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

class EngineWebUIHandler : public content::WebUIMessageHandler {
 public:
  explicit EngineWebUIHandler(Profile* profile) : profile_(profile) {
    Handlers().insert(this);
    static const bool installed = [] {
      ac_engine_set_event_sink(&Dispatched, nullptr);
      return true;
    }();
    (void)installed;
  }

  ~EngineWebUIHandler() override { Handlers().erase(this); }

  void RegisterMessages() override {
    web_ui()->RegisterMessageCallback(
        "astroEngineCall", base::BindRepeating(&EngineWebUIHandler::HandleCall,
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

 private:
  void HandleCall(const base::ListValue& args) {
    AllowJavascript();
    if (args.size() != 3 || !args[1].is_string()) {
      return;
    }
    const base::Value& callback_id = args[0];
    const auto call = kCalls.find(args[1].GetString());
    if (call == kCalls.end()) {
      return Reply(callback_id, R"({"error":"not an engine call"})");
    }
    if (profile_->IsOffTheRecord()) {
      return Reply(callback_id,
                   R"({"error":"no engine data for a private profile"})");
    }
    const std::string args_json =
        args[2].is_string() ? args[2].GetString() : std::string("{}");
    auto* pending = new PendingReply{weak_factory_.GetWeakPtr(),
                                     callback_id.Clone()};
    call->second(profile_->GetPath().AsUTF8Unsafe().c_str(), args_json.c_str(),
                 &Replied, pending);
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
