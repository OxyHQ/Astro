import assert from "node:assert/strict";
import { test } from "node:test";
import { edsCalendars } from "./eds.ts";
import { eventsFromIcs, parseIcs, parseRule, tzidsIn, Zones } from "./ics.ts";

const source = { calendarId: "cal", color: "#3584E4", email: "me@example.test" };
const DAY = 86_400_000;

function read(text, from, to, timezones = "") {
  const zones = new Zones();
  for (const component of parseIcs(timezones)) zones.add(component);
  return eventsFromIcs(parseIcs(text), source, zones, Date.parse(from), Date.parse(to)).sort((a, b) => a.start - b.start);
}

const standup = [
  "BEGIN:VEVENT",
  "UID:standup@test",
  "DTSTART;TZID=Europe/Madrid:20261017T090000",
  "DURATION:PT15M",
  "RRULE;X-EVOLUTION-ENDDATE=20261115T080000Z:FREQ=DAILY;COUNT=30",
  "EXDATE;TZID=Europe/Madrid:20261026T090000",
  "SUMMARY:Daily standup",
  "LOCATION:Room 4",
  "URL:https://meet.example.test/standup",
  "ORGANIZER;CN=Ada Lovelace:mailto:ada@example.test",
  "ATTENDEE;CN=Ada Lovelace;PARTSTAT=ACCEPTED:mailto:ada@example.test",
  "ATTENDEE;CN=Test User;PARTSTAT=NEEDS-ACTION:mailto:me@example.test",
  "ATTENDEE;CUTYPE=ROOM;CN=Room 4;PARTSTAT=ACCEPTED:mailto:",
  " room4@example.test",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "UID:standup@test",
  "RECURRENCE-ID;TZID=Europe/Madrid:20261024T090000",
  "DTSTART:20261024T120000Z",
  "DTEND:20261024T123000Z",
  "SUMMARY:Daily standup (moved)",
  "END:VEVENT",
].join("\r\n");

test("a daily series keeps its wall-clock time across the change to winter time", () => {
  const events = read(standup, "2026-10-23T00:00:00Z", "2026-10-28T00:00:00Z");
  assert.deepEqual(
    events.map((e) => [new Date(e.start).toISOString(), e.title]),
    [
      ["2026-10-23T07:00:00.000Z", "Daily standup"],
      ["2026-10-24T12:00:00.000Z", "Daily standup (moved)"],
      ["2026-10-25T08:00:00.000Z", "Daily standup"],
      ["2026-10-27T08:00:00.000Z", "Daily standup"],
    ],
  );
  assert.equal(events[0].end - events[0].start, 15 * 60_000);
  assert.equal(events[0].occurrence, `standup@test@${Date.parse("2026-10-23T07:00:00Z") / 1000}`);
});

test("people: rooms are left out, my response comes from my address, the organizer is accepted", () => {
  const [event] = read(standup, "2026-10-23T00:00:00Z", "2026-10-23T23:00:00Z");
  assert.deepEqual(
    event.attendees.map((a) => [a.name, a.email, a.status, a.me]),
    [
      ["Ada Lovelace", "ada@example.test", "accepted", false],
      ["Test User", "me@example.test", "pending", true],
    ],
  );
  assert.deepEqual(event.organizer, { name: "Ada Lovelace", email: "ada@example.test", status: "accepted", me: false });
  assert.equal(event.url, "https://meet.example.test/standup");
  assert.equal(event.location, "Room 4");
  assert.equal(event.declined, false);
  assert.equal(event.calendarId, "cal");
  assert.equal(event.color, "#3584E4");
});

