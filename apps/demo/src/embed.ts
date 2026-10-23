import { useBrowser } from "../../browser/src/store/browser";
import { applyControl, controlModel, type Control } from "./Controls";
import { playNudge } from "./nudge";

type Inbound = { type: "astro-demo:control"; id: Control["id"]; value?: string } | { type: "astro-demo:hello" } | { type: "astro-demo:nudge" };

function guardFocus(engaged: () => boolean) {
  const focus = HTMLElement.prototype.focus;
  HTMLElement.prototype.focus = function guardedFocus(options?: FocusOptions) {
    if (!engaged()) return;
    focus.call(this, { ...options, preventScroll: true });
  };
}

export function startEmbed() {
  const host = window.parent;
  if (host === window) return;
  document.documentElement.classList.add("embed");

  const post = (message: object) => host.postMessage(message, "*");
  let engaged = false;
  let nudged = false;
  const nudge = new AbortController();
  const engage = () => {
    if (engaged) return;
    engaged = true;
    nudge.abort();
    post({ type: "astro-demo:engaged" });
  };
  guardFocus(() => engaged);
  addEventListener("pointerdown", engage, { capture: true });
  addEventListener("keydown", engage, { capture: true });

  let last = "";
  const publish = (force = false) => {
    const snapshot = JSON.stringify(controlModel(useBrowser.getState()));
    if (!force && snapshot === last) return;
    last = snapshot;
    post({ type: "astro-demo:controls", controls: JSON.parse(snapshot) });
  };
  useBrowser.subscribe(() => publish());

  addEventListener("message", (event: MessageEvent<Inbound>) => {
    if (event.source !== host || !event.data || typeof event.data !== "object") return;
    if (event.data.type === "astro-demo:hello") return publish(true);
    if (event.data.type === "astro-demo:nudge") {
      if (engaged || nudged) return;
      nudged = true;
      void playNudge(nudge.signal);
      return;
    }
    if (event.data.type === "astro-demo:control") {
      engage();
      applyControl(event.data.id, event.data.value);
    }
  });

  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      publish(true);
      post({ type: "astro-demo:ready" });
    }),
  );
}
