// Copyright 2026 Oxy. Astro product module.

// The three process-model properties of `astro://` that CDP cannot observe.
//
// A CDP session against a running browser can see that `astro://test/` commits,
// what its origin is, and whether `chrome.send` exists. It cannot see the site
// URL, it cannot see the process lock, and it cannot ask a web renderer to
// commit a privileged URL. Those three are what this file measures.
//
// WHY A BROWSER TEST AND NOT A UNIT TEST. Chromium proves the equivalent
// `chrome://` properties in `content_unittests`
// (content/browser/site_instance_impl_unittest.cc:2168,
// content/browser/child_process_security_policy_unittest.cc:400), which reach
// content-internal types — `SiteInfo`, `ProcessLock`,
// `ChildProcessSecurityPolicyImpl`. //astro cannot: `//content/browser:browser`
// restricts `visibility` to content's own targets and
// `//content/browser:for_content_tests` to `//content/test/*`
// (content/browser/BUILD.gn:56-70, :3730-3739), so an //astro test that
// included content/browser/site_info.h would need a Chromium-owned visibility
// change to link and to pass `gn check`.
//
// That constraint turns out to be the right shape anyway. All three properties
// are questions about the CONFIGURED BROWSER — they depend on
// ChromeContentClient::AddAdditionalSchemes and
// ChromeContentBrowserClient::GetAdditionalWebUISchemes actually calling
// Astro's registration functions (chrome/common/chrome_content_client.cc:205,
// chrome/browser/chrome_content_browser_client.cc:2096), not on those functions
// being correct in isolation. A unit test with a hand-written
// ContentBrowserClient would test Astro's functions and skip the wiring; a
// browser test tests the wiring. Every API used below is public
// (content/public/…), so the file costs zero Chromium delta.
//
// WHAT MAKES THE ASSERTIONS DISCRIMINATING. Each test states the value that a
// regression would produce, not merely that the value is "right":
//
//   - The site-URL bug worth guarding is a site URL built from
//     content::kChromeUIScheme rather than astro::kAstroUIScheme, which yields
//     `chrome://test/`. So the test asserts equality with `astro://test/` AND
//     inequality with `chrome://test/`.
//   - The process-lock bug has the same shape, so the lock is probed with the
//     same pair. `chrome://test/` is not a registered WebUI host and does not
//     need to be: CanCommitURL derives a SiteInfo from the URL and compares
//     locks; it never consults WebUIConfigMap.
//
// AN ESCAPE HATCH THAT WOULD HAVE MADE ONE OF THESE PASS FOR THE WRONG REASON.
// `ChildProcessSecurityPolicyImpl::CanRequestURL` ends with
// `return !GetContentClient()->browser()->IsHandledURL(url)`
// (content/browser/child_process_security_policy_impl.cc:1538), permitting a
// URL precisely BECAUSE an unhandled one is assumed destined for an external
// application. Astro is on the handled side of that question:
// `ProfileIOData::IsHandledProtocol` returns true for both Astro schemes
// (chrome/browser/profiles/profile_io_data.cc, the `astro::IsAstroScheme`
// branch). So for a web renderer, `CanRequestURL(astro://test/)` is false
// whether the WebUI process-lock block above it refused
// (:1519-1535) or the final line did — the two paths agree, and the assertion
// cannot tell them apart. `CanRequestURL` is therefore NOT used below as
// evidence of the process-lock enforcement. `CanCommitURL` has no such
// fallback, which is why property (3) is asserted through it.

#include <string>

#include "astro/browser/webui/astro_test_ui.h"
#include "astro/common/url_constants.h"
#include "base/command_line.h"
#include "base/strings/strcat.h"
#include "chrome/test/base/chrome_test_utils.h"
#include "chrome/test/base/platform_browser_test.h"
#include "content/public/browser/child_process_security_policy.h"
#include "content/public/browser/render_frame_host.h"
#include "content/public/browser/render_process_host.h"
#include "content/public/browser/site_instance.h"
#include "content/public/browser/web_contents.h"
#include "content/public/common/content_switches.h"
#include "content/public/common/url_constants.h"
#include "content/public/test/browser_test.h"
#include "content/public/test/browser_test_utils.h"
#include "content/public/test/test_navigation_observer.h"
#include "content/public/test/test_utils.h"
#include "net/dns/mock_host_resolver.h"
#include "net/test/embedded_test_server/embedded_test_server.h"
#include "testing/gtest/include/gtest/gtest.h"
#include "url/gurl.h"
#include "url/origin.h"
#include "url/url_constants.h"

