import { useOxySession } from "../../../browser/src/oxy/session";
import { useBrowser } from "../../../browser/src/store/browser";
import { handleQuitShortcut, keyDown, keyUp, onKeyCaptureChange, shortcutCombos, takeKeysFromEngine } from "../../../demo/src/shims/web/motion/shortcuts";
import { requestQuit } from "../shims/shell";
import { loadCr } from "./engine";

declare const chrome: { send(method: string, args?: unknown[]): void };

type EngineKey = { type?: "keydown" | "keyup"; code: string; key: string; mods: number };

const SHIFT = 1;
const CONTROL = 2;
const ALT = 4;
const META = 8;

const keyInput = ({ code, key, mods }: EngineKey) => ({
  code,
  key,
  shiftKey: !!(mods & SHIFT),
  ctrlKey: !!(mods & CONTROL),
  altKey: !!(mods & ALT),
  metaKey: !!(mods & META),
});

export async function startEngineKeys() {
  takeKeysFromEngine();
  handleQuitShortcut(() => void requestQuit());
  let sent = "";
  const push = () => {
    const { active, owned } = shortcutCombos();
    const next = JSON.stringify([active, owned]);
    if (next === sent) return;
    sent = next;
    chrome.send("astroShortcuts", [active, owned]);
  };
  push();
  useBrowser.subscribe((state, prev) => {
    if (state.settings.shortcuts !== prev.settings.shortcuts || state.profileOrder !== prev.profileOrder) push();
  });
  useOxySession.subscribe((state, prev) => {
    if (state.available !== prev.available) push();
  });
  onKeyCaptureChange((capturing) => chrome.send("astroKeyCapture", [capturing]));
  const cr = await loadCr();
  const add = cr.addWebUiListener as unknown as (event: string, listener: (kind: string, payload: EngineKey) => void) => void;
  add("astro-window-key", (kind, payload) => {
    if (kind === "shortcut") keyDown(keyInput(payload), false);
    else if (payload.type === "keyup") keyUp(keyInput(payload));
    else keyDown(keyInput(payload), false);
  });
}
