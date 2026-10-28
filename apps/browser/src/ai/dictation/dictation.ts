import { create } from "zustand";
import { useOxySession } from "../../oxy/session";
import { aliaTranscriber, DICTATION_ERROR_MESSAGES, DictationFailure, type DictationErrorCode, type Transcriber } from "./alia";
import { encodeWav, Upsampler } from "./audio";
import { SpeechSegmenter, type SegmenterOptions, type SpeechSegment } from "./segmenter";
import { StreamTranscript, streamFailureCode, type DictationStreamHandle, type Streamer, type StreamEvent } from "./stream";
import { dictationLanguage, joinTranscript } from "./transcript";

export type DictationPhase = "idle" | "starting" | "listening" | "finishing";
export type DictationMode = "hold" | "toggle";
export type DictationSink = { apply(text: string): void; restore(): void };
export type DictationError = { key: string; code: DictationErrorCode; message: string; at: number };
export type DictationCall = { at: number; audioMs: number; bytes: number; ms: number; ok: boolean; code?: DictationErrorCode; text?: string };

type DictationState = {
  key: string | null;
  phase: DictationPhase;
  mode: DictationMode;
  startedAt: number;
  firstTextAt: number;
  levels: number[];
  pending: number;
  text: string;
  error: DictationError | null;
  capture: boolean;
  transcriber: boolean;
  streamer: boolean;
  testEndpoint: string | null;
  calls: DictationCall[];
};

export const MAX_DICTATION_MS = 5 * 60_000;
export const HOLD_MS = 400;
const PAUSE_CUTS_PER_MINUTE = 8;
const SHOWN_LEVELS = 48;
const KEPT_CALLS = 50;

export const useDictation = create<DictationState>()(() => ({
  key: null,
  phase: "idle",
  mode: "toggle",
  startedAt: 0,
  firstTextAt: 0,
  levels: [],
  pending: 0,
  text: "",
  error: null,
  capture: false,
  transcriber: false,
  streamer: false,
  testEndpoint: null,
  calls: [],
}));

export type DictationCaptureHandle = { close(): void };
export type DictationCapture = { open(onAudio: (samples: Float32Array) => void): Promise<DictationCaptureHandle> };

export class DictationCaptureError extends Error {
  readonly code: "mic-denied" | "mic-unavailable";

  constructor(code: "mic-denied" | "mic-unavailable") {
    super(DICTATION_ERROR_MESSAGES[code]);
    this.name = "DictationCaptureError";
    this.code = code;
  }
}

const captures: DictationCapture[] = [];
const transcribers: Transcriber[] = [];
const streamers: Streamer[] = [];
let testTranscriber: Transcriber | null = null;
let segmenterOptions: Partial<SegmenterOptions> = {};

function enlist<T>(list: T[], item: T, flag: "capture" | "transcriber" | "streamer"): () => void {
  list.push(item);
  useDictation.setState({ [flag]: true });
  return () => {
    const at = list.indexOf(item);
    if (at >= 0) list.splice(at, 1);
    useDictation.setState({ [flag]: list.length > 0 });
  };
}

export const registerDictationCapture = (capture: DictationCapture) => enlist(captures, capture, "capture");
export const registerDictationTranscriber = (transcriber: Transcriber) => enlist(transcribers, transcriber, "transcriber");
export const registerDictationStreamer = (streamer: Streamer) => enlist(streamers, streamer, "streamer");

export function setDictationTestEndpoint(url: string | null, bearer = "", options: Partial<SegmenterOptions> = {}): boolean {
  if (url === null) {
    testTranscriber = null;
    segmenterOptions = {};
    useDictation.setState({ testEndpoint: null });
    return true;
  }
  if (!/^(localhost|127\.0\.0\.1|\[::1\])$/.test(new URL(url).hostname) || !bearer) return false;
  testTranscriber = aliaTranscriber(url.replace(/\/$/, ""), { token: bearer });
  segmenterOptions = options;
  useDictation.setState({ testEndpoint: url, calls: [] });
  return true;
}

