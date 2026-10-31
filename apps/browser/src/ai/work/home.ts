export type MorningBriefSetting = { enabled: boolean; at: string };

export const DEFAULT_MORNING_BRIEF: MorningBriefSetting = { enabled: true, at: "07:00" };

export const UPSELL_RESERVED_HEIGHT = 80;

const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function minutesOf(at: string): number | null {
  const m = TIME.exec(at);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

export function morningBriefOf(stored: Partial<MorningBriefSetting> | null | undefined): MorningBriefSetting {
  return {
    enabled: typeof stored?.enabled === "boolean" ? stored.enabled : DEFAULT_MORNING_BRIEF.enabled,
    at: typeof stored?.at === "string" && minutesOf(stored.at) !== null ? stored.at : DEFAULT_MORNING_BRIEF.at,
  };
}

export const BRIEF_TIMES: string[] = Array.from({ length: 15 }, (_, i) => {
  const minutes = 4 * 60 + i * 30;
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
});

export function formatBriefTime(at: string, hour12 = true): string {
  const minutes = minutesOf(at);
  if (minutes === null) return at;
  const h = Math.floor(minutes / 60);
  const m = String(minutes % 60).padStart(2, "0");
  if (!hour12) return `${h}:${m}`;
  return `${h % 12 === 0 ? 12 : h % 12}:${m} ${h < 12 ? "AM" : "PM"}`;
}

export const dayKey = (at: number) => {
  const d = new Date(at);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export type BriefRecord = { done?: string; dismissed?: string };

export function morningBriefDue(setting: MorningBriefSetting, now: number, record: BriefRecord | undefined, options: { briefDoneToday: boolean }): boolean {
  if (!setting.enabled || options.briefDoneToday) return false;
  const start = minutesOf(setting.at);
  if (start === null) return false;
  const d = new Date(now);
  if (d.getHours() * 60 + d.getMinutes() < start) return false;
  const today = dayKey(now);
  return record?.done !== today && record?.dismissed !== today;
}

export type HomeCardInput = {
  signedIn: boolean;
  incognito: boolean;
  chatAvailable: boolean;
  briefDue: boolean;
  appsLoaded: boolean;
  connectedApps: number;
  upsellDismissed: boolean;
};

export type HomeCard = "morningBrief" | "connectApps" | null;

export function connectAppsUpsellVisible(i: Omit<HomeCardInput, "briefDue">): boolean {
  return i.signedIn && !i.incognito && i.chatAvailable && i.appsLoaded && i.connectedApps === 0 && !i.upsellDismissed;
}

export function homeCard(i: HomeCardInput): HomeCard {
  if (!i.signedIn || i.incognito || !i.chatAvailable) return null;
  if (i.briefDue) return "morningBrief";
  return connectAppsUpsellVisible(i) ? "connectApps" : null;
}
