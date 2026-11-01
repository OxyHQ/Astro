// Copyright 2026 Oxy. Apache-2.0.

#ifndef UI_OZONE_PLATFORM_OXYOS_OXYOS_DATA_DRAG_H_
#define UI_OZONE_PLATFORM_OXYOS_OXYOS_DATA_DRAG_H_

#include <cstdint>
#include <map>
#include <memory>
#include <optional>
#include <string>
#include <utility>
#include <vector>

#include "base/files/file_path.h"

namespace ui {

class OSExchangeData;

inline constexpr char kOxyOSDragFilesType[] = "application/x-oxyos-files";
inline constexpr size_t kOxyOSDragMaxTypes = 16;
inline constexpr size_t kOxyOSDragMaxTypeBytes = 32;

using OxyOSDragContents = std::vector<std::pair<std::string, std::string>>;

struct OxyOSDragFileContents {
  base::FilePath name;
  std::string bytes;
};

std::optional<OxyOSDragFileContents> OxyOSDragFileContentsOf(
    const OSExchangeData& data);

struct OxyOSWrittenDragFile {
  base::FilePath path;
  std::string bytes;
};

std::optional<OxyOSWrittenDragFile> OxyOSWriteDragFile(
    OxyOSDragFileContents file);

OxyOSDragContents OxyOSDragContentsOf(
    const OSExchangeData& data,
    const std::optional<OxyOSWrittenDragFile>& written);

uint8_t OxyOSDragActionsOf(int operations);
int OxyOSDragOperationsOf(uint8_t actions);
uint8_t OxyOSPreferredDragAction(int operations);

std::unique_ptr<OSExchangeData> OxyOSDragPlaceholder(
    const std::vector<std::string>& types);

std::optional<std::string> OxyOSDragTypeToAccept(
    const std::vector<std::string>& types);

std::vector<std::string> OxyOSDropTypesToReceive(
    const std::vector<std::string>& types);

std::unique_ptr<OSExchangeData> OxyOSDropData(
    const std::map<std::string, std::string>& received);

}

#endif
