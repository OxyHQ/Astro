import type { CalendarParticipant, SystemCalendarEvent } from "@astro-browser/shell";

export type IcsProperty = { name: string; params: Record<string, string>; value: string };
export type IcsComponent = { type: string; props: IcsProperty[]; children: IcsComponent[] };

export function parseIcs(text: string): IcsComponent[] {
  const lines = text.replace(/\r?\n[ \t]/g, "").split(/\r?\n/);
  const root: IcsComponent = { type: "ROOT", props: [], children: [] };
  const stack = [root];
  for (const line of lines) {
    if (!line) continue;
    const prop = parseLine(line);
    if (!prop) continue;
    const top = stack[stack.length - 1]!;
    if (prop.name === "BEGIN") {
      const child: IcsComponent = { type: prop.value.toUpperCase(), props: [], children: [] };
      top.children.push(child);
      stack.push(child);
    } else if (prop.name === "END") {
      if (stack.length > 1) stack.pop();
    } else top.props.push(prop);
  }
  return root.children;
}

function parseLine(line: string): IcsProperty | null {
  let quoted = false;
  let colon = -1;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') quoted = !quoted;
    else if (c === ":" && !quoted) {
      colon = i;
      break;
    }
  }
  if (colon < 0) return null;
  const head = line.slice(0, colon);
  const parts: string[] = [];
  let current = "";
  quoted = false;
  for (const c of head) {
    if (c === '"') quoted = !quoted;
    if (c === ";" && !quoted) {
      parts.push(current);
      current = "";
    } else current += c;
  }
  parts.push(current);
  const params: Record<string, string> = {};
  for (const part of parts.slice(1)) {
    const eq = part.indexOf("=");
    if (eq > 0) params[part.slice(0, eq).toUpperCase()] = part.slice(eq + 1).replace(/^"|"$/g, "");
  }
  return { name: parts[0]!.toUpperCase(), params, value: line.slice(colon + 1) };
}

export const unescapeText = (value: string) =>
  value.replace(/\\([nN,;\\])/g, (_, c: string) => (c === "n" || c === "N" ? "\n" : c));

const prop = (component: IcsComponent, name: string) => component.props.find((p) => p.name === name);
const props = (component: IcsComponent, name: string) => component.props.filter((p) => p.name === name);

type Wall = { y: number; m: number; d: number; h: number; mi: number; s: number };
type IcsTime = { wall: Wall; date: boolean; utc: boolean; tzid: string | null };

function parseTime(value: string, params: Record<string, string>): IcsTime | null {
  const match = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/.exec(value.trim());
  if (!match) return null;
  const [, y, m, d, h, mi, s, z] = match;
  const date = h === undefined || params.VALUE === "DATE";
  return {
    wall: { y: +y!, m: +m!, d: +d!, h: date ? 0 : +h!, mi: date ? 0 : +mi!, s: date || s === undefined ? 0 : +s },
    date,
    utc: z === "Z",
    tzid: params.TZID ?? null,
  };
}

const wallMs = (w: Wall) => Date.UTC(w.y, w.m - 1, w.d, w.h, w.mi, w.s);
const wallOf = (ms: number): Wall => {
  const t = new Date(ms);
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate(), h: t.getUTCHours(), mi: t.getUTCMinutes(), s: t.getUTCSeconds() };
};

const formatters = new Map<string, Intl.DateTimeFormat | null>();

function formatterFor(zone: string): Intl.DateTimeFormat | null {
  if (!formatters.has(zone)) {
    try {
      formatters.set(
        zone,
        new Intl.DateTimeFormat("en-US", {
          timeZone: zone,
          hourCycle: "h23",
          year: "numeric",
          month: "numeric",
          day: "numeric",
          hour: "numeric",
          minute: "numeric",
          second: "numeric",
        }),
      );
    } catch {
      formatters.set(zone, null);
    }
  }
  return formatters.get(zone)!;
}

