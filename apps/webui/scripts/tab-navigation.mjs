#!/usr/bin/env node
import { createServer } from "node:http";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { colorShare, sleep, startEngine, windowPage } from "./lib/engine.mjs";

const USAGE = `usage: tab-navigation.mjs --chrome <engine binary> [--tabs N] [--delay MS] [--scratch <dir>] [--case <name>]...

Checks, in a hidden Linux or Windows engine on $DISPLAY, what Chrome does for a tab that Astro's window shows:
  prerender  a Speculation Rules prerender runs and activates (document.prerendering true, then false; activationStart
             > 0), and the prerendered page's page-script messages reach the window only once it is activated;
  iframe     the page script runs in a cross-site (out-of-process) iframe: its hello arrives (main false) and a
             callPage to that frame reaches it;
  bfcache    back and forward restore from the back/forward cache (pageshow.persisted, no Page.backForwardCacheNotUsed
             from a tab-target DevTools session), the window shows the restored page and its theme reaches the window;
  control    the same with pages that can't be cached (an unload handler): not restored, and Chromium names why
             (so an empty NotRestoredReasons above means something). Its times are what back/forward cost before.
Each case runs in N tabs (default 5), the cases interleaved. Back/forward times are from the call to the page's
pageshow; --delay holds every document response that long (default 0), as a network would. Exits 1 when any check
fails.`;

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const at = args.indexOf(`--${name}`);
  return at >= 0 ? args[at + 1] : fallback;
};
const options = (name) => args.flatMap((value, i) => (args[i - 1] === `--${name}` ? [value] : []));
if (args.includes("--help") || !option("chrome")) {
  console.log(USAGE);
  process.exit(args.includes("--help") ? 0 : 64);
}
if (!process.env.DISPLAY) {
  console.error("tab-navigation.mjs: set DISPLAY to a private Xvfb (e.g. Xvfb :82 &; DISPLAY=:82)");
  process.exit(64);
}

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const chrome = resolve(option("chrome"));
const tabs = Number(option("tabs", "5"));
const delay = Number(option("delay", "0"));
const cases = options("case").length ? options("case") : ["prerender", "iframe", "bfcache", "control"];
const scratch = resolve(option("scratch", join(process.env.TMPDIR ?? "/tmp", `ac-tab-navigation-${process.pid}`)));

const probe = `<script>
window.startedPrerendering = document.prerendering === true;
document.addEventListener("prerenderingchange", () => { window.activatedAt = Date.now(); });
addEventListener("pageshow", (e) => { window.shownAt = Date.now(); window.persisted = e.persisted; if (e.persisted) window.restored = (window.restored || 0) + 1; });
addEventListener("message", (e) => { if (e.data === "paused-by-astro") window.framePaused = true; });
</script>`;
const page = (url) => {
  const color = url.searchParams.get("c") ?? "#336699";
  const next = url.searchParams.get("next");
  const frame = url.searchParams.get("frame");
  const rules = next ? `<script type="speculationrules">${JSON.stringify({ prerender: [{ source: "list", urls: [next] }] })}</script>` : "";
  const unload = url.searchParams.has("unload") ? `<script>addEventListener("unload", () => {});</script>` : "";
  const media = url.searchParams.has("media")
    ? `<script>navigator.mediaSession.setActionHandler("pause", () => top.postMessage("paused-by-astro", "*"));</script>`
    : "";
  return `<!doctype html><meta charset="utf-8"><meta name="theme-color" content="${color}"><title>${url.pathname}</title>${probe}${rules}${media}${unload}
<style>html, body { margin: 0; height: 100%; background: ${color}; }</style>
<body><p>${url.href}</p>${frame ? `<iframe src="${frame}"></iframe>` : ""}</body>`;
};
const server = createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  setTimeout(() => {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(page(url));
  }, delay);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const httpPort = server.address().port;
const site = (name, color, extra = "") => `http://${name}.test:${httpPort}/doc?c=${encodeURIComponent(color)}${extra}`;
const color = (n) => `#${(0x203040 + n * 0x0b0d07).toString(16).slice(-6)}`;
const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted.length ? sorted[Math.floor(sorted.length / 2)] : NaN;
};

