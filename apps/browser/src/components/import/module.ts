import type * as ImportApi from "@astro-browser/import";

let api: typeof ImportApi | null | undefined;

export function importModule(): typeof ImportApi | null {
  if (api === undefined) {
    try {
      api = require("@astro-browser/import") as typeof ImportApi;
    } catch {
      api = null;
    }
  }
  return api;
}
