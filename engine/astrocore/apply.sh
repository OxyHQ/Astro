#!/usr/bin/env bash
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd)
src=${CHROMIUM_SRC:-$HOME/chromium-build/chromium_git/chromium/src}

mode=apply
[[ "${1:-}" == --check ]] && mode=check
drift=0

read -r -d '' hooklib <<'PY' || true
import sys
mode, path, name = sys.argv[1:4]
s = open(path).read()
HOOKS = '#include "astro/core/ac_hooks.h"  // nogncheck\n'
CONTENT_HOOKS = '#include "astro/core/ac_content_hooks.h"  // nogncheck\n'


def with_include(text, line):
    if line in text:
        return text
    at = text.index("\n", text.index("#include ")) + 1
    return text[:at] + line + text[at:]


def hook(markers, edit, include=None):
    wanted = list(markers) + ([include] if include else [])
    if mode == "check":
        missing = [m for m in wanted if m not in s]
        if missing:
            sys.exit(f"apply.sh --check: {name} is not in {path} (missing {missing[0].strip()!r})")
        return
    present = [m for m in markers if m in s]
    if present and len(present) < len(markers):
        sys.exit(f"apply.sh: {name} is partly in {path} (has {present[0].strip()!r}): "
                 "restore the file from the series base (docs/engine-build.md)")
    result = s if present else edit(s)
    if include:
        result = with_include(result, include)
    for m in wanted:
        if result.count(m) != 1:
            sys.exit(f"apply.sh: {name}: {m.strip()!r} is {result.count(m)} times in {path}, not once")
    if result != s:
        open(path, "w").write(result)
        print("hooked " + name)
PY

hook() {
  local status=0
  python3 -c "$hooklib"$'\n'"$(cat)" "$mode" "$1" "$2" || status=$?
  if [[ $status -ne 0 ]]; then
    [[ $mode == check ]] && { drift=1; return 0; }
    exit "$status"
  fi
}

if [[ $mode == check ]]; then
  diff -r "$here/src/astro" "$src/astro" >/dev/null || { echo "apply.sh --check: $src/astro differs from the repo" >&2; drift=1; }
else
  mkdir -p "$src/astro"
  rsync -r --delete --checksum "$here/src/astro/" "$src/astro/"
fi

hook "$src/chrome/BUILD.gn" "//chrome:chrome_dll" <<'PY'
line = '      "//astro/core",  # Astro: AstroCore (engine/astrocore)\n'
def edit(s):
    mac = s.index('target(_dll_target_type, "chrome_dll")')
    anchor = '      "//third_party/cld_3/src/src:cld_3",\n'
    at = s.index(anchor, mac) + len(anchor)
    return s[:at] + line + s[at:]
hook([line], edit)
PY

hook "$src/chrome/app/chrome_main.cc" "ChromeMain's ACMainDelegate" <<'PY'
old = """#else  // BUILDFLAG(IS_WIN)
  ChromeMainDelegate chrome_main_delegate(
      {.exe_entry_point_ticks = base::TimeTicks::Now()});"""
mac = "#elif BUILDFLAG(IS_MAC)\n  // Astro: AstroCore's delegate (engine/astrocore), a ChromeMainDelegate.\n"
new = mac + """  astrocore::ACMainDelegate chrome_main_delegate(
      {.exe_entry_point_ticks = base::TimeTicks::Now()});
""" + old
inc_old = '#if BUILDFLAG(IS_MAC)\n#include "chrome/app/chrome_main_mac.h"\n'
inc = '#include "astro/core/ac_main_delegate.h"  // nogncheck\n'
def edit(s):
    assert s.count(old) == 1 and s.count(inc_old) == 1
    return s.replace(old, new).replace(inc_old, inc_old + inc)
hook(["  astrocore::ACMainDelegate chrome_main_delegate(\n", inc, mac], edit)
PY

hook "$src/chrome/browser/ui/browser_window/internal/browser_window_features.cc" "BrowserWindowFeatures' WebContentsDelegate" <<'PY'
at = "BrowserWindowFeatures::BrowserWindowFeatures() = default;\n"
decl = """// Astro: AstroCore (engine/astrocore) makes the WebContentsDelegate of the Browsers it hosts.
std::unique_ptr<BrowserWebContentsDelegate> (
    *g_astro_create_web_contents_delegate)(
    BrowserWindowInterface* browser,
    ExclusiveAccessManager& exclusive_access_manager,
    chrome::BrowserCommandController& command_controller,
    UnloadController& unload_controller,
    web_app::AppBrowserController* app_browser_controller,
    BrowserWindow& window,
    DesktopBrowserWindowCapabilities& capabilities,
    BrowserUiController& browser_ui_controller) = nullptr;

"""
old = """  browser_web_contents_delegate_ = std::make_unique<BrowserWebContentsDelegate>(
      browser, *exclusive_access_manager_, *browser_command_controller_,
      *unload_controller_, app_browser_controller_.get(),
      *BrowserWindow::FromBrowser(browser),
      *desktop_browser_window_capabilities_, *browser_ui_controller_);
"""
new = """  // Astro: AstroCore
  if (g_astro_create_web_contents_delegate) {
    browser_web_contents_delegate_ = g_astro_create_web_contents_delegate(
        browser, *exclusive_access_manager_, *browser_command_controller_,
        *unload_controller_, app_browser_controller_.get(),
        *BrowserWindow::FromBrowser(browser),
        *desktop_browser_window_capabilities_, *browser_ui_controller_);
  }
  if (!browser_web_contents_delegate_) {
    browser_web_contents_delegate_ = std::make_unique<BrowserWebContentsDelegate>(
        browser, *exclusive_access_manager_, *browser_command_controller_,
        *unload_controller_, app_browser_controller_.get(),
        *BrowserWindow::FromBrowser(browser),
        *desktop_browser_window_capabilities_, *browser_ui_controller_);
  }
"""
def edit(s):
    assert s.count(at) == 1 and s.count(old) == 1
    return s.replace(at, decl + at).replace(old, new)
hook(["    *g_astro_create_web_contents_delegate)(\n",
      "    browser_web_contents_delegate_ = g_astro_create_web_contents_delegate(\n"], edit, HOOKS)
PY

hook "$src/chrome/browser/ui/read_anything/read_anything_side_panel_controller.cc" "ReadAnythingSidePanelController" <<'PY'
old = """    if (!webui_browser::IsWebUIBrowserEnabled()) {
      CHECK_IS_TEST();
    }"""
new = """    // Astro: AstroCore's Browsers have no BrowserView, so no side panel UI.
    if (!webui_browser::IsWebUIBrowserEnabled() &&
        !g_astro_viewless_browsers) {
      CHECK_IS_TEST();
    }"""
def edit(s):
    assert s.count(old) == 1
    return s.replace(old, new)
hook(["    // Astro: AstroCore's Browsers have no BrowserView, so no side panel UI.\n"], edit, HOOKS)
PY

hook "$src/chrome/browser/ui/toasts/toast_controller.cc" "ToastController" <<'PY'
old = """    if (!webui_browser::IsWebUIBrowserEnabled()) {
      CHECK_IS_TEST();
    }"""
new = """    // Astro: AstroCore's Browsers have no BrowserView to anchor a toast to.
    if (!webui_browser::IsWebUIBrowserEnabled() &&
        !(browser_window_interface_ && g_astro_viewless_browsers)) {
      CHECK_IS_TEST();
    }"""
show_old = """bool ToastController::MaybeShowToast(ToastParams params) {
  if (!CanShowToast(params.toast_id)) {"""
show_new = """// Astro: AstroCore (engine/astrocore) runs this process: its Browsers may have no
// BrowserView (reading mode's side panel controller reads it too).
bool g_astro_viewless_browsers = false;

bool ToastController::MaybeShowToast(ToastParams params) {
  // Astro: AstroCore shows no toast without an anchor, before any state is set.
  if (browser_window_interface_ && g_astro_viewless_browsers) {
    const ToastSpecification* spec =
        toast_registry_->GetToastSpecification(params.toast_id);
    if (!spec || !GetAnchorView(spec->is_global_scope())) {
      RecordToastFailedToShow(params.toast_id);
      return false;
    }
  }
  if (!CanShowToast(params.toast_id)) {"""
def edit(s):
    assert s.count(old) == 1 and s.count(show_old) == 1
    return s.replace(old, new).replace(show_old, show_new)
hook(["    // Astro: AstroCore's Browsers have no BrowserView to anchor a toast to.\n",
      "bool g_astro_viewless_browsers = false;\n",
      "  // Astro: AstroCore shows no toast without an anchor, before any state is set.\n"], edit, HOOKS)
PY

hook "$src/chrome/browser/ui/browser_commands.cc" "CloseTab's pinned tab toast" <<'PY'
old = """  ToastController* toast_controller = ToastController::From(browser);
  if (!toast_controller) {"""
new = """  ToastController* toast_controller = ToastController::From(browser);
  // Astro: AstroCore's Browsers have no BrowserView, so no pinned tab toast.
  if (!toast_controller || (g_astro_viewless_browsers &&
                            !BrowserView::GetBrowserViewForBrowser(browser))) {"""
def edit(s):
    assert s.count(old) == 1
    return s.replace(old, new)
hook(["  // Astro: AstroCore's Browsers have no BrowserView, so no pinned tab toast.\n"], edit, HOOKS)
PY

hook "$src/chrome/browser/ui/webui/settings/settings_clear_browsing_data_handler.cc" "ClearBrowsingDataHandler" <<'PY'
old = """    CHECK(browser_element);
    ui::ElementTracker::GetFrameworkDelegate()->NotifyCustomEvent(
        browser_element,
        browsing_data_important_sites_util::kClearBrowsingDataHistoryEventId);
  }"""
new = """    // Astro: AstroCore's Browsers have no BrowserView element.
    CHECK(browser_element || g_astro_viewless_browsers);
    if (browser_element) {
      ui::ElementTracker::GetFrameworkDelegate()->NotifyCustomEvent(
          browser_element,
          browsing_data_important_sites_util::kClearBrowsingDataHistoryEventId);
    }
  }"""
def edit(s):
    assert s.count(old) == 1
    return s.replace(old, new)
hook(["    // Astro: AstroCore's Browsers have no BrowserView element.\n"], edit, HOOKS)
PY

hook "$src/chrome/browser/ui/browser.cc" "Browser window creation" <<'PY'
old_ctor = "Browser::Browser(BrowserWindowCreateParams params)\n"
decl = ("// Astro: AstroCore (engine/astrocore) supplies the window of a Browser it hosts.\n"
        "BrowserWindow* (*g_astro_browser_window_factory)(Browser*) = nullptr;\n\n")
old = """  features_->Init(this);

  if (custom_window) {
    CHECK_IS_TEST() << "BrowserWindowCreateParams::window is a test-only param";
  }
  window_ =
      custom_window
          ? std::unique_ptr<BrowserWindow, BrowserWindowDeleter>(custom_window)
          : BrowserWindow::CreateBrowserWindow(this, user_gesture,
                                               in_tab_dragging);
"""
new = """  features_->Init(this);

  // Astro: AstroCore's own window for a Browser it makes (tests only, otherwise).
  if (custom_window && !g_astro_browser_window_factory) {
    CHECK_IS_TEST() << "BrowserWindowCreateParams::window is a test-only param";
  }
  // Astro: AstroCore may host a Browser Chrome makes itself.
  BrowserWindow* const hosted_window =
      !custom_window && g_astro_browser_window_factory
          ? g_astro_browser_window_factory(this)
          : nullptr;
  window_ =
      custom_window || hosted_window
          ? std::unique_ptr<BrowserWindow, BrowserWindowDeleter>(
                custom_window ? custom_window : hosted_window)
          : BrowserWindow::CreateBrowserWindow(this, user_gesture,
                                               in_tab_dragging);
"""
def edit(s):
    assert s.count(old_ctor) == 1 and s.count(old) == 1
    return s.replace(old_ctor, decl + old_ctor).replace(old, new)
hook(["BrowserWindow* (*g_astro_browser_window_factory)(Browser*) = nullptr;\n",
      "  // Astro: AstroCore's own window for a Browser it makes (tests only, otherwise).\n",
      "          ? g_astro_browser_window_factory(this)\n"], edit, HOOKS)
PY

hook "$src/chrome/app/chrome_main_delegate.cc" "ChromeMainDelegate (embedder, ResourceBundle delegate)" <<'PY'
def gate(s, start, end, why):
    i = s.index(start)
    j = s.index(end, i) + len(end)
    body = "".join(("  " + l if l.strip() and not l.startswith("#") else l)
                   for l in s[i:j].splitlines(True))
    return s[:i] + "  // Astro: AstroCore " + why + "\n  if (!g_astro_embedder) {\n" + body + "  }\n" + s[j:]
