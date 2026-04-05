// Copyright 2026 Oxy. All rights reserved.
// Use of this source code is governed by a BSD-style license.

#include "chrome/browser/oxy/webui/astro_settings_handler.h"

#include "base/functional/bind.h"
#include "base/values.h"
#include "chrome/browser/profiles/profile.h"
#include "components/prefs/pref_service.h"
#include "content/public/browser/web_ui.h"

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

static constexpr PrefMapping kPrefMappings[] = {
    // ── Appearance ──
    {"show-home-button", "browser.show_home_button"},
    {"show-bookmarks-bar", "bookmark_bar.show_on_all_tabs"},
    {"font-size", "webkit.webprefs.default_font_size"},
    {"page-zoom", "profile.default_zoom_level"},

    // ── Privacy & Security ──
    {"https-only", "https_only_mode_enabled"},
    {"do-not-track", "enable_do_not_track"},
    {"dns-over-https", "dns_over_https.mode"},
    {"block-third-party-cookies",
     "profile.block_third_party_cookies"},

    // ── Performance ──
    {"memory-saver",
     "performance_tuning.high_efficiency_mode.state"},
    {"energy-saver",
     "performance_tuning.battery_saver_mode.state"},
    {"hardware-acceleration", "hardware_acceleration_mode.enabled"},
    {"smooth-scrolling", "enable_smooth_scrolling"},
    {"preload-pages", "net.network_prediction_options"},

    // ── Languages ──
    {"offer-translate", "translate.enabled"},
    {"spell-check", "browser.enable_spellchecking"},

    // ── Downloads ──
    {"ask-download-location", "download.prompt_for_download"},
    {"show-download-shelf", "download.shelf_enabled"},

    // ── System ──
    {"continue-background", "background_mode.enabled"},
};

AstroSettingsHandler::AstroSettingsHandler() = default;
AstroSettingsHandler::~AstroSettingsHandler() = default;

PrefService* AstroSettingsHandler::GetPrefs() {
  auto* profile = Profile::FromWebUI(web_ui());
  return profile->GetPrefs();
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
}

// ── getPref(callback_id, settings_id) ──────────────────────────────
//
// Reads a single pref value and resolves the JS promise via
// ResolveJavascriptCallback.

void AstroSettingsHandler::HandleGetPref(const base::Value::List& args) {
  AllowJavascript();

  if (args.size() < 2 || !args[0].is_string() || !args[1].is_string()) {
    return;
  }

  const std::string& callback_id = args[0].GetString();
  const std::string& pref_id = args[1].GetString();

  auto* prefs = GetPrefs();

  for (const auto& mapping : kPrefMappings) {
    if (pref_id == mapping.settings_id) {
      const PrefService::Preference* pref =
          prefs->FindPreference(mapping.pref_path);
      if (pref) {
        ResolveJavascriptCallback(base::Value(callback_id),
                                  *pref->GetValue());
        return;
      }
    }
  }

  // Pref not found in our mapping table -- resolve with null.
  ResolveJavascriptCallback(base::Value(callback_id), base::Value());
}

// ── setPref(settings_id, value) ────────────────────────────────────
//
// Writes a single pref value.  The value type is inferred from the
// base::Value variant the JS side sent.

void AstroSettingsHandler::HandleSetPref(const base::Value::List& args) {
  AllowJavascript();

  if (args.size() < 2 || !args[0].is_string()) {
    return;
  }

  const std::string& pref_id = args[0].GetString();
  const base::Value& value = args[1];

  auto* prefs = GetPrefs();

  for (const auto& mapping : kPrefMappings) {
    if (pref_id == mapping.settings_id) {
      if (value.is_bool()) {
        prefs->SetBoolean(mapping.pref_path, value.GetBool());
      } else if (value.is_int()) {
        prefs->SetInteger(mapping.pref_path, value.GetInt());
      } else if (value.is_double()) {
        prefs->SetDouble(mapping.pref_path, value.GetDouble());
      } else if (value.is_string()) {
        prefs->SetString(mapping.pref_path, value.GetString());
      }
      return;
    }
  }
}

// ── getAllPrefs(callback_id) ───────────────────────────────────────
//
// Reads every mapped pref and returns a dict keyed by settings_id.
// The frontend calls this once at initialization to hydrate all
// controls with their current browser values.

void AstroSettingsHandler::HandleGetAllPrefs(
    const base::Value::List& args) {
  AllowJavascript();

  if (args.empty() || !args[0].is_string()) {
    return;
  }

  const std::string& callback_id = args[0].GetString();
  base::Value::Dict result;

  auto* prefs = GetPrefs();

  for (const auto& mapping : kPrefMappings) {
    const PrefService::Preference* pref =
        prefs->FindPreference(mapping.pref_path);
    if (pref) {
      result.Set(mapping.settings_id, pref->GetValue()->Clone());
    }
  }

  ResolveJavascriptCallback(base::Value(callback_id),
                            base::Value(std::move(result)));
}

}  // namespace oxy
