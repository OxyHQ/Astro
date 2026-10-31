// Copyright 2026 Oxy. Apache-2.0.

#ifndef UI_OZONE_PLATFORM_OXYOS_OXYOS_CLIPBOARD_H_
#define UI_OZONE_PLATFORM_OXYOS_OXYOS_CLIPBOARD_H_

#include <cstdint>
#include <memory>
#include <optional>
#include <string>
#include <utility>
#include <vector>

#include "base/files/scoped_file.h"
#include "base/functional/callback.h"
#include "base/memory/raw_ptr.h"
#include "base/memory/weak_ptr.h"
#include "base/time/time.h"
#include "ui/ozone/public/platform_clipboard.h"

namespace ui {

inline constexpr size_t kOxyOSClipboardMaxTypes = 16;
inline constexpr size_t kOxyOSClipboardMaxTypeBytes = 32;

std::vector<std::string> OxyOSClipboardOfferedTypes(
    const PlatformClipboard::DataMap& data_map);

std::optional<std::string> OxyOSClipboardTypeToPaste(
    const std::string& asked,
    const std::vector<std::string>& held);

std::vector<std::string> OxyOSClipboardAvailableTypes(
    const std::vector<std::string>& held);

std::optional<std::vector<uint8_t>> OxyOSReadPipe(base::ScopedFD fd,
                                                  base::TimeDelta deadline);

class OxyOSClipboard : public PlatformClipboard {
 public:
  class Transport {
   public:
    virtual ~Transport() = default;
    virtual void Copy(
        const std::vector<std::pair<std::string, Data>>& contents) = 0;
    virtual void ClearClipboard() = 0;
    virtual base::ScopedFD Paste(uint32_t selection,
                                 const std::string& mime_type) = 0;
  };

  explicit OxyOSClipboard(Transport* transport);
  OxyOSClipboard(const OxyOSClipboard&) = delete;
  OxyOSClipboard& operator=(const OxyOSClipboard&) = delete;
  ~OxyOSClipboard() override;

  void OnTypes(uint32_t selection, uint32_t count);
  void OnType(uint32_t selection, const std::string& mime_type);
  void OnEmpty();

  void set_paste_deadline_for_testing(base::TimeDelta deadline) {
    paste_deadline_ = deadline;
  }

  void OfferClipboardData(ClipboardBuffer buffer,
                          const DataMap& data_map) override;
  void RequestClipboardData(ClipboardBuffer buffer,
                            const std::string& mime_type,
                            RequestDataClosure callback) override;
  void GetAvailableMimeTypes(ClipboardBuffer buffer,
                             GetMimeTypesClosure callback) override;
  void IsSelectionOwner(ClipboardBuffer buffer,
                        IsSelectionOwnerClosure callback) override;
  void SetClipboardDataChangedCallback(
      ClipboardDataChangedCallback callback) override;
  bool IsSelectionBufferAvailable() const override;

 private:
  void OnPasteRead(RequestDataClosure callback,
                   std::optional<std::vector<uint8_t>> data);
  void Changed();

  const raw_ptr<Transport> transport_;
  ClipboardDataChangedCallback changed_;
  std::optional<uint32_t> selection_;
  uint32_t announced_ = 0;
  std::vector<std::string> types_;
  std::vector<std::string> arriving_;
  uint32_t arriving_selection_ = 0;
  base::TimeDelta paste_deadline_ = base::Seconds(5);

  base::WeakPtrFactory<OxyOSClipboard> weak_factory_{this};
};

}

#endif
