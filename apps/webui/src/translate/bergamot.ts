// Copyright 2026 Oxy. Apache-2.0.

export type ModelFileType = "model" | "lex" | "vocab" | "srcvocab" | "trgvocab";
export type ModelFiles = Partial<Record<ModelFileType, ArrayBuffer>>;
export type LanguageModel = { source: string; target: string; files: ModelFiles; modelName: string };

type Deletable = { delete(): void };
type AlignedMemory = Deletable & { getByteArrayView(): Uint8Array; size(): number };
type Vector<T> = Deletable & { push_back(item: T): void; size(): number; get(index: number): unknown };
type Response = { getTranslatedText(): string };
type Responses = Deletable & { size(): number; get(index: number): Response };
type TranslationModel = Deletable;
type ResponseOptions = { qualityScores: boolean; alignment: boolean; html: boolean };
type BlockingService = Deletable & {
  translate(model: TranslationModel, messages: Vector<string>, options: Vector<ResponseOptions>): Responses;
  translateViaPivoting(first: TranslationModel, second: TranslationModel, messages: Vector<string>, options: Vector<ResponseOptions>): Responses;
};

export type Bergamot = {
  AlignedMemory: new (size: number, alignment: number) => AlignedMemory;
  AlignedMemoryList: new () => Vector<AlignedMemory>;
  TranslationModel: new (
    source: string,
    target: string,
    config: string,
    model: AlignedMemory,
    lex: AlignedMemory | null,
    vocabs: Vector<AlignedMemory>,
    quality: null,
  ) => TranslationModel;
  BlockingService: new (options: { cacheSize: number }) => BlockingService;
  VectorString: new () => Vector<string>;
  VectorResponseOptions: new () => Vector<ResponseOptions>;
};

export type BergamotModuleOptions = {
  wasmBinary: ArrayBuffer;
  INITIAL_MEMORY: number;
  print(...args: unknown[]): void;
  printErr(...args: unknown[]): void;
  onAbort(): void;
  onRuntimeInitialized(): void;
};

export type LoadBergamot = (options: BergamotModuleOptions) => Bergamot;

const services = new WeakMap<Bergamot, BlockingService>();
function serviceOf(bergamot: Bergamot): BlockingService {
  const existing = services.get(bergamot);
  if (existing) return existing;
  const service = new bergamot.BlockingService({ cacheSize: 0 });
  services.set(bergamot, service);
  return service;
}

const ALIGNMENT: Record<ModelFileType, number> = { model: 256, lex: 64, vocab: 64, srcvocab: 64, trgvocab: 64 };
const INITIAL_MEMORY = 41_943_040;

export function startBergamot(load: LoadBergamot, wasmBinary: ArrayBuffer): Promise<Bergamot> {
  return new Promise((resolve, reject) => {
    let instance: Bergamot | null = null;
    const settle = () => {
      if (instance) resolve(instance);
      else reject(new Error("the translator didn't load"));
    };
    instance = load({
      wasmBinary,
      INITIAL_MEMORY,
      print: () => {},
      printErr: () => {},
      onAbort: () => reject(new Error("the translator didn't load")),
      onRuntimeInitialized: () => void Promise.resolve().then(settle),
    });
  });
}

function configText(entries: Record<string, string>): string {
  const indent = "            ";
  return `\n${Object.entries(entries)
    .map(([key, value]) => `${indent}${key}: ${value}\n`)
    .join("")}${indent}`;
}

function modelConfig(modelName: string): string {
  return configText({
    "beam-size": "1",
    normalize: "1.0",
    "word-penalty": "0",
    "max-length-break": "128",
    "mini-batch-words": "1024",
    workspace: "128",
    "max-length-factor": "2.0",
    "skip-cost": "true",
    "cpu-threads": "0",
    quiet: "true",
    "quiet-translation": "true",
    "gemm-precision": modelName.endsWith("intgemm8.bin") ? "int8shiftAll" : "int8shiftAlphaAll",
    alignment: "soft",
  });
}

const FULL_WIDTH_QUOTE = /([。！？])“/g;
const FULL_WIDTH_LANGUAGES = new Set(["ja", "ko", "zh-Hans", "zh-Hant"]);
const EDGES = /^(\s*)([\s\S]*?)(\s*)$/;

function clean(source: string, text: string): { before: string; body: string; after: string } {
  const [, before = "", raw = "", after = ""] = EDGES.exec(text) ?? [];
  let body = raw.replaceAll("\u00AD", "");
  if (FULL_WIDTH_LANGUAGES.has(source)) body = body.replaceAll(FULL_WIDTH_QUOTE, "$1 “");
  return { before, body, after };
}

export class Translator {
  private readonly bergamot: Bergamot;
  private readonly service: BlockingService;
  private readonly first: TranslationModel;
  private readonly second: TranslationModel | null;
  private readonly source: string;

  constructor(bergamot: Bergamot, chain: LanguageModel[]) {
    const [first, second, ...rest] = chain;
    if (!first || rest.length) throw new Error("a translation takes one or two models");
    this.bergamot = bergamot;
    this.source = first.source;
    this.first = this.build(first);
    this.second = second ? this.build(second) : null;
    this.service = serviceOf(bergamot);
  }

