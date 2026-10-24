import { useBrowser } from "../../../browser/src/store/browser";
import { confirm } from "../../../demo/src/shims/web/overlays";
import { systemInfo } from "./system";

const downloadsInProgress = () => useBrowser.getState().downloads.filter((d) => d.state === "downloading").length;

export async function confirmDownloadsCancelled(windowId: string | null): Promise<boolean> {
  const count = downloadsInProgress();
  if (count <= 0) return true;
  const { confirmed } = await confirm({
    title: `Are you sure you want to quit ${systemInfo.appName}?`,
    message:
      count === 1
        ? "You have 1 download in progress. If you quit now, this download will be cancelled."
        : `You have ${count} downloads in progress. If you quit now, these downloads will be cancelled.`,
    confirmTitle: "Quit",
    cancelTitle: "Cancel",
    windowId: windowId ?? undefined,
  });
  return confirmed;
}

const askingToClose = new Set<string>();
let quitConfirmed: () => void = () => {};
export const setQuitConfirmed = (quit: () => void) => void (quitConfirmed = quit);

export async function confirmWindowClose(windowId: string): Promise<boolean> {
  if (Object.keys(useBrowser.getState().windows).some((id) => id !== windowId) || downloadsInProgress() <= 0) return true;
  if (askingToClose.has(windowId)) return false;
  askingToClose.add(windowId);
  const quit = await confirmDownloadsCancelled(windowId).finally(() => askingToClose.delete(windowId));
  if (quit) quitConfirmed();
  return false;
}

export async function closeOwnWindow(windowId: string, close: () => void) {
  if (Object.keys(useBrowser.getState().windows).length || downloadsInProgress() <= 0) return close();
  if (await confirmDownloadsCancelled(windowId)) return quitConfirmed();
  useBrowser.getState().reopenClosedWindow();
  close();
}
