import { provideNativeModule } from "../../../demo/src/shims/expo-modules-core";
import { loadCr, pickFiles } from "./engine";
import { systemServices } from "./system";
import {
  deriveKeys,
  fromBase64,
  newEntropy,
  newFileId,
  phraseEntropy,
  phraseWords,
  toBase64,
  type SyncKeys,
} from "./syncCrypto";

type FolderInfo = {
  path: string;
  defaultPath: string;
  iCloudAvailable: boolean;
  inICloud: boolean;
  exists: boolean;
  writable: boolean;
  hasSyncData: boolean;
};

type PhraseResult =
  | { ok: true }
  | { error: "wordCount"; count: number }
  | { error: "unknownWord"; word: string }
  | { error: "checksum" }
  | { error: "noData" }
  | { error: "mismatch" }
  | { error: "keychain" };

type Listing = {
  files: { id: string; payload: string }[];
  pending: string[];
  damaged: { id: string; age: number }[];
  present: string[];
};

type EngineFile = { id: string; data?: string; mtime?: number };

const LOCKED = "Sync isn't set up on this computer.";
const KIT_NAME = "Astro Recovery Kit.txt";
const KIT_INTRO = "If you don’t have access to the computer on which you first turned on sync, you can still get your synced data on another computer:";
const KIT_STEPS = ["Open Astro › Settings › Sync, and choose the same sync folder.", "Click Enter Recovery Phrase.", "Paste the 24 words below."];
const KIT_WARNING =
  "Keep this kit somewhere safe, like a password manager or a printed copy. Anyone with these words and your sync folder can read your synced data. Astro can’t recover the words for you: there’s no server and no other copy.";

const decoder = new TextDecoder();
const encoder = new TextEncoder();

async function syncCall<T>(method: string, args: Record<string, unknown> = {}): Promise<T> {
  const reply = await (await loadCr()).sendWithPromise<unknown>("astroSync", method, args);
  if (reply && typeof reply === "object" && !Array.isArray(reply) && typeof (reply as { error?: unknown }).error === "string") {
    throw new Error((reply as { error: string }).error);
  }
  return reply as T;
}

let entropy: Uint8Array | null = null;
let keys: Promise<SyncKeys> | null = null;

function setEntropy(value: Uint8Array | null) {
  entropy = value;
  keys = value ? deriveKeys(value) : null;
}

const requireKeys = () => {
  if (!keys) throw new Error(LOCKED);
  return keys;
};

const requireWords = () => {
  if (!entropy) throw new Error(LOCKED);
  return phraseWords(entropy);
};

let cachedDeviceName = "This computer";
void syncCall<string | null>("deviceName")
  .then((name) => {
    if (typeof name === "string" && name.length > 0) cachedDeviceName = name;
  })
  .catch(() => {});

const saveKey = async (account: string, secret: Uint8Array) => {
  try {
    return (await syncCall<boolean>("keySave", { account, data: toBase64(secret) })) === true;
  } catch {
    return false;
  }
};

const engineFolderInfo = (path: string | null) =>
  syncCall<Omit<FolderInfo, "iCloudAvailable" | "inICloud">>("folderInfo", path === null ? {} : { path });

const chainState = async (folder: string, chain: string) =>
  (await syncCall<{ folder: boolean; chain: boolean }>("chainExists", { folder, chain })) ?? { folder: false, chain: false };

function kitText(words: string[], created: Date, device: string) {
  const date = created.toLocaleDateString(undefined, { dateStyle: "long" });
  return [
    "Astro Recovery Kit",
    `Created ${date} on ${device}`,
    "",
    KIT_INTRO,
    "",
    ...KIT_STEPS.map((step, i) => `${i + 1}. ${step}`),
    "",
    "Recovery phrase:",
    "",
    ...words.map((word, i) => `${String(i + 1).padStart(2)}. ${word}`),
    "",
    KIT_WARNING,
    "",
  ].join("\n");
}

const currentKit = async () => kitText(await requireWords(), new Date(), cachedDeviceName);

