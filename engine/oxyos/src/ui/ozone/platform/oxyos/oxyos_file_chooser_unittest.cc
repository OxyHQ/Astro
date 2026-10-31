// Copyright 2026 Oxy. Apache-2.0.

#include "ui/ozone/platform/oxyos/oxyos_file_chooser.h"

#include <optional>
#include <string>
#include <string_view>
#include <vector>

#include "base/functional/bind.h"
#include "base/run_loop.h"
#include "base/test/task_environment.h"
#include "testing/gtest/include/gtest/gtest.h"

namespace ui {

namespace {

using Files = std::optional<std::vector<base::FilePath>>;

struct Sent {
  uint32_t serial;
  gfx::AcceleratedWidget window;
  std::string request;
};

class FakeTransport : public OxyOSFileChooser::Transport {
 public:
  uint16_t FileChooserProtocolVersion() override { return version; }
  std::optional<uint32_t> ChooseFiles(uint32_t serial,
                                      gfx::AcceleratedWidget window,
                                      const std::string& request) override {
    sent.push_back({serial, window, request});
    if (refuse) {
      return std::nullopt;
    }
    return static_cast<uint32_t>(window);
  }
  void CancelChooseFiles(uint32_t serial) override {
    cancelled.push_back(serial);
  }

  uint16_t version = kOxyOSFileChooserProtocol;
  bool refuse = false;
  std::vector<Sent> sent;
  std::vector<uint32_t> cancelled;
};

OxyOSFileDialogRequest Request(OxyOSFileDialogKind kind) {
  OxyOSFileDialogRequest request;
  request.kind = kind;
  return request;
}

void Answer(OxyOSFileChooser& chooser,
            uint32_t serial,
            std::string_view answer) {
  uint16_t index = 0;
  do {
    const std::string_view chunk = answer.substr(0, 32);
    answer.remove_prefix(chunk.size());
    chooser.OnChunk(serial, index++, answer.empty(), chunk);
  } while (!answer.empty());
}

class OxyOSSelectFileDialogTest : public testing::Test {
 protected:
  std::optional<uint32_t> Choose(OxyOSFileDialogKind kind,
                                 gfx::AcceleratedWidget window = 5) {
    return chooser_.Choose(window, Request(kind),
                           base::BindOnce(
                               [](std::vector<Files>* answers, Files files) {
                                 answers->push_back(std::move(files));
                               },
                               &answers_));
  }

