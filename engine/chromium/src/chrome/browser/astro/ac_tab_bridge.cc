// Copyright 2026 Oxy. Apache-2.0.

#include "chrome/browser/astro/ac_tab_bridge.h"

#include <cmath>
#include <optional>
#include <string>
#include <utility>

#include "base/json/json_writer.h"
#include "base/task/single_thread_task_runner.h"
#include "base/time/time.h"
#include "base/json/json_reader.h"
#include "base/strings/string_number_conversions.h"
#include "base/strings/utf_string_conversions.h"
#include "chrome/browser/astro/ac_extension_views.h"
#include "chrome/browser/astro/ac_host.h"
#include "chrome/browser/astro/ac_profile_tabs.h"
#include "chrome/browser/content_settings/host_content_settings_map_factory.h"
#include "chrome/browser/devtools/devtools_window.h"
#include "chrome/browser/printing/print_view_manager_common.h"
#include "chrome/browser/profiles/profile.h"
#include "chrome/browser/ui/browser_tabstrip.h"
#include "chrome/browser/ui/browser_window/public/browser_window_interface.h"
#include "components/sessions/content/session_tab_helper.h"
#include "components/tabs/public/tab_interface.h"
#include "base/base64.h"
#include "base/strings/stringprintf.h"
#include "chrome/browser/extensions/extension_action_runner.h"
#include "extensions/browser/extension_action.h"
#include "extensions/browser/extension_action_manager.h"
#include "extensions/browser/extension_registry.h"
#include "chrome/browser/extensions/api/side_panel/side_panel_service.h"
#include "ui/gfx/codec/png_codec.h"
#include "ui/gfx/image/image.h"
#include "ui/gfx/image/image_skia.h"
#include "ui/gfx/image/image_skia_rep.h"
#include "chrome/common/chrome_isolated_world_ids.h"
#include "chrome/common/pref_names.h"
#include "components/content_settings/core/browser/host_content_settings_map.h"
#include "components/find_in_page/find_types.h"
#include "base/strings/string_number_conversions.h"
#include "components/prefs/pref_service.h"
#include "components/zoom/page_zoom.h"
#include "content/public/browser/navigation_controller.h"
#include "content/public/browser/navigation_entry.h"
#include "content/public/browser/navigation_handle.h"
#include "content/public/browser/render_frame_host.h"
#include "content/public/browser/ssl_status.h"
#include "content/public/browser/web_contents.h"
#include "net/base/net_errors.h"
#include "net/cert/cert_status_flags.h"
#include "net/cert/x509_certificate.h"
#include "net/ssl/ssl_connection_status_flags.h"
#include "third_party/blink/public/common/page/page_zoom.h"
#include "ui/base/page_transition_types.h"
#include "url/gurl.h"

