import { Platform } from "react-native";

export const ON_MAC = Platform.OS === "macos";
const ON_WINDOWS = !ON_MAC && typeof navigator !== "undefined" && /Win/.test(navigator.platform);
const byPlatform = <T>(mac: T, windows: T, linux: T): T => (ON_MAC ? mac : ON_WINDOWS ? windows : linux);

export const OS_NAME = byPlatform("macOS", "Windows", "Linux");
export const DEVICE = ON_MAC ? "Mac" : "computer";
export const DEVICES = ON_MAC ? "Macs" : "computers";
export const THIS_DEVICE_TITLE = ON_MAC ? "This Mac" : "This Computer";
export const SYNC_FOLDER_EXAMPLE = ON_MAC ? "iCloud Drive" : "OneDrive or Dropbox";
export const SYSTEM_UNLOCK = byPlatform("Touch ID or your login password", "Windows Hello", "your account password");
export const FILE_MANAGER = byPlatform("Finder", "File Explorer", "Files");
export const NATIVE_APPS = ON_MAC ? "Mac apps" : "desktop apps";
export const MENU_BAR = ON_MAC ? "menu bar" : "app menu";
export const KEYCHAIN = byPlatform("your Keychain", "Windows' data protection", "your system keyring");
export const IN_KEYCHAIN = byPlatform("in your Keychain", "with Windows' data protection", "in your system keyring");
export const KEYCHAIN_KEY = byPlatform("a key in your Keychain", "a key protected by Windows' data protection", "a key in your system keyring");
