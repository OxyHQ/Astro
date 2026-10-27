import assert from "node:assert/strict";
import { test } from "node:test";

const { proactiveCommands, welcomeContext } = await import("./suggestions.ts");

const H = 3_600_000;
const day = new Date(2026, 9, 27, 0, 0, 0).getTime();
const ev = (title, startH, endH) => ({ id: title, occurrence: `${title}@${startH}`, calendarId: "c", color: "", title, start: day + startH * H, end: day + endH * H, allDay: false, location: "", notes: "", url: "", cancelled: false, declined: false, organizer: null, attendees: [] });

test("Chat offers prep before a meeting, a recap after one, and Start My Day in the morning", () => {
  const events = [ev("Standup", 9, 9.5), ev("Acme pricing review", 11, 12)];
  assert.deepEqual(
    proactiveCommands(day + 10.25 * H, events, { briefDoneToday: false }).map((c) => [c.command, c.title]),
    [
      ["prep", "Prepare for “Acme pricing review”"],
      ["recap", "Recap “Standup”"],
      ["brief", "Start My Day"],
    ],
  );
  assert.deepEqual(proactiveCommands(day + 7.5 * H, events, { briefDoneToday: true }), []);
  assert.deepEqual(
    proactiveCommands(day + 14 * H, events, { briefDoneToday: false }).map((c) => c.command),
    [],
  );
  assert.deepEqual(
    proactiveCommands(day + 12.5 * H, events, { briefDoneToday: false }).map((c) => c.command),
    ["recap"],
  );
});

test("the welcome suggestions are ranked by what the page is about", () => {
  assert.equal(welcomeContext({ title: "Cheap flights to Tokyo", url: "https://www.kayak.com/flights", description: "Compare fares" }), "Cheap flights to Tokyo — kayak.com — Compare fares");
  assert.equal(welcomeContext(null), undefined);
});
