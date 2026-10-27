import { focusWindow, launchEnvironment, readDocument } from "@astro-browser/shell";
import { useEffect, useState } from "react";
import { create } from "zustand";
import { everySlowly } from "../lib/slowTimers";
import { signInWithOxy, useOxySession } from "../oxy/session";
import { useBrowser } from "../store/browser";
import type { CalendarEvent, CalendarInfo } from "./meetings";
import { niloCalendars, niloEvents } from "./nilo";
import { setNiloRooms, startNiloLive } from "./niloLive";
import { toCalendarEvent, toCalendarInfo } from "./niloCalendar";
import { live, updateCalendarSettings, useLive } from "./store";

export const NILO_CALENDAR_SUBSCRIPTIONS_URL = "https://nilo.so/settings/calendars";

export function openNiloCalendarSubscriptions() {
  const s = useBrowser.getState();
  const windowId = s.ui.focusOrder.find((id) => s.windows[id] && !s.windows[id]!.incognito) ?? s.windowOrder.find((id) => !s.windows[id]!.incognito) ?? null;
  if (!windowId) return;
  s.newTab(windowId, { url: NILO_CALENDAR_SUBSCRIPTIONS_URL });
  void focusWindow(windowId);
}

export type CalendarAccess = "unavailable" | "pending" | "signedOut" | "connected" | "fixture";

type CalendarData = {
  access: CalendarAccess;
  calendars: CalendarInfo[];
  events: CalendarEvent[];
  loading: boolean;
  error: string | null;
  lastFetch: number | null;
};

export const useCalendar = create<CalendarData>()(() => ({
  access: "unavailable",
  calendars: [],
  events: [],
  loading: false,
  error: null,
  lastFetch: null,
}));

const HORIZON_MS = 36 * 3_600_000;

type Fixture = {
  calendars: CalendarInfo[];
  events: (Omit<CalendarEvent, "start" | "end" | "occurrence"> & { startInMinutes: number; durationMinutes: number })[];
};

const fixtureMode = (() => {
  try {
    return typeof __DEV__ !== "undefined" && __DEV__ && launchEnvironment("ASTRO_CALENDAR_FIXTURE") === "1";
  } catch {
    return false;
  }
})();
const launchedAt = Date.now();

function loadFixture(): { calendars: CalendarInfo[]; events: CalendarEvent[] } {
  const raw = JSON.parse(readDocument("calendar-fixture.json") ?? '{"calendars":[],"events":[]}') as Fixture;
  const base = Math.floor(launchedAt / 60_000) * 60_000;
  const events = raw.events.map(({ startInMinutes, durationMinutes, ...e }) => {
    const start = base + startInMinutes * 60_000;
    return { ...e, start, end: start + durationMinutes * 60_000, occurrence: `${e.id}@${start}` };
  });
  return { calendars: raw.calendars, events };
}

const visible = (calendars: CalendarInfo[]) => {
  const hidden = new Set(live().calendar.hiddenCalendarIds);
  return calendars.filter((c) => !hidden.has(c.id)).map((c) => c.id);
};

let inflight: Promise<void> | null = null;
let again = false;

export function refreshCalendar(): Promise<void> {
  if (inflight) {
    again = true;
    return inflight;
  }
  const run = async () => {
    useCalendar.setState({ loading: true });
    try {
      if (fixtureMode) {
        const { calendars, events } = loadFixture();
        const ids = new Set(visible(calendars));
        useCalendar.setState({ access: "fixture", calendars, events: events.filter((e) => ids.has(e.calendarId)), error: null, lastFetch: Date.now() });
        return;
      }
      const session = useOxySession.getState();
      const access = sessionAccess();
      if (access !== "connected" || !session.niloFetch) {
        setNiloRooms({ databases: [], workspaces: [] });
        useCalendar.setState({ access, calendars: [], events: [], error: null });
        return;
      }
      const nilo = await niloCalendars(session.niloFetch);
      const calendars = nilo.map(toCalendarInfo);
      const ids = visible(calendars);
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const byId = new Map(nilo.map((c) => [c.id, c]));
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const events = ids.length
        ? (await niloEvents(session.niloFetch, { from: start.getTime(), to: Date.now() + HORIZON_MS, calendarIds: ids, timeZone })).map((e) => toCalendarEvent(e, byId))
        : [];
      if (useOxySession.getState().account?.id !== session.account?.id) return;
      setNiloRooms({ databases: ids, workspaces: [...new Set(nilo.map((c) => c.workspaceId))] });
      useCalendar.setState({ access, calendars, events: events.sort((a, b) => a.start - b.start), error: null, lastFetch: Date.now() });
    } catch (error) {
      useCalendar.setState({ error: String((error as Error)?.message ?? error) });
    } finally {
      useCalendar.setState({ loading: false });
    }
  };
  inflight = run().finally(() => {
    inflight = null;
    if (!again) return;
    again = false;
    void refreshCalendar();
  });
  return inflight;
}

function sessionAccess(): CalendarAccess {
  const session = useOxySession.getState();
  if (!session.available) return "unavailable";
  if (!session.resolved) return "pending";
  return session.account ? "connected" : "signedOut";
}

export async function connectCalendar(): Promise<boolean> {
  if (fixtureMode) {
    await refreshCalendar();
    return true;
  }
  const signedIn = await signInWithOxy();
  if (signedIn) await refreshCalendar();
  return signedIn;
}

export const calendarConnected = () => {
  const access = useCalendar.getState().access;
  return access === "connected" || access === "fixture";
};

let started = false;

export function startCalendar() {
  if (started) return;
  started = true;
  startNiloLive(() => void refreshCalendar());
  void refreshCalendar();
  useOxySession.subscribe((s, prev) => {
    if (s.available !== prev.available || s.resolved !== prev.resolved || s.account?.id !== prev.account?.id || s.niloFetch !== prev.niloFetch) {
      if (!s.account) useCalendar.setState({ calendars: [], events: [], lastFetch: null });
      void refreshCalendar();
    }
  });
  everySlowly({
    every: 5 * 60_000,
    run: () => void refreshCalendar(),
    needed: calendarConnected,
    watch: (changed) => useCalendar.subscribe((s, prev) => s.access !== prev.access && changed()),
  });
  useLive.subscribe((s, prev) => {
    if (s.calendar.hiddenCalendarIds !== prev.calendar.hiddenCalendarIds) void refreshCalendar();
  });
}

export const setCalendarHidden = (id: string, hidden: boolean) => {
  const ids = live().calendar.hiddenCalendarIds.filter((c) => c !== id);
  updateCalendarSettings({ hiddenCalendarIds: hidden ? [...ids, id] : ids });
};

export function useNow(intervalMs = 15_000, enabled = true): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!enabled) return;
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs, enabled]);
  return now;
}