const engine = await startEngine({ chrome, repo, scratch });
let ui;
let browser;
let failures = 0;
try {
  ui = await windowPage(engine);
  browser = await ui.browser();
  const { open, call, evaluate, settle } = ui;
  const read = async (ref, expression) => JSON.parse(await evaluate(ref, `post('result', JSON.stringify(${expression}))`));
  const waitMessage = async (ref, predicate, ms = 5000) => {
    for (const end = Date.now() + ms; Date.now() < end; await sleep(50)) {
      const found = (await ui.messages(ref)).find(predicate);
      if (found) return found;
    }
    return null;
  };
  const painted = async (wanted, ms = 4000) => {
    let share = 0;
    for (const end = Date.now() + ms; Date.now() < end; await sleep(100)) {
      const { data } = await ui.cdp.send("Page.captureScreenshot", { format: "png" });
      share = colorShare(data, wanted);
      if (share > 0.2) return null;
    }
    return `the window doesn't show the page (${Math.round(share * 100)}% of it in ${wanted})`;
  };
  const isHello = (url, main) => (e) => e.kind === "hello" && e.main === main && JSON.parse(e.json).url === url;
  const isTheme = (wanted) => (e) => e.kind === "theme" && e.main && (JSON.parse(e.json)?.color ?? "").toLowerCase() === wanted;

  const tabTarget = async (host) => {
    const { targetInfos } = await browser.send("Target.getTargets", { filter: [{ type: "tab" }] });
    const tab = targetInfos.find((t) => t.url.includes(host));
    if (!tab) throw new Error(`no tab target for ${host}`);
    const { sessionId: tabSession } = await browser.send("Target.attachToTarget", { targetId: tab.targetId, flatten: true });
    const notUsed = [];
    let pageSession = null;
    const stopListening = browser.listen((message) => {
      if (message.method === "Target.attachedToTarget" && message.sessionId === tabSession && message.params.targetInfo.type === "page") {
        pageSession = message.params.sessionId;
        browser.send("Page.enable", {}, pageSession).catch(() => {});
      } else if (message.method === "Page.backForwardCacheNotUsed" && message.sessionId === pageSession) {
        notUsed.push(message.params);
      }
    });
    await browser.send("Target.setAutoAttach", { autoAttach: true, waitForDebuggerOnStart: false, flatten: true }, tabSession);
    for (const end = Date.now() + 3000; !pageSession && Date.now() < end; await sleep(20));
    await sleep(100);
    return {
      notUsed,
      detach: async () => {
        stopListening();
        await browser.send("Target.detachFromTarget", { sessionId: tabSession }).catch(() => {});
      },
    };
  };
  const reasons = (event) => {
    const names = (event.notRestoredExplanations ?? []).map((r) => r.reason);
    const walk = (tree) => [...(tree?.explanations ?? []).map((r) => r.reason), ...(tree?.children ?? []).flatMap(walk)];
    return [...new Set([...names, ...walk(event.notRestoredExplanationsTree)])];
  };

  const scenarios = {
    prerender: async (i, result) => {
      const target = `/doc?c=${encodeURIComponent(color(i + 10))}&n=${i}`;
      const first = site(`pre${i}`, color(i + 9), `&next=${encodeURIComponent(target)}`);
      const ref = await open(first);
      await settle(ref, first);
      const firstPaint = await painted(color(i + 9));
      const url = new URL(target, first).href;
      await sleep(1500);
      const early = (await ui.messages(ref)).filter((e) => e.main && e.kind === "hello" && JSON.parse(e.json).url === url).length;
      const since = Date.now();
      await evaluate(ref, `location.href = ${JSON.stringify(url)}; post('result', '')`);
      await settle(ref, url);
      const state = await read(ref, "{ started: window.startedPrerendering, now: document.prerendering, activation: performance.getEntriesByType('navigation')[0].activationStart, shownAt: window.activatedAt ?? window.shownAt }");
      const hello = await waitMessage(ref, isHello(url, true));
      const theme = await waitMessage(ref, isTheme(color(i + 10)));
      const problems = [];
      if (!state.started) problems.push("not prerendered (document.prerendering was false at start)");
      if (state.now) problems.push("still prerendering after the navigation");
      if (!(state.activation > 0)) problems.push(`activationStart ${state.activation}`);
      if (early) problems.push("the prerendered page's hello reached the window before activation");
      if (!hello || hello.at < since) problems.push("no hello after activation");
      if (!theme) problems.push("no theme after activation");
      if (firstPaint) problems.push(`before: ${firstPaint}`);
      const activatedPaint = await painted(color(i + 10));
      if (activatedPaint) problems.push(`activated: ${activatedPaint}`);
      result.times.push(state.shownAt - since);
      await ui.close(ref);
      return problems;
    },
    iframe: async (i) => {
      const inner = site(`inner${i}`, color(i + 30), "&media=1");
      const outer = site(`outer${i}`, color(i + 31), `&frame=${encodeURIComponent(inner)}`);
      const ref = await open(outer);
      await settle(ref, outer);
      const problems = [];
      const hello = await waitMessage(ref, isHello(inner, false), 8000);
      if (!hello) problems.push("no hello from the cross-site iframe");
      else {
        await call(ref, "callPage", { kind: "media", json: JSON.stringify({ action: "pause" }), frame: hello.frame });
        let paused = false;
        for (const end = Date.now() + 3000; !paused && Date.now() < end; await sleep(50)) paused = await read(ref, "window.framePaused === true");
        if (!paused) problems.push("callPage didn't reach the iframe");
      }
      const main = await waitMessage(ref, isHello(outer, true));
      if (!main) problems.push("no hello from the main frame");
      if (hello && main && hello.frame === main.frame) problems.push("the iframe and the main frame share a frame id");
      await ui.close(ref);
      return problems;
    },
    bfcache: (i, result) => history(i, result, true),
    control: (i, result) => history(i, result, false),
  };
  async function history(i, result, cached) {
      const extra = cached ? "" : "&unload=1";
      const first = site(`${cached ? "cache" : "control"}a${i}`, color(i + 50), extra);
      const second = site(`${cached ? "cache" : "control"}b${i}`, color(i + 51), extra);
      const ref = await open(first);
      await settle(ref, first);
      const devtools = await tabTarget(new URL(first).hostname);
      await call(ref, "navigate", { url: second });
      await settle(ref, second);
      await sleep(300);
      const problems = [];
      for (const [offset, url, tint, label] of [[-1, first, color(i + 50), "back"], [1, second, color(i + 51), "forward"]]) {
        const before = (await ui.messages(ref)).length;
        const notUsedBefore = devtools.notUsed.length;
        const start = Date.now();
        await call(ref, "goToOffset", { offset });
        await settle(ref, url);
        const state = await engine.waitFor(`${label} pageshow`, async () => {
          const s = await read(ref, "{ shownAt: window.shownAt, persisted: window.persisted }");
          return s.shownAt >= start ? s : null;
        }, 10000);
        (result[label] ??= []).push(state.shownAt - start);
        const notUsed = devtools.notUsed.slice(notUsedBefore);
        if (!cached) {
          if (state.persisted) problems.push(`${label}: restored although the page has an unload handler`);
          if (!notUsed.length) problems.push(`${label}: no NotRestoredReasons for a page that wasn't restored`);
          else result.reasons = [...new Set([...(result.reasons ?? []), ...notUsed.flatMap(reasons)])];
        } else if (!state.persisted) {
          const page = await read(ref, "performance.getEntriesByType('navigation')[0].notRestoredReasons");
          const walk = (tree) => [...(tree?.reasons ?? []).map((r) => r.reason), ...(tree?.children ?? []).flatMap(walk)];
          problems.push(`${label}: pageshow.persisted false (page's notRestoredReasons: ${page ? walk(page).join(", ") || "none" : "null"})`);
        }
        if (cached && notUsed.length) problems.push(`${label}: NotRestoredReasons ${notUsed.flatMap(reasons).join(", ")}`);
        const theme = (await waitMessage(ref, (e) => e.at >= start && isTheme(tint)(e))) && (await ui.messages(ref)).length > before;
        if (!theme) problems.push(`${label}: no theme for the page shown`);
        const restoredPaint = await painted(tint);
        if (restoredPaint) problems.push(`${label}: ${restoredPaint}`);
        await sleep(300);
      }
      await devtools.detach();
      await ui.close(ref);
      return problems;
  }

  const results = Object.fromEntries(cases.map((name) => [name, { passed: 0, failed: [], times: [] }]));
  for (const name of cases) if (!scenarios[name]) throw new Error(`no case ${name}`);
  for (let i = 1; i <= tabs; i++) {
    for (const name of cases) {
      const problems = await scenarios[name](i, results[name]);
      if (problems.length) results[name].failed.push(`tab ${i}: ${problems.join("; ")}`);
      else results[name].passed++;
    }
  }
  for (const name of cases) {
    const result = results[name];
    const timing =
      name === "bfcache" || name === "control"
        ? ` (back ${median(result.back)} ms, forward ${median(result.forward)} ms, median; back ${result.back.join("/")} ms${result.reasons ? `; NotRestoredReasons ${result.reasons.join(", ")}` : ""})`
        : name === "prerender" && result.times.length
          ? ` (navigation to shown ${median(result.times)} ms, median)`
          : "";
    console.log(`${name}: ${result.passed}/${tabs}${timing}${result.failed.length ? `\n  ${result.failed.join("\n  ")}` : ""}`);
    failures += result.failed.length;
  }
} catch (error) {
  console.error(error.message);
  failures++;
} finally {
  browser?.close();
  ui?.cdp.close();
  await engine.stop();
  server.close();
}
process.exit(failures ? 1 : 0);