decl_at = """#if BUILDFLAG(IS_ANDROID)
ChromeMainDelegate::ChromeMainDelegate()
    : ChromeMainDelegate(StartupTimestamps{}) {}
#endif
"""
decl = """// Astro: AstroCore (engine/astrocore) embeds Chrome: it does some of Chrome's startup itself.
bool g_astro_embedder = false;
// Astro: AstroCore's ResourceBundle delegate (its product strings).
ui::ResourceBundle::Delegate* g_astro_resource_bundle_delegate = nullptr;

"""
reps = [
("""  std::string actual_locale = LoadLocalState(
      chrome_feature_list_creator, invoked_in_browser->is_running_test);
""",
"""  std::string actual_locale = LoadLocalState(
      chrome_feature_list_creator,
      g_astro_resource_bundle_delegate,  // Astro: AstroCore
      invoked_in_browser->is_running_test);
"""),
("""            locale, nullptr, ui::ResourceBundle::LOAD_COMMON_RESOURCES);
""",
"""            locale, g_astro_resource_bundle_delegate,  // Astro: AstroCore
            ui::ResourceBundle::LOAD_COMMON_RESOURCES);
"""),
("""  bool record = true;
#if BUILDFLAG(IS_ANDROID)
  record =
      base::FeatureList::IsEnabled(chrome::android::kUmaBackgroundSessions);
#endif
""",
"""  // Astro: AstroCore records no core system profile.
  bool record = !g_astro_embedder;
#if BUILDFLAG(IS_ANDROID)
  record =
      base::FeatureList::IsEnabled(chrome::android::kUmaBackgroundSessions);
#endif
"""),
]
start1 = "  crash_reporter::InitializeCrashKeys();\n"
end1 = "#endif  // !defined(BUILDING_CHROME_RENDERER)\n"
start2 = "#if BUILDFLAG(IS_POSIX) && !BUILDFLAG(IS_MAC)\n  // Zygote needs to call InitCrashReporter() in RunZygote().\n"
end2 = "  crash_keys::SetCrashKeysFromCommandLine(command_line);\n"
def edit(s):
    assert s.count(decl_at) == 1 and s.count(start1) == 1 and s.count(start2) == 1 and s.count(end2) == 1
    s = s.replace(decl_at, decl + decl_at)
    for old, new in reps:
        assert s.count(old) == 1, old
        s = s.replace(old, new)
    s = gate(s, start1, end1, "has no crash reporter, and sets up its data dir itself.")
    return gate(s, start2, end2, "has no crash reporter.")
hook(["bool g_astro_embedder = false;\n",
      "      g_astro_resource_bundle_delegate,  // Astro: AstroCore\n",
      "            locale, g_astro_resource_bundle_delegate,  // Astro: AstroCore\n",
      "  bool record = !g_astro_embedder;\n",
      "  // Astro: AstroCore has no crash reporter, and sets up its data dir itself.\n",
      "  // Astro: AstroCore has no crash reporter.\n"], edit, HOOKS)
PY

hook "$src/chrome/browser/chrome_browser_main.cc" "ChromeBrowserMainParts (embedder)" <<'PY'
old = """  // This step is costly.
  if (browser_creator_->Start(*base::CommandLine::ForCurrentProcess(),
                              base::FilePath(), profile_info,
                              last_opened_profiles)) {"""
new = """  // This step is costly.
  // Astro: AstroCore opens its own windows and runs the main loop itself.
  if (!g_astro_embedder &&
      browser_creator_->Start(*base::CommandLine::ForCurrentProcess(),
                              base::FilePath(), profile_info,
                              last_opened_profiles)) {"""
def edit(s):
    assert s.count(old) == 1
    return s.replace(old, new)
hook(["  // Astro: AstroCore opens its own windows and runs the main loop itself.\n"], edit, HOOKS)
PY

hook "$src/chrome/browser/chrome_browser_main_mac.mm" "ChromeBrowserMainPartsMac (embedder)" <<'PY'
start = "  // Create the app delegate by requesting the shared AppController.\n"
end = "  [app_controller mainMenuCreated];\n"
old = "  [AppController.sharedController didEndMainMessageLoop];\n"
new = ("  // Astro: AstroCore\n  if (!g_astro_embedder) {\n"
       "    [AppController.sharedController didEndMainMessageLoop];\n  }\n")
def edit(s):
    assert s.count(start) == 1 and s.count(end) == 1 and s.count(old) == 1
    i = s.index(start); j = s.index(end, i) + len(end)
    body = "".join(("  " + l if l.strip() else l) for l in s[i:j].splitlines(True))
    s = s[:i] + ("  // Astro: AstroCore's app has its own NSApp delegate and main menu.\n"
                 "  if (!g_astro_embedder) {\n") + body + "  }\n" + s[j:]
    return s.replace(old, new)
hook(["  // Astro: AstroCore's app has its own NSApp delegate and main menu.\n", new], edit, HOOKS)
PY

hook "$src/chrome/browser/chrome_content_browser_client.cc" "ChromeContentBrowserClient's URL handlers (embedder)" <<'PY'
old = """  // chrome: & friends.
  handler->AddHandlerPair(&ChromeContentBrowserClient::HandleWebUI,
                          &ChromeContentBrowserClient::HandleWebUIReverse);
"""
new = """  // chrome: & friends.
  // Astro: AstroCore maps its own URLs (as CEF's build did).
  if (!g_astro_embedder) {
    handler->AddHandlerPair(&ChromeContentBrowserClient::HandleWebUI,
                            &ChromeContentBrowserClient::HandleWebUIReverse);
  }
"""
def edit(s):
    assert s.count(old) == 1
    return s.replace(old, new)
hook(["  // Astro: AstroCore maps its own URLs (as CEF's build did).\n"], edit, HOOKS)
PY

hook "$src/chrome/browser/policy/chrome_browser_policy_connector.cc" "ChromeBrowserPolicyConnector's platform provider (embedder)" <<'PY'
old = """ChromeBrowserPolicyConnector::CreatePlatformProvider() {
"""
new = """ChromeBrowserPolicyConnector::CreatePlatformProvider() {
  // Astro: AstroCore reads no platform policy (as CEF's build, which made none without a policy id).
  if (g_astro_embedder) {
    return nullptr;
  }
"""
def edit(s):
    assert s.count(old) == 1
    return s.replace(old, new)
hook(["  // Astro: AstroCore reads no platform policy (as CEF's build, which made none without a policy id).\n"],
     edit, HOOKS)
PY

hook "$src/chrome/browser/ui/views/permissions/permission_prompt_factory.cc" "the permission prompt factory" <<'PY'
at = """}  // namespace

bool ShouldShowPermissionPromptEvenIfOmniboxEditedOrEmpty(
"""
decl = """}  // namespace

// Astro: AstroCore (engine/astrocore) shows the prompts of the tabs it hosts.
std::unique_ptr<permissions::PermissionPrompt> (
    *g_astro_create_permission_prompt)(
    content::WebContents* web_contents,
    permissions::PermissionPrompt::Delegate* delegate,
    bool* default_handling) = nullptr;

bool ShouldShowPermissionPromptEvenIfOmniboxEditedOrEmpty(
"""
old = """std::unique_ptr<permissions::PermissionPrompt> CreatePermissionPrompt(
    content::WebContents* web_contents,
    permissions::PermissionPrompt::Delegate* delegate) {
"""
new = old + """  // Astro: AstroCore
  if (g_astro_create_permission_prompt) {
    bool default_handling = true;
    auto prompt = g_astro_create_permission_prompt(web_contents, delegate,
                                                       &default_handling);
    if (prompt) {
      return prompt;
    }
    if (!default_handling) {
      return nullptr;
    }
  }
"""
def edit(s):
    assert s.count(at) == 1 and s.count(old) == 1
    return s.replace(at, decl).replace(old, new)
hook(["    *g_astro_create_permission_prompt)(\n",
      "    auto prompt = g_astro_create_permission_prompt(web_contents, delegate,\n"], edit, HOOKS)
PY

hook "$src/chrome/browser/ui/sad_tab_controller.cc" "SadTabController" <<'PY'
old = """  BrowserView* browser_view = BrowserView::GetBrowserViewForBrowser(browser);
  DCHECK(browser_view);
"""
new = """  BrowserView* browser_view = BrowserView::GetBrowserViewForBrowser(browser);
  // Astro: AstroCore's Browsers have no BrowserView (engine/astrocore).
  if (!browser_view) {
    return nullptr;
  }
"""
def edit(s):
    assert s.count(old) == 1
    return s.replace(old, new)
hook(["  // Astro: AstroCore's Browsers have no BrowserView (engine/astrocore).\n"], edit)
PY

hook "$src/chrome/browser/ui/autofill/autofill_popup_controller_impl.cc" "AutofillPopupControllerImpl" <<'PY'
old_fn = "void AutofillPopupControllerImpl::Show(\n"
decl = ("// Astro: AstroCore (engine/astrocore) hears of each dropdown shown.\n"
        "void (*g_astro_autofill_suggestions_shown)(\n"
        "    content::WebContents* web_contents,\n"
        "    base::span<const Suggestion> suggestions) = nullptr;\n\n")
old = """  delegate_->OnSuggestionsShown(non_filtered_suggestions_, GetPopupMetadata());
"""
new = """  // Astro: AstroCore
  if (g_astro_autofill_suggestions_shown && IsRootPopup() && web_contents_) {
    g_astro_autofill_suggestions_shown(web_contents_.get(),
                                           non_filtered_suggestions_);
  }
""" + old
old2 = """    if (!view_->Show(autoselect_first_suggestion)) {
      return;
    }
"""
new2 = """    auto astro_alive = GetWeakPtr();
    if (!view_->Show(autoselect_first_suggestion)) {
      // Astro: AstroCore hears of a dropdown on screen whose search bar couldn't
      // take focus (an app that isn't active), which Chrome doesn't count as shown.
      if (astro_alive && view_ && g_astro_autofill_suggestions_shown &&
          IsRootPopup() && web_contents_) {
        g_astro_autofill_suggestions_shown(web_contents_.get(),
                                               non_filtered_suggestions_);
      }
      return;
    }
"""
def edit(s):
    assert s.count(old_fn) == 1 and s.count(old) == 1 and s.count(old2) == 1
    return s.replace(old_fn, decl + old_fn).replace(old, new).replace(old2, new2)
hook(["void (*g_astro_autofill_suggestions_shown)(\n",
      "  if (g_astro_autofill_suggestions_shown && IsRootPopup() && web_contents_) {\n",
      "    auto astro_alive = GetWeakPtr();\n"], edit, HOOKS)
PY

hook "$src/content/browser/renderer_host/render_widget_host_view_base.cc" "RenderWidgetHostViewBase" <<'PY'
old_fn = "void RenderWidgetHostViewBase::CopyBackgroundColorIfPresentFrom(\n"
decl = ("// Astro: AstroCore (engine/astrocore) has a translucent page background.\n"
        "bool g_astro_opacity_from_default_color = false;\n\n")
old = """  bool was_opaque = IsBackgroundColorOpaque();
  content_background_color_ = other_base.content_background_color_;
  default_background_color_ = other_base.default_background_color_;
  UpdateBackgroundColor();
  bool opaque = IsBackgroundColorOpaque();
"""
new = """  bool was_opaque = IsBackgroundColorOpaque();
  // Astro: AstroCore
  const auto astro_opaque = [this] {
    return !default_background_color_ ||
           SkColorGetA(*default_background_color_) == SK_AlphaOPAQUE;
  };
  if (g_astro_opacity_from_default_color) {
    was_opaque = astro_opaque();
  }
  content_background_color_ = other_base.content_background_color_;
  default_background_color_ = other_base.default_background_color_;
  UpdateBackgroundColor();
  bool opaque = g_astro_opacity_from_default_color ? astro_opaque()
                                                       : IsBackgroundColorOpaque();
"""
def edit(s):
    assert s.count(old_fn) == 1 and s.count(old) == 1
    return s.replace(old_fn, decl + old_fn).replace(old, new)
hook(["bool g_astro_opacity_from_default_color = false;\n",
      "  if (g_astro_opacity_from_default_color) {\n"], edit, CONTENT_HOOKS)
PY

hook "$src/chrome/browser/external_protocol/external_protocol_handler.cc" "external protocol dialog" <<'PY'
old_ns = "\nnamespace {\n"
decl = """
// Astro: AstroCore (engine/astrocore) shows this dialog itself for the tabs it hosts.
bool (*g_astro_external_protocol_dialog)(
    const GURL& url,
    content::WebContents* web_contents,
    const std::optional<url::Origin>& initiating_origin,
    content::WeakDocumentPtr initiator_document,
    const std::u16string& program_name) = nullptr;
"""
old = """  DCHECK(web_contents);
  if (delegate) {
    delegate->RunExternalProtocolDialog(url, web_contents, page_transition,"""