  base::test::TaskEnvironment task_environment_;
  FakeTransport transport_;
  OxyOSFileChooser chooser_{&transport_};
  std::vector<Files> answers_;
};

}

TEST(OxyOSSelectFileDialogRequestTest, OpenOneFileWithItsTypes) {
  OxyOSFileDialogRequest request = Request(OxyOSFileDialogKind::kOpenFile);
  request.title = "Choose an image";
  request.default_path = base::FilePath("/home/u/Pictures/a.png");
  request.extensions = {{"png", "JPG"}, {"png", "gif"}};
  request.file_type_index = 2;
  EXPECT_EQ(OxyOSFileChooserRequest(request),
            "{\"open\":{\"directory\":false,"
            "\"folder\":\"file:///home/u/Pictures\",\"multiple\":false,"
            "\"title\":\"Choose an image\","
            "\"types\":[\".png\",\".jpg\",\".gif\"]}}");
}

TEST(OxyOSSelectFileDialogRequestTest, OpenManyFilesOfAnyType) {
  EXPECT_EQ(OxyOSFileChooserRequest(Request(OxyOSFileDialogKind::kOpenFiles)),
            "{\"open\":{\"directory\":false,\"multiple\":true}}");
}

TEST(OxyOSSelectFileDialogRequestTest, FolderStartsInTheFolderAndHasNoTypes) {
  OxyOSFileDialogRequest request = Request(OxyOSFileDialogKind::kFolder);
  request.default_path = base::FilePath("/home/u/My Documents");
  request.default_path_is_folder = true;
  request.extensions = {{"txt"}};
  EXPECT_EQ(OxyOSFileChooserRequest(request),
            "{\"open\":{\"directory\":true,"
            "\"folder\":\"file:///home/u/My%20Documents\","
            "\"multiple\":false}}");
}

TEST(OxyOSSelectFileDialogRequestTest, SaveSuggestsTheNameInItsFolder) {
  OxyOSFileDialogRequest request = Request(OxyOSFileDialogKind::kSave);
  request.title = "Save Page As";
  request.default_path = base::FilePath("/home/u/Documents/My page.html");
  request.extensions = {{"html", "htm"}, {"mhtml"}};
  request.file_type_index = 2;
  EXPECT_EQ(OxyOSFileChooserRequest(request),
            "{\"save\":{\"folder\":\"file:///home/u/Documents\","
            "\"name\":\"My page.html\",\"title\":\"Save Page As\","
            "\"types\":[\".mhtml\"]}}");
  request.file_type_index = 0;
  EXPECT_EQ(OxyOSFileChooserRequest(request),
            "{\"save\":{\"folder\":\"file:///home/u/Documents\","
            "\"name\":\"My page.html\",\"title\":\"Save Page As\","
            "\"types\":[\".html\",\".htm\",\".mhtml\"]}}");
}

TEST(OxyOSSelectFileDialogRequestTest, SaveWithANameAlone) {
  OxyOSFileDialogRequest request = Request(OxyOSFileDialogKind::kSave);
  request.default_path = base::FilePath("untitled.txt");
  EXPECT_EQ(OxyOSFileChooserRequest(request),
            "{\"save\":{\"name\":\"untitled.txt\"}}");
}

TEST(OxyOSSelectFileDialogRequestTest, SaveIntoAFolder) {
  OxyOSFileDialogRequest request = Request(OxyOSFileDialogKind::kSave);
  request.default_path = base::FilePath("/home/u/Downloads");
  request.default_path_is_folder = true;
  EXPECT_EQ(OxyOSFileChooserRequest(request),
            "{\"save\":{\"folder\":\"file:///home/u/Downloads\"}}");
}

TEST(OxyOSSelectFileDialogRequestTest, TypesTheSessionWouldRefuseAreLeftOut) {
  OxyOSFileDialogRequest request = Request(OxyOSFileDialogKind::kOpenFile);
  request.extensions = {{"", ".tar.gz", "a/b", "*", "TXT", "txt", "x."}};
  EXPECT_EQ(OxyOSFileChooserRequest(request),
            "{\"open\":{\"directory\":false,\"multiple\":false,"
            "\"types\":[\".tar.gz\",\".txt\"]}}");
}

TEST_F(OxyOSSelectFileDialogTest, SendsTheRequestForTheWindow) {
  EXPECT_EQ(Choose(OxyOSFileDialogKind::kOpenFiles, 9), 1u);
  ASSERT_EQ(transport_.sent.size(), 1u);
  EXPECT_EQ(transport_.sent[0].serial, 1u);
  EXPECT_EQ(transport_.sent[0].window, 9u);
  EXPECT_EQ(transport_.sent[0].request,
            "{\"open\":{\"directory\":false,\"multiple\":true}}");
  EXPECT_TRUE(chooser_.IsChoosing());
}

TEST_F(OxyOSSelectFileDialogTest, AnswerIsAssembledFromChunks) {
  const std::optional<uint32_t> serial =
      Choose(OxyOSFileDialogKind::kOpenFiles);
  ASSERT_TRUE(serial);
  Answer(chooser_, *serial,
         "{\"chosen\":[\"file:///home/u/a.png\","
         "\"file:///home/u/My%20b%C3%A9.png\"]}");
  ASSERT_EQ(answers_.size(), 1u);
  ASSERT_TRUE(answers_[0]);
  EXPECT_EQ(*answers_[0], (std::vector<base::FilePath>{
                              base::FilePath("/home/u/a.png"),
                              base::FilePath("/home/u/My b\xC3\xA9.png")}));
  EXPECT_FALSE(chooser_.IsChoosing());
}

TEST_F(OxyOSSelectFileDialogTest, SaveAnswerIsTheFileToWrite) {
  const std::optional<uint32_t> serial = Choose(OxyOSFileDialogKind::kSave);
  ASSERT_TRUE(serial);
  Answer(chooser_, *serial,
         "{\"chosen\":[\"file:///home/u/Documents/x.txt\"]}");
  ASSERT_EQ(answers_.size(), 1u);
  ASSERT_TRUE(answers_[0]);
  EXPECT_EQ(
      *answers_[0],
      (std::vector<base::FilePath>{base::FilePath("/home/u/Documents/x.txt")}));
}

TEST_F(OxyOSSelectFileDialogTest, CancelledAndRefusedAreCancellations) {
  for (std::string_view answer :
       {"{\"cancelled\":{}}", "{\"refused\":{\"reason\":\"busy\"}}",
        "{\"refused\":{\"reason\":\"needsInput\"}}", "{\"chosen\":[]}",
        "{\"chosen\":[\"https://example.com/a.png\"]}",
        "{\"chosen\":[\"file:///a\"],\"cancelled\":{}}", "not json"}) {
    answers_.clear();
    const std::optional<uint32_t> serial =
        Choose(OxyOSFileDialogKind::kOpenFiles);
    ASSERT_TRUE(serial);
    Answer(chooser_, *serial, answer);
    ASSERT_EQ(answers_.size(), 1u) << answer;
    EXPECT_FALSE(answers_[0]) << answer;
  }
}

TEST_F(OxyOSSelectFileDialogTest, OneFileDialogTakesExactlyOne) {
  const std::optional<uint32_t> serial = Choose(OxyOSFileDialogKind::kOpenFile);
  ASSERT_TRUE(serial);
  Answer(chooser_, *serial, "{\"chosen\":[\"file:///a\",\"file:///b\"]}");
  ASSERT_EQ(answers_.size(), 1u);
  EXPECT_FALSE(answers_[0]);
}

TEST_F(OxyOSSelectFileDialogTest, SecondChunkSequenceStartsTheAnswerAgain) {
  const std::optional<uint32_t> serial = Choose(OxyOSFileDialogKind::kOpenFile);
  ASSERT_TRUE(serial);
  chooser_.OnChunk(*serial, 0, false, "{\"chosen\":[\"file:///home/u/old");
  chooser_.OnChunk(*serial, 1, false, ".png\"]");
  Answer(chooser_, *serial, "{\"chosen\":[\"file:///home/u/new.png\"]}");
  ASSERT_EQ(answers_.size(), 1u);
  ASSERT_TRUE(answers_[0]);
  EXPECT_EQ(*answers_[0],
            (std::vector<base::FilePath>{base::FilePath("/home/u/new.png")}));
}

TEST_F(OxyOSSelectFileDialogTest, RequestsAreAnsweredBySerial) {
  const std::optional<uint32_t> first = Choose(OxyOSFileDialogKind::kOpenFile);
  const std::optional<uint32_t> second =
      Choose(OxyOSFileDialogKind::kOpenFile, 6);
  ASSERT_TRUE(first);
  ASSERT_TRUE(second);
  EXPECT_NE(*first, *second);
  chooser_.OnChunk(*second, 0, false, "{\"chosen\":[\"file:///second");
  chooser_.OnChunk(*first, 0, true, "{\"cancelled\":{}}");
  chooser_.OnChunk(*second, 1, true, "\"]}");
  ASSERT_EQ(answers_.size(), 2u);
  EXPECT_FALSE(answers_[0]);
  ASSERT_TRUE(answers_[1]);
  EXPECT_EQ(*answers_[1],
            (std::vector<base::FilePath>{base::FilePath("/second")}));
  chooser_.OnChunk(*first, 0, true, "{\"chosen\":[\"file:///late\"]}");
  EXPECT_EQ(answers_.size(), 2u);
}

TEST_F(OxyOSSelectFileDialogTest, ChunksOutOfOrderAreACancellation) {
  const std::optional<uint32_t> serial = Choose(OxyOSFileDialogKind::kOpenFile);
  ASSERT_TRUE(serial);
  chooser_.OnChunk(*serial, 0, false, "{\"chosen\":[\"file:///home/u/a");
  chooser_.OnChunk(*serial, 2, true, ".png\"]}");
  ASSERT_EQ(answers_.size(), 1u);
  EXPECT_FALSE(answers_[0]);
}

TEST_F(OxyOSSelectFileDialogTest, CompositorBelowProtocol7IsNotAsked) {
  transport_.version = 6;
  EXPECT_FALSE(Choose(OxyOSFileDialogKind::kOpenFile));
  EXPECT_TRUE(transport_.sent.empty());
  EXPECT_FALSE(chooser_.IsChoosing());
}

TEST_F(OxyOSSelectFileDialogTest, RequestTheConnectionCannotSendIsNotPending) {
  transport_.refuse = true;
  EXPECT_FALSE(Choose(OxyOSFileDialogKind::kOpenFile));
  EXPECT_EQ(transport_.sent.size(), 1u);
  EXPECT_FALSE(chooser_.IsChoosing());
}

TEST_F(OxyOSSelectFileDialogTest, CancelWithdrawsTheRequest) {
  const std::optional<uint32_t> serial = Choose(OxyOSFileDialogKind::kOpenFile);
  ASSERT_TRUE(serial);
  chooser_.Cancel(*serial);
  EXPECT_EQ(transport_.cancelled, std::vector<uint32_t>{*serial});
  EXPECT_FALSE(chooser_.IsChoosing());
  chooser_.OnChunk(*serial, 0, true, "{\"cancelled\":{}}");
  base::RunLoop().RunUntilIdle();
  EXPECT_TRUE(answers_.empty());
  chooser_.Cancel(*serial);
  EXPECT_EQ(transport_.cancelled.size(), 1u);
}

TEST_F(OxyOSSelectFileDialogTest, WindowGoneCancelsItsRequests) {
  const std::optional<uint32_t> gone =
      Choose(OxyOSFileDialogKind::kOpenFile, 5);
  const std::optional<uint32_t> kept =
      Choose(OxyOSFileDialogKind::kOpenFile, 6);
  ASSERT_TRUE(gone);
  ASSERT_TRUE(kept);
  chooser_.ForgetSurface(5);
  EXPECT_EQ(transport_.cancelled, std::vector<uint32_t>{*gone});
  EXPECT_TRUE(answers_.empty());
  base::RunLoop().RunUntilIdle();
  ASSERT_EQ(answers_.size(), 1u);
  EXPECT_FALSE(answers_[0]);
  EXPECT_TRUE(chooser_.IsChoosing());
}

TEST_F(OxyOSSelectFileDialogTest, TheChooserIsFoundOnceSet) {
  EXPECT_EQ(GetOxyOSFileChooser(), nullptr);
  {
    OxyOSFileChooser chooser(&transport_);
    SetOxyOSFileChooser(&chooser);
    EXPECT_EQ(GetOxyOSFileChooser(), &chooser);
  }
  EXPECT_EQ(GetOxyOSFileChooser(), nullptr);
}

}