  private build({ source, target, files, modelName }: LanguageModel): TranslationModel {
    const memory: Partial<Record<ModelFileType, AlignedMemory>> = {};
    for (const [type, buffer] of Object.entries(files) as [ModelFileType, ArrayBuffer][]) {
      const aligned = new this.bergamot.AlignedMemory(buffer.byteLength, ALIGNMENT[type]);
      aligned.getByteArrayView().set(new Uint8Array(buffer));
      memory[type] = aligned;
    }
    if (!memory.model) throw new Error("the language model is missing");
    const vocabs = new this.bergamot.AlignedMemoryList();
    if (memory.vocab) vocabs.push_back(memory.vocab);
    else if (memory.srcvocab && memory.trgvocab) {
      vocabs.push_back(memory.srcvocab);
      vocabs.push_back(memory.trgvocab);
    } else throw new Error("the language model has no vocabulary");
    return new this.bergamot.TranslationModel(source, target, modelConfig(modelName), memory.model, memory.lex ?? null, vocabs, null);
  }

  private run(texts: string[], html: boolean): string[] {
    const messages = new this.bergamot.VectorString();
    const options = new this.bergamot.VectorResponseOptions();
    let responses: Responses | null = null;
    try {
      for (const text of texts) {
        messages.push_back(text);
        options.push_back({ qualityScores: false, alignment: true, html });
      }
      responses = this.second
        ? this.service.translateViaPivoting(this.first, this.second, messages, options)
        : this.service.translate(this.first, messages, options);
      const out: string[] = [];
      for (let i = 0; i < responses.size(); i++) out.push(responses.get(i).getTranslatedText());
      return out;
    } finally {
      messages.delete();
      options.delete();
      responses?.delete();
    }
  }

  translate(texts: string[], html = false): (string | null)[] {
    const parts = texts.map((text) => {
      const part = clean(this.source, text);
      return { ...part, result: part.body ? null : part.before + part.after };
    });
    const pending = parts.filter((part) => part.body);
    if (!pending.length) return parts.map((part) => part.result);
    try {
      const translated = this.run(pending.map((part) => part.body), html);
      for (const [n, part] of pending.entries()) part.result = part.before + (translated[n] ?? "") + part.after;
    } catch {
      for (const part of pending) {
        try {
          part.result = part.before + (this.run([part.body], html)[0] ?? "") + part.after;
        } catch {}
      }
    }
    return parts.map((part) => part.result);
  }

  translateBlocks(blocks: string[][]): (string[] | null)[] {
    const marked = this.translate(blocks.map(markPieces), true);
    return blocks.map((pieces, i) => {
      const html = marked[i];
      return html == null ? null : splitPieces(html, pieces);
    });
  }

  dispose() {
    this.first.delete();
    this.second?.delete();
  }
}

const ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };
const escapeHtml = (text: string) => text.replace(/[&<>"]/g, (c) => ESCAPES[c] ?? c);
const NAMED: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

export function unescapeHtml(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, entity: string) => {
    if (entity[0] !== "#") return NAMED[entity.toLowerCase()] ?? whole;
    const code = entity[1] === "x" || entity[1] === "X" ? Number.parseInt(entity.slice(2), 16) : Number.parseInt(entity.slice(1), 10);
    return Number.isFinite(code) && code >= 0 && code <= 0x10ffff ? String.fromCodePoint(code) : whole;
  });
}

export function markPieces(pieces: string[]): string {
  return pieces.map((piece, i) => `<span id="p${i}">${escapeHtml(piece)}</span>`).join("");
}

const TOKEN = /<span id="p(\d+)">|<\/span>|<[^>]*>|[^<]+/g;

export function splitPieces(html: string, pieces: string[]): string[] {
  const parts = pieces.map(() => "");
  const order: number[] = [];
  const open: number[] = [];
  let last = 0;
  let whole = "";
  for (const [token, id] of html.matchAll(TOKEN)) {
    if (id !== undefined) {
      const index = Number(id);
      if (index >= pieces.length) continue;
      open.push(index);
      order.push(index);
      last = index;
    } else if (token === "</span>") open.pop();
    else if (token[0] !== "<") {
      const text = unescapeHtml(token);
      parts[open.at(-1) ?? last] += text;
      whole += text;
    }
  }
  const ordered = order.length > 0 && order.every((index, i) => i === 0 || (order[i - 1] ?? index) <= index);
  if (ordered) return parts;
  return distribute(whole, pieces);
}

export function distribute(text: string, pieces: string[]): string[] {
  const chars = Array.from(text);
  const total = Math.max(1, pieces.reduce((sum, piece) => sum + Array.from(piece).length, 0));
  const out: string[] = [];
  let start = 0;
  let seen = 0;
  pieces.forEach((piece, i) => {
    seen += Array.from(piece).length;
    let end = i === pieces.length - 1 ? chars.length : Math.min(chars.length, Math.round((seen / total) * chars.length));
    if (end < chars.length && end > start) {
      for (let offset = 0; offset <= 12; offset++) {
        const space = [end + offset, end - offset].find((at) => at > start && at < chars.length && chars[at] === " ");
        if (space !== undefined) {
          end = space + 1;
          break;
        }
      }
    }
    end = Math.max(start, end);
    out.push(chars.slice(start, end).join(""));
    start = end;
  });
  return out;
}