new = """  DCHECK(web_contents);
  // Astro: AstroCore
  if (!delegate && g_astro_external_protocol_dialog &&
      g_astro_external_protocol_dialog(url, web_contents, initiating_origin,
                                           initiator_document, program_name)) {
    return;
  }
  if (delegate) {
    delegate->RunExternalProtocolDialog(url, web_contents, page_transition,"""
def edit(s):
    assert s.count(old) == 1
    at = s.index(old_ns)
    return (s[:at] + decl + s[at:]).replace(old, new)
hook(["bool (*g_astro_external_protocol_dialog)(\n",
      "      g_astro_external_protocol_dialog(url, web_contents, initiating_origin,\n"], edit, HOOKS)
PY

hook "$src/chrome/browser/external_protocol/external_protocol_handler.cc" "external protocol dialog for inner tabs" <<'PY'
old = """    // Anchor to the outermost WebContents, for e.g. embedded <webview>s.
    web_contents = web_contents->GetOutermostWebContents();
"""
new = """    // Astro: AstroCore asks for the tab itself, which may sit inside its window's page.
    if (!delegate && g_astro_external_protocol_dialog &&
        g_astro_external_protocol_dialog(escaped_url, web_contents,
                                             initiating_origin,
                                             initiator_document, program_name)) {
      return;
    }
""" + old
def edit(s):
    assert s.count(old) == 1
    return s.replace(old, new)
hook(["    // Astro: AstroCore asks for the tab itself, which may sit inside its window's page.\n"], edit, HOOKS)
PY

hook "$src/chrome/browser/history/history_tab_helper.cc" "HistoryTabHelper" <<'PY'
old_fn = "bool HistoryTabHelper::IsEligibleTab(\n"
decl = ("// Astro: AstroCore (engine/astrocore) keeps its own pages out of history.\n"
        "bool (*g_astro_history_eligible)(content::WebContents*) = nullptr;\n\n")
old = """  if (force_eligible_tab_for_testing_) {
    return true;
  }
"""
new = old + """  // Astro: AstroCore
  if (g_astro_history_eligible && web_contents() &&
      !g_astro_history_eligible(web_contents())) {
    return false;
  }
"""
def edit(s):
    assert s.count(old_fn) == 1 and s.count(old) == 1
    return s.replace(old_fn, decl + old_fn).replace(old, new)
hook(["bool (*g_astro_history_eligible)(content::WebContents*) = nullptr;\n",
      "      !g_astro_history_eligible(web_contents())) {\n"], edit, HOOKS)
PY

hook "$src/extensions/browser/api/declarative_net_request/action_tracker.cc" "declarativeNetRequest's ActionTracker" <<'PY'
old_ns = "namespace extensions::declarative_net_request {\n"
decl = ("// Astro: AstroCore (engine/astrocore) counts what extensions' rules did to a tab's requests.\n"
        "void (*g_astro_dnr_rule_matched)(\n"
        "    content::BrowserContext* browser_context,\n"
        "    int tab_id,\n"
        "    const extensions::declarative_net_request::RequestAction& action,\n"
        "    const extensions::WebRequestInfo& request) = nullptr;\n\n")
old = """  const int tab_id =
      GetTabIdForMatchedRule(browser_context_, request_info.frame_data.tab_id);
"""
new = old + """  // Astro: AstroCore
  if (g_astro_dnr_rule_matched) {
    g_astro_dnr_rule_matched(browser_context_, tab_id, request_action,
                                 request_info);
  }
"""
def edit(s):
    assert s.count(old_ns) == 1 and s.count(old) == 1
    return s.replace(old_ns, decl + old_ns).replace(old, new)
hook(["void (*g_astro_dnr_rule_matched)(\n",
      "    g_astro_dnr_rule_matched(browser_context_, tab_id, request_action,\n"], edit, CONTENT_HOOKS)
PY

hook "$src/extensions/browser/api/declarative_net_request/rules_monitor_service.cc" "declarativeNetRequest's RulesMonitorService" <<'PY'
old_ns = "namespace extensions {\nnamespace declarative_net_request {\n"
decl = ("// Astro: AstroCore (engine/astrocore) holds a profile's navigations until a content blocker's\n"
        "// rulesets are in force.\n"
        "void (*g_astro_dnr_rulesets_in_force)(\n"
        "    content::BrowserContext* browser_context,\n"
        "    const extensions::ExtensionId& extension_id,\n"
        "    bool all_loaded) = nullptr;\n\n")
old = """  update_dynamic_or_session_rules_queue_map_[load_data.extension_id]
      .SetReadyToExecuteApiCalls();
}

void RulesMonitorService::OnNewStaticRulesetsLoaded(
"""
new = """  update_dynamic_or_session_rules_queue_map_[load_data.extension_id]
      .SetReadyToExecuteApiCalls();

  // Astro: AstroCore
  if (g_astro_dnr_rulesets_in_force) {
    g_astro_dnr_rulesets_in_force(
        context_, load_data.extension_id,
        !notify_ruleset_failed_to_load && !global_rule_limit_exceeded);
  }
}

void RulesMonitorService::OnNewStaticRulesetsLoaded(
"""
old_load = """      if (!helper.GetStaticRulesetChecksum(extension->id(), source.id(),
                                           expected_ruleset_checksum)) {
        // This might happen on prefs corruption.
        LogLoadRulesetResult(LoadRulesetResult::kErrorChecksumNotFound);
        ruleset_failed_to_load = true;
        continue;
      }

      RulesetInfo static_ruleset(std::move(source));
      static_ruleset.set_expected_checksum(expected_ruleset_checksum);
      load_data.rulesets.push_back(std::move(static_ruleset));
"""
new_load = """      const bool indexed = helper.GetStaticRulesetChecksum(
          extension->id(), source.id(), expected_ruleset_checksum);
      // Astro: AstroCore. A component extension was never installed, so
      // nothing indexed its rulesets: index them now, as for a ruleset
      // enabled after install (no expected checksum), and keep the checksum.
      if (!indexed &&
          !Manifest::IsComponentLocation(extension->location())) {
        // This might happen on prefs corruption.
        LogLoadRulesetResult(LoadRulesetResult::kErrorChecksumNotFound);
        ruleset_failed_to_load = true;
        continue;
      }

      RulesetInfo static_ruleset(std::move(source));
      if (indexed) {
        static_ruleset.set_expected_checksum(expected_ruleset_checksum);
      }
      load_data.rulesets.push_back(std::move(static_ruleset));
"""
def edit(s):
    assert s.count(old_ns) == 1 and s.count(old) == 1 and s.count(old_load) == 1
    return s.replace(old_ns, decl + old_ns).replace(old, new).replace(old_load, new_load)
hook(["void (*g_astro_dnr_rulesets_in_force)(\n",
      "    g_astro_dnr_rulesets_in_force(\n",
      "      // Astro: AstroCore. A component extension was never installed, so\n"], edit, CONTENT_HOOKS)
PY

hook "$src/chrome/browser/extensions/browser_window_util.cc" "extensions' browser_window_util" <<'PY'
old = """  if (restrict_to_normal_browsers &&
      browser.GetType() != BrowserWindowInterface::TYPE_NORMAL) {
    return false;
  }
"""
new = old + """
  // Astro: AstroCore. The host's own hidden pages are no extension's window.
  if (g_astro_hidden_from_extensions &&
      g_astro_hidden_from_extensions(&browser)) {
    return false;
  }
"""
def edit(s):
    assert s.count(old) == 1
    return s.replace(old, new)
hook(["  // Astro: AstroCore. The host's own hidden pages are no extension's window.\n"], edit, HOOKS)
PY

hook "$src/chrome/browser/ui/extensions/extension_install_ui_desktop.cc" "the extension post-install UI" <<'PY'
old_ns = "using content::BrowserThread;\n"
decl = ("// Astro: AstroCore (engine/astrocore) shows the post-install UI for the windows it hosts.\n"
        "bool (*g_astro_extension_installed)(\n"
        "    Profile* profile,\n"
        "    scoped_refptr<const extensions::Extension> extension,\n"
        "    const SkBitmap* icon) = nullptr;\n\n")
old = """  // Extensions aren't enabled by default in incognito so we confirm
  // the install in a normal window.
"""
new = """  // Astro: AstroCore
  if (g_astro_extension_installed &&
      g_astro_extension_installed(profile(), extension, icon)) {
    return;
  }

""" + old
def edit(s):
    assert s.count(old_ns) == 1 and s.count(old) == 1
    return s.replace(old_ns, decl + old_ns).replace(old, new)
hook(["bool (*g_astro_extension_installed)(\n",
      "      g_astro_extension_installed(profile(), extension, icon)) {\n"], edit, HOOKS)
PY

hook "$src/chrome/browser/download/download_crx_util.cc" "download_crx_util's install prompt" <<'PY'
old_ns = "namespace download_crx_util {\n"
decl = ("// Astro: AstroCore (engine/astrocore) shows the install prompt itself, without a tab.\n"
        "bool g_astro_prompts_without_tab = false;\n\n")
old = """  if (!web_contents) {
    BrowserWindowInterface* browser =
"""
new = """  // Astro: AstroCore
  if (!web_contents && g_astro_prompts_without_tab) {
    return std::make_unique<ExtensionInstallPrompt>(
        profile, gfx::NativeWindow(),
        std::make_unique<extensions::InstallPromptData>(
            extensions::InstallPromptData::UNSET_PROMPT_TYPE));
  }
""" + old
def edit(s):
    assert s.count(old_ns) == 1 and s.count(old) == 1
    return s.replace(old_ns, old_ns + "\n" + decl, 1).replace(old, new)
hook(["bool g_astro_prompts_without_tab = false;\n",
      "  if (!web_contents && g_astro_prompts_without_tab) {\n"], edit, HOOKS)
PY

hook "$src/chrome/browser/picture_in_picture/auto_picture_in_picture_tab_strip_observer_helper.h" "auto picture-in-picture's tab strip observer (header)" <<'PY'
old = """ private:
  void UpdateIsTabActivated(const TabStripModel* tab_strip_model);
"""
new = """  // Astro: AstroCore's host showed or hid `contents`: if it is this helper's tab, read it
  // again, as on a strip change (true).
  bool AstroHostVisibilityChanged(content::WebContents* contents);

""" + old
def edit(s):
    assert s.count(old) == 1
    return s.replace(old, new)
hook(["  bool AstroHostVisibilityChanged(content::WebContents* contents);\n"], edit)
PY

hook "$src/chrome/browser/picture_in_picture/auto_picture_in_picture_tab_strip_observer_helper.cc" "auto picture-in-picture's tab strip observer" <<'PY'
old_fn = "// static\nstd::unique_ptr<AutoPictureInPictureTabObserverHelperBase>\n"
decl = """// Astro: AstroCore (engine/astrocore) shows tabs itself: 1 shown, 0 hidden, -1 the strip decides.
int (*g_astro_tab_shown_by_host)(content::WebContents*) = nullptr;

namespace {
// Astro: AstroCore: the helpers observing a strip, to tell of the host's changes.
std::set<AutoPictureInPictureTabStripObserverHelper*>& AstroObserving() {
  static base::NoDestructor<std::set<AutoPictureInPictureTabStripObserverHelper*>> helpers;
  return *helpers;
}
}  // namespace

// Astro: AstroCore
void AstroAutoPictureInPictureHostVisibilityChanged(
    content::WebContents* contents) {
  for (AutoPictureInPictureTabStripObserverHelper* helper : AstroObserving()) {
    if (helper->AstroHostVisibilityChanged(contents)) {
      return;
    }
  }
}

bool AutoPictureInPictureTabStripObserverHelper::AstroHostVisibilityChanged(
    content::WebContents* contents) {
  if (!is_observing_ || GetObservedWebContents() != contents) {
    return false;
  }
  const bool old_is_tab_activated = is_tab_activated_;
  UpdateIsTabActivated(GetCurrentTabStripModel());
  if (is_tab_activated_ != old_is_tab_activated) {
    RunCallback(is_tab_activated_);
  }
  return true;
}

"""
include = '#include "chrome/browser/picture_in_picture/auto_picture_in_picture_tab_strip_observer_helper.h"\n'
includes = include + "\n#include <set>\n\n#include \"base/no_destructor.h\"\n"
start_old = """  is_observing_ = true;
"""
start_new = start_old + """  AstroObserving().insert(this);  // Astro: AstroCore
"""
stop_old = """  is_observing_ = false;
"""
stop_new = stop_old + """  AstroObserving().erase(this);  // Astro: AstroCore
"""
update_old = """  if (tab_strip_model) {
    // If there is not currently a selected tab, then the tabstrip is still
"""
update_new = """  if (tab_strip_model) {
    // Astro: AstroCore (a split's other pane is shown, a tab under the host's own page isn't)
    const int shown = g_astro_tab_shown_by_host
                          ? g_astro_tab_shown_by_host(GetObservedWebContents())
                          : -1;
    if (shown >= 0) {
      is_tab_activated_ = shown == 1;
      return;
    }
    // If there is not currently a selected tab, then the tabstrip is still
"""
active_old = """  return observed_tab_strip_model_->GetActiveWebContents();
}
"""
active_new = """  content::WebContents* active = observed_tab_strip_model_->GetActiveWebContents();
  // Astro: AstroCore (a tab the host hides isn't the one the user went to)
  if (active && g_astro_tab_shown_by_host &&
      g_astro_tab_shown_by_host(active) == 0) {
    return nullptr;
  }
  return active;
}
"""
def edit(s):
    for old in (old_fn, include, start_old, stop_old, update_old, active_old):
        assert s.count(old) == 1, old
    return (s.replace(include, includes).replace(old_fn, decl + old_fn).replace(start_old, start_new)
             .replace(stop_old, stop_new).replace(update_old, update_new).replace(active_old, active_new))
