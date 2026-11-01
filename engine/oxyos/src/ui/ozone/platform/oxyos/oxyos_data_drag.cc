// Copyright 2026 Oxy. Apache-2.0.

#include "ui/ozone/platform/oxyos/oxyos_data_drag.h"

#include <algorithm>
#include <string_view>

#include "base/files/file_util.h"
#include "base/strings/string_split.h"
#include "base/strings/string_util.h"
#include "base/strings/utf_string_conversions.h"
#include "net/base/filename_util.h"
#include "net/base/mime_util.h"
#include "oxyos_client.h"
#include "ui/base/clipboard/clipboard_constants.h"
#include "ui/base/clipboard/clipboard_url_info.h"
#include "ui/base/clipboard/file_info.h"
#include "ui/base/dragdrop/drag_drop_types.h"
#include "ui/base/dragdrop/os_exchange_data.h"
#include "url/gurl.h"
#include "url/url_constants.h"

namespace ui {

namespace {

std::vector<std::string> UriLines(std::string_view text) {
  std::vector<std::string> uris;
  for (std::string_view line : base::SplitStringPiece(
           text, "\r\n", base::TRIM_WHITESPACE, base::SPLIT_WANT_NONEMPTY)) {
    if (!line.starts_with('#')) {
      uris.emplace_back(line);
    }
  }
  return uris;
}

bool Offers(const std::vector<std::string>& types, std::string_view type) {
  return std::ranges::any_of(types, [type](const std::string& offered) {
    return base::EqualsCaseInsensitiveASCII(offered, type);
  });
}

void Add(OxyOSDragContents& contents, std::string type, std::string bytes) {
  if (type.empty() || type.size() > kOxyOSDragMaxTypeBytes ||
      contents.size() >= kOxyOSDragMaxTypes) {
    return;
  }
  if (std::ranges::any_of(contents, [&type](const auto& content) {
        return content.first == type;
      })) {
    return;
  }
  contents.emplace_back(std::move(type), std::move(bytes));
}

}

std::optional<OxyOSDragFileContents> OxyOSDragFileContentsOf(
    const OSExchangeData& data) {
  if (data.GetFilenames()) {
    return std::nullopt;
  }
  std::optional<OSExchangeData::FileContentsInfo> contents =
      data.GetFileContents();
  if (!contents || contents->filename.empty() ||
      contents->file_contents.empty()) {
    return std::nullopt;
  }
  return OxyOSDragFileContents{
      contents->filename.BaseName(),
      std::string(contents->file_contents.begin(),
                  contents->file_contents.end())};
}

std::optional<OxyOSWrittenDragFile> OxyOSWriteDragFile(
    OxyOSDragFileContents file) {
  base::FilePath directory;
  if (!base::CreateNewTempDirectory("astro-drag-", &directory)) {
    return std::nullopt;
  }
  const base::FilePath path = directory.Append(file.name.BaseName());
  if (!base::WriteFile(path, file.bytes)) {
    return std::nullopt;
  }
  return OxyOSWrittenDragFile{path, std::move(file.bytes)};
}

OxyOSDragContents OxyOSDragContentsOf(
    const OSExchangeData& data,
    const std::optional<OxyOSWrittenDragFile>& written) {
  OxyOSDragContents contents;
  std::vector<base::FilePath> files;
  if (std::optional<std::vector<FileInfo>> infos = data.GetFilenames()) {
    for (const FileInfo& info : *infos) {
      files.push_back(info.path);
    }
  }
  if (written) {
    files.push_back(written->path);
  }
  const std::vector<ClipboardUrlInfo> urls =
      data.GetURLs(FilenameToURLPolicy::DO_NOT_CONVERT_FILENAMES);
  std::string uri_list;
  for (const base::FilePath& file : files) {
    uri_list += net::FilePathToFileURL(file).spec() + "\r\n";
  }
  if (!files.empty()) {
    Add(contents, kMimeTypeUriList, uri_list);
    Add(contents, kOxyOSDragFilesType, uri_list);
    std::string type;
    if (written && net::GetWellKnownMimeTypeFromFile(written->path, &type) &&
        type.starts_with("image/")) {
      Add(contents, type, written->bytes);
    }
  } else if (!urls.empty()) {
    std::string list;
    for (const ClipboardUrlInfo& url : urls) {
      list += url.url.spec() + "\r\n";
    }
    Add(contents, kMimeTypeUriList, list);
    const ClipboardUrlInfo& first = urls.front();
    Add(contents, kMimeTypeMozillaUrl,
        first.url.spec() + "\n" + base::UTF16ToUTF8(first.title));
  }
  if (std::optional<OSExchangeData::HtmlInfo> html = data.GetHtml()) {
    Add(contents, kMimeTypeHtml, base::UTF16ToUTF8(html->html));
  }
  std::optional<std::u16string> text = data.GetString();
  if (text && !text->empty()) {
    Add(contents, kMimeTypeUtf8PlainText, base::UTF16ToUTF8(*text));
  } else if (!urls.empty()) {
    Add(contents, kMimeTypeUtf8PlainText, urls.front().url.spec());
  }
  return contents;
}

uint8_t OxyOSDragActionsOf(int operations) {
  uint8_t actions = 0;
  if (operations & DragDropTypes::DRAG_COPY) {
    actions |= OXYOS_DRAG_COPY;
  }
  if (operations & DragDropTypes::DRAG_MOVE) {
    actions |= OXYOS_DRAG_MOVE;
  }
  if (operations & DragDropTypes::DRAG_LINK) {
    actions |= OXYOS_DRAG_LINK;
  }
  return actions;
}

int OxyOSDragOperationsOf(uint8_t actions) {
  int operations = DragDropTypes::DRAG_NONE;
  if (actions & OXYOS_DRAG_COPY) {
    operations |= DragDropTypes::DRAG_COPY;
  }
  if (actions & OXYOS_DRAG_MOVE) {
    operations |= DragDropTypes::DRAG_MOVE;
  }
  if (actions & OXYOS_DRAG_LINK) {
    operations |= DragDropTypes::DRAG_LINK;
  }
  return operations;
}

uint8_t OxyOSPreferredDragAction(int operations) {
  if (operations & DragDropTypes::DRAG_COPY) {
    return OXYOS_DRAG_COPY;
  }
  if (operations & DragDropTypes::DRAG_LINK) {
    return OXYOS_DRAG_LINK;
  }
  if (operations & DragDropTypes::DRAG_MOVE) {
    return OXYOS_DRAG_MOVE;
  }
  return 0;
}

std::unique_ptr<OSExchangeData> OxyOSDragPlaceholder(
    const std::vector<std::string>& types) {
  auto data = std::make_unique<OSExchangeData>();
  if (Offers(types, kOxyOSDragFilesType)) {
    data->SetFilenames({FileInfo(base::FilePath(FILE_PATH_LITERAL("/")),
                                 base::FilePath())});
  } else if (Offers(types, kMimeTypeUriList) ||
             Offers(types, kMimeTypeMozillaUrl)) {
    data->SetURL(GURL(url::kAboutBlankURL), std::u16string());
  }
  if (Offers(types, kMimeTypeHtml)) {
    data->SetHtml(std::u16string(), GURL());
  }
  if (Offers(types, kMimeTypeUtf8PlainText) ||
      Offers(types, kMimeTypePlainText)) {
    data->SetString(std::u16string());
  }
  return data;
}

std::optional<std::string> OxyOSDragTypeToAccept(
    const std::vector<std::string>& types) {
  for (std::string_view type :
       {std::string_view(kMimeTypeUriList), std::string_view(kMimeTypeHtml),
        std::string_view(kMimeTypeUtf8PlainText),
        std::string_view(kMimeTypePlainText),
        std::string_view(kMimeTypeMozillaUrl)}) {
    for (const std::string& offered : types) {
      if (base::EqualsCaseInsensitiveASCII(offered, type)) {
        return offered;
      }
    }
  }
  return std::nullopt;
}

std::vector<std::string> OxyOSDropTypesToReceive(
    const std::vector<std::string>& types) {
  std::vector<std::string> wanted;
  for (std::string_view type :
       {std::string_view(kMimeTypeUriList), std::string_view(kMimeTypeMozillaUrl),
        std::string_view(kMimeTypeHtml),
        std::string_view(kMimeTypeUtf8PlainText)}) {
    for (const std::string& offered : types) {
      if (base::EqualsCaseInsensitiveASCII(offered, type)) {
        wanted.push_back(offered);
        break;
      }
    }
  }
  if (!Offers(types, kMimeTypeUtf8PlainText)) {
    for (const std::string& offered : types) {
      if (base::EqualsCaseInsensitiveASCII(offered, kMimeTypePlainText)) {
        wanted.push_back(offered);
        break;
      }
    }
  }
  return wanted;
}

std::unique_ptr<OSExchangeData> OxyOSDropData(
    const std::map<std::string, std::string>& received) {
  auto data = std::make_unique<OSExchangeData>();
  auto find = [&received](std::string_view type) -> const std::string* {
    for (const auto& [offered, bytes] : received) {
      if (base::EqualsCaseInsensitiveASCII(offered, type)) {
        return &bytes;
      }
    }
    return nullptr;
  };
  std::vector<FileInfo> files;
  std::vector<GURL> urls;
  if (const std::string* list = find(kMimeTypeUriList)) {
    for (const std::string& uri : UriLines(*list)) {
      const GURL url(uri);
      base::FilePath path;
      if (url.SchemeIsFile() && net::FileURLToFilePath(url, &path)) {
        files.emplace_back(path, path.BaseName());
      } else if (url.is_valid()) {
        urls.push_back(url);
      }
    }
  }
  std::u16string title;
  if (const std::string* moz = find(kMimeTypeMozillaUrl)) {
    std::vector<std::string> lines = base::SplitString(
        *moz, "\n", base::TRIM_WHITESPACE, base::SPLIT_WANT_ALL);
    if (urls.empty() && !lines.empty() && GURL(lines[0]).is_valid() &&
        !GURL(lines[0]).SchemeIsFile()) {
      urls.emplace_back(lines[0]);
    }
    if (lines.size() > 1) {
      title = base::UTF8ToUTF16(lines[1]);
    }
  }
  if (!files.empty()) {
    data->SetFilenames(files);
  }
  if (!urls.empty()) {
    data->SetURL(urls.front(), title);
  }
  if (const std::string* html = find(kMimeTypeHtml)) {
    data->SetHtml(base::UTF8ToUTF16(*html), GURL());
  }
  const std::string* text = find(kMimeTypeUtf8PlainText);
  if (!text) {
    text = find(kMimeTypePlainText);
  }
  if (text) {
    data->SetString(base::UTF8ToUTF16(*text));
  }
  return data;
}

}
