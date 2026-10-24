import { callTab } from "./tabBridge";
import { refForBrowser } from "../shims/WebView";

const onTab = async <T,>(browserId: number, method: string, args: Record<string, unknown>, fallback: T): Promise<T> => {
  const ref = refForBrowser(browserId);
  return ref ? ((await callTab<T>(ref, method, args)) ?? fallback) : fallback;
};

export const chromeUIServices = {
  stopCapture: (capturer: number) => onTab(capturer, "stopCapture", {}, false),
  changeCaptureSource: async (capturer: number, target: number) => {
    const ref = refForBrowser(capturer);
    return ref ? onTab(target, "shareThisTabInstead", { capturer: ref }, false) : false;
  },
  actionStates: (browserId: number, ids: string[]) => onTab(browserId, "actionStates", { ids }, {}),
  sidePanelURL: (browserId: number, extensionId: string) => onTab<string | null>(browserId, "sidePanelURL", { id: extensionId }, null),
};
