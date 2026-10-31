import assert from "node:assert/strict";
import { test } from "node:test";

globalThis.__DEV__ = false;
await import("../../test-native-stub.mjs");
const { useBrowser } = await import("../../store/browser.ts");
const { setLive } = await import("../../live/store.ts");
const state = await import("./state.ts");
const q = await import("./questions.ts");
const workspace = await import("./workspace.ts");
const { buildTurnContext } = await import("./clientContext.ts");
const { liveFolderSection, chatAboutLiveFolder } = await import("./liveFolders.ts");
const { mentionCandidates } = await import("../../components/chat/mentions.ts");

const s = () => useBrowser.getState();

const asking = (questions, state = "result") => ({ toolCallId: "ask1", toolName: "askUserQuestion", state, args: { questions } });
const QUESTIONS = [
  { question: "Which city?", options: [{ label: "Paris" }, { label: "Rome", description: "Italy" }] },
  { question: "What to see?", options: [{ label: "Museums" }, { label: "Food" }, { label: "Parks" }], multiSelect: true },
];

test("askUserQuestion arguments become questions; malformed ones become no card", () => {
  assert.deepEqual(q.askedQuestions(asking(QUESTIONS)), [
    { question: "Which city?", options: [{ label: "Paris" }, { label: "Rome", description: "Italy" }], multiSelect: false },
    { question: "What to see?", options: [{ label: "Museums" }, { label: "Food" }, { label: "Parks" }], multiSelect: true },
  ]);
  assert.equal(q.askedQuestions(asking(QUESTIONS, "call")), null);
  assert.equal(q.askedQuestions(asking([{ question: "One?", options: [{ label: "Only" }] }])), null);
  assert.equal(q.askedQuestions(asking([{ question: " ", options: [{ label: "A" }, { label: "B" }] }])), null);
  assert.equal(q.askedQuestions({ toolCallId: "x", toolName: "webSearch", state: "result", args: { questions: QUESTIONS } }), null);
});

test("questions are pending only on the last, finished assistant message", () => {
  const assistant = { role: "assistant", toolInvocations: [asking(QUESTIONS)] };
  assert.equal(q.pendingQuestions([{ role: "user" }, assistant], false)?.toolCallId, "ask1");
  assert.equal(q.pendingQuestions([{ role: "user" }, assistant], true), null);
  assert.equal(q.pendingQuestions([assistant, { role: "user" }], false), null);
});

test("answers read as one line per question, picks in option order, typed text last", () => {
  const questions = q.askedQuestions(asking(QUESTIONS));
  assert.equal(
    q.formatAnswers(questions, [{ picked: [1] }, { picked: [0, 2], other: " Night walks " }]),
    "Which city?\n→ Rome\n\nWhat to see?\n→ Museums, Parks, Night walks",
  );
  assert.equal(q.formatAnswers(questions.slice(0, 1), [{ picked: [] }]), "Which city?\n→ (skipped)");
});

const STEPS = [
  { action: "Search the web", description: "Find flights", toolName: "webSearch" },
  { action: "Read the best page", description: "Compare prices", toolName: "browse" },
  { action: "Open the tabs", description: "Show the options", toolName: "open_tabs" },
  { action: "Write it up", description: "Summary" },
];

test("the plan comes from plan_preview or the planPreview call; a plan that wasn't shown is none", () => {
  const call = { toolCallId: "p", toolName: "planPreview", state: "result", args: { steps: STEPS }, result: { shown: true } };
  assert.equal(q.planOf({ toolInvocations: [call] })?.steps.length, 4);
  assert.equal(q.planOf({ plan: { steps: STEPS.slice(0, 2) }, toolInvocations: [] })?.steps.length, 2);
  assert.equal(q.planOf({ toolInvocations: [{ ...call, result: { shown: false } }] }), null);
  assert.equal(q.planOf({ toolInvocations: [{ ...call, args: { steps: STEPS.slice(0, 1) } }] }), null);
});

test("to-dos tick off as the turn's later tools finish, in order; a finished turn ticks them all", () => {
  const tool = (name, st = "result") => ({ toolCallId: name + st, toolName: name, state: st });
  const plan = { toolCallId: "p", toolName: "planPreview", state: "result" };
  assert.equal(q.stepsDone(STEPS, [plan, tool("webSearch", "call")], 0, "running"), 0);
  assert.equal(q.stepsDone(STEPS, [plan, tool("webSearch")], 0, "running"), 1);
  assert.equal(q.stepsDone(STEPS, [plan, tool("webSearch"), tool("browse"), tool("host_astro__open_tabs")], 0, "running"), 3);
  assert.equal(q.stepsDone(STEPS, [tool("browse"), plan, tool("webSearch")], 1, "running"), 1);
  assert.equal(q.stepsDone(STEPS, [plan, tool("browse")], 0, "cancelled"), 2);
  assert.equal(q.stepsDone(STEPS, [plan], 0, "completed"), 4);
  assert.ok(q.isQuietTool("askUserQuestion") && q.isQuietTool("planPreview") && !q.isQuietTool("webSearch"));
});

