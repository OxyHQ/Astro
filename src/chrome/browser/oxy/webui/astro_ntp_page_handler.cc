// Copyright 2026 Oxy. All rights reserved.
// Use of this source code is governed by a BSD-style license.

#include "chrome/browser/oxy/webui/astro_ntp_page_handler.h"

#include <algorithm>
#include <map>
#include <string_view>
#include <utility>

#include "base/functional/bind.h"
#include "base/strings/utf_string_conversions.h"
#include "chrome/browser/ntp_tiles/chrome_most_visited_sites_factory.h"
#include "chrome/browser/oxy/adblock/astro_adblock_service.h"
#include "chrome/browser/oxy/astro_pref_names.h"
#include "chrome/browser/profiles/profile.h"
#include "chrome/browser/search_engines/template_url_service_factory.h"
#include "chrome/browser/ui/browser.h"
#include "chrome/browser/ui/browser_finder.h"
#include "chrome/browser/ui/browser_window/public/browser_window_features.h"
#include "chrome/browser/ui/views/side_panel/side_panel_ui.h"
#include "components/ntp_tiles/ntp_tile.h"
#include "components/ntp_tiles/section_type.h"
#include "components/prefs/pref_service.h"
#include "components/prefs/scoped_user_pref_update.h"
#include "components/search_engines/template_url.h"
#include "content/public/browser/page_navigator.h"
#include "content/public/browser/web_contents.h"
#include "ui/base/page_transition_types.h"
#include "ui/base/window_open_disposition.h"
#include "url/gurl.h"
#include "url/url_constants.h"

