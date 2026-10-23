// Copyright 2026 Oxy. Apache-2.0.

#include "chrome/browser/astro/ac_cli_token_policy.h"

#include <algorithm>
#include <map>
#include <optional>
#include <set>
#include <string>
#include <string_view>
#include <utility>
#include <vector>

#include "astro/core/ac_hooks.h"  // nogncheck
#include "base/json/json_reader.h"
#include "base/json/json_writer.h"
#include "base/memory/raw_ptr.h"
#include "base/memory/scoped_refptr.h"
#include "base/no_destructor.h"
#include "base/strings/strcat.h"
#include "base/strings/string_number_conversions.h"
#include "base/strings/string_split.h"
#include "base/strings/string_util.h"
#include "base/values.h"
#include "chrome/browser/ui/browser_window/public/browser_window_interface.h"
#include "chrome/browser/ui/browser_window/public/global_browser_collection.h"
#include "content/public/browser/child_process_security_policy.h"
#include "content/public/browser/devtools_agent_host.h"
#include "content/public/browser/devtools_agent_host_client.h"
#include "content/public/browser/render_frame_host.h"
#include "content/public/browser/render_process_host.h"
#include "content/public/browser/security_principal.h"
#include "content/public/browser/site_instance.h"
#include "content/public/browser/web_contents.h"
#include "content/public/common/url_constants.h"
#include "extensions/browser/process_map.h"
#include "url/gurl.h"
#include "url/origin.h"
#include "url/scheme_host_port.h"
#include "url/url_constants.h"