const signedIn = () => !!useOxySession.getState().account;
const currentTranscriber = (): Transcriber | null => testTranscriber ?? (signedIn() ? (transcribers.at(-1) ?? null) : null);
const currentStreamer = (): Streamer | null => (testTranscriber || !signedIn() ? null : (streamers.at(-1) ?? null));

export const dictationAvailable = (): boolean => captures.length > 0;

export const useDictationAvailable = (): boolean => useDictation((s) => s.capture);

export function useDictationReady(): boolean {
  const wired = useDictation((s) => s.capture && (s.transcriber || s.testEndpoint !== null));
  const test = useDictation((s) => s.testEndpoint !== null);
  const account = useOxySession((s) => !!s.account);
  return wired && (test || account);
}

export const useDictationPhase = (key: string): DictationPhase => useDictation((s) => (s.key === key ? s.phase : "idle"));

export const useDictationError = (key: string): DictationError | null => useDictation((s) => (s.error?.key === key ? s.error : null));

type StreamMode = "opening" | "live" | "off";

type Session = {
  key: string;
  sink: DictationSink;
  mode: StreamMode;
  stream: DictationStreamHandle | null;
  streamAbort: AbortController;
  streamEnded: boolean;
  held: SpeechSegment[];
  transcript: StreamTranscript;
  upsampler: Upsampler;
  segmenter: SpeechSegmenter;
  transcriber: Transcriber;
  language: string;
  handle: DictationCaptureHandle | null;
  parts: (string | null)[];
  shown: string;
  controllers: Set<AbortController>;
  cuts: number[];
  closed: boolean;
  cancelled: boolean;
  limit: ReturnType<typeof setTimeout> | null;
  done: (() => void)[];
};

let session: Session | null = null;

function fail(key: string, code: DictationErrorCode) {
  useDictation.setState({ key: null, phase: "idle", levels: [], pending: 0, error: { key, code, message: DICTATION_ERROR_MESSAGES[code], at: Date.now() } });
}

export function clearDictationError(key: string) {
  if (useDictation.getState().error?.key === key) useDictation.setState({ error: null });
}

export async function beginDictation(key: string, sink: DictationSink, mode: DictationMode = "toggle"): Promise<void> {
  if (session) {
    if (session.key === key) return;
    cancelDictation();
  }
  const capture = captures.at(-1);
  const transcriber = currentTranscriber();
  if (!capture || !transcriber) return fail(key, signedIn() || testTranscriber ? "unavailable" : "not-signed-in");
  const streamer = currentStreamer();
  const s: Session = {
    key,
    sink,
    mode: streamer ? "opening" : "off",
    stream: null,
    streamAbort: new AbortController(),
    streamEnded: false,
    held: [],
    transcript: new StreamTranscript(),
    upsampler: new Upsampler(),
    segmenter: new SpeechSegmenter(segmenterOptions),
    transcriber,
    language: dictationLanguage(),
    handle: null,
    parts: [],
    shown: "",
    controllers: new Set(),
    cuts: [],
    closed: false,
    cancelled: false,
    limit: null,
    done: [],
  };
  session = s;
  useDictation.setState({ key, phase: "starting", mode, startedAt: 0, firstTextAt: 0, levels: [], pending: 0, text: "", error: null });
  if (streamer) openStream(s, streamer);
  let handle: DictationCaptureHandle;
  try {
    handle = await capture.open((samples) => hear(s, samples));
  } catch (error) {
    if (session !== s) return;
    session = null;
    settle(s);
    return fail(key, error instanceof DictationCaptureError ? error.code : "mic-unavailable");
  }
  if (session !== s) return handle.close();
  s.handle = handle;
  s.limit = setTimeout(() => void endDictation(key), MAX_DICTATION_MS);
  useDictation.setState({ phase: "listening", startedAt: Date.now() });
}

