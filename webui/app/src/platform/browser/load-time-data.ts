// The browser's own string table, for the strings the browser NAMES.
//
// Astro's pages carry their own catalogue (`platform/i18n`), and that stays the
// rule: a string this app writes belongs in `en.ts`, where a missing id is a
// type error. This is the exception the rule always had, now that a surface
// exists to need it.
//
// A page that adopts an upstream handler wholesale receives, in some replies,
// GRIT MESSAGE NAMES rather than text — the management page's reporting lists
// answer `{messageId: "managementExtensionReportPerms", …}` and expect the page
// to look the name up. The names are the handler's, they change with a Chromium
// roll, and there are dozens of them; transcribing them into `en.ts` would be
// copying a table this app cannot keep correct.
//
// `loadTimeData` is Chromium's own mechanism for that table, populated by the
// page's C++ controller. Astro's management controller fills it with upstream's
// own entries using `remove_links=true`, so what arrives here is the browser's
// wording with the anchors taken out.
//
// Deliberately NOT a general escape hatch into the browser's strings: it takes
// an id the browser sent and returns undefined for anything else, so a page
// cannot start sourcing its own copy from here instead of from `en.ts`.

interface LoadTimeDataApi {
  valueExists(id: string): boolean;
  getString(id: string): string;
}

function api(): LoadTimeDataApi | undefined {
  // Feature-detected as the object itself, never inferred from the URL or the
  // build mode: a page whose controller added no strings has no table, and
  // that is a different thing from an id being absent from one.
  const candidate = (globalThis as {loadTimeData?: LoadTimeDataApi}).loadTimeData;
  return candidate && typeof candidate.valueExists === 'function' ? candidate : undefined;
}

/**
 * The browser's text for a message name it sent, or `undefined`.
 *
 * `undefined` rather than the id, so the caller decides what an unresolvable
 * name looks like. Returning the id here would put `managementExtensionReport
 * Perms` in front of a user as though it were a sentence, from a helper whose
 * caller could not tell it apart from a real one.
 */
export function browserString(id: string): string | undefined {
  const table = api();
  if (!table || !table.valueExists(id)) {
    return undefined;
  }
  const value = table.getString(id);
  return value === '' ? undefined : value;
}