test("tabs Chat opens go into one workspace group per chat, named after it", () => {
  const w = s().createWindow({ url: "https://start.test/" });
  const a = s().newTab(w, { url: "https://a.test/" });
  const b = s().newTab(w, { url: "https://b.test/" });
  const g = workspace.placeInWorkspace(w, "conv-ws", [a]);
  assert.ok(g);
  assert.equal(s().groups[g].chatId, "conv-ws");
  assert.equal(s().groups[g].name, "Chat");
  assert.equal(workspace.placeInWorkspace(w, "conv-ws", [b]), g);
  assert.deepEqual(s().groups[g].tabIds, [a, b]);
  assert.equal(workspace.chatOfTab(s(), b), "conv-ws");
  workspace.noteChatTitle("conv-ws", "Flights to Rome");
  assert.equal(s().groups[g].name, "Flights to Rome");
  assert.equal(workspace.placeInWorkspace(w, null, [b]), null);
});

test("entering a chat's workspace shows that chat and opens the panel once", () => {
  assert.deepEqual(workspace.workspaceMove(null, "c1", "c2", false), { show: "c1", open: true });
  assert.deepEqual(workspace.workspaceMove(null, "c1", "c1", true), { show: null, open: false });
  assert.deepEqual(workspace.workspaceMove("c1", "c1", "c2", false), { show: null, open: false });
  assert.deepEqual(workspace.workspaceMove("c1", null, "c1", true), { show: null, open: false });
});

test("the follower switches the panel when the active tab enters a workspace", () => {
  const w = s().createWindow({ url: "https://home.test/" });
  const home = s().windows[w].tabIds[0];
  const t = s().newTab(w, { url: "https://work.test/", background: true });
  workspace.placeInWorkspace(w, "conv-follow", [t]);
  state.updateWindowChat(w, { conversationId: "other", open: false });
  s().activate(home);
  const stop = workspace.startWorkspaceFollow(w);
  s().activate(t);
  assert.equal(state.windowChat(w).conversationId, "conv-follow");
  assert.equal(state.windowChat(w).open, true);
  stop();
});

const FOLDER = { id: "lf1", profileId: "p-live", kind: "pullRequests", name: "My PRs", icon: null, collapsed: false, sources: ["github"], filters: { authored: true, reviewRequests: true }, createdAt: 0 };
const PR = {
  id: "gh:1",
  source: "github",
  url: "https://github.com/o/r/pull/7",
  title: "Fix the parser",
  subtitle: "",
  icon: null,
  updatedAt: Date.UTC(2026, 9, 27),
  section: "review",
  pr: { number: 7, repo: "o/r", author: "ana", authorAvatar: null, draft: false, headRef: "fix", baseRef: "main", review: "changesRequested", mergeable: "conflicting", checks: [{ name: "ci", state: "failure", url: null }], comments: 2, unresolvedThreads: 1, additions: 10, deletions: 3, changedFiles: 2 },
};

test("a live folder reads as one line per item with what the folder knows", () => {
  const lines = liveFolderSection(FOLDER, [PR]).join("\n");
  assert.match(lines, /live folder “My PRs” \(1 pull requests\)/);
  assert.match(lines, /- Fix the parser — https:\/\/github.com\/o\/r\/pull\/7 \(o\/r#7, by ana, changes requested, has conflicts, checks: failing, 1 unresolved threads, \+10 −3 in 2 files, review requested from you, updated 2026-10-27\)/);
  assert.match(liveFolderSection({ name: "Docs", kind: "documents" }, []).join("\n"), /empty right now/);
});

test("Chat About This Folder attaches it once, the turn carries its items, and @ offers it", async () => {
  const w = s().createWindow({ url: "https://x.test/" });
  setLive(() => ({ folders: { lf1: { ...FOLDER, profileId: s().windows[w].profileId } }, folderOrder: ["lf1"], items: { lf1: [PR] } }));
  assert.ok(chatAboutLiveFolder(w, "lf1"));
  assert.ok(chatAboutLiveFolder(w, "lf1"));
  const items = state.windowChat(w).context.filter((i) => i.kind === "liveFolder");
  assert.equal(items.length, 1);
  assert.equal(state.windowChat(w).open, true);
  const context = await buildTurnContext(w);
  assert.match(context.text, /## The person's live folder “My PRs”/);
  assert.match(context.text, /Fix the parser/);
  const found = mentionCandidates(s(), w, "prs");
  assert.ok(found.some((c) => c.kind === "liveFolder" && c.folderId === "lf1" && c.count === 1));
});
