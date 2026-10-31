import type { CalendarEvent, CalendarInfo } from "./meetings";

export type NiloColor = "default" | "gray" | "brown" | "orange" | "yellow" | "green" | "blue" | "purple" | "pink" | "red";

export type NiloCalendar = {
  id: string;
  workspaceId: string;
  name: string;
  isDefault: boolean;
  role: "viewer" | "commenter" | "editor" | "admin" | "owner";
  subscribed?: boolean;
  colors: { id: string; name: string; color: NiloColor }[];
};

export type NiloCalendarEvent = {
  id: string;
  rowId: string;
  calendarId: string;
  title: string;
  allDay: boolean;
  start: string;
  end: string;
  location: string | null;
  url: string | null;
  description: string | null;
  color: { id: string; name: string; color: NiloColor } | null;
  seriesStart: string | null;
};

const PALETTE: Record<NiloColor, string> = {
  default: "#2383E2",
  gray: "#9B9A97",
  brown: "#9F6B53",
  orange: "#D9730D",
  yellow: "#CB912F",
  green: "#448361",
  blue: "#337EA9",
  purple: "#9065B0",
  pink: "#C14C8A",
  red: "#D44C47",
};

const ACCOUNT = "Oxy";

const calendarColor = (calendar: NiloCalendar | undefined) => PALETTE[calendar?.colors[0]?.color ?? "default"];

export function toCalendarInfo(calendar: NiloCalendar): CalendarInfo {
  return {
    id: calendar.id,
    title: calendar.name,
    color: calendarColor(calendar),
    account: ACCOUNT,
    owned: !calendar.subscribed && (calendar.role === "owner" || calendar.role === "admin"),
    subscribed: !!calendar.subscribed,
  };
}

function localDay(day: string): number {
  const [year, month, date] = day.split("-").map(Number);
  return new Date(year!, month! - 1, date!).getTime();
}

const instant = (event: NiloCalendarEvent, value: string) => (event.allDay ? localDay(value) : Date.parse(value));

export function toCalendarEvent(event: NiloCalendarEvent, calendars: Map<string, NiloCalendar>): CalendarEvent {
  return {
    id: event.id,
    occurrence: event.seriesStart ? `${event.rowId}@${event.start}` : event.rowId,
    calendarId: event.calendarId,
    color: event.color ? PALETTE[event.color.color] : calendarColor(calendars.get(event.calendarId)),
    title: event.title,
    start: instant(event, event.start),
    end: instant(event, event.end),
    allDay: event.allDay,
    location: event.location ?? "",
    notes: event.description ?? "",
    url: event.url ?? "",
    cancelled: false,
    declined: false,
    organizer: null,
    attendees: [],
  };
}
