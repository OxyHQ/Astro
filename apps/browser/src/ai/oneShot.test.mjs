import assert from "node:assert/strict";
import { test } from "node:test";

globalThis.__DEV__ = false;

const prompts = await import("./oneShotPrompts.ts");
const { useOxySession } = await import("../oxy/session.ts");
const { oneShot, setTestEndpoint, useOneShotStatus } = await import("./inference.ts");

test("a group name is 1 to 3 words with one emoji, or nothing", () => {
  assert.deepEqual(prompts.parseGroupName('{"name": "Trip to Japan", "emoji": "🗾"}'), { name: "Trip to Japan", emoji: "🗾" });
  assert.deepEqual(prompts.parseGroupName('Sure! ```json\n{"name": "\\"Recipes\\" 🍝", "emoji": "🍝"}\n```'), { name: "Recipes", emoji: "🍝" });
  assert.deepEqual(prompts.parseGroupName('{"name": "Astro PRs", "emoji": "not an emoji"}'), { name: "Astro PRs", emoji: null });
  assert.deepEqual(prompts.parseGroupName('{"name": "Family 👨‍👩‍👧", "emoji": "👨‍👩‍👧"}'), { name: "Family", emoji: "👨‍👩‍👧" });
  assert.equal(prompts.parseGroupName('{"name": "A very long name that goes on and on"}'), null);
  assert.equal(prompts.parseGroupName("Trip to Japan"), null);
  assert.equal(prompts.parseGroupName(null), null);
});

test("the group prompt lists titles and hosts, at most 12", () => {
  const tabs = Array.from({ length: 15 }, (_, i) => ({ title: `Tab ${i}`, url: `https://www.example${i}.com/a` }));
  const input = prompts.groupNameInput(tabs);
  assert.equal(input.split("\n").length, 12);
  assert.match(input, /^- Tab 0 \(example0\.com\)/);
});

test("a pinned title is short, unquoted and different from the original", () => {
  assert.equal(prompts.parsePinnedTitle('"Inbox"', "(3) Inbox - ana@example.com - Gmail"), "Inbox");
  assert.equal(prompts.parsePinnedTitle("Title: Astro PRs.\nmore", "Pull requests · oxy/astro · GitHub"), "Astro PRs");
  assert.equal(prompts.parsePinnedTitle("Inbox", "inbox"), null);
  assert.equal(prompts.parsePinnedTitle("This is a whole sentence about the page that is far too long", "x"), null);
});

test("a tidy file name keeps the extension and refuses unsafe characters", () => {
  assert.equal(prompts.parseDownloadName("Invoice Acme October 2026", "inv_88231_final(2).pdf"), "Invoice Acme October 2026.pdf");
  assert.equal(prompts.parseDownloadName("Astro 0.4 Linux.tar.gz", "astro-browser-0.4-x86_64.tar.gz"), "Astro 0.4 Linux.tar.gz");
  assert.equal(prompts.parseDownloadName("../../etc/passwd", "a.txt"), "etc passwd.txt");
  assert.equal(prompts.parseDownloadName("Report: Q3 / Final?", "r.docx"), "Report Q3 Final.docx");
  assert.equal(prompts.parseDownloadName("annual-report-2025", "Annual Report 2025.pdf"), null);
  assert.equal(prompts.parseDownloadName("  ", "a.pdf"), null);
  assert.deepEqual(prompts.splitExtension("photo.jpeg"), { base: "photo", extension: ".jpeg" });
  assert.deepEqual(prompts.splitExtension(".bashrc"), { base: ".bashrc", extension: "" });
  assert.deepEqual(prompts.splitExtension("notes"), { base: "notes", extension: "" });
});

test("transcripts are marked every 30 s and trimmed to the budget", () => {
  const lines = Array.from({ length: 200 }, (_, i) => ({ startMs: i * 5000, text: `line ${i}` }));
  const text = prompts.transcriptText(lines, 400);
  assert.ok(text.length <= 400);
  assert.match(text, /^\[0:00\] line 0 line 1/);
  assert.match(text, /\[0:30\] line 6/);
  assert.equal(prompts.timestamp(3_723_000), "1:02:03");
});

test("YouTube video ids and the prompts each page offers", () => {
  assert.equal(prompts.youtubeVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=4"), "dQw4w9WgXcQ");
  assert.equal(prompts.youtubeVideoId("https://youtu.be/dQw4w9WgXcQ"), "dQw4w9WgXcQ");
  assert.equal(prompts.youtubeVideoId("https://www.youtube.com/shorts/dQw4w9WgXcQ"), "dQw4w9WgXcQ");
  assert.equal(prompts.youtubeVideoId("https://www.youtube.com/feed/subscriptions"), null);
  const ids = (url) => prompts.promptActionsFor(url).map((a) => a.id);
  assert.deepEqual(ids("https://www.youtube.com/watch?v=dQw4w9WgXcQ"), ["summarize", "summarizeVideo", "eli5", "quiz", "proofread", "citations"]);
  assert.deepEqual(ids("https://github.com/oxy/astro/pull/54"), ["summarize", "eli5", "quiz", "reviewCode", "citations"]);
  assert.deepEqual(ids("astro://settings"), []);
});

function fakeKaana(reply) {
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init, body: JSON.parse(init.body) });
    return reply(calls.length);
  };
  return calls;
}

