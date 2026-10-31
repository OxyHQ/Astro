import type { CalendarEvent, CalendarParticipant } from "../../live/meetings";
import type { HistoryEntry } from "../../store/types";
import type { AstroCommand } from "../skills/skills";

export type BriefPage = { title: string; url: string };

export type BriefInput = {
  now: number;
  timeZone: string;
  events: CalendarEvent[];
  calendar: "connected" | "signedOut" | "unavailable";
  openTabs: BriefPage[];
  pinnedTabs: BriefPage[];
  history: HistoryEntry[];
};

export type CommandTurn = { prompt: string; context: string[]; event?: CalendarEvent | null };

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;
const MAX_PAGES = 25;

const isMeeting = (e: CalendarEvent) => !e.allDay && !e.cancelled && !e.declined;

const dayStart = (at: number) => {
  const d = new Date(at);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

function clockTime(at: number, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone }).format(at);
  } catch {
    return new Date(at).toTimeString().slice(0, 5);
  }
}

function longDate(at: number, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone }).format(at);
  } catch {
    return new Date(at).toDateString();
  }
}

const person = (p: CalendarParticipant) => `${p.name || p.email}${p.name && p.email ? ` <${p.email}>` : ""}${p.me ? " (the person)" : ""}${p.status === "declined" ? " — declined" : p.status === "tentative" ? " — maybe" : ""}`;

const fence = (body: string) => `<<<\n${body}\n>>>`;

const pageLine = (p: BriefPage) => `- ${p.title || "(untitled)"} — ${p.url}`;

export function describeEvent(event: CalendarEvent, timeZone: string): string {
  const lines = [
    `Title: ${event.title || "(no title)"}`,
    event.allDay ? `When: all day, ${longDate(event.start, timeZone)}` : `When: ${longDate(event.start, timeZone)}, ${clockTime(event.start, timeZone)}–${clockTime(event.end, timeZone)}`,
  ];
  if (event.location) lines.push(`Where: ${event.location}`);
  if (event.url) lines.push(`Link: ${event.url}`);
  if (event.organizer) lines.push(`Organizer: ${person(event.organizer)}`);
  const guests = event.attendees.filter((a) => !event.organizer || a.email !== event.organizer.email);
  if (guests.length) lines.push(`Guests (${guests.length}):`, ...guests.slice(0, 30).map((a) => `- ${person(a)}`));
  if (event.notes.trim()) lines.push("Description:", fence(event.notes.trim().slice(0, 4000)));
  return lines.join("\n");
}

export function todaysMeetings(events: CalendarEvent[], now: number): CalendarEvent[] {
  const start = dayStart(now);
  return events.filter((e) => !e.cancelled && !e.declined && e.start < start + DAY && e.end > start).sort((a, b) => a.start - b.start);
}

export function nextMeeting(events: CalendarEvent[], now: number): CalendarEvent | null {
  return events.filter((e) => isMeeting(e) && e.end > now).sort((a, b) => a.start - b.start)[0] ?? null;
}

export function lastMeeting(events: CalendarEvent[], now: number): CalendarEvent | null {
  return (
    events
      .filter((e) => isMeeting(e) && e.start <= now)
      .sort((a, b) => b.end - a.end)
      .find((e) => e.end <= now + 5 * MINUTE) ?? null
  );
}

const usable = (url: string) => /^https?:/i.test(url);

export function pagesBetween(history: HistoryEntry[], from: number, to: number): BriefPage[] {
  return history
    .filter((h) => usable(h.url) && (h.visitTimes?.length ? h.visitTimes.some((t) => t >= from && t <= to) : h.lastVisit >= from && h.lastVisit <= to))
    .sort((a, b) => b.lastVisit - a.lastVisit)
    .slice(0, MAX_PAGES)
    .map((h) => ({ title: h.title, url: h.url }));
}

export function pagesAbout(history: HistoryEntry[], words: string[], since: number): BriefPage[] {
  const terms = words.map((w) => w.toLowerCase()).filter((w) => w.length >= 4);
  if (!terms.length) return [];
  return history
    .filter((h) => usable(h.url) && h.lastVisit >= since && terms.some((t) => `${h.title} ${h.url}`.toLowerCase().includes(t)))
    .sort((a, b) => b.lastVisit - a.lastVisit)
    .slice(0, 12)
    .map((h) => ({ title: h.title, url: h.url }));
}

const STOP = new Set(["with", "meeting", "call", "sync", "weekly", "daily", "about", "review", "team", "chat", "the", "and", "for"]);

