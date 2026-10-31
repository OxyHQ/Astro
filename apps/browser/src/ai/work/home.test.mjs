import assert from "node:assert/strict";
import { test } from "node:test";

const { morningBriefOf, morningBriefDue, minutesOf, formatBriefTime, BRIEF_TIMES, dayKey, homeCard, connectAppsUpsellVisible } = await import("./home.ts");

const at = (h, m = 0) => new Date(2026, 9, 28, h, m, 0).getTime();

test("a profile's Morning Brief defaults to on at 7:00 and ignores a malformed time", () => {
  assert.deepEqual(morningBriefOf(undefined), { enabled: true, at: "07:00" });
  assert.deepEqual(morningBriefOf({ enabled: false }), { enabled: false, at: "07:00" });
  assert.deepEqual(morningBriefOf({ at: "8:00" }), { enabled: true, at: "07:00" });
  assert.deepEqual(morningBriefOf({ enabled: true, at: "06:30" }), { enabled: true, at: "06:30" });
  assert.equal(minutesOf("23:59"), 1439);
  assert.equal(minutesOf("24:00"), null);
});

test("the times offered run every half hour from 4:00 to 11:00", () => {
  assert.equal(BRIEF_TIMES[0], "04:00");
  assert.equal(BRIEF_TIMES.at(-1), "11:00");
  assert.equal(BRIEF_TIMES.length, 15);
  assert.equal(formatBriefTime("07:30"), "7:30 AM");
  assert.equal(formatBriefTime("00:00"), "12:00 AM");
  assert.equal(formatBriefTime("07:30", false), "7:30");
});

test("the brief is offered once a day after its time, until it runs or is dismissed", () => {
  const setting = { enabled: true, at: "07:00" };
  const fresh = { briefDoneToday: false };
  assert.equal(morningBriefDue(setting, at(6, 59), undefined, fresh), false);
  assert.equal(morningBriefDue(setting, at(7), undefined, fresh), true);
  assert.equal(morningBriefDue(setting, at(15), undefined, fresh), true);
  assert.equal(morningBriefDue(setting, at(9), { done: dayKey(at(8)) }, fresh), false);
  assert.equal(morningBriefDue(setting, at(9), { dismissed: dayKey(at(8)) }, fresh), false);
  assert.equal(morningBriefDue(setting, at(9), { done: "2026-10-27" }, fresh), true);
  assert.equal(morningBriefDue(setting, at(9), undefined, { briefDoneToday: true }), false);
  assert.equal(morningBriefDue({ enabled: false, at: "07:00" }, at(9), undefined, fresh), false);
});

test("the connect-apps upsell shows only signed in, with Chat, outside incognito, once apps are known to be none", () => {
  const base = { signedIn: true, incognito: false, chatAvailable: true, appsLoaded: true, connectedApps: 0, upsellDismissed: false };
  assert.equal(connectAppsUpsellVisible(base), true);
  assert.equal(connectAppsUpsellVisible({ ...base, appsLoaded: false }), false);
  assert.equal(connectAppsUpsellVisible({ ...base, connectedApps: 1 }), false);
  assert.equal(connectAppsUpsellVisible({ ...base, upsellDismissed: true }), false);
  assert.equal(connectAppsUpsellVisible({ ...base, incognito: true }), false);
  assert.equal(connectAppsUpsellVisible({ ...base, signedIn: false }), false);
  assert.equal(connectAppsUpsellVisible({ ...base, chatAvailable: false }), false);
});

test("the New Tab page shows the brief before the upsell, and nothing signed out or incognito", () => {
  const base = { signedIn: true, incognito: false, chatAvailable: true, briefDue: false, appsLoaded: true, connectedApps: 0, upsellDismissed: false };
  assert.equal(homeCard(base), "connectApps");
  assert.equal(homeCard({ ...base, briefDue: true }), "morningBrief");
  assert.equal(homeCard({ ...base, connectedApps: 2 }), null);
  assert.equal(homeCard({ ...base, briefDue: true, incognito: true }), null);
  assert.equal(homeCard({ ...base, briefDue: true, signedIn: false }), null);
});
