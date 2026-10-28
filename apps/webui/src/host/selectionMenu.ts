declare const chrome: { send(method: string, args?: unknown[]): void };

const ASK = { id: "ask", title: "Ask Chat About “$1”" };

export function startSelectionMenu() {
  chrome.send("astroSelectionMenu", [[ASK]]);
}