hook(["int (*g_astro_tab_shown_by_host)(content::WebContents*) = nullptr;\n",
      "void AstroAutoPictureInPictureHostVisibilityChanged(\n",
      "  AstroObserving().insert(this);  // Astro: AstroCore\n",
      "  AstroObserving().erase(this);  // Astro: AstroCore\n",
      "                          ? g_astro_tab_shown_by_host(GetObservedWebContents())\n",
      "      g_astro_tab_shown_by_host(active) == 0) {\n"], edit, HOOKS)
PY

hook "$src/components/permissions/permission_request_manager.cc" "the permission request manager's tab activation" <<'PY'
old_ns = "namespace permissions {\n"
decl = """// Astro: AstroCore (engine/astrocore) shows tabs itself: 1 shown, 0 hidden, -1 the strip decides.
int (*g_astro_permission_tab_shown)(content::WebContents*) = nullptr;

"""
helper = """
namespace {
// Astro: AstroCore: whether a tab can prompt, as the host shows it (or `chrome_says`).
bool AstroTabActive(content::WebContents* contents, bool chrome_says) {
  const int shown = g_astro_permission_tab_shown && contents
                        ? g_astro_permission_tab_shown(contents)
                        : -1;
  return shown < 0 ? chrome_says : shown == 1;
}
}  // namespace
"""
vis_old = """  // If `tab_subscriptions_` isn't empty, defer to those listeners instead.
  if (!tab_subscriptions_.empty()) {
    return;
  }
  bool prior_tab_is_active_ = tab_is_active_;
  tab_is_active_ = visibility != content::Visibility::HIDDEN;
"""
vis_new = """  // If `tab_subscriptions_` isn't empty, defer to those listeners instead.
  // Astro: AstroCore (unless the host says)
  const bool host_says =
      g_astro_permission_tab_shown &&
      g_astro_permission_tab_shown(web_contents()) >= 0;
  if (!tab_subscriptions_.empty() && !host_says) {
    return;
  }
  bool prior_tab_is_active_ = tab_is_active_;
  tab_is_active_ = AstroTabActive(
      web_contents(), visibility != content::Visibility::HIDDEN);
"""
adopt_old = """  tab_is_active_ = tab_interface->IsActivated();
"""
adopt_new = """  tab_is_active_ =
      AstroTabActive(web_contents(), tab_interface->IsActivated());  // Astro: AstroCore
"""
status_old = """  const bool prior_tab_is_active_ = tab_is_active_;
  tab_is_active_ = is_active;
"""
status_new = """  const bool prior_tab_is_active_ = tab_is_active_;
  tab_is_active_ = AstroTabActive(web_contents(), is_active);  // Astro: AstroCore
"""
def edit(s):
    for old in (old_ns, vis_old, adopt_old, status_old):
        assert s.count(old) == 1, old
    return (s.replace(old_ns, decl + old_ns + helper, 1).replace(vis_old, vis_new)
             .replace(adopt_old, adopt_new).replace(status_old, status_new))
hook(["int (*g_astro_permission_tab_shown)(content::WebContents*) = nullptr;\n",
      "bool AstroTabActive(content::WebContents* contents, bool chrome_says) {\n",
      "  // Astro: AstroCore (unless the host says)\n",
      "      AstroTabActive(web_contents(), tab_interface->IsActivated());  // Astro: AstroCore\n",
      "  tab_is_active_ = AstroTabActive(web_contents(), is_active);  // Astro: AstroCore\n"],
     edit, CONTENT_HOOKS)
PY

hook "$src/chrome/browser/ui/views/file_system_access/file_system_access_restore_permission_bubble_view.cc" "the File System Access restore prompt" <<'PY'
old = """void ShowFileSystemAccessRestorePermissionDialog(
    const FileSystemAccessPermissionRequestManager::RequestData& request,
    base::OnceCallback<void(permissions::PermissionAction)> callback,
    content::WebContents* web_contents) {
"""
decl = """// Astro: AstroCore (engine/astrocore) asks its host; it takes `callback` when it does.
bool (*g_astro_file_system_restore_prompt)(
    const FileSystemAccessPermissionRequestManager::RequestData& request,
    base::OnceCallback<void(permissions::PermissionAction)>& callback,
    content::WebContents* web_contents) = nullptr;

"""
new = decl + old + """  // Astro: AstroCore
  if (g_astro_file_system_restore_prompt &&
      g_astro_file_system_restore_prompt(request, callback, web_contents)) {
    return;
  }
"""
def edit(s):
    assert s.count(old) == 1
    return s.replace(old, new)
hook(["bool (*g_astro_file_system_restore_prompt)(\n",
      "      g_astro_file_system_restore_prompt(request, callback, web_contents)) {\n"], edit, HOOKS)
PY

hook "$src/chrome/browser/ui/tabs/tab_dialog_manager.cc" "TabDialogManager's visibility" <<'PY'
old = """  return GetWidgetVisibility(tab_interface_->IsVisible(), is_minimized,
                             params_->should_show_callback);
"""
new = """  // Astro: AstroCore (the host's reading, when it gave one)
  const int shown =
      g_astro_tab_shown_by_host
          ? g_astro_tab_shown_by_host(tab_interface_->GetContents())
          : -1;
  return GetWidgetVisibility(
      shown < 0 ? tab_interface_->IsVisible() : shown == 1, is_minimized,
      params_->should_show_callback);
"""
bg_old = """void TabDialogManager::TabWillEnterBackground(TabInterface* tab_interface) {
  if (widget_) {
"""
bg_new = """void TabDialogManager::TabWillEnterBackground(TabInterface* tab_interface) {
  // Astro: AstroCore
  if (widget_ && g_astro_tab_shown_by_host &&
      g_astro_tab_shown_by_host(tab_interface_->GetContents()) == 1) {
    return;
  }
  if (widget_) {
"""
def edit(s):
    assert s.count(old) == 1 and s.count(bg_old) == 1
    return s.replace(old, new).replace(bg_old, bg_new)
hook(["          ? g_astro_tab_shown_by_host(tab_interface_->GetContents())\n",
      "      g_astro_tab_shown_by_host(tab_interface_->GetContents()) == 1) {\n"], edit, HOOKS)
PY

hook "$src/chrome/browser/extensions/api/extension_action/extension_action_api.cc" "chrome.action.openPopup" <<'PY'
old_ns = "namespace extensions {\n"
decl = ("// Astro: AstroCore (engine/astrocore) shows action popups in the host's own panel. Empty: not\n"
        "// its Browser; true: shown (it runs `callback`); false: refused, with `error`.\n"
        "std::optional<bool> (*g_astro_open_action_popup)(\n"
        "    BrowserWindowInterface& browser,\n"
        "    const extensions::Extension& extension,\n"
        "    ShowPopupCallback& callback,\n"
        "    std::string* error) = nullptr;\n\n")
old = """                        ShowPopupCallback callback) {
#if !BUILDFLAG(IS_ANDROID)
"""
new = """                        ShowPopupCallback callback) {
  // Astro: AstroCore
  if (g_astro_open_action_popup) {
    if (std::optional<bool> shown = g_astro_open_action_popup(
            browser, extension, callback, error)) {
      return *shown;
    }
  }
#if !BUILDFLAG(IS_ANDROID)
"""
inc_old = "#include <memory>\n"
def edit(s):
    assert s.count(old) == 1 and s.count(inc_old) == 1
    i = s.index(old_ns)
    s = s[:i] + decl + s[i:]
    return s.replace(old, new).replace(inc_old, inc_old + "#include <optional>\n", 1)
hook(["std::optional<bool> (*g_astro_open_action_popup)(\n",
      "    if (std::optional<bool> shown = g_astro_open_action_popup(\n"], edit, HOOKS)
PY

hook "$src/chrome/browser/ui/views/extensions/extension_keybinding_registry_views.cc" "extension commands' reserved keys" <<'PY'
decl = ("// Astro: AstroCore. True when the key being pressed runs one of the host's reserved commands.\n"
        "bool (*g_astro_reserved_accelerator)(const ui::Accelerator& accelerator) = nullptr;\n\n")
ctor = "ExtensionKeybindingRegistryViews::ExtensionKeybindingRegistryViews(\n"
old = """    const ui::Accelerator& accelerator) {
  return ExtensionKeybindingRegistry::NotifyEventTargets(accelerator);
"""
new = """    const ui::Accelerator& accelerator) {
  if (g_astro_reserved_accelerator && g_astro_reserved_accelerator(accelerator)) {
    return false;
  }
  return ExtensionKeybindingRegistry::NotifyEventTargets(accelerator);
"""
def edit(s):
    assert s.count(old) == 1 and s.count(ctor) >= 1
    i = s.index(ctor)
    return (s[:i] + decl + s[i:]).replace(old, new)
hook(["bool (*g_astro_reserved_accelerator)(const ui::Accelerator& accelerator) = nullptr;\n",
      "  if (g_astro_reserved_accelerator && g_astro_reserved_accelerator(accelerator)) {\n"], edit, HOOKS)
PY

hook "$src/chrome/browser/ui/views/extensions/extension_action_delegate_desktop.cc" "extension actions' reserved keys" <<'PY'
old = """    const ui::Accelerator& accelerator) {
  return model_->TryHandleAcceleratorPress();
"""
new = """    const ui::Accelerator& accelerator) {
  if (g_astro_reserved_accelerator && g_astro_reserved_accelerator(accelerator)) {
    return false;
  }
  return model_->TryHandleAcceleratorPress();
"""
def edit(s):
    assert s.count(old) == 1
    return s.replace(old, new)
hook(["  if (g_astro_reserved_accelerator && g_astro_reserved_accelerator(accelerator)) {\n"], edit, HOOKS)
PY

hook "$src/chrome/browser/extensions/extension_commands_global_registry.cc" "global extension commands' reserved keys" <<'PY'
stale = "g_astro_host_takes_global_accelerator"
if stale in s:
    sys.exit(f"apply.sh: {name}: {path} still has a3258b69's OnKeyPressed hook: restore the file from the series base (docs/engine-build.md)")
decl = ("// Astro: AstroCore. True when the accelerator is bound to one of the host's reserved commands.\n"
        "bool (*g_astro_reserved_global_accelerator)(const ui::Accelerator& accelerator) = nullptr;\n"
        "// Astro: AstroCore. Called when shortcut handling resumes.\n"
        "void (*g_astro_global_shortcuts_resumed)() = nullptr;\n\n")
