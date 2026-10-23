export const SUNRISE_HOLD_MS = 300;
export const DAY_MOVE_MS = 2850;

let startedAt: number | null = null;

export function startSunrise(hero: HTMLElement) {
  if (startedAt !== null) return;
  startedAt = performance.now();
  hero.dataset.sunrise = "run";
}

export function sunriseElapsed(now = performance.now()) {
  return startedAt === null ? 0 : now - startedAt;
}

export function easeInOutSine(t: number) {
  const x = Math.min(1, Math.max(0, t));
  return (1 - Math.cos(Math.PI * x)) / 2;
}

export function sunriseProgress(elapsed: number) {
  return easeInOutSine((elapsed - SUNRISE_HOLD_MS) / DAY_MOVE_MS);
}
