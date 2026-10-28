import assert from "node:assert/strict";
import { test } from "node:test";

const l = await import("./library.ts");

const NOW = new Date(2026, 9, 28, 15, 0).getTime();
const at = (days, hour = 10) => new Date(2026, 9, 28 - days, hour).toISOString();

const canvas = (toolCallId, type, title, data) => ({ toolCallId, toolName: "canvas", state: "result", args: { type, title, data }, result: { id: "x", type, title, data } });

const conversation = {
  id: "c1",
  updatedAt: at(1),
  messages: [
    { role: "user", content: [{ type: "text", text: "Compare https://example.com/pricing, and the plans." }], createdAt: at(1, 9) },
    {
      role: "assistant",
      content: "Here is the report.",
      createdAt: at(1, 10),
      toolInvocations: [
        { toolCallId: "s1", toolName: "webSearch", state: "result", args: { query: "plans" }, result: { results: [{ title: "IANA", url: "https://www.iana.org/domains" }] } },
        canvas("a1", "markdown", "Pricing Report", { content: "# Pricing\n\nCheaper in **EU**." }),
        canvas("a2", "markdown", "Pricing Report", { content: "# Pricing v2\n\nCheaper in EU and US." }),
        canvas("a3", "deck", "Launch Deck", { slides: [{ title: "Hello" }, { title: "World" }] }),
      ],
    },
    { role: "system", content: "secret context https://hidden.example/" },
  ],
};

test("a conversation's index holds its text, its links and the latest version of each file", () => {
  const entry = l.indexConversation(conversation);
  assert.equal(entry.updatedAt, conversation.updatedAt);
  assert.match(entry.text, /Compare https:\/\/example\.com\/pricing/);
  assert.doesNotMatch(entry.text, /secret context/);
  assert.deepEqual(entry.urls, ["https://example.com/pricing", "https://www.iana.org/domains"]);
  assert.deepEqual(
    entry.files.map((f) => [f.id, f.title, f.kind, f.detail]),
    [
      ["a2", "Pricing Report", "report", "Report · 8 words"],
      ["a3", "Launch Deck", "deck", "Deck · 2 slides"],
    ],
  );
  assert.equal(entry.files[0].at, Date.parse(at(1, 10)));
});

test("the index stays bounded", () => {
  const long = { id: "c", updatedAt: at(0), messages: [{ role: "user", content: "x ".repeat(20_000) }] };
  assert.ok(l.indexConversation(long).text.length <= l.INDEX_TEXT_LIMIT);
  const many = { id: "c", updatedAt: at(0), messages: [{ role: "user", content: Array.from({ length: 100 }, (_, i) => `https://a.test/${i}`).join(" ") }] };
  assert.equal(l.indexConversation(many).urls.length, l.INDEX_URL_LIMIT);
});

test("only a conversation that changed since it was read is read again", () => {
  const index = { c1: { id: "c1", updatedAt: at(1), text: "", urls: [], files: [] } };
  assert.equal(l.needsScan({ id: "c1", title: "", createdAt: at(2), updatedAt: at(1) }, index), false);
  assert.equal(l.needsScan({ id: "c1", title: "", createdAt: at(2), updatedAt: at(0) }, index), true);
  assert.equal(l.needsScan({ id: "c2", title: "", createdAt: at(2), updatedAt: at(0) }, index), true);
});

const conversations = [
  { id: "c1", title: "Plan comparison", lastMessage: "Here is the report.", createdAt: at(1), updatedAt: at(1) },
  { id: "c2", title: "Trip to Lisbon", lastMessage: "Pack light.", createdAt: at(10), updatedAt: at(10) },
  { id: "c3", title: "", lastMessage: "Hi", createdAt: at(0), updatedAt: at(0) },
];
const index = {
  c1: l.indexConversation(conversation),
  c2: l.indexConversation({ id: "c2", updatedAt: at(10), messages: [{ role: "user", content: "Flights to Lisbon from https://flights.example/lis" }] }),
};