old_ns = "namespace extensions {\n"
old = """  auto* instance = GetGlobalAcceleratorListener();
  if (!instance) {
    return false;
  }
  return instance->RegisterAccelerator(accelerator, this);
"""
new = """  auto* instance = GetGlobalAcceleratorListener();
  if (!instance) {
    return false;
  }
  if (g_astro_reserved_global_accelerator &&
      g_astro_reserved_global_accelerator(accelerator)) {
    return false;
  }
  return instance->RegisterAccelerator(accelerator, this);
"""
resume_old = """    registry_for_active_window()->SetShortcutHandlingSuspended(suspended);
  }
}
"""
resume_new = """    registry_for_active_window()->SetShortcutHandlingSuspended(suspended);
  }
  if (!suspended && g_astro_global_shortcuts_resumed) {
    g_astro_global_shortcuts_resumed();
  }
}
"""
tail_old = "}  // namespace extensions\n"
tail_new = """namespace {

class AstroGlobalRegistryAccess : public ExtensionCommandsGlobalRegistry {
 public:
  static void Reregister(ExtensionCommandsGlobalRegistry* registry,
                         content::BrowserContext* context) {
    for (const scoped_refptr<const Extension>& extension :
         ExtensionRegistry::Get(context)->enabled_extensions()) {
      (registry->*(&AstroGlobalRegistryAccess::RemoveExtensionKeybinding))(
          extension.get(), std::string());
      (registry->*(&AstroGlobalRegistryAccess::AddExtensionKeybindings))(
          extension.get(), std::string());
    }
  }
};

}  // namespace

void AstroReregisterGlobalCommands(content::BrowserContext* context) {
  if (ExtensionCommandsGlobalRegistry* registry =
          ExtensionCommandsGlobalRegistry::Get(context)) {
    AstroGlobalRegistryAccess::Reregister(registry, context);
  }
}

}  // namespace extensions
"""
inc_old = '#include "extensions/common/extension.h"\n'
def edit(s):
    assert s.count(old) == 1 and s.count(old_ns) == 1 and s.count(tail_old) == 1 and s.count(inc_old) == 1
    assert s.count(resume_old) == 1
    i = s.index(old_ns)
    s = s[:i] + decl + s[i:]
    s = s.replace(old, new).replace(tail_old, tail_new).replace(resume_old, resume_new)
    return s.replace(inc_old, inc_old + '#include "extensions/browser/extension_registry.h"\n')
hook(["bool (*g_astro_reserved_global_accelerator)(const ui::Accelerator& accelerator) = nullptr;\n",
      "  if (g_astro_reserved_global_accelerator &&\n",
      "void AstroReregisterGlobalCommands(content::BrowserContext* context) {\n",
      "  if (!suspended && g_astro_global_shortcuts_resumed) {\n"], edit, HOOKS)
PY

hook "$src/chrome/browser/performance_manager/user_tuning/cpu_health_tracker.cc" "CpuHealthTracker's sampling" <<'PY'
at = "namespace performance_manager::user_tuning {\n"
decl = """bool g_astro_skip_cpu_health_sampling = false;

"""
old = """  std::unique_ptr<system_cpu::CpuProbe> cpu_probe =
      system_cpu::CpuProbe::Create();
  if (cpu_probe) {"""
new = """  std::unique_ptr<system_cpu::CpuProbe> cpu_probe =
      g_astro_skip_cpu_health_sampling ? nullptr
                                       : system_cpu::CpuProbe::Create();
  if (cpu_probe) {"""
def edit(s):
    assert s.count(at) == 1 and s.count(old) == 1
    i = s.index(at)
    return s[:i] + decl + s[i:].replace(old, new)
hook(["bool g_astro_skip_cpu_health_sampling = false;\n",
      "      g_astro_skip_cpu_health_sampling ? nullptr\n"], edit, HOOKS)
PY

hook "$src/components/memory_pressure/system_memory_pressure_evaluator_mac.cc" "the disk space check's relaxed period" <<'PY'
at = "namespace memory_pressure::mac {\n"
decl = """int g_astro_disk_space_check_seconds = 0;

namespace {
constexpr base::ByteSize kAstroRelaxedDiskSpace = base::GiB(20);
}

"""
old = """  if (disk_pressure_vote_ != new_disk_vote) {
    disk_pressure_vote_ = new_disk_vote;
    UpdatePressureAndManageNotifications();
  }
"""
new = """  if (disk_pressure_vote_ != new_disk_vote) {
    disk_pressure_vote_ = new_disk_vote;
    UpdatePressureAndManageNotifications();
  }

  if (g_astro_disk_space_check_seconds > 0) {
    const base::TimeDelta period =
        disk_space_info.has_value() &&
                disk_space_info->available > kAstroRelaxedDiskSpace
            ? base::Seconds(g_astro_disk_space_check_seconds)
            : kDiskSpaceCheckPeriod;
    if (disk_space_check_timer_.GetCurrentDelay() != period) {
      disk_space_check_timer_.Start(
          FROM_HERE, period,
          base::BindRepeating(&SystemMemoryPressureEvaluator::CheckDiskSpace,
                              weak_ptr_factory_.GetWeakPtr()));
    }
  }
"""
def edit(s):
    assert s.count(at) == 1 and s.count(old) == 1
    i = s.index(at)
    return s[:i] + decl + s[i:].replace(old, new)
hook(["int g_astro_disk_space_check_seconds = 0;\n",
      "  if (g_astro_disk_space_check_seconds > 0) {\n"], edit, CONTENT_HOOKS)
PY

hook "$src/extensions/browser/api/storage/settings_storage_quota_enforcer.cc" "unlimited storage writes skip the usage scan" <<'PY'
at = "namespace extensions {\n"
decl = """bool g_astro_lazy_storage_usage = false;

namespace {

template <typename Write>
value_store::ValueStore::WriteResult AstroWriteAfterValueRestore(Write write) {
  value_store::ValueStore::WriteResult result = write();
  if (result.status().restore_status ==
      value_store::ValueStore::VALUE_RESTORE_DELETE_SUCCESS) {
    result = write();
  }
  return result;
}

}

"""
edits = [
    ("""    WriteOptions options, const std::string& key, const base::Value& value) {
  LazyCalculateUsage();
""", """    WriteOptions options, const std::string& key, const base::Value& value) {
  if (g_astro_lazy_storage_usage && !usage_calculated_ &&
      (options & IGNORE_QUOTA)) {
    return AstroWriteAfterValueRestore(
        [&] { return HandleResult(delegate_->Set(options, key, value)); });
  }
  LazyCalculateUsage();
"""),
    ("""    const base::DictValue& values) {
  LazyCalculateUsage();
""", """    const base::DictValue& values) {
  if (g_astro_lazy_storage_usage && !usage_calculated_ &&
      (options & IGNORE_QUOTA)) {
    return AstroWriteAfterValueRestore(
        [&] { return HandleResult(delegate_->Set(options, values)); });
  }
  LazyCalculateUsage();
"""),
    ("""    const std::string& key) {
  LazyCalculateUsage();
  WriteResult result = HandleResult(delegate_->Remove(key));
""", """    const std::string& key) {
  if (g_astro_lazy_storage_usage && !usage_calculated_) {
    return AstroWriteAfterValueRestore(
        [&] { return HandleResult(delegate_->Remove(key)); });
  }
  LazyCalculateUsage();
  WriteResult result = HandleResult(delegate_->Remove(key));
"""),
    ("""ValueStore::WriteResult SettingsStorageQuotaEnforcer::Clear() {
  LazyCalculateUsage();
""", """ValueStore::WriteResult SettingsStorageQuotaEnforcer::Clear() {
  if (g_astro_lazy_storage_usage && !usage_calculated_) {
    return AstroWriteAfterValueRestore(
        [&] { return HandleResult(delegate_->Clear()); });
  }
  LazyCalculateUsage();
"""),
]
def edit(s):
    assert s.count(at) == 1
    for old, _ in edits:
        assert s.count(old) == 1, old
    i = s.index(at)
    s = s[:i] + decl + s[i:]
    for old, new in edits:
        s = s.replace(old, new)
    return s
hook(["bool g_astro_lazy_storage_usage = false;\n",
      "value_store::ValueStore::WriteResult AstroWriteAfterValueRestore(Write write) {\n",
      "        [&] { return HandleResult(delegate_->Set(options, key, value)); });\n",
      "        [&] { return HandleResult(delegate_->Set(options, values)); });\n",
      "        [&] { return HandleResult(delegate_->Remove(key)); });\n",
      "        [&] { return HandleResult(delegate_->Clear()); });\n"], edit, CONTENT_HOOKS)
PY

hook "$src/device/fido/cable/v2_discovery.h" "hybrid WebAuthn scans only while its sheet shows" <<'PY'
edits = [
    ("""  void StartInternal() override;

""", """  void StartInternal() override;

  static void SetHybridUiShown(const void* model, bool shown);

"""),
    ("""  bool device_committed_ = false;
""", """  bool device_committed_ = false;
  bool scan_wanted_ = false;
"""),
]
def edit(s):
    for old, _ in edits:
        assert s.count(old) == 1, old
    for old, new in edits:
        s = s.replace(old, new)
    return s
hook(["  static void SetHybridUiShown(const void* model, bool shown);\n", "  bool scan_wanted_ = false;\n"], edit)
PY

hook "$src/device/fido/cable/v2_discovery.cc" "hybrid WebAuthn scans only while its sheet shows" <<'PY'
edits = [
    ("""#include "base/metrics/histogram_functions.h"
""", """#include "base/metrics/histogram_functions.h"
#include "base/no_destructor.h"
"""),
    ("""namespace device::cablev2 {

namespace {
""", """bool g_astro_hybrid_scan_on_demand = false;

namespace device::cablev2 {

namespace {

base::flat_set<const void*>& ModelsShowingHybrid() {
  static base::NoDestructor<base::flat_set<const void*>> models;
  return *models;
}

std::vector<base::WeakPtr<Discovery>>& ScanWaiters() {
  static base::NoDestructor<std::vector<base::WeakPtr<Discovery>>> waiters;
  return *waiters;
}
"""),
    ("""      event_callback_));
}

void Discovery::PairingIsInvalid(""", """      event_callback_));
  if (g_astro_hybrid_scan_on_demand && scan_wanted_ && !discovery_session_) {
    StartCableDiscovery();
  }
}

void Discovery::PairingIsInvalid("""),
    ("""void Discovery::StartCableDiscovery() {
""", """void Discovery::SetHybridUiShown(const void* model, bool shown) {
  base::flat_set<const void*>& models = ModelsShowingHybrid();
  const bool was_shown = !models.empty();
  if (shown) {
    models.insert(model);
  } else {
    models.erase(model);
  }
  if (was_shown == !models.empty()) {
    return;
  }
  std::vector<base::WeakPtr<Discovery>> live;
  for (const base::WeakPtr<Discovery>& waiter : ScanWaiters()) {
    if (waiter) {
      live.push_back(waiter);
    }
  }
  ScanWaiters() = live;
  for (const base::WeakPtr<Discovery>& discovery : live) {
    if (!discovery) {
      continue;
    }
    if (!models.empty()) {
      discovery->StartCableDiscovery();
    } else if (discovery->tunnels_pending_advert_.empty()) {
      discovery->discovery_session_.reset();
    }
  }
}

void Discovery::StartCableDiscovery() {
  if (g_astro_hybrid_scan_on_demand) {
    if (!scan_wanted_) {
      scan_wanted_ = true;
      std::erase_if(ScanWaiters(),
                    [](const base::WeakPtr<Discovery>& waiter) { return !waiter; });
      ScanWaiters().push_back(weak_factory_.GetWeakPtr());
    }
    if (ModelsShowingHybrid().empty() && tunnels_pending_advert_.empty()) {
      return;
    }
  }
"""),
    ("""  FIDO_LOG(DEBUG) << "Discovery session started.";
  SetDiscoverySession(std::move(session));
""", """  FIDO_LOG(DEBUG) << "Discovery session started.";
  if (g_astro_hybrid_scan_on_demand && ModelsShowingHybrid().empty() &&
      tunnels_pending_advert_.empty()) {
    return;
  }
  SetDiscoverySession(std::move(session));
"""),
    ("""Discovery::~Discovery() {
  if (adapter_) {
""", """Discovery::~Discovery() {
  if (scan_wanted_) {
    std::erase_if(ScanWaiters(), [this](const base::WeakPtr<Discovery>& waiter) {
      return !waiter || waiter.get() == this;
    });
  }
  if (adapter_) {
"""),
    ("""}  // namespace device::cablev2
""", """}  // namespace device::cablev2

void AstroSetHybridUiShown(const void* model, bool shown) {
  device::cablev2::Discovery::SetHybridUiShown(model, shown);
}
"""),
]
def edit(s):
    for old, _ in edits:
        assert s.count(old) == 1, old
    for old, new in edits:
        s = s.replace(old, new)
    return s
hook(["bool g_astro_hybrid_scan_on_demand = false;\n",
      "base::flat_set<const void*>& ModelsShowingHybrid() {\n",
      "void Discovery::SetHybridUiShown(const void* model, bool shown) {\n",
      "  if (g_astro_hybrid_scan_on_demand && scan_wanted_ && !discovery_session_) {\n",
      "  if (g_astro_hybrid_scan_on_demand && ModelsShowingHybrid().empty() &&\n",
      "void AstroSetHybridUiShown(const void* model, bool shown) {\n",
      "      return !waiter || waiter.get() == this;\n"], edit, CONTENT_HOOKS)
