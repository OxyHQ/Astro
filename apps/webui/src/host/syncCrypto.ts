import { syncWords } from "./syncWords";

type Bytes = Uint8Array<ArrayBuffer>;

const encoder = new TextEncoder();
const utf8 = (text: string): Bytes => encoder.encode(text) as Bytes;

const MAGIC = utf8("NNS1");
const SALT = utf8("netnyahoo-sync/v1");
const PADDING = 1024;
const NONCE_BYTES = 12;
const TAG_BYTES = 16;
const ENTROPY_BYTES = 32;
export const PHRASE_WORDS = 24;

const BASE32 = "abcdefghijklmnopqrstuvwxyz234567";

export const randomBytes = (count: number): Bytes => crypto.getRandomValues(new Uint8Array(count));

const concat = (...parts: Uint8Array[]): Bytes => {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
};

export function base32(data: Uint8Array): string {
  let out = "";
  let buffer = 0;
  let bits = 0;
  for (const byte of data) {
    buffer = (buffer << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32[(buffer >> (bits - 5)) & 31];
      bits -= 5;
    }
    buffer &= (1 << bits) - 1;
  }
  if (bits > 0) out += BASE32[(buffer << (5 - bits)) & 31];
  return out;
}

export const isTag = (name: string) => name.length === 26 && [...name].every((c) => BASE32.includes(c));

export function toBase64(data: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < data.length; i += 0x8000) binary += String.fromCharCode(...data.subarray(i, i + 0x8000));
  return btoa(binary);
}

export function fromBase64(text: string): Bytes | null {
  try {
    const binary = atob(text);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

export const newFileId = () => base32(randomBytes(16));

export const newEntropy = () => randomBytes(ENTROPY_BYTES);

const sha256 = async (data: Bytes) => new Uint8Array(await crypto.subtle.digest("SHA-256", data));

export type SyncKeys = {
  chainTag: string;
  scopeTag(scope: string): Promise<string>;
  seal(payload: Uint8Array, scopeTag: string, fileId: string): Promise<Bytes>;
  open(file: Uint8Array, scopeTag: string, fileId: string): Promise<Bytes>;
};

export async function deriveKeys(entropy: Uint8Array): Promise<SyncKeys> {
  const ikm = await crypto.subtle.importKey("raw", new Uint8Array(entropy), "HKDF", false, ["deriveBits"]);
  const derive = async (info: string) =>
    new Uint8Array(await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt: SALT, info: utf8(info) }, ikm, 256));
  const fileKey = await crypto.subtle.importKey("raw", await derive("file-key"), "AES-GCM", false, ["encrypt", "decrypt"]);
  const nameKey = await crypto.subtle.importKey("raw", await derive("name-key"), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const tag = async (label: string) => base32(new Uint8Array(await crypto.subtle.sign("HMAC", nameKey, utf8(label))).subarray(0, 16));
  const chainTag = await tag("chain");
  const scopeTags = new Map<string, Promise<string>>();
  const associatedData = (scope: string, file: string) => concat(MAGIC, utf8(`${chainTag}/${scope}/${file}`));
  return {
    chainTag,
    scopeTag(scope) {
      let cached = scopeTags.get(scope);
      if (!cached) scopeTags.set(scope, (cached = tag(`scope/${scope}`)));
      return cached;
    },
    async seal(payload, scopeTag, fileId) {
      const length = new Uint8Array(4);
      new DataView(length.buffer).setUint32(0, payload.length);
      const unpadded = 4 + payload.length;
      const plain = concat(length, payload, new Uint8Array((PADDING - (unpadded % PADDING)) % PADDING));
      const nonce = randomBytes(NONCE_BYTES);
      const box = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv: nonce, additionalData: associatedData(scopeTag, fileId), tagLength: TAG_BYTES * 8 },
        fileKey,
        plain,
      );
      return concat(MAGIC, nonce, new Uint8Array(box));
    },
    async open(file, scopeTag, fileId) {
      if (file.length < MAGIC.length + NONCE_BYTES + TAG_BYTES + 4 || MAGIC.some((byte, i) => file[i] !== byte)) throw new Error("format");
      const body = file.slice(MAGIC.length);
      let plain: Bytes;
      try {
        plain = new Uint8Array(
          await crypto.subtle.decrypt(
            { name: "AES-GCM", iv: body.slice(0, NONCE_BYTES), additionalData: associatedData(scopeTag, fileId), tagLength: TAG_BYTES * 8 },
            fileKey,
            body.slice(NONCE_BYTES),
          ),
        );
      } catch {
        throw new Error("authentication");
      }
      if (plain.length < 4) throw new Error("format");
      const length = new DataView(plain.buffer, plain.byteOffset, 4).getUint32(0);
      if (length > plain.length - 4) throw new Error("format");
      return plain.slice(4, 4 + length);
    },
  };
}

export async function phraseWords(entropy: Uint8Array): Promise<string[]> {
  if (entropy.length !== ENTROPY_BYTES) throw new Error("entropy must be 32 bytes");
  const checksum = (await sha256(new Uint8Array(entropy)))[0]!;
  const bits: number[] = [];
  for (const byte of [...entropy, checksum]) for (let shift = 7; shift >= 0; shift--) bits.push((byte >> shift) & 1);
  const words: string[] = [];
  for (let start = 0; start < bits.length; start += 11) {
    words.push(syncWords[bits.slice(start, start + 11).reduce((value, bit) => (value << 1) | bit, 0)]!);
  }
  return words;
}

export const phraseTokens = (text: string) => text.toLowerCase().split(/[^\p{Ll}]+/u).filter((token) => token.length > 0);

const wordIndex = new Map(syncWords.map((word, i) => [word, i]));
const prefixIndex = new Map(syncWords.map((word, i) => [word.slice(0, 4), i]));

function indexOf(token: string): number | null {
  const exact = wordIndex.get(token);
  if (exact !== undefined) return exact;
  if ([...token].length < 4) return null;
  const i = prefixIndex.get([...token].slice(0, 4).join(""));
  return i !== undefined && syncWords[i]!.startsWith(token) ? i : null;
}

export type PhraseProblem = { error: "wordCount"; count: number } | { error: "unknownWord"; word: string } | { error: "checksum" };

export async function phraseEntropy(text: string): Promise<{ entropy: Bytes } | PhraseProblem> {
  const tokens = phraseTokens(text);
  if (tokens.length !== PHRASE_WORDS) return { error: "wordCount", count: tokens.length };
  const bits: number[] = [];
  for (const token of tokens) {
    const i = indexOf(token);
    if (i === null) return { error: "unknownWord", word: token };
    for (let shift = 10; shift >= 0; shift--) bits.push((i >> shift) & 1);
  }
  const entropy = new Uint8Array(ENTROPY_BYTES);
  for (let byte = 0; byte < ENTROPY_BYTES; byte++) {
    entropy[byte] = bits.slice(byte * 8, byte * 8 + 8).reduce((value, bit) => (value << 1) | bit, 0);
  }
  const checksum = bits.slice(ENTROPY_BYTES * 8).reduce((value, bit) => (value << 1) | bit, 0);
  if ((await sha256(entropy))[0] !== checksum) return { error: "checksum" };
  return { entropy };
}
