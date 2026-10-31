// Copyright 2026 Oxy. Apache-2.0.

#include "ui/ozone/platform/oxyos/oxyos_clipboard.h"

#include <unistd.h>

#include <string>
#include <utility>
#include <vector>

#include "base/files/file_util.h"
#include "base/files/scoped_file.h"
#include "base/run_loop.h"
#include "base/test/task_environment.h"
#include "testing/gtest/include/gtest/gtest.h"
#include "ui/base/clipboard/clipboard_constants.h"

namespace ui {

namespace {

PlatformClipboard::Data Bytes(std::string_view text) {
  return base::MakeRefCounted<base::RefCountedBytes>(
      std::vector<uint8_t>(text.begin(), text.end()));
}

std::string Text(const PlatformClipboard::Data& data) {
  return data ? std::string(data->as_vector().begin(), data->as_vector().end())
              : std::string("<none>");
}

class FakeTransport : public OxyOSClipboard::Transport {
 public:
  void Copy(const std::vector<std::pair<std::string, PlatformClipboard::Data>>&
                contents) override {
    copies.push_back(contents);
  }
  void ClearClipboard() override { ++clears; }
  base::ScopedFD Paste(uint32_t selection,
                       const std::string& mime_type) override {
    pastes.emplace_back(selection, mime_type);
    if (refuse) {
      return base::ScopedFD();
    }
    int fds[2];
    EXPECT_TRUE(base::CreateLocalNonBlockingPipe(fds));
    writer.reset(fds[1]);
    return base::ScopedFD(fds[0]);
  }

  std::vector<std::vector<std::pair<std::string, PlatformClipboard::Data>>>
      copies;
  int clears = 0;
  std::vector<std::pair<uint32_t, std::string>> pastes;
  base::ScopedFD writer;
  bool refuse = false;
};

class OxyOSClipboardTest : public testing::Test {
 protected:
  void Hold(uint32_t selection, const std::vector<std::string>& types) {
    clipboard_.OnTypes(selection, types.size());
    for (const std::string& type : types) {
      clipboard_.OnType(selection, type);
    }
  }

  std::vector<std::string> Available() {
    std::vector<std::string> types;
    clipboard_.GetAvailableMimeTypes(
        ClipboardBuffer::kCopyPaste,
        base::BindOnce([](std::vector<std::string>* out,
                          const std::vector<std::string>& got) { *out = got; },
                       &types));
    return types;
  }

  PlatformClipboard::Data Paste(const std::string& type,
                                std::string_view written,
                                bool close_after) {
    base::RunLoop loop;
    PlatformClipboard::Data result;
    bool answered = false;
    clipboard_.RequestClipboardData(
        ClipboardBuffer::kCopyPaste, type,
        base::BindOnce(
            [](PlatformClipboard::Data* out, bool* answered,
               base::OnceClosure quit, const PlatformClipboard::Data& data) {
              *out = data;
              *answered = true;
              std::move(quit).Run();
            },
            &result, &answered, loop.QuitClosure()));
    if (transport_.writer.is_valid()) {
      EXPECT_TRUE(base::WriteFileDescriptor(transport_.writer.get(), written));
      if (close_after) {
        transport_.writer.reset();
      }
    }
    if (!answered) {
      loop.Run();
    }
    return result;
  }

