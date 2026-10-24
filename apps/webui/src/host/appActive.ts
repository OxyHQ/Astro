import { emitAppEvent } from "../../../demo/src/shims/shell";
import { tabHub } from "./tabs";

type Message = { type: "active"; page: string; active: boolean } | { type: "hello"; page: string };

const CHANNEL = "astro-app-active";
const SETTLE_MS = 1000;

const page = crypto.randomUUID();
const channel = new BroadcastChannel(CHANNEL);
const activePages = new Set<string>();
let appActive = false;
let settling: ReturnType<typeof setTimeout> | null = null;

function settle() {
  if (settling) clearTimeout(settling);
  settling = setTimeout(() => {
    settling = null;
    const active = activePages.size > 0;
    if (appActive && !active) emitAppEvent({ type: "resignActive" });
    appActive = active;
  }, SETTLE_MS);
}

function note(from: string, active: boolean) {
  if (active) activePages.add(from);
  else activePages.delete(from);
  settle();
}

function setOwn(active: boolean) {
  note(page, active);
  channel.postMessage({ type: "active", page, active } satisfies Message);
}

export async function startAppActivity() {
  channel.onmessage = ({ data }: MessageEvent<Message>) => {
    if (data.type === "hello") {
      if (activePages.has(page)) channel.postMessage({ type: "active", page, active: true } satisfies Message);
      return;
    }
    note(data.page, data.active);
  };
  window.addEventListener("pagehide", () => setOwn(false));
  channel.postMessage({ type: "hello", page } satisfies Message);
  setOwn(document.hasFocus());
  const hub = await tabHub();
  hub.onActiveChanged = setOwn;
}
