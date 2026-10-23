import type { Step, Window } from "../lib/range";

const TYPED_COLUMNS_LIVE = true;

const TYPED_COLUMNS: Record<string, string> = {
  $lib: "lib",
  $host: "host",
  $os: "os",
  $device_type: "device_type",
  $browser: "browser",
  $app_version: "app_version",
  version: "version",
  $pathname: "pathname",
  $referring_domain: "referring_domain",
  $geoip_country_code: "country",
};

export const prop = (key: string) => (TYPED_COLUMNS_LIVE && TYPED_COLUMNS[key] ? TYPED_COLUMNS[key] : `properties['${key}']`);

export const HOSTS = "'astro.oxy.so', 'www.astro.oxy.so', 'netnyahoo.com', 'www.netnyahoo.com'";
export const SITE = `(source IN ('astro-site', 'netnyahoo-site', 'posthog-cloud') AND ${prop("$lib")} IN ('web', 'astro-web', 'netnyahoo-web') AND ${prop("$host")} IN (${HOSTS}))`;
export const APP_LIB = `(source IN ('astro-app', 'netnyahoo-app', 'posthog-cloud') AND ${prop("$lib")} IN ('astro-telemetry', 'netnyahoo-telemetry'))`;
export const APP_EVENTS = [
  "app_launched",
  "app_session_ended",
  "app_updated",
  "command_bar_opened",
  "extension_installed",
  "perf_journeys",
  "perf_launch",
  "perf_memory",
  "perf_omnibox",
  "profile_switched",
  "settings_section_opened",
  "sharing_turned_on",
  "split_view_opened",
  "suggestion_chosen",
  "sync_toggled",
  "translate_used",
  "usage_counts",
];
export const APP_EVENT_LIST = APP_EVENTS.map((e) => `'${e}'`).join(", ");
export const APP = `(event IN (${APP_EVENT_LIST}) AND ${APP_LIB})`;
export const MAC = `(${prop("$os")} = 'Mac OS X' AND ${prop("$device_type")} = 'Desktop')`;
export const PHONE = `(${prop("$device_type")} IN ('Mobile', 'Tablet'))`;
export const ASTRO_VERSION = `match(${prop("version")}, '^0\\\\.[0-9]+\\\\.[0-9]+(-nightly\\\\.[0-9]+)?$')`;
export const NIGHTLY = `position(${prop("version")}, '-nightly') > 0`;
export const FIRST = `properties['first'] = 'true'`;

export const at = (ms: number) => `toDateTime64(${(ms / 1000).toFixed(3)}, 3, 'UTC')`;

export const since = (ms: number) => `timestamp >= ${at(ms)}`;
export const compareStart = (w: Window) => w.prevStart ?? w.start;
export const isCurrent = (w: Window) => `(timestamp >= ${at(w.start)})`;
export const isPrevious = (w: Window) =>
  w.prevStart === null ? "0" : `(timestamp >= ${at(w.prevStart)} AND timestamp < ${at(w.start)})`;

export const bucket = (step: Step) =>
  step === "hour" ? "toUnixTimestamp(toStartOfHour(timestamp)) * 1000" : "toUnixTimestamp(toStartOfDay(timestamp)) * 1000";

export const dayBucket = "toUnixTimestamp(toStartOfDay(timestamp)) * 1000";