namespace astro {
namespace {

constexpr int kMethodNotAllowed = -32601;
constexpr int kInvalidRequest = -32600;
constexpr int kParseError = -32700;
constexpr int kRefused = -32000;
constexpr size_t kMaxPending = 4096;

const std::set<std::string_view>& AllowedMethods() {
  static const base::NoDestructor<std::set<std::string_view>> methods({
      "Accessibility.disable",
      "Accessibility.enable",
      "Accessibility.getChildAXNodes",
      "Accessibility.getFullAXTree",
      "Accessibility.getPartialAXTree",
      "Accessibility.queryAXTree",
      "Browser.getVersion",
      "DOM.describeNode",
      "DOM.disable",
      "DOM.enable",
      "DOM.focus",
      "DOM.getAttributes",
      "DOM.getBoxModel",
      "DOM.getContentQuads",
      "DOM.getDocument",
      "DOM.getFrameOwner",
      "DOM.getNodeForLocation",
      "DOM.getOuterHTML",
      "DOM.querySelector",
      "DOM.querySelectorAll",
      "DOM.requestChildNodes",
      "DOM.requestNode",
      "DOM.resolveNode",
      "DOM.scrollIntoViewIfNeeded",
      "Input.dispatchKeyEvent",
      "Input.dispatchMouseEvent",
      "Input.dispatchTouchEvent",
      "Input.insertText",
      "Network.disable",
      "Network.enable",
      "Network.getCertificate",
      "Network.getRequestPostData",
      "Network.getResponseBody",
      "Network.getSecurityIsolationStatus",
      "Network.searchInResponseBody",
      "Network.streamResourceContent",
      "Page.addScriptToEvaluateOnNewDocument",
      "Page.bringToFront",
      "Page.captureScreenshot",
      "Page.close",
      "Page.createIsolatedWorld",
      "Page.disable",
      "Page.enable",
      "Page.getFrameTree",
      "Page.getLayoutMetrics",
      "Page.getNavigationHistory",
      "Page.handleJavaScriptDialog",
      "Page.navigate",
      "Page.printToPDF",
      "Page.reload",
      "Page.removeScriptToEvaluateOnNewDocument",
      "Page.setLifecycleEventsEnabled",
      "Page.stopLoading",
      "Runtime.awaitPromise",
      "Runtime.callFunctionOn",
      "Runtime.disable",
      "Runtime.enable",
      "Runtime.evaluate",
      "Runtime.getProperties",
      "Runtime.releaseObject",
      "Runtime.releaseObjectGroup",
      "Runtime.runIfWaitingForDebugger",
      "Target.activateTarget",
      "Target.attachToTarget",
      "Target.closeTarget",
      "Target.createTarget",
      "Target.detachFromTarget",
      "Target.getTargetInfo",
      "Target.getTargets",
      "Target.setAutoAttach",
      "Target.setDiscoverTargets",
  });
  return *methods;
}

bool NeedsResponse(const std::string& method, const base::DictValue& params) {
  if (method == "Target.getTargets" || method == "Target.getTargetInfo" ||
      method == "Page.createIsolatedWorld") {
    return true;
  }
  if (method == "Runtime.evaluate") {
    return !params.Find("contextId") && !params.Find("uniqueContextId");
  }
  if (method == "DOM.resolveNode") {
    return !params.Find("executionContextId");
  }
  return false;
}

const std::set<std::string>& AllowedEditingCommands() {
  static const base::NoDestructor<std::set<std::string>> commands({
      "deletebackward",
      "deleteforward",
      "deletetobeginningofline",
      "deletetoendofline",
      "deletewordbackward",
      "deletewordforward",
      "insertbacktab",
      "insertlinebreak",
      "insertnewline",
      "inserttab",
      "movebackward",
      "movedown",
      "moveforward",
      "moveleft",
      "moveright",
      "movetobeginningofdocument",
      "movetobeginningofline",
      "movetoendofdocument",
      "movetoendofline",
      "moveup",
      "movewordbackward",
      "movewordforward",
      "movewordleft",
      "movewordright",
      "movebackwardandmodifyselection",
      "movedownandmodifyselection",
      "moveforwardandmodifyselection",
      "moveleftandmodifyselection",
      "moverightandmodifyselection",
      "movetobeginningofdocumentandmodifyselection",
      "movetobeginningoflineandmodifyselection",
      "movetoendofdocumentandmodifyselection",
      "movetoendoflineandmodifyselection",
      "moveupandmodifyselection",
      "movewordbackwardandmodifyselection",
      "movewordforwardandmodifyselection",
      "movewordleftandmodifyselection",
      "movewordrightandmodifyselection",
      "redo",
      "selectall",
      "undo",
  });
  return *commands;
}

bool EditingCommandsAllowed(const base::Value* commands) {
  if (!commands) {
    return true;
  }
  if (!commands->is_list()) {
    return false;
  }
  for (const base::Value& command : commands->GetList()) {
    if (!command.is_string() ||
        !AllowedEditingCommands().contains(
            base::ToLowerASCII(command.GetString()))) {
      return false;
    }
  }
  return true;
}

std::string_view ReplySession(std::string_view view) {
  constexpr std::string_view kKey = R"(,"sessionId":")";
  if (view.size() < kKey.size() + 2 || !view.ends_with("\"}")) {
    return std::string_view();
  }
  const size_t end = view.size() - 2;
  const size_t open = view.rfind('"', end - 1);
  if (open == std::string_view::npos || open + 1 < kKey.size() ||
      view.substr(open + 1 - kKey.size(), kKey.size()) != kKey) {
    return std::string_view();
  }
  return view.substr(open + 1, end - open - 1);
}

std::optional<int> ParseResponseId(std::string_view view) {
  constexpr std::string_view kResponse = R"({"id":)";
  if (!view.starts_with(kResponse)) {
    return std::nullopt;
  }
  size_t end = kResponse.size();
  if (end < view.size() && view[end] == '-') {
    ++end;
  }
  while (end < view.size() && base::IsAsciiDigit(view[end])) {
    ++end;
  }
  int id = 0;
  if (end >= view.size() || (view[end] != ',' && view[end] != '}') ||
      !base::StringToInt(view.substr(kResponse.size(), end - kResponse.size()),
                         &id)) {
    return std::nullopt;
  }
  return id;
}

const std::set<std::string_view>& SecretHeaders() {
  static const base::NoDestructor<std::set<std::string_view>> headers({
      "authorization",
      "cookie",
      "cookie2",
      "proxy-authorization",
      "set-cookie",
      "set-cookie2",
  });
  return *headers;
}

const std::set<std::string_view>& SecretFields() {
  static const base::NoDestructor<std::set<std::string_view>> fields({
      "associatedCookies",
      "blockedCookies",
      "exemptedCookies",
      "headersText",
      "requestHeadersText",
  });
  return *fields;
}

bool IsWebOrigin(const url::Origin& origin) {
  const url::SchemeHostPort& tuple = origin.GetTupleOrPrecursorTupleIfOpaque();
  if (!tuple.IsValid()) {
    return origin.opaque();
  }
  return tuple.scheme() == url::kHttpScheme ||
         tuple.scheme() == url::kHttpsScheme;
}

bool IsWebUrl(const GURL& url) {
  if (url.SchemeIsHTTPOrHTTPS()) {
    return true;
  }
  if (url.SchemeIsBlob()) {
    url::Origin origin = url::Origin::Create(url);
    return !origin.opaque() && IsWebOrigin(origin);
  }
  if (url.SchemeIs(url::kDataScheme)) {
    return true;
  }
  return url.IsAboutBlank() || url.IsAboutSrcdoc();
}

bool IsWebDestination(std::string_view spec) {
  if (spec.empty()) {
    return true;
  }
  GURL url(spec);
  return url.is_valid() && IsWebUrl(url) && !url.IsAboutSrcdoc();
}

bool IsPrivilegedContents(content::WebContents* contents) {
  if (!contents) {
    return true;
  }
  BrowserWindowInterface* browser =
      GlobalBrowserCollection::GetInstance()->FindBrowserWithTab(contents);
  if (!browser) {
    return true;
  }
  return g_astro_hidden_from_extensions &&
         g_astro_hidden_from_extensions(browser);
}

bool IsWebProcess(content::RenderProcessHost* process) {
  if (!process) {
    return false;
  }
  const int id = process->GetDeprecatedID();
  if (content::ChildProcessSecurityPolicy::GetInstance()->HasWebUIBindings(
          id)) {
    return false;
  }
  extensions::ProcessMap* extension_processes =
      extensions::ProcessMap::Get(process->GetBrowserContext());
  return extension_processes && !extension_processes->Contains(id);
}

bool IsWebSite(content::RenderFrameHost* frame, bool main_frame) {
  content::SiteInstance* site = frame->GetSiteInstance();
  if (!site) {
    return false;
  }
  const content::SecurityPrincipal& principal = site->GetSecurityPrincipal();
  if (principal.IsWebUI() || principal.IsGuest()) {
    return false;
  }
  if (principal.SchemeIs(url::kHttpScheme) ||
      principal.SchemeIs(url::kHttpsScheme) ||
      principal.SchemeIs(url::kDataScheme)) {
    return true;
  }
  return main_frame && (principal.GetDeprecatedSiteURL().is_empty() ||
                        principal.SchemeIs(content::kChromeErrorScheme));
}

bool IsWebFrame(content::RenderFrameHost* frame) {
  if (!frame ||
      IsPrivilegedContents(content::WebContents::FromRenderFrameHost(frame)) ||
      !IsWebProcess(frame->GetProcess())) {
    return false;
  }
  if (!IsWebOrigin(frame->GetLastCommittedOrigin())) {
    return false;
  }
  const GURL& url = frame->GetLastCommittedURL();
  if (!url.is_empty()) {
    return IsWebUrl(url);
  }
  content::RenderFrameHost* parent = frame->GetParentOrOuterDocument();
  return IsWebSite(frame, !parent) && (!parent || IsWebFrame(parent));
}

content::RenderFrameHost* FrameWithToken(content::WebContents* contents,
                                         const std::string& token) {
  content::RenderFrameHost* found = nullptr;
  contents->ForEachRenderFrameHostWithAction(
      [&](content::RenderFrameHost* frame) {
        if (frame->GetDevToolsFrameToken().ToString() != token) {
          return content::RenderFrameHost::FrameIterationAction::kContinue;
        }
        found = frame;
        return content::RenderFrameHost::FrameIterationAction::kStop;
      });
  return found;
}

bool IsPendingWebFrameHost(content::DevToolsAgentHost* host) {
  if (!host || host->GetType() != content::DevToolsAgentHost::kTypeFrame ||
      !host->GetURL().is_empty()) {
    return false;
  }
  content::WebContents* contents = host->GetWebContents();
  if (IsPrivilegedContents(contents) || !IsWebProcess(host->GetProcessHost())) {
    return false;
  }
  const std::string parent = host->GetParentFrameId();
  return !parent.empty() && IsWebFrame(FrameWithToken(contents, parent));
}

bool IsWebWorkerUrl(const GURL& url) {
  return url.SchemeIsHTTPOrHTTPS() || (url.SchemeIsBlob() && IsWebUrl(url));
}

bool IsWebHost(content::DevToolsAgentHost* host) {
  if (!host) {
    return false;
  }
  const std::string type = host->GetType();
  if (type == content::DevToolsAgentHost::kTypeBrowser) {
    return true;
  }
  const GURL url = host->GetURL();
  if (type == content::DevToolsAgentHost::kTypePage ||
      type == content::DevToolsAgentHost::kTypeTab) {
    content::WebContents* contents = host->GetWebContents();
    return !IsPrivilegedContents(contents) &&
           (url.is_empty() || IsWebUrl(url)) &&
           IsWebFrame(contents->GetPrimaryMainFrame());
  }
  if (type == content::DevToolsAgentHost::kTypeFrame) {
    return !IsPrivilegedContents(host->GetWebContents()) &&
           IsWebWorkerUrl(url);
  }
  if (type == content::DevToolsAgentHost::kTypeDedicatedWorker ||
      type == content::DevToolsAgentHost::kTypeSharedWorker ||
      type == content::DevToolsAgentHost::kTypeServiceWorker) {
    return IsWebWorkerUrl(url);
  }
  return false;
}

bool IsWebTarget(const std::string* target_id) {
  return target_id &&
         IsWebHost(content::DevToolsAgentHost::GetForId(*target_id).get());
}

std::optional<int> ContextOfObjectId(std::string_view object_id) {
  std::vector<std::string_view> parts = base::SplitStringPiece(
      object_id, ".", base::KEEP_WHITESPACE, base::SPLIT_WANT_ALL);
  int64_t isolate = 0;
  int context = 0;
  int64_t serial = 0;
  if (parts.size() != 3 || !base::StringToInt64(parts[0], &isolate) ||
      !base::StringToInt(parts[1], &context) ||
      !base::StringToInt64(parts[2], &serial)) {
    return std::nullopt;
  }
  return context;
}

int ProcessOf(content::DevToolsAgentHost* host) {
  content::RenderProcessHost* process = host ? host->GetProcessHost() : nullptr;
  return process ? process->GetDeprecatedID() : -1;
}

void StripSecrets(base::Value& value) {
  if (base::ListValue* list = value.GetIfList()) {
    for (base::Value& item : *list) {
      StripSecrets(item);
    }
    return;
  }
  base::DictValue* dict = value.GetIfDict();
  if (!dict) {
    return;
  }
  std::vector<std::string> removed;
  for (auto [key, item] : *dict) {
    if (SecretFields().contains(key)) {
      removed.push_back(key);
      continue;
    }
    if ((key == "headers" || key == "requestHeaders") && item.is_dict()) {
      std::vector<std::string> secret;
      for (auto [name, header] : item.GetDict()) {
        if (SecretHeaders().contains(base::ToLowerASCII(name))) {
          secret.push_back(name);
        }
      }
      for (const std::string& name : secret) {
        item.GetDict().Remove(name);
      }
      continue;
    }
    StripSecrets(item);
  }
  for (const std::string& key : removed) {
    dict->Remove(key);
  }
}

std::string ErrorReply(int id,
                       const std::string& session,
                       int code,
                       const std::string& message) {
  base::DictValue error;
  error.Set("code", code);
  error.Set("message", message);
  base::DictValue reply;
  reply.Set("id", id);
  if (!session.empty()) {
    reply.Set("sessionId", session);
  }
  reply.Set("error", std::move(error));
  return base::WriteJson(reply).value_or("{}");
}

class TokenClient;

std::map<content::DevToolsAgentHostClient*, TokenClient*>& Registry() {
  static base::NoDestructor<std::map<content::DevToolsAgentHostClient*, TokenClient*>>
      registry;
  return *registry;
}

class TokenClient : public AstroDevToolsTokenClient {
 public:
  TokenClient(content::DevToolsAgentHostClient* client,
              content::DevToolsAgentHost* host)
      : client_(client), root_host_(host) {
    Registry()[client_] = this;
  }
  ~TokenClient() override { Registry().erase(client_); }

