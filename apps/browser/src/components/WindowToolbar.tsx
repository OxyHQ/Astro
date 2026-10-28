import type { AutoHideBarController } from "@oxy.so/bloom/layout";
import { AutoHideBarRegion } from "@oxy.so/bloom/layout";
import { useEffect, useSyncExternalStore } from "react";
import { View } from "react-native";
import { layout } from "../lib/theme";
import { ToolbarSummary } from "./AutoHideToolbar";
import type { ToolbarGeometry } from "./layout/geometry";
import { Toolbar } from "./Toolbar";

type PaneChrome = { tabId: string; controller: AutoHideBarController };

const chromes = new Map<string, PaneChrome>();
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => void listeners.delete(listener);
};

export function publishPaneChrome(windowId: string, chrome: PaneChrome) {
  const was = chromes.get(windowId);
  if (was && was.tabId === chrome.tabId && was.controller === chrome.controller) return;
  chromes.set(windowId, chrome);
  for (const listener of listeners) listener();
}

const FRAME = { position: "absolute", left: 0, top: 0, right: 0, height: layout.toolbarHeight } as const;

export function WindowToolbar({ windowId, tabId, geometry, autoHide }: { windowId: string; tabId: string; geometry: ToolbarGeometry; autoHide: boolean }) {
  const chrome = useSyncExternalStore(subscribe, () => chromes.get(windowId));
  useEffect(() => () => void chromes.delete(windowId), [windowId]);
  const bar = <Toolbar tabId={tabId} geometry={geometry} windowId={windowId} inSplit={false} focused bare />;
  if (!autoHide) {
    return (
      <View pointerEvents="box-none" style={FRAME}>
        {bar}
      </View>
    );
  }
  if (!chrome || chrome.tabId !== tabId) return null;
  return <AutoHideBarRegion controller={chrome.controller} bar={bar} summary={<ToolbarSummary tabId={tabId} />} />;
}
