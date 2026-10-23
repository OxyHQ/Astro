import { windowFor, type RangeKey } from "../../lib/range";
import { num, query, str } from "../clickhouse";
import { APP, bucket, compareStart, isCurrent, isPrevious, since, prop } from "../sql";
import { fill, ratio, windowInfo } from "../series";

const NAMES: Record<string, string> = {
  suggestion_chosen: "Omnibox suggestion chosen",
  perf_memory: "Memory sample",
  settings_section_opened: "Settings section opened",
  command_bar_opened: "Command bar opened",
  usage_counts: "Usage counts",
  perf_journeys: "Journey timings",
  perf_omnibox: "Omnibox timings",
  profile_switched: "Profile switched",
  perf_launch: "Launch timings",
  app_launched: "App launched",
  app_session_ended: "Session ended",
  app_updated: "App updated",
  sharing_turned_on: "Telemetry turned on",
  split_view_opened: "Split view opened",
  translate_used: "Translate used",
  sync_toggled: "Sync toggled",
  extension_installed: "Extension installed",
};

export async function appTrend(range: RangeKey, signal?: AbortSignal) {
  const w = windowFor(range);
  const cur = isCurrent(w);
  const prev = isPrevious(w);
  const launched = "event = 'app_launched'";
  const unclean = `${launched} AND properties['previous_session'] = 'unclean'`;
  const ended = "event = 'app_session_ended'";
  const tabs = "toUInt32OrZero(properties['tabs_opened'])";
  const usage = "event = 'usage_counts'";
  const rows = await query(
    `SELECT ${bucket(w.step)} AS b,
       uniqIf(distinct_id, ${cur}), countIf(${launched} AND ${cur}),
       uniqIf(distinct_id, ${cur}), countIf(${launched} AND ${cur}), countIf(${unclean} AND ${cur}),
       quantileIf(0.5)(toFloat64OrZero(properties['duration_minutes']), ${ended} AND ${cur}), sumIf(${tabs}, ${usage} AND ${cur}),
       uniqIf(distinct_id, ${prev}), countIf(${launched} AND ${prev}), countIf(${unclean} AND ${prev}),
       quantileIf(0.5)(toFloat64OrZero(properties['duration_minutes']), ${ended} AND ${prev}), sumIf(${tabs}, ${usage} AND ${prev})
     FROM telemetry.events
     WHERE ${APP} AND ${since(compareStart(w))}
     GROUP BY GROUPING SETS ((b), ())`,
    signal,
  );
  const total = (rows.find((r) => num(r[0]) === 0) ?? []).map(num);
  const buckets = rows.filter((r) => num(r[0]) !== 0);
  const hasPrev = w.prevStart !== null;
  const pair = (i: number) => ({ value: total[i] ?? 0, previous: hasPrev ? (total[i + 5] ?? 0) : null });
  return {
    window: windowInfo(w),
    kpis: {
      users: pair(3),
      launches: pair(4),
      uncleanRate: { value: ratio(total[5] ?? 0, total[4] ?? 0), previous: hasPrev ? ratio(total[10] ?? 0, total[9] ?? 0) : null },
      medianSession: { value: Math.round(total[6] ?? 0), previous: hasPrev ? Math.round(total[11] ?? 0) : null },
      tabsOpened: pair(7),
    },
    users: fill(w.buckets, buckets, 1),
    launches: fill(w.buckets, buckets, 2),
  };
}

export async function appBreakdowns(range: RangeKey, signal?: AbortSignal) {
  const w = windowFor(range);
  const rows = await query(
    `SELECT dim, key, uniq(distinct_id) AS people, count() AS n, max(toUnixTimestamp64Milli(timestamp))
     FROM (
       SELECT distinct_id, timestamp,
         arrayJoin(arrayConcat(
           [('version', ${prop("$app_version")}), ('os', properties['$os_version']), ('arch', properties['arch']), ('engine', properties['engine_version']), ('event', event)],
           multiIf(
             event = 'settings_section_opened', [('section', properties['section'])],
             event = 'suggestion_chosen', [('suggestion', properties['type'])],
             event = 'app_updated', [('update', concat(properties['from_version'], ' → ', ${prop("$app_version")}))],
             event = 'app_session_ended', [('session', multiIf(toFloat64OrZero(properties['duration_minutes']) < 5, '0|< 5 min', toFloat64OrZero(properties['duration_minutes']) < 30, '1|5–30 min', toFloat64OrZero(properties['duration_minutes']) < 120, '2|30 min–2 h', toFloat64OrZero(properties['duration_minutes']) < 480, '3|2–8 h', '4|8 h +'))],
             []
           )
         )) AS pair,
         pair.1 AS dim, pair.2 AS key
       FROM telemetry.events
       WHERE ${APP} AND ${since(w.start)}
     )
     GROUP BY dim, key
     ORDER BY dim, n DESC
     LIMIT 30 BY dim`,
    signal,
  );
  const of = (dim: string) =>
    rows.filter((r) => str(r[0]) === dim).map((r) => ({ key: str(r[1]) || "unknown", label: str(r[1]) || "Unknown", value: num(r[2]), secondary: num(r[3]), last: num(r[4]) }));
  const byPeople = <T extends { value: number }>(list: T[]) => [...list].sort((a, b) => b.value - a.value);
  return {
    versions: byPeople(of("version")),
    osVersions: byPeople(of("os")).map((r) => ({ ...r, label: r.key === "unknown" ? "Unknown" : `macOS ${r.key}` })),
    arch: byPeople(of("arch")),
    engines: byPeople(of("engine")),
    sections: of("section"),
    suggestions: of("suggestion"),
    events: of("event").map((r) => ({ key: r.key, label: NAMES[r.key] ?? r.key, count: r.secondary, people: r.value, lastSeen: r.last })),
    updates: of("update").map((r) => {
      const [from = "unknown", to = ""] = r.key.split(" → ");
      return { from: from || "unknown", to, count: r.secondary, people: r.value };
    }),
    sessionLengths: of("session")
      .sort((a, b) => a.key.localeCompare(b.key))
      .map((r) => ({ key: r.key, label: r.key.split("|")[1] ?? r.key, value: r.secondary })),
  };
}

export async function appPerf(range: RangeKey, signal?: AbortSignal) {
  const w = windowFor(range);
  const median = (prop: string, event: string) => `quantileIf(0.5)(toFloat64OrZero(properties['${prop}']), event = '${event}' AND properties['${prop}'] != '')`;
  const rows = await query(
    `SELECT ${prop("$app_version")} AS v,
       ${median("usable_ms", "perf_launch")}, countIf(event = 'perf_launch'),
       ${median("p50_ms", "perf_omnibox")},
       ${median("total_mb", "perf_memory")}, ${median("browser_mb", "perf_memory")}, ${median("tabs", "perf_memory")}, countIf(event = 'perf_memory'),
       uniq(distinct_id)
     FROM telemetry.events
     WHERE event IN ('perf_launch', 'perf_omnibox', 'perf_memory') AND ${since(w.start)} AND ${APP}
     GROUP BY v ORDER BY v DESC LIMIT 20`,
    signal,
  );
  return rows.map((r) => ({
    version: str(r[0]),
    launchMs: num(r[1]),
    launches: num(r[2]),
    omniboxMs: num(r[3]),
    totalMb: num(r[4]),
    browserMb: num(r[5]),
    tabs: num(r[6]),
    memorySamples: num(r[7]),
    people: num(r[8]),
  }));
}