  bool FilterCommand(std::string& message, std::string* reply) override {
    std::optional<base::Value> parsed =
        base::JSONReader::Read(message, base::JSON_PARSE_RFC);
    if (!parsed || !parsed->is_dict()) {
      *reply = ErrorReply(0, std::string(), kParseError,
                          "astro: a command must be a JSON object");
      return false;
    }
    base::DictValue& command = parsed->GetDict();
    const std::string* session_id = command.FindString("sessionId");
    const std::string session = session_id ? *session_id : std::string();
    std::optional<int> id = command.FindInt("id");
    const std::string* method = command.FindString("method");
    if (!id || !method || (command.Find("sessionId") && !session_id)) {
      *reply = ErrorReply(id.value_or(0), session, kInvalidRequest,
                          "astro: a command needs an id and a method");
      return false;
    }
    for (auto [key, value] : command) {
      if (key != "id" && key != "method" && key != "params" &&
          key != "sessionId") {
        *reply = ErrorReply(*id, session, kInvalidRequest,
                            base::StrCat({"astro: a command can't carry ", key}));
        return false;
      }
    }
    if (session_id && !targets_.contains(session)) {
      *reply = ErrorReply(*id, std::string(), kInvalidRequest,
                          "astro: no attached session has that sessionId");
      return false;
    }
    if (!AllowedMethods().contains(*method)) {
      *reply = ErrorReply(
          *id, session, kMethodNotAllowed,
          base::StrCat({"astro: ", *method,
                        " isn't allowed for the astro command"}));
      return false;
    }
    if (command.Find("params") && !command.FindDict("params")) {
      *reply = ErrorReply(*id, session, kInvalidRequest,
                          "astro: params must be an object");
      return false;
    }
    base::DictValue& params = *command.EnsureDict("params");
    std::string refusal = Refusal(*method, session, params);
    if (!refusal.empty()) {
      *reply = ErrorReply(
          *id, session, kRefused,
          base::StrCat({"astro: ", *method, " ", refusal,
                        " isn't allowed for the astro command"}));
      return false;
    }
    const std::pair<std::string, int> key(session, *id);
    if (outstanding_.contains(key)) {
      *reply = ErrorReply(*id, session, kInvalidRequest,
                          "astro: a command with that id is still waiting for "
                          "its reply");
      return false;
    }
    if (outstanding_.size() >= kMaxPending) {
      *reply = ErrorReply(*id, session, kRefused,
                          "astro: too many commands are waiting for replies; "
                          "closing the connection");
      wedged_ = true;
      return false;
    }
    outstanding_[key] =
        NeedsResponse(*method, params) ? *method : std::string();
    message = base::WriteJson(command).value_or(std::string());
    return !message.empty();
  }

