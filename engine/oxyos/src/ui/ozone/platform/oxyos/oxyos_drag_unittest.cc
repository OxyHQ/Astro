// Copyright 2026 Oxy. Apache-2.0.

#include "ui/ozone/platform/oxyos/oxyos_drag.h"

#include <memory>
#include <optional>
#include <string>
#include <vector>

#include "base/strings/utf_string_conversions.h"
#include "testing/gtest/include/gtest/gtest.h"
#include "ui/base/dragdrop/drag_drop_types.h"
#include "ui/base/dragdrop/os_exchange_data.h"
#include "ui/base/dragdrop/os_exchange_data_provider_non_backed.h"
#include "ui/platform_window/wm/wm_drop_handler.h"

namespace ui {

namespace {

class RecordingTarget : public WmDropHandler {
 public:
  void OnDragEnter(const gfx::PointF& point,
                   int operations,
                   int modifiers) override {
    calls.push_back("enter");
  }
  void OnDragDataAvailable(std::unique_ptr<OSExchangeData> data) override {
    std::optional<std::u16string> text = data->GetString();
    calls.push_back("data " + (text ? base::UTF16ToUTF8(*text) : ""));
  }
  int OnDragMotion(const gfx::PointF& point,
                   int operations,
                   int modifiers) override {
    calls.push_back("motion");
    return accepts;
  }
  void OnDragDrop(int modifiers) override { calls.push_back("drop"); }
  void OnDragLeave() override { calls.push_back("leave"); }

  std::vector<std::string> calls;
  int accepts = DragDropTypes::DRAG_COPY;
};

class RecordingLocation : public WmDragHandler::LocationDelegate {
 public:
  void OnDragLocationChanged(const gfx::Point& screen_point_px) override {
    locations.push_back(screen_point_px);
  }
  void OnDragOperationChanged(mojom::DragOperation operation) override {
    operations.push_back(operation);
  }
  std::optional<gfx::AcceleratedWidget> GetDragWidget() override {
    return std::nullopt;
  }

  std::vector<gfx::Point> locations;
  std::vector<mojom::DragOperation> operations;
};

std::unique_ptr<OSExchangeData> TextData(const std::u16string& text) {
  auto data = std::make_unique<OSExchangeData>(
      std::make_unique<OSExchangeDataProviderNonBacked>());
  data->SetString(text);
  return data;
}

constexpr int kCopyOrMove = DragDropTypes::DRAG_COPY | DragDropTypes::DRAG_MOVE;

}

TEST(OxyOSDragTest, ADragInsideTheWindowEntersOnceAndDropsWhatTheTargetTook) {
  RecordingTarget target;
  RecordingLocation location;
  auto data = TextData(u"oxyos");
  OxyOSDrag drag(&target, *data, kCopyOrMove, &location, gfx::SizeF(400, 300));
  drag.Motion(gfx::PointF(10, 10), gfx::Point(20, 20), 0);
  drag.Motion(gfx::PointF(200, 150), gfx::Point(400, 300), 0);
  EXPECT_EQ(drag.Drop(0), mojom::DragOperation::kCopy);
  EXPECT_EQ(target.calls,
            (std::vector<std::string>{"enter", "data oxyos", "motion", "motion",
                                      "drop", "leave"}));
  EXPECT_EQ(location.locations,
            (std::vector<gfx::Point>{{20, 20}, {400, 300}}));
  EXPECT_EQ(location.operations,
            std::vector<mojom::DragOperation>{mojom::DragOperation::kCopy});
}

TEST(OxyOSDragTest, LeavingTheWindowLeavesAndComingBackEntersWithTheDataAgain) {
  RecordingTarget target;
  auto data = TextData(u"a");
  OxyOSDrag drag(&target, *data, kCopyOrMove, nullptr, gfx::SizeF(400, 300));
  drag.Motion(gfx::PointF(10, 10), gfx::Point(), 0);
  drag.Motion(gfx::PointF(450, 10), gfx::Point(), 0);
  EXPECT_FALSE(drag.entered());
  EXPECT_EQ(drag.operation(), mojom::DragOperation::kNone);
  drag.Motion(gfx::PointF(20, 10), gfx::Point(), 0);
  EXPECT_EQ(target.calls,
            (std::vector<std::string>{"enter", "data a", "motion", "leave",
                                      "enter", "data a", "motion"}));
}

TEST(OxyOSDragTest,
     AReleaseOutsideTheWindowOrOverNothingThatAcceptsDropsNothing) {
  RecordingTarget target;
  auto data = TextData(u"a");
  {
    OxyOSDrag drag(&target, *data, kCopyOrMove, nullptr, gfx::SizeF(400, 300));
    drag.Motion(gfx::PointF(10, -5), gfx::Point(), 0);
    EXPECT_EQ(drag.Drop(0), mojom::DragOperation::kNone);
    EXPECT_TRUE(target.calls.empty());
  }
  target.accepts = DragDropTypes::DRAG_NONE;
  OxyOSDrag drag(&target, *data, kCopyOrMove, nullptr, gfx::SizeF(400, 300));
  drag.Motion(gfx::PointF(10, 10), gfx::Point(), 0);
  EXPECT_EQ(drag.Drop(0), mojom::DragOperation::kNone);
  EXPECT_EQ(target.calls,
            (std::vector<std::string>{"enter", "data a", "motion", "leave"}));
}

TEST(OxyOSDragTest, TheTargetGetsOnlyAnOperationTheSourceAllows) {
  RecordingTarget target;
  target.accepts = DragDropTypes::DRAG_MOVE | DragDropTypes::DRAG_LINK;
  auto data = TextData(u"a");
  OxyOSDrag drag(&target, *data, DragDropTypes::DRAG_COPY, nullptr,
                 gfx::SizeF(400, 300));
  drag.Motion(gfx::PointF(10, 10), gfx::Point(), 0);
  EXPECT_EQ(drag.operation(), mojom::DragOperation::kNone);
  target.accepts = DragDropTypes::DRAG_COPY;
  drag.Motion(gfx::PointF(11, 10), gfx::Point(), 0);
  EXPECT_EQ(drag.operation(), mojom::DragOperation::kCopy);
}

TEST(OxyOSDragTest, AWindowWithoutADropHandlerTakesNothing) {
  auto data = TextData(u"a");
  OxyOSDrag drag(nullptr, *data, kCopyOrMove, nullptr, gfx::SizeF(400, 300));
  drag.Motion(gfx::PointF(10, 10), gfx::Point(), 0);
  EXPECT_FALSE(drag.entered());
  EXPECT_EQ(drag.Drop(0), mojom::DragOperation::kNone);
}

}
