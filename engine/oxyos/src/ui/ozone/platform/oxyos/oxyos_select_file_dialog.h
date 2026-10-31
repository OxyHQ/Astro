// Copyright 2026 Oxy. Apache-2.0.

#ifndef UI_OZONE_PLATFORM_OXYOS_OXYOS_SELECT_FILE_DIALOG_H_
#define UI_OZONE_PLATFORM_OXYOS_OXYOS_SELECT_FILE_DIALOG_H_

#include <cstdint>
#include <memory>
#include <optional>
#include <string>
#include <vector>

#include "base/files/file_path.h"
#include "ui/gfx/native_ui_types.h"
#include "ui/ozone/platform/oxyos/oxyos_file_chooser.h"
#include "ui/shell_dialogs/select_file_dialog.h"
#include "ui/shell_dialogs/select_file_dialog_factory.h"

namespace ui {

class OxyOSSelectFileDialog : public SelectFileDialog {
 public:
  OxyOSSelectFileDialog(Listener* listener,
                        std::unique_ptr<SelectFilePolicy> policy);
  OxyOSSelectFileDialog(const OxyOSSelectFileDialog&) = delete;
  OxyOSSelectFileDialog& operator=(const OxyOSSelectFileDialog&) = delete;

  bool IsRunning(gfx::NativeWindow owning_window) const override;
  void ListenerDestroyed() override;

 protected:
  ~OxyOSSelectFileDialog() override;

  void SelectFileImpl(Type type,
                      const std::u16string& title,
                      const base::FilePath& default_path,
                      const FileTypeInfo* file_types,
                      int file_type_index,
                      const base::FilePath::StringType& default_extension,
                      gfx::NativeWindow owning_window,
                      const GURL* caller) override;

 private:
  bool HasMultipleFileTypeChoicesImpl() override;
  void Ask(OxyOSFileDialogRequest request, bool default_path_is_folder);
  void OnChosen(std::optional<std::vector<base::FilePath>> files);
  void NotifyCancelled();

  OxyOSFileDialogKind kind_ = OxyOSFileDialogKind::kOpenFile;
  int chosen_type_index_ = 0;
  gfx::AcceleratedWidget window_ = gfx::kNullAcceleratedWidget;
  bool choosing_ = false;
  std::optional<uint32_t> serial_;
};

class OxyOSSelectFileDialogFactory : public SelectFileDialogFactory {
 public:
  SelectFileDialog* Create(SelectFileDialog::Listener* listener,
                           std::unique_ptr<SelectFilePolicy> policy) override;
};

void InstallOxyOSSelectFileDialogs();

}

#endif
