// Copyright 2026 Oxy. Astro product module.

#include "astro/browser/webui/astro_test_ui.h"

#include <string>
#include <string_view>
#include <utility>

#include "astro/common/url_constants.h"
#include "base/check.h"
#include "base/containers/span.h"
#include "base/functional/bind.h"
#include "base/memory/ref_counted_memory.h"
#include "base/memory/scoped_refptr.h"
#include "base/strings/strcat.h"
#include "base/strings/string_util.h"
#include "content/public/browser/web_contents.h"
#include "content/public/browser/web_ui.h"
#include "content/public/browser/web_ui_data_source.h"
#include "content/public/common/bindings_policy.h"
#include "services/network/public/mojom/content_security_policy.mojom.h"
#include "url/url_constants.h"

namespace astro {

namespace {

// The single subresource the page loads. Same-origin, so `'self'` in the CSP
// below is the whole allowance it needs.
constexpr char kScriptPath[] = "astro_test.js";

// The page, as bytes, compiled into the binary.
//
// A product page would ship its resources through grit and a .pak. This one
// cannot, and the reason is a constraint rather than a preference: a generated
// .pak has to be listed in Chromium's own pak assembly
// (chrome/chrome_paks.gni and chrome/browser/resources/BUILD.gn), and //astro
// is built on the rule that adding an Astro surface costs zero Chromium-owned
// lines. A string constant keeps that delta at zero. It is also honest about
// what this page is: something to look at once and delete, not a foundation.
//
// `$1` is the URL the browser process believes it registered. It is
// substituted from a value this file builds out of astro::kAstroUIScheme /
// kAstroUIUntrustedScheme and kAstroTestHost, so it is a compile-time-derived
// constant and never attacker-influenced. Nothing else is interpolated, and
// nothing here should grow a second placeholder without revisiting that.
constexpr char kPageHtml[] = R"HTML(<!doctype html>
<meta charset="utf-8">
<meta name="color-scheme" content="light dark">
<title>$1</title>

<p id="astro-marker">ASTRO_TEST_WEBUI_OK</p>

<h1>Astro scheme diagnostic</h1>

<p>Temporary page. It exists to prove that <code>astro://</code> is a real
scheme served by a real principal, and that its trusted and untrusted halves
are two principals rather than one. It should be deleted once something real
occupies this host.</p>

<p>The first row below is what the <em>browser process</em> believes it
registered. Every row after it is what the <em>page</em> reports about itself.
They should agree. A disagreement is the finding.</p>

<dl>
  <dt>Registered by the browser process as</dt>
  <dd><code>$1</code></dd>

  <dt><code>location.href</code></dt>
  <dd><code id="href">script did not run</code></dd>

  <dt><code>window.origin</code></dt>
  <dd><code id="origin">script did not run</code></dd>

  <dt><code>window.isSecureContext</code></dt>
  <dd><code id="secure">script did not run</code></dd>

  <dt><code>chrome.send</code> &mdash; privileged WebUI binding</dt>
  <dd><code id="chromesend">script did not run</code></dd>

