import { stepMs, windowFor, type RangeKey } from "../../lib/range";
import { num, query } from "../clickhouse";
import { classifyNoise } from "../noise";
import { APP, ASTRO_VERSION, FIRST, MAC, SITE, bucket, compareStart, dayBucket, isCurrent, isPrevious, since } from "../sql";
import { dayBuckets, fill, floorDay, windowInfo } from "../series";

const DAY = 86_400_000;

export async function overviewSite(range: RangeKey, signal?: AbortSignal) {
  const w = windowFor(range);
  const cur = isCurrent(w);
  const prev = isPrevious(w);
  const rows = await query(
    `SELECT ${bucket(w.step)} AS b,
       uniqIf(distinct_id, event = '$pageview'),
       uniqIf(distinct_id, event = '$pageview' AND ${MAC}),
       uniqIf(distinct_id, event = 'download_clicked'),
       uniqIf(distinct_id, event = 'download_clicked' AND ${MAC}),
       uniqIf(distinct_id, event = '$pageview' AND ${cur}),
       uniqIf(distinct_id, event = '$pageview' AND ${MAC} AND ${cur}),
       uniqIf(distinct_id, event = 'download_clicked' AND ${cur}),
       uniqIf(distinct_id, event = 'download_clicked' AND ${MAC} AND ${cur}),
       uniqIf(distinct_id, event = '$pageview' AND ${prev}),
       uniqIf(distinct_id, event = '$pageview' AND ${MAC} AND ${prev}),
       uniqIf(distinct_id, event = 'download_clicked' AND ${prev}),
       uniqIf(distinct_id, event = 'download_clicked' AND ${MAC} AND ${prev})
     FROM telemetry.events
     WHERE event IN ('$pageview', 'download_clicked') AND ${since(compareStart(w))} AND ${SITE}
     GROUP BY GROUPING SETS ((b), ())`,
    signal,
  );
  const total = (rows.find((r) => num(r[0]) === 0) ?? []).map(num);
  const buckets = rows.filter((r) => num(r[0]) !== 0);
  const hasPrev = w.prevStart !== null;
  const pair = (i: number) => ({ value: total[i] ?? 0, previous: hasPrev ? (total[i + 4] ?? 0) : null });
  return {
    window: windowInfo(w),
    visitors: { ...pair(5), series: fill(w.buckets, buckets, 1) },
    macVisitors: { ...pair(6), series: fill(w.buckets, buckets, 2) },
    clickers: { ...pair(7), series: fill(w.buckets, buckets, 3) },
    macClickers: { ...pair(8), series: fill(w.buckets, buckets, 4) },
  };
}

export async function overviewInstalls(range: RangeKey, signal?: AbortSignal) {
  const w = windowFor(range);
  const from = floorDay(compareStart(w));
  const rows = await query(
    `SELECT ${dayBucket} AS b, countIf(${FIRST}), count()
     FROM telemetry.events
     WHERE event = 'update_check' AND ${since(from)} AND ${ASTRO_VERSION}
     GROUP BY b ORDER BY b`,
    signal,
  );
  const days = dayBuckets(from, w.end);
  const first = fill(days, rows, 1);
  const checks = fill(days, rows, 2);
  const windowDay = floorDay(w.start);
  const today = floorDay(w.end);
  const pick = (values: number[], test: (d: number) => boolean) => days.map((d, i) => [d, values[i]!] as const).filter(([d]) => test(d));
  const sum = (list: (readonly [number, number])[]) => list.reduce((s, [, v]) => s + v, 0);
  const avgComplete = (list: (readonly [number, number])[]) => {
    const complete = list.filter(([d]) => d < today);
    return complete.length ? sum(complete) / complete.length : null;
  };
  const currentFirst = pick(first, (d) => d >= windowDay);
  const currentChecks = pick(checks, (d) => d >= windowDay);
  const yesterday = checks[days.indexOf(today - DAY)] ?? null;
  const hasPrev = w.prevStart !== null;
  return {
    days: currentFirst.map(([d]) => d),
    first: { value: sum(currentFirst), previous: hasPrev ? sum(pick(first, (d) => d < windowDay)) : null, series: currentFirst.map(([, v]) => v) },
    checks: {
      series: currentChecks.map(([, v]) => v),
      yesterday,
      avg: avgComplete(currentChecks),
      avgPrevious: hasPrev ? avgComplete(pick(checks, (d) => d < windowDay)) : null,
    },
  };
}

export async function overviewApp(range: RangeKey, signal?: AbortSignal) {
  const w = windowFor(range);
  const rows = await query(
    `SELECT ${bucket(w.step)} AS b, uniq(distinct_id), uniqIf(distinct_id, ${isCurrent(w)}), uniqIf(distinct_id, ${isPrevious(w)})
     FROM telemetry.events
     WHERE ${APP} AND ${since(compareStart(w))}
     GROUP BY GROUPING SETS ((b), ())`,
    signal,
  );
  const total = (rows.find((r) => num(r[0]) === 0) ?? []).map(num);
  return {
    value: total[2] ?? 0,
    previous: w.prevStart !== null ? (total[3] ?? 0) : null,
    series: fill(
      w.buckets,
      rows.filter((r) => num(r[0]) !== 0),
      1,
    ),
  };
}

export async function overviewErrors(range: RangeKey, signal?: AbortSignal) {
  const w = windowFor(range);
  const from = compareStart(w);
  const rows = await query(
    `SELECT toUnixTimestamp64Milli(timestamp), if(${SITE}, 'site', 'app'), properties['$exception_values'], substring(properties['$exception_list'], 1, 3000), properties['$raw_user_agent']
     FROM telemetry.events
     WHERE event = '$exception' AND ${since(from)} AND (${SITE} OR source IN ('astro-app', 'netnyahoo-app', 'posthog-cloud'))
     ORDER BY timestamp DESC
     LIMIT 5000`,
    signal,
  );
  const size = stepMs(w.step);
  const series = w.buckets.map(() => 0);
  let value = 0;
  let previous = 0;
  for (const r of rows) {
    const t = num(r[0]);
    let message = "";
    try {
      message = String((JSON.parse(String(r[2])) as unknown[])[0] ?? "");
    } catch {
      message = "";
    }
    if (classifyNoise(String(r[1]), message, String(r[3]), String(r[4]))) continue;
    if (t >= w.start) {
      value++;
      const i = Math.floor((t - w.start) / size);
      if (i >= 0 && i < series.length) series[i]!++;
    } else previous++;
  }
  return { value, previous: w.prevStart !== null ? previous : null, series };
}
