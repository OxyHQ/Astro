import assert from "node:assert/strict";
import { test } from "node:test";

globalThis.__DEV__ = false;
await import("../../test-native-stub.mjs");
const bar = await import("./chatBar.ts");
const { useBrowser } = await import("../../store/browser.ts");
const state = await import("../../ai/chat/state.ts");
const actions = await import("../../ai/chat/actions.ts");

const tab = (tabId, title = "Docs") => ({ id: `i-${tabId}`, kind: "tab", tabId, title, url: `https://example.com/${tabId}`, favicon: null });
const file = { id: "f1", kind: "file", name: "notes.pdf", mime: "application/pdf", uri: "data:application/pdf;base64,AA==", size: 2 };

test("an @ at the start or after a space opens mentions, filtered by what follows", () => {
  assert.deepEqual(bar.barMention("@"), { query: "", start: 0 });
  assert.deepEqual(bar.barMention("compare @git"), { query: "git", start: 8 });
  assert.deepEqual(bar.barMention("compare @git and"), null);
  assert.equal(bar.barMention("me@example.com"), null);
  assert.equal(bar.barMention("hello"), null);
  assert.equal(bar.withoutMention("compare @git", bar.barMention("compare @git")), "compare ");
});

test("attachments are kept once each, and a second pick of a tab in the menu removes it", () => {
  const once = bar.addAttachment([tab("a")], tab("a"));
  assert.equal(once.length, 1);
  assert.equal(bar.toggleAttachment(once, tab("a")).length, 0);
  assert.equal(bar.toggleAttachment(once, tab("b")).length, 2);
});

test("the destination follows the router until it's flipped, and anything attached sends to Chat", () => {
  const chatRow = { kind: "chat", query: "why", routed: true };
  const searchRow = { kind: "search", query: "cats", url: "https://www.google.com/search?q=cats", engine: "Google" };
  assert.equal(bar.barDestination({ override: null, attached: [], first: chatRow }), "chat");
  assert.equal(bar.barDestination({ override: null, attached: [], first: searchRow }), "search");
  assert.equal(bar.barDestination({ override: "chat", attached: [], first: searchRow }), "chat");
  assert.equal(bar.barDestination({ override: "search", attached: [], first: chatRow }), "search");
  assert.equal(bar.barDestination({ override: "search", attached: [tab("a")], first: searchRow }), "chat");
  assert.equal(bar.destinationDecides(null, []), false);
  assert.equal(bar.destinationDecides(null, [tab("a")]), true);
  assert.equal(bar.destinationDecides("search", []), true);
});

test("a question needs words, unless a file goes with it", () => {
  assert.equal(bar.canAskWith("  ", [tab("a")]), false);
  assert.equal(bar.canAskWith("  ", [file]), true);
  assert.equal(bar.canAskWith("what's new", []), true);
});

test("a mentioned group carries its tabs", () => {
  const windowId = useBrowser.getState().createWindow({ url: "https://a.example/" });
  const first = useBrowser.getState().windows[windowId].tabIds[0];
  useBrowser.getState().newTab(windowId, { url: "https://b.example/" });
  const second = useBrowser.getState().windows[windowId].tabIds.at(-1);
  const groupId = useBrowser.getState().createGroup([first, second], { name: "Work" });
  const item = bar.mentionItem({ kind: "group", key: `group:${groupId}`, groupId, title: "Work", count: 2 }, (id) => bar.groupTabRefs(useBrowser.getState(), id), "g1");
  assert.equal(item.kind, "group");
  assert.deepEqual(item.tabs.map((t) => t.tabId), [first, second]);
});

test("what the bar attached reaches Chat's ask: tabs, groups and files, not the page twice", () => {
  const windowId = useBrowser.getState().createWindow({ url: "https://page.example/" });
  const pageTab = useBrowser.getState().windows[windowId].tabIds[0];
  actions.openChatFromEntry({
    windowId,
    prompt: "",
    source: "commandBar",
    page: { tabId: pageTab, url: "https://page.example/", title: "Page" },
    items: [tab(pageTab, "Page"), tab("other"), file],
  });
  const ask = state.windowChat(windowId).ask;
  assert.equal(ask.send, true);
  assert.deepEqual(
    ask.context.map((item) => (item.kind === "tab" ? `tab:${item.tabId}` : `${item.kind}:${item.id}`)),
    [`tab:${pageTab}`, "tab:other", "file:f1"],
  );
});