  <dt><code>Mojo</code> &mdash; MojoJS binding</dt>
  <dd><code id="mojo">script did not run</code></dd>
</dl>

<script src="astro_test.js"></script>
)HTML";

// The script, served to BOTH principals byte for byte.
//
// That is deliberate and it is the point: every value it reports is read from
// the page's own environment, so any difference a human sees between
// astro://test/ and astro-untrusted://test/ was produced entirely by the
// browser and not by this file. Identical input, different output, is what
// makes the page evidence rather than an assertion.
constexpr char kPageScript[] = R"JS(// Copyright 2026 Oxy. Astro product module.

function report(id, value) {
  const element = document.getElementById(id);
  if (!element) {
    return;
  }
  // textContent, never innerHTML. The WebUI CSP defaults include
  // `require-trusted-types-for 'script'`
  // (content/public/browser/url_data_source.cc:82-85), under which an
  // innerHTML assignment throws instead of rendering.
  element.textContent = value;
}

report('href', location.href);
report('origin', window.origin);
report('secure', String(window.isSecureContext));

// `window.chrome` exists on ordinary web pages in this browser, so its
// presence proves nothing at all. `chrome.send` is the function the renderer
// installs only when BindingsPolicyValue::kWebUi is enabled
// (content/renderer/web_ui_extension.cc:94-96, installed at :113-123), which
// makes it the honest test of whether this page holds privileged bindings.
//
// Expected: present on astro://test/, ABSENT on astro-untrusted://test/. If it
// is ever present on the untrusted page, the two principals have collapsed and
// untrusted content is holding a channel into the browser process.
report(
    'chromesend',
    typeof chrome !== 'undefined' && typeof chrome.send === 'function'
        ? 'present'
        : 'absent');

// Mojo is gated separately, on BindingsPolicyValue::kMojoWebUi
// (content/renderer/render_frame_impl.cc:2490-2494), which neither page asks
// for. Expected absent on BOTH. It is listed so that "trusted" is not read as
// "everything is switched on".
report('mojo', typeof Mojo !== 'undefined' ? 'present' : 'absent');
)JS";

// The URL each principal serves, built from the scheme constants rather than
// written out, so that renaming a scheme cannot leave a stale string behind in
// the one place a human is reading to check the scheme.
std::string TrustedPageUrl() {
  return base::StrCat(
      {kAstroUIScheme, url::kStandardSchemeSeparator, kAstroTestHost, "/"});
}

std::string UntrustedPageUrl() {
  return base::StrCat({kAstroUIUntrustedScheme, url::kStandardSchemeSeparator,
                       kAstroTestHost, "/"});
}

bool ShouldHandleRequest(const std::string& path) {
  return path.empty() || path == kScriptPath;
}

void HandleRequest(const std::string& registered_as,
                   const std::string& path,
                   content::WebUIDataSource::GotDataCallback callback) {
  if (path.empty()) {
    std::move(callback).Run(base::MakeRefCounted<base::RefCountedString>(
        base::ReplaceStringPlaceholders(
            kPageHtml, base::span_from_ref(registered_as), nullptr)));
    return;
  }

  if (path == kScriptPath) {
    std::move(callback).Run(
        base::MakeRefCounted<base::RefCountedString>(std::string(kPageScript)));
    return;
  }

  // Unreachable while this function and ShouldHandleRequest above stay in
  // step, and it must fail rather than guess if they ever drift. A null
  // response is how content spells "no such resource"
  // (content/browser/webui/web_ui_data_source_impl.cc:509-512), so an unknown
  // path under a known host fails inside the browser instead of falling
  // through to anything else.
  std::move(callback).Run(nullptr);
}

