import { create } from "zustand";
import { chatItemId, updateWindowChat } from "../../ai/chat/state";
import { webviews } from "../../lib/webviews";
import { useBrowser } from "../../store/browser";
import { activeTabId } from "../../store/model";

export type AreaCaptureRequest = { windowId: string; tabId: string };

export const useAreaCapture = create<{ request: AreaCaptureRequest | null }>()(() => ({ request: null }));

function activeTab(windowId: string) {
  const s = useBrowser.getState();
  const tabId = activeTabId(s, windowId);
  const tab = tabId ? s.tabs[tabId] : undefined;
  const web = tabId ? webviews.get(tabId) : undefined;
  return tab && web ? { tab, web } : null;
}

export const jpegUri = (data: string) => (data.startsWith("data:") ? data : `data:image/jpeg;base64,${data}`);

export function attachScreenshot(windowId: string, tabId: string, uri: string) {
  const tab = useBrowser.getState().tabs[tabId];
  if (!tab) return;
  updateWindowChat(windowId, (c) => ({
    context: [...c.context, { id: chatItemId("screenshot"), kind: "screenshot", tabId, title: tab.customTitle || tab.title, url: tab.url, uri }],
    focusRequest: Date.now(),
  }));
}

export function startAreaCapture(windowId: string) {
  const found = activeTab(windowId);
  if (found) useAreaCapture.setState({ request: { windowId, tabId: found.tab.id } });
}

export const endAreaCapture = () => useAreaCapture.setState({ request: null });

export const fullPageCaptureSupported = (windowId: string) => !!activeTab(windowId)?.web.captureFullPage;

export async function captureFullPage(windowId: string) {
  const found = activeTab(windowId);
  const picture = await found?.web.captureFullPage?.().catch(() => null);
  if (found && picture?.data) attachScreenshot(windowId, found.tab.id, jpegUri(picture.data));
}
