import { setInsert, useTabDrag } from "../../../browser/src/components/layout/tabDrag";
import { pageWindowId } from "./windows";

type Point = [number, number];
type Message =
  | { type: "over"; drag: string; from: string; tabId: string | null; tabIds: string[]; windowId: string; screen: Point }
  | { type: "leave"; drag: string; windowId: string }
  | { type: "insert"; drag: string; windowId: string; placed: boolean; beforeId: string | null };

const CHANNEL = "astro-tab-drag";
const STALE_MS = 3000;
const HEARTBEAT_MS = 1000;

const channel = new BroadcastChannel(CHANNEL);
const post = (message: Message) => channel.postMessage(message);

let outgoing: { drag: string; windowId: string; screen: Point } | null = null;
let outgoingDrag: string | null = null;
let heartbeat: ReturnType<typeof setInterval> | null = null;
let incoming: { drag: string; windowId: string } | null = null;
let incomingStale: ReturnType<typeof setTimeout> | null = null;
let applying = false;
let contentOrigin: Point | null = null;

const noteOrigin = (e: PointerEvent) => void (contentOrigin = [e.screenX - e.clientX, e.screenY - e.clientY]);

function estimatedContentOrigin(): Point {
  const side = Math.max(0, (window.outerWidth - window.innerWidth) / 2);
  const top = Math.max(0, window.outerHeight - window.innerHeight - side);
  return [window.screenX + side, window.screenY + top];
}

const samePoint = (a: Point, b: Point) => a[0] === b[0] && a[1] === b[1];

function leaveOutgoing() {
  if (!outgoing) return;
  post({ type: "leave", drag: outgoing.drag, windowId: outgoing.windowId });
  outgoing = null;
  if (heartbeat !== null) clearInterval(heartbeat);
  heartbeat = null;
}

function sendOver(force: boolean) {
  const d = useTabDrag.getState();
  const own = pageWindowId();
  if (incoming || !own || d.windowId !== own || !d.tabIds.length) {
    outgoingDrag = null;
    return leaveOutgoing();
  }
  outgoingDrag ??= crypto.randomUUID();
  if (!d.overWindow || !d.overPoint) return leaveOutgoing();
  if (outgoing && outgoing.windowId !== d.overWindow) leaveOutgoing();
  const [left, top] = contentOrigin ?? estimatedContentOrigin();
  const screen: Point = [left + d.x, top + d.y];
  if (!force && outgoing && samePoint(outgoing.screen, screen)) return;
  outgoing = { drag: outgoingDrag, windowId: d.overWindow, screen };
  post({ type: "over", drag: outgoingDrag, from: own, tabId: d.tabId, tabIds: d.tabIds, windowId: d.overWindow, screen });
  heartbeat ??= setInterval(() => sendOver(true), HEARTBEAT_MS);
}

function mirror(update: Partial<ReturnType<typeof useTabDrag.getState>>) {
  applying = true;
  try {
    useTabDrag.setState(update);
  } finally {
    applying = false;
  }
}

function endIncoming() {
  if (incomingStale !== null) clearTimeout(incomingStale);
  incomingStale = null;
  if (!incoming) return;
  incoming = null;
  mirror({ tabId: null, tabIds: [], windowId: null, lifted: null, onPage: false, target: null, outside: false, overWindow: null, overPoint: null, insert: null });
}

function receiveOver(message: Extract<Message, { type: "over" }>) {
  const own = pageWindowId();
  if (!own || message.windowId !== own || message.from === own) return;
  const d = useTabDrag.getState();
  if (!incoming && d.tabIds.length) return;
  if (incoming && incoming.drag !== message.drag) endIncoming();
  incoming = { drag: message.drag, windowId: own };
  if (incomingStale !== null) clearTimeout(incomingStale);
  incomingStale = setTimeout(endIncoming, STALE_MS);
  const current = useTabDrag.getState();
  const [left, top] = estimatedContentOrigin();
  mirror({
    tabId: message.tabId,
    tabIds: message.tabIds,
    windowId: message.from,
    x: -1,
    y: -1,
    lifted: null,
    onPage: false,
    target: null,
    outside: true,
    overWindow: own,
    overPoint: [message.screen[0] - left, message.screen[1] - top],
    insert: current.insert?.windowId === own ? current.insert : null,
  });
}

function reportInsert() {
  if (!incoming || applying) return;
  const { insert } = useTabDrag.getState();
  post({ type: "insert", drag: incoming.drag, windowId: incoming.windowId, placed: !!insert, beforeId: insert?.beforeId ?? null });
}

channel.onmessage = ({ data }: MessageEvent<Message>) => {
  switch (data.type) {
    case "over":
      return receiveOver(data);
    case "leave":
      if (incoming?.drag === data.drag) endIncoming();
      return;
    case "insert":
      if (outgoing?.drag === data.drag && outgoing.windowId === data.windowId) setInsert(data.windowId, data.placed ? data.beforeId : undefined);
      return;
  }
};

export function startTabDragShare() {
  window.addEventListener("pointerdown", noteOrigin, true);
  window.addEventListener("pointermove", noteOrigin, true);
  useTabDrag.subscribe((d, prev) => {
    if (incoming) {
      if (d.insert !== prev.insert) reportInsert();
      return;
    }
    if (d.tabIds !== prev.tabIds || d.overWindow !== prev.overWindow || d.overPoint !== prev.overPoint || d.x !== prev.x || d.y !== prev.y || d.windowId !== prev.windowId) sendOver(false);
  });
}
