import { useCalendar } from "../../live/calendar";
import { useBrowser } from "../../store/browser";
import { isIncognitoProfile, viewTabIds } from "../../store/model";
import type { AstroCommand } from "../skills/skills";
import { commandTurn, meetingPrep, meetingRecap, type BriefInput, type BriefPage, type CommandTurn } from "./brief";

const web = (url: string) => /^https?:/i.test(url);

export function briefInput(windowId: string, now = Date.now()): BriefInput {
  const s = useBrowser.getState();
  const w = s.windows[windowId];
  const profileId = w?.profileId ?? "";
  const calendar = useCalendar.getState();
  const tabs = w ? viewTabIds(s, windowId).flatMap((id) => (s.tabs[id] ? [s.tabs[id]!] : [])) : [];
  const page = (t: { customTitle: string | null; title: string; url: string }): BriefPage => ({ title: t.customTitle || t.title, url: t.url });
  return {
    now,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    events: calendar.events,
    calendar: calendar.access === "connected" || calendar.access === "fixture" ? "connected" : calendar.access === "signedOut" ? "signedOut" : "unavailable",
    pinnedTabs: tabs.filter((t) => t.pinned && web(t.url)).map(page),
    openTabs: tabs.filter((t) => !t.pinned && web(t.url)).sort((a, b) => b.lastActiveAt - a.lastActiveAt).map(page),
    history: isIncognitoProfile(profileId) ? [] : (s.history[profileId] ?? []),
  };
}

export function astroCommandTurn(command: AstroCommand, windowId: string, occurrence?: string): CommandTurn | null {
  const input = briefInput(windowId);
  const event = occurrence ? input.events.find((e) => e.occurrence === occurrence) : undefined;
  if (event && command === "prep") return meetingPrep(input, event);
  if (event && command === "recap") return meetingRecap(input, event);
  return commandTurn(command, input);
}
