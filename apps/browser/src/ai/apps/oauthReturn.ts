import { useBrowser } from "../../store/browser";
import { completeOAuth, oauthReturnOf } from "./apps";

export const APPS_URL = "astro://apps";

export function startOAuthReturns(): () => void {
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
