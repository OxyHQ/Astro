import assert from "node:assert/strict";
import { test } from "node:test";
const { fromLegacy, fromLegacyUrl, LEGACY_KEYS, LEGACY_URLS } = await import("./legacy.ts");

const [[oldGame], [oldChromeGame], [oldScheme]] = LEGACY_URLS;
const old = (name) => Object.keys(LEGACY_KEYS).find((key) => LEGACY_KEYS[key] === name);

test("app URLs move to today's scheme; other text stays", () => {
  assert.equal(fromLegacyUrl(`${oldScheme}history`), "astro://history");
  assert.equal(fromLegacyUrl(`view-source:${oldScheme}settings/sync`), "view-source:astro://settings/sync");
  assert.equal(fromLegacyUrl(`${oldGame}?level=2`), "astro://game?level=2");
  assert.equal(fromLegacyUrl(oldChromeGame), "chrome://game");
  assert.equal(fromLegacyUrl(`${oldChromeGame}u`), `${oldChromeGame}u`);
  assert.equal(fromLegacyUrl(`https://example.com/?next=${oldScheme}history`), `https://example.com/?next=${oldScheme}history`);
});

test("records: settings and shortcut ids renamed, the rest kept as the same objects", () => {
  const tab = { u: "https://example.com", t: "Example" };
  assert.equal(fromLegacy(tab), tab);
  assert.deepEqual(fromLegacy({ v: { [old("newLittleAstro")]: ["cmd+opt+n"], newTab: ["cmd+t"] } }), {
    v: { newLittleAstro: ["cmd+opt+n"], newTab: ["cmd+t"] },
  });
  assert.deepEqual(fromLegacy({ u: `${oldScheme}downloads`, t: "Downloads" }), { u: "astro://downloads", t: "Downloads" });
  assert.deepEqual(fromLegacy({ [old("littleAstroSize")]: [1, 2], littleAstroSize: [3, 4] }), { littleAstroSize: [3, 4] });
});

test("a bookmark saved before Chrome kept them gets the UUID 0.2.32 gave it, on every Mac", async () => {
  const { bookmarkUuidFor } = await import("./store/bookmarks.ts");
  assert.equal(bookmarkUuidFor("bm-1"), "de8f26f1-cf94-4896-bcf5-f260fa6f106a");
});

test("an old app URL typed or opened goes where it went (store/tabs.ts resolves it so)", async () => {
  const { resolveInput } = await import("@astro-browser/core");
  const go = (input) => resolveInput(fromLegacyUrl(input.trim()), "https://search.example/?q=");
  assert.equal(go(` ${oldScheme}settings/sync `), "astro://settings/sync");
  assert.equal(go(`${oldScheme.toUpperCase()}history?q=a`), "astro://history?q=a");
  assert.equal(go(oldGame), "astro://game");
  assert.equal(go(oldChromeGame), "astro://game");
  assert.equal(go("https://example.com/"), "https://example.com/");
});