test("a declined, cancelled event says so and its text is unescaped", () => {
  const text = [
    "BEGIN:VEVENT",
    "UID:review@test",
    "DTSTART:20261024T203700Z",
    "DTEND:20261024T213700Z",
    "STATUS:CANCELLED",
    "SUMMARY:Design review",
    "DESCRIPTION:Bring the mocks\\, please.\\nSecond line",
    "ATTENDEE;CN=Test User;PARTSTAT=DECLINED:mailto:ME@example.test",
    "END:VEVENT",
  ].join("\n");
  const [event] = read(text, "2026-10-24T00:00:00Z", "2026-10-25T00:00:00Z");
  assert.equal(event.notes, "Bring the mocks, please.\nSecond line");
  assert.equal(event.cancelled, true);
  assert.equal(event.declined, true);
  assert.equal(event.end - event.start, 3_600_000);
});

test("zones: an Exchange zone from its VTIMEZONE, a libical-prefixed one and UTC", () => {
  const timezones = [
    "BEGIN:VTIMEZONE",
    "TZID:W. Europe Standard Time",
    "BEGIN:STANDARD",
    "DTSTART:16011028T030000",
    "RRULE:FREQ=YEARLY;BYDAY=-1SU;BYMONTH=10",
    "TZOFFSETFROM:+0200",
    "TZOFFSETTO:+0100",
    "END:STANDARD",
    "BEGIN:DAYLIGHT",
    "DTSTART:16010325T020000",
    "RRULE:FREQ=YEARLY;BYDAY=-1SU;BYMONTH=3",
    "TZOFFSETFROM:+0100",
    "TZOFFSETTO:+0200",
    "END:DAYLIGHT",
    "END:VTIMEZONE",
  ].join("\n");
  const text = [
    "BEGIN:VEVENT",
    "UID:summer@test",
    "DTSTART;TZID=W. Europe Standard Time:20261020T100000",
    "DTEND;TZID=W. Europe Standard Time:20261020T103000",
    "SUMMARY:Summer time",
    "END:VEVENT",
    "BEGIN:VEVENT",
    "UID:winter@test",
    "DTSTART;TZID=W. Europe Standard Time:20261102T100000",
    "DURATION:PT30M",
    "SUMMARY:Winter time",
    "END:VEVENT",
    "BEGIN:VEVENT",
    "UID:ny@test",
    "DTSTART;TZID=/freeassociation.sourceforge.net/America/New_York:",
    " 20261024T203700",
    "DURATION:PT1H",
    "SUMMARY:New York",
    "END:VEVENT",
  ].join("\n");
  assert.deepEqual(tzidsIn(parseIcs(text)).sort(), ["/freeassociation.sourceforge.net/America/New_York", "W. Europe Standard Time"]);
  const events = read(text, "2026-10-01T00:00:00Z", "2026-11-30T00:00:00Z", timezones);
  assert.deepEqual(
    events.map((e) => [e.title, new Date(e.start).toISOString(), (e.end - e.start) / 60_000]),
    [
      ["Summer time", "2026-10-20T08:00:00.000Z", 30],
      ["New York", "2026-10-25T00:37:00.000Z", 60],
      ["Winter time", "2026-11-02T09:00:00.000Z", 30],
    ],
  );
  assert.equal(new Zones().has("W. Europe Standard Time"), false);
  assert.equal(new Zones().has("/freeassociation.sourceforge.net/America/New_York"), true);
});

test("an all-day event runs from local midnight to the local midnight after its last day", () => {
  const text = ["BEGIN:VEVENT", "UID:offsite@test", "DTSTART;VALUE=DATE:20261024", "DTEND;VALUE=DATE:20261026", "SUMMARY:Offsite", "END:VEVENT"].join("\n");
  const [event] = read(text, "2026-10-25T12:00:00Z", "2026-10-25T13:00:00Z");
  assert.equal(event.allDay, true);
  assert.equal(event.start, new Date(2026, 9, 24).getTime());
  assert.equal(event.end, new Date(2026, 9, 26).getTime());
  assert.equal(read(text, "2026-10-27T12:00:00Z", "2026-10-28T00:00:00Z").length, 0);
});