namespace astro {
namespace {

// astro://test/ — the URL under test.
GURL AstroTestURL() {
  return GURL(base::StrCat(
      {kAstroUIScheme, url::kStandardSchemeSeparator, kAstroTestHost, "/"}));
}

// astro-untrusted://test/ — the same HOST behind a different SECURITY
// PRINCIPAL. Used as a negative control: nothing about sharing a host may make
// the trusted process willing to host it.
GURL AstroUntrustedTestURL() {
  return GURL(base::StrCat({kAstroUIUntrustedScheme,
                            url::kStandardSchemeSeparator, kAstroTestHost,
                            "/"}));
}

// chrome://test/ — the value each property under test would take if Astro's
// scheme had not displaced Chromium's. Not a real host; see the file comment
// for why that does not matter.
GURL ChromeFlavouredTestURL() {
  return GURL(base::StrCat({content::kChromeUIScheme,
                            url::kStandardSchemeSeparator, kAstroTestHost,
                            "/"}));
}

class AstroSchemeProcessModelBrowserTest : public PlatformBrowserTest {
 public:
  AstroSchemeProcessModelBrowserTest() = default;

  AstroSchemeProcessModelBrowserTest(
      const AstroSchemeProcessModelBrowserTest&) = delete;
  AstroSchemeProcessModelBrowserTest& operator=(
      const AstroSchemeProcessModelBrowserTest&) = delete;

  ~AstroSchemeProcessModelBrowserTest() override = default;

 protected:
  void SetUpCommandLine(base::CommandLine* command_line) override {
    PlatformBrowserTest::SetUpCommandLine(command_line);

    // Force full site isolation.
    //
    // Not decoration. Without it, whether the http:// renderer below is locked
    // to a site is a property of the machine (memory thresholds) and the
    // platform default, and an unlocked process refuses an astro:// commit for
    // a DIFFERENT reason — `SecurityState::CanCommitURL` finding no grant
    // rather than the process lock rejecting the origin. The test would still
    // be green and would no longer be measuring what it claims to. Same
    // rationale, same helper, as
    // content/browser/site_instance_impl_unittest.cc:1323-1324
    // (IsSuitableForUrlInfoInSitePerProcess).
    content::IsolateAllSitesForTesting(command_line);
  }

  void SetUpOnMainThread() override {
    PlatformBrowserTest::SetUpOnMainThread();
    host_resolver()->AddRule("*", "127.0.0.1");
    ASSERT_TRUE(embedded_test_server()->Start());
  }

  content::WebContents* web_contents() {
    return chrome_test_utils::GetActiveWebContents(this);
  }

  content::RenderFrameHost* main_frame() {
    return web_contents()->GetPrimaryMainFrame();
  }

  content::ChildProcessSecurityPolicy* policy() {
    return content::ChildProcessSecurityPolicy::GetInstance();
  }