  bool FilterEvent(std::string& message) override {
    std::string_view view(message);
    constexpr std::string_view kEvent = R"({"method":")";
    if (view.starts_with(kEvent)) {
      size_t end = view.find('"', kEvent.size());
      if (end == std::string_view::npos) {
        return false;
      }
      std::string_view method =
          view.substr(kEvent.size(), end - kEvent.size());
      if (method.starts_with("Network.")) {
        return FilterNetworkEvent(method, message);
      }
      if (method.starts_with("Runtime.")) {
        return FilterRuntimeEvent(method, message);
      }
      if (method == "Target.targetCreated" ||
          method == "Target.targetInfoChanged" ||
          method == "Target.attachedToTarget" ||
          method == "Target.detachedFromTarget") {
        return FilterTargetEvent(method, message);
      }
      if (method == "Page.frameNavigated" ||
          method == "Page.documentOpened" ||
          method == "Page.navigatedWithinDocument" ||
          method == "Page.frameRequestedNavigation" ||
          method == "Page.frameScheduledNavigation" ||
          method == "Page.frameStartedNavigating") {
        return FilterPageEvent(message);
      }
      if (method == "Inspector.targetCrashed" ||
          method == "Inspector.detached") {
        ForgetSessionOf(message);
      }
      return method != "Target.receivedMessageFromTarget";
    }
    if (outstanding_.empty()) {
      return true;
    }
    std::optional<int> id = ParseResponseId(view);
    std::string session;
    if (id) {
      session = std::string(ReplySession(view));
    } else {
      std::optional<base::Value> parsed =
          base::JSONReader::Read(message, base::JSON_PARSE_RFC);
      if (!parsed || !parsed->is_dict()) {
        return false;
      }
      id = parsed->GetDict().FindInt("id");
      if (!id) {
        return !parsed->GetDict().Find("id");
      }
      if (const std::string* found = parsed->GetDict().FindString("sessionId")) {
        session = *found;
      }
    }
    auto it = outstanding_.find({session, *id});
    if (it == outstanding_.end()) {
      return true;
    }
    const std::string method = std::move(it->second);
    outstanding_.erase(it);
    if (method.empty()) {
      return true;
    }
    return FilterResponse(*id, method, message);
  }

