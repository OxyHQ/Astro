// Copyright 2026 Oxy. All rights reserved.
// Use of this source code is governed by a BSD-style license.

#ifndef CHROME_BROWSER_OXY_WEBUI_ASTRO_THEME_PROVIDER_H_
#define CHROME_BROWSER_OXY_WEBUI_ASTRO_THEME_PROVIDER_H_

#include "base/memory/raw_ptr.h"
#include "base/scoped_observation.h"
#include "chrome/browser/oxy/astro_theme_service.h"
#include "chrome/browser/oxy/webui/astro_theme.mojom.h"
#include "mojo/public/cpp/bindings/pending_receiver.h"
#include "mojo/public/cpp/bindings/pending_remote.h"
#include "mojo/public/cpp/bindings/receiver.h"
#include "mojo/public/cpp/bindings/remote_set.h"

class Profile;

namespace astro {

// Serves astro.mojom.ThemeProvider for one page.
//
// Owned by that page's controller and held by every Astro controller, so a
// page gets the live theme by existing rather than by asking a service it
// would then have to keep in step. Read-only by construction: it has no way to
// change anything, which is what lets it be handed to pages that must not.
class AstroThemeProvider : public mojom::ThemeProvider,
                           public AstroThemeService::Observer {
 public:
  explicit AstroThemeProvider(Profile* profile);
  ~AstroThemeProvider() override;

  AstroThemeProvider(const AstroThemeProvider&) = delete;
  AstroThemeProvider& operator=(const AstroThemeProvider&) = delete;

  void Bind(mojo::PendingReceiver<mojom::ThemeProvider> receiver);

 private:
  // mojom::ThemeProvider:
  void GetTheme(GetThemeCallback callback) override;
  void AddObserver(mojo::PendingRemote<mojom::ThemeObserver> observer) override;

  // AstroThemeService::Observer:
  void OnAstroThemeChanged() override;

  mojom::ThemePtr CurrentTheme() const;

  const raw_ptr<AstroThemeService> service_;
  mojo::Receiver<mojom::ThemeProvider> receiver_{this};
  mojo::RemoteSet<mojom::ThemeObserver> observers_;
  base::ScopedObservation<AstroThemeService, AstroThemeService::Observer>
      observation_{this};
};

}  // namespace astro

#endif  // CHROME_BROWSER_OXY_WEBUI_ASTRO_THEME_PROVIDER_H_
