import { engineCall, onEngineEvent } from "@astro-browser/astrocore";
import { readDocument, writeDocument } from "@astro-browser/shell";
import { extensionsAdapter, type ExtensionChange, type ExtensionIntent, type ExtensionsAdapter, type LocalExtensions } from "@astro-browser/sync";
import { engineProfile } from "../store/model";

const DOC = "sync-extensions.json";

type Intents = { generation: number; profiles: Record<string, Record<string, ExtensionIntent>> };
type EngineState = LocalExtensions & { intents?: { id: string; kind: ExtensionIntent["kind"] }[] };

let intents: Intents | null = null;

function stored(): Intents {
  if (intents) return intents;
  try {
    const saved = JSON.parse(readDocument(DOC) || "{}") as Partial<Intents>;
    intents = { generation: Number(saved.generation) || 0, profiles: saved.profiles ?? {} };
  } catch {
    intents = { generation: 0, profiles: {} };
  }
  return intents;
}

const save = () => writeDocument(DOC, JSON.stringify(stored()));

function note(profile: string, id: string, kind: ExtensionIntent["kind"]) {
  const all = stored();
  (all.profiles[profile] ??= {})[id] = { kind, g: ++all.generation };
  save();
}

async function stateOf(profile: string): Promise<LocalExtensions> {
  const state = await engineCall<EngineState>("ac_extensions_sync_state", profile);
  for (const i of state.intents ?? []) note(profile, i.id, i.kind);
  return { ready: !!state.ready, extensions: state.extensions ?? [], pending: state.pending ?? [], settling: state.settling ?? [], queued: state.queued ?? [] };
}

async function readLocal(profile: string): Promise<LocalExtensions | null> {
  try {
    return await stateOf(profile);
  } catch {
    return null;
  }
}

const MISSING_CALL = /not an engine call|the engine has no/;
let available: boolean | null = null;

export const extensionSyncAvailable = () => available === true;

export async function probeExtensionSync(profile: string): Promise<boolean> {
  if (available !== null) return available;
  try {
    await stateOf(profile);
    available = true;
  } catch (error) {
    if (MISSING_CALL.test(error instanceof Error ? error.message : String(error))) available = false;
  }
  return available === true;
}

function refreshList(profile: string) {
  try {
    (require("../components/extensions/state") as typeof import("../components/extensions/state")).refreshExtensionsAfterChange(profile);
  } catch {}
}

async function change(profile: string, c: ExtensionChange): Promise<boolean> {
  const args = c.kind === "cancel" ? { id: c.id, record: { removed: true } } : { id: c.id, record: c.record, ...(c.approval ? { approval: c.approval } : {}) };
  try {
    await engineCall("ac_extensions_sync_apply", profile, args);
    return true;
  } catch (error) {
    console.warn(`[sync] extension ${c.kind} ${c.id} failed`, error);
    return false;
  } finally {
    refreshList(profile);
  }
}

export function extensionsAdapterFor(profileId: string): ExtensionsAdapter {
  const profile = () => engineProfile(profileId);
  return extensionsAdapter({
    read: () => readLocal(profile()),
    change: (c) => change(profile(), c),
    intents: () => ({ ...stored().profiles[profile()] }),
    settleIntents: (published) => {
      const byId = stored().profiles[profile()];
      if (!byId) return;
      let changed = false;
      for (const [id, g] of Object.entries(published)) {
        if (byId[id]?.g !== g) continue;
        delete byId[id];
        changed = true;
      }
      if (changed) save();
    },
    keepInstalled: (id) => note(profile(), id, "installed"),
  });
}

let watching = false;

export function watchExtensionIntents(profiles: string[]) {
  if (!watching) {
    watching = true;
    onEngineEvent("extensions.sync", ({ profile }) => void readLocal(profile));
  }
  for (const profile of profiles) void readLocal(profile);
}
