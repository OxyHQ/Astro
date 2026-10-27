import { useOxySession } from "../../../browser/src/oxy/session";

declare const chrome: { send(method: string, args?: unknown[]): void };

const ASK = { id: "ask", title: "Ask Chat About “$1”" };

export function startSelectionMenu() {
  const push = () => chrome.send("astroSelectionMenu", [useOxySession.getState().available ? [ASK] : []]);
  push();
  useOxySession.subscribe((state, prev) => {
    if (state.available !== prev.available) push();
  });
}