export function setDictationMode(key: string, mode: DictationMode) {
  if (session?.key === key) useDictation.setState({ mode });
}

function openStream(s: Session, streamer: Streamer) {
  try {
    s.stream = streamer({ language: s.language, signal: s.streamAbort.signal, onEvent: (event) => onStreamEvent(s, event) });
  } catch {
    fallBack(s);
  }
}

function onStreamEvent(s: Session, event: StreamEvent) {
  if (session !== s || s.cancelled || s.mode === "off") return;
  switch (event.type) {
    case "dictation.ready":
      if (s.mode === "opening") {
        s.mode = "live";
        s.held = [];
      }
      return;
    case "transcript.interim":
    case "transcript.delta":
    case "transcript.final":
      if (s.transcript.apply(event)) show(s);
      return;
    case "error": {
      const code = streamFailureCode(event.code);
      if (s.mode === "opening" && code !== "not-signed-in") return fallBack(s);
      return stop(s, code);
    }
    case "dictation.closed":
      if (!s.closed && (event.reason === "max-duration" || event.reason === "idle-timeout")) void endDictation(s.key);
      return;
  }
}

function fallBack(s: Session) {
  s.mode = "off";
  closeStream(s);
  const held = s.held;
  s.held = [];
  for (const segment of held) send(s, segment);
  settleIfDone(s);
}

function closeStream(s: Session) {
  s.streamAbort.abort();
  s.stream?.close();
  s.stream = null;
}

function hear(s: Session, samples: Float32Array) {
  if (session !== s || s.closed) return;
  const { segments, levels } = s.segmenter.push(samples, () => mayCut(s));
  if (levels.length) useDictation.setState((state) => ({ levels: [...state.levels, ...levels].slice(-SHOWN_LEVELS) }));
  if (s.mode !== "off") s.stream?.append(s.upsampler.push(samples));
  route(s, segments);
}

function route(s: Session, segments: SpeechSegment[]) {
  if (s.mode === "opening") s.held.push(...segments);
  else if (s.mode === "off") for (const segment of segments) send(s, segment);
}

function mayCut(s: Session): boolean {
  const now = Date.now();
  s.cuts = s.cuts.filter((at) => now - at < 60_000);
  return s.cuts.length < PAUSE_CUTS_PER_MINUTE;
}

function send(s: Session, segment: SpeechSegment) {
  const index = s.parts.push(null) - 1;
  s.cuts.push(Date.now());
  const controller = new AbortController();
  s.controllers.add(controller);
  useDictation.setState((state) => ({ pending: state.pending + 1 }));
  const wav = encodeWav(segment.samples);
  const started = Date.now();
  const log = (call: Omit<DictationCall, "at" | "audioMs" | "bytes" | "ms">) =>
    useDictation.setState((state) => ({
      calls: [...state.calls, { at: started, audioMs: segment.durationMs, bytes: wav.length, ms: Date.now() - started, ...call }].slice(-KEPT_CALLS),
    }));
  s.transcriber({ wav, durationMs: segment.durationMs }, s.language, controller.signal)
    .then(
      (text) => {
        if (s.cancelled || controller.signal.aborted) return;
        log({ ok: true, text });
        s.parts[index] = text;
        show(s);
      },
      (error: unknown) => {
        if (s.cancelled || controller.signal.aborted) return;
        const code = error instanceof DictationFailure ? error.code : "failed";
        log({ ok: false, code });
        s.parts[index] = "";
        if (code === "rejected") return show(s);
        stop(s, code);
      },
    )
    .finally(() => {
      s.controllers.delete(controller);
      if (session === s) useDictation.setState((state) => ({ pending: Math.max(0, state.pending - 1) }));
      settleIfDone(s);
    });
}

function show(s: Session) {
  const ready: string[] = [];
  for (const part of s.parts) {
    if (part === null) break;
    ready.push(part);
  }
  const text = s.mode === "off" ? joinTranscript(ready) : s.transcript.text;
  if (text === s.shown) return;
  s.shown = text;
  s.sink.apply(text);
  const state = useDictation.getState();
  useDictation.setState({ text, firstTextAt: state.firstTextAt || (text ? Date.now() : 0) });
}

