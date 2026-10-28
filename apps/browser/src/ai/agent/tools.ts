import type { AliaHostAction, AliaHostOutcome, AliaHostToolDefinition } from "@alia.onl/sdk/runtime";
import { useBrowser } from "../../store/browser";
import { activeTabId, viewTabIds } from "../../store/model";
import { allowInChat, allowedInChat, ask, chatKey, type ApprovalItem } from "../chat/approvals";
import { windowChat } from "../chat/state";
import { consentToShare, shareStateOf } from "../safety/consent";
import { contentPolicy, redactForModel } from "../safety/policy";
import { AgentError, click, elementFacts, navigationStarted, press, screenshot, scroll, selectOption, setChecked, snapshot, typeText, waitFor } from "./page";
import { clickConsequence, consequenceLabel, enterConsequence, hostOf, parseKey, type Consequence } from "./rules";
import { agentStopped, beginStep, endStep } from "./session";
import { webviews } from "../../lib/webviews";

export const IMAGE_RESULTS = false;

const TAB_ID = { type: "string", description: "The tab's id from the list of open tabs. Leave it out for the tab the person is on." };
const REF = { type: "string", description: "An element ref from page_snapshot, like e123." };

const AFTER = "It answers with the page's new snapshot.";

export const AGENT_TOOLS: AliaHostToolDefinition[] = [
  {
    name: "page_snapshot",
    description:
      "Read the structure of one of the person's tabs as its accessibility tree: headings, text, links, buttons and form fields, each control with a ref (e123) the other page tools take. Call it before acting on a page, and again when a ref is stale.",
    inputSchema: { type: "object", properties: { tabId: TAB_ID }, additionalProperties: false },
    awaitsResult: true,
  },
  {
    name: "click",
    description: `Click an element in the person's tab, with a real mouse click. The person is asked first the first time you act on a site, and before anything that buys, pays, sends, posts, deletes or submits. ${AFTER}`,
    inputSchema: { type: "object", properties: { tabId: TAB_ID, ref: REF, double: { type: "boolean" } }, required: ["ref"], additionalProperties: false },
    awaitsResult: true,
  },
  {
    name: "type_text",
    description: `Type text into a field of the person's tab (it replaces what's there unless clear is false). submit presses Enter afterwards; submitting a form asks the person first. Never type passwords or payment card numbers. ${AFTER}`,
    inputSchema: {
      type: "object",
      properties: { tabId: TAB_ID, ref: REF, text: { type: "string", maxLength: 10000 }, clear: { type: "boolean" }, submit: { type: "boolean" } },
      required: ["ref", "text"],
      additionalProperties: false,
    },
    awaitsResult: true,
  },
  {
    name: "press_key",
    description: `Press a key in the person's tab, on the focused element or on ref: Enter, Tab, Escape, Backspace, ArrowDown, PageDown, Space, or a combination like Control+A. ${AFTER}`,
    inputSchema: { type: "object", properties: { tabId: TAB_ID, key: { type: "string", maxLength: 40 }, ref: REF }, required: ["key"], additionalProperties: false },
    awaitsResult: true,
  },
  {
    name: "scroll",
    description: "Scroll the person's tab, or the scrollable element ref, by a number of screens (default 0.8). Answers with the new scroll position.",
    inputSchema: {
      type: "object",
      properties: { tabId: TAB_ID, direction: { type: "string", enum: ["up", "down", "left", "right"] }, screens: { type: "number", minimum: 0.1, maximum: 10 }, ref: REF },
      required: ["direction"],
      additionalProperties: false,
    },
    awaitsResult: true,
  },
  {
    name: "select_option",
    description: `Choose options of a <select> in the person's tab, by value or label. For custom dropdowns, click them instead. ${AFTER}`,
    inputSchema: {
      type: "object",
      properties: { tabId: TAB_ID, ref: REF, values: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 20 } },
      required: ["ref", "values"],
      additionalProperties: false,
    },
    awaitsResult: true,
  },
  {
    name: "navigate",
    description: `Load an http(s) address in the person's tab, or go back, forward or reload. ${AFTER}`,
    inputSchema: {
      type: "object",
      properties: { tabId: TAB_ID, url: { type: "string" }, history: { type: "string", enum: ["back", "forward", "reload"] } },
      additionalProperties: false,
    },
    awaitsResult: true,
  },
  {
    name: "wait_for",
    description: "Wait until text appears in the person's tab, or until it finishes loading, for up to 15 seconds.",
    inputSchema: { type: "object", properties: { tabId: TAB_ID, text: { type: "string", maxLength: 200 }, seconds: { type: "number", minimum: 0.2, maximum: 15 } }, additionalProperties: false },
    awaitsResult: true,
  },
  {
    name: "fill_form",
    description:
      "Fill several fields of a form in the person's tab at once, from what you know from the conversation: text fields, <select>s (by option label) and checkboxes or radios (\"true\"/\"false\"). The person sees every field and value and approves before anything is typed; nothing is submitted. Take a page_snapshot first for the refs. Never fill passwords or payment card numbers.",
    inputSchema: {
      type: "object",
      properties: {
        tabId: TAB_ID,
        fields: {
          type: "array",
          minItems: 1,
          maxItems: 40,
          items: { type: "object", properties: { ref: REF, value: { type: "string", maxLength: 5000 } }, required: ["ref", "value"], additionalProperties: false },
        },
      },
      required: ["fields"],
      additionalProperties: false,
    },
    awaitsResult: true,
  },
];

