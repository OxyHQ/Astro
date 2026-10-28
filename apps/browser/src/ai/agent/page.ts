import type { DevToolsMethod, WebViewHandle } from "@astro-browser/astrocore";
import { webviews } from "../../lib/webviews";
import { useBrowser } from "../../store/browser";
import { backendIdOf, parseKey, snapshotText, type AxNode, type ElementFacts, type Snapshot } from "./rules";

export class AgentError extends Error {}

type Answer = Record<string, unknown>;

function handle(tabId: string): WebViewHandle {
  const web = webviews.get(tabId);
  if (!web) throw new AgentError("That tab isn't loaded. Switch to it or open it first.");
  if (!web.devToolsCall) throw new AgentError("This version of Astro can't act in tabs.");
  return web;
}

async function cdp(tabId: string, method: DevToolsMethod, params: Record<string, unknown> = {}): Promise<Answer> {
  const answer = await handle(tabId).devToolsCall!(method, params);
  if (!answer) throw new AgentError("The tab didn't answer.");
  if (answer.error) throw new AgentError(answer.error === "not allowed" ? `${method} isn't allowed.` : `The page refused: ${answer.error}`);
  return answer.result ?? {};
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function nodeId(ref: unknown): number {
  const id = backendIdOf(ref);
  if (id === null) throw new AgentError("Use a ref from page_snapshot, like e123.");
  return id;
}

export async function snapshot(tabId: string): Promise<Snapshot & { title: string; url: string }> {
  const result = await cdp(tabId, "Accessibility.getFullAXTree", {});
  const nodes = Array.isArray(result.nodes) ? (result.nodes as AxNode[]) : [];
  const tab = useBrowser.getState().tabs[tabId];
  return { ...snapshotText(nodes), title: tab?.customTitle || tab?.title || "", url: tab?.url ?? "" };
}

async function withNode<T>(tabId: string, ref: unknown, fn: (objectId: string) => Promise<T>): Promise<T> {
  const resolved = await cdp(tabId, "DOM.resolveNode", { backendNodeId: nodeId(ref) }).catch(() => null);
  const objectId = (resolved?.object as { objectId?: string } | undefined)?.objectId;
  if (!objectId) throw new AgentError("That element is gone. Take a new page_snapshot.");
  try {
    return await fn(objectId);
  } finally {
    void cdp(tabId, "Runtime.releaseObject", { objectId }).catch(() => {});
  }
}

async function callOn<T>(tabId: string, objectId: string, fn: string, args: unknown[] = []): Promise<T> {
  const result = await cdp(tabId, "Runtime.callFunctionOn", {
    objectId,
    functionDeclaration: fn,
    arguments: args.map((value) => ({ value })),
    returnByValue: true,
    awaitPromise: true,
  });
  if (result.exceptionDetails) throw new AgentError("The page refused that.");
  return (result.result as { value?: T } | undefined)?.value as T;
}

const FACTS = `function() {
  const el = this.nodeType === 1 ? this : this.parentElement;
  if (!el) return null;
  const form = el.closest('form');
  const tag = el.tagName.toLowerCase();
  const field = el.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"]') || el;
  return {
    tag,
    type: String(el.getAttribute('type') || (tag === 'button' && form ? 'submit' : '')).toLowerCase(),
    inForm: !!form,
    searchForm: !!(form && (form.getAttribute('role') === 'search' || form.querySelector('input[type=search]') || /search/i.test((form.getAttribute('action') || '') + ' ' + (form.id || '') + ' ' + (form.className || '')))),
    multiline: field.tagName === 'TEXTAREA' || field.isContentEditable,
    role: el.getAttribute('role') || '',
    label: (el.getAttribute('aria-label') || el.innerText || el.value || el.getAttribute('title') || el.getAttribute('alt') || '').trim().slice(0, 200),
  };
}`;

export async function elementFacts(tabId: string, ref: unknown): Promise<ElementFacts & { label: string }> {
  const id = nodeId(ref);
  const ax = await cdp(tabId, "Accessibility.getPartialAXTree", { backendNodeId: id, fetchRelatives: false }).catch(() => null);
  const node = (Array.isArray(ax?.nodes) ? (ax!.nodes as AxNode[]) : []).find((n) => n.backendDOMNodeId === id) ?? (ax?.nodes as AxNode[] | undefined)?.[0];
  const facts = await withNode(tabId, ref, (objectId) =>
    callOn<{ tag: string; type: string; inForm: boolean; searchForm: boolean; multiline: boolean; role: string; label: string } | null>(tabId, objectId, FACTS),
  );
  if (!facts) throw new AgentError("That element is gone. Take a new page_snapshot.");
  const name = typeof node?.name?.value === "string" ? node.name.value : "";
  return {
    role: (typeof node?.role?.value === "string" ? node.role.value : "") || facts.role,
    name: name || facts.label,
    label: name || facts.label,
    tag: facts.tag,
    type: facts.type,
    inForm: facts.inForm,
    searchForm: facts.searchForm,
    multiline: facts.multiline,
  };
}

async function viewport(tabId: string) {
  const metrics = await cdp(tabId, "Page.getLayoutMetrics", {});
  const v = (metrics.cssLayoutViewport ?? metrics.layoutViewport) as { clientWidth: number; clientHeight: number } | undefined;
  const visual = metrics.cssVisualViewport as { pageX?: number; pageY?: number } | undefined;
  return { width: v?.clientWidth ?? 1024, height: v?.clientHeight ?? 768, pageX: visual?.pageX ?? 0, pageY: visual?.pageY ?? 0 };
}

async function centerOf(tabId: string, ref: unknown): Promise<{ x: number; y: number }> {
  const backendNodeId = nodeId(ref);
  await cdp(tabId, "DOM.scrollIntoViewIfNeeded", { backendNodeId }).catch(() => {});
  const quads = await cdp(tabId, "DOM.getContentQuads", { backendNodeId }).catch(() => null);
  const list = Array.isArray(quads?.quads) ? (quads!.quads as number[][]) : [];
  const { width, height } = await viewport(tabId);
  for (const q of list) {
    if (q.length < 8) continue;
    const xs = [q[0]!, q[2]!, q[4]!, q[6]!];
    const ys = [q[1]!, q[3]!, q[5]!, q[7]!];
    const left = Math.max(0, Math.min(...xs));
    const right = Math.min(width, Math.max(...xs));
    const top = Math.max(0, Math.min(...ys));
    const bottom = Math.min(height, Math.max(...ys));
    if (right - left >= 1 && bottom - top >= 1) return { x: (left + right) / 2, y: (top + bottom) / 2 };
  }
  throw new AgentError("That element isn't visible on the page. Scroll or take a new page_snapshot.");
}

async function mouse(tabId: string, type: "mouseMoved" | "mousePressed" | "mouseReleased", x: number, y: number, clickCount = 1) {
  await cdp(tabId, "Input.dispatchMouseEvent", {
    type,
    x,
    y,
    button: type === "mouseMoved" ? "none" : "left",
    buttons: type === "mousePressed" ? 1 : 0,
    clickCount: type === "mouseMoved" ? 0 : clickCount,
    pointerType: "mouse",
  });
}

export async function click(tabId: string, ref: unknown, double = false) {
  const { x, y } = await centerOf(tabId, ref);
  await mouse(tabId, "mouseMoved", x, y);
  for (let count = 1; count <= (double ? 2 : 1); count++) {
    await mouse(tabId, "mousePressed", x, y, count);
    await mouse(tabId, "mouseReleased", x, y, count);
  }
  await settle(tabId);
}

const SELECT_ALL = `function() {
  const el = this.nodeType === 1 ? this : this.parentElement;
  if (!el) return false;
  el.focus();
  if (typeof el.select === 'function' && /^(INPUT|TEXTAREA)$/.test(el.tagName)) { el.select(); return true; }
  if (el.isContentEditable) {
    const range = document.createRange();
    range.selectNodeContents(el);
    const selection = getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    return true;
  }
  return false;
}`;

export async function focus(tabId: string, ref: unknown) {
  const backendNodeId = nodeId(ref);
  await cdp(tabId, "DOM.scrollIntoViewIfNeeded", { backendNodeId }).catch(() => {});
  const focused = await cdp(tabId, "DOM.focus", { backendNodeId }).then(
    () => true,
    () => false,
  );
  if (!focused) await click(tabId, ref);
}

export async function typeText(tabId: string, ref: unknown, text: string, clear: boolean) {
  await focus(tabId, ref);
  if (clear) {
    const selected = await withNode(tabId, ref, (objectId) => callOn<boolean>(tabId, objectId, SELECT_ALL));
    if (selected && !text) await press(tabId, "Backspace");
  }
  if (text) await cdp(tabId, "Input.insertText", { text });
  await delay(50);
}

export async function press(tabId: string, spec: string) {
  const key = parseKey(spec);
  if (!key) throw new AgentError(`Unknown key “${spec}”. Use names like Enter, Tab, Escape, ArrowDown, or Control+A.`);
  const base = { modifiers: key.modifiers, key: key.key, code: key.code, windowsVirtualKeyCode: key.keyCode, nativeVirtualKeyCode: key.keyCode };
  await cdp(tabId, "Input.dispatchKeyEvent", { type: key.text ? "keyDown" : "rawKeyDown", ...base, ...(key.text ? { text: key.text, unmodifiedText: key.text } : {}) });
  await cdp(tabId, "Input.dispatchKeyEvent", { type: "keyUp", ...base });
  await settle(tabId);
}

export async function scroll(tabId: string, direction: "up" | "down" | "left" | "right", pages: number, ref?: unknown) {
  const { width, height } = await viewport(tabId);
  const point = ref ? await centerOf(tabId, ref) : { x: width / 2, y: height / 2 };
  const amount = Math.max(0.1, Math.min(10, pages));
  const deltaY = direction === "down" ? height * amount : direction === "up" ? -height * amount : 0;
  const deltaX = direction === "right" ? width * amount : direction === "left" ? -width * amount : 0;
  await cdp(tabId, "Input.dispatchMouseEvent", { type: "mouseWheel", x: point.x, y: point.y, deltaX, deltaY, pointerType: "mouse" });
  await delay(250);
  const web = handle(tabId);
  return (await web.evaluate<{ x: number; y: number; height: number; viewport: number }>(
    "post('result', JSON.stringify({ x: scrollX, y: scrollY, height: document.documentElement.scrollHeight, viewport: innerHeight }));",
  )) ?? null;
}

const SELECT = `function(values) {
  const el = this.nodeType === 1 ? this : this.parentElement;
  if (!el || el.tagName !== 'SELECT') return { error: 'not a select' };
  const wanted = values.map((v) => String(v).trim().toLowerCase());
  const picked = [];
  for (const option of el.options) {
    const hit = wanted.includes(option.value.toLowerCase()) || wanted.includes(option.label.trim().toLowerCase()) || wanted.includes(option.text.trim().toLowerCase());
    if (hit && (el.multiple || !picked.length)) picked.push(option);
  }
  if (!picked.length) return { error: 'no match', options: Array.from(el.options).slice(0, 50).map((o) => o.label || o.value) };
  for (const option of el.options) option.selected = picked.includes(option);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  return { selected: picked.map((o) => o.label || o.value) };
}`;

export async function selectOption(tabId: string, ref: unknown, values: string[]) {
  await focus(tabId, ref);
  const answer = await withNode(tabId, ref, (objectId) => callOn<{ error?: string; options?: string[]; selected?: string[] }>(tabId, objectId, SELECT, [values]));
  if (answer?.error === "not a select") throw new AgentError("That isn't a <select>. Click it and pick the option with click instead.");
  if (answer?.error) throw new AgentError(`None of those options exists. Options: ${(answer.options ?? []).join(", ")}`);
  return answer?.selected ?? [];
}

const CHECK = `function(on) {
  const el = this.nodeType === 1 ? this : this.parentElement;
  if (!el) return null;
  const input = el.matches('input') ? el : el.querySelector('input[type=checkbox], input[type=radio]');
  if (input) return input.checked !== on;
  const state = el.getAttribute('aria-checked');
  return state === null ? null : (state === 'true') !== on;
}`;

export async function setChecked(tabId: string, ref: unknown, on: boolean) {
  const needsClick = await withNode(tabId, ref, (objectId) => callOn<boolean | null>(tabId, objectId, CHECK, [on]));
  if (needsClick !== false) await click(tabId, ref);
}

export async function settle(tabId: string, ms = 2500) {
  const deadline = Date.now() + ms;
  await delay(120);
  while (Date.now() < deadline) {
    if (!useBrowser.getState().live[tabId]?.isLoading) return;
    await delay(120);
  }
}

export async function waitFor(tabId: string, text: string | undefined, seconds: number, stopped: () => boolean = () => false) {
  const deadline = Date.now() + Math.max(0.2, Math.min(15, seconds)) * 1000;
  await delay(150);
  while (Date.now() < deadline && !stopped()) {
    const web = webviews.get(tabId);
    if (!web) {
      await delay(150);
      continue;
    }
    const loading = !!useBrowser.getState().live[tabId]?.isLoading;
    if (!text && !loading) return true;
    if (text) {
      const found = await web.evaluate<boolean>(
        `post('result', JSON.stringify(((document.body && document.body.innerText) || '').toLowerCase().includes(${JSON.stringify(text.toLowerCase())})));`,
      );
      if (found) return true;
    }
    await delay(300);
  }
  return false;
}

export async function navigationStarted(tabId: string, from: string, ms = 3000) {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    const s = useBrowser.getState();
    if (s.live[tabId]?.isLoading || (s.tabs[tabId]?.url ?? from) !== from) return true;
    await delay(80);
  }
  return false;
}

export const SCREENSHOT_LIMIT = 40_000;

export async function screenshot(tabId: string): Promise<{ data: string; width: number; height: number }> {
  const { width, height, pageX, pageY } = await viewport(tabId);
  const attempts = [
    { max: 1024, quality: 55 },
    { max: 1024, quality: 40 },
    { max: 800, quality: 40 },
    { max: 640, quality: 35 },
    { max: 512, quality: 30 },
  ];
  for (const { max, quality } of attempts) {
    const scale = Math.min(1, max / Math.max(width, 1));
    const shot = await cdp(tabId, "Page.captureScreenshot", {
      format: "jpeg",
      quality,
      clip: { x: pageX, y: pageY, width, height, scale },
      captureBeyondViewport: false,
    });
    const data = typeof shot.data === "string" ? shot.data : "";
    if (data && data.length <= SCREENSHOT_LIMIT) return { data, width: Math.round(width * scale), height: Math.round(height * scale) };
  }
  throw new AgentError("The screenshot was too large to send.");
}