function intlOffset(format: Intl.DateTimeFormat, utc: number): number {
  const parts: Record<string, number> = {};
  for (const part of format.formatToParts(new Date(utc))) if (part.type !== "literal") parts[part.type] = Number(part.value);
  const local = Date.UTC(parts.year!, parts.month! - 1, parts.day!, parts.hour! % 24, parts.minute!, parts.second!);
  return local - Math.floor(utc / 1000) * 1000;
}

function parseOffset(value: string | undefined): number | null {
  const match = /^([+-])(\d{2})(\d{2})(\d{2})?$/.exec(value?.trim() ?? "");
  if (!match) return null;
  const ms = ((+match[2]! * 60 + +match[3]!) * 60 + +(match[4] ?? 0)) * 1000;
  return match[1] === "-" ? -ms : ms;
}

type Observance = { start: Wall; offset: number; rule: Rule | null; rdates: Wall[] };

export class Zones {
  private readonly definitions = new Map<string, IcsComponent>();
  private readonly resolved = new Map<string, ((wall: number) => number) | null>();

  add(component: IcsComponent) {
    const tzid = prop(component, "TZID")?.value;
    if (tzid && component.type === "VTIMEZONE") this.definitions.set(tzid, component);
  }

  has(tzid: string) {
    return this.definitions.has(tzid) || !!formatterFor(ianaName(tzid));
  }

  instant(time: IcsTime, floatingZone?: string): number {
    const wall = wallMs(time.wall);
    if (time.utc) return wall;
    if (time.date || !time.tzid) return floatingZone ? this.intlInstant(floatingZone, wall) : localInstant(time.wall);
    const toInstant = this.resolve(time.tzid);
    return toInstant ? toInstant(wall) : localInstant(time.wall);
  }

  private intlInstant(zone: string, wall: number) {
    const format = formatterFor(zone);
    if (!format) return wall;
    let guess = wall - intlOffset(format, wall);
    const second = wall - intlOffset(format, guess);
    if (second !== guess) guess = wall - intlOffset(format, second) === second ? second : Math.min(guess, second);
    return guess;
  }

  private resolve(tzid: string) {
    if (!this.resolved.has(tzid)) this.resolved.set(tzid, this.resolver(tzid));
    return this.resolved.get(tzid)!;
  }

  private resolver(tzid: string): ((wall: number) => number) | null {
    const definition = this.definitions.get(tzid);
    const location = definition ? prop(definition, "X-LIC-LOCATION")?.value : undefined;
    for (const name of [tzid, ianaName(tzid), location].filter((n): n is string => !!n)) {
      if (formatterFor(name)) return (wall) => this.intlInstant(name, wall);
    }
    if (!definition) return null;
    const observances: Observance[] = [];
    for (const child of definition.children) {
      if (child.type !== "STANDARD" && child.type !== "DAYLIGHT") continue;
      const start = prop(child, "DTSTART");
      const offset = parseOffset(prop(child, "TZOFFSETTO")?.value);
      const parsed = start && parseTime(start.value, {});
      if (!parsed || offset === null) continue;
      const rrule = prop(child, "RRULE")?.value;
      const rdates = props(child, "RDATE").flatMap((p) => p.value.split(",").map((v) => parseTime(v, {})?.wall).filter((w): w is Wall => !!w));
      observances.push({ start: parsed.wall, offset, rule: rrule ? parseRule(rrule) : null, rdates });
    }
    if (!observances.length) return null;
    return (wall) => wall - observanceOffset(observances, wall);
  }
}

function observanceOffset(observances: Observance[], wall: number): number {
  let best: { onset: number; offset: number } | null = null;
  for (const o of observances) {
    const onsets = [wallMs(o.start), ...o.rdates.map(wallMs)];
    if (o.rule) {
      const from = wallMs({ ...wallOf(wall), m: 1, d: 1, h: 0, mi: 0, s: 0 }) - 400 * 86_400_000;
      onsets.push(...expandWalls(o.rule, o.start, from, wall + 1, null));
    }
    for (const onset of onsets) if (onset <= wall && (!best || onset > best.onset)) best = { onset, offset: o.offset };
  }
  return best?.offset ?? observances[0]!.offset;
}

