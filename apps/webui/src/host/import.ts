import { emitNativeEvent } from "../../../demo/src/shims/expo-modules-core";
import { loadCr, pickFiles } from "./engine";

type EngineReply = { json?: string; error?: { code: string; message: string } };

const send = async (method: string, args: Record<string, unknown> = {}): Promise<EngineReply> =>
  (await loadCr()).sendWithPromise<EngineReply>("astroImport", method, args);

async function sendJson(method: string, args: Record<string, unknown> = {}): Promise<string> {
  const reply = await send(method, args);
  if (reply.error) throw { code: reply.error.code ?? "unreadable", message: reply.error.message ?? "" };
  return reply.json ?? "null";
}

const unlocked = new Set<string>();

function fileUrlToPath(url: string): string {
  if (!url.startsWith("file://")) return url;
  try {
    const parsed = new URL(url);
    let path = decodeURIComponent(parsed.pathname);
    if (/^\/[A-Za-z]:\//.test(path)) path = path.slice(1).replace(/\//g, "\\");
    return path;
  } catch {
    return url;
  }
}

let listening: Promise<void> | null = null;

export const startImportEvents = () =>
  void (listening ??= loadCr().then((cr) => {
    const add = cr.addWebUiListener as unknown as (event: string, listener: (...args: never[]) => void) => void;
    add("astro-import-event", (payload: Record<string, unknown>) => emitNativeEvent("AstroImport", "onImportEvent", payload));
  }));

export const importServices = {
  listBrowsers: () => sendJson("listBrowsers"),

  importData: (jobId: string, browserId: string, profileId: string, kinds: string[], options: Record<string, unknown>) => {
    startImportEvents();
    return sendJson("importData", { jobId, browserId, profileId, kinds, ...options });
  },

  cancelImport: (jobId: string) => void send("cancelImport", { jobId }),

  unlockBrowser: async (browserId: string, primaryPassword: string | null) => {
    await sendJson("unlockBrowser", { browserId, primaryPassword });
    unlocked.add(browserId);
    return null;
  },

  isBrowserUnlocked: (browserId: string) => unlocked.has(browserId),

  forgetUnlockedKeys: () => {
    unlocked.clear();
    void send("forgetUnlockedKeys");
  },

  listExtensions: (browserId: string, profileId: string) => sendJson("listExtensions", { browserId, profileId }),

  importBookmarksHTML: (path: string) => sendJson("importBookmarksHTML", { path }),

  importPasswordsCSV: (path: string) => sendJson("importPasswordsCSV", { path }),

  chooseImportFile: async (_kind: "safariExport" | "bookmarksHTML" | "passwordsCSV"): Promise<string | null> => {
    const [url] = await pickFiles("files");
    return url ? fileUrlToPath(url) : null;
  },

  writeImported: (token: string, profile: string, kinds: string[]): Promise<string> => sendJson("writeImported", { token, profile, kinds }),

  discardImported: (token: string) => void send("discardImported", { token }),
};
