import { record as rrweb } from "@rrweb/record";
import { BLOCK_SELECTOR, PRIVATE_SELECTOR, REPLAY_CHUNK_MS, REPLAY_MIN_SESSION_MS, REPLAY_PATH } from "../../data/telemetry";
import { capture, distinctId, onHide, onSessionChange, sessionId, sessionStart } from "./core";
import { sampled } from "./replay";

interface eventWithTime {
  type: number;
  data: unknown;
  timestamp: number;
}

const MAX_CHUNK = 1_900_000;
const MAX_BEACON = 60_000;

const SEQ_KEY = "ac:replay_seq";
let memorySeq: { sid: string; next: number } = { sid: "", next: 0 };

function nextSeq(sid: string): number {
  let state = memorySeq;
  try {
    const stored = JSON.parse(localStorage.getItem(SEQ_KEY) ?? "null") as typeof memorySeq | null;
    if (stored && typeof stored.next === "number") state = stored;
  } catch {}
  const seq = state.sid === sid ? state.next : 0;
  memorySeq = { sid, next: seq + 1 };
  try {
    localStorage.setItem(SEQ_KEY, JSON.stringify(memorySeq));
  } catch {}
  return seq;
}

const isClick = (e: eventWithTime) => {
  const data = e.data as { source?: number; type?: number };
  return e.type === 3 && data.source === 2 && data.type === 2;
};

function report(sid: string, seq: number, events: eventWithTime[], bytes: number) {
  capture("$replay_chunk", {
    $session_id: sid,
    seq,
    events: events.length,
    bytes,
    first_timestamp: events[0].timestamp,
    last_timestamp: events[events.length - 1].timestamp,
    clicks: events.filter(isClick).length,
  });
}

const document_ = (sid: string, seq: number, events: eventWithTime[]) =>
  JSON.stringify({ session_id: sid, seq, distinct_id: distinctId, events });

async function gzipOrPlain(text: string): Promise<ArrayBuffer | string> {
  if (typeof CompressionStream !== "function") return text;
  try {
    const stream = new Blob([text]).stream().pipeThrough(new CompressionStream("gzip"));
    return await new Response(stream).arrayBuffer();
  } catch {
    return text;
  }
}

async function upload(sid: string, events: eventWithTime[]): Promise<void> {
  if (!events.length) return;
  const seq = nextSeq(sid);
  const text = document_(sid, seq, events);
  const body = await gzipOrPlain(text);
  const compress = typeof body !== "string";
  const bytes = typeof body === "string" ? body.length : body.byteLength;
  if (bytes > MAX_CHUNK) {
    if (events.length === 1) return;
    const half = Math.ceil(events.length / 2);
    await upload(sid, events.slice(0, half));
    await upload(sid, events.slice(half));
    return;
  }
  report(sid, seq, events, bytes);
  await fetch(`${REPLAY_PATH}/${sid}/${seq}.json${compress ? ".gz" : ""}`, {
    method: "POST",
    body,
    headers: { "Content-Type": "application/octet-stream" },
    keepalive: bytes < MAX_BEACON,
    credentials: "omit",
  }).catch(() => {});
}

function beacon(sid: string, events: eventWithTime[]) {
  let piece: eventWithTime[] = [];
  let size = 200;
  const send = () => {
    if (!piece.length) return;
    const seq = nextSeq(sid);
    const text = document_(sid, seq, piece);
    report(sid, seq, piece, text.length);
    const url = `${REPLAY_PATH}/${sid}/${seq}.json`;
    const blob = new Blob([text], { type: "application/octet-stream" });
    if (!navigator.sendBeacon?.(url, blob))
      fetch(url, { method: "POST", body: blob, keepalive: true, credentials: "omit" }).catch(() => {});
    piece = [];
    size = 200;
  };
  for (const e of events) {
    const n = JSON.stringify(e).length + 1;
    if (n > MAX_BEACON) {
      send();
      void upload(sid, [e]);
      continue;
    }
    if (size + n > MAX_BEACON) send();
    piece.push(e);
    size += n;
  }
  send();
}

export function record() {
  let sid = sessionId();
  let buffer: eventWithTime[] = [];
  const ready = () => Date.now() - sessionStart() >= REPLAY_MIN_SESSION_MS;

  const take = () => {
    const events = buffer;
    buffer = [];
    return events;
  };

  let stop: (() => void) | undefined;
  const start = () => {
    stop = rrweb({
      emit: (e) => void buffer.push(e as eventWithTime),
      maskAllInputs: true,
      maskTextSelector: PRIVATE_SELECTOR,
      blockSelector: BLOCK_SELECTOR,
      recordCanvas: false,
      collectFonts: false,
      inlineImages: false,
      recordCrossOriginIframes: false,
      sampling: { scroll: 150, input: "last" },
      slimDOMOptions: {
        script: true,
        comment: true,
        headFavicon: true,
        headWhitespace: true,
        headMetaDescKeywords: true,
        headMetaSocial: true,
        headMetaRobots: true,
        headMetaHttpEquiv: true,
        headMetaAuthorship: true,
        headMetaVerification: true,
      },
    });
  };
  start();

  const tick = () => {
    if (buffer.length && ready()) void upload(sid, take());
  };
  setInterval(tick, REPLAY_CHUNK_MS);
  const wait = REPLAY_MIN_SESSION_MS - (Date.now() - sessionStart());
  if (wait > 0) setTimeout(tick, wait + 50);
  else tick();

  onHide(() => {
    if (buffer.length && ready()) beacon(sid, take());
  });

  onSessionChange((next, previous) => {
    const events = take();
    if (events.length) void upload(previous, events);
    sid = next;
    if (!sampled(next)) {
      stop?.();
      stop = undefined;
      return;
    }
    if (stop) rrweb.takeFullSnapshot(true);
    else start();
  });
}
