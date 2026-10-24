import type { NiloCalendar, NiloCalendarEvent } from "./niloCalendar";

type Page<T> = { items: T[]; nextCursor: string | null };

export class NiloError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(`Nilo answered ${status}${code ? ` (${code})` : ""}`);
  }
}

const MAX_PAGES = 8;
const MAX_CALENDARS = 50;

async function read<T>(niloFetch: typeof fetch, path: string): Promise<T> {
  const response = await niloFetch(path, { headers: { accept: "application/json" } });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: { code?: string } } | null;
    throw new NiloError(response.status, body?.error?.code ?? "");
  }
  return (await response.json()) as T;
}

export async function niloCalendars(niloFetch: typeof fetch): Promise<NiloCalendar[]> {
  return (await read<Page<NiloCalendar>>(niloFetch, "/calendar/calendars")).items;
}

export async function niloEvents(
  niloFetch: typeof fetch,
  query: { from: number; to: number; calendarIds: string[]; timeZone: string },
): Promise<NiloCalendarEvent[]> {
  const events: NiloCalendarEvent[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < MAX_PAGES; page++) {
    const params = new URLSearchParams({
      from: new Date(query.from).toISOString(),
      to: new Date(query.to).toISOString(),
      calendarIds: query.calendarIds.slice(0, MAX_CALENDARS).join(","),
      timeZone: query.timeZone,
      limit: "250",
    });
    if (cursor) params.set("cursor", cursor);
    const result: Page<NiloCalendarEvent> = await read(niloFetch, `/calendar/events?${params}`);
    events.push(...result.items);
    cursor = result.nextCursor;
    if (!cursor) break;
  }
  return events;
}
