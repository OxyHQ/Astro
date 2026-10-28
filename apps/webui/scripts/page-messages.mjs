#!/usr/bin/env node
import { spawn } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { createServer as createNetServer } from "node:net";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const USAGE = `usage: page-messages.mjs --chrome <engine binary> [--tabs N] [--scratch <dir>] [--case <name>]...

Opens N tabs per case in a hidden Linux engine on $DISPLAY and checks that every new document's first
page-script messages (hello, theme) reach the window page's astro-tab-event listener. Cases: blank (about:blank, which
Astro's new tab page shows, then a site), webui (a chrome:// page, then a site), swap (one site, then another),
bfcache (back to a cached page) and prerender (a prerendered page activated). A case the engine could not set up (no
back/forward cache entry, no prerender) is reported as skipped. Exits 1 when any tab lost a message.`;

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
  console.error("page-messages.mjs: set DISPLAY to a private Xvfb (e.g. Xvfb :83 &; DISPLAY=:83)");
  process.exit(64);
}

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const chrome = resolve(option("chrome"));
const tabs = Number(option("tabs", "8"));
const cases = options("case").length ? options("case") : ["blank", "webui", "swap", "bfcache", "prerender"];
const scratch = resolve(option("scratch", join(process.env.TMPDIR ?? "/tmp", `ac-page-messages-${process.pid}`)));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const freePort = () =>
  new Promise((done) => {
    const probe = createNetServer();
    probe.listen(0, "127.0.0.1", () => {
      const { port } = probe.address();
      probe.close(() => done(port));
    });
  });

const page = (url) => {
  const color = url.searchParams.get("c") ?? "#336699";
  const next = url.searchParams.get("next");
  const rules = next ? `<script type="speculationrules">${JSON.stringify({ prerender: [{ source: "list", urls: [next] }] })}</script>` : "";
  return `<!doctype html><meta charset="utf-8"><meta name="theme-color" content="${color}"><title>${url.pathname}</title>${rules}
<script>addEventListener("pageshow", (e) => { if (e.persisted) window.restored = (window.restored || 0) + 1; });</script>
<body><p>${url.href}</p></body>`;
};
const server = createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  res.end(page(url));
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const httpPort = server.address().port;
const site = (name, color, extra = "") => `http://${name}.test:${httpPort}/doc?c=${encodeURIComponent(color)}${extra}`;

