// Copyright 2026 Oxy. Astro product module.

#ifndef ASTRO_COMMON_ASTRO_SCHEMES_H_
#define ASTRO_COMMON_ASTRO_SCHEMES_H_

#include <string>
#include <string_view>
#include <vector>

#include "content/public/common/content_client.h"

namespace astro {

// Adds Astro's schemes to the set Chromium registers at startup.
//
// Called from ChromeContentClient::AddAdditionalSchemes, which is THE embedder
// hook Chromium provides for this: content/public/common/content_client.h:116
// declares `struct Schemes` with twelve independent per-scheme vectors and the
// virtual `AddAdditionalSchemes(Schemes*)`, and content/common/url_schemes.cc
// calls it from the single chokepoint `RegisterContentSchemes` before locking
// the registry. Registration is therefore data, not code, and Astro supplies
// the data.
//
// Astro owns its scheme list HERE rather than having its names inserted into
// Chromium's own `kChromeStandardURLSchemes` array
// (chrome/common/chrome_content_client.cc:187). The difference is not
// stylistic: with the list here, adding a future Astro scheme costs zero
// additional Chromium-owned lines; with the names in Chromium's array, each one
// is another line of downstream delta to carry across every version bump.
//
// Both schemes are standard and secure, and NEITHER is added to
// `savable_schemes`, `referrer_schemes` or any other vector, because each of
// those is a separate capability decision owned by #10 rather than a
// consequence of being a WebUI scheme.
void AddAstroSchemes(content::ContentClient::Schemes* schemes);

// Supplies Astro's TRUSTED WebUI scheme to the embedder hook of the same name.
//
// Kept separate from the untrusted list all the way out to the ContentClient
// boundary. A single flat list would make "is this trusted?" a question each
// caller answers for itself, and a caller answering it wrongly hands privileged
// WebUI bindings to content that exists precisely because it must not have any.
void AddAstroTrustedWebUISchemes(std::vector<std::string>* schemes);

// Supplies Astro's UNTRUSTED WebUI scheme. See above for why this is a second
// function rather than a flag on the first.
void AddAstroUntrustedWebUISchemes(std::vector<std::string>* schemes);

// Adds Astro's schemes to the WebUI ROUTING list.
//
// This is a DIFFERENT question from trust, and the distinction is the whole
// point of there being three functions:
//
//   AddAstroSchemes                    -> the URL parser: standard, secure
//   AddAstroWebUIRoutingSchemes        -> content knows how to SERVE these over
//                                         the WebUI URLLoaderFactory
//   AddAstroTrustedWebUISchemes        -> may enter by the TRUSTED classification
//   AddAstroUntrustedWebUISchemes      -> enters by the UNTRUSTED classification
//
// Membership in the routing list does NOT and MUST NOT raise a scheme's trust
// level. `astro-untrusted` belongs here — without it there is no loader and the
// page cannot be served at all — and it must never thereby acquire privileged
// bindings. Verified against Chromium 146: every consumer of the routing list
// (url_data_manager_backend.cc:66 and :266, content_browser_client.cc:261)
// concerns loading and view-source, and none touches bindings.
void AddAstroWebUIRoutingSchemes(std::vector<std::string>* schemes);

// True when `scheme` is one Astro handles internally.
//
// Used to answer "is this protocol handled?", whose FALSE branch is an escape
// hatch: ChildProcessSecurityPolicyImpl::CanRequestURL ends with
// `return !GetContentClient()->browser()->IsHandledURL(url)`, permitting a URL
// precisely BECAUSE it is assumed destined for an external application. An
// astro:// URL that answered false would therefore be eligible for ShellExecute
// — so an unknown Astro HOST must still be a handled SCHEME, and fail
// internally rather than leaving the browser.
bool IsAstroScheme(std::string_view scheme);

}  // namespace astro

#endif  // ASTRO_COMMON_ASTRO_SCHEMES_H_
