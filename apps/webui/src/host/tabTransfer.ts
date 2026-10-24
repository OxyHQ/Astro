import { useBrowser } from "../../../browser/src/store/browser";
import { changedIds } from "../../../browser/src/store/changes";
import { loadCr } from "./engine";

export type TakenTab = { ref: string; url: string; title: string };

const transferCall = async <T = null>(action: string, ...args: unknown[]): Promise<T> =>
  (await loadCr()).sendWithPromise<T>("astroTabTransfer", action, ...args);

export const takeTransferredTab = (key: string) => transferCall<TakenTab | null>("take", key);
export const noteLiveTab = (key: string, ref: string) => void transferCall("live", key, ref);
export const noteTabGone = (key: string) => void transferCall("gone", key);
export const notePageWindow = (windowId: string) => void transferCall("window", windowId);
export const isTabInTransit = (ref: string) => transferCall<boolean>("transit", ref);
export const parkTab = (key: string, ref: string, toWindow: string | null, keepWindow: boolean) =>
  transferCall<string | null>("park", key, ref, toWindow ?? "", keepWindow);

const handOffs = new Map<string, Set<() => void>>();

export function offerHandOff(key: string, handOff: () => void): () => void {
  const set = handOffs.get(key) ?? new Set();
  set.add(handOff);
  handOffs.set(key, set);
  return () => {
    set.delete(handOff);
    if (!set.size && handOffs.get(key) === set) handOffs.delete(key);
  };
}

const samePage = (a: string, b: string) => a.split("#")[0] === b.split("#")[0];

export function transferredUrlGuard() {
  let transferred: string | null = null;
  return {
    arrive: (url: string) => void (transferred = url),
    skips: (url: string) => {
      const was = transferred;
      transferred = null;
      return was !== null && samePage(url, was);
    },
    differs: (url: string | undefined) => !!url && transferred !== null && !samePage(url, transferred),
  };
}

export const tabTransferServices = {
  prepareTransfer: (key: string) => {
    if (!key) return;
    for (const handOff of [...(handOffs.get(key) ?? [])]) handOff();
  },
  releaseTransfer: (key: string) => {
    if (key) void transferCall("release", key);
  },
};

export function releaseClosedTabs(isLeader: () => boolean) {
  useBrowser.subscribe((s, prev) => {
    if (s.tabs === prev.tabs || !isLeader()) return;
    for (const id of changedIds(s.tabs, prev.tabs)) if (!s.tabs[id]) tabTransferServices.releaseTransfer(id);
  });
}
