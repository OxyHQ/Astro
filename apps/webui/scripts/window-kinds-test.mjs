#!/usr/bin/env node
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { sleep, startEngine, windowPage } from "./lib/engine.mjs";

const USAGE = `usage: window-kinds-test.mjs --chrome <engine binary> [--headless] [--ui <dist dir>] [--scratch <dir>]

Opens each kind of browser window in a hidden Linux engine on $DISPLAY, or on Chromium's headless Ozone platform with
--headless (any Linux or OxyOS engine), the main window and a Little Astro window, and
for each, at its first size and then maximized (1920x1116, as on a 1920x1200 display under OxyOS's menu bar), checks that
its page still holds its interface: the React root is mounted, its content card is there and the page logged no
"[astro] crashed". A window whose Bloom interface renders outside a BloomThemeProvider loses its whole root this way,
window buttons included. Needs a built interface (pnpm -C apps/webui build). Exits 1 when any window lost its root.`;

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const at = args.indexOf(`--${name}`);
  return at >= 0 ? args[at + 1] : fallback;
};
if (args.includes("--help") || !option("chrome")) {
  console.log(USAGE);
  process.exit(args.includes("--help") ? 0 : 64);
}
const headless = args.includes("--headless");
if (!headless && !process.env.DISPLAY) {
  console.error("window-kinds-test.mjs: set DISPLAY to a private Xvfb (e.g. Xvfb :84 &; DISPLAY=:84)");
  process.exit(64);
}

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const chrome = resolve(option("chrome"));
const ui = resolve(option("ui", join(repo, "apps/webui/dist")));
const scratch = resolve(option("scratch", join(process.env.TMPDIR ?? "/tmp", `ac-window-kinds-${process.pid}`)));
const MAXIMIZED = { width: 1920, height: 1116 };

const engine = await startEngine({ chrome, repo, scratch, ui, extraArgs: ["--window-size=945,1096", ...(headless ? ["--ozone-platform=headless"] : [])] });
const failures = [];
try {
  const main = await windowPage(engine);
  const browser = await main.browser();
  const crashes = new Map();
  const watch = async (page) => {
    crashes.set(page.id, []);
    page.cdp.listen((message) => {
      if (message.method !== "Runtime.consoleAPICalled" || message.params.type !== "error") return;
      const text = message.params.args.map((arg) => arg.value ?? arg.description ?? "").join(" ");
      if (text.includes("[astro] crashed")) crashes.get(page.id).push(text.split("\n")[0]);
    });
    await page.cdp.send("Runtime.enable");
  };
  const state = (page, kind) =>
    page.run(`(() => {
      const id = document.documentElement.dataset.windowId;
      const window = globalThis.astro?.store?.getState().windows[id];
      return JSON.stringify({
        id,
        kind: window ? (window.kind ?? "main") : null,
        mounted: document.getElementById("root").childElementCount > 0,
        card: ${kind === "small" ? `document.body.textContent.includes("Search or enter address")` : `!!document.querySelector(".astro-window")`},
        size: [innerWidth, innerHeight],
      });
    })()`).then(JSON.parse);
  const tabWindows = async () => {
    const tabs = (await (await fetch(`http://127.0.0.1:${engine.debugPort}/json/list`)).json()).filter((target) => target.type === "page");
    const windows = await Promise.all(tabs.map((tab) => browser.send("Browser.getWindowForTarget", { targetId: tab.id }).catch(() => null)));
    return [...new Set(windows.filter(Boolean).map((found) => found.windowId))];
  };
  const check = async (page, kind, when) => {
    let seen = null;
    try {
      seen = await engine.waitFor(`the ${kind} window ${when}`, async () => {
        const now = await state(page, kind);
        return now.mounted && now.card && now.kind === kind ? now : null;
      }, 20000);
      await sleep(1500);
      seen = await state(page, kind);
    } catch {
      seen = await state(page, kind).catch(() => null);
    }
    const crashed = crashes.get(page.id);
    const ok = !!seen?.mounted && !!seen?.card && seen?.kind === kind && crashed.length === 0;
    console.log(`${ok ? "ok  " : "FAIL"} ${kind} window ${when}: ${JSON.stringify(seen)}${crashed.length ? ` ${crashed.join(" | ")}` : ""}`);
    if (!ok) failures.push(`${kind} ${when}`);
  };
  const maximize = async (page, windowId, kind) => {
    if (windowId === null) {
      console.log(`FAIL ${kind} window maximized: no window id`);
      failures.push(`${kind} maximized`);
      return;
    }
    await browser.send("Browser.setWindowBounds", { windowId, bounds: MAXIMIZED });
    await engine.waitFor(`the ${kind} window to grow`, async () => (await state(page, kind)).size[0] > 1000, 10000).catch(() => null);
    await check(page, kind, "maximized");
  };

  await watch(main);
  await check(main, "main", "at its first size");
  const mainWindow = (await tabWindows())[0] ?? null;
  await maximize(main, mainWindow, "main");

  await main.run(`astro.emitCommand({ command: "newLittleAstro" }), true`);
  const small = await windowPage(engine, { except: [main.id] });
  await watch(small);
  await check(small, "small", "at its first size");
  const smallWindow = await engine
    .waitFor("the Little Astro window's tab", async () => (await tabWindows()).find((id) => id !== mainWindow), 10000)
    .catch(() => null);
  await maximize(small, smallWindow ?? null, "small");
  await check(main, "main", "after the Little Astro window");
  browser.close();
  small.cdp.close();
  main.cdp.close();
} finally {
  await engine.stop();
}
if (failures.length) {
  console.error(`window-kinds-test.mjs: ${failures.length} failed: ${failures.join(", ")}`);
  process.exit(1);
}
console.log("window-kinds-test.mjs: every window kept its interface");
