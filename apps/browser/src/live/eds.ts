import type { SystemCalendar } from "@astro-browser/shell";

export type EdsSource = { uid: string; data: string };

type KeyFile = Record<string, Record<string, string>>;

export function parseKeyFile(data: string): KeyFile {
  const out: KeyFile = {};
  let section: Record<string, string> | null = null;
  for (const raw of data.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const header = /^\[(.+)\]$/.exec(line);
    if (header) {
      section = out[header[1]!] ??= {};
      continue;
    }
    const eq = line.indexOf("=");
    if (!section || eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    if (key.includes("[")) continue;
    section[key] = line
      .slice(eq + 1)
      .trim()
      .replace(/\\([sntr\\])/g, (_, c: string) => ({ s: " ", n: "\n", t: "\t", r: "\r", "\\": "\\" })[c]!);
  }
  return out;
}

const ACCOUNT_TYPES: Record<string, SystemCalendar["accountType"]> = {
  local: "local",
  caldav: "calDAV",
  google: "calDAV",
  webcal: "subscribed",
  contacts: "birthdays",
  ews: "exchange",
  microsoft365: "exchange",
};

const READ_ONLY = new Set(["webcal", "contacts"]);
const HIDDEN_BACKENDS = new Set(["weather"]);

const normalizedColor = (color: string | undefined) => {
  const hex = /^#?([0-9a-f]{6})(?:[0-9a-f]{2})?$/i.exec(color?.trim() ?? "");
  if (hex) return `#${hex[1]!.toUpperCase()}`;
  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(color?.trim() ?? "");
  return short ? `#${short.slice(1).map((c) => c + c).join("").toUpperCase()}` : "#8E8E93";
};

export function edsCalendars(sources: EdsSource[]): SystemCalendar[] {
  const parsed = new Map(sources.map((s) => [s.uid, parseKeyFile(s.data)]));
  const enabled = (uid: string, depth = 0): boolean => {
    const file = parsed.get(uid);
    if (!file) return true;
    if (file["Data Source"]?.Enabled === "false") return false;
    const parent = file["Data Source"]?.Parent;
    return !parent || depth > 8 || enabled(parent, depth + 1);
  };
  const out: SystemCalendar[] = [];
  for (const { uid } of sources) {
    const file = parsed.get(uid)!;
    const calendar = file.Calendar;
    const backend = calendar?.BackendName ?? "";
    if (!calendar || HIDDEN_BACKENDS.has(backend) || !enabled(uid)) continue;
    const parent = file["Data Source"]?.Parent;
    const account = parent ? parsed.get(parent)?.["Data Source"]?.DisplayName : undefined;
    out.push({
      id: uid,
      title: file["Data Source"]?.DisplayName || uid,
      color: normalizedColor(calendar.Color),
      account: account ?? "",
      accountType: ACCOUNT_TYPES[backend] ?? "other",
      owned: !READ_ONLY.has(backend),
    });
  }
  return out.sort((a, b) => a.account.localeCompare(b.account) || a.title.localeCompare(b.title));
}
