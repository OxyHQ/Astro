// Copyright 2026 Oxy. Apache-2.0.

#include "ui/ozone/platform/oxyos/oxyos_file_chooser.h"

#include <algorithm>
#include <utility>

#include "base/functional/bind.h"
#include "base/json/json_reader.h"
#include "base/json/json_writer.h"
#include "base/logging.h"
#include "base/strings/string_util.h"
#include "base/task/sequenced_task_runner.h"
#include "base/values.h"
#include "net/base/filename_util.h"
#include "url/gurl.h"

namespace ui {

namespace {

OxyOSFileChooser* g_file_chooser = nullptr;

bool IsTypeExtension(std::string_view extension) {
  if (extension.empty() || extension.front() == '.' ||
      extension.back() == '.') {
    return false;
  }
  return std::ranges::all_of(extension, [](char c) {
    return base::IsAsciiAlphaNumeric(c) || c == '.' || c == '-' || c == '_' ||
           c == '+';
  });
}

void AddExtensions(const std::vector<std::string>& group,
                   std::vector<std::string>& types) {
  for (std::string_view extension : group) {
    if (extension.starts_with('.')) {
      extension.remove_prefix(1);
    }
    if (!IsTypeExtension(extension)) {
      continue;
    }
    std::string type = "." + base::ToLowerASCII(extension);
    if (!std::ranges::contains(types, type)) {
      types.push_back(std::move(type));
    }
  }
}

std::vector<std::string> TypesOf(const OxyOSFileDialogRequest& request) {
  std::vector<std::string> types;
  if (request.kind == OxyOSFileDialogKind::kFolder) {
    return types;
  }
  const auto& groups = request.extensions;
  const int index = request.file_type_index;
  if (request.kind == OxyOSFileDialogKind::kSave && index >= 1 &&
      static_cast<size_t>(index) <= groups.size()) {
    AddExtensions(groups[index - 1], types);
    return types;
  }
  for (const auto& group : groups) {
    AddExtensions(group, types);
  }
  return types;
}

std::optional<std::string> FolderUrl(const base::FilePath& folder) {
  if (folder.empty() || !folder.IsAbsolute()) {
    return std::nullopt;
  }
  const GURL url = net::FilePathToFileURL(folder);
  if (!url.is_valid()) {
    return std::nullopt;
  }
  return url.spec();
}

}

OxyOSFileDialogRequest::OxyOSFileDialogRequest() = default;
OxyOSFileDialogRequest::OxyOSFileDialogRequest(
    const OxyOSFileDialogRequest& other) = default;
OxyOSFileDialogRequest& OxyOSFileDialogRequest::operator=(
    const OxyOSFileDialogRequest& other) = default;
OxyOSFileDialogRequest::~OxyOSFileDialogRequest() = default;

std::string OxyOSFileChooserRequest(const OxyOSFileDialogRequest& request) {
  const bool save = request.kind == OxyOSFileDialogKind::kSave;
  const base::FilePath& path = request.default_path;
  base::DictValue fields;
  if (!save) {
    fields.Set("multiple", request.kind == OxyOSFileDialogKind::kOpenFiles);
    fields.Set("directory", request.kind == OxyOSFileDialogKind::kFolder);
  }
  std::vector<std::string> types = TypesOf(request);
  if (!types.empty()) {
    base::ListValue list;
    for (std::string& type : types) {
      list.Append(std::move(type));
    }
    fields.Set("types", std::move(list));
  }
  if (!request.title.empty() && base::IsStringUTF8(request.title)) {
    fields.Set("title", request.title);
  }
  std::optional<std::string> folder;
  if (request.default_path_is_folder) {
    folder = FolderUrl(path);
  } else if (path.IsAbsolute()) {
    folder = FolderUrl(path.DirName());
  }
  if (folder) {
    fields.Set("folder", std::move(*folder));
  }
  if (save && !request.default_path_is_folder && !path.empty()) {
    const std::string name = path.BaseName().value();
    if (!name.empty() && name != "." && name != "/" &&
        base::IsStringUTF8(name)) {
      fields.Set("name", name);
    }
  }
  base::DictValue root;
  root.Set(save ? "save" : "open", std::move(fields));
  return base::WriteJson(root).value_or(std::string());
}

std::optional<std::vector<base::FilePath>> OxyOSChosenFiles(
    std::string_view answer,
    OxyOSFileDialogKind kind) {
  std::optional<base::DictValue> dict =
      base::JSONReader::ReadDict(answer, base::JSON_PARSE_RFC);
  if (!dict || dict->size() != 1) {
    LOG(ERROR) << "OxyOS answered a file chooser with " << answer;
    return std::nullopt;
  }
  if (const base::ListValue* chosen = dict->FindList("chosen")) {
    std::vector<base::FilePath> files;
    for (const base::Value& uri : *chosen) {
      const std::string* spec = uri.GetIfString();
      base::FilePath path;
      if (!spec || !GURL(*spec).SchemeIsFile() ||
          !net::FileURLToFilePath(GURL(*spec), &path) || !path.IsAbsolute()) {
        LOG(ERROR) << "OxyOS chose a file that is no local path: " << answer;
        return std::nullopt;
      }
      files.push_back(std::move(path));
    }
    const bool fits = kind == OxyOSFileDialogKind::kOpenFiles
                          ? !files.empty()
                          : files.size() == 1;
    if (!fits) {
      LOG(ERROR) << "OxyOS chose " << files.size()
                 << " files for a dialog that takes "
                 << (kind == OxyOSFileDialogKind::kOpenFiles ? "one or more"
                                                             : "one");
      return std::nullopt;
    }
    return files;
  }
  if (const base::DictValue* refused = dict->FindDict("refused")) {
    const std::string* reason = refused->FindString("reason");
    LOG(WARNING) << "OxyOS refused a file chooser: "
                 << (reason ? *reason : std::string("no reason"));
    return std::nullopt;
  }
  if (!dict->FindDict("cancelled")) {
    LOG(ERROR) << "OxyOS answered a file chooser with " << answer;
  }
  return std::nullopt;
}

OxyOSFileChooser::Pending::Pending() = default;
OxyOSFileChooser::Pending::Pending(Pending&& other) = default;
OxyOSFileChooser::Pending& OxyOSFileChooser::Pending::operator=(
    Pending&& other) = default;
OxyOSFileChooser::Pending::~Pending() = default;

OxyOSFileChooser::OxyOSFileChooser(Transport* transport)
    : transport_(transport) {}

OxyOSFileChooser::~OxyOSFileChooser() {
  if (g_file_chooser == this) {
    g_file_chooser = nullptr;
  }
}

std::optional<uint32_t> OxyOSFileChooser::Choose(
    gfx::AcceleratedWidget window,
    const OxyOSFileDialogRequest& request,
    Chosen chosen) {
  const uint16_t version = transport_->FileChooserProtocolVersion();
  if (version < kOxyOSFileChooserProtocol) {
    LOG(WARNING) << "The OxyOS compositor speaks protocol " << version
                 << ", which has no file chooser";
    return std::nullopt;
  }
  if (++last_serial_ == 0) {
    ++last_serial_;
  }
  const uint32_t serial = last_serial_;
  const std::optional<uint32_t> surface =
      transport_->ChooseFiles(serial, window, OxyOSFileChooserRequest(request));
  if (!surface) {
    return std::nullopt;
  }
  Pending pending;
  pending.surface = *surface;
  pending.kind = request.kind;
  pending.chosen = std::move(chosen);
  pending_.insert_or_assign(serial, std::move(pending));
  return serial;
}

void OxyOSFileChooser::Cancel(uint32_t serial) {
  if (pending_.erase(serial)) {
    transport_->CancelChooseFiles(serial);
  }
}

void OxyOSFileChooser::OnChunk(uint32_t serial,
                               uint16_t index,
                               bool last,
                               std::string_view text) {
  auto it = pending_.find(serial);
  if (it == pending_.end()) {
    return;
  }
  Pending& pending = it->second;
  if (index == 0) {
    pending.answer.clear();
    pending.next_index = 0;
    pending.broken = false;
  }
  if (!pending.broken) {
    if (index != pending.next_index ||
        pending.answer.size() + text.size() > kOxyOSFileChooserMaxAnswerBytes) {
      pending.broken = true;
    } else {
      pending.answer.append(text);
      ++pending.next_index;
    }
  }
  if (!last) {
    return;
  }
  Chosen chosen = std::move(pending.chosen);
  const OxyOSFileDialogKind kind = pending.kind;
  const bool broken = pending.broken;
  const std::string answer = std::move(pending.answer);
  pending_.erase(it);
  if (broken) {
    LOG(ERROR) << "OxyOS answered file chooser " << serial
               << " out of order or too long";
    std::move(chosen).Run(std::nullopt);
    return;
  }
  std::move(chosen).Run(OxyOSChosenFiles(answer, kind));
}

void OxyOSFileChooser::ForgetSurface(uint32_t surface) {
  std::vector<std::pair<uint32_t, Chosen>> forgotten;
  for (auto it = pending_.begin(); it != pending_.end();) {
    if (it->second.surface == surface) {
      forgotten.emplace_back(it->first, std::move(it->second.chosen));
      it = pending_.erase(it);
    } else {
      ++it;
    }
  }
  for (auto& [serial, chosen] : forgotten) {
    transport_->CancelChooseFiles(serial);
    base::SequencedTaskRunner::GetCurrentDefault()->PostTask(
        FROM_HERE,
        base::BindOnce(std::move(chosen),
                       std::optional<std::vector<base::FilePath>>()));
  }
}

OxyOSFileChooser* GetOxyOSFileChooser() {
  return g_file_chooser;
}

void SetOxyOSFileChooser(OxyOSFileChooser* chooser) {
  g_file_chooser = chooser;
}

}