  bool ShouldClose() const override { return wedged_; }

  bool MayAttachToURL(const GURL& url, bool is_webui) override {
    return !is_webui && IsWebUrl(url);
  }

  bool MayAttachToRenderFrameHost(content::RenderFrameHost* frame) override {
    return IsWebFrame(frame);
  }

 private:
  struct Contexts {
    std::map<int, int> ids;
    std::set<std::string> unique_ids;
  };

  void ForgetSession(const std::string& session) {
    std::erase_if(outstanding_,
                  [&](const auto& entry) { return entry.first.first == session; });
  }

  void ForgetSessionOf(const std::string& message) {
    std::optional<base::Value> parsed =
        base::JSONReader::Read(message, base::JSON_PARSE_RFC);
    if (!parsed || !parsed->is_dict()) {
      return;
    }
    const std::string* session = parsed->GetDict().FindString("sessionId");
    ForgetSession(session ? *session : std::string());
  }

  content::DevToolsAgentHost* HostOf(const std::string& session) {
    if (session.empty()) {
      return root_host_.get();
    }
    auto it = targets_.find(session);
    return it == targets_.end()
               ? nullptr
               : content::DevToolsAgentHost::GetForId(it->second).get();
  }

  int CurrentProcess(const std::string& session) {
    return ProcessOf(HostOf(session));
  }

