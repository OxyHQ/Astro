export const RANGES = ["24h", "7d", "30d", "90d", "all"] as const;
export type RangeKey = (typeof RANGES)[number];

export const RANGE_LABEL: Record<RangeKey, string> = {
  "24h": "24 hours",
  "7d": "7 days",
  "30d": "30 days",
  "90d": "90 days",
  all: "All time",
};

export const DATA_START_MS = Date.UTC(2026, 8, 29);

export function parseRange(value: unknown): RangeKey {
  return RANGES.includes(value as RangeKey) ? (value as RangeKey) : "7d";
}

export type Step = "hour" | "day";

export type Window = {
  range: RangeKey;
  step: Step;
  start: number;
  end: number;
  prevStart: number | null;
  buckets: number[];
};

const HOUR = 3_600_000;
const DAY = 86_400_000;

const QUANTUM = 5 * 60_000;

export function windowFor(range: RangeKey, at = Date.now()): Window {
  const now = Math.ceil(at / QUANTUM) * QUANTUM;
  const hourStart = Math.floor(now / HOUR) * HOUR;
  const dayStart = Math.floor(now / DAY) * DAY;
  let start: number;
  let step: Step = "day";
  if (range === "24h") {
    step = "hour";
    start = hourStart - 23 * HOUR;
  } else if (range === "all") {
    start = DATA_START_MS;
  } else {
    const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
    start = dayStart - (days - 1) * DAY;
  }
  const size = step === "hour" ? HOUR : DAY;
  const buckets: number[] = [];
  for (let t = start; t <= now; t += size) buckets.push(t);
  return { range, step, start, end: now, prevStart: range === "all" ? null : start - (now - start), buckets };
}

export const stepMs = (step: Step) => (step === "hour" ? HOUR : DAY);
