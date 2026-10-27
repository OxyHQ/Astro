import type { CalendarEvent } from "../../live/meetings";
import { alia, aliaReady } from "../alia/api";
import type { AstroCommand } from "../skills/skills";
import { lastMeeting, nextMeeting } from "./brief";

export type ProactiveCommand = { key: string; title: string; command: AstroCommand };

export type WelcomeSuggestion = { key: string; title: string; prompt: string };

const MINUTE = 60_000;
const PREP_WINDOW = 60 * MINUTE;
const RECAP_WINDOW = 90 * MINUTE;
const MORNING_ENDS_HOUR = 12;

const quoted = (title: string) => `“${title.length > 40 ? `${title.slice(0, 39)}…` : title}”`;

export function proactiveCommands(now: number, events: CalendarEvent[], options: { briefDoneToday: boolean }): ProactiveCommand[] {
  const out: ProactiveCommand[] = [];
  const next = nextMeeting(events, now);
  if (next && next.start > now && next.start - now <= PREP_WINDOW) out.push({ key: `prep:${next.occurrence}`, title: `Prepare for ${quoted(next.title || "your next meeting")}`, command: "prep" });
  const last = lastMeeting(events, now);
  if (last && last.end <= now && now - last.end <= RECAP_WINDOW) out.push({ key: `recap:${last.occurrence}`, title: `Recap ${quoted(last.title || "your last meeting")}`, command: "recap" });
  if (!options.briefDoneToday && new Date(now).getHours() < MORNING_ENDS_HOUR) out.push({ key: "brief", title: "Start My Day", command: "brief" });
  return out;
}

export function welcomeContext(page: { title: string; url: string; description?: string } | null): string | undefined {
  if (!page) return undefined;
  let host = "";
  try {
    host = new URL(page.url).hostname.replace(/^www\./, "");
  } catch {}
  return [page.title, host, page.description ?? ""].filter(Boolean).join(" — ").slice(0, 4000);
}

export async function welcomeSuggestions(clientContext: string | undefined, count = 3): Promise<WelcomeSuggestion[]> {
  if (!aliaReady()) return [];
  const r = await alia().post<{ suggestions?: { suggestionId?: string; title?: string; text?: string; prompt?: string }[] }>("/suggestions/welcome", {
    count,
    ...(clientContext ? { clientContext } : {}),
  });
  return (r.data?.suggestions ?? []).flatMap((s, i) => {
    const prompt = s.text || s.prompt || "";
    const title = s.title || prompt;
    return prompt ? [{ key: s.suggestionId || `s${i}`, title, prompt }] : [];
  });
}