namespace astro {

namespace {

using ntp::mojom::WidgetId;

// The widgets, once: their stored order key, and the pref that shows or hides
// each one.
//
// One table rather than a switch per question, because the three things that
// must agree — the enum, the pref, and the name written into the order list —
// are three columns of one row here and cannot be edited apart.
struct WidgetEntry {
  WidgetId id;
  std::string_view key;
  const char* visibility_pref;
};

// The canonical order, which is also the order a profile with no stored
// arrangement gets, and the order missing entries are appended in.
constexpr WidgetEntry kWidgets[] = {
    {WidgetId::kWeather, "weather", prefs::kNtpShowWeather},
    {WidgetId::kClock, "clock", prefs::kNtpShowClock},
    {WidgetId::kQuickLinks, "quick-links", prefs::kNtpShowQuickLinks},
    {WidgetId::kNotes, "notes", prefs::kNtpShowNotes},
    {WidgetId::kDiscover, "discover", prefs::kNtpShowDiscover},
    {WidgetId::kAlia, "alia", prefs::kNtpShowAlia},
    {WidgetId::kSites, "sites", prefs::kNtpShowSites},
};

const WidgetEntry* FindWidget(WidgetId id) {
  for (const WidgetEntry& entry : kWidgets) {
    if (entry.id == id) {
      return &entry;
    }
  }
  return nullptr;
}

const WidgetEntry* FindWidgetByKey(std::string_view key) {
  for (const WidgetEntry& entry : kWidgets) {
    if (entry.key == key) {
      return &entry;
    }
  }
  return nullptr;
}

// The links a profile that has never edited them gets.
//
// Kept here rather than as the registered default of the pref, so that the
// browser can tell "never chose" from "chose to have none": a user who removes
// every link stores an empty list, and PrefService reports that as a value
// rather than as absence. A registered default would give their links back on
// the next launch.
struct DefaultQuickLink {
  const char* title;
  const char* url;
};

constexpr DefaultQuickLink kDefaultQuickLinks[] = {
    {"GitHub", "https://github.com"},
    {"Reddit", "https://reddit.com"},
    {"YouTube", "https://youtube.com"},
    {"Wikipedia", "https://wikipedia.org"},
    {"HN", "https://news.ycombinator.com"},
    {"Stack Overflow", "https://stackoverflow.com"},
    {"MDN", "https://developer.mozilla.org"},
    {"Twitter", "https://x.com"},
};

// Whether the new tab page will link to this.
//
// http and https only. A new tab page that will render a link to `file:` or to
// another `astro://` page is a new tab page that can be talked into opening
// one, and the list it renders from is stored in a profile that syncs and can
// be written by anything with the profile on disk.
bool IsLinkableUrl(const GURL& url) {
  return url.is_valid() && (url.SchemeIs(url::kHttpScheme) ||
                            url.SchemeIs(url::kHttpsScheme));
}

// Parses and bounds a URL the page sent. Empty GURL means "refuse".
GURL ParseSubmittedUrl(const std::string& url) {
  if (url.size() > AstroNtpPageHandler::kMaxUrlLength) {
    return GURL();
  }
  GURL parsed(url);
  return IsLinkableUrl(parsed) ? parsed : GURL();
}

std::string BoundTitle(const std::string& title) {
  return title.substr(0, std::min(title.size(),
                                  AstroNtpPageHandler::kMaxTitleLength));
}

ntp::mojom::QuickLinkPtr MakeQuickLink(const std::string& title,
                                       const GURL& url) {
  auto link = ntp::mojom::QuickLink::New();
  link->title = title;
  // The spec() of a GURL that IsLinkableUrl already accepted. The wire type is
  // a string; see the header comment in astro_ntp.mojom for why.
  link->url = url.spec();
  return link;
}

}  // namespace

AstroNtpPageHandler::AstroNtpPageHandler(
    Profile* profile,
    content::WebContents* web_contents,
    mojo::PendingRemote<ntp::mojom::Page> page,
    mojo::PendingReceiver<ntp::mojom::PageHandler> receiver)
    : profile_(profile),
      web_contents_(web_contents),
      template_url_service_(TemplateURLServiceFactory::GetForProfile(profile)),
      page_(std::move(page)),
      receiver_(this, std::move(receiver)) {
  PrefService* prefs = profile_->GetPrefs();
  pref_registrar_.Init(prefs);
  for (const WidgetEntry& entry : kWidgets) {
    pref_registrar_.Add(
        entry.visibility_pref,
        base::BindRepeating(&AstroNtpPageHandler::OnWidgetPrefsChanged,
                            base::Unretained(this)));
  }
  pref_registrar_.Add(
      prefs::kNtpWidgetOrder,
      base::BindRepeating(&AstroNtpPageHandler::OnWidgetPrefsChanged,
                          base::Unretained(this)));
  pref_registrar_.Add(
      prefs::kNtpQuickLinks,
      base::BindRepeating(&AstroNtpPageHandler::OnQuickLinksPrefChanged,
                          base::Unretained(this)));
  pref_registrar_.Add(
      prefs::kNtpNotes,
      base::BindRepeating(&AstroNtpPageHandler::OnNotesPrefChanged,
                          base::Unretained(this)));
  // The badge counts what the ad blocker cancelled anywhere in the profile, so
  // it moves while this page is idle in a background tab.
  pref_registrar_.Add(
      oxy::adblock::kAdBlockLifetimeBlockedCount,
      base::BindRepeating(&AstroNtpPageHandler::OnBlockedCountChanged,
                          base::Unretained(this)));

  if (template_url_service_) {
    template_url_observation_.Observe(template_url_service_);
  }

  // NOT in incognito or guest. Most-visited tiles are derived from the
  // regular profile's browsing history, and #22 requires an off-the-record new
  // tab page show none of it. The page renders the widget with nothing in it
  // rather than being told the list is empty, which is the same thing to look
  // at and a different thing to reason about.
  if (!profile_->IsOffTheRecord()) {
    most_visited_sites_ = ChromeMostVisitedSitesFactory::NewForProfile(profile_);
    if (most_visited_sites_) {
      most_visited_sites_->EnableTileTypes(
          ntp_tiles::MostVisitedSites::EnableTileTypesOptions().with_top_sites(
              true));
      most_visited_sites_->AddMostVisitedURLsObserver(this, kMaxTiles);
    }
  }
}

AstroNtpPageHandler::~AstroNtpPageHandler() {
  if (most_visited_sites_) {
    most_visited_sites_->RemoveMostVisitedURLsObserver(this);
  }
}

// -- Reads --------------------------------------------------------------------

std::vector<ntp::mojom::WidgetPtr> AstroNtpPageHandler::CurrentWidgets() const {
  PrefService* prefs = profile_->GetPrefs();

  // The stored order, normalised. An unknown name is dropped and a widget the
  // stored order does not mention is appended in its canonical position, so a
  // profile written by a build with a different widget set still lays out —
  // and a page that received a partial order would simply not draw the rest.
  std::vector<const WidgetEntry*> ordered;
  for (const base::Value& value : prefs->GetList(prefs::kNtpWidgetOrder)) {
    const std::string* key = value.GetIfString();
    if (!key) {
      continue;
    }
    const WidgetEntry* entry = FindWidgetByKey(*key);
    if (entry && std::find(ordered.begin(), ordered.end(), entry) ==
                     ordered.end()) {
      ordered.push_back(entry);
    }
  }
  for (const WidgetEntry& entry : kWidgets) {
    if (std::find(ordered.begin(), ordered.end(), &entry) == ordered.end()) {
      ordered.push_back(&entry);
    }
  }

  std::vector<ntp::mojom::WidgetPtr> widgets;
  widgets.reserve(ordered.size());
  for (const WidgetEntry* entry : ordered) {
    auto widget = ntp::mojom::Widget::New();
    widget->id = entry->id;
    widget->visible = prefs->GetBoolean(entry->visibility_pref);
    widgets.push_back(std::move(widget));
  }
  return widgets;
}

std::vector<ntp::mojom::QuickLinkPtr> AstroNtpPageHandler::CurrentQuickLinks()
    const {
  PrefService* prefs = profile_->GetPrefs();
  std::vector<ntp::mojom::QuickLinkPtr> links;

  const PrefService::Preference* pref =
      prefs->FindPreference(prefs::kNtpQuickLinks);
  if (pref && pref->IsDefaultValue()) {
    for (const DefaultQuickLink& link : kDefaultQuickLinks) {
      links.push_back(MakeQuickLink(link.title, GURL(link.url)));
    }
    return links;
  }

  for (const base::Value& value : prefs->GetList(prefs::kNtpQuickLinks)) {
    const base::DictValue* dict = value.GetIfDict();
    if (!dict) {
      continue;
    }
    const std::string* title = dict->FindString("title");
    const std::string* url = dict->FindString("url");
    if (!title || !url) {
      continue;
    }
    // Validated on the way OUT as well as on the way in. The store is a
    // profile file: it can be edited, it can arrive from a sync of a build
    // with looser rules, and this is the last place before a URL becomes an
    // anchor in a privileged page.
    GURL parsed(*url);
    if (!IsLinkableUrl(parsed)) {
      continue;
    }
    links.push_back(MakeQuickLink(BoundTitle(*title), parsed));
    if (links.size() >= kMaxQuickLinks) {
      break;
    }
  }
  return links;
}

std::vector<ntp::mojom::SearchEnginePtr>
AstroNtpPageHandler::CurrentSearchEngines() const {
  std::vector<ntp::mojom::SearchEnginePtr> engines;
  if (!template_url_service_) {
    return engines;
  }
  const TemplateURL* default_engine =
      template_url_service_->GetDefaultSearchProvider();
  for (TemplateURL* candidate : template_url_service_->GetTemplateURLs()) {
    // The same set settings calls "your search engines": the prepopulated and
    // user-created engines offered as a default, without the deactivated ones
    // and without extension-provided keywords.
    if (!template_url_service_->ShowInDefaultList(candidate)) {
      continue;
    }
    auto engine = ntp::mojom::SearchEngine::New();
    engine->id = candidate->id();
    engine->name = base::UTF16ToUTF8(candidate->short_name());
    engine->keyword = base::UTF16ToUTF8(candidate->keyword());
    engine->is_default = candidate == default_engine;
    // See the field's comment in astro_ntp.mojom: CanMakeDefault is false for
    // the engine that already is the default, so asking it alone would draw
    // every browser as managed.
    engine->selectable = candidate == default_engine ||
                         template_url_service_->CanMakeDefault(candidate);
    engines.push_back(std::move(engine));
  }
  return engines;
}

void AstroNtpPageHandler::GetState(GetStateCallback callback) {
  auto state = ntp::mojom::NewTabState::New();
  state->widgets = CurrentWidgets();
  state->quick_links = CurrentQuickLinks();
  state->notes = profile_->GetPrefs()->GetString(prefs::kNtpNotes);
  state->blocked_count = static_cast<uint32_t>(std::max(
      0, profile_->GetPrefs()->GetInteger(
             oxy::adblock::kAdBlockLifetimeBlockedCount)));
  state->search_engines = CurrentSearchEngines();
  std::move(callback).Run(std::move(state));
}

// -- Writes -------------------------------------------------------------------

void AstroNtpPageHandler::SetWidgetVisible(WidgetId id, bool visible) {
  const WidgetEntry* entry = FindWidget(id);
  if (!entry) {
    return;
  }
  profile_->GetPrefs()->SetBoolean(entry->visibility_pref, visible);
}

void AstroNtpPageHandler::SetWidgetOrder(const std::vector<WidgetId>& order) {
  base::ListValue stored;
  std::vector<WidgetId> seen;
  for (WidgetId id : order) {
    const WidgetEntry* entry = FindWidget(id);
    if (!entry || std::find(seen.begin(), seen.end(), id) != seen.end()) {
      continue;
    }
    seen.push_back(id);
    stored.Append(std::string(entry->key));
  }
  profile_->GetPrefs()->SetList(prefs::kNtpWidgetOrder, std::move(stored));
}

void AstroNtpPageHandler::AddQuickLink(const std::string& title,
                                       const std::string& url,
                                       AddQuickLinkCallback callback) {
  GURL parsed = ParseSubmittedUrl(url);
  std::vector<ntp::mojom::QuickLinkPtr> links = CurrentQuickLinks();
  if (!parsed.is_valid() || links.size() >= kMaxQuickLinks) {
    std::move(callback).Run(false);
    return;
  }
  links.push_back(MakeQuickLink(BoundTitle(title), parsed));

  // Written from the normalised snapshot rather than appended to the raw pref,
  // so the first edit after a fresh profile writes the shipped defaults out as
  // the user's own list instead of leaving one link and losing seven.
  base::ListValue stored;
  for (const ntp::mojom::QuickLinkPtr& link : links) {
    base::DictValue entry;
    entry.Set("title", link->title);
    entry.Set("url", link->url);
    stored.Append(std::move(entry));
  }
  profile_->GetPrefs()->SetList(prefs::kNtpQuickLinks, std::move(stored));
  std::move(callback).Run(true);
}

void AstroNtpPageHandler::UpdateQuickLink(uint32_t index,
                                          const std::string& title,
                                          const std::string& url,
                                          UpdateQuickLinkCallback callback) {
  GURL parsed = ParseSubmittedUrl(url);
  std::vector<ntp::mojom::QuickLinkPtr> links = CurrentQuickLinks();
  if (!parsed.is_valid() || index >= links.size()) {
    std::move(callback).Run(false);
    return;
  }
  links[index] = MakeQuickLink(BoundTitle(title), parsed);

  base::ListValue stored;
  for (const ntp::mojom::QuickLinkPtr& link : links) {
    base::DictValue entry;
    entry.Set("title", link->title);
    entry.Set("url", link->url);
    stored.Append(std::move(entry));
  }
  profile_->GetPrefs()->SetList(prefs::kNtpQuickLinks, std::move(stored));
  std::move(callback).Run(true);
}

void AstroNtpPageHandler::RemoveQuickLink(uint32_t index) {
  std::vector<ntp::mojom::QuickLinkPtr> links = CurrentQuickLinks();
  if (index >= links.size()) {
    return;
  }
  links.erase(links.begin() + index);

  base::ListValue stored;
  for (const ntp::mojom::QuickLinkPtr& link : links) {
    base::DictValue entry;
    entry.Set("title", link->title);
    entry.Set("url", link->url);
    stored.Append(std::move(entry));
  }
  profile_->GetPrefs()->SetList(prefs::kNtpQuickLinks, std::move(stored));
}

void AstroNtpPageHandler::SetNotes(const std::string& notes) {
  profile_->GetPrefs()->SetString(
      prefs::kNtpNotes,
      notes.substr(0, std::min(notes.size(), kMaxNotesLength)));
}

void AstroNtpPageHandler::SetDefaultSearchEngine(
    int64_t id,
    SetDefaultSearchEngineCallback callback) {
  if (!template_url_service_) {
    std::move(callback).Run(false);
    return;
  }
  for (TemplateURL* candidate : template_url_service_->GetTemplateURLs()) {
    if (candidate->id() != id) {
      continue;
    }
    // Already the default: accepted, and nothing to do. Reported as accepted
    // rather than refused because the page asked for a state the browser is
    // in, and a refusal would make a correct control look broken.
    if (candidate == template_url_service_->GetDefaultSearchProvider()) {
      std::move(callback).Run(true);
      return;
    }
    // CanMakeDefault is the policy check. Without it this is a DCHECK in a
    // developer build and a silently ignored write in a released one, which is
    // the shape where a managed browser looks broken rather than managed.
    if (!template_url_service_->CanMakeDefault(candidate)) {
      std::move(callback).Run(false);
      return;
    }
    template_url_service_->SetUserSelectedDefaultSearchProvider(candidate);
    std::move(callback).Run(true);
    return;
  }
  std::move(callback).Run(false);
}

void AstroNtpPageHandler::SearchWithDefaultEngine(const std::string& query) {
  if (!template_url_service_ || !web_contents_ ||
      query.size() > kMaxQueryLength) {
    return;
  }
  const TemplateURL* engine = template_url_service_->GetDefaultSearchProvider();
  if (!engine) {
    return;
  }
  GURL destination(engine->url_ref().ReplaceSearchTerms(
      TemplateURLRef::SearchTermsArgs(base::UTF8ToUTF16(query)),
      template_url_service_->search_terms_data()));
  if (!destination.is_valid()) {
    return;
  }
  // GENERATED is what the omnibox uses for a typed search, and it is what
  // makes this navigation indistinguishable from one — the same transition,
  // the same tab, browser-initiated.
  web_contents_->OpenURL(
      content::OpenURLParams(destination, content::Referrer(),
                             WindowOpenDisposition::CURRENT_TAB,
                             ui::PAGE_TRANSITION_GENERATED,
                             /*is_renderer_initiated=*/false),
      /*navigation_handle_callback=*/{});
}

void AstroNtpPageHandler::OpenCustomizeChrome() {
  ShowSidePanel(SidePanelEntryId::kCustomizeChrome);
}

void AstroNtpPageHandler::OpenAliaSidePanel() {
  ShowSidePanel(SidePanelEntryId::kAlia);
}

void AstroNtpPageHandler::ShowSidePanel(SidePanelEntryId id) {
  if (!web_contents_) {
    return;
  }
  // Resolved from the WebContents every time rather than cached: this page
  // can be dragged into another window, and a Browser* captured at
  // construction would then open a panel in the window it left.
  Browser* browser = chrome::FindBrowserWithTab(web_contents_);
  if (!browser) {
    return;
  }
  if (SidePanelUI* side_panel = browser->GetFeatures().side_panel_ui()) {
    side_panel->Show(id);
  }
}

// -- Pushes -------------------------------------------------------------------

void AstroNtpPageHandler::OnWidgetPrefsChanged() {
  page_->OnWidgetsChanged(CurrentWidgets());
}

void AstroNtpPageHandler::OnQuickLinksPrefChanged() {
  page_->OnQuickLinksChanged(CurrentQuickLinks());
}

void AstroNtpPageHandler::OnNotesPrefChanged() {
  page_->OnNotesChanged(profile_->GetPrefs()->GetString(prefs::kNtpNotes));
}

void AstroNtpPageHandler::OnBlockedCountChanged() {
  page_->OnBlockedCountChanged(static_cast<uint32_t>(std::max(
      0, profile_->GetPrefs()->GetInteger(
             oxy::adblock::kAdBlockLifetimeBlockedCount))));
}

void AstroNtpPageHandler::OnURLsAvailable(
    bool is_user_triggered,
    const std::map<ntp_tiles::SectionType, ntp_tiles::NTPTilesVector>&
        sections) {
  std::vector<ntp::mojom::TilePtr> tiles;
  const auto personalized = sections.find(ntp_tiles::SectionType::PERSONALIZED);
  if (personalized != sections.end()) {
    for (const ntp_tiles::NTPTile& source : personalized->second) {
      if (!IsLinkableUrl(source.url)) {
        continue;
      }
      auto tile = ntp::mojom::Tile::New();
      // A tile with no title shows its address, which is what upstream's own
      // most-visited grid does — a card with an icon and no label is not
      // identifiable.
      tile->title = source.title.empty() ? source.url.spec()
                                         : base::UTF16ToUTF8(source.title);
      tile->url = source.url.spec();
      tiles.push_back(std::move(tile));
      if (tiles.size() >= kMaxTiles) {
        break;
      }
    }
  }
  page_->OnTopSitesChanged(std::move(tiles));
}

void AstroNtpPageHandler::OnIconMadeAvailable(const GURL& site_url) {
  // Nothing to do: the page asks chrome://favicon2 for an icon by page URL, so
  // an icon arriving late is picked up by the image request rather than by a
  // message. Required by the observer interface.
}

void AstroNtpPageHandler::OnTemplateURLServiceChanged() {
  page_->OnSearchEnginesChanged(CurrentSearchEngines());
}

}  // namespace astro
