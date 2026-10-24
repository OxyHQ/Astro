import { create } from "zustand";

export type OxyAccount = { id: string; name: string; handle: string };

type OxySession = {
  available: boolean;
  wanted: boolean;
  resolved: boolean;
  account: OxyAccount | null;
  niloFetch: typeof fetch | null;
  openSignIn: (() => Promise<void>) | null;
  closeSession: (() => Promise<void>) | null;
};

export const useOxySession = create<OxySession>()(() => ({
  available: false,
  wanted: false,
  resolved: false,
  account: null,
  niloFetch: null,
  openSignIn: null,
  closeSession: null,
}));

export const oxySignInAvailable = () => useOxySession.getState().available;

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
  if (!oxySignInAvailable()) return false;
  wantOxy();
  const session = await whenReady();
  if (session.account) return true;
  await session.openSignIn?.();
  return !!useOxySession.getState().account;
}

export async function signOutOfOxy(): Promise<void> {
  await useOxySession.getState().closeSession?.();
}