namespace astro {
namespace {

constexpr net::CertStatus kCertErrorMask =
    net::CERT_STATUS_ALL_ERRORS & ~(net::CERT_STATUS_NO_REVOCATION_MECHANISM |
                                    net::CERT_STATUS_UNABLE_TO_CHECK_REVOCATION);

std::string Hex(base::span<const uint8_t> bytes) {
  std::string out;
  for (uint8_t byte : bytes) {
    if (!out.empty()) {
      out += ':';
    }
    out += base::HexEncode(base::span_from_ref(byte));
  }
  return out;
}

base::DictValue Principal(const net::CertPrincipal& principal) {
  base::ListValue organizations;
  for (const std::string& name : principal.organization_names) {
    organizations.Append(name);
  }
  return base::DictValue()
      .Set("commonName", principal.common_name)
      .Set("displayName", principal.GetDisplayName())
      .Set("organizations", std::move(organizations))
      .Set("country", principal.country_name);
}

base::ListValue CertErrorNames(net::CertStatus status) {
  static const std::pair<net::CertStatus, const char*> kErrors[] = {
      {net::CERT_STATUS_COMMON_NAME_INVALID, "nameMismatch"},
      {net::CERT_STATUS_DATE_INVALID, "dateInvalid"},
      {net::CERT_STATUS_AUTHORITY_INVALID, "authorityInvalid"},
      {net::CERT_STATUS_REVOKED, "revoked"},
      {net::CERT_STATUS_INVALID, "invalid"},
      {net::CERT_STATUS_WEAK_SIGNATURE_ALGORITHM, "weakSignature"},
      {net::CERT_STATUS_NON_UNIQUE_NAME, "nonUniqueName"},
      {net::CERT_STATUS_WEAK_KEY, "weakKey"},
      {net::CERT_STATUS_PINNED_KEY_MISSING, "pinnedKeyMissing"},
      {net::CERT_STATUS_NAME_CONSTRAINT_VIOLATION, "nameConstraint"},
      {net::CERT_STATUS_VALIDITY_TOO_LONG, "validityTooLong"},
      {net::CERT_STATUS_CERTIFICATE_TRANSPARENCY_REQUIRED,
       "certificateTransparency"},
  };
  base::ListValue names;
  for (const auto& [bit, name] : kErrors) {
    if (status & bit) {
      names.Append(name);
    }
  }
  return names;
}

std::optional<base::DictValue> CertificateInfo(
    const net::X509Certificate* cert) {
  if (!cert) {
    return std::nullopt;
  }
  const net::SHA256HashValue sha256 =
      net::X509Certificate::CalculateFingerprint256(cert->cert_buffer());
  return base::DictValue()
      .Set("subject", Principal(cert->subject()))
      .Set("issuer", Principal(cert->issuer()))
      .Set("validFrom", cert->valid_start().InMillisecondsFSinceUnixEpoch())
      .Set("validUntil", cert->valid_expiry().InMillisecondsFSinceUnixEpoch())
      .Set("chainLength",
           static_cast<int>(cert->intermediate_buffers().size() + 1))
      .Set("serialNumber",
           Hex(base::as_byte_span(cert->serial_number())))
      .Set("sha256", Hex(sha256));
}

std::optional<std::string> TLSVersion(int connection_status) {
  switch (net::SSLConnectionStatusToVersion(connection_status)) {
    case net::SSL_CONNECTION_VERSION_TLS1:
      return "TLS 1.0";
    case net::SSL_CONNECTION_VERSION_TLS1_1:
      return "TLS 1.1";
    case net::SSL_CONNECTION_VERSION_TLS1_2:
      return "TLS 1.2";
    case net::SSL_CONNECTION_VERSION_TLS1_3:
      return "TLS 1.3";
    case net::SSL_CONNECTION_VERSION_QUIC:
      return "QUIC";
    default:
      return std::nullopt;
  }
}

base::Value OriginOf(const GURL& url) {
  if (!url.SchemeIsHTTPOrHTTPS() || url.host().empty()) {
    return base::Value();
  }
  std::string origin = std::string(url.scheme()) + "://" +
                       std::string(url.host());
  if (url.has_port()) {
    origin += ":" + std::string(url.port());
  }
  return base::Value(origin);
}

base::Value HexColor(SkColor color) {
  if (!SkColorGetA(color)) {
    return base::Value();
  }
  return base::Value(base::StringPrintf("#%02x%02x%02x", SkColorGetR(color),
                                        SkColorGetG(color), SkColorGetB(color)));
}

std::string PngDataURL(const gfx::Image& image) {
  if (image.IsEmpty()) {
    return std::string();
  }
  const gfx::ImageSkiaRep& rep = image.ToImageSkia()->GetRepresentation(2.0f);
  std::optional<std::vector<uint8_t>> png =
      gfx::PNGCodec::EncodeBGRASkBitmap(rep.GetBitmap(), false);
  return png ? "data:image/png;base64," + base::Base64Encode(*png)
             : std::string();
}

const extensions::Extension* EnabledExtension(content::WebContents* contents,
                                              const std::string* id) {
  return id ? extensions::ExtensionRegistry::Get(contents->GetBrowserContext())
                  ->enabled_extensions()
                  .GetByID(*id)
            : nullptr;
}

const char* TerminationName(base::TerminationStatus status) {
  switch (status) {
    case base::TERMINATION_STATUS_ABNORMAL_TERMINATION:
      return "abnormal";
    case base::TERMINATION_STATUS_PROCESS_WAS_KILLED:
      return "killed";
    case base::TERMINATION_STATUS_PROCESS_CRASHED:
      return "crashed";
    case base::TERMINATION_STATUS_OOM:
      return "oom";
    case base::TERMINATION_STATUS_LAUNCH_FAILED:
      return "launchFailed";
    default:
      return "unknown";
  }
}

}

base::DictValue SecurityInfo(content::WebContents* contents) {
  if (!contents) {
    return base::DictValue().Set("level", "none");
  }
  content::NavigationEntry* entry =
      contents->GetController().GetVisibleEntry();
  const GURL url = entry ? entry->GetURL() : contents->GetVisibleURL();
  base::DictValue info =
      base::DictValue().Set("url", url.spec()).Set("origin", OriginOf(url));
  if (url.SchemeIs("http") || url.SchemeIs("ws")) {
    info.Set("level", "insecure");
    return info;
  }
  if (!url.SchemeIs("https") && !url.SchemeIs("wss")) {
    info.Set("level",
             !url.is_empty() && url != GURL("about:blank") ? "local" : "none");
    return info;
  }
  if (!entry) {
    info.Set("level", "none");
    return info;
  }
  const content::SSLStatus& ssl = entry->GetSSL();
  const net::CertStatus errors = ssl.cert_status & kCertErrorMask;
  const int content = ssl.content_status;
  const int ran = content::SSLStatus::RAN_INSECURE_CONTENT |
                  content::SSLStatus::RAN_CONTENT_WITH_CERT_ERRORS;
  const int displayed = content::SSLStatus::DISPLAYED_INSECURE_CONTENT |
                        content::SSLStatus::DISPLAYED_CONTENT_WITH_CERT_ERRORS;
  const char* level = "secure";
  if (errors || !ssl.certificate) {
    level = "certificateError";
  } else if (content & (ran | displayed)) {
    level = "mixed";
  }
  info.Set("level", level);
  info.Set("certificateErrors", CertErrorNames(errors));
  info.Set("mixedContent", (content & ran)         ? base::Value("ran")
                           : (content & displayed) ? base::Value("displayed")
                                                   : base::Value());
  info.Set("isEV", (ssl.cert_status & net::CERT_STATUS_IS_EV) != 0);
  if (std::optional<std::string> tls = TLSVersion(ssl.connection_status)) {
    info.Set("protocol", *tls);
  }
  if (std::optional<base::DictValue> cert =
          CertificateInfo(ssl.certificate.get())) {
    info.Set("certificate", std::move(*cert));
  }
  return info;
}

TabBridge::TabBridge(content::WebContents* contents, Emit emit)
    : content::WebContentsObserver(contents), emit_(std::move(emit)) {
  ObserveHelpers();
  security_ = SecurityInfo(contents);
}

TabBridge::~TabBridge() {
  if (agent_) {
    agent_->DetachClient(this);
  }
}

base::DictValue TabBridge::Snapshot() {
  content::WebContents* contents = web_contents();
  if (!contents) {
    return base::DictValue();
  }
  content::NavigationController& controller = contents->GetController();
  base::DictValue snapshot =
      base::DictValue()
          .Set("media", Media())
          .Set("zoom", Zoom())
          .Set("security", SecurityInfo(contents))
          .Set("themeColor", ThemeColor(contents))
          .Set("navigation",
               base::DictValue()
                   .Set("url", contents->GetVisibleURL().spec())
                   .Set("title", contents->GetTitle())
                   .Set("isLoading", contents->IsLoading())
                   .Set("canGoBack", controller.CanGoBack())
                   .Set("canGoForward", controller.CanGoForward()));
  if (std::optional<std::pair<int, int>> size = ExtensionPopupSize(contents)) {
    snapshot.Set("preferredSize", base::DictValue()
                                      .Set("width", size->first)
                                      .Set("height", size->second));
  }
  return snapshot;
}

base::DictValue TabBridge::Media() {
  content::WebContents* contents = web_contents();
  return base::DictValue()
      .Set("playing", contents && contents->IsCurrentlyAudible())
      .Set("muted", contents && contents->IsAudioMuted());
}

base::DictValue TabBridge::Zoom() {
  content::WebContents* contents = web_contents();
  const double zoom =
      contents ? blink::ZoomLevelToZoomFactor(
                     zoom::ZoomController::GetZoomLevelForWebContents(contents))
               : 1;
  return base::DictValue()
      .Set("zoom", std::round(zoom * 100) / 100)
      .Set("host", contents ? std::string(contents->GetVisibleURL().host())
                            : std::string())
      .Set("isDefault", std::fabs(zoom - 1) < 0.001)
      .Set("pinchScale", 1);
}

void TabBridge::ObserveHelpers() {
  content::WebContents* contents = web_contents();
  if (!contents) {
    return;
  }
  if (!zoom_.IsObserving()) {
    if (auto* zoom = zoom::ZoomController::FromWebContents(contents)) {
      zoom_.Observe(zoom);
    }
  }
  if (!find_.IsObserving()) {
    if (auto* find = find_in_page::FindTabHelper::FromWebContents(contents)) {
      find_.Observe(find);
    }
  }
  if (!popups_.IsObserving()) {
    if (auto* popups =
            blocked_content::PopupBlockerTabHelper::FromWebContents(contents)) {
      popups_.Observe(popups->manager());
    }
  }
}

void TabBridge::CheckSecurity() {
  base::DictValue info = SecurityInfo(web_contents());
  if (info == security_) {
    return;
  }
  security_ = info.Clone();
  emit_.Run("security", std::move(info));
}

void TabBridge::Call(const std::string& method,
                     const base::DictValue& args,
                     base::OnceCallback<void(base::Value)> done) {
  content::WebContents* contents = web_contents();
  if (!contents) {
    return std::move(done).Run(base::Value());
  }
  ObserveHelpers();
  content::NavigationController& controller = contents->GetController();
  if (method == "find") {
    const std::string* text = args.FindString("text");
    if (auto* find = find_in_page::FindTabHelper::FromWebContents(contents);
        find && text) {
      find->StartFinding(base::UTF8ToUTF16(*text),
                         args.FindBool("forward").value_or(true), false, true);
    }
  } else if (method == "stopFinding") {
    if (auto* find = find_in_page::FindTabHelper::FromWebContents(contents)) {
      find->StopFinding(args.FindBool("clearSelection").value_or(false)
                            ? find_in_page::SelectionAction::kClear
                            : find_in_page::SelectionAction::kKeep);
    }
  } else if (method == "zoomStep") {
    const int direction = args.FindInt("direction").value_or(0);
    zoom::PageZoom::Zoom(contents, direction > 0   ? content::PAGE_ZOOM_IN
                                   : direction < 0 ? content::PAGE_ZOOM_OUT
                                                   : content::PAGE_ZOOM_RESET);
  } else if (method == "setMuted") {
    contents->SetAudioMuted(args.FindBool("muted").value_or(false));
  } else if (method == "goToOffset") {
    const int offset = args.FindInt("offset").value_or(0);
    if (controller.CanGoToOffset(offset)) {
      controller.GoToOffset(offset);
    }
  } else if (method == "navigate") {
    const std::string* url = args.FindString("url");
    if (url && GURL(*url).is_valid()) {
      content::NavigationController::LoadURLParams params((GURL(*url)));
      params.transition_type = ui::PageTransitionFromInt(
          ui::PAGE_TRANSITION_TYPED | ui::PAGE_TRANSITION_FROM_ADDRESS_BAR);
      params.should_replace_current_entry =
          args.FindBool("replace").value_or(false);
      controller.LoadURLWithParams(params);
    }
  } else if (method == "forceReload") {
    controller.Reload(content::ReloadType::BYPASSING_CACHE, true);
  } else if (method == "navigationEntries") {
    base::ListValue entries;
    const int current = controller.GetCurrentEntryIndex();
    for (int i = 0; i < controller.GetEntryCount(); ++i) {
      content::NavigationEntry* entry = controller.GetEntryAtIndex(i);
      entries.Append(base::DictValue()
                         .Set("url", entry->GetURL().spec())
                         .Set("title", entry->GetTitle())
                         .Set("current", i == current));
    }
    return std::move(done).Run(base::Value(std::move(entries)));
  } else if (method == "print" || method == "systemPrint") {
    printing::StartBasicPrint(contents);
  } else if (method == "savePage") {
    contents->OnSavePage();
  } else if (method == "caretBrowsing") {
    PrefService* prefs =
        Profile::FromBrowserContext(contents->GetBrowserContext())->GetPrefs();
    prefs->SetBoolean(prefs::kCaretBrowsingEnabled,
                      !prefs->GetBoolean(prefs::kCaretBrowsingEnabled));
  } else if (method == "showDevTools") {
    const std::string* panel = args.FindString("panel");
    DevToolsToggleAction action = DevToolsToggleAction::Show();
    if (panel && *panel == "console") {
      action = DevToolsToggleAction::ShowConsolePanel();
    } else if (panel && *panel == "elements") {
      action = DevToolsToggleAction::ShowElementsPanel();
    }
    DevToolsWindow::OpenDevToolsWindow(contents, action,
                                       DevToolsOpenedByAction::kUnknown);
  } else if (method == "evaluate" || method == "executeJavaScript") {
    const std::string* code = args.FindString("code");
    if (!code) {
      return std::move(done).Run(base::Value());
    }
    if (method == "evaluate") {
      return Evaluate(*code, std::move(done));
    }
    contents->GetPrimaryMainFrame()->ExecuteJavaScriptInIsolatedWorld(
        base::UTF8ToUTF16(*code), std::move(done),
        ISOLATED_WORLD_ID_CHROME_INTERNAL);
    return;
  } else if (method == "executeExtensionAction") {
    const extensions::Extension* extension =
        EnabledExtension(contents, args.FindString("id"));
    auto* runner =
        extensions::ExtensionActionRunner::GetForWebContents(contents);
    const char* result = "none";
    if (extension && runner) {
      switch (runner->RunAction(extension, true)) {
        case extensions::ExtensionAction::ShowAction::kShowPopup:
          result = "popup";
          break;
        case extensions::ExtensionAction::ShowAction::kToggleSidePanel:
          result = "sidePanel";
          break;
        case extensions::ExtensionAction::ShowAction::kNone:
          break;
      }
    }
    return std::move(done).Run(base::Value(result));
  } else if (method == "actionStates") {
    base::DictValue states;
    const int tab_id = sessions::SessionTabHelper::IdForTab(contents).id();
    if (const base::ListValue* ids = args.FindList("ids")) {
      for (const base::Value& id : *ids) {
        const extensions::Extension* extension =
            id.is_string() ? EnabledExtension(contents, &id.GetString())
                           : nullptr;
        extensions::ExtensionAction* action =
            extension ? extensions::ExtensionActionManager::Get(
                            contents->GetBrowserContext())
                            ->GetExtensionAction(*extension)
                      : nullptr;
        if (!action) {
          continue;
        }
        gfx::Image icon = action->GetExplicitlySetIcon(tab_id);
        if (icon.IsEmpty()) {
          icon = action->GetDeclarativeIcon(tab_id);
        }
        const std::string badge = action->GetDisplayBadgeText(tab_id);
        states.Set(id.GetString(),
                   base::DictValue()
                       .Set("title", action->GetTitle(tab_id))
                       .Set("badgeText", badge.starts_with("<<") ? "" : badge)
                       .Set("badgeColor",
                            HexColor(action->GetBadgeBackgroundColor(tab_id)))
                       .Set("badgeTextColor",
                            HexColor(action->GetBadgeTextColor(tab_id)))
                       .Set("popup", action->GetPopupUrl(tab_id).spec())
                       .Set("enabled", action->GetIsVisible(tab_id))
                       .Set("icon", PngDataURL(icon)));
      }
    }
    return std::move(done).Run(base::Value(std::move(states)));
  } else if (method == "sidePanelURL") {
    const extensions::Extension* extension =
        EnabledExtension(contents, args.FindString("id"));
    auto* service = extension ? extensions::SidePanelService::Get(
                                    contents->GetBrowserContext())
                              : nullptr;
    if (service) {
      auto options = service->GetOptions(
          *extension, sessions::SessionTabHelper::IdForTab(contents).id());
      if (options.path && options.enabled.value_or(false)) {
        return std::move(done).Run(
            base::Value(extension->GetResourceURL(*options.path).spec()));
      }
    }
    return std::move(done).Run(base::Value());
  } else if (method == "openBlockedPopup") {
    auto* popups =
        blocked_content::PopupBlockerTabHelper::FromWebContents(contents);
    const std::string* id = args.FindString("id");
    int number = 0;
    if (popups && id && base::StringToInt(*id, &number) &&
        popups->GetBlockedPopupRequests().contains(number)) {
      if (args.FindBool("always").value_or(false)) {
        HostContentSettingsMapFactory::GetForProfile(
            contents->GetBrowserContext())
            ->SetContentSettingDefaultScope(contents->GetLastCommittedURL(),
                                            GURL(), ContentSettingsType::POPUPS,
                                            CONTENT_SETTING_ALLOW);
      }
      tabs::TabInterface* tab = tabs::TabInterface::MaybeGetFromContents(contents);
      BrowserWindowInterface* browser =
          tab ? tab->GetBrowserWindowInterface() : nullptr;
      if (browser) {
        chrome::AddAndReturnTabAt(
            browser, popups->GetBlockedPopupRequests().at(number), -1, true);
      } else {
        popups->ShowBlockedPopup(number,
                                 WindowOpenDisposition::NEW_FOREGROUND_TAB);
      }
    }
  } else if (method == "resolvePasswordPrompt") {
    const std::string* answer = args.FindString("answer");
    const std::string* username = args.FindString("username");
    const std::string* password = args.FindString("password");
    if (answer) {
      ResolvePasswordPrompt(contents, *answer, username ? *username : "",
                            password ? *password : "");
    }
  } else if (method == "securityInfo") {
    return std::move(done).Run(base::Value(SecurityInfo(contents)));
  }
  std::move(done).Run(base::Value());
}

constexpr base::TimeDelta kEvaluationTimeout = base::Seconds(20);

void TabBridge::Evaluate(const std::string& code,
                         base::OnceCallback<void(base::Value)> done) {
  if (!agent_) {
    agent_ = content::DevToolsAgentHost::GetOrCreateFor(web_contents());
    if (!agent_ || !agent_->AttachClient(this)) {
      agent_ = nullptr;
      return std::move(done).Run(base::Value());
    }
  }
  const int id = ++last_message_id_;
  evaluations_[id] = std::move(done);
  const std::string expression =
      "new Promise((resolve) => { const post = (kind, json) => { if (kind === "
      "'result') resolve(json); }; (function(post){'use strict';\n" +
      code + "\n})(post); })";
  const std::string message =
      base::WriteJson(
          base::DictValue()
              .Set("id", id)
              .Set("method", "Runtime.evaluate")
              .Set("params", base::DictValue()
                                 .Set("expression", expression)
                                 .Set("awaitPromise", true)
                                 .Set("returnByValue", true)))
          .value_or("{}");
  base::SingleThreadTaskRunner::GetCurrentDefault()->PostDelayedTask(
      FROM_HERE,
      base::BindOnce(&TabBridge::Answer, weak_factory_.GetWeakPtr(), id,
                     base::Value()),
      kEvaluationTimeout);
  agent_->DispatchProtocolMessage(this, base::as_byte_span(message));
}

void TabBridge::Answer(int id, base::Value result) {
  auto it = evaluations_.find(id);
  if (it == evaluations_.end()) {
    return;
  }
  base::OnceCallback<void(base::Value)> done = std::move(it->second);
  evaluations_.erase(it);
  std::move(done).Run(std::move(result));
}

void TabBridge::DispatchProtocolMessage(content::DevToolsAgentHost*,
                                        base::span<const uint8_t> message) {
  std::optional<base::DictValue> reply = base::JSONReader::ReadDict(
      base::as_string_view(message), base::JSON_PARSE_RFC);
  std::optional<int> id = reply ? reply->FindInt("id") : std::nullopt;
  if (!id) {
    return;
  }
  const std::string* value =
      reply->FindStringByDottedPath("result.result.value");
  Answer(*id, value ? base::Value(*value) : base::Value());
}

void TabBridge::AgentHostClosed(content::DevToolsAgentHost*) {
  agent_ = nullptr;
  std::map<int, base::OnceCallback<void(base::Value)>> pending =
      std::move(evaluations_);
  for (auto& [id, done] : pending) {
    std::move(done).Run(base::Value());
  }
}

void TabBridge::DidFinishNavigation(content::NavigationHandle* handle) {
  ObserveHelpers();
  if (!handle->IsInPrimaryMainFrame()) {
    return;
  }
  if (handle->HasCommitted()) {
    CheckSecurity();
    emit_.Run("zoom", Zoom());
  }
  const int error = handle->GetNetErrorCode();
  if (error != net::OK && error != net::ERR_ABORTED) {
    emit_.Run("loadError", base::DictValue()
                               .Set("url", handle->GetURL().spec())
                               .Set("code", error)
                               .Set("text", net::ErrorToShortString(error)));
  }
}

void TabBridge::EmitNavigation() {
  content::WebContents* contents = web_contents();
  if (!contents) {
    return;
  }
  content::NavigationController& controller = contents->GetController();
  emit_.Run("navigation", base::DictValue()
                              .Set("url", contents->GetVisibleURL().spec())
                              .Set("title", contents->GetTitle())
                              .Set("isLoading", contents->IsLoading())
                              .Set("canGoBack", controller.CanGoBack())
                              .Set("canGoForward", controller.CanGoForward()));
}

void TabBridge::DidStartLoading() {
  EmitNavigation();
}

void TabBridge::DidStopLoading() {
  EmitNavigation();
}

void TabBridge::TitleWasSet(content::NavigationEntry*) {
  EmitNavigation();
}

void TabBridge::DidChangeVisibleSecurityState() {
  CheckSecurity();
}

void TabBridge::PrimaryMainFrameRenderProcessGone(
    base::TerminationStatus status) {
  if (status == base::TERMINATION_STATUS_NORMAL_TERMINATION ||
      status == base::TERMINATION_STATUS_STILL_RUNNING) {
    return;
  }
  const int code = web_contents()->GetCrashedErrorCode();
  emit_.Run("crashed", base::DictValue()
                           .Set("status", code)
                           .Set("reason", TerminationName(status))
                           .Set("code", code));
}

void TabBridge::OnAudioStateChanged(bool) {
  emit_.Run("media", Media());
}

void TabBridge::DidUpdateAudioMutingState(bool) {
  emit_.Run("media", Media());
}

void TabBridge::DidChangeThemeColor() {
  emit_.Run("theme", base::DictValue().Set("color",
                                           ThemeColor(web_contents())));
}

void TabBridge::DidToggleFullscreenModeForTab(bool entered_fullscreen, bool) {
  emit_.Run("fullscreen",
            base::DictValue().Set("fullscreen", entered_fullscreen));
}

void TabBridge::WebContentsDestroyed() {
  zoom_.Reset();
  find_.Reset();
  popups_.Reset();
}

void TabBridge::OnZoomChanged(
    const zoom::ZoomController::ZoomChangedEventData& data) {
  if (data.web_contents == web_contents()) {
    emit_.Run("zoom", Zoom());
  }
}

void TabBridge::OnZoomControllerDestroyed(zoom::ZoomController*) {
  zoom_.Reset();
}

void TabBridge::OnFindResultAvailable(content::WebContents* contents) {
  auto* find = find_in_page::FindTabHelper::FromWebContents(contents);
  if (!find) {
    return;
  }
  const find_in_page::FindNotificationDetails& result = find->find_result();
  emit_.Run("find", base::DictValue()
                        .Set("count", result.number_of_matches())
                        .Set("active", result.active_match_ordinal())
                        .Set("final", result.final_update()));
}

void TabBridge::OnFindTabHelperDestroyed(find_in_page::FindTabHelper*) {
  find_.Reset();
}

void TabBridge::BlockedUrlAdded(int32_t popup_id, const GURL& url) {
  base::Value origin = OriginOf(web_contents()->GetLastCommittedURL());
  emit_.Run("popupBlocked",
            base::DictValue()
                .Set("id", base::NumberToString(popup_id))
                .Set("url", url.spec())
                .Set("origin", origin.is_string() ? origin.GetString()
                                                  : std::string()));
}

}