function ianaName(tzid: string) {
  const prefixed = /^\/[^/]+\.[^/]+\/(?:Tzfile\/)?(.+)$/.exec(tzid);
  return prefixed ? prefixed[1]! : tzid;
}

const localInstant = (w: Wall) => new Date(w.y, w.m - 1, w.d, w.h, w.mi, w.s).getTime();

type Frequency = "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";
type ByDay = { weekday: number; ordinal: number | null };
export type Rule = {
  freq: Frequency;
  interval: number;
  count: number | null;
  until: IcsTime | null;
  byDay: ByDay[];
  byMonthDay: number[];
  byMonth: number[];
  bySetPos: number[];
  weekStart: number;
};

const WEEKDAYS = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
const ints = (value: string | undefined) => (value ? value.split(",").map(Number).filter((n) => Number.isInteger(n) && n !== 0) : []);

export function parseRule(text: string): Rule | null {
  const parts = new Map(
    text
      .replace(/^RRULE:/i, "")
      .split(";")
      .map((part) => part.split("=") as [string, string])
      .map(([k, v]) => [k?.toUpperCase(), v?.toUpperCase()] as const),
  );
  const freq = parts.get("FREQ") as Frequency | undefined;
  if (!freq || !["DAILY", "WEEKLY", "MONTHLY", "YEARLY"].includes(freq)) return null;
  if (parts.has("BYYEARDAY") || parts.has("BYWEEKNO") || parts.has("BYHOUR") || parts.has("BYMINUTE")) return null;
  const until = parts.get("UNTIL");
  const byDay: ByDay[] = [];
  for (const item of parts.get("BYDAY")?.split(",") ?? []) {
    const match = /^([+-]?\d{1,2})?(SU|MO|TU|WE|TH|FR|SA)$/.exec(item);
    if (!match) return null;
    byDay.push({ weekday: WEEKDAYS.indexOf(match[2]!), ordinal: match[1] ? Number(match[1]) : null });
  }
  const interval = Number(parts.get("INTERVAL") ?? 1);
  const count = parts.has("COUNT") ? Number(parts.get("COUNT")) : null;
  return {
    freq,
    interval: Number.isInteger(interval) && interval > 0 ? interval : 1,
    count: count !== null && Number.isInteger(count) && count > 0 ? count : null,
    until: until ? parseTime(until, {}) : null,
    byDay,
    byMonthDay: ints(parts.get("BYMONTHDAY")),
    byMonth: ints(parts.get("BYMONTH")),
    bySetPos: ints(parts.get("BYSETPOS")),
    weekStart: Math.max(0, WEEKDAYS.indexOf(parts.get("WKST") ?? "MO")),
  };
}

const DAY = 86_400_000;
const dayNumber = (y: number, m: number, d: number) => Math.floor(Date.UTC(y, m - 1, d) / DAY);
const weekdayOf = (day: number) => (((day + 4) % 7) + 7) % 7;
const daysIn = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();

function monthDays(rule: Rule, y: number, m: number, startDay: Wall): number[] {
  const length = daysIn(y, m);
  const first = dayNumber(y, m, 1);
  const days: number[] = [];
  if (rule.byDay.length) {
    for (const { weekday, ordinal } of rule.byDay) {
      const matches: number[] = [];
      for (let d = first + ((weekday - weekdayOf(first) + 7) % 7); d < first + length; d += 7) matches.push(d);
      if (ordinal === null) days.push(...matches);
      else {
        const pick = ordinal > 0 ? matches[ordinal - 1] : matches[matches.length + ordinal];
        if (pick !== undefined) days.push(pick);
      }
    }
    if (rule.byMonthDay.length) {
      const allowed = new Set(rule.byMonthDay.map((d) => (d > 0 ? d : length + d + 1)));
      return days.filter((day) => allowed.has(day - first + 1));
    }
    return days;
  }
  for (const date of rule.byMonthDay.length ? rule.byMonthDay : [startDay.d]) {
    const resolved = date > 0 ? date : length + date + 1;
    if (resolved >= 1 && resolved <= length) days.push(first + resolved - 1);
  }
  return days;
}