PY

hook "$src/chrome/browser/webauthn/authenticator_request_dialog_model.cc" "hybrid WebAuthn scans only while its sheet shows" <<'PY'
edits = [
    ("""AuthenticatorRequestDialogModel::~AuthenticatorRequestDialogModel() {
""", """AuthenticatorRequestDialogModel::~AuthenticatorRequestDialogModel() {
  AstroSetHybridUiShown(this, false);
"""),
    ("""  const StepUIType previous_ui_type = step_ui_type(step_);
  step_ = step;
""", """  const StepUIType previous_ui_type = step_ui_type(step_);
  step_ = step;
  if (g_astro_hybrid_scan_on_demand) {
    AstroSetHybridUiShown(this, step_ == Step::kCableV2QRCode ||
                                    step_ == Step::kCableV2Connecting ||
                                    step_ == Step::kCableV2Connected);
  }
"""),
]
def edit(s):
    for old, _ in edits:
        assert s.count(old) == 1, old
    for old, new in edits:
        s = s.replace(old, new)
    return s
hook(["  AstroSetHybridUiShown(this, false);\n",
      "    AstroSetHybridUiShown(this, step_ == Step::kCableV2QRCode ||\n"], edit, CONTENT_HOOKS)
PY

hook "$src/device/bluetooth/bluetooth_low_energy_adapter_apple.h" "Bluetooth LE state updates reach the Mac adapter" <<'PY'
old = """  virtual void TriggerSystemPermissionPrompt() = 0;
"""
new = """  virtual void TriggerSystemPermissionPrompt() = 0;
  virtual void OnLowEnergyCentralManagerStateUpdated() {}
"""
def edit(s):
    assert s.count(old) == 1
    return s.replace(old, new)
hook(["  virtual void OnLowEnergyCentralManagerStateUpdated() {}\n"], edit)
PY

hook "$src/device/bluetooth/bluetooth_low_energy_adapter_apple.mm" "Bluetooth LE state updates reach the Mac adapter" <<'PY'
old = """        device_mac->DidDisconnectPeripheral(nullptr);
      }
    }
  }
}
"""
new = """        device_mac->DidDisconnectPeripheral(nullptr);
      }
    }
  }
  OnLowEnergyCentralManagerStateUpdated();
}
"""
def edit(s):
    assert s.count(old) == 1
    return s.replace(old, new)
hook(["  OnLowEnergyCentralManagerStateUpdated();\n}\n"], edit)
PY

hook "$src/device/bluetooth/bluetooth_adapter_mac.h" "the Bluetooth adapter polls on demand" <<'PY'
old = """  void PollAdapter();
  void OnBackgroundPollComplete(AdapterState state);
"""
new = """  void PollAdapter();
  void OnBackgroundPollComplete(AdapterState state);
  void PollAdapterOnDemand();
  void OnLowEnergyCentralManagerStateUpdated() override;

  bool poll_pending_ = false;
  bool poll_dirty_ = false;
  base::TimeTicks last_poll_completed_;
"""
def edit(s):
    assert s.count(old) == 1
    return s.replace(old, new)
hook(["  void PollAdapterOnDemand();\n", "  bool poll_dirty_ = false;\n", "  base::TimeTicks last_poll_completed_;\n"], edit)
PY

hook "$src/device/bluetooth/bluetooth_adapter_mac.mm" "the Bluetooth adapter polls on demand" <<'PY'
at = "namespace device {\n"
decl = """bool g_astro_bluetooth_poll_on_demand = false;

"""
edits = [
    ("""void BluetoothAdapterMac::LazyInitialize() {
  if (lazy_initialized_)
    return;
""", """void BluetoothAdapterMac::LazyInitialize() {
  if (lazy_initialized_) {
    if (g_astro_bluetooth_poll_on_demand) {
      PollAdapterOnDemand();
    }
    return;
  }
"""),
    ("""void BluetoothAdapterMac::PollAdapter() {
  base::ThreadPool::PostTaskAndReplyWithResult(
""", """void BluetoothAdapterMac::PollAdapter() {
  poll_pending_ = true;
  poll_dirty_ = false;
  base::ThreadPool::PostTaskAndReplyWithResult(
"""),
    ("""  RemoveTimedOutDevices();

  ui_task_runner_->PostDelayedTask(
      FROM_HERE,
      base::BindOnce(&BluetoothAdapterMac::PollAdapter,
                     weak_ptr_factory_.GetWeakPtr()),
      base::Milliseconds(kPollIntervalMs));
""", """  RemoveTimedOutDevices();

  if (g_astro_bluetooth_poll_on_demand && !IsDiscovering()) {
    poll_pending_ = false;
    last_poll_completed_ = base::TimeTicks::Now();
    if (poll_dirty_) {
      PollAdapterOnDemand();
    }
  } else {
    ui_task_runner_->PostDelayedTask(
        FROM_HERE,
        base::BindOnce(&BluetoothAdapterMac::PollAdapter,
                       weak_ptr_factory_.GetWeakPtr()),
        base::Milliseconds(kPollIntervalMs));
  }
"""),
    ("""void BluetoothAdapterMac::OnConnectedDeviceStateRetrieved(
""", """void BluetoothAdapterMac::PollAdapterOnDemand() {
  if (poll_pending_) {
    return;
  }
  poll_pending_ = true;
  const base::TimeDelta wait = last_poll_completed_ +
                               base::Milliseconds(kPollIntervalMs) -
                               base::TimeTicks::Now();
  if (wait.is_positive()) {
    ui_task_runner_->PostDelayedTask(
        FROM_HERE,
        base::BindOnce(&BluetoothAdapterMac::PollAdapter,
                       weak_ptr_factory_.GetWeakPtr()),
        wait);
    return;
  }
  PollAdapter();
}

void BluetoothAdapterMac::OnLowEnergyCentralManagerStateUpdated() {
  if (!g_astro_bluetooth_poll_on_demand || !lazy_initialized_) {
    return;
  }
  if (poll_pending_) {
    poll_dirty_ = true;
    return;
  }
  PollAdapterOnDemand();
}

void BluetoothAdapterMac::OnConnectedDeviceStateRetrieved(
"""),
]
def edit(s):
    assert s.count(at) >= 1
    for old, _ in edits:
        assert s.count(old) == 1, old
    i = s.index(at)
    s = s[:i] + decl + s[i:]
    for old, new in edits:
        s = s.replace(old, new)
    return s
hook(["bool g_astro_bluetooth_poll_on_demand = false;\n",
      "  if (g_astro_bluetooth_poll_on_demand && !IsDiscovering()) {\n",
      "void BluetoothAdapterMac::PollAdapterOnDemand() {\n",
      "void BluetoothAdapterMac::OnLowEnergyCentralManagerStateUpdated() {\n",
      "    poll_dirty_ = true;\n"], edit)
PY

hook "$src/chrome/browser/extensions/extension_action_storage_manager.cc" "restored browser action defaults notify" <<'PY'
old = """  SetDefaultsFromValue(value->GetDict(), action);
}
"""
new = """  SetDefaultsFromValue(value->GetDict(), action);
  if (g_astro_embedder) {
    ExtensionActionDispatcher::Get(browser_context_)
        ->NotifyChange(action, nullptr, browser_context_);
  }
}
"""
def edit(s):
    assert s.count(old) == 1
    return s.replace(old, new)
hook(["  if (g_astro_embedder) {\n    ExtensionActionDispatcher::Get(browser_context_)\n"], edit, HOOKS)
PY

hook "$src/extensions/browser/extension_user_script_loader.cc" "a script loader made once extensions are ready starts at once" <<'PY'
at = "namespace extensions {\n"
decl = """bool g_astro_script_loader_ready_at_once = false;

"""
old = """  ExtensionSystem::Get(browser_context)
      ->ready()
      .Post(FROM_HERE,
            base::BindOnce(&ExtensionUserScriptLoader::OnExtensionSystemReady,
                           weak_factory_.GetWeakPtr()));
}
"""
new = """  if (g_astro_script_loader_ready_at_once &&
      ExtensionSystem::Get(browser_context)->ready().is_signaled()) {
    OnExtensionSystemReady();
    return;
  }
  ExtensionSystem::Get(browser_context)
      ->ready()
      .Post(FROM_HERE,
            base::BindOnce(&ExtensionUserScriptLoader::OnExtensionSystemReady,
                           weak_factory_.GetWeakPtr()));
}
"""
def edit(s):
    assert s.count(at) == 1 and s.count(old) == 1
    i = s.index(at)
    return s[:i] + decl + s[i:].replace(old, new)
hook(["bool g_astro_script_loader_ready_at_once = false;\n",
      "  if (g_astro_script_loader_ready_at_once &&\n"], edit, CONTENT_HOOKS)
PY

hook "$src/chrome/browser/extensions/user_script_listener.cc" "navigations wait for content scripts at the response, not the request" <<'PY'
at = "namespace extensions {\n"
decl = """bool g_astro_scripts_wait_at_response = false;

"""
old = """  ThrottleCheckResult WillStartRequest() override {
    // Only defer requests if Resume has not yet been called.
    if (should_defer_) {
      did_defer_ = true;
      return DEFER;
    }
    return PROCEED;
  }
"""
new = """  ThrottleCheckResult WillStartRequest() override {
    // Only defer requests if Resume has not yet been called.
    if (should_defer_ && !g_astro_scripts_wait_at_response) {
      did_defer_ = true;
      return DEFER;
    }
    return PROCEED;
  }

  ThrottleCheckResult WillProcessResponse() override {
    if (should_defer_ && g_astro_scripts_wait_at_response) {
      did_defer_ = true;
      return DEFER;
    }
    return PROCEED;
  }
"""
def edit(s):
    assert s.count(at) == 1 and s.count(old) == 1
    i = s.index(at)
    return s[:i] + decl + s[i:].replace(old, new)
hook(["bool g_astro_scripts_wait_at_response = false;\n",
      "  ThrottleCheckResult WillProcessResponse() override {\n    if (should_defer_ && g_astro_scripts_wait_at_response) {\n"], edit, CONTENT_HOOKS)
PY

hook "$src/chrome/browser/ui/webui_browser/webui_browser_window.cc" "window keys" <<'PY'
at = "WebUIBrowserWindow::WebUIBrowserWindow(BrowserWindowInterface* browser)"
decl = """// Astro: AstroCore takes its own shortcuts before the browser's and gives the browser's back to the page.
std::optional<content::KeyboardEventProcessingResult> (*g_astro_window_key)(
    BrowserWindowInterface* browser,
    const input::NativeWebKeyboardEvent& event,
    int command_id) = nullptr;

"""
old = """  int command_id;
  if (!FindCommandIdForAccelerator(accelerator, &command_id)) {
    return content::KeyboardEventProcessingResult::NOT_HANDLED;
  }
"""
new = """  int command_id = -1;
  const bool is_browser_command =
      FindCommandIdForAccelerator(accelerator, &command_id);
  if (g_astro_window_key) {
    if (std::optional<content::KeyboardEventProcessingResult> result =
            g_astro_window_key(browser_.get(), event,
                               is_browser_command ? command_id : -1)) {
      return *result;
    }
  }
  if (!is_browser_command) {
    return content::KeyboardEventProcessingResult::NOT_HANDLED;
  }
"""
include = "#include <optional>\n"
first = '#include "chrome/browser/ui/webui_browser/webui_browser_window.h"\n'
def edit(s):
    assert s.count(at) == 1 and s.count(old) == 1 and s.count(first) == 1
    i = s.index(at)
    s = s[:i] + decl + s[i:].replace(old, new)
    if include not in s:
        s = s.replace(first, first + "\n" + include, 1)
    return s
hook(["std::optional<content::KeyboardEventProcessingResult> (*g_astro_window_key)(\n",
      "  if (g_astro_window_key) {\n"], edit)
PY

hook "$src/chrome/browser/ui/webui_browser/webui_browser_window.cc" "frameless window" <<'PY'
old = """#if BUILDFLAG(IS_CHROMEOS)
  params.remove_standard_frame = true;
#endif
"""
new = """#if BUILDFLAG(IS_CHROMEOS) || BUILDFLAG(IS_WIN) || BUILDFLAG(IS_LINUX)
  // Astro: AstroCore draws the whole window, its title bar and controls included.
  params.remove_standard_frame = true;
#endif
"""
def edit(s):
    assert s.count(old) == 1
    return s.replace(old, new)
hook(["  // Astro: AstroCore draws the whole window, its title bar and controls included.\n"], edit)
PY

