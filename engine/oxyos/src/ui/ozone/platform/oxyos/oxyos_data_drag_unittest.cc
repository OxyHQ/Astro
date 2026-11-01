// Copyright 2026 Oxy. Apache-2.0.

#include "ui/ozone/platform/oxyos/oxyos_data_drag.h"

#include <map>
#include <optional>
#include <string>
#include <vector>

#include "base/containers/span.h"
#include "base/files/file_path.h"
#include "base/strings/utf_string_conversions.h"
#include "oxyos_client.h"
#include "testing/gtest/include/gtest/gtest.h"
#include "ui/base/clipboard/file_info.h"
#include "ui/base/dragdrop/drag_drop_types.h"
#include "ui/base/dragdrop/os_exchange_data.h"
#include "url/gurl.h"

namespace ui {

namespace {

std::vector<std::string> TypesOf(const OxyOSDragContents& contents) {
  std::vector<std::string> types;
  for (const auto& [type, bytes] : contents) {
    types.push_back(type);
  }
  return types;
}

std::string BytesOf(const OxyOSDragContents& contents,
                    const std::string& type) {
  for (const auto& [offered, bytes] : contents) {
    if (offered == type) {
      return bytes;
    }
  }
  return std::string();
}

}

TEST(OxyOSDataDragTest, FilesAreOfferedAsAUriListMarkedAsFiles) {
  OSExchangeData data;
  data.SetFilenames({FileInfo(base::FilePath("/home/ana/informe 1.pdf"),
                              base::FilePath("informe 1.pdf"))});
  const OxyOSDragContents contents = OxyOSDragContentsOf(data, std::nullopt);
  EXPECT_EQ(TypesOf(contents),
            (std::vector<std::string>{"text/uri-list", kOxyOSDragFilesType}));
  EXPECT_EQ(BytesOf(contents, "text/uri-list"),
            "file:///home/ana/informe%201.pdf\r\n");
}

TEST(OxyOSDataDragTest, ALinkIsOfferedAsAUriListAMozillaUrlAndText) {
  OSExchangeData data;
  data.SetURL(GURL("https://oxy.so/os"), u"OxyOS");
  const OxyOSDragContents contents = OxyOSDragContentsOf(data, std::nullopt);
  EXPECT_EQ(BytesOf(contents, "text/uri-list"), "https://oxy.so/os\r\n");
  EXPECT_EQ(BytesOf(contents, "text/x-moz-url"), "https://oxy.so/os\nOxyOS");
  EXPECT_FALSE(BytesOf(contents, "text/plain;charset=utf-8").empty());
  for (const std::string& type : TypesOf(contents)) {
    EXPECT_NE(type, kOxyOSDragFilesType);
  }
}

TEST(OxyOSDataDragTest, AnImageWrittenToAFileIsOfferedAsThatFileAndItsBytes) {
  OSExchangeData data;
  const std::string png = "png bytes";
  data.SetFileContents(base::FilePath("gato.png"), base::as_byte_span(png));
  const std::optional<OxyOSDragFileContents> file =
      OxyOSDragFileContentsOf(data);
  ASSERT_TRUE(file);
  EXPECT_EQ(file->name, base::FilePath("gato.png"));
  const OxyOSDragContents contents = OxyOSDragContentsOf(
      data, OxyOSWrittenDragFile{base::FilePath("/tmp/astro-drag-1/gato.png"),
                                 "png bytes"});
  EXPECT_EQ(BytesOf(contents, "text/uri-list"),
            "file:///tmp/astro-drag-1/gato.png\r\n");
  EXPECT_EQ(BytesOf(contents, "image/png"), "png bytes");
}

TEST(OxyOSDataDragTest, OperationsAndActionsMapBothWays) {
  const int operations = DragDropTypes::DRAG_COPY | DragDropTypes::DRAG_MOVE;
  EXPECT_EQ(OxyOSDragActionsOf(operations), OXYOS_DRAG_COPY | OXYOS_DRAG_MOVE);
  EXPECT_EQ(OxyOSDragOperationsOf(OXYOS_DRAG_LINK), DragDropTypes::DRAG_LINK);
  EXPECT_EQ(OxyOSPreferredDragAction(operations), OXYOS_DRAG_COPY);
  EXPECT_EQ(OxyOSPreferredDragAction(DragDropTypes::DRAG_NONE), 0);
}

TEST(OxyOSDataDragTest, BeforeTheDropATargetKnowsOnlyTheKindsOffered) {
  std::unique_ptr<OSExchangeData> files =
      OxyOSDragPlaceholder({"text/uri-list", kOxyOSDragFilesType});
  EXPECT_TRUE(files->HasFile());
  std::unique_ptr<OSExchangeData> link =
      OxyOSDragPlaceholder({"text/uri-list", "text/plain;charset=utf-8"});
  EXPECT_FALSE(link->HasFile());
  EXPECT_TRUE(link->HasURL(FilenameToURLPolicy::DO_NOT_CONVERT_FILENAMES));
  EXPECT_TRUE(link->HasString());
}

TEST(OxyOSDataDragTest, ATargetAcceptsAndReceivesTheTypesItUses) {
  const std::vector<std::string> types = {kOxyOSDragFilesType, "text/uri-list",
                                          "image/png", "text/plain"};
  EXPECT_EQ(OxyOSDragTypeToAccept(types), "text/uri-list");
  EXPECT_EQ(OxyOSDropTypesToReceive(types),
            (std::vector<std::string>{"text/uri-list", "text/plain"}));
  EXPECT_EQ(OxyOSDragTypeToAccept({"image/png"}), std::nullopt);
}

TEST(OxyOSDataDragTest, ADropBecomesFilesLinksHtmlAndText) {
  std::unique_ptr<OSExchangeData> data = OxyOSDropData(
      {{"text/uri-list",
        "# comment\r\nfile:///home/ana/a%20b.txt\r\nhttps://oxy.so\r\n"},
       {"text/html", "<b>hola</b>"},
       {"text/plain;charset=utf-8", "hola"}});
  const std::optional<std::vector<FileInfo>> files = data->GetFilenames();
  ASSERT_TRUE(files);
  ASSERT_EQ(files->size(), 1u);
  EXPECT_EQ((*files)[0].path, base::FilePath("/home/ana/a b.txt"));
  const std::vector<ClipboardUrlInfo> urls =
      data->GetURLs(FilenameToURLPolicy::DO_NOT_CONVERT_FILENAMES);
  ASSERT_FALSE(urls.empty());
  EXPECT_EQ(urls[0].url, GURL("https://oxy.so"));
  ASSERT_TRUE(data->GetHtml());
  EXPECT_EQ(data->GetHtml()->html, u"<b>hola</b>");
  std::unique_ptr<OSExchangeData> text =
      OxyOSDropData({{"text/plain;charset=utf-8", "hola"}});
  EXPECT_EQ(text->GetString(), u"hola");
}

}
