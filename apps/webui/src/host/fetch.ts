import { isAccountOrigin } from "./oxyEndpoints";

type Cr = { sendWithPromise<T>(method: string, ...args: unknown[]): Promise<T> };

declare const chrome: { send(method: string, args?: unknown[]): void };
type Fetched = { status: number; headers: [string, string][]; body: string | null } | { error: string };

const CR = "chrome://resources/js/cr.js";
let cr: Promise<Cr> | null = null;
const loadCr = () => (cr ??= import(/* @vite-ignore */ CR) as Promise<Cr>);

const external = (url: URL) => url.protocol === "https:" || url.protocol === "http:";

const BASE64_CHUNK = 0x8000;

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let at = 0; at < bytes.length; at += BASE64_CHUNK) binary += String.fromCharCode(...bytes.subarray(at, at + BASE64_CHUNK));
  return btoa(binary);
}

const bodyBase64 = async (request: Request) => bytesToBase64(new Uint8Array(await request.arrayBuffer()));

export function installEngineFetch() {
  const pageFetch = globalThis.fetch.bind(globalThis);
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init);
    const url = new URL(request.url);
    if (!external(url)) return pageFetch(input, init);
    if (request.signal.aborted) throw new DOMException("Aborted", "AbortError");
    const headers = Object.fromEntries(request.headers.entries());
    const account = isAccountOrigin(url);
    const sendsBody = account ? request.method !== "GET" && request.method !== "HEAD" : request.method === "POST";
    const body = sendsBody ? await bodyBase64(request) : null;
    const fetched = (await loadCr()).sendWithPromise<Fetched>(account ? "astroAccountFetch" : "astroFetch", url.href, request.method, headers, body);
    const aborted = new Promise<never>((_, reject) =>
      request.signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true }),
    );
    const result = await Promise.race([fetched, aborted]);
    if ("error" in result) throw new TypeError(`Failed to fetch ${url.href}: ${result.error}`);
    const nullBody = request.method === "HEAD" || result.status === 204 || result.status === 304;
    const bytes = result.body === null ? null : Uint8Array.from(atob(result.body), (c) => c.charCodeAt(0));
    return new Response(nullBody ? null : bytes, { status: result.status, headers: result.headers });
  };
}

type StreamStart = { status: number; headers: [string, string][] } | { error: string };
type StreamEvent = { data: string } | { done: true } | { error: string };
type StreamSink = (event: StreamEvent) => void;

const streams = new Map<number, StreamSink>();
let nextStream = 0;
let listening: Promise<void> | null = null;

const listen = () =>
  (listening ??= loadCr().then((bridge) => {
    const add = (bridge as unknown as { addWebUiListener(event: string, listener: (id: number, event: StreamEvent) => void): unknown }).addWebUiListener;
    add("astro-account-stream", (id, event) => streams.get(id)?.(event));
  }));

const decode = (base64: string) => Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));

export async function engineStreamFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const request = new Request(input, init);
  const url = new URL(request.url);
  if (!isAccountOrigin(url)) return globalThis.fetch(input, init);
  if (request.signal.aborted) throw new DOMException("Aborted", "AbortError");
  await listen();
  const bridge = await loadCr();
  const id = ++nextStream;
  const headers = Object.fromEntries(request.headers.entries());
  const body = request.method === "GET" || request.method === "HEAD" ? null : await bodyBase64(request);
  let controller: ReadableStreamDefaultController<Uint8Array> | null = null;
  const early: StreamEvent[] = [];
  const finish = () => {
    streams.delete(id);
    request.signal.removeEventListener("abort", abort);
  };
  const deliver = (event: StreamEvent) => {
    if (!controller) return void early.push(event);
    if ("data" in event) controller.enqueue(decode(event.data));
    else {
      finish();
      if ("done" in event) controller.close();
      else controller.error(new TypeError(`Failed to fetch ${url.href}: ${event.error}`));
    }
  };
  const abort = () => {
    finish();
    chrome.send("astroAccountStreamCancel", [id]);
    controller?.error(new DOMException("Aborted", "AbortError"));
  };
  streams.set(id, deliver);
  request.signal.addEventListener("abort", abort, { once: true });
  const started = bridge.sendWithPromise<StreamStart>("astroAccountStream", id, url.href, request.method, headers, body);
  const aborted = new Promise<never>((_, reject) =>
    request.signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true }),
  );
  const head = await Promise.race([started, aborted]);
  if ("error" in head) {
    finish();
    throw new TypeError(`Failed to fetch ${url.href}: ${head.error}`);
  }
  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c;
      for (const event of early.splice(0)) deliver(event);
    },
    cancel() {
      if (!streams.has(id)) return;
      finish();
      chrome.send("astroAccountStreamCancel", [id]);
    },
  });
  const nullBody = request.method === "HEAD" || head.status === 204 || head.status === 304;
  return new Response(nullBody ? null : stream, { status: head.status, headers: head.headers });
}
