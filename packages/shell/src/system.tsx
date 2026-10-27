import { requireNativeModule, requireNativeViewManager, requireOptionalNativeModule } from "expo-modules-core";
import { forwardRef, type Ref } from "react";
import { View, type ViewProps } from "react-native";

export type MenuShortcut = {
  id: string;
  title: string;
  path: string[];
  key: string;
  modifiers: ShortcutModifier[];
  defaultKey: string;
  defaultModifiers: ShortcutModifier[];
  remappable: boolean;
  aliases?: string[][];
};

export type ShortcutModifier = "control" | "option" | "shift" | "command" | "function";

type LaunchAtLoginStatus = "enabled" | "requiresApproval" | "notRegistered" | "notFound";

const System = requireNativeModule<{
  isDefaultBrowser(): Promise<boolean>;
  setAsDefaultBrowser(): Promise<boolean>;
  launchAtLoginStatus(): Promise<LaunchAtLoginStatus>;
  setLaunchAtLogin(enabled: boolean): Promise<void>;
  fileExists(path: string): boolean;
  openFile(path: string): Promise<boolean>;
  revealFile(path: string): Promise<boolean>;
  moveToTrash(path: string): Promise<boolean>;
  fileIcon(path: string, size: number): Promise<string | null>;
  appIcon(pid: number, size: number): Promise<string | null>;
  hapticTick(): void;
  menuShortcuts(): Promise<MenuShortcut[]>;
  recordShortcut(): Promise<{ key: string; modifiers: ShortcutModifier[] } | null>;
  cancelRecording(): Promise<void>;
}>("AstroSystem");

export const isDefaultBrowser = () => System.isDefaultBrowser();
export const setAsDefaultBrowser = () => System.setAsDefaultBrowser();
export const launchAtLoginStatus = () => System.launchAtLoginStatus();
export const setLaunchAtLogin = (enabled: boolean) => System.setLaunchAtLogin(enabled);

export const fileExists = (path: string) => System.fileExists(path);
export const openFile = (path: string) => System.openFile(path);
export const revealFile = (path: string) => System.revealFile(path);
export const moveToTrash = (path: string) => System.moveToTrash(path);
export const fileIcon = (path: string, size = 32) => System.fileIcon(path, size);
export const runningAppIcon = (pid: number, size = 32) => System.appIcon(pid, size);
export const hapticTick = () => System.hapticTick();
export const menuShortcuts = () => System.menuShortcuts();
export const recordShortcut = () => System.recordShortcut();
export const cancelShortcutRecording = () => System.cancelRecording();

export type MiddleClickEvent = { shiftKey: boolean; altKey: boolean; metaKey: boolean };

export type MouseAreaProps = ViewProps & {
  path?: string | null;
  onMiddleClick?: (e: MiddleClickEvent) => void;
};

type NativeMouseAreaProps = Omit<MouseAreaProps, "onMiddleClick"> & { onMiddleClick?: (e: { nativeEvent: MiddleClickEvent }) => void };

const NativeMouseArea = System ? requireNativeViewManager<NativeMouseAreaProps>("AstroFileDrag") : null;

export function MouseArea({ path, onMiddleClick, ...props }: MouseAreaProps) {
  if (!NativeMouseArea) return <View {...props} />;
  return <NativeMouseArea path={path} onMiddleClick={onMiddleClick && ((e) => onMiddleClick(e.nativeEvent))} {...props} />;
}

export type DroppedItem = { kind: "file"; url: string } | { kind: "url"; url: string } | { kind: "text"; text: string };
export type DropUpdate = { phase: "enter" | "move" | "exit" | "drop"; x: number; y: number; count: number; items: DroppedItem[] };
export type FileDropAreaProps = ViewProps & {
  onDropUpdate?: (e: DropUpdate) => void;
};

type NativeFileDropAreaProps = ViewProps & {
  ref?: (instance: { nativeRef?: { current: View | null } } | null) => void;
  onDropUpdate?: (e: { nativeEvent: DropUpdate }) => void;
};

const fileDropBuilt = !!(globalThis as { expo?: { getViewConfig?: (name: string) => unknown } }).expo?.getViewConfig?.("AstroFileDrop");
const NativeFileDropArea = fileDropBuilt ? requireNativeViewManager<NativeFileDropAreaProps>("AstroFileDrop") : null;

function assignRef<T>(ref: Ref<T> | undefined, value: T | null) {
  if (typeof ref === "function") ref(value);
  else if (ref) (ref as { current: T | null }).current = value;
}

export const FileDropArea = forwardRef<View, FileDropAreaProps>(function FileDropArea({ onDropUpdate, ...props }, ref) {
  if (!NativeFileDropArea) return <View ref={ref} {...props} />;
  return (
    <NativeFileDropArea
      ref={(instance) => assignRef(ref, instance?.nativeRef?.current ?? null)}
      onDropUpdate={onDropUpdate && ((e) => onDropUpdate(e.nativeEvent))}
      {...props}
    />
  );
});

export type DevDragAction = "move" | "drop" | "cancel" | "end";
export type DevDragPayload = { files?: string[]; urls?: string[]; publicURLs?: string[]; text?: string; fileDrag?: boolean };

const FileDrop = requireOptionalNativeModule<{
  devDrag(windowId: string, action: DevDragAction, x: number, y: number, payload: DevDragPayload | null): Promise<string>;
  devLastFileDrag(): Promise<string[]>;
}>("AstroFileDrop");

export const devFileDrag = {
  drag: (windowId: string, action: DevDragAction, x: number, y: number, payload?: DevDragPayload) =>
    FileDrop ? FileDrop.devDrag(windowId, action, x, y, payload ?? null) : Promise.resolve("no AstroFileDrop"),
  lastFileDrag: () => (FileDrop ? FileDrop.devLastFileDrag() : Promise.resolve([])),
};
