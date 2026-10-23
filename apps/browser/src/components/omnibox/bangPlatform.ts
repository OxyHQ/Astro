export const refreshesBangs = true;

export const loadBundledBangs = (): Promise<typeof import("@astro-browser/core/src/bangList.ts")> =>
  Promise.resolve().then(() => require("@astro-browser/core/src/bangList.ts"));