  void AllowContext(const std::string& session, int context) {
    int process = CurrentProcess(session);
    if (process >= 0) {
      sessions_[session].ids[context] = process;
    }
  }

  bool ContextAllowed(const std::string& session, std::optional<int> context) {
    if (!context) {
      return false;
    }
    auto session_it = sessions_.find(session);
    if (session_it == sessions_.end()) {
      return false;
    }
    auto it = session_it->second.ids.find(*context);
    return it != session_it->second.ids.end() &&
           it->second == CurrentProcess(session);
  }

  bool ObjectAllowed(const std::string& session, const std::string& object_id) {
    return ContextAllowed(session, ContextOfObjectId(object_id));
  }

  bool ObjectIdsAllowed(const std::string& session, const base::Value& value) {
    if (const base::ListValue* list = value.GetIfList()) {
      for (const base::Value& item : *list) {
        if (!ObjectIdsAllowed(session, item)) {
          return false;
        }
      }
      return true;
    }
    const base::DictValue* dict = value.GetIfDict();
    if (!dict) {
      return true;
    }
    for (auto [key, item] : *dict) {
      if (key == "objectId" || key == "promiseObjectId" ||
          key == "prototypeObjectId") {
        if (!item.is_string() || !ObjectAllowed(session, item.GetString())) {
          return false;
        }
        continue;
      }
      if (!ObjectIdsAllowed(session, item)) {
        return false;
      }
    }
    return true;
  }

