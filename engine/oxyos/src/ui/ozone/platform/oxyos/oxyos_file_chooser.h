// Copyright 2026 Oxy. Apache-2.0.

#ifndef UI_OZONE_PLATFORM_OXYOS_OXYOS_FILE_CHOOSER_H_
#define UI_OZONE_PLATFORM_OXYOS_OXYOS_FILE_CHOOSER_H_

#include <cstdint>
#include <optional>
#include <string>
#include <string_view>
#include <vector>

#include "base/containers/flat_map.h"
#include "base/files/file_path.h"
#include "base/functional/callback.h"
#include "base/memory/raw_ptr.h"
#include "ui/gfx/native_ui_types.h"

namespace ui {

inline constexpr uint16_t kOxyOSFileChooserProtocol = 7;
inline constexpr size_t kOxyOSFileChooserMaxAnswerBytes = 256 * 1024;

enum class OxyOSFileDialogKind : uint8_t {
  kOpenFile,
  kOpenFiles,
  kFolder,
  kSave,
};

struct OxyOSFileDialogRequest {
  OxyOSFileDialogRequest();
  OxyOSFileDialogRequest(const OxyOSFileDialogRequest& other);
  OxyOSFileDialogRequest& operator=(const OxyOSFileDialogRequest& other);
  ~OxyOSFileDialogRequest();

  OxyOSFileDialogKind kind = OxyOSFileDialogKind::kOpenFile;
  std::string title;
  base::FilePath default_path;
  bool default_path_is_folder = false;
  std::vector<std::vector<std::string>> extensions;
  int file_type_index = 0;
};

std::string OxyOSFileChooserRequest(const OxyOSFileDialogRequest& request);

std::optional<std::vector<base::FilePath>> OxyOSChosenFiles(
    std::string_view answer,
    OxyOSFileDialogKind kind);

class OxyOSFileChooser {
 public:
  using Chosen = base::OnceCallback<void(
      std::optional<std::vector<base::FilePath>> files)>;

  class Transport {
   public:
    virtual ~Transport() = default;
    virtual uint16_t FileChooserProtocolVersion() = 0;
    virtual std::optional<uint32_t> ChooseFiles(uint32_t serial,
                                                gfx::AcceleratedWidget window,
                                                const std::string& request) = 0;
    virtual void CancelChooseFiles(uint32_t serial) = 0;
  };

  explicit OxyOSFileChooser(Transport* transport);
  OxyOSFileChooser(const OxyOSFileChooser&) = delete;
  OxyOSFileChooser& operator=(const OxyOSFileChooser&) = delete;
  ~OxyOSFileChooser();

  std::optional<uint32_t> Choose(gfx::AcceleratedWidget window,
                                 const OxyOSFileDialogRequest& request,
                                 Chosen chosen);
  void Cancel(uint32_t serial);
  void OnChunk(uint32_t serial,
               uint16_t index,
               bool last,
               std::string_view text);
  void ForgetSurface(uint32_t surface);
  bool IsChoosing() const { return !pending_.empty(); }

 private:
  struct Pending {
    Pending();
    Pending(Pending&& other);
    Pending& operator=(Pending&& other);
    ~Pending();

    uint32_t surface = 0;
    OxyOSFileDialogKind kind = OxyOSFileDialogKind::kOpenFile;
    std::string answer;
    uint32_t next_index = 0;
    bool broken = false;
    Chosen chosen;
  };

  const raw_ptr<Transport> transport_;
  uint32_t last_serial_ = 0;
  base::flat_map<uint32_t, Pending> pending_;
};

OxyOSFileChooser* GetOxyOSFileChooser();
void SetOxyOSFileChooser(OxyOSFileChooser* chooser);

}

#endif
