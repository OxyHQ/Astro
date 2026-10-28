import assert from "node:assert/strict";
import { test } from "node:test";

const rules = await import("./rules.ts");

const ax = (nodeId, role, name, extra = {}) => ({ nodeId, role: { value: role }, name: { value: name }, ...extra });

const TREE = [
  ax("1", "RootWebArea", "Checkout", { childIds: ["2", "3", "9"] }),
  ax("2", "heading", "Your order", { parentId: "1", childIds: ["2t"], properties: [{ name: "level", value: { value: 2 } }] }),
  ax("2t", "StaticText", "Your order", { parentId: "2" }),
  ax("3", "generic", "", { parentId: "1", childIds: ["4", "5", "6", "7", "8"] }),
  ax("4", "textbox", "Email", { parentId: "3", backendDOMNodeId: 41, value: { value: "a@b.co" }, properties: [{ name: "focusable", value: { value: true } }, { name: "required", value: { value: true } }] }),
  ax("5", "textbox", "Password", { parentId: "3", backendDOMNodeId: 42, value: { value: "hunter2" }, properties: [{ name: "protected", value: { value: true } }] }),
  ax("6", "checkbox", "Remember me", { parentId: "3", backendDOMNodeId: 43, properties: [{ name: "checked", value: { value: "false" } }] }),
  ax("7", "button", "Place order", { parentId: "3", backendDOMNodeId: 44, childIds: ["7t"] }),
  ax("7t", "StaticText", "Place order", { parentId: "7" }),
  ax("8", "link", "Terms", { parentId: "3", backendDOMNodeId: 45, ignored: false }),
  ax("9", "none", "", { parentId: "1", ignored: true, childIds: ["10"] }),
  ax("10", "StaticText", "Total: $12.00", { parentId: "9" }),
];

test("the snapshot lists controls with refs, states and values, never a password", () => {
  const snap = rules.snapshotText(TREE);
  assert.equal(snap.truncated, false);
  assert.equal(snap.refs, 5);
  const lines = snap.text.split("\n");
  assert.deepEqual(lines, [
    '- heading[2] "Your order"',
    '- textbox "Email" value="a@b.co" required [ref=e41]',
    '- textbox "Password" password [ref=e42]',
    '- checkbox "Remember me" unchecked [ref=e43]',
    '- button "Place order" [ref=e44]',
    '- link "Terms" [ref=e45]',
    '- text "Total: $12.00"',
  ]);
  assert.ok(!snap.text.includes("hunter2"));
});

test("the snapshot stops at its budget", () => {
  const snap = rules.snapshotText(TREE, 80);
  assert.equal(snap.truncated, true);
  assert.ok(snap.text.length <= 80);
});

test("refs parse back to node ids", () => {
  assert.equal(rules.backendIdOf("e44"), 44);
  assert.equal(rules.backendIdOf("44"), 44);
  assert.equal(rules.backendIdOf("x44"), null);
  assert.equal(rules.backendIdOf(44), null);
});

const facts = (over) => ({ role: "button", name: "", tag: "button", type: "", inForm: false, searchForm: false, multiline: false, ...over });

test("consequential clicks: buying, sending, deleting, submitting", () => {
  assert.equal(rules.clickConsequence(facts({ name: "Place order" }))?.kind, "purchase");
  assert.equal(rules.clickConsequence(facts({ name: "Buy now" }))?.kind, "purchase");
  assert.equal(rules.clickConsequence(facts({ name: "Send" }))?.kind, "send");
  assert.equal(rules.clickConsequence(facts({ name: "Delete repository" }))?.kind, "delete");
  assert.equal(rules.clickConsequence(facts({ name: "Cancel subscription" }))?.kind, "account");
  assert.equal(rules.clickConsequence(facts({ name: "Continue", tag: "button", type: "submit", inForm: true }))?.kind, "submit");
  assert.equal(rules.clickConsequence(facts({ name: "Continue", tag: "input", type: "submit" }))?.kind, "submit");
});

test("ordinary clicks pass without asking", () => {
  assert.equal(rules.clickConsequence(facts({ name: "Next page" })), null);
  assert.equal(rules.clickConsequence(facts({ name: "Accept all cookies" })), null);
  assert.equal(rules.clickConsequence(facts({ role: "link", tag: "a", name: "Pricing" })), null);
  assert.equal(rules.clickConsequence(facts({ name: "Search", type: "submit", inForm: true, searchForm: true })), null);
  assert.equal(rules.clickConsequence(facts({ name: "Show more" })), null);
});

test("Enter submits a form unless it's a search or a multi-line field", () => {
  const field = facts({ role: "textbox", tag: "input", type: "text", inForm: true });
  assert.equal(rules.enterConsequence(field)?.kind, "submit");
  assert.equal(rules.enterConsequence({ ...field, searchForm: true }), null);
  assert.equal(rules.enterConsequence({ ...field, role: "searchbox" }), null);
  assert.equal(rules.enterConsequence({ ...field, multiline: true }), null);
  assert.equal(rules.enterConsequence({ ...field, inForm: false }), null);
});

test("keys parse to DevTools key events", () => {
  assert.deepEqual(rules.parseKey("Enter"), { key: "Enter", code: "Enter", keyCode: 13, modifiers: 0, text: "\r" });
  assert.deepEqual(rules.parseKey("esc"), { key: "Escape", code: "Escape", keyCode: 27, modifiers: 0 });
  assert.deepEqual(rules.parseKey("Control+a"), { key: "a", code: "KeyA", keyCode: 65, modifiers: 2 });
  assert.deepEqual(rules.parseKey("Shift+Tab"), { key: "Tab", code: "Tab", keyCode: 9, modifiers: 8 });
  assert.equal(rules.parseKey("Hyper+x"), null);
  assert.equal(rules.parseKey("F13"), null);
});

test("labels that repeat a control's name and the page root stay out of the snapshot", () => {
  const nodes = [
    ax("1", "RootWebArea", "Form", { childIds: ["2"], backendDOMNodeId: 1, properties: [{ name: "focusable", value: { value: true } }] }),
    ax("2", "LabelText", "", { parentId: "1", childIds: ["3", "4"] }),
    ax("3", "StaticText", "Full name", { parentId: "2" }),
    ax("4", "textbox", "Full name", { parentId: "2", backendDOMNodeId: 9 }),
  ];
  assert.equal(rules.snapshotText(nodes).text, '- textbox "Full name" [ref=e9]');
});

const session = await import("./session.ts");

test("a run continues only after a completed turn that ended on an action", () => {
  const w = "w-test";
  assert.equal(session.shouldContinue(w, "completed"), false);
  session.beginStep(w, "t1", "Clicking");
  session.endStep(w);
  assert.equal(session.shouldContinue(w, "completed"), true);
  assert.equal(session.shouldContinue(w, "failed"), false);
  session.noteOutput(w);
  assert.equal(session.shouldContinue(w, "completed"), false);
  session.noteContinuation(w);
  session.beginStep(w, "t1", "Typing");
  assert.equal(session.shouldContinue(w, "completed"), true);
  session.stopAgent(w);
  assert.equal(session.shouldContinue(w, "completed"), false);
  assert.equal(session.agentStopped(w), true);
  session.resetAgentStop(w);
  assert.equal(session.agentStopped(w), false);
});
