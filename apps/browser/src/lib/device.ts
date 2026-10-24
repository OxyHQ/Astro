import { Platform } from "react-native";

export const ON_MAC = Platform.OS === "macos";
export const DEVICE = ON_MAC ? "Mac" : "computer";
export const DEVICES = ON_MAC ? "Macs" : "computers";
export const THIS_DEVICE_TITLE = ON_MAC ? "This Mac" : "This Computer";
export const SYNC_FOLDER_EXAMPLE = ON_MAC ? "iCloud Drive" : "OneDrive or Dropbox";