  GURL WebURL() {
    return embedded_test_server()->GetURL("a.com", "/title1.html");
  }
};

// Property 1: the site URL of astro://test/ uses `astro`, not `chrome`.
//
// Precedent: content/browser/site_instance_impl_unittest.cc:2201-2203
// (DoWebUIURLsWithSubdomainsUseTLDForProcessLock) asserts
// `EXPECT_EQ(webui_tld_url, webui_tld_site_info.site_url())` — a WebUI URL's
// site URL is its own scheme and host. That test reads `SiteInfo::site_url()`
// directly; the public reading of the same value is
// `SiteInstance::GetSiteURL()` (content/public/browser/site_instance.h:181),
// used the same way at
// chrome/browser/chrome_content_browser_client_browsertest.cc:225.
IN_PROC_BROWSER_TEST_F(AstroSchemeProcessModelBrowserTest,
                       SiteURLUsesTheAstroScheme) {
  ASSERT_TRUE(content::NavigateToURL(web_contents(), AstroTestURL()));

  content::RenderFrameHost* rfh = main_frame();

  // Vacuity floor. A site-URL assertion against a frame that never reached
  // astro://test/ — because registration failed, or the navigation was
  // rewritten — would be measuring some other document. Three independent
  // facts pin that down before anything is claimed about the site URL: the
  // committed URL, the committed origin, and that this really is a privileged
  // WebUI process rather than a page that merely spells its URL that way.
  ASSERT_EQ(AstroTestURL(), rfh->GetLastCommittedURL());
  ASSERT_EQ(url::Origin::Create(AstroTestURL()), rfh->GetLastCommittedOrigin());
  ASSERT_TRUE(policy()->HasWebUIBindings(rfh->GetProcess()->GetDeprecatedID()));

  const GURL site_url = rfh->GetSiteInstance()->GetSiteURL();

  EXPECT_EQ(AstroTestURL(), site_url);
  EXPECT_EQ(kAstroUIScheme, site_url.GetScheme());
  EXPECT_EQ(kAstroTestHost, site_url.GetHost());

  // The regression this test exists for: a site URL composed from Chromium's
  // scheme constant instead of Astro's.
  EXPECT_FALSE(site_url.SchemeIs(content::kChromeUIScheme));
  EXPECT_NE(ChromeFlavouredTestURL(), site_url);
}

// Property 2: the process lock of the astro://test/ process uses `astro`.
//
// Precedent: the second half of the same upstream test,
// content/browser/site_instance_impl_unittest.cc:2206-2208, which asserts
// `GetProcessLockURL()`. `ProcessLock` and `SiteInfo::GetProcessLockURL()` are
// content-internal and have no public value accessor —
// `RenderProcessHost::GetProcessLock()` exists
// (content/public/browser/render_process_host.h:638) but returns a
// forward-declared type. The lock is therefore read through the one public
// function whose answer is decided by it and by nothing else:
// `content::CanCommitURLForTesting`
// (content/public/test/browser_test_utils.h:363) calls
// `ChildProcessSecurityPolicyImpl::CanCommitURL`
// (content/public/test/browser_test_utils.cc:936-939), whose gate for a
// standard-scheme URL is `CanAccessMaybeOpaqueOrigin(…, kCanCommitNewOrigin)`
// (content/browser/child_process_security_policy_impl.cc:1623-1629). That
// access type deliberately bypasses the committed-origin shortcut, so the
// Jail/Citadel comparison against the process lock is "the source of truth"
// (:2483-2487) — i.e. these four answers ARE the lock.
//
// Same public-helper shape as
// chrome/browser/extensions/process_manager_browsertest.cc:839-847, which
// pins the extension process's lock the same way.
IN_PROC_BROWSER_TEST_F(AstroSchemeProcessModelBrowserTest,
                       ProcessLockUsesTheAstroScheme) {
  ASSERT_TRUE(content::NavigateToURL(web_contents(), AstroTestURL()));

  content::RenderFrameHost* rfh = main_frame();
  ASSERT_EQ(AstroTestURL(), rfh->GetLastCommittedURL());

  content::RenderProcessHost* process = rfh->GetProcess();
  const int astro_id = process->GetDeprecatedID();

  // Vacuity floor. Every EXPECT_FALSE below is also what an UNLOCKED process
  // would produce once site isolation is on, so "is it locked at all" has to be
  // established first or the four negatives prove nothing.
  ASSERT_TRUE(process->IsProcessLockedToSiteForTesting());

  // The lock admits astro://test/ …
  EXPECT_TRUE(content::CanCommitURLForTesting(astro_id, AstroTestURL()));

  // … and nothing else. The first is the regression under guard: if the lock
  // were built from Chromium's scheme constant, these two answers would swap.
  EXPECT_FALSE(content::CanCommitURLForTesting(astro_id,
                                               ChromeFlavouredTestURL()));

  // The untrusted sibling shares the host and is still a different principal,
  // so the trusted process must not host it. This is the assertion that would
  // fail first if `astro` and `astro-untrusted` were ever collapsed into one
  // scheme with a flag.
  EXPECT_FALSE(content::CanCommitURLForTesting(astro_id,
                                               AstroUntrustedTestURL()));

  EXPECT_FALSE(content::CanCommitURLForTesting(astro_id, WebURL()));
}

// Property 3, first half: the policy refuses an astro:// commit in an
// http:// renderer.
//
// Precedent:
// content/browser/child_process_security_policy_unittest.cc:442,451-456
// (StandardSchemesTest) asserts exactly this for chrome://, with
// `EXPECT_FALSE(p->CanCommitURL(kRendererID, GetWebUIURL("foo/bar")))`. The
// public form of that call is `content::CanCommitURLForTesting`.
//
// WHICH CHECK REFUSES. With site isolation on, the http:// process carries a
// process lock for its own site, and `CanCommitURL` reaches
// `CanAccessMaybeOpaqueOrigin(child_id, url, false, kCanCommitNewOrigin)`
// (content/browser/child_process_security_policy_impl.cc:1623-1629) BEFORE any
// scheme allowlist. That call computes the lock astro://test/ would require,
// compares it with the lock the process actually has, and returns false —
// `LogCanCommitUrlFailureReason("cannot_access_origin")` at :1628. The
// scheme-grant path below it (`SecurityState::CanCommitURL`, :651-667) would
// also refuse, but only second, and the assertions on
// `CanAccessDataForOrigin`/`HostsOrigin` below show the answer is already no at
// the isolation gate. The failure reason itself is written to a crash key
// rather than a histogram (:249-253), so it cannot be asserted on directly.
IN_PROC_BROWSER_TEST_F(AstroSchemeProcessModelBrowserTest,
                       WebRendererCannotCommitAnAstroURL) {
  ASSERT_TRUE(content::NavigateToURL(web_contents(), WebURL()));

  content::RenderFrameHost* rfh = main_frame();
  ASSERT_EQ(WebURL(), rfh->GetLastCommittedURL());

  const int web_id = rfh->GetProcess()->GetDeprecatedID();

  // Vacuity floor, as above: an unlocked process would refuse for a different
  // reason, and the process must also not already hold WebUI bindings, or the
  // rest of the test is about a process that is not the web process.
  ASSERT_TRUE(rfh->GetProcess()->IsProcessLockedToSiteForTesting());
  ASSERT_FALSE(policy()->HasWebUIBindings(web_id));

  // The commit is refused, for both Astro principals.
  EXPECT_FALSE(content::CanCommitURLForTesting(web_id, AstroTestURL()));
  EXPECT_FALSE(content::CanCommitURLForTesting(web_id,
                                               AstroUntrustedTestURL()));

  // …and it is the site-isolation enforcement that says so: the two public
  // faces of the same check, on the same process and the same origin, agree.
  EXPECT_FALSE(policy()->CanAccessDataForOrigin(
      web_id, url::Origin::Create(AstroTestURL())));
  EXPECT_FALSE(
      policy()->HostsOrigin(web_id, url::Origin::Create(AstroTestURL())));

  // Positive control, in the same process, at the same moment. Without it,
  // every EXPECT_FALSE above is satisfied by a policy that says no to
  // everything — a broken security state, a stale child id, a process that has
  // already exited.
  EXPECT_TRUE(content::CanCommitURLForTesting(web_id, WebURL()));
  EXPECT_TRUE(
      policy()->CanAccessDataForOrigin(web_id, url::Origin::Create(WebURL())));
}

// Used to reach the BROWSER-side check.
//
// Same device, and same reason, as
// content/browser/webui/web_ui_navigation_browsertest.cc:863-872
// (WebUINavigationDisabledWebSecurityBrowserTest): with web security on, the
// renderer's own `SecurityOrigin::CanDisplay` may refuse first
// (third_party/blink/renderer/platform/weborigin/security_origin.cc,
// via FrameLoader::AllowRequestForThisFrame at
// third_party/blink/renderer/core/loader/frame_loader.cc:564-572) and the
// navigation never reaches the browser at all — which is exactly the shape of
// attempt that proves nothing. `--disable-web-security` sets
// `universal_access_`, CanDisplay returns true unconditionally, and the
// request arrives at the browser process where the check under test lives.
//
// Note this matters TODAY for a second reason, and the second reason may not
// last: `astro` is not registered display-isolated in the renderer.
// RenderThreadImpl::RegisterSchemes hard-codes content::kChromeUIScheme
// (content/renderer/render_thread_impl.cc:815-878) and offers the embedder no
// hook for additional WebUI schemes, so Blink currently has no reason to refuse
// first. This fixture does not depend on that staying true — which is the
// point of using the switch rather than relying on the gap.
class AstroSchemeWebSecurityDisabledBrowserTest
    : public AstroSchemeProcessModelBrowserTest {
 protected:
  void SetUpCommandLine(base::CommandLine* command_line) override {
    AstroSchemeProcessModelBrowserTest::SetUpCommandLine(command_line);
    command_line->AppendSwitch(switches::kDisableWebSecurity);
  }
};

// Property 3, second half: the attempt is real, and it is refused.
//
// Precedent: content/browser/webui/web_ui_navigation_browsertest.cc:894-909
// (DisallowNavigatingToChromeSchemeFromWebFrameBrowserCheck) — a web page sets
// `location.href` to a WebUI URL and the browser commits
// content::kBlockedURL instead.
IN_PROC_BROWSER_TEST_F(AstroSchemeWebSecurityDisabledBrowserTest,
                       WebRendererNavigationToAnAstroURLIsBlocked) {
  ASSERT_TRUE(content::NavigateToURL(web_contents(), WebURL()));

  const int web_id = main_frame()->GetProcess()->GetDeprecatedID();
  ASSERT_FALSE(policy()->HasWebUIBindings(web_id));

  content::TestNavigationObserver observer(web_contents());
  ASSERT_TRUE(content::ExecJs(
      web_contents(), content::JsReplace("location.href = $1",
                                         AstroTestURL())));
  observer.Wait();

  // The navigation was attempted and did not arrive.
  EXPECT_EQ(GURL(content::kBlockedURL), web_contents()->GetLastCommittedURL());
  EXPECT_NE(AstroTestURL(), web_contents()->GetLastCommittedURL());

  // And the attempt bought no privilege on the way: the page is still in the
  // web renderer, and that renderer still has no WebUI bindings.
  EXPECT_EQ(web_id, main_frame()->GetProcess()->GetDeprecatedID());
  EXPECT_FALSE(policy()->HasWebUIBindings(web_id));
  EXPECT_FALSE(content::CanCommitURLForTesting(web_id, AstroTestURL()));
}

}  // namespace
}  // namespace astro
