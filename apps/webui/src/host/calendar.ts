import type { CalendarAuthorization, SystemCalendar, SystemCalendarEvent } from "@astro-browser-real/shell";
import { type EdsSource, edsCalendars } from "../../../browser/src/live/eds";
import { eventsFromIcs, parseIcs, tzidsIn, Zones } from "../../../browser/src/live/ics";
import { readDocument, writeDocument } from "../shims/shell";
import { loadCr } from "./engine";

const systemCall = async <T,>(method: string, args: Record<string, unknown> = {}): Promise<T | null> =>
  (await loadCr()).sendWithPromise<T | null>("astroSystem", method, args);

const ON_WINDOWS = /Win/.test(navigator.platform);
const ACCESS_DOC = "calendar-access.json";
const DAY = 86_400_000;

type Access = "available" | "denied" | "unavailable";
type EdsCalendarData = { id: string; email: string; objects: string[] };

function storedAccess(): CalendarAuthorization {
  try {
    const saved = JSON.parse(readDocument(ACCESS_DOC) ?? "{}") as { access?: CalendarAuthorization };
    return saved.access ?? "notDetermined";
  } catch {
    return "notDetermined";
  }
}

let sessionAccess: CalendarAuthorization | null = null;

const currentAccess = () => sessionAccess ?? storedAccess();

function saveAccess(access: CalendarAuthorization) {
  sessionAccess = access;
  writeDocument(ACCESS_DOC, JSON.stringify({ access: access === "fullAccess" ? access : "notDetermined" }));
}

const authorization: Record<Access, CalendarAuthorization> = { available: "fullAccess", denied: "denied", unavailable: "restricted" };

async function requestAccess(): Promise<boolean> {
  const access = authorization[(await systemCall<Access>("calendarAccess")) ?? "unavailable"];
  saveAccess(access);
  return access === "fullAccess";
}

let known = new Map<string, SystemCalendar>();

async function calendars(): Promise<SystemCalendar[]> {
  if (currentAccess() !== "fullAccess") return [];
  const list = ON_WINDOWS
    ? ((await systemCall<SystemCalendar[]>("calendarList")) ?? [])
    : edsCalendars((await systemCall<EdsSource[]>("calendarSources")) ?? []);
  known = new Map(list.map((c) => [c.id, c]));
  return list;
}

async function edsEvents(start: number, end: number, ids: string[]): Promise<SystemCalendarEvent[]> {
  if (!known.size) await calendars();
  const found = (await systemCall<EdsCalendarData[]>("calendarEvents", { start: start - DAY, end: end + DAY, ids })) ?? [];
  const events: SystemCalendarEvent[] = [];
  for (const calendar of found) {
    const components = calendar.objects.flatMap((object) => parseIcs(object));
    const zones = new Zones();
    const missing = tzidsIn(components).filter((tzid) => !zones.has(tzid));
    if (missing.length) {
      const definitions = (await systemCall<Record<string, string>>("calendarTimezones", { id: calendar.id, tzids: missing })) ?? {};
      for (const text of Object.values(definitions)) for (const component of parseIcs(text)) zones.add(component);
    }
    const color = known.get(calendar.id)?.color ?? "#8E8E93";
    events.push(...eventsFromIcs(components, { calendarId: calendar.id, color, email: calendar.email }, zones, start, end));
  }
  return events;
}

async function events(start: number, end: number, ids: string[]): Promise<SystemCalendarEvent[]> {
  if (currentAccess() !== "fullAccess") return [];
  const chosen = ids.length ? ids : (await calendars()).map((c) => c.id);
  if (!chosen.length) return [];
  if (ON_WINDOWS) return (await systemCall<SystemCalendarEvent[]>("calendarEvents", { start, end, ids: chosen })) ?? [];
  return edsEvents(start, end, chosen);
}

export const calendarServices = {
  authorizationStatus: currentAccess,
  requestAccess,
  calendars,
  events,
};