  base::test::TaskEnvironment task_environment_{
      base::test::TaskEnvironment::MainThreadType::UI};
  FakeTransport transport_;
  OxyOSClipboard clipboard_{&transport_};
};

}

TEST(OxyOSClipboardTypesTest,
     ACopyOffersTheMostFaithfulTypeFirstAndNoX11Atoms) {
  PlatformClipboard::DataMap data;
  for (const char* type :
       {kMimeTypeLinuxUtf8String, kMimeTypeLinuxString, kMimeTypeLinuxText,
        kMimeTypePlainText, kMimeTypeUtf8PlainText, kMimeTypeHtml, kMimeTypePng,
        kMimeTypeDataTransferCustomData,
        "application/x-a-type-name-past-32-bytes", "text/x-moz-url"}) {
    data[type] = Bytes(type);
  }
  EXPECT_EQ(OxyOSClipboardOfferedTypes(data),
            (std::vector<std::string>{
                kMimeTypePng, kMimeTypeHtml, kMimeTypeDataTransferCustomData,
                "text/x-moz-url", kMimeTypeUtf8PlainText, kMimeTypePlainText}));
}

TEST(OxyOSClipboardTypesTest, AnOfferNamesAtMostSixteenTypes) {
  PlatformClipboard::DataMap data;
  for (int i = 0; i < 20; ++i) {
    data["text/x-" + std::to_string(100 + i)] = Bytes("x");
  }
  data[kMimeTypeUtf8PlainText] = Bytes("x");
  const std::vector<std::string> types = OxyOSClipboardOfferedTypes(data);
  EXPECT_EQ(types.size(), kOxyOSClipboardMaxTypes);
  EXPECT_EQ(types.front(), "text/x-100");
}

TEST(OxyOSClipboardTypesTest,
     TextIsPastedFromWhicheverTextTypeTheClipboardHolds) {
  const std::vector<std::string> bloom = {kMimeTypeUtf8PlainText};
  EXPECT_EQ(OxyOSClipboardTypeToPaste(kMimeTypePlainText, bloom),
            kMimeTypeUtf8PlainText);
  EXPECT_EQ(OxyOSClipboardTypeToPaste(kMimeTypeLinuxUtf8String, bloom),
            kMimeTypeUtf8PlainText);
  EXPECT_EQ(OxyOSClipboardTypeToPaste(kMimeTypeHtml, bloom), std::nullopt);
  EXPECT_EQ(OxyOSClipboardTypeToPaste(kMimeTypeHtml, {kMimeTypeHtml}),
            kMimeTypeHtml);
  EXPECT_EQ(
      OxyOSClipboardAvailableTypes(bloom),
      (std::vector<std::string>{kMimeTypeUtf8PlainText, kMimeTypePlainText}));
}

TEST_F(OxyOSClipboardTest, TheClipboardIsWhatTheCompositorLastToldWhole) {
  int changes = 0;
  clipboard_.SetClipboardDataChangedCallback(base::BindRepeating(
      [](int* changes, ClipboardBuffer buffer) {
        EXPECT_EQ(buffer, ClipboardBuffer::kCopyPaste);
        ++*changes;
      },
      &changes));
  EXPECT_TRUE(Available().empty());
  clipboard_.OnTypes(4, 2);
  clipboard_.OnType(4, kMimeTypeHtml);
  EXPECT_EQ(changes, 0);
  EXPECT_TRUE(Available().empty());
  clipboard_.OnType(3, kMimeTypePng);
  clipboard_.OnType(4, kMimeTypeUtf8PlainText);
  EXPECT_EQ(changes, 1);
  EXPECT_EQ(Available(),
            (std::vector<std::string>{kMimeTypeHtml, kMimeTypeUtf8PlainText,
                                      kMimeTypePlainText}));
  clipboard_.OnEmpty();
  EXPECT_EQ(changes, 2);
  EXPECT_TRUE(Available().empty());
  EXPECT_FALSE(clipboard_.IsSelectionBufferAvailable());
}

TEST_F(OxyOSClipboardTest, ACopyGoesWholeAndAnEmptyOneClears) {
  PlatformClipboard::DataMap data;
  data[kMimeTypeUtf8PlainText] = Bytes("hola");
  data[kMimeTypeHtml] = Bytes("<b>hola</b>");
  data[kMimeTypeLinuxUtf8String] = Bytes("hola");
  clipboard_.OfferClipboardData(ClipboardBuffer::kCopyPaste, data);
  ASSERT_EQ(transport_.copies.size(), 1u);
  ASSERT_EQ(transport_.copies[0].size(), 2u);
  EXPECT_EQ(transport_.copies[0][0].first, kMimeTypeHtml);
  EXPECT_EQ(Text(transport_.copies[0][0].second), "<b>hola</b>");
  EXPECT_EQ(transport_.copies[0][1].first, kMimeTypeUtf8PlainText);
  clipboard_.OfferClipboardData(ClipboardBuffer::kSelection, data);
  EXPECT_EQ(transport_.copies.size(), 1u);
  clipboard_.OfferClipboardData(ClipboardBuffer::kCopyPaste, {});
  EXPECT_EQ(transport_.clears, 1);
}

TEST_F(OxyOSClipboardTest, APasteReadsTheOwnersPipeToItsEnd) {
  Hold(7, {kMimeTypeHtml, kMimeTypeUtf8PlainText});
  EXPECT_EQ(Text(Paste(kMimeTypePlainText, "hola", true)), "hola");
  EXPECT_EQ(transport_.pastes.back(),
            std::make_pair(7u, std::string(kMimeTypeUtf8PlainText)));
  const std::string big(60000, 'x');
  EXPECT_EQ(Text(Paste(kMimeTypeHtml, big, true)), big);
}

TEST_F(OxyOSClipboardTest, NothingIsAskedForATypeTheClipboardDoesNotHold) {
  Hold(7, {kMimeTypeUtf8PlainText});
  EXPECT_EQ(Paste(kMimeTypePng, "", true), nullptr);
  EXPECT_TRUE(transport_.pastes.empty());
  transport_.refuse = true;
  EXPECT_EQ(Paste(kMimeTypePlainText, "", true), nullptr);
}

TEST_F(OxyOSClipboardTest, AnOwnerThatNeverFinishesGivesNothingByTheDeadline) {
  clipboard_.set_paste_deadline_for_testing(base::Milliseconds(50));
  Hold(7, {kMimeTypeUtf8PlainText});
  EXPECT_EQ(Paste(kMimeTypePlainText, "half", false), nullptr);
}

TEST(OxyOSReadPipeTest, APipeEndsWhenItsWriterClosesEvenWithNothingInIt) {
  int fds[2];
  ASSERT_TRUE(base::CreateLocalNonBlockingPipe(fds));
  base::ScopedFD reader(fds[0]);
  close(fds[1]);
  const std::optional<std::vector<uint8_t>> empty =
      OxyOSReadPipe(std::move(reader), base::Seconds(5));
  ASSERT_TRUE(empty.has_value());
  EXPECT_TRUE(empty->empty());

  ASSERT_TRUE(base::CreateLocalNonBlockingPipe(fds));
  base::ScopedFD open_reader(fds[0]);
  base::ScopedFD writer(fds[1]);
  ASSERT_TRUE(base::WriteFileDescriptor(writer.get(), "half"));
  EXPECT_EQ(OxyOSReadPipe(std::move(open_reader), base::Milliseconds(30)),
            std::nullopt);
}

}
