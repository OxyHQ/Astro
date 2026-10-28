import { breadcrumb } from "@astro-browser/core";
import { Text } from "react-native";
import { useTheme } from "../lib/theme";
import { useBrowser } from "../store/browser";
import { useSettings, useTabLive } from "../store/hooks";
import { useStoreWhile } from "../store/tabWatch";
import { toolbarPalette } from "./layout/toolbarColors";
import { useHistoryMenu } from "./layout/history";
import { usePages } from "./layout/pageState";
import { useExtensions } from "./extensions/store";
import { needsBar, toolbarMode, useToolbarAutoHide, type ToolbarMode } from "./layout/toolbarAutoHide";

export function useToolbarMode(tabId: string, windowId: string, enabled: boolean): ToolbarMode {
  const scrolledDown = useStoreWhile(useToolbarAutoHide, enabled, (s) => !!s.scrolledDown[tabId]);
  const down = enabled && scrolledDown;
  const hasPage = useStoreWhile(useBrowser, down, (s) => !!s.tabs[tabId]?.url);
  const appNeedsBar = useStoreWhile(useBrowser, down, (s) => down && needsBar(s, tabId, windowId));
  const popover = useStoreWhile(usePages, down, (s) => down && !!s.popover[tabId]);
  const historyMenu = useStoreWhile(useHistoryMenu, down, (m) => down && m.menu?.tabId === tabId);
  const extensionPopup = useStoreWhile(useExtensions, down, (e) => down && e.popup?.windowId === windowId);
  return toolbarMode({ enabled, hasPage, scrolledDown, peek: false, needsBar: appNeedsBar || popover || historyMenu || extensionPopup });
}

export function useToolbarBand(tabId: string): string {
  const theme = useTheme();
  const url = useBrowser((s) => s.tabs[tabId]?.url ?? "");
  const themeColor = useTabLive(tabId, (l) => l.themeColor);
  const extendColor = useSettings((s) => s.extendWebsiteColor);
  return toolbarPalette(theme, extendColor && url ? themeColor : null).background ?? theme.card;
}

export function ToolbarSummary({ tabId }: { tabId: string }) {
  const theme = useTheme();
  const url = useBrowser((s) => s.tabs[tabId]?.url ?? "");
  const themeColor = useTabLive(tabId, (l) => l.themeColor);
  const extendColor = useSettings((s) => s.extendWebsiteColor);
  const palette = toolbarPalette(theme, extendColor && url ? themeColor : null);
  const host = url.startsWith("file:") ? "File" : breadcrumb(url).host;
  return (
    <Text numberOfLines={1} style={{ fontSize: 11, fontWeight: "500", color: palette.secondary }}>
      {host}
    </Text>
  );
}
