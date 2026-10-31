import { readDocument, writeDocument } from "@astro-browser/shell";
import { create } from "zustand";
import { openChat, useChatAvailable } from "../chatEntry";
import { ASTRO_COMMANDS } from "../skills/skills";
import { useApps, refreshApps } from "../apps/apps";
import { aliaReady } from "../alia/api";
import { useOxySession } from "../../oxy/session";
import { useBrowser } from "../../store/browser";
import { briefDoneToday } from "./briefDay";
import { dayKey, homeCard, morningBriefDue, morningBriefOf, type BriefRecord, type HomeCard, type MorningBriefSetting } from "./home";

const DOC = "ai-home.json";

type Saved = { version: 1; brief: Record<string, BriefRecord>; upsellDismissedAt: number | null };

function readSaved(): Saved {
  try {
    const json = readDocument(DOC);
    const parsed = json ? (JSON.parse(json) as Partial<Saved>) : {};
    return { version: 1, brief: parsed.brief ?? {}, upsellDismissedAt: parsed.upsellDismissedAt ?? null };
  } catch {
    return { version: 1, brief: {}, upsellDismissedAt: null };
  }
}

export const useHome = create<Saved>(() => readSaved());

function save(next: Partial<Saved>) {
  useHome.setState(next);
  const { version, brief, upsellDismissedAt } = useHome.getState();
  try {
    writeDocument(DOC, JSON.stringify({ version, brief, upsellDismissedAt }));
  } catch {}
}

const noteBrief = (profileId: string, field: keyof BriefRecord, now = Date.now()) =>
  save({ brief: { ...useHome.getState().brief, [profileId]: { ...useHome.getState().brief[profileId], [field]: dayKey(now) } } });

export const noteMorningBriefRun = (profileId: string) => noteBrief(profileId, "done");
export const dismissMorningBrief = (profileId: string) => noteBrief(profileId, "dismissed");
export const dismissConnectAppsUpsell = () => save({ upsellDismissedAt: Date.now() });

export function profileMorningBrief(profileId: string): MorningBriefSetting {
  return morningBriefOf(useBrowser.getState().profiles[profileId]?.morningBrief);
}

export function setProfileMorningBrief(profileId: string, patch: Partial<MorningBriefSetting>) {
  const s = useBrowser.getState();
  if (!s.profiles[profileId]) return;
  s.updateProfile(profileId, { morningBrief: { ...morningBriefOf(s.profiles[profileId]!.morningBrief), ...patch } });
}

const connectedCount = (connections: Record<string, unknown[]>) => Object.values(connections).reduce((n, list) => n + list.length, 0);

export function useHomeCard(windowId: string, profileId: string, now: number): HomeCard {
  const incognito = useBrowser((s) => !!s.windows[windowId]?.incognito);
  const stored = useBrowser((s) => s.profiles[profileId]?.morningBrief);
  const signedIn = useOxySession((s) => !!s.account);
  const chatAvailable = useChatAvailable();
  const record = useHome((s) => s.brief[profileId]);
  const upsellDismissed = useHome((s) => s.upsellDismissedAt !== null);
  const appsLoaded = useApps((s) => s.loadedAt !== null);
  const connected = useApps((s) => connectedCount(s.connections));
  return homeCard({
    signedIn,
    incognito,
    chatAvailable,
    briefDue: morningBriefDue(morningBriefOf(stored), now, record, { briefDoneToday: briefDoneToday(now) }),
    appsLoaded,
    connectedApps: connected,
    upsellDismissed,
  });
}

let appsAsked = 0;
const APPS_STALE_MS = 10 * 60_000;

export function refreshAppsForHome() {
  if (!aliaReady() || useApps.getState().loading) return;
  const { loadedAt } = useApps.getState();
  if (loadedAt && Date.now() - loadedAt < APPS_STALE_MS) return;
  if (Date.now() - appsAsked < 30_000) return;
  appsAsked = Date.now();
  void refreshApps();
}

const BRIEF = ASTRO_COMMANDS.find((c) => c.command === "brief")!;

export function startMorningBrief(windowId: string, profileId: string): boolean {
  const opened = openChat({ windowId, prompt: "", source: "skill", skill: { name: BRIEF.name, title: BRIEF.title, command: "brief" } });
  if (opened) noteMorningBriefRun(profileId);
  return opened;
}
