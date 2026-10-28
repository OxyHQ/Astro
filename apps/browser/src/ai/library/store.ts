import { create } from "zustand";
import { useOxySession } from "../../oxy/session";
import { alia, aliaReady } from "../alia/api";
import { rememberArtifacts } from "../artifacts/artifacts";
import { indexConversation, needsScan, type IndexedChat, type LibraryConversation, type ScannedConversation } from "./library";

const APP = "astro";
const PAGE = 50;
const MAX_PAGES = 10;
const SCAN_LIMIT = 300;
const SCAN_CONCURRENCY = 4;
const STALE_MS = 60_000;
const KEY_PREFIX = "astro.library.v1.";

type LibraryState = {
  account: string | null;
  conversations: LibraryConversation[];
  index: Record<string, IndexedChat>;
  listing: boolean;
  scanning: number;
  loadedAt: number;
  error: string | null;
};

const EMPTY: Omit<LibraryState, "account"> = { conversations: [], index: {}, listing: false, scanning: 0, loadedAt: 0, error: null };

export const useLibrary = create<LibraryState>()(() => ({ account: null, ...EMPTY }));

type Saved = { conversations: LibraryConversation[]; index: Record<string, IndexedChat> };

function storage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function load(account: string): Saved | null {
  try {
    const raw = storage()?.getItem(KEY_PREFIX + account);
    if (!raw) return null;
    const saved = JSON.parse(raw) as Saved;
    return Array.isArray(saved.conversations) && saved.index && typeof saved.index === "object" ? saved : null;
  } catch {
    return null;
  }
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;

function save() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    const { account, conversations, index } = useLibrary.getState();
    if (!account) return;
    const store = storage();
    if (!store) return;
    try {
      for (let i = store.length - 1; i >= 0; i--) {
        const key = store.key(i);
        if (key?.startsWith(KEY_PREFIX) && key !== KEY_PREFIX + account) store.removeItem(key);
      }
      store.setItem(KEY_PREFIX + account, JSON.stringify({ conversations, index } satisfies Saved));
    } catch {}
  }, 400);
}

function adopt(account: string) {
  if (useLibrary.getState().account === account) return;
  const saved = load(account);
  useLibrary.setState({ account, ...EMPTY, ...(saved ?? {}) });
}

export function forgetLibrary() {
  useLibrary.setState({ account: null, ...EMPTY });
}

type ListPage = { conversations?: LibraryConversation[]; nextCursor?: string | null; hasMore?: boolean };

async function listAll(): Promise<LibraryConversation[]> {
  const all: LibraryConversation[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < MAX_PAGES; page++) {
    const r = await alia().get<ListPage>("/v1/conversations", { params: { app: APP, limit: PAGE, cursor } });
    const rows = r.data?.conversations ?? [];
    all.push(...rows.filter((c) => typeof c?.id === "string"));
    if (!r.data?.hasMore || !r.data.nextCursor) break;
    cursor = r.data.nextCursor;
  }
  return all;
}

async function scanOne(conversation: LibraryConversation, account: string) {
  const r = await alia().get<ScannedConversation>(`/v1/conversations/${encodeURIComponent(conversation.id)}`);
  if (useLibrary.getState().account !== account) return;
  const messages = r.data?.messages ?? [];
  rememberArtifacts(conversation.id, messages.map((m, i) => ({ id: m.id ?? String(i), role: m.role, toolInvocations: m.toolInvocations ?? [] })));
  const entry = indexConversation({ id: conversation.id, updatedAt: conversation.updatedAt, messages });
  useLibrary.setState((s) => ({ index: { ...s.index, [conversation.id]: entry } }));
}

let running: Promise<void> | null = null;

export function refreshLibrary(options: { force?: boolean } = {}): Promise<void> {
  const account = useOxySession.getState().account?.id ?? null;
  if (!account || !aliaReady()) return Promise.resolve();
  adopt(account);
  const s = useLibrary.getState();
  if (running) return running;
  if (!options.force && s.loadedAt && Date.now() - s.loadedAt < STALE_MS) return Promise.resolve();
  running = (async () => {
    useLibrary.setState({ listing: true, error: null });
    try {
      const conversations = await listAll();
      if (useLibrary.getState().account !== account) return;
      const live = new Set(conversations.map((c) => c.id));
      useLibrary.setState((st) => ({
        conversations,
        index: Object.fromEntries(Object.entries(st.index).filter(([id]) => live.has(id))),
        listing: false,
        loadedAt: Date.now(),
      }));
      save();
      const index = useLibrary.getState().index;
      const queue = conversations.slice(0, SCAN_LIMIT).filter((c) => needsScan(c, index));
      useLibrary.setState({ scanning: queue.length });
      const worker = async () => {
        for (let next = queue.shift(); next; next = queue.shift()) {
          await scanOne(next, account).catch(() => undefined);
          useLibrary.setState((st) => ({ scanning: Math.max(0, st.scanning - 1) }));
          save();
        }
      };
      await Promise.all(Array.from({ length: SCAN_CONCURRENCY }, worker));
    } catch {
      useLibrary.setState({ listing: false, error: "Your chats couldn't be loaded." });
    } finally {
      useLibrary.setState({ scanning: 0 });
      running = null;
    }
  })();
  return running;
}

export async function deleteLibraryChat(id: string) {
  await alia().delete(`/v1/conversations/${encodeURIComponent(id)}`);
  useLibrary.setState((s) => {
    const { [id]: _gone, ...index } = s.index;
    return { conversations: s.conversations.filter((c) => c.id !== id), index };
  });
  save();
}

