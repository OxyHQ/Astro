import assert from "node:assert/strict";
import { test } from "node:test";
import { toSystemCalendar, toSystemEvent } from "./niloCalendar.ts";

const calendar = { id: "c1", workspaceId: "w1", name: "Calendar", isDefault: true, role: "owner", colors: [{ id: "blue", name: "Blue", color: "blue" }] };
const base = { id: "e1", rowId: "r1", calendarId: "c1", title: "Standup", allDay: false, start: "2026-10-24T09:00:00Z", end: "2026-10-24T09:15:00Z", location: null, url: "https://meet.example/x", description: null, color: null, seriesStart: null };

test("a calendar keeps its id and name and is owned by its owner", () => {
  assert.deepEqual(toSystemCalendar(calendar), { id: "c1", title: "Calendar", color: "#337EA9", account: "Oxy", accountType: "other", owned: true });
  assert.equal(toSystemCalendar({ ...calendar, role: "editor" }).owned, false);
});

test("a timed event keeps its instants and its meeting link", () => {
  const event = toSystemEvent(base, new Map([["c1", calendar]]));
  assert.equal(event.start, Date.parse("2026-10-24T09:00:00Z"));
  assert.equal(event.end - event.start, 15 * 60 * 1000);
  assert.equal(event.url, "https://meet.example/x");
  assert.equal(event.color, "#337EA9");
  assert.equal(event.occurrence, "r1");
});

test("an all-day event spans local days with an exclusive end", () => {
  const event = toSystemEvent({ ...base, allDay: true, start: "2026-10-24", end: "2026-10-25" }, new Map());
  assert.equal(event.start, new Date(2026, 9, 24).getTime());
  assert.equal(event.end, new Date(2026, 9, 25).getTime());
});

test("occurrences of a repeating event are told apart and take the event's colour", () => {
  const event = toSystemEvent({ ...base, seriesStart: "2026-10-01T09:00:00Z", color: { id: "red", name: "Red", color: "red" } }, new Map());
  assert.equal(event.occurrence, "r1@2026-10-24T09:00:00Z");
  assert.equal(event.color, "#D44C47");
});
