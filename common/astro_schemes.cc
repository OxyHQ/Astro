// Copyright 2026 Oxy. Astro product module.

#include "astro/common/astro_schemes.h"

#include <string_view>

#include "astro/common/url_constants.h"

namespace astro {

void AddAstroSchemes(content::ContentClient::Schemes* schemes) {
  // Standard: a scheme that is not standard canonicalises to an OPAQUE origin,
  // which would make every Astro page a unique untrusted origin and defeat
  // both the security boundary and storage partitioning.
  schemes->standard_schemes.push_back(kAstroUIScheme);
  schemes->standard_schemes.push_back(kAstroUIUntrustedScheme);

  // Secure: served locally from the binary, so the powerful-features gate
  // should treat them as trustworthy for the same reason it treats chrome://
  // that way — not as a favour, but because the content does not cross a
  // network.
  schemes->secure_schemes.push_back(kAstroUIScheme);
  schemes->secure_schemes.push_back(kAstroUIUntrustedScheme);

  // Deliberately NOT added here, each because it is a separate decision:
  //   savable_schemes     — whether astro:// content can be written to disk
  //   referrer_schemes    — whether an astro:// page may be a referrer
  //   csp_bypassing_schemes — never; bypassing CSP is the opposite of the point
  // The trusted/untrusted split is enforced by WebUI BINDINGS, not by this
  // list: both schemes are standard and secure, and what separates them is
  // which one may hold privileged bindings. #11's process-model work owns
  // that, and it must not be approximated here.
}

void AddAstroTrustedWebUISchemes(std::vector<std::string>* schemes) {
  schemes->push_back(kAstroUIScheme);
}

void AddAstroUntrustedWebUISchemes(std::vector<std::string>* schemes) {
  schemes->push_back(kAstroUIUntrustedScheme);
}

void AddAstroWebUIRoutingSchemes(std::vector<std::string>* schemes) {
  // BOTH, including the untrusted one: routing is not trust. See the header.
  schemes->push_back(kAstroUIScheme);
  schemes->push_back(kAstroUIUntrustedScheme);
}

bool IsAstroScheme(std::string_view scheme) {
  return scheme == kAstroUIScheme || scheme == kAstroUIUntrustedScheme;
}

}  // namespace astro
