import type { ContentBlockerState, ContentBlockerStats, FilterListCategory } from "@astro-browser-real/astrocore";
import { emitNativeEvent } from "../../../demo/src/shims/expo-modules-core";
import { loadCr } from "./engine";
import { openExtensionView } from "./extensionViews";
import { callTab } from "./tabBridge";
import type { EngineTab } from "./tabs";

const EXTENSION_ID = "fajbdaomknpkicfjcpipdmcpoamdmilh";
const ORIGIN = `chrome-extension://${EXTENSION_ID}`;
const OFF_DIRECTIVE = "/^(?:astro-blocking-off|)/";
const ATTEMPTS = 40;
const RETRY_MS = 250;
const OP_MS = 20_000;
const PAGE_IDLE_MS = 30_000;
const SETTLE_AFTER_LAUNCH_MS = 1_500;
const RETRIABLE = ["no reply", "no answer", "context invalidated", "not the extension page", "renderer ", "closed"];

const PRELUDE = (leftMs: number, expression: string) => `let failing = false;
const offDirective = ${JSON.stringify(OFF_DIRECTIVE)};
const extensionOrigin = ${JSON.stringify(ORIGIN)};
const deadline = Date.now() + ${leftMs};
const left = () => Math.max(0, deadline - Date.now());
let expired = false;
const withDeadline = (promise, what) => new Promise((resolve, reject) => {
  const timer = setTimeout(() => { expired = true; reject(new Error(\`\${what}: timed out\`)); }, left());
  promise.then((v) => { clearTimeout(timer); resolve(v); }, (e) => { clearTimeout(timer); reject(e); });
});
const ready = () => new Promise((resolve, reject) => {
  const look = () => {
    const ublock = chrome.extension.getBackgroundPage()?.µBlock;
    if (ublock?.isReadyPromise) return ublock.isReadyPromise.then(resolve, reject);
    if (left() === 0) return reject(new Error('uBlock Origin never started'));
    setTimeout(look, 10);
  };
  look();
});
const loadScript = (src) => new Promise((resolve, reject) => {
  const element = document.createElement('script');
  element.src = src;
  element.onload = resolve;
  element.onerror = () => reject(new Error(\`\${src} didn't load\`));
  document.head.append(element);
});
const client = () => self.vAPI?.messaging ? Promise.resolve()
  : ['js/vapi.js', 'js/vapi-common.js', 'js/vapi-client.js'].reduce((p, src) => p.then(() => loadScript(src)), Promise.resolve());
const send = (message) => {
  if (expired) return Promise.reject(new Error(\`\${message.what}: timed out\`));
  if (failing) { failing = false; return Promise.reject(new Error(\`\${message.what}: failed (dev)\`)); }
  return client().then(() => {
    if (expired) throw new Error(\`\${message.what}: timed out\`);
    return vAPI.messaging.send('dashboard', message);
  }).then((reply) => {
    if (reply === undefined) throw new Error(\`\${message.what}: no reply\`);
    return reply;
  });
};
const trusted = () => send({what: 'getWhitelist'}).then((t) => {
  if (!t || !Array.isArray(t.whitelist)) throw new Error('getWhitelist: no answer');
  return t;
});
const lists = () => send({what: 'getLists'}).then((l) => {
  if (!l || !l.available || typeof l.available !== 'object') throw new Error('getLists: no answer');
  return l;
});
const selected = (l) => Object.keys(l.available).filter((k) => l.available[k] && l.available[k].off !== true);
const covers = (directive, host) => !directive.includes('/') && (host === directive || host.endsWith('.' + directive));
const sameSet = (a, b) => [...a].sort().join('\\n') === [...b].sort().join('\\n');
const storageCall = (name, arg) => expired ? Promise.reject(new Error(\`storage \${name}: timed out\`))
  : new Promise((resolve, reject) => chrome.storage.local[name](arg, (v) =>
    chrome.runtime.lastError ? reject(new Error(chrome.runtime.lastError.message)) : resolve(v || {})));
const local = {get: (k) => storageCall('get', k), set: (v) => storageCall('set', v), remove: (k) => storageCall('remove', k)};
const reloadLists = () => send({what: 'reloadAllFilters'}).then(() => local.remove('astroReloadPending'));
const applyLists = (toSelect) => local.set({astroReloadPending: true})
  .then(() => send({what: 'applyFilterListSelection', toSelect})).then(reloadLists);
const settlePending = () => local.get('astroReloadPending').then((b) => b.astroReloadPending ? reloadLists() : null);
Promise.resolve().then(() => { if (location.origin !== extensionOrigin) throw new Error(\`not the extension page: \${location.href}\`); })
.then(() => withDeadline(ready(), 'uBlock Origin'))
.then(() => withDeadline(settlePending().then(() => (${expression})), 'the call'))
.then((v) => post('result', JSON.stringify({value: v === undefined ? null : v})),
(e) => post('result', JSON.stringify({error: String(e && e.message || e)})))`;

