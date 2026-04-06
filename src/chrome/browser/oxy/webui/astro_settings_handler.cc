// Copyright 2026 Oxy. All rights reserved.
// Use of this source code is governed by a BSD-style license.

#include "chrome/browser/oxy/webui/astro_settings_handler.h"

#include "base/functional/bind.h"
#include "base/strings/string_number_conversions.h"
#include "base/values.h"
#include "chrome/browser/browser_process.h"
#include "chrome/browser/profiles/profile.h"
#include "chrome/browser/themes/theme_service.h"
#include "chrome/browser/themes/theme_service_factory.h"
#include "components/prefs/pref_service.h"
#include "content/public/browser/browsing_data_remover.h"
#include "content/public/browser/page_navigator.h"
#include "content/public/browser/web_contents.h"
#include "content/public/browser/web_ui.h"
#include "content/public/common/referrer.h"
#include "ui/base/page_transition_types.h"
#include "ui/base/window_open_disposition.h"
#include "url/gurl.h"

namespace oxy {

// ── Pref mapping table ─────────────────────────────────────────────
//
// Maps UI setting identifiers (sent from the JS frontend) to their
// corresponding Chromium PrefService pref paths.  This is the single
// source of truth for what the settings page can read and write.
//
// The settings_id values must match the `data-toggle-id` /
// `data-select-id` / `data-slider-id` attributes used in the
// webui/settings/ Vite frontend.

struct PrefMapping {
  const char* settings_id;   // ID used in the frontend JS
  const char* pref_path;     // Chromium PrefService path
};

// Profile prefs — accessed via profile->GetPrefs().
// Every entry here MUST be registered as a profile pref (not local state).
static constexpr PrefMapping kProfilePrefMappings[] = {
    // ── Autofill & Passwords ──
    {"save-passwords", "credentials_enable_service"},
    {"auto-sign-in", "credentials_enable_autosignin"},
    {"save-addresses", "autofill.profile_enabled"},
    {"save-payment-methods", "autofill.credit_card_enabled"},

    // ── Appearance ──
    {"show-home-button", "browser.show_home_button"},
    {"show-bookmarks-bar", "bookmark_bar.show_on_all_tabs"},
    {"font-size", "webkit.webprefs.default_font_size"},
    {"page-zoom", "profile.default_zoom_level"},
    {"theme-mode", "browser.theme.color_scheme2"},
    {"system-titlebar", "browser.custom_chrome_frame"},

    // ── Search Engine ──
    {"search-suggestions", "search.suggest_enabled"},
    {"search-autocomplete", "search.suggest_enabled"},

    // ── Privacy & Security ──
    {"https-only", "https_only_mode_enabled"},
    {"do-not-track", "enable_do_not_track"},
    {"dns-over-https", "dns_over_https.mode"},
    {"dns-provider", "dns_over_https.templates"},
    {"download-warnings", "safebrowsing.enabled"},
    {"tracking-protection", "profile.cookie_controls_mode"},

    // ── Performance ──
    {"preload-pages", "net.network_prediction_options"},

    // ── Accessibility ──
    {"live-captions", "accessibility.captions.live_caption_enabled"},
    {"min-font-size", "webkit.webprefs.minimum_font_size"},
    {"high-contrast", "settings.a11y.requested_page_colors"},
    {"reduced-motion", "settings.a11y.animation_policy"},
    {"focus-highlight", "settings.a11y.focus_highlight"},
    {"force-text-contrast",
     "settings.a11y.apply_page_colors_only_on_increased_contrast"},

    // ── Languages ──
    {"offer-translate", "translate.enabled"},
    {"spell-check", "browser.enable_spellchecking"},
    {"ui-language", "intl.accept_languages"},

    // ── Downloads ──
    {"ask-download-location", "download.prompt_for_download"},

    // ── System ──
    {"continue-background", "background_mode.enabled"},
    {"startup-behavior", "session.restore_on_startup"},
};

// Local state prefs — accessed via g_browser_process->local_state().
// These are global prefs, not per-profile.
static constexpr PrefMapping kLocalStatePrefMappings[] = {
    {"memory-saver", "performance_tuning.high_efficiency_mode.state"},
    {"energy-saver", "performance_tuning.battery_saver_mode.state"},
    {"hardware-acceleration", "hardware_acceleration_mode.enabled"},
};

AstroSettingsHandler::AstroSettingsHandler() = default;
AstroSettingsHandler::~AstroSettingsHandler() = default;

PrefService* AstroSettingsHandler::GetPrefs() {
  auto* profile = Profile::FromWebUI(web_ui());
  return profile->GetPrefs();
}

// Find the PrefService that owns a given pref and its mapping.
// Returns nullptr if not found.
PrefService* AstroSettingsHandler::FindPrefService(
    const std::string& pref_id,
    const char** out_pref_path) {
  for (const auto& m : kProfilePrefMappings) {
    if (pref_id == m.settings_id) {
      *out_pref_path = m.pref_path;
      return GetPrefs();
    }
  }
  for (const auto& m : kLocalStatePrefMappings) {
    if (pref_id == m.settings_id) {
      *out_pref_path = m.pref_path;
      return g_browser_process->local_state();
    }
  }
  return nullptr;
}

// Safely write a value to a pref, coercing JS types (especially
// strings from HTML <select>) to the pref's registered type.
void AstroSettingsHandler::SafeSetPref(PrefService* prefs,
                                       const char* path,
                                       const base::Value& value) {
  const PrefService::Preference* pref = prefs->FindPreference(path);
  if (!pref) {
    LOG(WARNING) << "Astro Settings: pref not found: " << path;
    return;
  }

  base::Value::Type expected = pref->GetType();

  if (value.is_bool()) {
    if (expected == base::Value::Type::BOOLEAN) {
      prefs->SetBoolean(path, value.GetBool());
    } else if (expected == base::Value::Type::INTEGER) {
      prefs->SetInteger(path, value.GetBool() ? 1 : 0);
    }
  } else if (value.is_int()) {
    if (expected == base::Value::Type::INTEGER) {
      prefs->SetInteger(path, value.GetInt());
    } else if (expected == base::Value::Type::BOOLEAN) {
      prefs->SetBoolean(path, value.GetInt() != 0);
    }
  } else if (value.is_string()) {
    const std::string& str = value.GetString();
    if (expected == base::Value::Type::STRING) {
      prefs->SetString(path, str);
    } else if (expected == base::Value::Type::INTEGER) {
      int v = 0;
      base::StringToInt(str, &v);
      prefs->SetInteger(path, v);
    } else if (expected == base::Value::Type::BOOLEAN) {
      prefs->SetBoolean(path, str == "true" || str == "1");
    } else if (expected == base::Value::Type::DOUBLE) {
      double v = 0.0;
      base::StringToDouble(str, &v);
      prefs->SetDouble(path, v);
    }
  } else if (value.is_double()) {
    if (expected == base::Value::Type::DOUBLE) {
      prefs->SetDouble(path, value.GetDouble());
    } else if (expected == base::Value::Type::INTEGER) {
      prefs->SetInteger(path, static_cast<int>(value.GetDouble()));
    }
  }
}

void AstroSettingsHandler::RegisterMessages() {
  web_ui()->RegisterMessageCallback(
      "getPref",
      base::BindRepeating(&AstroSettingsHandler::HandleGetPref,
                          base::Unretained(this)));
  web_ui()->RegisterMessageCallback(
      "setPref",
      base::BindRepeating(&AstroSettingsHandler::HandleSetPref,
                          base::Unretained(this)));
  web_ui()->RegisterMessageCallback(
      "getAllPrefs",
      base::BindRepeating(&AstroSettingsHandler::HandleGetAllPrefs,
                          base::Unretained(this)));
  web_ui()->RegisterMessageCallback(
      "setTheme",
      base::BindRepeating(&AstroSettingsHandler::HandleSetTheme,
                          base::Unretained(this)));
  web_ui()->RegisterMessageCallback(
      "clearBrowsingData",
      base::BindRepeating(
          &AstroSettingsHandler::HandleClearBrowsingData,
          base::Unretained(this)));
  web_ui()->RegisterMessageCallback(
      "openPage",
      base::BindRepeating(&AstroSettingsHandler::HandleOpenPage,
                          base::Unretained(this)));
}

// ── getPref(callback_id, settings_id) ──────────────────────────────
//
// Reads a single pref value and resolves the JS promise via
// ResolveJavascriptCallback.

void AstroSettingsHandler::HandleGetPref(const base::ListValue& args) {
  AllowJavascript();

  if (args.size() < 2 || !args[0].is_string() || !args[1].is_string()) {
    return;
  }

  const std::string& callback_id = args[0].GetString();
  const std::string& pref_id = args[1].GetString();

  const char* pref_path = nullptr;
  PrefService* prefs = FindPrefService(pref_id, &pref_path);
  if (prefs && pref_path) {
    const PrefService::Preference* pref = prefs->FindPreference(pref_path);
    if (pref) {
      ResolveJavascriptCallback(callback_id, *pref->GetValue());
      return;
    }
  }

  ResolveJavascriptCallback(callback_id, base::Value());
}

// ── setPref(settings_id, value) ────────────────────────────────────
//
// Writes a single pref value.  The value type is inferred from the
// base::Value variant the JS side sent.

void AstroSettingsHandler::HandleSetPref(const base::ListValue& args) {
  AllowJavascript();

  if (args.size() < 2 || !args[0].is_string()) {
    return;
  }

  const std::string& pref_id = args[0].GetString();
  const base::Value& value = args[1];

  const char* pref_path = nullptr;
  PrefService* prefs = FindPrefService(pref_id, &pref_path);
  if (prefs && pref_path) {
    SafeSetPref(prefs, pref_path, value);
  }
}

// ── getAllPrefs(callback_id) ───────────────────────────────────────
//
// Reads every mapped pref and returns a dict keyed by settings_id.
// The frontend calls this once at initialization to hydrate all
// controls with their current browser values.

void AstroSettingsHandler::HandleGetAllPrefs(
    const base::ListValue& args) {
  AllowJavascript();

  if (args.empty() || !args[0].is_string()) {
    return;
  }

  const std::string& callback_id = args[0].GetString();
  base::DictValue result;

  auto* profile_prefs = GetPrefs();
  auto* local_prefs = g_browser_process->local_state();

  for (const auto& m : kProfilePrefMappings) {
    const PrefService::Preference* pref =
        profile_prefs->FindPreference(m.pref_path);
    if (pref) {
      result.Set(m.settings_id, pref->GetValue()->Clone());
    }
  }

  if (local_prefs) {
    for (const auto& m : kLocalStatePrefMappings) {
      const PrefService::Preference* pref =
          local_prefs->FindPreference(m.pref_path);
      if (pref) {
        result.Set(m.settings_id, pref->GetValue()->Clone());
      }
    }
  }

  ResolveJavascriptCallback(callback_id, std::move(result));
}

// ── setTheme(color_scheme) ─────────────────────────────────────────
//
// Applies a browser color scheme via ThemeService.
// 0 = System, 1 = Light, 2 = Dark.

void AstroSettingsHandler::HandleSetTheme(const base::ListValue& args) {
  AllowJavascript();
  if (args.empty()) {
    return;
  }

  int scheme = 0;
  if (args[0].is_int()) {
    scheme = args[0].GetInt();
  } else if (args[0].is_string()) {
    base::StringToInt(args[0].GetString(), &scheme);
  }

  auto* profile = Profile::FromWebUI(web_ui());
  auto* theme_service = ThemeServiceFactory::GetForProfile(profile);
  if (theme_service) {
    theme_service->SetBrowserColorScheme(
        static_cast<ThemeService::BrowserColorScheme>(scheme));
  }

  // Notify the frontend so it can reload chrome://theme/colors.css
  // without a full page refresh.
  FireWebUIListener("theme-changed");
}

// ── clearBrowsingData() ───────────────────────────────────────────
//
// Clears cookies and cache for all unprotected web origins.

void AstroSettingsHandler::HandleClearBrowsingData(
    const base::ListValue& args) {
  AllowJavascript();
  auto* profile = Profile::FromWebUI(web_ui());
  auto* remover = profile->GetBrowsingDataRemover();
  if (remover) {
    remover->Remove(
        base::Time(), base::Time::Max(),
        content::BrowsingDataRemover::DATA_TYPE_COOKIES |
            content::BrowsingDataRemover::DATA_TYPE_CACHE,
        content::BrowsingDataRemover::ORIGIN_TYPE_UNPROTECTED_WEB);
  }
}

// ── openPage(page) ───────────────────────────────────────────────
//
// Opens a chrome://settings/ sub-page in a new foreground tab.

void AstroSettingsHandler::HandleOpenPage(const base::ListValue& args) {
  AllowJavascript();
  if (args.empty() || !args[0].is_string()) {
    return;
  }

  const std::string& page = args[0].GetString();
  std::string url = "chrome://settings/" + page;

  auto* web_contents = web_ui()->GetWebContents();
  if (web_contents) {
    content::OpenURLParams params(
        GURL(url), content::Referrer(),
        WindowOpenDisposition::NEW_FOREGROUND_TAB,
        ui::PAGE_TRANSITION_LINK, /*is_renderer_initiated=*/false);
    web_contents->OpenURL(std::move(params), /*navigation_handle_callback=*/{});
  }
}

}  // namespace oxy