export const syncServices = {
  folderInfo: async (path: string | null): Promise<FolderInfo> => ({
    ...(await engineFolderInfo(path)),
    iCloudAvailable: false,
    inICloud: false,
  }),

  chooseFolder: async (_current: string | null): Promise<string | null> => (await pickFiles("folder"))[0] ?? null,

  newDeviceId: (): string => newFileId(),

  deviceName: (): string => cachedDeviceName,

  createPhrase: async (account: string): Promise<boolean> => {
    const fresh = newEntropy();
    if (!(await saveKey(account, fresh))) return false;
    setEntropy(fresh);
    return true;
  },

  enterPhrase: async (account: string, text: string, folder: string): Promise<PhraseResult> => {
    const parsed = await phraseEntropy(text);
    if (!("entropy" in parsed)) return parsed;
    const candidate = await deriveKeys(parsed.entropy);
    if (!(await chainState(folder, candidate.chainTag)).chain) {
      const info = await engineFolderInfo(folder).catch(() => null);
      return { error: info?.hasSyncData ? "mismatch" : "noData" };
    }
    if (!(await saveKey(account, parsed.entropy))) return { error: "keychain" };
    setEntropy(parsed.entropy);
    return { ok: true };
  },

  unlock: async (account: string): Promise<boolean> => {
    const stored = await syncCall<string | null>("keyLoad", { account }).catch(() => null);
    const secret = typeof stored === "string" ? fromBase64(stored) : null;
    if (!secret || secret.length !== 32) return false;
    setEntropy(secret);
    return true;
  },

  forget: async (account: string): Promise<void> => {
    await syncCall("keyDelete", { account }).catch(() => {});
    setEntropy(null);
  },

  chainStatus: async (folder: string): Promise<"ok" | "missing" | "unavailable"> => {
    const { chainTag } = await requireKeys();
    const state = await chainState(folder, chainTag);
    if (!state.folder) return "unavailable";
    return state.chain ? "ok" : "missing";
  },

  createChain: async (folder: string): Promise<void> => {
    const { chainTag } = await requireKeys();
    await syncCall("createChain", { folder, chain: chainTag });
  },

  write: async (folder: string, scope: string, payload: string): Promise<string> => {
    const vault = await requireKeys();
    const id = newFileId();
    const scopeTag = await vault.scopeTag(scope);
    const sealed = await vault.seal(encoder.encode(payload), scopeTag, id);
    await syncCall("write", { folder, chain: vault.chainTag, scope: scopeTag, id, data: toBase64(sealed) });
    return id;
  },

  read: async (folder: string, scope: string, known: string[]): Promise<Listing> => {
    const vault = await requireKeys();
    const scopeTag = await vault.scopeTag(scope);
    const reply = await syncCall<{ present?: string[]; files?: EngineFile[] } | null>("list", {
      folder,
      chain: vault.chainTag,
      scope: scopeTag,
      known,
    });
    const listing: Listing = { files: [], pending: [], damaged: [], present: reply?.present ?? [] };
    const now = Date.now();
    for (const file of reply?.files ?? []) {
      const sealed = typeof file.data === "string" ? fromBase64(file.data) : null;
      try {
        if (!sealed) throw new Error("unreadable");
        listing.files.push({ id: file.id, payload: decoder.decode(await vault.open(sealed, scopeTag, file.id)) });
      } catch {
        listing.damaged.push({ id: file.id, age: Math.max(0, now - (file.mtime ?? now)) });
      }
    }
    return listing;
  },

  remove: async (folder: string, scope: string, ids: string[]): Promise<void> => {
    const vault = await requireKeys();
    await syncCall("remove", { folder, chain: vault.chainTag, scope: await vault.scopeTag(scope), ids });
  },

  deleteChain: async (folder: string): Promise<void> => {
    const { chainTag } = await requireKeys();
    await syncCall("deleteChain", { folder, chain: chainTag });
  },

  sealLocal: async (text: string): Promise<string> => {
    const vault = await requireKeys();
    return toBase64(await vault.seal(encoder.encode(text), "local", "state"));
  },

  openLocal: async (sealed: string): Promise<string | null> => {
    const data = fromBase64(sealed);
    if (!keys || !data) return null;
    try {
      return decoder.decode(await (await keys).open(data, "local", "state"));
    } catch {
      return null;
    }
  },

  recoveryWords: (): Promise<string[]> => requireWords(),

  qrCode: async (): Promise<string | null> => null,

  recoveryKitPreview: async (_width: number): Promise<string | null> => null,

  saveRecoveryKit: async (_format: "pdf" | "text"): Promise<string | null> => {
    const text = await currentKit();
    const path = (await pickFiles("save", KIT_NAME))[0];
    if (!path) return null;
    await syncCall("writeTextFile", { path, text });
    return path;
  },

  copyRecoveryKit: async (): Promise<void> => navigator.clipboard.writeText(await currentKit()),

  shareRecoveryKit: async (): Promise<void> => {},

  copyRecoveryPhrase: async (): Promise<void> => navigator.clipboard.writeText((await requireWords()).join(" ")),

  revealFolder: async (path: string): Promise<void> => void (await systemServices.revealFile(path)),

  readPasswords: async (_engineProfile: string) => null,
};

provideNativeModule("AstroSync", syncServices);
