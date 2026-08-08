// Copyright 2026 Oxy. Astro product module.

#ifndef ASTRO_COMMON_URL_CONSTANTS_H_
#define ASTRO_COMMON_URL_CONSTANTS_H_

namespace astro {

// Astro's WebUI schemes.
//
// `inline constexpr char[]`, header-only and with no `.cc`, mirroring
// content/public/common/url_constants.h:21,23 — where `kChromeUIScheme` and
// `kChromeUIUntrustedScheme` are declared the same way and
// content/public/common/url_constants.cc DOES NOT EXIST
// (content/public/common/BUILD.gn:224 lists the header alone).
//
// These two are DISTINCT SECURITY PRINCIPALS, not a scheme and a variant of it.
// `astro` is privileged and serves trusted product surfaces; `astro-untrusted`
// exists precisely so that content which must NOT hold those privileges has
// somewhere to live. Anything that blurs them — a shared origin, a shared
// process, a helper that maps one to the other — defeats the reason both
// exist.
//
// Neither name is claimed by upstream. Measured at the locked Chromium commit
// ae03f7fb2cf1215853896d6a4c15fdceee2badb7:
//
//   git grep -nE '"astro"|"astro-untrusted"|"astro://"' -- '*.cc' '*.h' '*.mojom' '*.java'
//     -> zero matches
//   control, same command shape, for a scheme that does exist:
//   git grep -nE '"chrome-untrusted"' -- '*.cc' '*.h'   -> 9 files
//
// NEITHER of these may ever be used as the OS-registered direct-launch scheme.
// Upstream keeps those separate on purpose: its internal scheme is `chrome`
// while its direct-launch scheme is the different string `google-chrome`
// (chrome/install_static/install_constants.h:102-103,
// chrome/browser/shell_integration_linux.cc:517,924). Registering a privileged
// internal scheme with the OS would let any web page link into it. The product
// manifest carries a validator rule forbidding it.
inline constexpr char kAstroUIScheme[] = "astro";
inline constexpr char kAstroUIUntrustedScheme[] = "astro-untrusted";

// Hosts Astro's own WebUI app serves.
//
// One entry per page, and each one is an ORIGIN: astro://settings-next and a
// future astro://history are different security principals served the same
// bundle, which is what lets the extension API grants stay per page.
//
// `settings-next` rather than `settings` on purpose. Chromium's own settings
// page keeps serving astro://settings until the Bloom one covers what it
// covers; a half-built replacement occupying the real URL is worse than an
// obviously separate one. The rename is the cutover.
inline constexpr char kAstroSettingsNextHost[] = "settings-next";

}  // namespace astro

#endif  // ASTRO_COMMON_URL_CONSTANTS_H_
