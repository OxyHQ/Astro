import { DAWN_P, GOLDEN_P, MORNING_P } from "./daylight";

interface Leg {
  seconds: number;
  p: number;
  moon: number;
}

const DUSK_P = 0.92;

const LEGS: Leg[] = [
  { seconds: 0, p: 0, moon: 0.82 },
  { seconds: 7, p: DAWN_P, moon: 1 },
  { seconds: 6, p: 0.14, moon: 1 },
  { seconds: 9, p: MORNING_P, moon: 1 },
  { seconds: 12, p: 0.58, moon: 1 },
  { seconds: 12, p: GOLDEN_P, moon: 1 },
  { seconds: 8, p: DUSK_P, moon: 0 },
  { seconds: 7, p: 1, moon: 0.2 },
  { seconds: 16, p: 1, moon: 0.82 },
];

export const CYCLE_SECONDS = LEGS.reduce((sum, leg) => sum + leg.seconds, 0);

const KNOTS = (() => {
  let elapsed = 0;
  return LEGS.map((leg) => {
    elapsed += leg.seconds;
    return { c: elapsed / CYCLE_SECONDS, p: leg.p, moon: leg.moon };
  });
})();

const SLOPES = monotoneSlopes(KNOTS.map((knot) => knot.c), KNOTS.map((knot) => knot.p));

function monotoneSlopes(xs: number[], ys: number[]) {
  const n = xs.length;
  const secants = xs.slice(0, -1).map((x, i) => (ys[i + 1] - ys[i]) / (xs[i + 1] - x));
  const slopes = xs.map((_, i) => {
    if (i === 0) return secants[0];
    if (i === n - 1) return secants[n - 2];
    const a = secants[i - 1];
    const b = secants[i];
    return a * b <= 0 ? 0 : (2 * a * b) / (a + b);
  });
  return slopes;
}

export const wrapCycle = (c: number) => c - Math.floor(c);

export function cycleDelta(from: number, to: number) {
  const delta = wrapCycle(to - from);
  return delta > 0.5 ? delta - 1 : delta;
}

function segmentAt(c: number) {
  let index = 0;
  while (index < KNOTS.length - 2 && KNOTS[index + 1].c <= c) index++;
  return index;
}

export function dayAt(cycle: number) {
  const c = wrapCycle(cycle);
  const i = segmentAt(c);
  const a = KNOTS[i];
  const b = KNOTS[i + 1];
  const span = b.c - a.c;
  const t = (c - a.c) / span;
  const t2 = t * t;
  const t3 = t2 * t;
  const p = (2 * t3 - 3 * t2 + 1) * a.p + (t3 - 2 * t2 + t) * span * SLOPES[i] + (-2 * t3 + 3 * t2) * b.p + (t3 - t2) * span * SLOPES[i + 1];
  const moonLeg = b.moon >= a.moon;
  const moon = moonLeg ? a.moon + (b.moon - a.moon) * t : 1;
  return { p: Math.min(1, Math.max(0, p)), moon };
}

export function cycleAt(p: number) {
  for (let i = 0; i < KNOTS.length - 1; i++) {
    const a = KNOTS[i];
    const b = KNOTS[i + 1];
    if (b.p <= a.p || p < a.p || p > b.p) continue;
    let low = a.c;
    let high = b.c;
    for (let step = 0; step < 30; step++) {
      const mid = (low + high) / 2;
      if (dayAt(mid).p < p) low = mid;
      else high = mid;
    }
    return (low + high) / 2;
  }
  return 0;
}

export const SUN_RANGE: [number, number] = [0, KNOTS[KNOTS.length - 2].c];
export const MOON_RANGE: [number, number] = [KNOTS[KNOTS.length - 3].c, 1 + KNOTS[1].c];
export const CYCLE_STOPS = [cycleAt(MORNING_P), cycleAt(GOLDEN_P), (KNOTS[KNOTS.length - 2].c + 1) / 2];
export const SUNRISE_FROM = cycleAt(DAWN_P);
export const SUNRISE_TO = cycleAt(MORNING_P);