test("weekly, monthly and yearly rules", () => {
  const weekly = parseRule("FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,TH;UNTIL=20261112T235959Z");
  assert.equal(weekly.interval, 2);
  const series = (rule, start = "20261001T090000Z") =>
    read(["BEGIN:VEVENT", "UID:s@test", `DTSTART:${start}`, "DURATION:PT1H", `RRULE:${rule}`, "SUMMARY:S", "END:VEVENT"].join("\n"), "2026-10-01T00:00:00Z", "2027-12-31T00:00:00Z").map((e) =>
      new Date(e.start).toISOString().slice(0, 10),
    );
  assert.deepEqual(series("FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,TH;UNTIL=20261112T235959Z"), ["2026-10-01", "2026-10-12", "2026-10-15", "2026-10-26", "2026-10-29", "2026-11-09", "2026-11-12"]);
  assert.deepEqual(series("FREQ=MONTHLY;BYDAY=-1FR;COUNT=3"), ["2026-10-01", "2026-10-30", "2026-11-27"]);
  assert.deepEqual(series("FREQ=MONTHLY;BYDAY=MO,TU,WE,TH,FR;BYSETPOS=-1;COUNT=3"), ["2026-10-01", "2026-10-30", "2026-11-30"]);
  assert.deepEqual(series("FREQ=YEARLY;BYMONTH=3;BYDAY=2SU;COUNT=2", "20260308T090000Z"), ["2027-03-14"]);
  assert.deepEqual(series("FREQ=MONTHLY;BYMONTHDAY=31;COUNT=3", "20261031T090000Z"), ["2026-10-31", "2026-12-31", "2027-01-31"]);
  assert.equal(parseRule("FREQ=HOURLY"), null);
});

test("a series only needs the periods that reach the window", () => {
  const text = ["BEGIN:VEVENT", "UID:old@test", "DTSTART:20000103T090000Z", "DURATION:PT1H", "RRULE:FREQ=DAILY", "SUMMARY:Old", "END:VEVENT"].join("\n");
  const events = read(text, "2026-10-24T00:00:00Z", "2026-10-26T00:00:00Z");
  assert.deepEqual(
    events.map((e) => new Date(e.start).toISOString()),
    ["2026-10-24T09:00:00.000Z", "2026-10-25T09:00:00.000Z"],
  );
});

test("EDS sources become calendars: enabled calendars only, the account from the parent", () => {
  const sources = [
    { uid: "goa-1", data: "[Data Source]\nDisplayName=ada@example.test\nEnabled=true\nParent=\n" },
    { uid: "work", data: "[Data Source]\nDisplayName[de]=Arbeit\nDisplayName=Work\nEnabled=true\nParent=goa-1\n\n[Calendar]\nBackendName=caldav\nColor=#3584e4\n" },
    { uid: "birthdays", data: "[Data Source]\nDisplayName=Birthdays & Anniversaries\nEnabled=true\nParent=local-stub\n\n[Calendar]\nBackendName=contacts\nColor=#c0f\n" },
    { uid: "local-stub", data: "[Data Source]\nDisplayName=On This Computer\nEnabled=true\nParent=\n" },
    { uid: "off", data: "[Data Source]\nDisplayName=Off\nEnabled=false\nParent=goa-1\n\n[Calendar]\nBackendName=caldav\n" },
    { uid: "weather", data: "[Data Source]\nDisplayName=Weather\nEnabled=true\n\n[Calendar]\nBackendName=weather\n" },
    { uid: "tasks", data: "[Data Source]\nDisplayName=Tasks\nEnabled=true\nParent=local-stub\n\n[Task List]\nBackendName=local\n" },
  ];
  assert.deepEqual(edsCalendars(sources), [
    { id: "work", title: "Work", color: "#3584E4", account: "ada@example.test", accountType: "calDAV", owned: true },
    { id: "birthdays", title: "Birthdays & Anniversaries", color: "#CC00FF", account: "On This Computer", accountType: "birthdays", owned: false },
  ]);
});
