// Copyright 2026 Oxy. Apache-2.0.

import type { translation as nativeTranslation } from "@astro-browser-real/shell";
import {
  type Attachment,
  buildCatalog,
  catalogLanguages,
  type LanguagePair,
  MODELS_COLLECTION,
  route,
  routeKey,
  WASM_COLLECTION,
  wasmAttachment,
} from "../translate/models";
import type { WorkerModel, WorkerReply, WorkerRequest } from "../translate/protocol";
import { loadCr } from "./engine";

type Translation = NonNullable<typeof nativeTranslation>;
type Status = Awaited<ReturnType<Translation["status"]>>;
type Pending = { resolve(reply: WorkerReply): void; reject(error: Error): void };
type Live = {
  key: string;
  worker: Worker | null;
  ready: Promise<void>;
  pending: Map<number, Pending>;
  idle?: ReturnType<typeof setTimeout>;
  used: number;
  gone: boolean;
};

const MAX_WORKERS = 2;
const IDLE_MS = 5 * 60_000;
const ALIASES: Record<string, string> = { iw: "he", in: "id", ji: "yi", jw: "jv", no: "nb", fil: "tl" };
const SCRIPTS: [RegExp, string, number][] = [
  [/[぀-ヿ]/gu, "ja", 0.1],
  [/[가-힯ᄀ-ᇿ]/gu, "ko", 0.5],
  [/[฀-๿]/gu, "th", 0.5],
  [/[Ͱ-Ͽ]/gu, "el", 0.5],
  [/[֐-׿]/gu, "he", 0.5],
];

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

export function modelLanguage(id: string): string {
  const [first = "", second] = id.split(/[-_]/);
  const language = first.toLowerCase();
  if (language === "zh") return second && /^(hant|tw|hk|mo)$/i.test(second) ? "zh-Hant" : "zh-Hans";
  return ALIASES[language] ?? language;
}

async function engine<T extends object>(method: string, args: object = {}): Promise<T> {
  const reply = await (await loadCr()).sendWithPromise<(T & { error?: unknown }) | null>("astroTranslate", method, args);
  if (!reply || typeof reply !== "object") throw new Error("the engine can't translate");
  if (typeof reply.error === "string") throw new Error(reply.error);
  return reply;
}

function once<T>(load: () => Promise<T>): () => Promise<T> {
  let pending: Promise<T> | null = null;
  return () =>
    (pending ??= load().catch((error: unknown) => {
      pending = null;
      throw error;
    }));
}

async function records(collection: string): Promise<unknown[]> {
  const { records: json } = await engine<{ records: string }>("records", { collection });
  const parsed: unknown = JSON.parse(json);
  const data = parsed && typeof parsed === "object" ? (parsed as { data?: unknown }).data : null;
  return Array.isArray(data) ? data : [];
}

const catalog = once(async () => buildCatalog(await records(MODELS_COLLECTION)));
const wasm = once(async () => {
  const attachment = wasmAttachment(await records(WASM_COLLECTION));
  if (!attachment) throw new Error("the translator isn't available");
  return attachment;
});

async function present(attachments: Attachment[]): Promise<boolean> {
  const { present: names } = await engine<{ present: string[] }>("present", { names: attachments.map((a) => a.plainSha256) });
  return attachments.every((a) => names.includes(a.plainSha256));
}

async function download({ location, sha256, size, plainSha256, plainSize }: Attachment): Promise<string> {
  const { file } = await engine<{ file: string }>("fetch", { location, sha256, size, plainSha256, plainSize });
  return new URL(file, document.baseURI).href;
}

async function chainFor(source: string, target: string): Promise<LanguagePair[] | null> {
  return route(await catalog(), modelLanguage(source), modelLanguage(target));
}

async function requireChain(source: string, target: string): Promise<LanguagePair[]> {
  const chain = await chainFor(source, target);
  if (!chain) throw new Error(`${languageName(source)} to ${languageName(target)} isn't available`);
  return chain;
}

const bytes = (url: string) =>
  new Promise<ArrayBuffer>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("GET", url);
    request.responseType = "arraybuffer";
    request.onload = () => (request.status === 200 ? resolve(request.response as ArrayBuffer) : reject(new Error("a language file is missing")));
    request.onerror = () => reject(new Error("a language file is missing"));
    request.send();
  });

async function workerModel(pair: LanguagePair): Promise<WorkerModel> {
  const files = await Promise.all(pair.files.map(async (file) => [file.type, await bytes(await download(file))] as const));
  return { source: pair.source, target: pair.target, modelName: pair.modelName, files: Object.fromEntries(files) };
}

const live = new Map<string, Live>();
let nextRequest = 0;

function retire(entry: Live, reason: string) {
  entry.gone = true;
  if (live.get(entry.key) === entry) live.delete(entry.key);
  clearTimeout(entry.idle);
  entry.worker?.terminate();
  for (const pending of entry.pending.values()) pending.reject(new Error(reason));
  entry.pending.clear();
}

