export const BUNDLE_ID = "so.oxy.Astro";

export const APP_TARGET = `application id "${BUNDLE_ID}"`;

export type Tab = {
  windowId: string;
  windowIndex: number;
  tabId: string;
  title: string;
  url: string;
  isPinned: boolean;
  isFocused: boolean;
};

const FIELD = "\u001f";
const RECORD = "\u001e";

export const quote = (s: string) => `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;

export function listTabsScript(target = APP_TARGET) {
  return `set fs to character id 31
set rs to character id 30
set out to ""
tell ${target}
  set windowIndex to 0
  repeat with w in windows
    set windowIndex to windowIndex + 1
    set wId to id of w
    set tIds to id of every tab of w
    set tTitles to title of every tab of w
    set tURLs to URL of every tab of w
    set tPinned to isPinned of every tab of w
    set tFocused to isFocused of every tab of w
    repeat with i from 1 to count of tIds
      set out to out & wId & fs & windowIndex & fs & (item i of tIds) & fs & (item i of tTitles) & fs & (item i of tURLs) & fs & (item i of tPinned) & fs & (item i of tFocused) & rs
    end repeat
  end repeat
end tell
return out`;
}

export function parseTabs(output: string): Tab[] {
  return output
    .split(RECORD)
    .filter((record) => record.trim() !== "")
    .map((record) => {
      const [windowId = "", windowIndex = "0", tabId = "", title = "", url = "", pinned = "", focused = ""] = record.split(FIELD);
      return {
        windowId: windowId.trim(),
        windowIndex: Number(windowIndex) || 0,
        tabId,
        title,
        url: url === "missing value" ? "" : url,
        isPinned: pinned === "true",
        isFocused: focused === "true",
      };
    });
}

export function focusTabScript(tab: Pick<Tab, "windowId" | "tabId">, target = APP_TARGET) {
  return `tell ${target} to focus (tab id ${quote(tab.tabId)} of window id ${quote(tab.windowId)})`;
}

export function closeTabScript(tab: Pick<Tab, "windowId" | "tabId">, target = APP_TARGET) {
  return `tell ${target} to close (tab id ${quote(tab.tabId)} of window id ${quote(tab.windowId)})`;
}

export function activateScript(target = APP_TARGET) {
  return `tell ${target} to activate`;
}

export function hostOf(url: string) {
  try {
    const { hostname, protocol } = new URL(url);
    return hostname.replace(/^www\./, "") || protocol.replace(/:$/, "");
  } catch {
    return url;
  }
}
