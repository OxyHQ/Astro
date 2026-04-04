// Copyright 2026 Oxy. All rights reserved.
// Use of this source code is governed by a BSD-style license.

#include "chrome/browser/oxy/adblock/astro_adblock_tab_helper.h"

#include "base/json/json_reader.h"
#include "base/logging.h"
#include "base/strings/utf_string_conversions.h"
#include "chrome/browser/oxy/adblock/astro_adblock_service.h"
#include "chrome/browser/oxy/adblock/astro_adblock_service_factory.h"
#include "chrome/browser/profiles/profile.h"
#include "content/public/browser/navigation_handle.h"
#include "content/public/browser/render_frame_host.h"
#include "content/public/browser/web_contents.h"

namespace oxy::adblock {

AstroAdBlockTabHelper::AstroAdBlockTabHelper(
    content::WebContents* web_contents)
    : content::WebContentsObserver(web_contents),
      content::WebContentsUserData<AstroAdBlockTabHelper>(*web_contents) {}

AstroAdBlockTabHelper::~AstroAdBlockTabHelper() = default;

int AstroAdBlockTabHelper::GetTotalBlockedCount() const {
  return blocked_count_;
}

const std::set<GURL>& AstroAdBlockTabHelper::GetBlockedAdsList() const {
  return blocked_ads_;
}

void AstroAdBlockTabHelper::OnResourceBlocked(const GURL& blocked_url) {
  if (blocked_ads_.insert(blocked_url).second) {
    blocked_count_++;
    NotifyBlockedCountChanged();
  }
}

void AstroAdBlockTabHelper::AddObserver(Observer* observer) {
  observers_.AddObserver(observer);
}

void AstroAdBlockTabHelper::RemoveObserver(Observer* observer) {
  observers_.RemoveObserver(observer);
}

void AstroAdBlockTabHelper::PrimaryPageChanged(content::Page& page) {
  ResetPageState();
}

void AstroAdBlockTabHelper::DidFinishNavigation(
    content::NavigationHandle* navigation_handle) {
  if (!navigation_handle->IsInPrimaryMainFrame() ||
      !navigation_handle->HasCommitted() ||
      navigation_handle->IsSameDocument()) {
    return;
  }

  InjectCosmeticFilters(navigation_handle->GetURL());
}

void AstroAdBlockTabHelper::WebContentsDestroyed() {
  ResetPageState();
}

void AstroAdBlockTabHelper::InjectCosmeticFilters(const GURL& url) {
  if (!url.SchemeIsHTTPOrHTTPS()) {
    return;
  }

  auto* profile =
      Profile::FromBrowserContext(web_contents()->GetBrowserContext());
  auto* service = AstroAdBlockServiceFactory::GetForProfile(profile);
  if (!service || !service->IsEnabledForSite(url)) {
    return;
  }

  std::string cosmetic_json = service->GetCosmeticFiltersJson(url);
  if (cosmetic_json.empty() || cosmetic_json == "{}") {
    return;
  }

  // Parse the cosmetic filters JSON to extract hide selectors.
  auto parsed = base::JSONReader::Read(cosmetic_json);
  if (!parsed || !parsed->is_dict()) {
    return;
  }

  const auto& dict = parsed->GetDict();

  // Build CSS from hide_selectors array.
  std::string css_rules;

  // "hide_selectors" is a list of CSS selectors to hide.
  const auto* hide_selectors = dict.FindList("hide_selectors");
  if (hide_selectors) {
    for (const auto& selector : *hide_selectors) {
      if (selector.is_string()) {
        if (!css_rules.empty()) {
          css_rules += ",\n";
        }
        css_rules += selector.GetString();
      }
    }
  }

  // Also handle "injected_css" if present.
  const auto* injected_css = dict.FindString("injected_css");

  if (css_rules.empty() && (!injected_css || injected_css->empty())) {
    return;
  }

  // Build the full CSS injection script.
  std::string js_code = "(function() {\n"
      "  'use strict';\n"
      "  const style = document.createElement('style');\n"
      "  style.setAttribute('type', 'text/css');\n"
      "  style.setAttribute('data-astro-adblock', 'cosmetic');\n";

  if (!css_rules.empty()) {
    // Escape for JS string literal.
    std::string escaped_css;
    for (char c : css_rules) {
      if (c == '\\') escaped_css += "\\\\";
      else if (c == '\'') escaped_css += "\\'";
      else if (c == '\n') escaped_css += "\\n";
      else if (c == '\r') escaped_css += "\\r";
      else escaped_css += c;
    }
    js_code += "  style.textContent = '" + escaped_css +
               " { display: none !important; }';\n";
  }

  if (injected_css && !injected_css->empty()) {
    std::string escaped_injected;
    for (char c : *injected_css) {
      if (c == '\\') escaped_injected += "\\\\";
      else if (c == '\'') escaped_injected += "\\'";
      else if (c == '\n') escaped_injected += "\\n";
      else if (c == '\r') escaped_injected += "\\r";
      else escaped_injected += c;
    }
    js_code += "  style.textContent += '" + escaped_injected + "';\n";
  }

  js_code += "  (document.head || document.documentElement)"
             ".appendChild(style);\n"
             "})();\n";

  // Inject into the main frame.
  content::RenderFrameHost* rfh = web_contents()->GetPrimaryMainFrame();
  if (rfh) {
    rfh->ExecuteJavaScriptInIsolatedWorld(
        base::UTF8ToUTF16(js_code),
        content::RenderFrameHost::JavaScriptResultCallback(),
        content::ISOLATED_WORLD_ID_CONTENT_END);
  }
}

void AstroAdBlockTabHelper::ResetPageState() {
  blocked_ads_.clear();
  blocked_count_ = 0;
  NotifyBlockedCountChanged();
}

void AstroAdBlockTabHelper::NotifyBlockedCountChanged() {
  for (auto& observer : observers_) {
    observer.OnBlockedCountChanged(blocked_count_);
  }
}

WEB_CONTENTS_USER_DATA_KEY_IMPL(AstroAdBlockTabHelper);

}  // namespace oxy::adblock