function evict() {
  const idle = [...live.values()].filter((entry) => !entry.pending.size).sort((a, b) => a.used - b.used);
  for (const entry of idle) {
    if (live.size <= MAX_WORKERS) return;
    retire(entry, "the translator was closed");
  }
}

async function boot(entry: Live, chain: LanguagePair[]): Promise<void> {
  const [wasmBytes, models] = await Promise.all([wasm().then(download).then(bytes), Promise.all(chain.map(workerModel))]);
  if (entry.gone) throw new Error("the translator was closed");
  const worker = new Worker(new URL("../translate/worker.ts", import.meta.url), { name: "astro-translate" });
  entry.worker = worker;
  await new Promise<void>((resolve, reject) => {
    worker.onmessage = ({ data }: MessageEvent<WorkerReply>) => {
      if (data.type === "ready") return resolve();
      if (data.type === "failed") return reject(new Error(data.message));
      const pending = entry.pending.get(data.id);
      if (!pending) return;
      entry.pending.delete(data.id);
      pending.resolve(data);
    };
    worker.onerror = (event) => {
      event.preventDefault();
      const reason = event.message || "the translator stopped";
      reject(new Error(reason));
      retire(entry, reason);
    };
    const glue = new URL("bergamot/bergamot-translator.js", document.baseURI).href;
    const transfer = [wasmBytes, ...models.flatMap((model) => Object.values(model.files))];
    worker.postMessage({ type: "init", glue, wasm: wasmBytes, models } satisfies WorkerRequest, transfer);
  });
}

function workerFor(chain: LanguagePair[]): Live {
  const key = routeKey(chain);
  const existing = live.get(key);
  if (existing) return existing;
  const entry: Live = { key, worker: null, ready: Promise.resolve(), pending: new Map(), used: Date.now(), gone: false };
  entry.ready = boot(entry, chain);
  entry.ready.catch((error: unknown) => retire(entry, messageOf(error)));
  live.set(key, entry);
  evict();
  return entry;
}

async function ask(chain: LanguagePair[], message: (id: number) => WorkerRequest): Promise<WorkerReply> {
  const entry = workerFor(chain);
  entry.used = Date.now();
  clearTimeout(entry.idle);
  try {
    await entry.ready;
    const worker = entry.worker;
    if (!worker || entry.gone) throw new Error("the translator was closed");
    const id = ++nextRequest;
    return await new Promise<WorkerReply>((resolve, reject) => {
      entry.pending.set(id, { resolve, reject });
      worker.postMessage(message(id));
    });
  } finally {
    if (!entry.gone && !entry.pending.size) entry.idle = setTimeout(() => retire(entry, "the translator was idle"), IDLE_MS);
  }
}

function detectByScript(text: string): string | null {
  const letters = text.match(/\p{L}/gu)?.length ?? 0;
  if (letters < 20) return null;
  for (const [pattern, language, share] of SCRIPTS) {
    if ((text.match(pattern)?.length ?? 0) / letters >= share) return language;
  }
  return null;
}

let displayNames: Intl.DisplayNames | null = null;

export function languageName(identifier: string): string {
  try {
    displayNames ??= new Intl.DisplayNames([...navigator.languages], { type: "language" });
    return displayNames.of(identifier) ?? identifier;
  } catch {
    return identifier;
  }
}

export const translation: Translation = {
  userLanguages: () => (navigator.languages.length ? [...navigator.languages] : [navigator.language || "en"]),
  languageName,
  async detect(text) {
    try {
      const { language, reliable } = await engine<{ language?: string; reliable?: boolean }>("detect", { text });
      return language && reliable ? modelLanguage(language) : null;
    } catch {
      return detectByScript(text);
    }
  },
  async status(source, target): Promise<Status> {
    try {
      const chain = await chainFor(source, target);
      if (!chain) return "unsupported";
      return (await present([await wasm(), ...chain.flatMap((pair) => pair.files)])) ? "installed" : "supported";
    } catch {
      return "unsupported";
    }
  },
  async supportedLanguages() {
    try {
      return catalogLanguages(await catalog());
    } catch {
      return [];
    }
  },
  async prepare(source, target) {
    const chain = await requireChain(source, target);
    await Promise.all([wasm().then(download), ...chain.flatMap((pair) => pair.files).map(download)]);
  },
  async translate(source, target, texts) {
    if (!texts.length) return [];
    const reply = await ask(await requireChain(source, target), (id) => ({ type: "translate", id, texts }));
    if (reply.type === "error") throw new Error(reply.message);
    if (reply.type !== "result") throw new Error("the translator gave no answer");
    return texts.map((text, i) => reply.texts[i] ?? text);
  },
  async translateBlocks(source, target, blocks) {
    if (!blocks.length) return [];
    try {
      const reply = await ask(await requireChain(source, target), (id) => ({ type: "blocks", id, blocks }));
      if (reply.type === "blocks") return blocks.map((_, i) => reply.blocks[i] ?? null);
    } catch {}
    return blocks.map(() => null);
  },
};
