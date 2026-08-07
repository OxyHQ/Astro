// Copyright 2026 Oxy. Astro product module.

#ifndef ASTRO_BROWSER_WEBUI_ASTRO_TEST_UI_H_
#define ASTRO_BROWSER_WEBUI_ASTRO_TEST_UI_H_

#include "content/public/browser/web_ui_controller.h"
#include "content/public/browser/webui_config.h"
#include "ui/webui/untrusted_web_ui_controller.h"

namespace content {
class WebUI;
}  // namespace content

namespace astro {

// The host served by BOTH principals declared below.
//
// It is deliberately the same host on purpose: `astro://test/` and
// `astro-untrusted://test/` sharing a host is exactly the case where a reader
// is most likely to assume they are one thing with two spellings. They are not.
// The host is a name; the SCHEME is the security principal, and url::Origin
// includes the scheme, so the two URLs produce two different origins with no
// relationship to each other beyond the coincidence of the string "test".
//
// This page is a diagnostic, and temporary. It exists to prove that `astro://`
// is a first-class scheme end to end — registration, navigation, resource
// service, origin, bindings — and it should be deleted once something real
// occupies that ground. Nothing should be built on top of it.
inline constexpr char kAstroTestHost[] = "test";

class AstroTestUI;
class AstroTestUntrustedUI;

// ---------------------------------------------------------------------------
// Trusted: astro://test/
// ---------------------------------------------------------------------------

// Declares the trusted page to content::WebUIConfigMap.
//
// The scheme is passed to the content::WebUIConfig constructor
// (content/public/browser/webui_config.h:35) rather than being implied, which
// is what lets one config type serve a non-Chromium scheme at all: the map
// stores configs keyed by url::Origin built from `scheme()` + `host()`
// (content/public/browser/webui_config_map.cc, AddWebUIConfigImpl).
class AstroTestUIConfig : public content::DefaultWebUIConfig<AstroTestUI> {
 public:
  AstroTestUIConfig();
  ~AstroTestUIConfig() override;
};

// The trusted controller.
//
// Derives from content::WebUIController directly, which is what upstream's
// simple trusted pages do (e.g. AccessibilityUI,
// chrome/browser/ui/webui/accessibility/accessibility_ui.cc:622). It therefore
// keeps content::WebUIImpl's DEFAULT bindings, which are
// `BindingsPolicySet({BindingsPolicyValue::kWebUi})`
// (content/browser/webui/web_ui_impl.h:142). That is the whole difference
// between this class and the untrusted one below, and it is not visible in
// this class because it is an inherited default — which is precisely why the
// untrusted class states its own position explicitly instead of relying on a
// different default.
class AstroTestUI : public content::WebUIController {
 public:
  explicit AstroTestUI(content::WebUI* web_ui);
  AstroTestUI(const AstroTestUI&) = delete;
  AstroTestUI& operator=(const AstroTestUI&) = delete;
  ~AstroTestUI() override;
};

// ===========================================================================
// THE TRUSTED / UNTRUSTED BOUNDARY
//
// The four types in this header look like two copies of the same thing with a
// different string in the constructor. They are not, and collapsing them —
// into one config parameterised by scheme, one controller with a `bool
// trusted`, or one shared data source — would destroy the only property they
// exist to provide.
//
// What actually differs, mechanically:
//
//   1. ORIGIN. url::Origin includes the scheme, so `astro://test` and
//      `astro-untrusted://test` are distinct origins. Every same-origin check
//      in the browser and the renderer — storage partitioning, CSP `'self'`,
//      postMessage, fetch — therefore separates them for free. A single
//      config parameterised by scheme would still produce two origins, but it
//      would put the choice of which one on a call site rather than in a type,
//      and a call site is a place where the wrong value can be passed.
//
//   2. BINDINGS. content::WebUIImpl defaults to
//      `BindingsPolicySet({BindingsPolicyValue::kWebUi})`
//      (content/browser/webui/web_ui_impl.h:142). That binding is what causes
//      the renderer to install `chrome.send`
//      (content/renderer/web_ui_extension.cc:94-96, installed at :113-123),
//      which is a direct channel into the browser process.
//      ui::UntrustedWebUIController's constructor CLEARS the set
//      (ui/webui/untrusted_web_ui_controller.cc:13-17) and reports
//      TrustPolicy::kUntrusted (:21-24), which content uses to pick the
//      untrusted Mojo interface broker registry
//      (content/browser/webui/web_ui_impl.cc:303-311). A single controller
//      type would have to decide this at runtime; the failure mode of getting
//      that decision wrong is handing a browser-process channel to content
//      that exists specifically because it must not have one.
//
//   3. REGISTRATION PATH. content::WebUIConfigMap has two entry points,
//      AddWebUIConfig and AddUntrustedWebUIConfig, and each CHECKs that the
//      config's scheme belongs to its own set. Upstream states why they are
//      two functions rather than one in
//      content/public/browser/webui_config_map.h:52-54: so a reader can tell
//      which kind is being added. That reasoning is the same reasoning as
//      this comment.
//
// (2) and (3) are held as TWO INDEPENDENT GUARANTEES on purpose, and the
// redundancy between them must not be optimised away. The registration path
// decides trust from the SCHEME; the untrusted controller clears its bindings
// from its own constructor, deciding nothing from the scheme at all. Because
// neither is derived from the other, no single mistake carries privileged
// bindings across this line — not a config handed to the wrong add function,
// not a scheme placed in the wrong embedder list. AstroTestUntrustedUI's
// constructor states its half explicitly even though its base class has
// already done it, and says at length why.
//
// The tempting simplification is a helper that turns one into the other — a
// function mapping the trusted origin to "its" untrusted counterpart, or a
// shared WebUIDataSource. Do not write one. There is no counterpart
// relationship: they are two principals that happen to serve the same host,
// and any code that treats one as derivable from the other is code that will
// eventually be asked to derive a privilege from an unprivileged thing.
// ===========================================================================

// ---------------------------------------------------------------------------
// Untrusted: astro-untrusted://test/
// ---------------------------------------------------------------------------

// Declares the untrusted page to content::WebUIConfigMap.
//
// Registered through WebUIConfigMap::AddUntrustedWebUIConfig, never
// AddWebUIConfig. See RegisterAstroUntrustedWebUIConfigs() in
// astro_web_ui_configs.h.
class AstroTestUntrustedUIConfig
    : public content::DefaultWebUIConfig<AstroTestUntrustedUI> {
 public:
  AstroTestUntrustedUIConfig();
  ~AstroTestUntrustedUIConfig() override;
};

// The untrusted controller.
//
// Derives from ui::UntrustedWebUIController rather than re-implementing what
// that class does, which is the same choice upstream's untrusted pages make
// (chrome/browser/ui/webui/print_preview/print_preview_ui_untrusted.h:31).
// The base class is 25 lines and does exactly two things — clear the bindings
// set and return TrustPolicy::kUntrusted — but they are the two things that
// define what "untrusted" means here, and having them in one shared place is
// how a future change to that definition reaches every untrusted page at once.
//
// Inheriting them is not the same as depending on them. The constructor
// re-clears the bindings set and CHECKs the result, so this class holds the
// guarantee itself rather than borrowing it. See the boundary comment above
// for why that redundancy is deliberate, and the constructor for what the
// CHECK actually catches.
class AstroTestUntrustedUI : public ui::UntrustedWebUIController {
 public:
  explicit AstroTestUntrustedUI(content::WebUI* web_ui);
  AstroTestUntrustedUI(const AstroTestUntrustedUI&) = delete;
  AstroTestUntrustedUI& operator=(const AstroTestUntrustedUI&) = delete;
  ~AstroTestUntrustedUI() override;
};

}  // namespace astro

#endif  // ASTRO_BROWSER_WEBUI_ASTRO_TEST_UI_H_