function periodDays(rule: Rule, start: Wall, k: number): number[] {
  const first = dayNumber(start.y, start.m, start.d);
  const step = k * rule.interval;
  let days: number[];
  switch (rule.freq) {
    case "DAILY":
      days = [first + step];
      if (rule.byDay.length && !rule.byDay.some((b) => b.weekday === weekdayOf(days[0]!))) days = [];
      if (rule.byMonthDay.length) {
        const w = wallOf(days[0]! * DAY);
        if (!rule.byMonthDay.some((d) => (d > 0 ? d : daysIn(w.y, w.m) + d + 1) === w.d)) days = [];
      }
      break;
    case "WEEKLY": {
      const weekStart = first - ((weekdayOf(first) - rule.weekStart + 7) % 7) + 7 * step;
      const weekdays = rule.byDay.length ? rule.byDay.map((b) => b.weekday) : [weekdayOf(first)];
      days = weekdays.map((w) => weekStart + ((w - rule.weekStart + 7) % 7));
      break;
    }
    case "MONTHLY": {
      const index = start.y * 12 + start.m - 1 + step;
      days = monthDays(rule, Math.floor(index / 12), (index % 12) + 1, start);
      break;
    }
    case "YEARLY": {
      const y = start.y + step;
      const months = rule.byMonth.length ? rule.byMonth : [start.m];
      days = months.flatMap((m) =>
        rule.byDay.length || rule.byMonthDay.length
          ? monthDays(rule, y, m, start)
          : start.d <= daysIn(y, m)
            ? [dayNumber(y, m, start.d)]
            : [],
      );
      break;
    }
  }
  if (rule.byMonth.length && rule.freq !== "YEARLY") days = days.filter((day) => rule.byMonth.includes(wallOf(day * DAY).m));
  days = [...new Set(days)].sort((a, b) => a - b);
  if (rule.bySetPos.length) {
    const picked = rule.bySetPos.map((p) => (p > 0 ? days[p - 1] : days[days.length + p])).filter((d): d is number => d !== undefined);
    days = [...new Set(picked)].sort((a, b) => a - b);
  }
  return days;
}

const MAX_PERIODS = 50_000;

function expandWalls(rule: Rule, start: Wall, fromWall: number, toWall: number, untilInstant: ((wall: number) => boolean) | null): number[] {
  const out: number[] = [];
  const startMs = wallMs(start);
  const timeOfDay = startMs - dayNumber(start.y, start.m, start.d) * DAY;
  const periodLength = { DAILY: 1, WEEKLY: 7, MONTHLY: 28, YEARLY: 365 }[rule.freq] * rule.interval * DAY;
  const skip = rule.count === null && fromWall > startMs ? Math.max(0, Math.floor((fromWall - startMs) / periodLength) - 2) : 0;
  let seen = 1;
  if (untilInstant?.(startMs) || startMs >= toWall) return out;
  if (startMs >= fromWall) out.push(startMs);
  for (let k = skip; k < skip + MAX_PERIODS; k++) {
    for (const day of periodDays(rule, start, k)) {
      const wall = day * DAY + timeOfDay;
      if (wall <= startMs) continue;
      seen += 1;
      if (rule.count !== null && seen > rule.count) return out;
      if (untilInstant && untilInstant(wall)) return out;
      if (wall >= toWall) return out;
      if (wall >= fromWall) out.push(wall);
    }
  }
  return out;
}

export type CalendarSource = { calendarId: string; color: string; email: string };