// Builds and installs the data source for ONE principal.
//
// Every value that differs between the trusted and untrusted pages arrives
// here as a parameter, and each parameter has exactly one caller. There is no
// runtime "am I trusted?" branch anywhere in this file, and there should never
// be one: see the boundary comment in astro_test_ui.h.
//
// One call is deliberately absent from this function and from both callers:
// web_ui->AddRequestableScheme(). It looks like the call you would need to let
// an astro:// page load its own astro:// script, and it is not. Committing the
// WebUI URL already grants the renderer request access to the whole scheme
// (content/browser/child_process_security_policy_impl.cc:1233-1237, reached
// from GrantCommitURL because astro:// is a registered standard scheme and so
// yields a non-opaque origin), which is already more than a same-origin
// subresource needs. Adding the call would widen a grant that is wide enough
// already, for no effect. If an astro:// subresource ever does fail to load,
// the things to look at are the origin grant and the data-source lookup, not
// this.
void AddDataSource(content::WebUI* web_ui,
                   const std::string& source_name,
                   std::string_view scheme,
                   const std::string& registered_as) {
  content::WebUIDataSource* source = content::WebUIDataSource::CreateAndAdd(
      web_ui->GetWebContents()->GetBrowserContext(), source_name);

  // REQUIRED, not defensive.
  //
  // URLDataSource::ShouldServiceRequest defaults to accepting only
  // chrome-devtools://, chrome:// and chrome-untrusted://
  // (content/public/browser/url_data_source.cc:133-138). Without this call an
  // astro:// request reaching this source is refused with ERR_INVALID_URL at
  // content/browser/webui/web_ui_url_loader_factory.cc:141-145 — the page
  // simply does not load. content/public/browser/web_ui_data_source.h:181-182
  // documents this as the hook for exactly that case.
  //
  // It is also what makes the two principals fail CLOSED rather than fail INTO
  // each other. content's data-source lookup special-cases the literal string
  // "chrome-untrusted" and otherwise keys on HOST alone
  // (content/browser/webui/url_data_manager_backend.cc:137-161), so until that
  // generalises, a request for astro-untrusted://test/ locates the TRUSTED
  // source by host. With this call the trusted source then declines it —
  // GURL::SchemeIs compares the parsed scheme exactly, so "astro" does not
  // match "astro-untrusted" — and the untrusted page fails to load. A broken
  // untrusted page is an acceptable outcome; an untrusted URL served by the
  // trusted principal is not.
  source->SetSupportedScheme(scheme);

  // Content picks its CSP defaults by a LITERAL prefix test for
  // "chrome-untrusted://" on the source name
  // (content/public/browser/url_data_source.cc:20-28), so an astro-untrusted://
  // source silently receives the defaults meant for a TRUSTED page: no
  // default-src, no base-uri, no form-action, and a script-src that allows
  // chrome://resources (:69-91).
  //
  // That last one is not theoretical. Content grants every WebUI process
  // request access to the chrome:// scheme unconditionally, untrusted pages
  // included — content/browser/webui/web_ui_impl.cc:204 seeds
  // requestable_schemes_ with {chrome, file} and
  // content/browser/renderer_host/render_frame_host_impl.cc:13283-13287 grants
  // every entry. The CSP is therefore the thing standing between untrusted
  // content and chrome://resources, not a second opinion about it.
  //
  // Rather than reproduce content's trusted/untrusted branch here — which
  // would be a second place where the trust question is answered, and so a
  // second place to answer it wrongly — both principals get the STRICTER
  // policy. This page loads one same-origin script and nothing else, so the
  // strict policy costs it nothing. Naming chrome://resources in an astro://
  // page's CSP would assert a cross-scheme trust relationship that nothing has
  // established, which is the opposite of what this page is for.
  source->OverrideContentSecurityPolicy(
      network::mojom::CSPDirectiveName::DefaultSrc, "default-src 'self';");
  source->OverrideContentSecurityPolicy(
      network::mojom::CSPDirectiveName::ScriptSrc, "script-src 'self';");
  source->OverrideContentSecurityPolicy(
      network::mojom::CSPDirectiveName::BaseURI, "base-uri 'none';");
  source->OverrideContentSecurityPolicy(
      network::mojom::CSPDirectiveName::FormAction, "form-action 'none';");

  // The filter is consulted before any resource-id lookup
  // (content/browser/webui/web_ui_data_source_impl.cc:492-496), so it fully
  // owns this host's paths and no grit resource map is involved.
  source->SetRequestFilter(base::BindRepeating(&ShouldHandleRequest),
                           base::BindRepeating(&HandleRequest, registered_as));
}

}  // namespace

// ---------------------------------------------------------------------------
// Trusted: astro://test/
// ---------------------------------------------------------------------------

AstroTestUIConfig::AstroTestUIConfig()
    : DefaultWebUIConfig(kAstroUIScheme, kAstroTestHost) {}

AstroTestUIConfig::~AstroTestUIConfig() = default;