const SCREENSHOT: AliaHostToolDefinition = {
  name: "screenshot",
  description: "See what the person's tab shows right now, as an image of its visible part.",
  inputSchema: { type: "object", properties: { tabId: TAB_ID }, additionalProperties: false },
  awaitsResult: true,
};

export const agentToolDefinitions = () => (IMAGE_RESULTS ? [...AGENT_TOOLS, SCREENSHOT] : AGENT_TOOLS);

export const AGENT_TOOL_NAMES = new Set([...AGENT_TOOLS, SCREENSHOT].map((tool) => tool.name));

const READING = new Set(["page_snapshot", "screenshot", "wait_for"]);

type Tab = { id: string; title: string; customTitle: string | null; url: string };

function resolveTab(windowId: string, tabId: unknown): Tab | null {
  const s = useBrowser.getState();
  const id = typeof tabId === "string" && tabId ? tabId : activeTabId(s, windowId);
  return id && viewTabIds(s, windowId).includes(id) ? (s.tabs[id] ?? null) : null;
}

const describe = (tab: Tab): ApprovalItem => ({ tabId: tab.id, title: tab.customTitle || tab.title || tab.url, url: tab.url });

export function tabIsShared(windowId: string, tabId: string) {
  const chat = windowChat(windowId);
  return (
    (chat.currentTab && activeTabId(useBrowser.getState(), windowId) === tabId) ||
    chat.context.some((item) => (item.kind === "tab" && item.tabId === tabId) || (item.kind === "group" && item.tabs.some((t) => t.tabId === tabId)))
  );
}

const actHosts = new Map<string, Set<string>>();

async function mayAct(windowId: string, tab: Tab, conversation: string | null): Promise<boolean> {
  const host = hostOf(tab.url);
  if (!host) return true;
  const key = chatKey(windowId, conversation);
  if ((useBrowser.getState().settings.agentSites ?? []).includes(host) || actHosts.get(key)?.has(host)) return true;
  const choice = await ask(windowId, {
    kind: "act",
    tabs: [describe(tab)],
    question: `Let Alia use ${host}?`,
    note: "Alia will click, type and scroll in this tab. It asks again before buying, sending, deleting or submitting anything.",
    options: [
      { value: "allow", label: "Allow in This Chat" },
      { value: "always", label: "Always Allow on This Site" },
      { value: "deny", label: "Don’t Allow" },
    ],
  });
  if (choice === "deny") return false;
  if (choice === "always") {
    const s = useBrowser.getState();
    s.updateSettings({ agentSites: [...new Set([...(s.settings.agentSites ?? []), host])] });
  } else {
    actHosts.set(key, new Set([...(actHosts.get(key) ?? []), host]));
  }
  return true;
}

export function forgetAgentSite(host: string) {
  const s = useBrowser.getState();
  s.updateSettings({ agentSites: (s.settings.agentSites ?? []).filter((h) => h !== host) });
  for (const hosts of actHosts.values()) hosts.delete(host);
}

async function confirmConsequence(windowId: string, tab: Tab, consequence: Consequence, what: string): Promise<boolean> {
  const choice = await ask(windowId, {
    kind: "confirm",
    tabs: [{ ...describe(tab), detail: what }],
    question: `Let Alia ${what}?`,
    note: `This looks like ${consequenceLabel(consequence.kind)} on ${hostOf(tab.url) || "this page"}.`,
    options: [
      { value: "allow", label: "Allow" },
      { value: "deny", label: "Don’t Allow" },
    ],
  });
  return choice === "allow";
}