rmSync(scratch, { recursive: true, force: true });
mkdirSync(join(scratch, "profile/Default"), { recursive: true });
writeFileSync(join(scratch, "profile/Default/Preferences"), JSON.stringify({ net: { network_prediction_options: 0 } }));
const debugPort = await freePort();
const unreachable = ["api.oxy.so", "api.nilo.so", "api.alia.onl", "kaana.ai"].map((host) => `MAP ${host} 0.0.0.0:9`);
const engine = spawn(
  chrome,
  [
    `--user-data-dir=${join(scratch, "profile")}`,
    `--remote-debugging-port=${debugPort}`,
    `--astro-ui-dir=${join(repo, "apps/webui/dist")}`,
    `--host-resolver-rules=${[...unreachable, "MAP *.test 127.0.0.1"].join(", ")}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--password-store=basic",
    "--disable-features=HttpsUpgrades",
    "about:blank",
  ],
  { env: { ...process.env, ASTRO_BACKGROUND: "1" }, stdio: ["ignore", "ignore", "pipe"] },
);
let engineLog = "";
engine.stderr.on("data", (chunk) => {
  engineLog = (engineLog + chunk).slice(-20000);
});
let engineExited = false;
engine.on("exit", () => {
  engineExited = true;
});

const stop = async () => {
  if (!engineExited) engine.kill("SIGTERM");
  for (const end = Date.now() + 8000; !engineExited && Date.now() < end; await sleep(100));
  if (!engineExited) engine.kill("SIGKILL");
  server.close();
};

const waitFor = async (what, test, ms) => {
  for (const end = Date.now() + ms; Date.now() < end; await sleep(100)) {
    if (engineExited) throw new Error(`the engine exited while waiting for ${what}\n${engineLog}`);
    const value = await test().catch(() => null);
    if (value) return value;
  }
  throw new Error(`timed out waiting for ${what}`);
};

const connect = (url) =>
  new Promise((done, fail) => {
    const socket = new WebSocket(url);
    const pending = new Map();
    let id = 0;
    socket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      const answer = pending.get(message.id);
      if (!answer) return;
      pending.delete(message.id);
      if (message.error) answer.fail(new Error(JSON.stringify(message.error)));
      else answer.done(message.result);
    };
    socket.onerror = () => fail(new Error(`cannot connect to ${url}`));
    socket.onopen = () =>
      done({
        send: (method, params = {}) =>
          new Promise((ok, no) => {
            pending.set(++id, { done: ok, fail: no });
            socket.send(JSON.stringify({ id, method, params }));
          }),
        close: () => socket.close(),
      });
  });

let cdp;
let failures = 0;
try {
  const ui = await waitFor(
    "the window page",
    async () => {
      const list = await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json();
      return list.find((target) => target.url.startsWith("chrome://webui-browser"));
    },
    60000,
  );
  cdp = await connect(ui.webSocketDebuggerUrl);
  const run = async (expression) => {
    const { result, exceptionDetails } = await cdp.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (exceptionDetails) throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text);
    return result.value;
  };
  await waitFor("the window page's modules", () => run("document.readyState === 'complete'"), 30000);
  await run(`(async () => {
    const cr = await import("chrome://resources/js/cr.js");
    const api = await import("/tab_strip_api/tab_strip_api.mojom-webui.js");
    const events = [];
    cr.addWebUiListener("astro-tab-event", (ref, kind, payload) => {
      if (kind === "pageScript" && payload.main) events.push({ ref, kind: payload.kind, json: payload.json });
    });
    globalThis.__pageMessages = {
      events,
      service: api.TabStripService.getRemote(),
      open: async (url) => {
        const { tab } = await globalThis.__pageMessages.service.createTabAt(null, url).then((t) => ({ tab: t.tab ?? t }));
        await cr.sendWithPromise("astroTabWatch", tab.id);
        return tab.id;
      },
      call: (ref, method, args) => cr.sendWithPromise("astroTabCall", ref, method, args),
    };
    return true;
  })()`);
  const open = (url) => run(`__pageMessages.open(${JSON.stringify(url)})`);
  const call = (ref, method, callArgs) => run(`__pageMessages.call(${JSON.stringify(ref)}, ${JSON.stringify(method)}, ${JSON.stringify(callArgs)})`);
  const messages = (ref) => run(`__pageMessages.events.filter((e) => e.ref === ${JSON.stringify(ref)})`);
  const evaluate = (ref, code) => call(ref, "evaluate", { code });
  const hello = (url) => (e) => e.kind === "hello" && JSON.parse(e.json).url === url;
  const theme = (color) => (e) => e.kind === "theme" && (JSON.parse(e.json)?.color ?? "").toLowerCase() === color;
  const settle = (ref, url) => waitFor(`${url} to load`, async () => (await evaluate(ref, "post('result', document.readyState === 'complete' ? location.href : '')")) === url, 15000);
  const arrived = async (ref, since, predicate, ms = 5000) => {
    for (const end = Date.now() + ms; Date.now() < end; await sleep(50)) {
      if ((await messages(ref)).slice(since).some(predicate)) return true;
    }
    return false;
  };
  const color = (n) => `#${(0x102030 + n * 0x0b0d07).toString(16).slice(-6)}`;

  const scenarios = {
    blank: async (i) => {
      const ref = await open("about:blank");
      await sleep(300);
      const url = site(`blank${i}`, color(i));
      const since = (await messages(ref)).length;
      await call(ref, "navigate", { url, replace: true });
      return { ref, checks: [["hello", hello(url)], ["theme", theme(color(i))]], since };
    },
    webui: async (i) => {
      const ref = await open("chrome://version/");
      await settle(ref, "chrome://version/");
      const url = site(`webui${i}`, color(i + 20));
      const since = (await messages(ref)).length;
      await call(ref, "navigate", { url, replace: true });
      return { ref, checks: [["hello", hello(url)], ["theme", theme(color(i + 20))]], since };
    },
    swap: async (i) => {
      const first = site(`swapa${i}`, color(i + 40));
      const ref = await open(first);
      await settle(ref, first);
      const url = site(`swapb${i}`, color(i + 41));
      const since = (await messages(ref)).length;
      await call(ref, "navigate", { url });
      return { ref, checks: [["hello", hello(url)], ["theme", theme(color(i + 41))]], since };
    },
    bfcache: async (i) => {
      const first = site(`cachea${i}`, color(i + 60));
      const ref = await open(first);
      await settle(ref, first);
      const second = site(`cacheb${i}`, color(i + 61));
      await call(ref, "navigate", { url: second });
      await settle(ref, second);
      const since = (await messages(ref)).length;
      await call(ref, "goToOffset", { offset: -1 });
      await settle(ref, first);
      const restored = (await evaluate(ref, "post('result', String(window.restored || 0))")) !== "0";
      return { ref, checks: [["theme", theme(color(i + 60))]], since, skipped: restored ? null : "not restored from the back/forward cache" };
    },
    prerender: async (i) => {
      const target = `/doc?c=${encodeURIComponent(color(i + 80))}&n=${i}`;
      const first = site(`pre${i}`, color(i + 79), `&next=${encodeURIComponent(target)}`);
      const ref = await open(first);
      await settle(ref, first);
      await sleep(1500);
      const url = new URL(target, first).href;
      const since = (await messages(ref)).length;
      await evaluate(ref, `location.href = ${JSON.stringify(url)}; post('result', '')`);
      await settle(ref, url);
      const activated = (await evaluate(ref, "post('result', String(performance.getEntriesByType('navigation')[0].activationStart > 0))")) === "true";
      return { ref, checks: [["hello", hello(url)], ["theme", theme(color(i + 80))]], since, skipped: activated ? null : "the page was not prerendered" };
    },
  };

  for (const name of cases) {
    const scenario = scenarios[name];
    if (!scenario) throw new Error(`no case ${name}`);
    const results = { delivered: 0, lost: [], skipped: [] };
    for (let i = 1; i <= tabs; i++) {
      const { ref, checks, since, skipped } = await scenario(i);
      const missing = [];
      for (const [label, predicate] of checks) if (!(await arrived(ref, since, predicate))) missing.push(label);
      if (skipped) results.skipped.push(`tab ${i}: ${skipped}`);
      else if (missing.length) results.lost.push(`tab ${i}: ${missing.join(", ")}`);
      else results.delivered++;
      await run(`__pageMessages.service.closeNodes([${JSON.stringify(ref)}])`).catch(() => {});
    }
    const counted = tabs - results.skipped.length;
    console.log(`${name}: ${results.delivered}/${counted} tabs got every first message${results.lost.length ? ` (lost: ${results.lost.join("; ")})` : ""}${results.skipped.length ? ` [skipped ${results.skipped.length}: ${results.skipped[0]}]` : ""}`);
    failures += results.lost.length;
  }
} catch (error) {
  console.error(error.message);
  failures++;
} finally {
  cdp?.close();
  await stop();
  rmSync(scratch, { recursive: true, force: true });
}
process.exit(failures ? 1 : 0);
