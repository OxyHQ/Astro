import { useBrowser } from "../../store/browser";
import { completeOAuth, oauthReturnOf } from "./apps";

export const APPS_URL = "astro://apps";

let watchers = 0;
let stopWatching: (() => void) | null = null;

export function startOAuthReturns(): () => void {
  if (watchers++ === 0) stopWatching = watchOAuthReturns();
  let stopped = false;
  return () => {
    if (stopped) return;
    stopped = true;
    if (--watchers === 0) {
      stopWatching?.();
      stopWatching = null;
    }
  };
}

function watchOAuthReturns(): () => void {
  const seen = new Map<string, string>();
  const check = () => {
    const s = useBrowser.getState();
    for (const tab of Object.values(s.tabs)) {
      const urls = [tab.url, tab.navigation?.url ?? ""];
      const key = urls.join(" ");
      if (seen.get(tab.id) === key) continue;
      seen.set(tab.id, key);
      const ret = urls.map(oauthReturnOf).find((r) => r !== null);
      if (!ret) continue;
      void completeOAuth(ret)
        .then((done) => {
          if (done && useBrowser.getState().tabs[tab.id]) useBrowser.getState().navigate(tab.id, `${APPS_URL}?q=connected`);
        })
        .catch(() => {
          if (useBrowser.getState().tabs[tab.id]) useBrowser.getState().navigate(tab.id, `${APPS_URL}?q=failed`);
        });
    }
  };
  return useBrowser.subscribe((s, prev) => {
    if (s.tabs !== prev.tabs) check();
  });
}
