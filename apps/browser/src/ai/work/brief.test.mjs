import assert from "node:assert/strict";
import { test } from "node:test";

const brief = await import("./brief.ts");

const H = 3_600_000;
const today = new Date(2026, 9, 27, 0, 0, 0).getTime();
const now = today + 9 * H;
const me = { name: "Nate", email: "nate@oxy.so", status: "accepted", me: true };
const ana = { name: "Ana Ruiz", email: "ana@acme.com", status: "accepted", me: false };
const event = (id, startH, endH, extra = {}) => ({
  id,
  occurrence: `${id}@${startH}`,
  calendarId: "c",
  color: "#000",
  title: id,
  start: today + startH * H,
  end: today + endH * H,
  allDay: false,
  location: "",
  notes: "",
  url: "",
  cancelled: false,
  declined: false,
  organizer: null,
  attendees: [me],
  ...extra,
});
const events = [
  event("Standup", 8, 8.25),
  event("Acme pricing review", 11, 12, { attendees: [me, ana], notes: "Agenda: pricing tiers", url: "https://meet.google.com/abc-defg-hij" }),
  event("Declined thing", 13, 14, { declined: true }),
  event("Tomorrow sync", 33, 34),
];
const history = [
  { url: "https://acme.com/pricing", title: "Acme pricing", favicon: null, visits: 3, lastVisit: today - 2 * H, visitTimes: [today - 2 * H] },
  { url: "https://news.example/today", title: "News", favicon: null, visits: 1, lastVisit: today - 20 * H, visitTimes: [today - 20 * H] },
  { url: "https://docs.example/standup-notes", title: "Standup notes", favicon: null, visits: 1, lastVisit: today + 8.1 * H, visitTimes: [today + 8.1 * H] },
];
const input = { now, timeZone: "UTC", events, calendar: "connected", openTabs: [{ title: "Inbox", url: "https://mail.example/" }], pinnedTabs: [], history };

test("next and last meeting skip declined, cancelled and all-day events", () => {
  assert.equal(brief.nextMeeting(events, now).title, "Acme pricing review");
  assert.equal(brief.lastMeeting(events, now).title, "Standup");
  assert.equal(brief.nextMeeting(events, today + 12.5 * H).title, "Tomorrow sync");
  assert.equal(brief.todaysMeetings(events, now).length, 2);
});

test("Start My Day carries today's calendar, open tabs and yesterday's reading", () => {
  const turn = brief.commandTurn("brief", input);
  const context = turn.context.join("\n");
  assert.match(turn.prompt, /morning brief/);
  assert.match(context, /Today's calendar \(2 events\)/);
  assert.match(context, /Standup/);
  assert.doesNotMatch(context, /Declined thing/);
  assert.match(context, /Tabs the person left open\n- Inbox — https:\/\/mail.example\//);
  assert.match(context, /Pages the person read yesterday\n- Acme pricing/);
  assert.doesNotMatch(context, /Standup notes/);
});

test("meeting prep describes the next meeting and the pages that look related", () => {
  const turn = brief.commandTurn("prep", input);
  assert.equal(turn.event.title, "Acme pricing review");
  const context = turn.context.join("\n");
  assert.match(context, /Guests \(2\):\n- Nate <nate@oxy.so> \(the person\)\n- Ana Ruiz <ana@acme.com>/);
  assert.match(context, /Agenda: pricing tiers/);
  assert.match(context, /Link: https:\/\/meet.google.com/);
  assert.match(context, /related\n- Acme pricing — https:\/\/acme.com\/pricing/);
});

test("a recap uses the pages visited during the meeting", () => {
  const turn = brief.commandTurn("recap", input);
  assert.equal(turn.event.title, "Standup");
  assert.match(turn.context.join("\n"), /during the meeting\n- Standup notes/);
});

test("without a calendar the commands still answer, and say so", () => {
  const turn = brief.commandTurn("prep", { ...input, calendar: "signedOut", events: [] });
  assert.equal(turn.event, null);
  assert.match(turn.context.join("\n"), /isn't connected/);
});