const READ_STATE = `Promise.all([lists(), trusted(), fetch('/assets/assets.json').then((r) => r.json())]).then(([l, t, assets]) => {
  const langs = new Set([chrome.i18n.getUILanguage(), ...(navigator.languages || [])].map((x) => (/^[a-z]+/.exec(x) || [])[0]).filter(Boolean));
  const forLanguages = (lang) => typeof lang === 'string' && lang.split(/\\s+/).some((x) => langs.has(x));
  const onByDefault = (id) => !!assets[id] && (assets[id].off !== true || forLanguages(assets[id].lang));
  return {
    lists: Object.entries(l.available)
      .filter(([id, list]) => list && list.content === 'filters' && list.group !== 'user' && list.group !== 'custom')
      .map(([id, list]) => ({id, title: list.title || id, group: list.group || '', enabled: list.off !== true,
        defaultOn: onByDefault(id), filters: list.entryCount || 0})),
    networkFilters: l.netFilterCount || 0,
    cosmeticFilters: l.cosmeticFilterCount || 0,
    enabled: !t.whitelist.includes(offDirective),
    allowedHosts: t.whitelist.filter((d) => !d.includes('/') && !d.startsWith('#') && !(t.whitelistDefault || []).includes(d)),
  };
})`;

const SET_ENABLED = (enabled: boolean) => `trusted().then((t) => {
  const on = ${JSON.stringify(enabled)};
  const kept = t.whitelist.filter((d) => d !== offDirective);
  return send({what: 'setWhitelist', whitelist: (on ? kept : kept.concat([offDirective])).join('\\n')});
}).then(() => send({what: 'userSettings', name: 'autoUpdate', value: ${JSON.stringify(enabled)}}))`;

const SET_LIST = (id: string, enabled: boolean) => `lists().then((l) => {
  const [id, on] = [${JSON.stringify(id)}, ${JSON.stringify(enabled)}];
  if (!l.available[id]) throw new Error(\`no list \${id}\`);
  const keep = selected(l).filter((x) => x !== id);
  return applyLists(on ? keep.concat([id]) : keep);
})`;

const IS_ALLOWED = (host: string) => `trusted().then((t) => t.whitelist.some((d) => covers(d, ${JSON.stringify(host)})))`;

const SET_ALLOWED = (host: string, allowed: boolean) => `trusted().then((t) => {
  const [allowed, host] = [${JSON.stringify(allowed)}, ${JSON.stringify(host)}];
  const kept = t.whitelist.filter((d) => allowed ? d !== host : !covers(d, host));
  return send({what: 'setWhitelist', whitelist: (allowed ? kept.concat([host]) : kept).join('\\n')});
})`;

type Answer = { value?: unknown; error?: string };
type Op = { expression: string; deadline: number; attemptsLeft: number; done: (value: unknown, error: string | null) => void };

let loaded: Promise<string | null> | null = null;
let page: Promise<EngineTab | null> | null = null;
let pageIdle: ReturnType<typeof setTimeout> | undefined;
const queue: Op[] = [];
let busy = false;
let settled = false;
const settledWaiters: (() => void)[] = [];

const load = () =>
  (loaded ??= loadCr()
    .then((cr) => cr.sendWithPromise<string | null>("astroContentBlockerLoad", ""))
    .then((id) => (id === EXTENSION_ID ? null : "not loaded"))
    .catch(() => "not loaded"));

function closePage() {
  const closing = page;
  page = null;
  void closing?.then((tab) => tab?.close());
}

const loadedPage = (): Promise<EngineTab | null> =>
  (page ??= openExtensionView(`${ORIGIN}/blank.html`, "hidden", "").then(
    (tab) =>
      tab &&
      new Promise<EngineTab | null>((resolve) => {
        const stop = tab.listen((state) => {
          if (state.isLoading || !state.url.startsWith(ORIGIN)) return;
          queueMicrotask(stop);
          resolve(tab);
        });
      }),
  ));

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function attempt(op: Op): Promise<{ value: unknown; error: string | null }> {
  const loadError = await load();
  if (loadError) return { value: null, error: loadError };
  const tab = await loadedPage();
  if (!tab) return { value: null, error: "not loaded" };
  const leftMs = Math.max(0, op.deadline - Date.now());
  const json = await callTab<string>(tab.ref, "evaluate", { code: PRELUDE(leftMs, op.expression) });
  let answer: Answer | null = null;
  try {
    answer = typeof json === "string" ? (JSON.parse(json) as Answer) : null;
  } catch {}
  if (!answer || typeof answer !== "object") return { value: null, error: "no answer" };
  if (typeof answer.error === "string") return { value: null, error: answer.error };
  return { value: answer.value ?? null, error: null };
}

