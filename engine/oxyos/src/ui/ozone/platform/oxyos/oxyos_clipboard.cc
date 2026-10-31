// Copyright 2026 Oxy. Apache-2.0.

#include "ui/ozone/platform/oxyos/oxyos_clipboard.h"

#include <poll.h>
#include <unistd.h>

#include <algorithm>
#include <array>
#include <cerrno>
#include <string_view>
#include <utility>

#include "base/functional/bind.h"
#include "base/posix/eintr_wrapper.h"
#include "base/task/thread_pool.h"
#include "ui/base/clipboard/clipboard_constants.h"

namespace ui {

namespace {

constexpr std::array<std::string_view, 4> kRetiredTextTypes = {
    kMimeTypeLinuxUtf8String, kMimeTypeLinuxString, kMimeTypeLinuxText,
    "COMPOUND_TEXT"};

constexpr std::array<std::string_view, 10> kFaithfulFirst = {
    kMimeTypePng,
    kMimeTypeSvg,
    kMimeTypeHtml,
    kMimeTypeRtf,
    kMimeTypeUriList,
    kMimeTypeDataTransferCustomData,
    kMimeTypeWebkitSmartPaste,
    kMimeTypeSourceUrl,
    kMimeTypeUtf8PlainText,
    kMimeTypePlainText,
};

bool IsText(std::string_view type) {
  return type == kMimeTypePlainText || type == kMimeTypeUtf8PlainText ||
         std::ranges::contains(kRetiredTextTypes, type);
}

size_t Rank(std::string_view type) {
  const auto it = std::ranges::find(kFaithfulFirst, type);
  if (it == kFaithfulFirst.end()) {
    return 2 * (kFaithfulFirst.size() - 2) - 1;
  }
  return 2 * static_cast<size_t>(it - kFaithfulFirst.begin());
}

}

std::vector<std::string> OxyOSClipboardOfferedTypes(
    const PlatformClipboard::DataMap& data_map) {
  std::vector<std::string> types;
  for (const auto& [type, data] : data_map) {
    if (!type.empty() && type.size() <= kOxyOSClipboardMaxTypeBytes &&
        !std::ranges::contains(kRetiredTextTypes, type)) {
      types.push_back(type);
    }
  }
  std::ranges::sort(types, [](const std::string& a, const std::string& b) {
    return std::pair(Rank(a), a) < std::pair(Rank(b), b);
  });
  if (types.size() > kOxyOSClipboardMaxTypes) {
    types.resize(kOxyOSClipboardMaxTypes);
  }
  return types;
}

std::optional<std::string> OxyOSClipboardTypeToPaste(
    const std::string& asked,
    const std::vector<std::string>& held) {
  if (std::ranges::contains(held, asked)) {
    return asked;
  }
  if (!IsText(asked)) {
    return std::nullopt;
  }
  for (std::string_view text : {std::string_view(kMimeTypeUtf8PlainText),
                                std::string_view(kMimeTypePlainText)}) {
    if (std::ranges::contains(held, text)) {
      return std::string(text);
    }
  }
  return std::nullopt;
}

std::vector<std::string> OxyOSClipboardAvailableTypes(
    const std::vector<std::string>& held) {
  std::vector<std::string> types = held;
  if (std::ranges::contains(held, kMimeTypeUtf8PlainText) &&
      !std::ranges::contains(held, kMimeTypePlainText)) {
    types.emplace_back(kMimeTypePlainText);
  }
  return types;
}

std::optional<std::vector<uint8_t>> OxyOSReadPipe(base::ScopedFD fd,
                                                  base::TimeDelta deadline) {
  const base::TimeTicks end = base::TimeTicks::Now() + deadline;
  std::vector<uint8_t> data;
  std::array<uint8_t, 65536> chunk;
  for (;;) {
    const base::TimeDelta left = end - base::TimeTicks::Now();
    if (!left.is_positive()) {
      return std::nullopt;
    }
    pollfd watched = {.fd = fd.get(), .events = POLLIN, .revents = 0};
    const int ready = HANDLE_EINTR(
        poll(&watched, 1, static_cast<int>(left.InMillisecondsRoundedUp())));
    if (ready < 0) {
      return std::nullopt;
    }
    if (ready == 0) {
      continue;
    }
    const ssize_t got =
        HANDLE_EINTR(read(fd.get(), chunk.data(), chunk.size()));
    if (got < 0) {
      return std::nullopt;
    }
    if (got == 0) {
      return data;
    }
    data.insert(data.end(), chunk.begin(), chunk.begin() + got);
  }
}

OxyOSClipboard::OxyOSClipboard(Transport* transport) : transport_(transport) {}

OxyOSClipboard::~OxyOSClipboard() = default;

void OxyOSClipboard::OnTypes(uint32_t selection, uint32_t count) {
  arriving_selection_ = selection;
  announced_ = count;
  arriving_.clear();
  if (count == 0) {
    selection_ = selection;
    types_.clear();
    Changed();
  }
}

void OxyOSClipboard::OnType(uint32_t selection, const std::string& mime_type) {
  if (selection != arriving_selection_ || arriving_.size() >= announced_) {
    return;
  }
  arriving_.push_back(mime_type);
  if (arriving_.size() == announced_) {
    selection_ = selection;
    types_ = std::move(arriving_);
    arriving_.clear();
    Changed();
  }
}

void OxyOSClipboard::OnEmpty() {
  selection_.reset();
  types_.clear();
  arriving_.clear();
  announced_ = 0;
  Changed();
}

void OxyOSClipboard::Changed() {
  if (changed_) {
    changed_.Run(ClipboardBuffer::kCopyPaste);
  }
}

void OxyOSClipboard::OfferClipboardData(ClipboardBuffer buffer,
                                        const DataMap& data_map) {
  if (buffer != ClipboardBuffer::kCopyPaste) {
    return;
  }
  std::vector<std::pair<std::string, Data>> contents;
  for (const std::string& type : OxyOSClipboardOfferedTypes(data_map)) {
    contents.emplace_back(type, data_map.at(type));
  }
  if (contents.empty()) {
    transport_->ClearClipboard();
    return;
  }
  transport_->Copy(contents);
}

void OxyOSClipboard::RequestClipboardData(ClipboardBuffer buffer,
                                          const std::string& mime_type,
                                          RequestDataClosure callback) {
  const std::optional<std::string> type =
      buffer == ClipboardBuffer::kCopyPaste && selection_
          ? OxyOSClipboardTypeToPaste(mime_type, types_)
          : std::nullopt;
  base::ScopedFD fd;
  if (type) {
    fd = transport_->Paste(*selection_, *type);
  }
  if (!fd.is_valid()) {
    std::move(callback).Run(nullptr);
    return;
  }
  base::ThreadPool::PostTaskAndReplyWithResult(
      FROM_HERE, {base::MayBlock(), base::TaskPriority::USER_BLOCKING},
      base::BindOnce(&OxyOSReadPipe, std::move(fd), paste_deadline_),
      base::BindOnce(&OxyOSClipboard::OnPasteRead, weak_factory_.GetWeakPtr(),
                     std::move(callback)));
}

void OxyOSClipboard::OnPasteRead(RequestDataClosure callback,
                                 std::optional<std::vector<uint8_t>> data) {
  if (!data) {
    std::move(callback).Run(nullptr);
    return;
  }
  std::move(callback).Run(
      base::MakeRefCounted<base::RefCountedBytes>(std::move(*data)));
}

void OxyOSClipboard::GetAvailableMimeTypes(ClipboardBuffer buffer,
                                           GetMimeTypesClosure callback) {
  if (buffer != ClipboardBuffer::kCopyPaste || !selection_) {
    std::move(callback).Run({});
    return;
  }
  std::move(callback).Run(OxyOSClipboardAvailableTypes(types_));
}

void OxyOSClipboard::IsSelectionOwner(ClipboardBuffer buffer,
                                      IsSelectionOwnerClosure callback) {
  std::move(callback).Run(false);
}

void OxyOSClipboard::SetClipboardDataChangedCallback(
    ClipboardDataChangedCallback callback) {
  changed_ = std::move(callback);
}

bool OxyOSClipboard::IsSelectionBufferAvailable() const {
  return false;
}

}
