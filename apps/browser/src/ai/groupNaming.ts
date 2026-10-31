import { useBrowser, type BrowserState } from "../store/browser";
import { isIncognitoProfile } from "../store/model";
import type { TabGroup } from "../store/types";
import { useOxySession } from "../oxy/session";
import { oneShot, oneShotReady, useOneShotStatus } from "./inference";
import { GROUP_NAME_INSTRUCTIONS, groupNameInput, parseGroupName, type NamedTab } from "./oneShotPrompts";

const SETTLE_MS = 1500;
const MAX_OUTPUT_TOKENS = 64;

const titled = (title: string, url: string) => !!title && title !== url && !/^https?:\/\//.test(title);

function placeOf(url: string): string {
  try {
    const u = new URL(url);
    return `${u.hostname.replace(/^www\./, "")}/${u.pathname.split("/")[1] ?? ""}`;
  } catch {
    return "";
  }
}

export function groupSignature(members: readonly NamedTab[]): string {
  return [...new Set(members.map((m) => placeOf(m.url)).filter(Boolean))].sort().join(" ");
}

function membersOf(s: BrowserState, g: TabGroup): { tabs: NamedTab[]; waiting: boolean } {
  const tabs: NamedTab[] = [];
  let waiting = false;
  for (const id of g.tabIds) {
    const t = s.tabs[id];
    if (!t || !/^https?:/i.test(t.url)) continue;
    const title = t.customTitle || t.title;
    if (titled(title, t.url)) tabs.push({ title, url: t.url });
    else if (!t.unloaded) waiting = true;
  }
  return { tabs, waiting };
}

const wanted = (s: BrowserState, g: TabGroup) => !g.name && !isIncognitoProfile(g.profileId) && s.settings.aiGroupNames !== false;

type Pending = { sig: string; timer: ReturnType<typeof setTimeout> | null; abort: AbortController | null };

export function startGroupNaming(): () => void {
  const pending = new Map<string, Pending>();
  const tried = new Set<string>();

  const cancel = (id: string) => {
    const p = pending.get(id);
    if (!p) return;
    if (p.timer) clearTimeout(p.timer);
    p.abort?.abort();
    pending.delete(id);
  };

  const run = async (id: string, sig: string) => {
    const s = useBrowser.getState();
    const g = s.groups[id];
    const p = pending.get(id);
    if (!g || !p || p.sig !== sig || !wanted(s, g) || !oneShotReady()) return void pending.delete(id);
    const { tabs } = membersOf(s, g);
    if (!tabs.length || groupSignature(tabs) !== sig) return void pending.delete(id);
    p.timer = null;
    p.abort = new AbortController();
    tried.add(`${id} ${sig}`);
    const answer = parseGroupName(
      await oneShot("groupName", { instructions: GROUP_NAME_INSTRUCTIONS, input: groupNameInput(tabs), maxOutputTokens: MAX_OUTPUT_TOKENS, signal: p.abort.signal }),
    );
    if (pending.get(id) !== p) return;
    pending.delete(id);
    const now = useBrowser.getState().groups[id];
    if (!answer || !now || now.name) return;
    useBrowser.getState().updateGroup(id, { autoName: answer.name, autoIcon: answer.emoji ?? undefined, autoSig: sig });
  };

  const check = (s: BrowserState) => {
    for (const id of pending.keys()) if (!s.groups[id] || !wanted(s, s.groups[id]!)) cancel(id);
    if (!oneShotReady()) return;
    for (const g of Object.values(s.groups)) {
      if (!wanted(s, g)) continue;
      const { tabs, waiting } = membersOf(s, g);
      if (!tabs.length) continue;
      const sig = groupSignature(tabs);
      if (sig === g.autoSig || tried.has(`${g.id} ${sig}`)) {
        if (pending.has(g.id)) cancel(g.id);
        continue;
      }
      const p = pending.get(g.id);
      if (p?.sig === sig) continue;
      cancel(g.id);
      const next: Pending = { sig, timer: null, abort: null };
      next.timer = setTimeout(() => void run(g.id, sig), waiting ? SETTLE_MS * 2 : SETTLE_MS);
      pending.set(g.id, next);
    }
  };

  check(useBrowser.getState());
  const stop = useBrowser.subscribe((s, prev) => {
    if (s.groups !== prev.groups || s.tabs !== prev.tabs || s.settings !== prev.settings) check(s);
  });
  const signedIn = useOxySession.subscribe((s, prev) => {
    if (s.account?.id !== prev.account?.id || s.sessionBearer !== prev.sessionBearer) check(useBrowser.getState());
  });
  const resumed = useOneShotStatus.subscribe((s, prev) => {
    if (s.endpoint !== prev.endpoint || s.stoppedFor !== prev.stoppedFor || s.pausedUntil !== prev.pausedUntil) check(useBrowser.getState());
  });
  return () => {
    stop();
    signedIn();
    resumed();
    for (const id of [...pending.keys()]) cancel(id);
  };
}
