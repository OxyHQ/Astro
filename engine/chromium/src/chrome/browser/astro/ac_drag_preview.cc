// Copyright 2026 Oxy. Apache-2.0.

#include "chrome/browser/astro/ac_drag_preview.h"

#include <algorithm>
#include <memory>
#include <optional>
#include <string>
#include <string_view>
#include <utility>
#include <vector>

#include "base/base64.h"
#include "base/memory/raw_ptr.h"
#include "base/no_destructor.h"
#include "cc/paint/paint_flags.h"
#include "third_party/skia/include/core/SkPath.h"
#include "third_party/skia/include/core/SkRRect.h"
#include "ui/base/ui_base_types.h"
#include "ui/gfx/canvas.h"
#include "ui/gfx/codec/jpeg_codec.h"
#include "ui/gfx/codec/png_codec.h"
#include "ui/gfx/geometry/rect.h"
#include "ui/gfx/geometry/rect_conversions.h"
#include "ui/gfx/geometry/rect_f.h"
#include "ui/gfx/geometry/skia_conversions.h"
#include "ui/gfx/image/image_skia.h"
#include "ui/gfx/image/image_skia_rep.h"
#include "ui/gfx/scoped_canvas.h"
#include "ui/views/view.h"
#include "ui/views/widget/widget.h"

namespace astro {
namespace {

constexpr char kWidgetName[] = "AstroDragPreview";
constexpr char kDataPrefix[] = "data:";
constexpr char kBase64Marker[] = ";base64,";
constexpr float kRimWidth = 0.5f;
constexpr float kMinImageScale = 0.25f;
constexpr float kMaxImageScale = 4.0f;

enum class Placement { kFill, kFit, kTop };

Placement PlacementNamed(const std::string* name) {
  if (name && *name == "fit") {
    return Placement::kFit;
  }
  if (name && *name == "top") {
    return Placement::kTop;
  }
  return Placement::kFill;
}

std::optional<gfx::ImageSkia> DecodeImage(std::string_view url, float scale) {
  if (!url.starts_with(kDataPrefix)) {
    return std::nullopt;
  }
  const size_t marker = url.find(kBase64Marker);
  if (marker == std::string_view::npos) {
    return std::nullopt;
  }
  std::optional<std::vector<uint8_t>> bytes =
      base::Base64Decode(url.substr(marker + sizeof(kBase64Marker) - 1));
  if (!bytes) {
    return std::nullopt;
  }
  SkBitmap bitmap = gfx::PNGCodec::Decode(*bytes);
  if (bitmap.isNull()) {
    bitmap = gfx::JPEGCodec::Decode(*bytes);
  }
  if (bitmap.isNull()) {
    return std::nullopt;
  }
  return gfx::ImageSkia(gfx::ImageSkiaRep(
      bitmap, std::clamp(scale, kMinImageScale, kMaxImageScale)));
}

class PreviewView : public views::View {
 public:
  void SetImage(gfx::ImageSkia image, Placement placement) {
    image_ = std::move(image);
    placement_ = placement;
    SchedulePaint();
  }

  void SetRim(float radius, float alpha) {
    radius_ = radius;
    rim_alpha_ = alpha;
    SchedulePaint();
  }

  void OnPaint(gfx::Canvas* canvas) override {
    const gfx::RectF bounds(GetLocalBounds());
    if (bounds.IsEmpty()) {
      return;
    }
    {
      gfx::ScopedCanvas scoped(canvas);
      canvas->ClipPath(SkPath::RRect(SkRRect::MakeRectXY(
                           gfx::RectFToSkRect(bounds), radius_, radius_)),
                       true);
      if (!image_.isNull() && !image_.size().IsEmpty()) {
        const gfx::Rect dest = gfx::ToEnclosingRect(Destination(bounds));
        canvas->DrawImageInt(image_, 0, 0, image_.width(), image_.height(),
                             dest.x(), dest.y(), dest.width(), dest.height(),
                             true);
      }
    }
    if (rim_alpha_ > 0) {
      cc::PaintFlags rim;
      rim.setAntiAlias(true);
      rim.setStyle(cc::PaintFlags::kStroke_Style);
      rim.setStrokeWidth(kRimWidth);
      rim.setColor(SkColorSetA(SK_ColorWHITE,
                               static_cast<U8CPU>(std::clamp(rim_alpha_, 0.f, 1.f) * 255)));
      gfx::RectF edge = bounds;
      edge.Inset(kRimWidth / 2);
      canvas->DrawRoundRect(edge, radius_, rim);
    }
  }

