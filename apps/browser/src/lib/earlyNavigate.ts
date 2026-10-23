import { killSwitchEnvironment } from "@astro-browser/shell";
import { webviewMount, webviews } from "./webviews";

type Navigation = { url: string; seq: number; userInitiated?: boolean };

const started = new Map<string, { seq: number; mount: object }>();
let enabled: boolean | undefined;

const earlyNavigateOn = () => (enabled ??= killSwitchEnvironment("ASTRO_EARLY_NAVIGATE") !== "off");

export function startNavigation(tabId: string, navigation: Navigation) {
  const view = webviews.get(tabId);
  const mount = webviewMount(tabId);
  if (!view || !mount || !earlyNavigateOn()) return;
  started.set(tabId, { seq: navigation.seq, mount });
  void view.loadUrl(navigation.url, { userInitiated: !!navigation.userInitiated });
}

export function takeStartedNavigation(tabId: string, seq: number | undefined) {
  const start = started.get(tabId);
  if (!start || seq === undefined || start.seq !== seq) return false;
  started.delete(tabId);
  return start.mount === webviewMount(tabId);
}

export const setEarlyNavigateForTests = (on: boolean) => void (enabled = on);