AstroTestUI::AstroTestUI(content::WebUI* web_ui)
    : content::WebUIController(web_ui) {
  // Source name is the bare host. content::WebUIDataSource::CreateAndAdd
  // documents this as the chrome://-shaped form
  // (content/public/browser/web_ui_data_source.h:44-53), and content's lookup
  // reaches it through the host branch at
  // content/browser/webui/url_data_manager_backend.cc:149.
  AddDataSource(web_ui, std::string(kAstroTestHost), kAstroUIScheme,
                TrustedPageUrl());
}

AstroTestUI::~AstroTestUI() = default;

// ---------------------------------------------------------------------------
// Untrusted: astro-untrusted://test/
// ---------------------------------------------------------------------------

AstroTestUntrustedUIConfig::AstroTestUntrustedUIConfig()
    : DefaultWebUIConfig(kAstroUIUntrustedScheme, kAstroTestHost) {}

AstroTestUntrustedUIConfig::~AstroTestUntrustedUIConfig() = default;

AstroTestUntrustedUI::AstroTestUntrustedUI(content::WebUI* web_ui)
    : ui::UntrustedWebUIController(web_ui) {
  // GUARANTEE 2 OF 2, and deliberately redundant with guarantee 1. The
  // redundancy is the requirement, not an oversight.
  //
  // Guarantee 1 is the registration path: this page reaches the map only
  // through WebUIConfigMap::AddUntrustedWebUIConfig, which CHECKs the config's
  // scheme against the untrusted set. Guarantee 2 is this: the controller
  // refuses privileged bindings on its own account, making no reference to
  // what scheme it was registered under. Neither is derived from the other, so
  // no single mistake — a config passed to the wrong add function, a scheme
  // landing in the wrong embedder list — carries privileged bindings across
  // the boundary.
  //
  // ui::UntrustedWebUIController's constructor has already done exactly this
  // (ui/webui/untrusted_web_ui_controller.cc:13-17), so against today's code
  // this line changes nothing, and that is not the point. The point is that
  // the guarantee is asserted by the class that depends on it: if the base
  // class is swapped out, or stops clearing, Astro's untrusted page must not
  // silently acquire chrome.send as a side effect.
  //
  // The CHECK is what makes this a verified guarantee rather than a second
  // assertion of the same thing. WebUIImpl::SetBindings currently ASSIGNS
  // (content/browser/webui/web_ui_impl.cc:356-358) while the renderer-side
  // RenderFrameImpl::AllowBindings UNIONS
  // (content/renderer/render_frame_impl.cc:2486-2488). If the browser-side
  // setter ever moved to union semantics, clearing would quietly become a
  // no-op while every line above still read as correct; the CHECK fails loudly
  // instead of leaving that to be discovered.
  //
  // A constructor is early enough for this to bind: the controller is created
  // at content/browser/renderer_host/navigation_request.cc:11510-11512, and
  // the bindings it settled on are read immediately after at :11518 and again
  // at content/browser/renderer_host/render_frame_host_impl.cc:13292.
  web_ui->SetBindings(content::BindingsPolicySet());
  CHECK(web_ui->GetBindings().empty());

  // Source name is the FULL origin URL with a trailing slash, not the bare
  // host — the second form CreateAndAdd documents
  // (content/public/browser/web_ui_data_source.h:44-53), and the shape every
  // upstream untrusted source uses (chrome::kChromeUIUntrustedPrintURL is
  // "chrome-untrusted://print/", chrome/common/webui_url_constants.h:326-327).
  //
  // Using the bare host here would put this source in the same key space as
  // the trusted one — the two would be "test" and "test" — and content's
  // AddDataSource replaces on collision
  // (content/browser/webui/url_data_manager_backend.cc:116-124), so one
  // principal would silently take over the other's resources depending on
  // which page was visited first. The distinct key is not cosmetic.
  AddDataSource(web_ui, UntrustedPageUrl(), kAstroUIUntrustedScheme,
                UntrustedPageUrl());
}

AstroTestUntrustedUI::~AstroTestUntrustedUI() = default;

}  // namespace astro