const quote = (text: string, limit = 60) => {
  const one = text.replace(/\s+/g, " ").trim();
  return `“${one.length > limit ? `${one.slice(0, limit - 1)}…` : one}”`;
};

async function pageState(tabId: string) {
  const snap = await snapshot(tabId);
  const text = redactForModel(snap.text).text;
  return { title: snap.title, url: snap.url, snapshot: text.slice(0, 30_000), truncated: snap.truncated || text.length > 30_000 };
}

const rejected = (detail: string): AliaHostOutcome => ({ outcome: "rejected", detail });

const FOCUSED_FACTS = `
const el = document.activeElement;
const form = el && el.closest ? el.closest('form') : null;
post('result', JSON.stringify(el && el !== document.body ? {
  role: el.getAttribute('role') || '',
  name: (el.getAttribute('aria-label') || el.getAttribute('name') || el.getAttribute('placeholder') || '').slice(0, 200),
  tag: el.tagName.toLowerCase(),
  type: String(el.getAttribute('type') || '').toLowerCase(),
  inForm: !!form,
  searchForm: !!(form && (form.getAttribute('role') === 'search' || form.querySelector('input[type=search]') || /search/i.test((form.getAttribute('action') || '') + ' ' + (form.id || '') + ' ' + (form.className || '')))),
  multiline: el.tagName === 'TEXTAREA' || !!el.isContentEditable,
} : null));
`;

async function enterFacts(tabId: string, ref: unknown) {
  if (ref !== undefined) return elementFacts(tabId, ref);
  return (await webviews.get(tabId)?.evaluate<Awaited<ReturnType<typeof elementFacts>>>(FOCUSED_FACTS)) ?? null;
}

const isTrue = (value: string) => /^(true|yes|on|checked|1|x|✓)$/i.test(value.trim());

