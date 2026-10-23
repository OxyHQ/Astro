const seen = new Set<string>();

export function noteMissing(what: string) {
  if (seen.has(what)) return;
  seen.add(what);
  console.info(`[astro demo] not on the web: ${what}`);
}

export const missingOnWeb = () => [...seen].sort();

Object.assign(globalThis, { astroDemoMissing: missingOnWeb });