hook "$src/chrome/browser/ui/webui_browser/webui_browser_client_view.cc" "frameless window edges" <<'PY'
old = """int WebUIBrowserClientView::NonClientHitTest(const gfx::Point& point) {
"""
new = old + """#if BUILDFLAG(IS_WIN) || BUILDFLAG(IS_LINUX)
  // Astro: the window has no system frame, so its own edges resize it.
  if (views::Widget* widget = GetWidget(); widget && widget->widget_delegate() &&
      widget->widget_delegate()->CanResize() && !widget->IsMaximized() &&
      !widget->IsFullscreen()) {
    constexpr int kResizeEdge = 5;
    constexpr int kResizeCorner = 16;
    const bool top = point.y() < kResizeEdge;
    const bool bottom = point.y() >= height() - kResizeEdge;
    const bool left = point.x() < kResizeEdge;
    const bool right = point.x() >= width() - kResizeEdge;
    if (top || bottom || left || right) {
      const bool near_top = point.y() < kResizeCorner;
      const bool near_bottom = point.y() >= height() - kResizeCorner;
      const bool near_left = point.x() < kResizeCorner;
      const bool near_right = point.x() >= width() - kResizeCorner;
      if (near_top && near_left) {
        return HTTOPLEFT;
      }
      if (near_top && near_right) {
        return HTTOPRIGHT;
      }
      if (near_bottom && near_left) {
        return HTBOTTOMLEFT;
      }
      if (near_bottom && near_right) {
        return HTBOTTOMRIGHT;
      }
      return top ? HTTOP : bottom ? HTBOTTOM : left ? HTLEFT : HTRIGHT;
    }
  }
#endif
"""
includes = ['#include "build/build_config.h"\n', '#include "ui/base/hit_test.h"\n', '#include "ui/views/widget/widget.h"\n', '#include "ui/views/widget/widget_delegate.h"\n']
first = '#include "chrome/browser/ui/webui_browser/webui_browser_client_view.h"\n'
def edit(s):
    assert s.count(old) == 1 and s.count(first) == 1
    s = s.replace(old, new)
    missing = "".join(i for i in includes if i not in s)
    if missing:
        s = s.replace(first, first + "\n" + missing, 1)
    return s
hook(["  // Astro: the window has no system frame, so its own edges resize it.\n"], edit)
PY

hook "$src/chrome/browser/ui/browser_web_contents_delegate/browser_web_contents_delegate.cc" "link under the pointer" <<'PY'
at = "void BrowserWebContentsDelegate::UpdateTargetURL(content::WebContents* source,\n"
decl = """// Astro: AstroCore shows the link under the pointer itself.
bool (*g_astro_target_url)(content::WebContents* source,
                           const GURL& url) = nullptr;

"""
old = """                                                 const GURL& url) {
  std::vector<StatusBubble*> status_bubbles =
      browser_ui_controller_->GetStatusBubbles();
"""
new = """                                                 const GURL& url) {
  if (g_astro_target_url && g_astro_target_url(source, url)) {
    return;
  }
  std::vector<StatusBubble*> status_bubbles =
      browser_ui_controller_->GetStatusBubbles();
"""
def edit(s):
    assert s.count(at) == 1 and s.count(old) == 1
    i = s.index(at)
    return s[:i] + decl + s[i:].replace(old, new, 1)
hook(["bool (*g_astro_target_url)(content::WebContents* source,\n",
      "  if (g_astro_target_url && g_astro_target_url(source, url)) {\n"], edit)
PY

hook "$src/chrome/browser/ui/webui_browser/webui_browser_window.cc" "frameless window drag" <<'PY'
old = """#if BUILDFLAG(IS_CHROMEOS)
  // The titlebar has `app-region: drag;` set, so we shouldn't descend into it
  // for event handling on ChromeOS.
  if (GetWidget() &&
      GetWidget()->GetNonClientComponent(location) == HTCAPTION) {
    return false;
  }
  return true;
#else
"""
new = """#if BUILDFLAG(IS_CHROMEOS) || BUILDFLAG(IS_WIN) || BUILDFLAG(IS_LINUX)
  // Astro: the page's drag regions and the frameless window's edges move and resize it, so they keep the press.
  if (GetWidget()) {
    const int component = GetWidget()->GetNonClientComponent(location);
    if (component != HTCLIENT && component != HTNOWHERE) {
      return false;
    }
  }
  return true;
#else
"""
def edit(s):
    assert s.count(old) == 1
    return s.replace(old, new)
hook(["  // Astro: the page's drag regions and the frameless window's edges move and resize it, so they keep the press.\n"], edit)
PY

hook "$src/chrome/browser/ui/views/desktop_capture/desktop_media_picker_views.cc" "screen-share picker" <<'PY'
at = "// static\nstd::unique_ptr<DesktopMediaPicker> DesktopMediaPicker::Create(\n"
decl = """// Astro: AstroCore shows its own screen-share picker for the tabs its window hosts.
std::unique_ptr<DesktopMediaPicker> (*g_astro_desktop_media_picker)(
    const content::MediaStreamRequest* request) = nullptr;

"""
old = """    const content::MediaStreamRequest* request) {
  if (request &&
      request->video_type ==
          blink::mojom::MediaStreamType::DISPLAY_VIDEO_CAPTURE_THIS_TAB) {
"""
new = """    const content::MediaStreamRequest* request) {
  if (g_astro_desktop_media_picker) {
    if (auto picker = g_astro_desktop_media_picker(request)) {
      return picker;
    }
  }
  if (request &&
      request->video_type ==
          blink::mojom::MediaStreamType::DISPLAY_VIDEO_CAPTURE_THIS_TAB) {
"""
def edit(s):
    assert s.count(at) == 1 and s.count(old) == 1
    i = s.index(at)
    return s[:i] + decl + s[i:].replace(old, new, 1)
hook(["std::unique_ptr<DesktopMediaPicker> (*g_astro_desktop_media_picker)(\n",
      "  if (g_astro_desktop_media_picker) {\n"], edit)
PY

hook "$src/chrome/browser/ui/startup/startup_browser_creator.cc" "links from other apps" <<'PY'
at = "void StartupBrowserCreator::ProcessCommandLineAlreadyRunning(\n"
decl = """// Astro: AstroCore routes links from other apps itself, to Little Astro or a tab.
bool (*g_astro_open_urls)(const base::CommandLine& command_line,
                          const base::FilePath& cur_dir) = nullptr;

"""
old = """    const StartupProfilePathInfo& profile_path_info) {
  if (profile_path_info.mode == StartupProfileMode::kError) {
    return;
  }

  Profile* profile = nullptr;
"""
new = """    const StartupProfilePathInfo& profile_path_info) {
  if (profile_path_info.mode == StartupProfileMode::kError) {
    return;
  }
  if (g_astro_open_urls && g_astro_open_urls(command_line, cur_dir)) {
    return;
  }

  Profile* profile = nullptr;
"""
def edit(s):
    assert s.count(at) == 1 and s.count(old) == 1
    i = s.index(at)
    j = s.rfind("// static\n", 0, i)
    i = j if j != -1 and i - j < 20 else i
    return s[:i] + decl + s[i:].replace(old, new, 1)
hook(["bool (*g_astro_open_urls)(const base::CommandLine& command_line,\n",
      "  if (g_astro_open_urls && g_astro_open_urls(command_line, cur_dir)) {\n"], edit)
PY

hook "$src/chrome/browser/ui/webui_browser/webui_browser_window.cc" "hidden host windows stay hidden" <<'PY'
old = "void WebUIBrowserWindow::Show() {\n"
decl = """// Astro: AstroCore keeps the hidden windows that host other profiles' tabs hidden, even when docked DevTools show their window.
bool (*g_astro_keeps_window_hidden)(BrowserWindowInterface* browser) = nullptr;

"""
new = decl + old + """  if (g_astro_keeps_window_hidden &&
      g_astro_keeps_window_hidden(browser_.get())) {
    return;
  }
"""
def edit(s):
    assert s.count(old) == 1
    return s.replace(old, new, 1)
hook(["bool (*g_astro_keeps_window_hidden)(BrowserWindowInterface* browser) = nullptr;\n",
      "  if (g_astro_keeps_window_hidden &&\n"], edit)
PY

hook "$src/chrome/browser/ui/webui_browser/webui_browser_window.cc" "closed windows stay out of the activation order" <<'PY'
old = """void WebUIBrowserWindow::PaintAsActiveChanged() {
"""
new = old + """  if (browser_->IsDeleteScheduled()) {
    return;
  }
"""
def edit(s):
    assert s.count(old) == 1
    return s.replace(old, new, 1)
hook(["void WebUIBrowserWindow::PaintAsActiveChanged() {\n  if (browser_->IsDeleteScheduled()) {\n"], edit)
PY

archive="$src/chrome/tools/build/win/create_installer_archive.py"
if grep -q "import winreg\|# Astro: cross builds" "$archive"; then
hook "$archive" "installer archive from a Linux host" <<'PY'
old = """def GetLZMAExec(build_dir):
    # Taken from ungoogled-chromium's _extraction.py file, modified for Python 2
    import winreg
"""
new = """def GetLZMAExec(build_dir):
    # Astro: cross builds from Linux pack with the host 7za Chromium ships.
    if sys.platform != 'win32':
        return os.path.join(build_dir, '..', '..', 'third_party', 'lzma_sdk',
                            'bin', 'host_platform', '7za')
    # Taken from ungoogled-chromium's _extraction.py file, modified for Python 2
    import winreg
"""
def edit(s):
    assert s.count(old) == 1
    return s.replace(old, new)
hook(["    # Astro: cross builds from Linux pack with the host 7za Chromium ships.\n"], edit)
PY
hook "$archive" "installer carries the content blocker and the CLI" <<'PY'
old = """    CopySectionFilesToStagingDir(
        config, 'GENERAL', staging_dir, build_dir, verbose
    )
"""
copy = """    version_dir = os.path.join(
        staging_dir, config.get('GENERAL', 'chrome.dll').replace('\\\\', os.sep))
    for folder, staged in (FOLDERS):
        source = os.path.join(build_dir, folder)
        if not os.path.isdir(source):
            continue
        shutil.copytree(source, os.path.join(version_dir, staged),
                        dirs_exist_ok=True)
        for parent, _, names in os.walk(source):
            g_archive_inputs.extend(
                os.path.relpath(os.path.join(parent, name), build_dir)
                for name in names)
"""
marker = "    # Astro: the content blocker and the astro command ship as folders beside chrome.dll.\n"
previous = (old + "    # Astro: the interface and the content blocker ship as folders beside chrome.dll.\n" +
            copy.replace("FOLDERS", "('astro-ui', 'astro-ui'), ('extensions', 'Extensions'), ('cli', 'cli')"))
new = old + marker + copy.replace("FOLDERS", "('extensions', 'Extensions'), ('cli', 'cli')")
def edit(s):
    if s.count(previous) == 1:
        return s.replace(previous, new)
    assert s.count(old) == 1
    return s.replace(old, new)
hook([marker], edit)
PY
fi

hook "$src/chrome/browser/ui/browser_web_contents_delegate/browser_web_contents_delegate.cc" "keys the page left" <<'PY'
at = "bool BrowserWebContentsDelegate::HandleKeyboardEvent(\n"
decl = """// Astro: AstroCore hears about keys a hosted tab didn't use, as Esc that closes a popover or Little Astro.
void (*g_astro_unhandled_key)(content::WebContents* source,
                              const input::NativeWebKeyboardEvent& event) =
    nullptr;

"""
old = """    const input::NativeWebKeyboardEvent& event) {
  DevToolsWindow* devtools_window =
      DevToolsWindow::GetInstanceForInspectedWebContents(source);"""
new = """    const input::NativeWebKeyboardEvent& event) {
  if (g_astro_unhandled_key) {
    g_astro_unhandled_key(source, event);
  }
  DevToolsWindow* devtools_window =
      DevToolsWindow::GetInstanceForInspectedWebContents(source);"""
def edit(s):
    assert s.count(at) == 1 and s.count(old) == 1
    i = s.index(at)
    return s[:i] + decl + s[i:].replace(old, new, 1)
hook(["void (*g_astro_unhandled_key)(content::WebContents* source,\n",
      "  if (g_astro_unhandled_key) {\n"], edit)
PY

hook "$src/chrome/browser/ui/webui_browser/webui_browser_window.cc" "keys pages leave" <<'PY'
old = """bool WebUIBrowserWindow::HandleKeyboardEvent(
    const input::NativeWebKeyboardEvent& event) {
  return false;
}
"""
new = """// Astro: browser shortcuts a page didn't use run here, as in Chrome's BrowserView.
bool (*g_astro_window_unhandled_key)(
    BrowserWindowInterface* browser,
    const input::NativeWebKeyboardEvent& event) = nullptr;

bool WebUIBrowserWindow::HandleKeyboardEvent(
    const input::NativeWebKeyboardEvent& event) {
  return g_astro_window_unhandled_key &&
         g_astro_window_unhandled_key(browser_.get(), event);
}
"""
def edit(s):
    assert s.count(old) == 1
    return s.replace(old, new)
