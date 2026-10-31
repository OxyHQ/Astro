// Copyright 2026 Oxy. Apache-2.0.

#include "ui/ozone/platform/oxyos/oxyos_select_file_dialog.h"

#include <utility>

#include "base/files/file_util.h"
#include "base/functional/bind.h"
#include "base/memory/scoped_refptr.h"
#include "base/strings/utf_string_conversions.h"
#include "base/task/sequenced_task_runner.h"
#include "base/task/thread_pool.h"
#include "ui/aura/window.h"
#include "ui/aura/window_tree_host.h"
#include "ui/shell_dialogs/select_file_policy.h"
#include "ui/shell_dialogs/selected_file_info.h"

namespace ui {

namespace {

std::optional<OxyOSFileDialogKind> KindOf(SelectFileDialog::Type type) {
  switch (type) {
    case SelectFileDialog::SELECT_OPEN_FILE:
      return OxyOSFileDialogKind::kOpenFile;
    case SelectFileDialog::SELECT_OPEN_MULTI_FILE:
      return OxyOSFileDialogKind::kOpenFiles;
    case SelectFileDialog::SELECT_FOLDER:
    case SelectFileDialog::SELECT_UPLOAD_FOLDER:
    case SelectFileDialog::SELECT_EXISTING_FOLDER:
      return OxyOSFileDialogKind::kFolder;
    case SelectFileDialog::SELECT_SAVEAS_FILE:
      return OxyOSFileDialogKind::kSave;
    case SelectFileDialog::SELECT_NONE:
      return std::nullopt;
  }
  return std::nullopt;
}

gfx::AcceleratedWidget WidgetOf(gfx::NativeWindow window) {
  aura::WindowTreeHost* host = window ? window->GetHost() : nullptr;
  return host ? host->GetAcceleratedWidget() : gfx::kNullAcceleratedWidget;
}

int ChosenTypeIndex(const SelectFileDialog::FileTypeInfo* file_types,
                    int index) {
  const size_t count = file_types ? file_types->extensions.size() : 0;
  if (index >= 1 && static_cast<size_t>(index) <= count) {
    return index;
  }
  return count > 0 ? 1 : 0;
}

}

OxyOSSelectFileDialog::OxyOSSelectFileDialog(
    Listener* listener,
    std::unique_ptr<SelectFilePolicy> policy)
    : SelectFileDialog(listener, std::move(policy)) {}

OxyOSSelectFileDialog::~OxyOSSelectFileDialog() = default;

bool OxyOSSelectFileDialog::IsRunning(gfx::NativeWindow owning_window) const {
  return choosing_ && WidgetOf(owning_window) == window_;
}

void OxyOSSelectFileDialog::ListenerDestroyed() {
  scoped_refptr<OxyOSSelectFileDialog> keep_alive(this);
  listener_ = nullptr;
  choosing_ = false;
  const std::optional<uint32_t> serial = std::exchange(serial_, std::nullopt);
  OxyOSFileChooser* chooser = GetOxyOSFileChooser();
  if (serial && chooser) {
    chooser->Cancel(*serial);
  }
}

void OxyOSSelectFileDialog::SelectFileImpl(
    Type type,
    const std::u16string& title,
    const base::FilePath& default_path,
    const FileTypeInfo* file_types,
    int file_type_index,
    const base::FilePath::StringType& default_extension,
    gfx::NativeWindow owning_window,
    const GURL* caller) {
  const std::optional<OxyOSFileDialogKind> kind = KindOf(type);
  if (choosing_ || !kind) {
    base::SequencedTaskRunner::GetCurrentDefault()->PostTask(
        FROM_HERE,
        base::BindOnce(&OxyOSSelectFileDialog::NotifyCancelled, this));
    return;
  }
  choosing_ = true;
  kind_ = *kind;
  chosen_type_index_ = ChosenTypeIndex(file_types, file_type_index);
  window_ = WidgetOf(owning_window);
  OxyOSFileDialogRequest request;
  request.kind = *kind;
  request.title = base::UTF16ToUTF8(title);
  request.default_path = default_path;
  if (file_types) {
    request.extensions = file_types->extensions;
  }
  request.file_type_index = file_type_index;
  if (!default_path.IsAbsolute()) {
    base::SequencedTaskRunner::GetCurrentDefault()->PostTask(
        FROM_HERE, base::BindOnce(&OxyOSSelectFileDialog::Ask, this,
                                  std::move(request), false));
    return;
  }
  base::ThreadPool::PostTaskAndReplyWithResult(
      FROM_HERE, {base::MayBlock(), base::TaskPriority::USER_BLOCKING},
      base::BindOnce(&base::DirectoryExists, default_path),
      base::BindOnce(&OxyOSSelectFileDialog::Ask, this, std::move(request)));
}

bool OxyOSSelectFileDialog::HasMultipleFileTypeChoicesImpl() {
  return false;
}

void OxyOSSelectFileDialog::Ask(OxyOSFileDialogRequest request,
                                bool default_path_is_folder) {
  if (!listener_ || !choosing_) {
    choosing_ = false;
    return;
  }
  request.default_path_is_folder = default_path_is_folder;
  OxyOSFileChooser* chooser = GetOxyOSFileChooser();
  if (chooser) {
    serial_ =
        chooser->Choose(window_, request,
                        base::BindOnce(&OxyOSSelectFileDialog::OnChosen, this));
  }
  if (!serial_) {
    choosing_ = false;
    NotifyCancelled();
  }
}

void OxyOSSelectFileDialog::OnChosen(
    std::optional<std::vector<base::FilePath>> files) {
  choosing_ = false;
  serial_.reset();
  if (!listener_) {
    return;
  }
  if (!files) {
    listener_->FileSelectionCanceled();
  } else if (kind_ == OxyOSFileDialogKind::kOpenFiles) {
    listener_->MultiFilesSelected(FilePathListToSelectedFileInfoList(*files));
  } else {
    listener_->FileSelected(SelectedFileInfo(files->front()),
                            chosen_type_index_);
  }
}

void OxyOSSelectFileDialog::NotifyCancelled() {
  if (listener_) {
    listener_->FileSelectionCanceled();
  }
}

SelectFileDialog* OxyOSSelectFileDialogFactory::Create(
    SelectFileDialog::Listener* listener,
    std::unique_ptr<SelectFilePolicy> policy) {
  return new OxyOSSelectFileDialog(listener, std::move(policy));
}

void InstallOxyOSSelectFileDialogs() {
  if (GetOxyOSFileChooser()) {
    SelectFileDialog::SetFactory(
        std::make_unique<OxyOSSelectFileDialogFactory>());
  }
}

}
