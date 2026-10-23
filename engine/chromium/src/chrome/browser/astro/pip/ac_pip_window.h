// Copyright 2026 Oxy. Apache-2.0.

#ifndef CHROME_BROWSER_ASTRO_PIP_AC_PIP_WINDOW_H_
#define CHROME_BROWSER_ASTRO_PIP_AC_PIP_WINDOW_H_

#include <memory>

#include "base/memory/raw_ptr.h"
#include "base/time/time.h"
#include "base/timer/timer.h"
#include "chrome/browser/ui/views/overlay/video_overlay_window_views.h"

class AstroProgressBar;

namespace content {
class VideoPictureInPictureWindowController;
}

class AstroVideoOverlayWindow : public VideoOverlayWindowViews {
 public:
  explicit AstroVideoOverlayWindow(
      content::VideoPictureInPictureWindowController* controller);
  AstroVideoOverlayWindow(const AstroVideoOverlayWindow&) = delete;
  AstroVideoOverlayWindow& operator=(const AstroVideoOverlayWindow&) =
      delete;
  ~AstroVideoOverlayWindow() override;

  void ShowInactive() override;
  void Hide() override;
  void SetMediaPosition(const media_session::MediaPosition& position) override;
  void OnNativeWidgetMove() override;
  void OnNativeWidgetDestroyed() override;
  void OnNativeWidgetSizeChanged(const gfx::Size& new_size) override;
  void OnUpdateControlsBounds() override;
  void UpdateControlsVisibility(bool is_visible, bool should_animate) override;
  gfx::Rect GetProgressViewBounds() override;

 private:
  gfx::Rect CalculateAndUpdateWindowBounds() override;
  void SetUpViews() override;

  void OnCloseButtonPressed();
  void MaybeSaveBounds();
  void FinishHide();

  raw_ptr<AstroProgressBar> ac_progress_bar_ = nullptr;
  base::TimeDelta ac_hide_fade_;
  base::OneShotTimer ac_hide_timer_;
};

std::unique_ptr<VideoOverlayWindowViews> NewAstroVideoOverlayWindow(
    content::VideoPictureInPictureWindowController* controller);

#endif