hook(["bool (*g_astro_window_unhandled_key)(\n"], edit)
PY

hook "$src/chrome/browser/ui/browser_web_contents_delegate/browser_web_contents_delegate.cc" "hung pages reach the host" <<'PY'
at = "void BrowserWebContentsDelegate::RendererUnresponsive(\n"
decl = """// Astro: AstroCore shows its own overlay for a hung page in a window whose interface it draws.
bool (*g_astro_renderer_unresponsive)(content::WebContents* source,
                                      content::RenderWidgetHost* host,
                                      base::RepeatingClosure restarter) = nullptr;
bool (*g_astro_renderer_responsive)(content::WebContents* source,
                                    content::RenderWidgetHost* host) = nullptr;

"""
old_hung = """    base::RepeatingClosure hang_monitor_restarter) {
  // Don't show the page hung dialog when a HTML popup hangs because
"""
new_hung = """    base::RepeatingClosure hang_monitor_restarter) {
  if (g_astro_renderer_unresponsive &&
      g_astro_renderer_unresponsive(source, render_widget_host,
                                    hang_monitor_restarter)) {
    return;
  }
  // Don't show the page hung dialog when a HTML popup hangs because
"""
old_ok = """    content::RenderWidgetHost* render_widget_host) {
  content::RenderWidgetHostView* view = render_widget_host->GetView();
  if (view && !render_widget_host->GetView()->IsHTMLFormPopup()) {
    TabDialogs::FromWebContents(source)->HideHungRendererDialog(
"""
new_ok = """    content::RenderWidgetHost* render_widget_host) {
  if (g_astro_renderer_responsive &&
      g_astro_renderer_responsive(source, render_widget_host)) {
    return;
  }
  content::RenderWidgetHostView* view = render_widget_host->GetView();
  if (view && !render_widget_host->GetView()->IsHTMLFormPopup()) {
    TabDialogs::FromWebContents(source)->HideHungRendererDialog(
"""
def edit(s):
    assert s.count(at) == 1 and s.count(old_hung) == 1 and s.count(old_ok) == 1
    i = s.index(at)
    s = s[:i] + decl + s[i:]
    return s.replace(old_hung, new_hung).replace(old_ok, new_ok)
hook(["bool (*g_astro_renderer_unresponsive)(content::WebContents* source,\n",
      "  if (g_astro_renderer_unresponsive &&\n",
      "  if (g_astro_renderer_responsive &&\n"], edit)
PY

hook "$src/chrome/browser/ui/webui_browser/webui_browser_window.cc" "autofill prompts find the host's handler" <<'PY'
old = """WebUIBrowserWindow::GetAutofillBubbleHandler() {
  NOTIMPLEMENTED_LOG_ONCE();
  return nullptr;
}
"""
new = """WebUIBrowserWindow::GetAutofillBubbleHandler() {
  // Astro: AstroCore registers its own handler on the browser.
  return autofill::AutofillBubbleHandler::Get(browser_->GetUnownedUserDataHost());
}
"""
include = '#include "chrome/browser/ui/autofill/autofill_bubble_handler.h"\n'
anchor = '#include "chrome/browser/ui/browser_window/public/browser_window_interface.h"\n'
def edit(s):
    assert s.count(old) == 1 and s.count(anchor) == 1
    s = s.replace(old, new)
    if include not in s:
        s = s.replace(anchor, anchor + include, 1)
    return s
hook(["  return autofill::AutofillBubbleHandler::Get(browser_->GetUnownedUserDataHost());\n"], edit)
PY

hook "$src/chrome/browser/ui/autofill/chrome_autofill_client.cc" "autofill suggestions sit under a guest tab's field" <<'PY'
old = """  // Convert element_bounds to be in screen space.
  const gfx::Rect client_area = web_contents()->GetContainerBounds();
"""
new = """  // Convert element_bounds to be in screen space.
  // Astro: the bounds are in the outermost page's space, so a guest tab's offset isn't added twice.
  const gfx::Rect client_area =
      web_contents()->GetOutermostWebContents()->GetContainerBounds();
"""
def edit(s):
    assert s.count(old) == 1
    return s.replace(old, new)
hook(["  // Astro: the bounds are in the outermost page's space, so a guest tab's offset isn't added twice.\n"], edit)
PY

hook "$src/content/browser/web_contents/web_contents_impl.cc" "a hung page counts DevTools, not the host's client" <<'PY'
at = "bool WebContentsImpl::ShouldIgnoreUnresponsiveRenderer() {\n"
decl = """// Astro: AstroCore keeps its own DevTools client on its tabs; only DevTools itself should hide a hung page.
bool (*g_astro_debugger_attached)(WebContents* contents) = nullptr;

"""
old = """  return DevToolsAgentHost::IsDebuggerAttached(this);
}
"""
new = """  return g_astro_debugger_attached ? g_astro_debugger_attached(this)
                                   : DevToolsAgentHost::IsDebuggerAttached(this);
}
"""
def edit(s):
    assert s.count(at) == 1 and s.count(old) == 1
    i = s.index(at)
    return s[:i] + decl + s[i:].replace(old, new, 1)
hook(["bool (*g_astro_debugger_attached)(WebContents* contents) = nullptr;\n",
      "  return g_astro_debugger_attached ? g_astro_debugger_attached(this)\n"], edit)
PY

hook "$src/chrome/browser/ui/extensions/extension_action_view_model.cc" "action shortcuts reach the host" <<'PY'
old = "void ExtensionActionViewModel::ExecuteUserAction(InvocationSource source) {\n"
decl = """// Astro: a window whose interface AstroCore draws opens an action's popup there when its shortcut is pressed.
bool (*g_astro_extension_action_command)(BrowserWindowInterface* browser,
                                         const extensions::ExtensionId& extension_id) =
    nullptr;

"""
new = decl + old + """  if (source == InvocationSource::kCommand && g_astro_extension_action_command &&
      ExtensionIsValid() &&
      g_astro_extension_action_command(browser_, extension_->id())) {
    return;
  }
"""
def edit(s):
    assert s.count(old) == 1
    return s.replace(old, new)
hook(["bool (*g_astro_extension_action_command)(BrowserWindowInterface* browser,\n",
      "  if (source == InvocationSource::kCommand && g_astro_extension_action_command &&\n"], edit)
PY

hook "$src/chrome/browser/ui/webui_browser/webui_browser_window.cc" "downloads never hold a close" <<'PY'
old = """    base::OnceCallback<void(bool)> callback) {
  NOTIMPLEMENTED_LOG_ONCE();
}
"""
new = """    base::OnceCallback<void(bool)> callback) {
  // Astro: as AstroCore does on macOS, a close goes ahead; Astro asks about downloads before it quits.
  base::SingleThreadTaskRunner::GetCurrentDefault()->PostTask(
      FROM_HERE, base::BindOnce(std::move(callback), true));
}
"""
includes = ['#include "base/functional/bind.h"\n', '#include "base/task/single_thread_task_runner.h"\n']
first = '#include "base/check.h"\n'
def edit(s):
    assert s.count(old) == 1 and s.count(first) == 1
    s = s.replace(old, new)
    for line in includes:
        if line not in s:
            s = s.replace(first, first + line, 1)
    return s
hook(["  // Astro: as AstroCore does on macOS, a close goes ahead; Astro asks about downloads before it quits.\n"], edit)
PY

hook "$src/chrome/browser/ui/webui_browser/webui_browser_window.cc" "window close asks the page" <<'PY'
old = """void WebUIBrowserWindow::OnWindowCloseRequested(
    views::Widget::ClosedReason close_reason) {
"""
new = """// Astro: a close the system asks for (Alt+F4, the taskbar) goes to AstroCore's page, as its close button does.
bool (*g_astro_window_close_requested)(BrowserWindowInterface* browser) =
    nullptr;

""" + old + """  if (g_astro_window_close_requested &&
      g_astro_window_close_requested(browser_.get())) {
    widget_->MakeCloseSynchronous(base::BindOnce(
        &WebUIBrowserWindow::OnWindowCloseRequested, base::Unretained(this)));
    return;
  }
"""
def edit(s):
    assert s.count(old) == 1
    return s.replace(old, new)
hook(["bool (*g_astro_window_close_requested)(BrowserWindowInterface* browser) =\n",
      "  if (g_astro_window_close_requested &&\n"], edit)
PY

hook "$src/chrome/browser/ui/webui_browser/webui_browser_window.cc" "the window's title is its page's" <<'PY'
old = """std::u16string WebUIBrowserWindow::WidgetDelegate::GetWindowTitle() const {
"""
new = old + """#if BUILDFLAG(IS_WIN) || BUILDFLAG(IS_LINUX)
  // Astro: the window's title is the one AstroCore's page gives it, as on macOS.
  if (content::WebContents* page = web_contents_delegate_->web_contents();
      page && !page->GetTitle().empty()) {
    return page->GetTitle();
  }
#endif
"""
def edit(s):
    assert s.count(old) == 1
    return s.replace(old, new)
hook(["  // Astro: the window's title is the one AstroCore's page gives it, as on macOS.\n"], edit)
PY

hook "$src/chrome/browser/renderer_context_menu/render_view_context_menu.cc" "selected text's host items" <<'PY'
at = "void RenderViewContextMenu::InitMenu() {\n"
decl = """// Astro: AstroCore's page adds its own items for selected text (Ask) and runs them.
constexpr int kAstroSelectionFirst = IDC_CONTENT_CONTEXT_CUSTOM_FIRST + 900;
constexpr int kAstroSelectionLast = IDC_CONTENT_CONTEXT_CUSTOM_FIRST + 999;
std::vector<std::u16string> (*g_astro_selection_items)(
    content::WebContents* contents,
    const std::u16string& printable_selection) = nullptr;
void (*g_astro_selection_item_run)(content::WebContents* contents,
                                   size_t index,
                                   const std::u16string& selection,
                                   int event_flags) = nullptr;

"""
items_old = """  if (show_glic && glic_below_search) {
    MaybeAppendOpenGlicItem(/*add_separator=*/false);
  }

"""
items_new = items_old + """  if (g_astro_selection_items && !params_.selection_text.empty() &&
      !params_.is_editable) {
    const std::vector<std::u16string> titles =
        g_astro_selection_items(source_web_contents_, PrintableSelectionText());
    for (size_t i = 0; i < titles.size() &&
                       kAstroSelectionFirst + static_cast<int>(i) <=
                           kAstroSelectionLast;
         ++i) {
      menu_model_.AddItem(kAstroSelectionFirst + static_cast<int>(i),
                          titles[i]);
    }
  }

"""
enabled_old = "bool RenderViewContextMenu::IsCommandIdEnabled(int id) const {\n"
enabled_new = enabled_old + """  if (g_astro_selection_items && id >= kAstroSelectionFirst &&
      id <= kAstroSelectionLast) {
    return true;
  }
"""
run_old = """void RenderViewContextMenu::ExecuteCommand(int id, int event_flags) {
  RenderViewContextMenuBase::ExecuteCommand(id, event_flags);
"""
run_new = """void RenderViewContextMenu::ExecuteCommand(int id, int event_flags) {
  if (g_astro_selection_item_run && id >= kAstroSelectionFirst &&
      id <= kAstroSelectionLast) {
    command_executed_ = true;
    g_astro_selection_item_run(source_web_contents_,
                               static_cast<size_t>(id - kAstroSelectionFirst),
                               params_.selection_text, event_flags);
    return;
  }
  RenderViewContextMenuBase::ExecuteCommand(id, event_flags);
"""
def edit(s):
    assert s.count(at) == 1 and s.count(items_old) == 1
    assert s.count(enabled_old) == 1 and s.count(run_old) == 1
    i = s.index(at)
    s = s[:i] + decl + s[i:]
    s = s.replace(items_old, items_new).replace(enabled_old, enabled_new)
    return s.replace(run_old, run_new)
hook(["std::vector<std::u16string> (*g_astro_selection_items)(\n",
      "  if (g_astro_selection_items && !params_.selection_text.empty() &&\n",
      "  if (g_astro_selection_items && id >= kAstroSelectionFirst &&\n",
      "  if (g_astro_selection_item_run && id >= kAstroSelectionFirst &&\n"], edit)
PY

if [[ $mode == check ]]; then
  exit "$drift"
fi