export async function runAgentTool(windowId: string, action: AliaHostAction): Promise<AliaHostOutcome> {
  if (agentStopped(windowId)) return rejected("The person stopped Alia. Don't act in their tabs again until they ask.");
  if (!contentPolicy().agent) return rejected("The person's organization doesn't allow Alia to act in their browser.");
  const input = (action.input ?? {}) as Record<string, unknown>;
  const tab = resolveTab(windowId, input.tabId);
  if (!tab) return { outcome: "stale", detail: "That tab isn't open in this window." };
  const conversation = windowChat(windowId).conversationId;
  const key = chatKey(windowId, conversation);
  const share = shareStateOf(tab.url, key);
  if (share.state === "blocked") return rejected(`${share.sensitivity?.host ?? "This site"} is blocked for AI by the person's organization.`);
  if (share.state === "withheld" && !(await consentToShare(windowId, conversation, describe(tab)))) return rejected("The person didn't share this site.");
  if (agentStopped(windowId)) return rejected("The person stopped Alia.");

  if (READING.has(action.name)) {
    if (!tabIsShared(windowId, tab.id) && share.state === "free" && !allowedInChat(key, "read")) {
      const choice = await ask(windowId, { kind: "read", tabs: [describe(tab)] });
      if (choice === "deny") return rejected("The person declined.");
      if (choice === "always") allowInChat(key, "read");
    }
  } else if (action.name !== "fill_form" && !(await mayAct(windowId, tab, conversation))) {
    return rejected("The person didn't allow Alia to act on this site.");
  }
  if (agentStopped(windowId)) return rejected("The person stopped Alia.");

  try {
    switch (action.name) {
      case "page_snapshot": {
        beginStep(windowId, tab.id, "Reading the page");
        const state = await pageState(tab.id);
        return { outcome: "inline", detail: `Read “${state.title}”.`, result: state };
      }
      case "screenshot": {
        beginStep(windowId, tab.id, "Looking at the page");
        const shot = await screenshot(tab.id);
        return {
          outcome: "inline",
          detail: "Took a screenshot.",
          result: { type: "image", mediaType: "image/jpeg", data: shot.data, text: `The visible part of “${tab.customTitle || tab.title}” (${tab.url}), ${shot.width}×${shot.height}.` },
        };
      }
      case "wait_for": {
        const text = typeof input.text === "string" ? input.text : undefined;
        beginStep(windowId, tab.id, text ? `Waiting for ${quote(text)}` : "Waiting for the page");
        const found = await waitFor(tab.id, text, typeof input.seconds === "number" ? input.seconds : 5, () => agentStopped(windowId));
        if (agentStopped(windowId)) return rejected("The person stopped Alia.");
        return { outcome: "inline", detail: found ? "Done waiting." : "Timed out.", result: { found } };
      }
      case "click": {
        const facts = await elementFacts(tab.id, input.ref);
        const consequence = clickConsequence(facts);
        const what = `click ${quote(facts.label || facts.role || "this")}`;
        if (consequence && !(await confirmConsequence(windowId, tab, consequence, what))) return rejected("The person didn't allow that click.");
        if (agentStopped(windowId)) return rejected("The person stopped Alia.");
        beginStep(windowId, tab.id, `Clicking ${quote(facts.label || facts.role || "")}`);
        await click(tab.id, input.ref, input.double === true);
        return { outcome: "inline", detail: `Clicked ${quote(facts.label || facts.role)}.`, result: await pageState(tab.id) };
      }
      case "type_text": {
        const text = typeof input.text === "string" ? input.text : "";
        const facts = await elementFacts(tab.id, input.ref);
        if (facts.type === "password") return rejected("Alia doesn't type passwords; the person's password manager fills them.");
        const submit = input.submit === true;
        const consequence = submit ? enterConsequence(facts) : null;
        if (consequence && !(await confirmConsequence(windowId, tab, consequence, `type in ${quote(facts.label || "the field")} and submit`)))
          return rejected("The person didn't allow submitting.");
        if (agentStopped(windowId)) return rejected("The person stopped Alia.");
        beginStep(windowId, tab.id, `Typing in ${quote(facts.label || "a field")}`);
        await typeText(tab.id, input.ref, text, input.clear !== false);
        if (submit) await press(tab.id, "Enter");
        return { outcome: "inline", detail: `Typed in ${quote(facts.label || "the field")}${submit ? " and pressed Enter" : ""}.`, result: await pageState(tab.id) };
      }
      case "press_key": {
        const spec = typeof input.key === "string" ? input.key : "";
        const key = parseKey(spec);
        if (!key) return rejected(`Unknown key “${spec}”.`);
        if (key.key === "Enter" && !(key.modifiers & 7)) {
          const facts = await enterFacts(tab.id, input.ref);
          const consequence = facts ? enterConsequence(facts) : null;
          if (consequence && !(await confirmConsequence(windowId, tab, consequence, `press Enter in ${quote(facts?.name || "the form")}`)))
            return rejected("The person didn't allow submitting.");
        }
        if (agentStopped(windowId)) return rejected("The person stopped Alia.");
        beginStep(windowId, tab.id, `Pressing ${spec}`);
        if (input.ref !== undefined) await typeText(tab.id, input.ref, "", false);
        await press(tab.id, spec);
        return { outcome: "inline", detail: `Pressed ${spec}.`, result: await pageState(tab.id) };
      }
      case "scroll": {
        const direction = input.direction === "up" || input.direction === "left" || input.direction === "right" ? input.direction : "down";
        beginStep(windowId, tab.id, `Scrolling ${direction}`);
        const position = await scroll(tab.id, direction, typeof input.screens === "number" ? input.screens : 0.8, input.ref);
        return { outcome: "inline", detail: `Scrolled ${direction}.`, result: position ?? {} };
      }
      case "select_option": {
        const values = Array.isArray(input.values) ? input.values.filter((v): v is string => typeof v === "string") : [];
        const facts = await elementFacts(tab.id, input.ref);
        beginStep(windowId, tab.id, `Choosing ${quote(values.join(", "))}`);
        const selected = await selectOption(tab.id, input.ref, values);
        return { outcome: "inline", detail: `Chose ${selected.join(", ")} in ${quote(facts.label || "the list")}.`, result: await pageState(tab.id) };
      }
      case "navigate": {
        const web = webviews.get(tab.id);
        const history = input.history;
        const from = tab.url;
        if (history && !web) return { outcome: "failed", detail: "That tab isn't loaded." };
        const url = typeof input.url === "string" ? input.url.trim() : "";
        if (!history && !/^https?:\/\//i.test(url)) return rejected("Give an http(s) address, or history back, forward or reload.");
        beginStep(windowId, tab.id, history ? (history === "back" ? "Going back" : history === "forward" ? "Going forward" : "Reloading") : `Going to ${hostOf(url) || url}`);
        if (history === "back") await web!.goBack();
        else if (history === "forward") await web!.goForward();
        else if (history === "reload") await web!.reload();
        else {
          const target = siteOf(url);
          if (target.blocked) return rejected(`${target.host} is blocked for AI by the person's organization.`);
          useBrowser.getState().navigate(tab.id, url);
        }
        await navigationStarted(tab.id, from);
        await waitFor(tab.id, undefined, 10).catch(() => false);
        const now = useBrowser.getState().tabs[tab.id];
        const after = shareStateOf(now?.url ?? "", key);
        if (after.state === "withheld" || after.state === "blocked")
          return { outcome: "applied", detail: `Loaded ${hostOf(now?.url ?? "")}, which is ${after.state === "blocked" ? "blocked for AI" : "a sensitive site"}; read it only with the person's consent (page_snapshot asks).` };
        return { outcome: "inline", detail: `Loaded ${hostOf(now?.url ?? url) || "the page"}.`, result: await pageState(tab.id) };
      }
      case "fill_form":
        return await fillForm(windowId, tab, input.fields);
    }
    return rejected(`Unknown tool ${action.name}.`);
  } catch (error) {
    return { outcome: "failed", detail: error instanceof AgentError ? error.message : "The page couldn't be used." };
  } finally {
    endStep(windowId);
  }
}

function siteOf(url: string) {
  const state = shareStateOf(url, "");
  return { host: hostOf(url), blocked: state.state === "blocked" };
}

type FieldPlan = { ref: string; value: string; label: string; kind: "text" | "select" | "check" };

async function fillForm(windowId: string, tab: Tab, raw: unknown): Promise<AliaHostOutcome> {
  const fields = (Array.isArray(raw) ? raw : [])
    .flatMap((f): { ref: string; value: string }[] =>
      f && typeof f === "object" && typeof (f as { ref?: unknown }).ref === "string" && typeof (f as { value?: unknown }).value === "string"
        ? [{ ref: (f as { ref: string }).ref, value: (f as { value: string }).value }]
        : [],
    )
    .slice(0, 40);
  if (!fields.length) return rejected("No fields to fill.");
  const plans: FieldPlan[] = [];
  const refused: string[] = [];
  for (const field of fields) {
    const facts = await elementFacts(tab.id, field.ref).catch(() => null);
    if (!facts) {
      refused.push(`${field.ref}: gone`);
      continue;
    }
    const label = facts.label || facts.role || field.ref;
    if (facts.type === "password" || facts.type === "file" || /\b(card ?number|cvv|cvc|security code)\b/i.test(label)) {
      refused.push(`${label}: not filled by Alia`);
      continue;
    }
    const kind = facts.tag === "select" ? "select" : facts.type === "checkbox" || facts.type === "radio" || /^(checkbox|radio|switch)$/.test(facts.role) ? "check" : "text";
    plans.push({ ref: field.ref, value: field.value, label, kind });
  }
  if (!plans.length) return rejected(`Nothing Alia may fill: ${refused.join("; ")}.`);
  const host = hostOf(tab.url) || "this page";
  const choice = await ask(windowId, {
    kind: "fill",
    tabs: plans.map((p) => ({ tabId: tab.id, title: p.label, url: tab.url, detail: p.kind === "check" ? (isTrue(p.value) ? "✓ On" : "Off") : p.value })),
    question: plans.length === 1 ? `Fill 1 field on ${host}?` : `Fill ${plans.length} fields on ${host}?`,
    note: "Nothing is submitted.",
    options: [
      { value: "allow", label: "Fill" },
      { value: "deny", label: "Don’t Fill" },
    ],
  });
  if (choice === "deny") return rejected("The person didn't want the form filled.");
  if (agentStopped(windowId)) return rejected("The person stopped Alia.");
  const filled: string[] = [];
  const failed: string[] = [...refused];
  for (const plan of plans) {
    if (agentStopped(windowId)) break;
    beginStep(windowId, tab.id, `Filling ${quote(plan.label, 40)}`);
    try {
      if (plan.kind === "select") await selectOption(tab.id, plan.ref, [plan.value]);
      else if (plan.kind === "check") await setChecked(tab.id, plan.ref, isTrue(plan.value));
      else await typeText(tab.id, plan.ref, plan.value, true);
      filled.push(plan.label);
    } catch (error) {
      failed.push(`${plan.label}: ${error instanceof AgentError ? error.message : "couldn't be filled"}`);
    }
  }
  return {
    outcome: "inline",
    detail: `Filled ${filled.length} of ${plans.length} field${plans.length === 1 ? "" : "s"}.`,
    result: { filled, failed, ...(await pageState(tab.id)) },
  };
}
