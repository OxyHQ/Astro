// Copyright 2026 Oxy. Apache-2.0.

#ifndef CHROME_BROWSER_ASTRO_PIP_AC_PIP_CONTROLS_H_
#define CHROME_BROWSER_ASTRO_PIP_AC_PIP_CONTROLS_H_

#include <optional>
#include <vector>

#include "base/functional/callback.h"
#include "base/memory/raw_ptr.h"
#include "base/timer/timer.h"
#include "chrome/browser/ui/views/overlay/back_to_tab_button.h"
#include "chrome/browser/ui/views/overlay/close_image_button.h"
#include "chrome/browser/ui/views/overlay/overlay_controls_fade_animation.h"
#include "chrome/browser/ui/views/overlay/playback_image_button.h"
#include "services/media_session/public/cpp/media_position.h"
#include "ui/base/metadata/metadata_header_macros.h"
#include "ui/views/view.h"

namespace gfx {
class Canvas;
}

inline constexpr int kAstroPipButtonMargin = 12;
inline constexpr int kAstroPipButtonSize = 28;

class AstroBackToTabButton : public OverlayWindowBackToTabButton {
  METADATA_HEADER(AstroBackToTabButton, OverlayWindowBackToTabButton)

 public:
  explicit AstroBackToTabButton(PressedCallback callback);
  AstroBackToTabButton(const AstroBackToTabButton&) = delete;
  AstroBackToTabButton& operator=(const AstroBackToTabButton&) = delete;
  ~AstroBackToTabButton() override;

  void Place(const gfx::Size& window_size);

 protected:
  void OnPaintBackground(gfx::Canvas* canvas) override;
  void PaintButtonContents(gfx::Canvas* canvas) override;
};

class AstroCloseButton : public CloseImageButton {
  METADATA_HEADER(AstroCloseButton, CloseImageButton)

 public:
  static constexpr int kWidth = 29;

  explicit AstroCloseButton(PressedCallback callback);
  AstroCloseButton(const AstroCloseButton&) = delete;
  AstroCloseButton& operator=(const AstroCloseButton&) = delete;
  ~AstroCloseButton() override;

  void Place(const gfx::Size& window_size);

 protected:
  void OnPaintBackground(gfx::Canvas* canvas) override;
  void PaintButtonContents(gfx::Canvas* canvas) override;
};

class AstroPlaybackButton : public PlaybackImageButton {
  METADATA_HEADER(AstroPlaybackButton, PlaybackImageButton)

 public:
  explicit AstroPlaybackButton(PressedCallback callback);
  AstroPlaybackButton(const AstroPlaybackButton&) = delete;
  AstroPlaybackButton& operator=(const AstroPlaybackButton&) = delete;
  ~AstroPlaybackButton() override;

 protected:
  void OnPaintBackground(gfx::Canvas* canvas) override;
  void PaintButtonContents(gfx::Canvas* canvas) override;
};

class AstroProgressBar : public views::View {
  METADATA_HEADER(AstroProgressBar, views::View)

 public:
  static constexpr int kSlopX = 4;
  static constexpr int kSlopY = 6;
  static constexpr float kBarHeight = 5;

  explicit AstroProgressBar(base::RepeatingCallback<void(double)> seek);
  AstroProgressBar(const AstroProgressBar&) = delete;
  AstroProgressBar& operator=(const AstroProgressBar&) = delete;
  ~AstroProgressBar() override;

  void SetMediaPosition(const media_session::MediaPosition& position);

  void Place(const gfx::Size& window_size);

  void OnPaint(gfx::Canvas* canvas) override;
  bool OnMousePressed(const ui::MouseEvent& event) override;
  bool OnMouseDragged(const ui::MouseEvent& event) override;
  void OnMouseReleased(const ui::MouseEvent& event) override;
  void OnMouseCaptureLost() override;
  ui::Cursor GetCursor(const ui::MouseEvent& event) override;

 private:
  double FractionAt(int x) const;
  void RepaintIfDrawn();

  base::RepeatingCallback<void(double)> seek_;
  media_session::MediaPosition position_;
  std::optional<double> drag_fraction_;
  bool dragging_ = false;
  base::RepeatingTimer timer_;
};

class AstroControlsFadeAnimation : public OverlayControlsFadeAnimation {
 public:
  AstroControlsFadeAnimation(
      const std::vector<raw_ptr<views::View>>& controls,
      Type type);
  AstroControlsFadeAnimation(const AstroControlsFadeAnimation&) =
      delete;
  AstroControlsFadeAnimation& operator=(
      const AstroControlsFadeAnimation&) = delete;
  ~AstroControlsFadeAnimation() override;

  void AnimateToState(double state) override;
};

#endif
