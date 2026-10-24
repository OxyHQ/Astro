// Copyright 2026 Oxy. Apache-2.0.

import type { ModelFileType } from "./bergamot";

export const PIVOT = "en";
export const MODELS_COLLECTION = "translations-models-v2";
export const WASM_COLLECTION = "translations-wasm-v2";
export const BERGAMOT_WASM_SHA256 = "f38ef807636a7c994afedaab7ff8ffe0d590d21897f05139f747b80fd7bbe926";
const MODEL_MAJOR = 3;
const WASM_MAJOR = 4;
const FILE_TYPES: readonly ModelFileType[] = ["model", "lex", "vocab", "srcvocab", "trgvocab"];
const USABLE_FILTERS = new Set(["", "env.appinfo.OS != 'Android'"]);

export type Attachment = { location: string; sha256: string; size: number; plainSha256: string; plainSize: number };
export type ModelFile = Attachment & { type: ModelFileType; name: string };
export type LanguagePair = { source: string; target: string; version: string; modelName: string; files: ModelFile[] };
export type Catalog = Map<string, LanguagePair>;

type RemoteRecord = {
  name?: unknown;
  version?: unknown;
  fileType?: unknown;
  sourceLanguage?: unknown;
  targetLanguage?: unknown;
  filter_expression?: unknown;
  decompressedHash?: unknown;
  decompressedSize?: unknown;
  attachment?: { location?: unknown; hash?: unknown; size?: unknown } | null;
};

const HASH = /^[0-9a-f]{64}$/;
const LOCATION = /^[\w./-]{1,512}$/;

type VersionPart = [number, string, number];

function versionParts(version: string): VersionPart[] {
  return version.split(".").map((part) => {
    const [, major = "", letters = "", minor = ""] = /^(\d*)([a-z]*)(\d*)/i.exec(part) ?? [];
    return [Number(major) || 0, letters, Number(minor) || 0];
  });
}

export function compareVersions(a: string, b: string): number {
  const left = versionParts(a);
  const right = versionParts(b);
  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    const [aNumber, aLetters, aMinor] = left[i] ?? [0, "", 0];
    const [bNumber, bLetters, bMinor] = right[i] ?? [0, "", 0];
    if (aNumber !== bNumber) return aNumber - bNumber;
    if (aLetters !== bLetters) {
      if (!aLetters) return 1;
      if (!bLetters) return -1;
      return aLetters < bLetters ? -1 : 1;
    }
    if (aMinor !== bMinor) return aMinor - bMinor;
  }
  return 0;
}

const inMajor = (version: string, major: number) =>
  compareVersions(version, `${major}.0a`) >= 0 && compareVersions(version, `${major + 1}.0a`) < 0;

function attachmentOf(record: RemoteRecord): Attachment | null {
  const attachment = record.attachment;
  if (!attachment || typeof attachment.location !== "string" || !LOCATION.test(attachment.location) || attachment.location.includes("..")) return null;
  if (typeof attachment.hash !== "string" || !HASH.test(attachment.hash) || typeof attachment.size !== "number") return null;
  const plainSha256 = typeof record.decompressedHash === "string" && HASH.test(record.decompressedHash) ? record.decompressedHash : "";
  const plainSize = typeof record.decompressedSize === "number" ? record.decompressedSize : 0;
  if (!plainSha256 || !plainSize) return null;
  return { location: attachment.location, sha256: attachment.hash, size: attachment.size, plainSha256, plainSize };
}

const pairKey = (source: string, target: string) => `${source}>${target}`;

export function buildCatalog(records: unknown[]): Catalog {
  const best = new Map<string, { record: RemoteRecord; file: ModelFile; version: string; source: string; target: string }[]>();
  for (const value of records) {
    if (!value || typeof value !== "object") continue;
    const record = value as RemoteRecord;
    const { name, version, fileType, sourceLanguage: source, targetLanguage: target } = record;
    if (typeof name !== "string" || typeof version !== "string" || typeof source !== "string" || typeof target !== "string") continue;
    if (!FILE_TYPES.includes(fileType as ModelFileType) || !inMajor(version, MODEL_MAJOR)) continue;
    if (!USABLE_FILTERS.has(typeof record.filter_expression === "string" ? record.filter_expression.trim() : "")) continue;
    const attachment = attachmentOf(record);
    if (!attachment) continue;
    const key = pairKey(source, target);
    const list = best.get(key) ?? [];
    list.push({ record, file: { ...attachment, type: fileType as ModelFileType, name }, version, source, target });
    best.set(key, list);
  }
  const catalog: Catalog = new Map();
  for (const [key, candidates] of best) {
    const models = candidates.filter((c) => c.file.type === "model").sort((a, b) => compareVersions(b.version, a.version));
    const model = models[0];
    if (!model) continue;
    const files = new Map<ModelFileType, ModelFile>();
    for (const candidate of candidates) {
      if (candidate.version === model.version && !files.has(candidate.file.type)) files.set(candidate.file.type, candidate.file);
    }
    const hasVocab = files.has("vocab") || (files.has("srcvocab") && files.has("trgvocab"));
    if (!hasVocab) continue;
    if (files.has("vocab")) {
      files.delete("srcvocab");
      files.delete("trgvocab");
    }
    catalog.set(key, { source: model.source, target: model.target, version: model.version, modelName: model.file.name, files: [...files.values()] });
  }
  return catalog;
}

export function route(catalog: Catalog, source: string, target: string): LanguagePair[] | null {
  if (source === target) return null;
  const direct = catalog.get(pairKey(source, target));
  if (direct) return [direct];
  if (source === PIVOT || target === PIVOT) return null;
  const first = catalog.get(pairKey(source, PIVOT));
  const second = catalog.get(pairKey(PIVOT, target));
  return first && second ? [first, second] : null;
}

export function catalogLanguages(catalog: Catalog): string[] {
  const languages = new Set<string>();
  for (const pair of catalog.values()) {
    languages.add(pair.source);
    languages.add(pair.target);
  }
  return [...languages];
}

export function wasmAttachment(records: unknown[]): Attachment | null {
  let chosen: { version: string; attachment: Attachment } | null = null;
  for (const value of records) {
    if (!value || typeof value !== "object") continue;
    const record = value as RemoteRecord;
    if (record.name !== "bergamot-translator" || typeof record.version !== "string" || !inMajor(record.version, WASM_MAJOR)) continue;
    const attachment = attachmentOf(record);
    if (!attachment || attachment.plainSha256 !== BERGAMOT_WASM_SHA256) continue;
    if (!chosen || compareVersions(record.version, chosen.version) > 0) chosen = { version: record.version, attachment };
  }
  return chosen?.attachment ?? null;
}

export const routeKey = (chain: LanguagePair[]) => chain.map((pair) => `${pair.source}>${pair.target}@${pair.version}`).join("|");
