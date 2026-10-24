import { type ComponentType, forwardRef, useEffect, useRef } from "react";
import { View, type ViewProps } from "react-native";
import type { DroppedItem, DropUpdate, FileDropAreaProps, OpenWindowOptions } from "@astro-browser-real/shell";
import { isUtilityWindowId } from "../../../browser/src/components/settings/windows";
import { provideNativeModule } from "../../../demo/src/shims/expo-modules-core";
import { loadCr, pickFiles as pickEngineFiles } from "../host/engine";
import { startDictation, systemInfo as webuiSystemInfo } from "../host/system";
import { focusPageWindow, pageWindowId, releaseWindow, requestWindow } from "../host/windows";
import { closeUtilityWindow, openUtilityWindow, openUtilityWindows } from "../utilityWindows";

export * from "../../../demo/src/shims/shell";
export { installCli, installedCliVersion, onCliInstallLine } from "../host/cli";
export { onUserScriptsChange, readUserScripts, readUserScriptsStatus, userScriptsAvailable, watchUserScripts, writeUserScriptsStatus } from "../host/userScripts";
export { translation } from "../host/translate";

declare const chrome: { send(method: string, args?: unknown[]): void };

export const systemInfo = () => webuiSystemInfo;

provideNativeModule("AstroApp", { systemInfo });
provideNativeModule("AstroShell", { setMenuState: async () => {}, setMenuBookmarks: async () => {}, startDictation });

type DocumentChange = { name: string; contents: string | null };

const documents = new Map<string, string>();
const documentChanges = new BroadcastChannel("astro-documents");

documentChanges.onmessage = ({ data }: MessageEvent<DocumentChange>) => {
  if (data.contents === null) documents.delete(data.name);
  else documents.set(data.name, data.contents);
};

export async function loadDocuments() {
  const stored = await (await loadCr()).sendWithPromise<Record<string, string>>("astroDocuments");
  for (const [name, contents] of Object.entries(stored ?? {})) documents.set(name, contents);
}

export const readDocument = (name: string) => documents.get(name) ?? null;
export const writeDocument = (name: string, contents: string) => {
  documents.set(name, contents);
  chrome.send("astroDocumentWrite", [name, contents]);
  documentChanges.postMessage({ name, contents } satisfies DocumentChange);
};
export const saveDocument = async (name: string, contents: string) => writeDocument(name, contents);
export const removeDocument = (name: string) => {
  documents.delete(name);
  chrome.send("astroDocumentRemove", [name]);
  documentChanges.postMessage({ name, contents: null } satisfies DocumentChange);
};

export function WindowDragRegion({ titleBarDoubleClick: _double, onRegionDoubleClick, ...props }: ViewProps & { titleBarDoubleClick?: boolean; onRegionDoubleClick?: () => void }) {
  const region = useRef<HTMLElement | null>(null);
  useEffect(() => {
    region.current?.style.setProperty("app-region", "drag");
  }, []);
  const Region = View as unknown as ComponentType<ViewProps & { ref: typeof region; onDoubleClick?: () => void }>;
  return <Region {...props} ref={region} onDoubleClick={onRegionDoubleClick} />;
}

function droppedItems(data: DataTransfer | null): DroppedItem[] {
  if (!data) return [];
  const uris = data
    .getData("text/uri-list")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));
  if (uris.length) return uris.map((url) => (url.startsWith("file:") ? { kind: "file", url } : { kind: "url", url }));
  const text = data.getData("text/plain");
  return text ? [{ kind: "text", text }] : [];
}

const carriesDrop = (data: DataTransfer | null) =>
  !!data && [...data.types].some((type) => type === "Files" || type === "text/uri-list" || type === "text/plain");

export const FileDropArea = forwardRef<View, FileDropAreaProps>(function FileDropArea({ onDropUpdate, ...props }, ref) {
  const area = useRef<HTMLElement | null>(null);
  const report = useRef(onDropUpdate);
  report.current = onDropUpdate;
  useEffect(() => {
    const element = area.current;
    if (!element) return;
    let depth = 0;
    const update = (e: DragEvent, phase: DropUpdate["phase"], items: DroppedItem[] = []) => {
      const bounds = element.getBoundingClientRect();
      const count = Math.max(e.dataTransfer?.items.length ?? 0, items.length, 1);
      report.current?.({ phase, x: e.clientX - bounds.left, y: e.clientY - bounds.top, count, items });
    };
    const enter = (e: DragEvent) => {
      if (!carriesDrop(e.dataTransfer)) return;
      e.preventDefault();
      if (depth++ === 0) update(e, "enter");
    };
    const over = (e: DragEvent) => {
      if (!depth) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
      update(e, "move");
    };
    const leave = (e: DragEvent) => {
      if (!depth) return;
      if (--depth === 0) update(e, "exit");
    };
    const drop = (e: DragEvent) => {
      if (!depth) return;
      e.preventDefault();
      depth = 0;
      update(e, "drop", droppedItems(e.dataTransfer));
    };
    element.addEventListener("dragenter", enter);
    element.addEventListener("dragover", over);
    element.addEventListener("dragleave", leave);
    element.addEventListener("drop", drop);
    return () => {
      element.removeEventListener("dragenter", enter);
      element.removeEventListener("dragover", over);
      element.removeEventListener("dragleave", leave);
      element.removeEventListener("drop", drop);
    };
  }, []);
  const Area = View as unknown as ComponentType<ViewProps & { ref: (element: HTMLElement | null) => void }>;
  return (
    <Area
      {...props}
      ref={(element) => {
        area.current = element;
        if (typeof ref === "function") ref(element as unknown as View);
        else if (ref) (ref as { current: View | null }).current = element as unknown as View;
      }}
    />
  );
});

export const openWindow = async (id: string, _options: OpenWindowOptions = {}) => {
  if (!openUtilityWindow(id)) requestWindow(id);
};
export const closeWindow = async (id: string) => {
  if (isUtilityWindowId(id)) closeUtilityWindow(id);
  else releaseWindow(id);
};
export const focusWindow = async (id: string) => focusPageWindow(id);
export const setWindowTitle = async (id: string, title: string) => {
  if (id === pageWindowId()) document.title = title || "Astro";
};
export const pickFiles = () => pickEngineFiles("files");
export const windowIds = async () => [...openUtilityWindows()];