  std::string Refusal(const std::string& method,
                      const std::string& session,
                      base::DictValue& params) {
    for (const char* key : {"contextId", "executionContextId"}) {
      if (const base::Value* value = params.Find(key)) {
        if (!value->is_int() || !ContextAllowed(session, value->GetInt())) {
          return "in that execution context";
        }
      }
    }
    if (const base::Value* value = params.Find("uniqueContextId")) {
      if (!value->is_string() ||
          !sessions_[session].unique_ids.contains(value->GetString())) {
        return "in that execution context";
      }
    }
    if (method != "Runtime.releaseObject" &&
        !ObjectIdsAllowed(session, base::Value(params.Clone()))) {
      return "on that object";
    }
    if (method == "Target.attachToTarget") {
      if (params.FindBool("flatten") != true) {
        return "without flatten";
      }
      if (!IsWebTarget(params.FindString("targetId"))) {
        return "to that target";
      }
    } else if (method == "Target.setAutoAttach") {
      if (params.FindBool("autoAttach") != false &&
          params.FindBool("flatten") != true) {
        return "without flatten";
      }
    } else if (method == "Target.createTarget") {
      const std::string* url = params.FindString("url");
      if (!url || !IsWebDestination(*url)) {
        return "to that URL";
      }
      if (params.Find("browserContextId")) {
        return "in another browser context";
      }
    } else if (method == "Target.activateTarget" ||
               method == "Target.closeTarget") {
      if (!IsWebTarget(params.FindString("targetId"))) {
        return "on that target";
      }
    } else if (method == "Target.getTargetInfo") {
      if (params.Find("targetId") &&
          !IsWebTarget(params.FindString("targetId"))) {
        return "on that target";
      }
    } else if (method == "Page.navigate") {
      const std::string* url = params.FindString("url");
      if (!url || url->empty() || !IsWebDestination(*url)) {
        return "to that URL";
      }
    } else if (method == "Page.createIsolatedWorld") {
      params.Set("grantUniveralAccess", false);
    } else if (method == "Page.addScriptToEvaluateOnNewDocument") {
      const base::Value* world = params.Find("worldName");
      if (world && !(world->is_string() && world->GetString().empty())) {
        return "in a named world";
      }
    } else if (method == "Page.printToPDF") {
      const std::string* mode = params.FindString("transferMode");
      if (params.Find("transferMode") &&
          (!mode || *mode != "ReturnAsBase64")) {
        return "as a stream";
      }
    } else if (method == "Runtime.evaluate") {
      if (params.FindBool("includeCommandLineAPI").value_or(false)) {
        return "with the command line API";
      }
    } else if (method == "Input.dispatchKeyEvent") {
      if (!EditingCommandsAllowed(params.Find("commands"))) {
        return "with those editing commands";
      }
      params.Remove("nativeVirtualKeyCode");
      params.Remove("isSystemKey");
    }
    return std::string();
  }

  void LearnDefaultContext(const std::string& session,
                           const base::DictValue* remote_object) {
    const std::string* object_id =
        remote_object ? remote_object->FindString("objectId") : nullptr;
    if (std::optional<int> context =
            object_id ? ContextOfObjectId(*object_id) : std::nullopt) {
      AllowContext(session, *context);
    }
  }

  bool FilterResponse(int id, const std::string& method, std::string& message) {
    std::optional<base::Value> parsed =
        base::JSONReader::Read(message, base::JSON_PARSE_RFC);
    if (!parsed || !parsed->is_dict()) {
      return false;
    }
    base::DictValue& response = parsed->GetDict();
    const std::string* session_id = response.FindString("sessionId");
    const std::string session = session_id ? *session_id : std::string();
    base::DictValue* result = response.FindDict("result");
    if (!result) {
      return true;
    }
    if (method == "Target.getTargets") {
      if (base::ListValue* infos = result->FindList("targetInfos")) {
        infos->EraseIf([](const base::Value& info) {
          return !info.is_dict() ||
                 !IsWebTarget(info.GetDict().FindString("targetId"));
        });
        message = base::WriteJson(response).value_or(std::string());
      }
      return !message.empty();
    }
    if (method == "Target.getTargetInfo") {
      const base::DictValue* info = result->FindDict("targetInfo");
      if (info && !IsWebTarget(info->FindString("targetId"))) {
        message = ErrorReply(id, session, kRefused,
                             "astro: Target.getTargetInfo on that target "
                             "isn't allowed for the astro command");
      }
      return true;
    }
    if (method == "Page.createIsolatedWorld") {
      if (std::optional<int> context =
              result->FindInt("executionContextId")) {
        AllowContext(session, *context);
      }
      return true;
    }
    if (method == "Runtime.evaluate") {
      LearnDefaultContext(session, result->FindDict("result"));
    } else if (method == "DOM.resolveNode") {
      LearnDefaultContext(session, result->FindDict("object"));
    }
    return true;
  }

  bool FilterNetworkEvent(std::string_view method, std::string& message) {
    if (method.ends_with("ExtraInfo") ||
        method == "Network.responseReceivedEarlyHints" ||
        method == "Network.requestIntercepted") {
      return false;
    }
    std::optional<base::Value> parsed =
        base::JSONReader::Read(message, base::JSON_PARSE_RFC);
    if (!parsed) {
      return false;
    }
    StripSecrets(*parsed);
    message = base::WriteJson(*parsed).value_or(std::string());
    return !message.empty();
  }

