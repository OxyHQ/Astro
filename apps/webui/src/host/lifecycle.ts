import { followBatterySaver, leadTabLifecycle, lifecycleProbe, type SharedBatterySaver, startTabLifecycle } from "../../../browser/src/lib/tabLifecycle";
import { onAppActivity } from "./appActive";
import { isLeaderPage, pageWindowId } from "./windows";

type Message = { type: "batterySaver"; state: SharedBatterySaver } | { type: "hello" };

const CHANNEL = "astro-lifecycle";

let launching = false;
let started = false;
let channel: BroadcastChannel | null = null;
let lastShared: SharedBatterySaver | null = null;

const post = (message: Message) => channel?.postMessage(message);

export function leadLifecycle(hydrate: boolean) {
  if (!started) {
    launching = hydrate;
    return;
  }
  leadTabLifecycle();
}

export function startLifecycle() {
  if (started) return;
  started = true;
  channel = new BroadcastChannel(CHANNEL);
  channel.onmessage = ({ data }: MessageEvent<Message>) => {
    if (data.type === "hello") {
      if (isLeaderPage() && lastShared) post({ type: "batterySaver", state: { ...lastShared, announce: false } });
      return;
    }
    if (!isLeaderPage()) followBatterySaver(data.state);
  };
  startTabLifecycle({
    leads: isLeaderPage,
    ownsWindow: (windowId) => windowId === pageWindowId(),
    launching,
    watchAppActive: onAppActivity,
    shareBatterySaver: (state) => {
      lastShared = state;
      post({ type: "batterySaver", state });
    },
  });
  post({ type: "hello" });
  Object.assign((globalThis as { astro?: object }).astro ?? {}, { lifecycle: lifecycleProbe() });
}