function participant(p: IcsProperty, email: string): CalendarParticipant {
  const address = p.value.replace(/^mailto:/i, "");
  const status = (p.params.PARTSTAT ?? "").toUpperCase();
  return {
    name: p.params.CN ?? "",
    email: /^mailto:/i.test(p.value) ? address : "",
    status: status === "ACCEPTED" ? "accepted" : status === "DECLINED" ? "declined" : status === "TENTATIVE" ? "tentative" : "pending",
    me: !!email && address.toLowerCase() === email.toLowerCase(),
  };
}

function parseDuration(value: string | undefined): number | null {
  const match = /^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(value?.trim() ?? "");
  if (!match) return null;
  const [, sign, w, d, h, m, s] = match;
  const ms = ((((+(w ?? 0) * 7 + +(d ?? 0)) * 24 + +(h ?? 0)) * 60 + +(m ?? 0)) * 60 + +(s ?? 0)) * 1000;
  return sign === "-" ? -ms : ms;
}

type Shape = { start: IcsTime; length: number; dayLength: number };

function shape(event: IcsComponent): Shape | null {
  const startProp = prop(event, "DTSTART");
  const start = startProp && parseTime(startProp.value, startProp.params);
  if (!start) return null;
  const endProp = prop(event, "DTEND");
  const end = endProp && parseTime(endProp.value, endProp.params);
  const duration = parseDuration(prop(event, "DURATION")?.value);
  if (start.date) {
    const days = end ? Math.max(1, dayNumber(end.wall.y, end.wall.m, end.wall.d) - dayNumber(start.wall.y, start.wall.m, start.wall.d)) : duration !== null ? Math.max(1, Math.round(duration / DAY)) : 1;
    return { start, length: 0, dayLength: days };
  }
  return { start, length: end ? -1 : Math.max(0, duration ?? 0), dayLength: 0 };
}

function times(zones: Zones, s: Shape, startWall: Wall, event: IcsComponent): { start: number; end: number } {
  if (s.start.date) {
    const start = localInstant(startWall);
    const endDay = wallOf((dayNumber(startWall.y, startWall.m, startWall.d) + s.dayLength) * DAY);
    return { start, end: localInstant(endDay) };
  }
  const start = zones.instant({ ...s.start, wall: startWall });
  if (s.length >= 0) return { start, end: start + s.length };
  const endProp = prop(event, "DTEND")!;
  const end = parseTime(endProp.value, endProp.params)!;
  const first = zones.instant(s.start);
  return { start, end: start + Math.max(0, zones.instant(end) - first) };
}

function toEvent(event: IcsComponent, source: CalendarSource, start: number, end: number, allDay: boolean): SystemCalendarEvent {
  const uid = prop(event, "UID")?.value ?? "";
  const text = (name: string) => unescapeText(prop(event, name)?.value ?? "");
  const attendees = props(event, "ATTENDEE")
    .filter((p) => !["ROOM", "RESOURCE"].includes((p.params.CUTYPE ?? "").toUpperCase()))
    .map((p) => participant(p, source.email));
  const organizer = prop(event, "ORGANIZER");
  const me = attendees.find((a) => a.me);
  return {
    id: uid,
    occurrence: `${uid}@${Math.floor(start / 1000)}`,
    calendarId: source.calendarId,
    color: source.color,
    title: text("SUMMARY"),
    start,
    end,
    allDay,
    location: text("LOCATION"),
    notes: text("DESCRIPTION"),
    url: prop(event, "URL")?.value.trim() ?? "",
    cancelled: (prop(event, "STATUS")?.value ?? "").toUpperCase() === "CANCELLED",
    declined: me?.status === "declined",
    organizer: organizer ? { ...participant(organizer, source.email), status: "accepted" } : null,
    attendees,
  };
}

function timeList(zones: Zones, p: IcsProperty): { instant: number; day: number }[] {
  return p.value
    .split(",")
    .map((v) => parseTime(v, p.params))
    .filter((t): t is IcsTime => !!t)
    .map((t) => ({ instant: zones.instant(t), day: dayNumber(t.wall.y, t.wall.m, t.wall.d) }));
}