  bool FilterRuntimeEvent(std::string_view method, std::string& message) {
    std::optional<base::Value> parsed =
        base::JSONReader::Read(message, base::JSON_PARSE_RFC);
    if (!parsed || !parsed->is_dict()) {
      return false;
    }
    const base::DictValue& event = parsed->GetDict();
    const std::string* session_id = event.FindString("sessionId");
    const std::string session = session_id ? *session_id : std::string();
    const base::DictValue* params = event.FindDict("params");
    if (!params) {
      return false;
    }
    if (method == "Runtime.executionContextCreated") {
      const base::DictValue* context = params->FindDict("context");
      std::optional<int> context_id =
          context ? context->FindInt("id") : std::nullopt;
      if (!context_id) {
        return false;
      }
      const base::DictValue* aux = context->FindDict("auxData");
      if (aux && aux->FindBool("isDefault") != true) {
        return false;
      }
      AllowContext(session, *context_id);
      if (const std::string* unique = context->FindString("uniqueId")) {
        sessions_[session].unique_ids.insert(*unique);
      }
      return true;
    }
    if (method == "Runtime.executionContextDestroyed") {
      std::optional<int> context_id = params->FindInt("executionContextId");
      if (!ContextAllowed(session, context_id)) {
        return false;
      }
      sessions_[session].ids.erase(*context_id);
      if (const std::string* unique =
              params->FindString("executionContextUniqueId")) {
        sessions_[session].unique_ids.erase(*unique);
      }
      return true;
    }
    if (method == "Runtime.executionContextsCleared") {
      sessions_.erase(session);
      return true;
    }
    if (method == "Runtime.exceptionThrown") {
      const base::DictValue* details = params->FindDict("exceptionDetails");
      return details &&
             ContextAllowed(session, details->FindInt("executionContextId"));
    }
    if (method == "Runtime.consoleAPICalled" ||
        method == "Runtime.inspectRequested" ||
        method == "Runtime.bindingCalled") {
      return ContextAllowed(session, params->FindInt("executionContextId"));
    }
    return true;
  }

  bool FilterTargetEvent(std::string_view method, const std::string& message) {
    std::optional<base::Value> parsed =
        base::JSONReader::Read(message, base::JSON_PARSE_RFC);
    if (!parsed || !parsed->is_dict()) {
      return false;
    }
    const base::DictValue* params = parsed->GetDict().FindDict("params");
    if (method == "Target.detachedFromTarget") {
      if (const std::string* child =
              params ? params->FindString("sessionId") : nullptr) {
        targets_.erase(*child);
        sessions_.erase(*child);
        ForgetSession(*child);
      }
      return true;
    }
    const base::DictValue* info =
        params ? params->FindDict("targetInfo") : nullptr;
    const std::string* target_id = info ? info->FindString("targetId") : nullptr;
    if (method == "Target.attachedToTarget") {
      const std::string* child =
          params ? params->FindString("sessionId") : nullptr;
      if (!target_id || !child) {
        return false;
      }
      targets_[*child] = *target_id;
      return true;
    }
    return IsWebTarget(target_id);
  }

  bool FilterPageEvent(const std::string& message) {
    std::optional<base::Value> parsed =
        base::JSONReader::Read(message, base::JSON_PARSE_RFC);
    if (!parsed || !parsed->is_dict()) {
      return false;
    }
    const base::DictValue* params = parsed->GetDict().FindDict("params");
    if (!params) {
      return false;
    }
    const base::DictValue* frame = params->FindDict("frame");
    const std::string* url =
        frame ? frame->FindString("url") : params->FindString("url");
    return !url || url->empty() || IsWebUrl(GURL(*url));
  }

  const raw_ptr<content::DevToolsAgentHostClient> client_;
  const scoped_refptr<content::DevToolsAgentHost> root_host_;
  std::map<std::string, std::string> targets_;
  std::map<std::string, Contexts> sessions_;
  std::map<std::pair<std::string, int>, std::string> outstanding_;
  bool wedged_ = false;
};

}

std::unique_ptr<AstroDevToolsTokenClient> CreateTokenClient(
    content::DevToolsAgentHostClient* client,
    content::DevToolsAgentHost* host) {
  return std::make_unique<TokenClient>(client, host);
}

bool TokenClientMayAttach(content::DevToolsAgentHostClient* root_client,
                          content::DevToolsAgentHost* host) {
  return !Registry().contains(root_client) || IsWebHost(host) ||
         IsPendingWebFrameHost(host);
}

bool TokenClientMayInput(content::DevToolsAgentHostClient* root_client,
                         content::RenderFrameHost* frame) {
  return !Registry().contains(root_client) || IsWebFrame(frame);
}

}