const json = (status, body, headers = {}) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...headers } });

function signIn() {
  useOxySession.setState({ account: { id: "u1", name: "Ana", handle: "ana", email: null, avatar: null, color: null }, sessionBearer: () => "session-token" });
  useOneShotStatus.setState({ stoppedFor: null, pausedUntil: 0, calls: [] }, false);
}

test("a test endpoint is only ever a local one, with its own bearer", () => {
  assert.equal(setTestEndpoint("https://kaana.ai", "x"), false);
  assert.equal(setTestEndpoint("https://api.oxy.so", "x"), false);
  assert.equal(setTestEndpoint("http://127.0.0.1:8791", ""), false);
  assert.equal(setTestEndpoint(null), true);
});

test("a one-shot request goes to kaana.ai at the instant level with the session's bearer", async () => {
  signIn();
  const calls = fakeKaana(() =>
    json(200, {
      schemaVersion: 1,
      requestId: "req_1",
      model: "acme/small@r1",
      finishReason: "stop",
      output: [{ role: "assistant", content: [{ type: "text", text: ' {"name":"Recipes","emoji":"🍝"} ' }] }],
      usage: [],
      routingPolicy: { id: "p", version: 1 },
      latencyMs: 412,
    }),
  );
  const text = await oneShot("groupName", { instructions: "sys", input: "- Pasta (example.com)", maxOutputTokens: 64 });
  assert.equal(text, '{"name":"Recipes","emoji":"🍝"}');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://kaana.ai/v1/responses");
  assert.equal(calls[0].init.headers.Authorization, "Bearer session-token");
  assert.deepEqual(calls[0].body, {
    model: "instant",
    input: [
      { role: "system", content: [{ type: "text", text: "sys" }] },
      { role: "user", content: [{ type: "text", text: "- Pasta (example.com)" }] },
    ],
    maxOutputTokens: 64,
    labels: { app: "astro", feature: "groupName" },
  });
  const [call] = useOneShotStatus.getState().calls;
  assert.equal(call.ok, true);
  assert.equal(call.requestId, "req_1");
  assert.equal(call.edgeMs, 412);
});

test("a refusal is never retried; a session Oxy refuses stops the features until the account changes", async () => {
  signIn();
  const calls = fakeKaana(() => json(403, { code: "permission_denied", message: "no terms", requestId: "req_2", retryable: false }));
  assert.equal(await oneShot("pinnedTitle", { instructions: "s", input: "i", maxOutputTokens: 24 }), null);
  assert.equal(calls.length, 1);
  assert.equal(useOneShotStatus.getState().stoppedFor, "permission_denied");
  assert.equal(await oneShot("pinnedTitle", { instructions: "s", input: "i", maxOutputTokens: 24 }), null);
  assert.equal(calls.length, 1);
  useOxySession.setState({ account: { id: "u2", name: "Bo", handle: "bo", email: null, avatar: null, color: null } });
  assert.equal(useOneShotStatus.getState().stoppedFor, null);
});

test("a retryable failure pauses for the time the platform asks, without a retry", async () => {
  signIn();
  const calls = fakeKaana(() => json(429, { code: "rate_limited", message: "busy", requestId: "req_3", retryable: true, retryAfterMs: 60_000 }));
  const before = Date.now();
  assert.equal(await oneShot("downloadName", { instructions: "s", input: "i", maxOutputTokens: 48 }), null);
  assert.equal(calls.length, 1);
  assert.ok(useOneShotStatus.getState().pausedUntil >= before + 60_000);
});

test("signed out, nothing is sent", async () => {
  useOxySession.setState({ account: null, sessionBearer: null });
  useOneShotStatus.setState({ stoppedFor: null, pausedUntil: 0, calls: [] }, false);
  const calls = fakeKaana(() => json(200, {}));
  assert.equal(await oneShot("groupName", { instructions: "s", input: "i", maxOutputTokens: 64 }), null);
  assert.equal(calls.length, 0);
});

test("with a local test endpoint, its bearer is used and the account is never touched", async () => {
  useOxySession.setState({ account: null, sessionBearer: () => "real-session" });
  useOneShotStatus.setState({ stoppedFor: null, pausedUntil: 0, calls: [] }, false);
  assert.equal(setTestEndpoint("http://127.0.0.1:8791", "test-token"), true);
  const calls = fakeKaana(() => json(200, { output: [{ role: "assistant", content: [{ type: "text", text: "ok" }] }] }));
  assert.equal(await oneShot("groupName", { instructions: "s", input: "i", maxOutputTokens: 64 }), "ok");
  assert.equal(calls[0].url, "http://127.0.0.1:8791/v1/responses");
  assert.equal(calls[0].init.headers.Authorization, "Bearer test-token");
  assert.equal(useOxySession.getState().account, null);
  setTestEndpoint(null);
});

test("the transcript page script parses and keeps its regular expressions", async () => {
  const { transcriptScript } = await import("./youtubeTranscript.ts");
  const script = transcriptScript("dQw4w9WgXcQ");
  assert.doesNotThrow(() => new Function("post", script));
  assert.ok(script.includes(String.raw`replace(/\s+/g, ' ')`));
  assert.ok(script.includes(String.raw`replace(/\n/g, ' ')`));
  assert.ok(script.includes('"dQw4w9WgXcQ"'));
});