function close(s: Session) {
  if (s.limit) clearTimeout(s.limit);
  s.limit = null;
  s.handle?.close();
  s.handle = null;
}

function settle(s: Session) {
  for (const resolve of s.done.splice(0)) resolve();
}

function settleIfDone(s: Session) {
  if (!s.closed || s.controllers.size > 0 || (s.mode === "live" && !s.streamEnded)) return;
  if (session === s) {
    session = null;
    useDictation.setState({ key: null, phase: "idle", levels: [], pending: 0 });
  }
  settle(s);
}

function stop(s: Session, code: DictationErrorCode) {
  s.closed = true;
  close(s);
  closeStream(s);
  for (const controller of s.controllers) controller.abort();
  s.controllers.clear();
  for (let i = 0; i < s.parts.length; i++) if (s.parts[i] === null) s.parts[i] = "";
  show(s);
  if (session === s) session = null;
  fail(s.key, code);
  settle(s);
}

export function endDictation(key?: string): Promise<void> {
  const s = session;
  if (!s || (key !== undefined && s.key !== key)) return Promise.resolve();
  if (!s.handle && !s.closed) {
    cancelDictation(s.key);
    return Promise.resolve();
  }
  const finished = new Promise<void>((resolve) => s.done.push(resolve));
  if (!s.closed) {
    s.closed = true;
    close(s);
    const last = s.segmenter.flush();
    if (s.mode === "opening") {
      if (last) s.held.push(last);
      fallBack(s);
    } else if (s.mode === "off" && last) send(s, last);
    useDictation.setState({ phase: "finishing", levels: [] });
    if (s.mode === "live" && !s.stream) s.streamEnded = true;
    if (s.mode === "live" && s.stream) {
      void s.stream.end().finally(() => {
        s.streamEnded = true;
        if (!s.cancelled) show(s);
        settleIfDone(s);
      });
    }
  }
  settleIfDone(s);
  return finished;
}

export function cancelDictation(key?: string) {
  const s = session;
  if (!s || (key !== undefined && s.key !== key)) return;
  s.cancelled = true;
  s.closed = true;
  close(s);
  closeStream(s);
  for (const controller of s.controllers) controller.abort();
  s.controllers.clear();
  session = null;
  s.sink.restore();
  useDictation.setState({ key: null, phase: "idle", levels: [], pending: 0, text: "" });
  settle(s);
}

export const dictating = (key: string) => session?.key === key;

let press: { key: string; at: number; began: boolean } | null = null;

export function pressDictation(key: string, begin: (mode: DictationMode) => void) {
  if (session?.key === key) {
    press = { key, at: Date.now(), began: false };
    return;
  }
  press = { key, at: Date.now(), began: true };
  begin("hold");
}

export function releaseDictation(key: string) {
  const held = press;
  press = null;
  if (!held || held.key !== key || session?.key !== key) return;
  if (!held.began) {
    void endDictation(key);
    return;
  }
  if (Date.now() - held.at >= HOLD_MS) void endDictation(key);
  else setDictationMode(key, "toggle");
}

type DictationField = { element: () => unknown; begin: (mode: DictationMode) => void };
const fields = new Map<string, DictationField>();

export function registerDictationField(key: string, field: DictationField): () => void {
  fields.set(key, field);
  return () => {
    if (fields.get(key) === field) fields.delete(key);
    cancelDictation(key);
  };
}

export function dictationFieldAt(element: unknown): { key: string; begin: (mode: DictationMode) => void } | null {
  for (const [key, field] of fields) if (element && field.element() === element) return { key, begin: field.begin };
  return null;
}

export const dictationDebug = { state: useDictation, setTestEndpoint: setDictationTestEndpoint, end: endDictation, cancel: cancelDictation };
