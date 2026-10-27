import { create } from "zustand";

export type OxyAccount = { id: string; name: string; handle: string; email: string | null; avatar: string | null; color: string | null };

export type NiloSocketAccess = { url: string; token: () => Promise<string> };

type OxySession = {
  wanted: boolean;
  resolved: boolean;
  account: OxyAccount | null;
  niloFetch: typeof fetch | null;
  niloSocket: NiloSocketAccess | null;
  sessionBearer: (() => string | null) | null;
  clientId: string | null;
  openSignIn: (() => Promise<void>) | null;
  openAccountDialog: (() => void) | null;
  closeSession: (() => Promise<void>) | null;
};

export const useOxySession = create<OxySession>()(() => ({
  wanted: false,
  resolved: false,
  account: null,
  niloFetch: null,
  niloSocket: null,
  sessionBearer: null,
  clientId: null,
  openSignIn: null,
  openAccountDialog: null,
  closeSession: null,
}));

type WindowSession = Pick<
  OxySession,
  "resolved" | "account" | "niloFetch" | "niloSocket" | "sessionBearer" | "clientId" | "openSignIn" | "openAccountDialog" | "closeSession"
>;

const SIGNED_OUT: WindowSession = {
  resolved: false,
  account: null,
  niloFetch: null,
  niloSocket: null,
  sessionBearer: null,
  clientId: null,
  openSignIn: null,
  openAccountDialog: null,
  closeSession: null,
};

const windowSessions = new Map<string, WindowSession>();
let windowFocusOrder: string[] = [];

export const useOxyGenerations = create<Record<string, number>>()(() => ({}));

function sessionWindow(): string | null {
  for (const id of windowFocusOrder) if (windowSessions.has(id)) return id;
  return windowSessions.keys().next().value ?? null;
}

function projectSession() {
  const id = sessionWindow();
  const next = id ? windowSessions.get(id)! : SIGNED_OUT;
  const now = useOxySession.getState();
  if ((Object.keys(next) as (keyof WindowSession)[]).every((key) => now[key] === next[key])) return;
  useOxySession.setState(next);
}

const accountIdOf = (session: WindowSession | undefined) => session?.account?.id ?? null;

export function publishOxyWindow(windowId: string, session: WindowSession) {
  const before = windowSessions.get(windowId);
  windowSessions.set(windowId, session);
  if (before?.resolved && session.resolved && accountIdOf(before) !== accountIdOf(session)) {
    windowFocusOrder = [windowId, ...windowFocusOrder.filter((id) => id !== windowId)];
    const stale = [...windowSessions].filter(([id, other]) => id !== windowId && accountIdOf(other) !== accountIdOf(session)).map(([id]) => id);
    if (stale.length) useOxyGenerations.setState((g) => Object.fromEntries([...Object.entries(g), ...stale.map((id) => [id, (g[id] ?? 0) + 1])]));
  }
  projectSession();
}

export function withdrawOxyWindow(windowId: string) {
  if (!windowSessions.delete(windowId)) return;
  projectSession();
}

export function noteOxyWindowFocus(windowId: string) {
  if (windowFocusOrder[0] === windowId) return;
  windowFocusOrder = [windowId, ...windowFocusOrder.filter((id) => id !== windowId)];
  projectSession();
}

export const wantOxy = () => {
  if (!useOxySession.getState().wanted) useOxySession.setState({ wanted: true });
};

function whenReady(): Promise<OxySession> {
  const ready = (s: OxySession) => s.resolved && !!s.openSignIn;
  const now = useOxySession.getState();
  if (ready(now)) return Promise.resolve(now);
  return new Promise((resolve) => {
    const stop = useOxySession.subscribe((s) => {
      if (!ready(s)) return;
      stop();
      resolve(s);
    });
  });
}

export async function signInWithOxy(): Promise<boolean> {
  wantOxy();
  const session = await whenReady();
  if (session.account) return true;
  await session.openSignIn?.();
  return !!useOxySession.getState().account;
}

export async function manageOxyAccount(): Promise<void> {
  wantOxy();
  (await whenReady()).openAccountDialog?.();
}

export async function signOutOfOxy(): Promise<void> {
  await useOxySession.getState().closeSession?.();
}

export const accountInitial = (account: Pick<OxyAccount, "name" | "handle">) => (account.name || account.handle).trim().charAt(0).toUpperCase() || "?";
