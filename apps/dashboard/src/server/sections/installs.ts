import { windowFor, type RangeKey } from "../../lib/range";
import { num, query, str } from "../clickhouse";
import { github, type Release } from "../github";
import { ASTRO_VERSION, FIRST, NIGHTLY, dayBucket, since, prop } from "../sql";
import { dayBuckets, floorDay } from "../series";

const DAY = 86_400_000;
const TOP_VERSIONS = 5;

export const compareVersions = (a: string, b: string) => {
  const parse = (v: string) => {
    const [core = "", pre = ""] = v.split("-nightly.");
    return [...core.split(".").map(Number), pre ? Number(pre) : Number.POSITIVE_INFINITY];
  };
  const pa = parse(a);
  const pb = parse(b);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
};

export async function installsDaily(range: RangeKey, signal?: AbortSignal) {
  const w = windowFor(range);
  const days = dayBuckets(w.start, w.end);
  const rows = (
    await query(
      `SELECT ${dayBucket} AS d, ${prop("version")} AS v, count(), countIf(${FIRST})
       FROM telemetry.events
       WHERE event = 'update_check' AND ${since(days[0]!)} AND ${ASTRO_VERSION}
       GROUP BY d, v ORDER BY d, v`,
      signal,
    )
  ).map((r) => ({ day: num(r[0]), version: str(r[1]), checks: num(r[2]), first: num(r[3]) }));

  const index = new Map(days.map((d, i) => [d, i]));
  const zeros = () => days.map(() => 0);
  const firstLaunches = zeros();
  const stable = zeros();
  const nightly = zeros();
  const byVersion = new Map<string, number>();
  for (const r of rows) {
    const i = index.get(r.day);
    if (i === undefined) continue;
    firstLaunches[i]! += r.first;
    if (r.version.includes("-nightly")) nightly[i]! += r.checks;
    else stable[i]! += r.checks;
    byVersion.set(r.version, (byVersion.get(r.version) ?? 0) + r.checks);
  }
  const top = [...byVersion]
    .filter(([v]) => !v.includes("-nightly"))
    .sort((a, b) => b[1] - a[1])
    .slice(0, TOP_VERSIONS)
    .map(([v]) => v)
    .sort(compareVersions)
    .reverse();
  const keys = [...top, "nightly", "older"];
  const adoption = new Map(keys.map((k) => [k, zeros()]));
  for (const r of rows) {
    const i = index.get(r.day);
    if (i === undefined) continue;
    const key = r.version.includes("-nightly") ? "nightly" : top.includes(r.version) ? r.version : "older";
    adoption.get(key)![i]! += r.checks;
  }
  const yesterdayIndex = index.get(floorDay(w.end) - DAY);
  const yesterdayChecks = yesterdayIndex === undefined ? null : stable[yesterdayIndex]! + nightly[yesterdayIndex]!;
  return {
    range: w.range,
    days,
    firstLaunches,
    checks: [
      { key: "stable", label: "Stable", values: stable },
      { key: "nightly", label: "Nightly", values: nightly },
    ],
    adoption: keys.map((key) => ({ key, label: key === "nightly" ? "Nightlies" : key === "older" ? "Older" : key, values: adoption.get(key)! })),
    channel: { stable: stable.reduce((s, x) => s + x, 0), nightly: nightly.reduce((s, x) => s + x, 0) },
    firstInRange: firstLaunches.reduce((s, x) => s + x, 0),
    yesterday: yesterdayChecks === null ? null : { low: Math.ceil(yesterdayChecks / 3), high: yesterdayChecks },
  };
}

export async function installsVersions(range: RangeKey, signal?: AbortSignal) {
  const w = windowFor(range);
  const firstDay = floorDay(w.start);
  const [perVersion, gh] = await Promise.all([
    query(
      `SELECT ${prop("version")} AS v, count(), countIf(${FIRST}), max(toUnixTimestamp64Milli(timestamp)), countIf(${since(firstDay)}), ${NIGHTLY}
       FROM telemetry.events
       WHERE event = 'update_check' AND ${ASTRO_VERSION}
       GROUP BY v, ${NIGHTLY}`,
      signal,
    ),
    github().catch((error: unknown) => ({ error: String((error as Error).message ?? error), releases: [] as Release[] })),
  ]);
  const releases = gh.releases;
  const releaseByVersion = new Map(releases.map((r) => [r.version, r]));
  const versions = perVersion.map((r) => {
    const version = str(r[0]);
    const release = releaseByVersion.get(version);
    return {
      version,
      nightly: num(r[5]) === 1,
      checks: num(r[1]),
      first: num(r[2]),
      lastSeen: num(r[3]),
      checksInRange: num(r[4]),
      published: release?.published ?? null,
      dmg: release ? release.dmg : null,
      zip: release ? release.zip : null,
    };
  });
  for (const release of releases) {
    if (release.tag === "nightly" || versions.some((v) => v.version === release.version)) continue;
    versions.push({ version: release.version, nightly: release.prerelease, checks: 0, first: 0, lastSeen: 0, checksInRange: 0, published: release.published, dmg: release.dmg, zip: release.zip });
  }
  versions.sort((a, b) => compareVersions(b.version, a.version));
  const counted = versions.filter((v) => !v.nightly && compareVersions(v.version, "0.2.14") >= 0);
  const nightlyRelease = releases.find((r) => r.tag === "nightly");
  return {
    versions,
    firstAllTime: versions.reduce((s, v) => s + v.first, 0),
    funnel: { dmg: counted.reduce((s, v) => s + (v.dmg ?? 0), 0), first: counted.reduce((s, v) => s + v.first, 0) },
    nightlyRelease: nightlyRelease ? { dmg: nightlyRelease.dmg, zip: nightlyRelease.zip } : null,
    githubError: gh.error,
  };
}
