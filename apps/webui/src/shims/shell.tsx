import { type ComponentType, useEffect, useRef } from "react";
import { View, type ViewProps } from "react-native";
import type { OpenWindowOptions } from "@astro-browser-real/shell";
import { isUtilityWindowId } from "../../../browser/src/components/settings/windows";
import { loadCr, pickFiles as pickEngineFiles } from "../host/engine";
import { focusPageWindow, pageWindowId, releaseWindow, requestWindow } from "../host/windows";
import { closeUtilityWindow, openUtilityWindow, openUtilityWindows } from "../utilityWindows";

export * from "../../../demo/src/shims/shell";

declare const chrome: { send(method: string, args?: unknown[]): void };

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