 private:
  gfx::RectF Destination(const gfx::RectF& bounds) const {
    const float width = image_.width();
    const float height = image_.height();
    if (placement_ == Placement::kTop) {
      return gfx::RectF(0, 0, bounds.width(), bounds.width() * height / width);
    }
    const float scale =
        placement_ == Placement::kFit
            ? std::min(bounds.width() / width, bounds.height() / height)
            : std::max(bounds.width() / width, bounds.height() / height);
    const gfx::SizeF size(width * scale, height * scale);
    return gfx::RectF(gfx::PointF((bounds.width() - size.width()) / 2,
                                  (bounds.height() - size.height()) / 2),
                      size);
  }

  gfx::ImageSkia image_;
  Placement placement_ = Placement::kFill;
  float radius_ = 0;
  float rim_alpha_ = 0;
};

struct Preview {
  std::unique_ptr<views::Widget> widget;
  raw_ptr<PreviewView> view = nullptr;
};

Preview& State() {
  static base::NoDestructor<Preview> preview;
  return *preview;
}

std::optional<gfx::Rect> FrameOf(const base::DictValue& update) {
  const base::ListValue* frame = update.FindList("frame");
  if (!frame || frame->size() != 4 ||
      !std::ranges::all_of(*frame, [](const base::Value& v) {
        return v.is_int() || v.is_double();
      })) {
    return std::nullopt;
  }
  return gfx::ToRoundedRect(gfx::RectF(
      (*frame)[0].GetDouble(), (*frame)[1].GetDouble(),
      std::max(1.0, (*frame)[2].GetDouble()),
      std::max(1.0, (*frame)[3].GetDouble())));
}

PreviewView* EnsureWidget(const gfx::Rect& bounds) {
  Preview& preview = State();
  if (preview.widget && !preview.widget->IsClosed()) {
    return preview.view;
  }
  preview.widget = std::make_unique<views::Widget>();
  views::Widget::InitParams params(
      views::Widget::InitParams::CLIENT_OWNS_WIDGET,
      views::Widget::InitParams::TYPE_POPUP);
  params.name = kWidgetName;
  params.bounds = bounds;
  params.opacity = views::Widget::InitParams::WindowOpacity::kTranslucent;
  params.activatable = views::Widget::InitParams::Activatable::kNo;
  params.accept_events = false;
  params.shadow_type = views::Widget::InitParams::ShadowType::kDrop;
  params.z_order = ui::ZOrderLevel::kFloatingUIElement;
  preview.widget->Init(std::move(params));
  preview.view =
      preview.widget->SetContentsView(std::make_unique<PreviewView>());
  return preview.view;
}

void Hide() {
  Preview& preview = State();
  if (preview.widget) {
    preview.view = nullptr;
    preview.widget->CloseNow();
    preview.widget.reset();
  }
}

}

void UpdateDragPreview(const base::DictValue& update) {
  if (update.FindBool("hide").value_or(false)) {
    return Hide();
  }
  std::optional<gfx::Rect> frame = FrameOf(update);
  Preview& preview = State();
  if (!frame && !preview.widget) {
    return;
  }
  PreviewView* view = EnsureWidget(
      frame ? *frame : preview.widget->GetWindowBoundsInScreen());
  if (const std::string* image = update.FindString("image")) {
    if (std::optional<gfx::ImageSkia> decoded =
            DecodeImage(*image, update.FindDouble("scale").value_or(1))) {
      view->SetImage(std::move(*decoded),
                     PlacementNamed(update.FindString("placement")));
    }
  }
  if (std::optional<double> radius = update.FindDouble("radius")) {
    view->SetRim(*radius, update.FindDouble("rim").value_or(0));
  }
  if (frame) {
    preview.widget->SetBounds(*frame);
  }
  if (std::optional<double> opacity = update.FindDouble("opacity")) {
    preview.widget->SetOpacity(std::clamp(*opacity, 0.0, 1.0));
  }
  if (!preview.widget->IsVisible()) {
    preview.widget->ShowInactive();
  }
}

}
