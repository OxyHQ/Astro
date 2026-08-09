// Copyright 2026 Oxy. All rights reserved.
// Use of this source code is governed by a BSD-style license.

#ifndef CHROME_BROWSER_OXY_WEBUI_ASTRO_NTP_PAGE_HANDLER_H_
#define CHROME_BROWSER_OXY_WEBUI_ASTRO_NTP_PAGE_HANDLER_H_

#include <memory>
#include <string>
#include <vector>

#include "base/memory/raw_ptr.h"
#include "base/scoped_observation.h"
#include "chrome/browser/oxy/webui/astro_ntp.mojom.h"
#include "components/ntp_tiles/most_visited_sites.h"
#include "components/prefs/pref_change_registrar.h"
#include "components/search_engines/template_url_service.h"
#include "components/search_engines/template_url_service_observer.h"
#include "mojo/public/cpp/bindings/pending_receiver.h"
#include "mojo/public/cpp/bindings/pending_remote.h"
#include "chrome/browser/ui/views/side_panel/side_panel_entry_id.h"
#include "mojo/public/cpp/bindings/receiver.h"
#include "mojo/public/cpp/bindings/remote.h"

class Profile;

namespace content {
class WebContents;
}

namespace astro {

// The browser side of astro_ntp.mojom, for one new tab page.
//
// Everything the page can read or change about itself goes through here, and
// every write is checked here rather than trusted. What this replaces read its
// prefs through a `data-ntp-prefs` attribute the controller spliced into the
// HTML, pushed changes through untyped `chrome.send` listeners, and kept the
// notes, the links and the widget order in localStorage where the browser
// could not see them at all.
//
// Owned by AstroNtpUI, which the WebContents outlives, so the raw pointers
// below are held for the handler's whole life.
class AstroNtpPageHandler : public ntp::mojom::PageHandler,
                            public ntp_tiles::MostVisitedSites::Observer,
                            public TemplateURLServiceObserver {
 public:
  AstroNtpPageHandler(Profile* profile,
                      content::WebContents* web_contents,
                      mojo::PendingRemote<ntp::mojom::Page> page,
                      mojo::PendingReceiver<ntp::mojom::PageHandler> receiver);
  ~AstroNtpPageHandler() override;

  AstroNtpPageHandler(const AstroNtpPageHandler&) = delete;
  AstroNtpPageHandler& operator=(const AstroNtpPageHandler&) = delete;

  // The most tiles the browser will send. The page draws one card each in a
  // grid it shares with the widgets, so this is a layout decision as much as a
  // bound — but it is enforced here, because #22 requires the list size be
  // bounded on the browser side rather than sliced by whoever renders it.
  static constexpr size_t kMaxTiles = 4;

  // The most links the user may keep. The quick-links card is a 2x4 grid.
  static constexpr size_t kMaxQuickLinks = 8;

  // Bounds on what the page may send. A title longer than a card can show and
  // a note longer than anyone will read are both, at some size, a way to make
  // the profile's preference store grow without limit.
  static constexpr size_t kMaxTitleLength = 128;
  static constexpr size_t kMaxUrlLength = 2048;
  static constexpr size_t kMaxNotesLength = 8192;
  static constexpr size_t kMaxQueryLength = 2048;

 private:
  // ntp::mojom::PageHandler:
  void GetState(GetStateCallback callback) override;
  void SetWidgetVisible(ntp::mojom::WidgetId id, bool visible) override;
  void SetWidgetOrder(const std::vector<ntp::mojom::WidgetId>& order) override;
  void AddQuickLink(const std::string& title,
                    const std::string& url,
                    AddQuickLinkCallback callback) override;
  void UpdateQuickLink(uint32_t index,
                       const std::string& title,
                       const std::string& url,
                       UpdateQuickLinkCallback callback) override;
  void RemoveQuickLink(uint32_t index) override;
  void SetNotes(const std::string& notes) override;
  void SetDefaultSearchEngine(int64_t id,
                              SetDefaultSearchEngineCallback callback) override;
  void SearchWithDefaultEngine(const std::string& query) override;
  void OpenCustomizeChrome() override;
  void OpenAliaSidePanel() override;

  // ntp_tiles::MostVisitedSites::Observer:
  void OnURLsAvailable(
      bool is_user_triggered,
      const std::map<ntp_tiles::SectionType, ntp_tiles::NTPTilesVector>&
          sections) override;
  void OnIconMadeAvailable(const GURL& site_url) override;

  // TemplateURLServiceObserver:
  void OnTemplateURLServiceChanged() override;

  // Snapshot builders, shared by GetState and by the pref observers.
  std::vector<ntp::mojom::WidgetPtr> CurrentWidgets() const;
  std::vector<ntp::mojom::QuickLinkPtr> CurrentQuickLinks() const;
  std::vector<ntp::mojom::SearchEnginePtr> CurrentSearchEngines() const;

  // Resolved from the WebContents at call time, never cached: a tab can be
  // dragged into another window.
  void ShowSidePanel(SidePanelEntryId id);

  void OnWidgetPrefsChanged();
  void OnQuickLinksPrefChanged();
  void OnNotesPrefChanged();
  void OnBlockedCountChanged();

  const raw_ptr<Profile> profile_;
  const raw_ptr<content::WebContents> web_contents_;
  const raw_ptr<TemplateURLService> template_url_service_;

  std::unique_ptr<ntp_tiles::MostVisitedSites> most_visited_sites_;
  PrefChangeRegistrar pref_registrar_;
  base::ScopedObservation<TemplateURLService, TemplateURLServiceObserver>
      template_url_observation_{this};

  mojo::Remote<ntp::mojom::Page> page_;
  mojo::Receiver<ntp::mojom::PageHandler> receiver_;
};

}  // namespace astro

#endif  // CHROME_BROWSER_OXY_WEBUI_ASTRO_NTP_PAGE_HANDLER_H_