export function eventKeywords(event: CalendarEvent): string[] {
  const fromTitle = (event.title.match(/[\p{L}\p{N}][\p{L}\p{N}'-]+/gu) ?? []).filter((w) => !STOP.has(w.toLowerCase()));
  const people = event.attendees.filter((a) => !a.me).flatMap((a) => [a.name.split(/\s+/)[0] ?? "", a.email.split("@")[1]?.split(".")[0] ?? ""]);
  return [...new Set([...fromTitle, ...people].filter((w) => w.length >= 4))].slice(0, 12);
}

function calendarSection(input: BriefInput): string[] {
  if (input.calendar !== "connected") return ["## Calendar", "The person's calendar isn't connected to Astro. Read it with your calendar tools if you can reach it."];
  const today = todaysMeetings(input.events, input.now);
  if (!today.length) return ["## Today's calendar", "Nothing on the calendar today."];
  return [
    `## Today's calendar (${today.length} event${today.length === 1 ? "" : "s"})`,
    today
      .map((e) => {
        const when = e.allDay ? "All day" : `${clockTime(e.start, input.timeZone)}–${clockTime(e.end, input.timeZone)}`;
        const who = e.attendees.filter((a) => !a.me).length;
        const state = e.end <= input.now ? " (over)" : e.start <= input.now ? " (now)" : "";
        return `- ${when}${state}: ${e.title || "(no title)"}${who ? ` · ${who} guest${who === 1 ? "" : "s"}` : ""}${e.location ? ` · ${e.location}` : ""}`;
      })
      .join("\n"),
  ];
}

export function morningBrief(input: BriefInput): CommandTurn {
  const yesterday = pagesBetween(input.history, dayStart(input.now) - DAY, dayStart(input.now));
  const context = [
    "## Start My Day",
    `It is ${clockTime(input.now, input.timeZone)} on ${longDate(input.now, input.timeZone)} (${input.timeZone}). The person asked for their morning brief.`,
    ...calendarSection(input),
  ];
  if (input.pinnedTabs.length) context.push("## Pinned tabs", input.pinnedTabs.slice(0, MAX_PAGES).map(pageLine).join("\n"));
  if (input.openTabs.length) context.push("## Tabs the person left open", input.openTabs.slice(0, MAX_PAGES).map(pageLine).join("\n"));
  if (yesterday.length) context.push("## Pages the person read yesterday", yesterday.map(pageLine).join("\n"));
  return {
    prompt: [
      "Start my day. Give me my morning brief:",
      "1. My schedule today, with anything I should prepare for each meeting.",
      "2. What needs me: check my inbox and the apps you can reach for anything urgent or waiting on me.",
      "3. Where I left off, from the tabs I left open and what I read yesterday.",
      "4. A few headlines worth knowing about today, from the topics I follow.",
      "Keep it short and scannable, with headings.",
    ].join("\n"),
    context,
  };
}

export function meetingPrep(input: BriefInput, event: CalendarEvent | null): CommandTurn {
  if (!event)
    return {
      prompt: "Prepare me for my next meeting.",
      context: ["## Meeting prep", input.calendar === "connected" ? "There's no meeting left on the person's calendar today or tomorrow." : "The person's calendar isn't connected to Astro. Find their next meeting with your calendar tools if you can."],
      event: null,
    };
  const related = pagesAbout(input.history, eventKeywords(event), input.now - 14 * DAY);
  const context = ["## The meeting to prepare for", describeEvent(event, input.timeZone)];
  if (related.length) context.push("## Pages the person read recently that look related", related.map(pageLine).join("\n"));
  return {
    prompt: [
      `Prepare me for “${event.title || "my next meeting"}”.`,
      "Tell me who's coming (look them up if you can), what it's about, what happened last time if you can find it, and what I should have ready: questions to ask, decisions to make, documents to open.",
    ].join(" "),
    context,
    event,
  };
}

export function meetingRecap(input: BriefInput, event: CalendarEvent | null): CommandTurn {
  if (!event)
    return {
      prompt: "Recap my last meeting.",
      context: ["## Meeting recap", input.calendar === "connected" ? "There's no meeting earlier today on the person's calendar." : "The person's calendar isn't connected to Astro. Find their last meeting with your calendar tools if you can."],
      event: null,
    };
  const during = pagesBetween(input.history, event.start - 5 * MINUTE, event.end + 10 * MINUTE);
  const context = ["## The meeting to recap", describeEvent(event, input.timeZone)];
  if (during.length) context.push("## Pages the person had open during the meeting", during.map(pageLine).join("\n"));
  return {
    prompt: [
      `Recap “${event.title || "my last meeting"}”.`,
      "Summarize what it was about, the decisions and the follow-ups with owners, using the meeting's details, any notes or transcript you can reach, and the pages I used during it. Then draft a short follow-up message I could send to the guests.",
    ].join(" "),
    context,
    event,
  };
}

export function commandTurn(command: AstroCommand, input: BriefInput): CommandTurn | null {
  switch (command) {
    case "brief":
      return morningBrief(input);
    case "prep":
      return meetingPrep(input, nextMeeting(input.events, input.now));
    case "recap":
      return meetingRecap(input, lastMeeting(input.events, input.now));
    default:
      return null;
  }
}