test("chats match by title, message, link and file, newest first", () => {
  assert.deepEqual(
    l.searchChats(conversations, index, "", null).map((h) => [h.id, h.title]),
    [
      ["c3", "New Chat"],
      ["c1", "Plan comparison"],
      ["c2", "Trip to Lisbon"],
    ],
  );
  assert.equal(l.searchChats(conversations, index, "lisbon trip", null)[0].match, "title");
  const message = l.searchChats(conversations, index, "flights", null);
  assert.equal(message.length, 1);
  assert.equal(message[0].match, "message");
  assert.match(message[0].snippet, /Flights to Lisbon/);
  const url = l.searchChats(conversations, index, "iana.org", null);
  assert.deepEqual([url[0].id, url[0].match, url[0].url], ["c1", "url", "https://www.iana.org/domains"]);
  assert.equal(l.searchChats(conversations, index, "launch deck", null)[0].id, "c1");
  assert.deepEqual(l.searchChats(conversations, index, "nothing-here", null), []);
});

test("files match by their title, kind and chat, inside a date span", () => {
  assert.deepEqual(
    l.searchFiles(conversations, index, "", null).map((f) => f.id),
    ["a2", "a3"],
  );
  assert.deepEqual(
    l.searchFiles(conversations, index, "deck", null).map((f) => [f.id, f.chatTitle, f.conversationId]),
    [["a3", "Plan comparison", "c1"]],
  );
  assert.deepEqual(l.searchFiles(conversations, index, "", l.rangeSpan("today", NOW)), []);
  assert.equal(l.searchFiles(conversations, index, "", l.rangeSpan("yesterday", NOW)).length, 2);
});

test("date ranges and dates written in the query", () => {
  const today = new Date(2026, 9, 28).getTime();
  assert.equal(l.rangeSpan("any", NOW), null);
  assert.deepEqual(l.rangeSpan("today", NOW), { from: today, to: new Date(2026, 9, 29).getTime() });
  assert.deepEqual(l.rangeSpan("week", NOW), { from: new Date(2026, 9, 22).getTime(), to: new Date(2026, 9, 29).getTime() });
  assert.deepEqual(l.dateInQuery("pricing yesterday", NOW), { text: "pricing", span: { from: new Date(2026, 9, 27).getTime(), to: today } });
  assert.deepEqual(l.dateInQuery("last week report", NOW), { text: "report", span: { from: new Date(2026, 9, 19).getTime(), to: new Date(2026, 9, 26).getTime() } });
  assert.deepEqual(l.dateInQuery("monday", NOW).span, { from: new Date(2026, 9, 26).getTime(), to: new Date(2026, 9, 27).getTime() });
  assert.deepEqual(l.dateInQuery("trip Oct 18", NOW), { text: "trip", span: { from: new Date(2026, 9, 18).getTime(), to: new Date(2026, 9, 19).getTime() } });
  assert.deepEqual(l.dateInQuery("december", NOW).span, { from: new Date(2025, 11, 1).getTime(), to: new Date(2026, 0, 1).getTime() });
  assert.deepEqual(l.dateInQuery("what may help", NOW), { text: "what may help", span: null });
  assert.deepEqual(l.dateInQuery("may 3", NOW).span, { from: new Date(2026, 4, 3).getTime(), to: new Date(2026, 4, 4).getTime() });
  assert.deepEqual(l.intersect({ from: 0, to: 10 }, { from: 5, to: 20 }), { from: 5, to: 10 });
  assert.equal(l.intersect(null, null), null);
});

test("results group by day as Chat's history does", () => {
  const groups = l.groupByDay([{ at: NOW }, { at: NOW - 3600_000 }, { at: Date.parse(at(1)) }, { at: Date.parse(at(3)) }, { at: Date.parse(at(12)) }, { at: new Date(2026, 6, 2).getTime() }], NOW);
  assert.deepEqual(
    groups.map((g) => [g.label, g.items.length]),
    [
      ["Today", 2],
      ["Yesterday", 1],
      ["Previous 7 Days", 1],
      ["Previous 30 Days", 1],
      ["July 2026", 1],
    ],
  );
});