export function tzidsIn(components: IcsComponent[]): string[] {
  const out = new Set<string>();
  const walk = (c: IcsComponent) => {
    for (const p of c.props) if (p.params.TZID) out.add(p.params.TZID);
    c.children.forEach(walk);
  };
  components.forEach(walk);
  return [...out];
}

export function eventsFromIcs(components: IcsComponent[], source: CalendarSource, zones: Zones, from: number, to: number): SystemCalendarEvent[] {
  const events = components.flatMap((c) => (c.type === "VCALENDAR" ? c.children : [c])).filter((c) => c.type === "VEVENT");
  const overrides = new Map<string, Map<number, IcsComponent>>();
  const masters: IcsComponent[] = [];
  for (const event of events) {
    const rid = prop(event, "RECURRENCE-ID");
    const uid = prop(event, "UID")?.value ?? "";
    const time = rid && parseTime(rid.value, rid.params);
    if (time) {
      const map = overrides.get(uid) ?? new Map<number, IcsComponent>();
      map.set(time.date ? dayNumber(time.wall.y, time.wall.m, time.wall.d) : zones.instant(time), event);
      overrides.set(uid, map);
    } else masters.push(event);
  }
  const out: SystemCalendarEvent[] = [];
  const push = (event: IcsComponent, s: Shape, wall: Wall) => {
    const { start, end } = times(zones, s, wall, event);
    if (end > from && start < to) out.push(toEvent(event, source, start, end, s.start.date));
    else if (end === start && start >= from && start < to) out.push(toEvent(event, source, start, end, s.start.date));
  };
  const placedOverrides = new Set<IcsComponent>();
  for (const master of masters) {
    const s = shape(master);
    if (!s) continue;
    const uid = prop(master, "UID")?.value ?? "";
    const rruleText = prop(master, "RRULE")?.value;
    const rule = rruleText ? parseRule(rruleText) : null;
    const own = overrides.get(uid);
    if (!rule && !props(master, "RDATE").length) {
      push(master, s, s.start.wall);
      continue;
    }
    const excluded = props(master, "EXDATE").flatMap((p) => timeList(zones, p));
    const isExcluded = (instant: number, day: number) => excluded.some((e) => (s.start.date ? e.day === day : e.instant === instant));
    const span = (s.start.date ? s.dayLength * DAY : Math.max(s.length, DAY)) + 2 * DAY;
    const untilCheck = rule?.until
      ? (wall: number) => {
          const until = rule.until!;
          if (until.date || s.start.date) return Math.floor(wall / DAY) > dayNumber(until.wall.y, until.wall.m, until.wall.d);
          return zones.instant({ ...s.start, wall: wallOf(wall) }) > zones.instant(until);
        }
      : null;
    const walls = rule ? expandWalls(rule, s.start.wall, from - span - 2 * DAY, to + 2 * DAY, untilCheck) : [];
    if (!rule && wallMs(s.start.wall) < to + 2 * DAY) walls.push(wallMs(s.start.wall));
    for (const rdate of props(master, "RDATE")) {
      for (const t of rdate.value.split(",").map((v) => parseTime(v, rdate.params))) {
        if (t) walls.push(t.utc ? wallMs(wallOf(zones.instant(t))) : wallMs(t.wall));
      }
    }
    for (const wallValue of [...new Set(walls)].sort((a, b) => a - b)) {
      const wall = wallOf(wallValue);
      const day = dayNumber(wall.y, wall.m, wall.d);
      const instant = s.start.date ? day : zones.instant({ ...s.start, wall });
      const replacement = own?.get(instant);
      if (replacement) {
        placedOverrides.add(replacement);
        const rs = shape(replacement);
        if (rs) push(replacement, rs, rs.start.wall);
        continue;
      }
      if (isExcluded(s.start.date ? 0 : instant, day)) continue;
      push(master, s, wall);
    }
  }
  for (const [, map] of overrides) {
    for (const [, event] of map) {
      if (placedOverrides.has(event)) continue;
      const s = shape(event);
      if (s) push(event, s, s.start.wall);
    }
  }
  return out;
}
