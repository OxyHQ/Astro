// Copyright 2026 Oxy. All rights reserved.
// Use of this source code is governed by a BSD-style license.

#include "chrome/browser/oxy/webui/astro_adblock_page_handler.h"

#include <algorithm>
#include <utility>

#include "base/functional/bind.h"
#include "base/strings/strcat.h"
#include "chrome/browser/oxy/adblock/astro_adblock_filter_list_catalog.h"
#include "chrome/browser/oxy/adblock/astro_adblock_service.h"
#include "chrome/browser/oxy/adblock/astro_adblock_service_factory.h"
#include "chrome/browser/profiles/profile.h"
#include "components/prefs/pref_service.h"
#include "url/gurl.h"

namespace astro {

namespace {

// The catalogue, as the page shows it.
//
// Read from the C++ catalogue on every call rather than cached: it is a fixed
// vector built at call time, and a page-side copy of it is precisely the drift
// that made the old page claim two lists in a build that ships eleven.
std::vector<adblock::mojom::FilterListPtr> Catalogue() {
  std::vector<adblock::mojom::FilterListPtr> lists;
  for (const auto& entry : oxy::adblock::GetFilterListCatalog()) {
    auto list = adblock::mojom::FilterList::New();
    list->id = entry.id;
    list->name = entry.name;
    list->description = entry.description;
    // `default_enabled` and "is it fetched" are the same predicate today:
    // CheckForUpdatesNow() iterates GetDefaultFilterLists(), which is the
    // catalogue filtered by exactly this field.
    list->fetched = entry.default_enabled;
    lists.push_back(std::move(list));
  }
  return lists;
}

uint32_t BlockedCount(PrefService* prefs) {
  // The pref is a signed int the throttle only ever increments, saturating at
  // INT_MAX. Clamped rather than cast so a profile carrying a negative value —
  // hand-edited, or written by a build that stored something else here — comes
  // out as zero instead of as four billion.
  return static_cast<uint32_t>(
      std::max(0, prefs->GetInteger(oxy::adblock::kAdBlockLifetimeBlockedCount)));
}

}  // namespace

AstroAdBlockPageHandler::AstroAdBlockPageHandler(
    Profile* profile,
    mojo::PendingRemote<adblock::mojom::Page> page,
    mojo::PendingReceiver<adblock::mojom::PageHandler> receiver)
    : profile_(profile),
      page_(std::move(page)),
      receiver_(this, std::move(receiver)) {
  pref_registrar_.Init(profile_->GetPrefs());
  pref_registrar_.Add(
      oxy::adblock::kAdBlockEnabled,
      base::BindRepeating(&AstroAdBlockPageHandler::OnEnabledChanged,
                          base::Unretained(this)));
  pref_registrar_.Add(
      oxy::adblock::kAdBlockLifetimeBlockedCount,
      base::BindRepeating(&AstroAdBlockPageHandler::OnBlockedCountChanged,
                          base::Unretained(this)));
  pref_registrar_.Add(
      oxy::adblock::kAdBlockSiteOverrides,
      base::BindRepeating(&AstroAdBlockPageHandler::OnSiteOverridesChanged,
                          base::Unretained(this)));
  pref_registrar_.Add(
      oxy::adblock::kAdBlockCustomRules,
      base::BindRepeating(&AstroAdBlockPageHandler::OnCustomRulesChanged,
                          base::Unretained(this)));
}

AstroAdBlockPageHandler::~AstroAdBlockPageHandler() = default;

std::vector<std::string> AstroAdBlockPageHandler::DisabledSites() const {
  std::vector<std::string> sites;
  for (const auto [host, value] :
       profile_->GetPrefs()->GetDict(oxy::adblock::kAdBlockSiteOverrides)) {
    // Only an explicit false is an exception. `IsEnabledForSite` treats an
    // absent key and a true one identically, so listing a true one would put a
    // row on the page for a site with nothing switched off.
    if (value.is_bool() && !value.GetBool()) {
      sites.push_back(host);
    }
  }
  // Sorted, because a dictionary's iteration order is not something a person
  // reading a list of their own sites should be shown.
  std::sort(sites.begin(), sites.end());
  return sites;
}

void AstroAdBlockPageHandler::GetState(GetStateCallback callback) {
  PrefService* prefs = profile_->GetPrefs();

  auto state = adblock::mojom::AdBlockState::New();
  state->enabled = prefs->GetBoolean(oxy::adblock::kAdBlockEnabled);
  state->blocked_count = BlockedCount(prefs);
  state->filter_lists = Catalogue();
  state->disabled_sites = DisabledSites();
  state->custom_rules = prefs->GetString(oxy::adblock::kAdBlockCustomRules);

  std::move(callback).Run(std::move(state));
}

void AstroAdBlockPageHandler::SetEnabled(bool enabled) {
  // Straight to the pref, which is what the service itself reads on every
  // request. The service observes the same pref and starts its engine when
  // this switches on — see AstroAdBlockService::OnEnabledPrefChanged.
  profile_->GetPrefs()->SetBoolean(oxy::adblock::kAdBlockEnabled, enabled);
}

void AstroAdBlockPageHandler::RemoveSiteException(
    const std::string& host,
    RemoveSiteExceptionCallback callback) {
  // Checked against what is STORED, not merely parsed. The message this
  // replaces prepended a scheme to whatever it was given and handed the result
  // to the service, so a value that was not a host produced no error and no
  // effect — the row stayed and nothing said why.
  const base::Value::Dict& overrides =
      profile_->GetPrefs()->GetDict(oxy::adblock::kAdBlockSiteOverrides);
  const base::Value* stored = overrides.Find(host);
  if (!stored || !stored->is_bool() || stored->GetBool()) {
    std::move(callback).Run(false);
    return;
  }

  const GURL url(base::StrCat({"https://", host}));
  if (!url.is_valid() || url.host() != host) {
    // The key is in the dict but does not round-trip as a host, so the service
    // would key its removal by something else and leave this entry behind.
    std::move(callback).Run(false);
    return;
  }

  oxy::adblock::AstroAdBlockService* service =
      oxy::adblock::AstroAdBlockServiceFactory::GetForProfile(profile_);
  if (!service) {
    std::move(callback).Run(false);
    return;
  }

  // `enabled = true` is how the service spells "drop the override": it removes
  // the key rather than storing true, so the site returns to the default.
  service->SetSiteOverride(url, /*enabled=*/true);
  std::move(callback).Run(true);
}

void AstroAdBlockPageHandler::SetCustomRules(const std::string& rules,
                                             SetCustomRulesCallback callback) {
  if (rules.size() > kMaxCustomRulesLength) {
    // Refused whole. Storing a truncated version would silently change what a
    // person wrote, and the last rule of a truncated list is a broken one.
    std::move(callback).Run(false);
    return;
  }
  profile_->GetPrefs()->SetString(oxy::adblock::kAdBlockCustomRules, rules);
  std::move(callback).Run(true);
}

void AstroAdBlockPageHandler::OnEnabledChanged() {
  page_->OnEnabledChanged(
      profile_->GetPrefs()->GetBoolean(oxy::adblock::kAdBlockEnabled));
}

void AstroAdBlockPageHandler::OnBlockedCountChanged() {
  page_->OnBlockedCountChanged(BlockedCount(profile_->GetPrefs()));
}

void AstroAdBlockPageHandler::OnSiteOverridesChanged() {
  page_->OnDisabledSitesChanged(DisabledSites());
}

void AstroAdBlockPageHandler::OnCustomRulesChanged() {
  page_->OnCustomRulesChanged(
      profile_->GetPrefs()->GetString(oxy::adblock::kAdBlockCustomRules));
}

}  // namespace astro