async function pump() {
  if (busy) return;
  const op = queue[0];
  if (!op) return;
  busy = true;
  clearTimeout(pageIdle);
  let result = await attempt(op);
  while (result.error && op.attemptsLeft > 0 && Date.now() < op.deadline && RETRIABLE.some((sign) => result.error!.includes(sign))) {
    op.attemptsLeft--;
    closePage();
    await delay(RETRY_MS);
    result = await attempt(op);
  }
  if (result.error?.includes("timed out")) closePage();
  if (result.error) console.warn(`[blocker] ${result.error}`);
  queue.shift();
  busy = false;
  op.done(result.value, result.error);
  if (queue.length) void pump();
  else pageIdle = setTimeout(closePage, PAGE_IDLE_MS);
}

function call(expression: string): Promise<{ value: unknown; error: string | null }> {
  return new Promise((resolve) => {
    queue.push({ expression, deadline: Date.now() + OP_MS, attemptsLeft: ATTEMPTS, done: (value, error) => resolve({ value, error }) });
    void pump();
  });
}

const whenSettled = () => (settled ? Promise.resolve() : new Promise<void>((resolve) => settledWaiters.push(resolve)));

export function startContentBlocker() {
  setTimeout(() => {
    void call("null").finally(() => {
      settled = true;
      for (const waiter of settledWaiters.splice(0)) waiter();
    });
  }, SETTLE_AFTER_LAUNCH_MS);
}

function category(id: string, group: string): FilterListCategory {
  if (group === "regions") return "regional";
  if (id.includes("cookie")) return "cookies";
  if (group === "privacy" || id === "ublock-privacy") return "trackers";
  if (group === "malware" || id === "ublock-badware") return "security";
  if (group === "annoyances" || group === "social") return "annoyances";
  return "ads";
}

const UNAVAILABLE_STATS = (error: string): ContentBlockerStats & { error: string } => ({
  ready: false,
  enabled: false,
  parseMs: 0,
  lookups: 0,
  averageLookupMicros: 0,
  maxLookupMicros: 0,
  error,
});

type Read = {
  lists?: { id: string; title?: string; group?: string; enabled?: boolean; defaultOn?: boolean; filters?: number }[];
  networkFilters?: number;
  cosmeticFilters?: number;
  enabled?: boolean;
  allowedHosts?: string[];
};

async function state(): Promise<ContentBlockerState> {
  await whenSettled();
  const { value, error } = await call(READ_STATE);
  const read = value as Read | null;
  if (!read || !Array.isArray(read.lists)) {
    return { enabled: false, version: "", lists: [], allowedHosts: [], stats: UNAVAILABLE_STATS(error ?? "unavailable") };
  }
  const on = !!read.enabled;
  return {
    enabled: on,
    version: "",
    lists: read.lists
      .filter((l) => typeof l?.id === "string")
      .map((l) => ({
        id: l.id,
        title: typeof l.title === "string" ? l.title : l.id,
        category: category(l.id, typeof l.group === "string" ? l.group : ""),
        enabled: !!l.enabled,
        defaultOn: !!l.defaultOn,
        filters: Number(l.filters) || 0,
      })),
    allowedHosts: (read.allowedHosts ?? []).filter((h): h is string => typeof h === "string"),
    stats: {
      ready: true,
      enabled: on,
      networkFilters: Number(read.networkFilters) || 0,
      cosmeticFilters: Number(read.cosmeticFilters) || 0,
      parseMs: 0,
      lookups: 0,
      averageLookupMicros: 0,
      maxLookupMicros: 0,
    },
  };
}

async function changed(error: string | null) {
  if (error) throw new Error(error);
  const current = await state();
  emitNativeEvent("AstroCEF", "onContentBlocker", current.stats);
}

export const contentBlockerServices = {
  getContentBlocker: () => state(),
  setContentBlockerEnabled: async (enabled: boolean) => changed((await call(SET_ENABLED(enabled))).error),
  setFilterListEnabled: async (id: string, enabled: boolean) => changed((await call(SET_LIST(id, enabled))).error),
  isContentBlockerAllowed: async (host: string) => {
    const { value, error } = await call(IS_ALLOWED(host.toLowerCase()));
    return !error && value === true;
  },
  setContentBlockerAllowed: async (host: string, allowed: boolean) => changed((await call(SET_ALLOWED(host.toLowerCase(), allowed))).error),
};
