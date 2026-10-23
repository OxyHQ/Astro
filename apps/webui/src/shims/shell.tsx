import { type ComponentType, useEffect, useRef } from "react";
import { View, type ViewProps } from "react-native";

export * from "../../../demo/src/shims/shell";

const key = (name: string) => `astro.document.${name}`;

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export const readDocument = (name: string) => storage()?.getItem(key(name)) ?? null;
export const writeDocument = (name: string, contents: string) => void storage()?.setItem(key(name), contents);
export const saveDocument = async (name: string, contents: string) => writeDocument(name, contents);
export const removeDocument = (name: string) => void storage()?.removeItem(key(name));

export function WindowDragRegion({ titleBarDoubleClick: _double, onRegionDoubleClick, ...props }: ViewProps & { titleBarDoubleClick?: boolean; onRegionDoubleClick?: () => void }) {
  const region = useRef<HTMLElement | null>(null);
  useEffect(() => {
    region.current?.style.setProperty("app-region", "drag");
  }, []);
  const Region = View as unknown as ComponentType<ViewProps & { ref: typeof region; onDoubleClick?: () => void }>;
  return <Region {...props} ref={region} onDoubleClick={onRegionDoubleClick} />;
}
