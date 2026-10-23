#!/usr/bin/env node
// A/B of Astro's content blocker (uBlock Origin) on xbench's rows: the same app with the blocker on (as shipped)
// and off, interleaved. Run only with the Mac quiet (no other benchmark, build or instance running).
//
//   node apps/browser/scripts/perf/blocker-ab.mjs prepare --out <dir> [--app <Astro.app>]
//       makes <dir>/off-home: a HOME whose Astro profile has the blocker switched off (uBO trusts every site and
//       doesn't update its lists, as Astro's own switch leaves it), by
//       launching the app hidden once on it
//   node apps/browser/scripts/perf/blocker-ab.mjs run --out <dir> [--app <Astro.app>] [-- <more xbench options>]
//       xbench run --browsers astro,astro-off with --base astro-off=<dir>/off-home, rows session,restore,link,
//       then xbench report into <dir>/table.md
//
//     --app <path>   the Astro copy (default /tmp/ac-xbench/apps/astro/Astro.app); never a bundle in /Applications
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { devtools, launch, sleep } from "../../../../scripts/lib/instance.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const split = process.argv.indexOf("--");
const own = split < 0 ? process.argv.slice(2) : process.argv.slice(2, split);
const more = split < 0 ? [] : process.argv.slice(split + 1);
const { values: opt, positionals } = parseArgs({
  args: own,
  allowPositionals: true,
  options: {
    out: { type: "string" },
    app: { type: "string", default: "/tmp/ac-xbench/apps/astro/Astro.app" },
    help: { type: "boolean", short: "h" },
  },
});
if (opt.help || !positionals[0] || !opt.out) {
  const lines = readFileSync(fileURLToPath(import.meta.url), "utf8").split("\n").slice(1);
  console.log(lines.slice(0, lines.findIndex((l) => !l.startsWith("//"))).map((l) => l.replace(/^\/\/ ?/, "")).join("\n"));
  process.exit(opt.help ? 0 : 64);
}

const EXTENSION = "fajbdaomknpkicfjcpipdmcpoamdmilh";
const OFF = "/^(?:astro-blocking-off|)/";
const out = resolve(opt.out);
const app = realpathSync(resolve(opt.app));
const offHome = join(out, "off-home");
if (app.startsWith("/Applications/")) throw new Error("never an installed app: pass a copy");

async function evaluate(port, expression) {
  const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const page = list.find((t) => t.type === "page" && t.url.startsWith(`chrome-extension://${EXTENSION}/`));
  if (!page) return undefined;
  const session = await devtools(page);
  try {
    return await session.eval(expression, { timeout: 15000 });
  } finally {
    session.close();
  }
}

async function prepare() {
  rmSync(offHome, { recursive: true, force: true });
  mkdirSync(offHome, { recursive: true });
  const instance = await launch(app, { data: join(offHome, "data"), onboarded: true, js: "none", ready: false });
  try {
    const browser = await (await fetch(`http://127.0.0.1:${instance.port}/json/version`)).json();
    const root = await devtools({ webSocketDebuggerUrl: browser.webSocketDebuggerUrl, url: "browser" });
    await root.send("Target.createTarget", { url: `chrome-extension://${EXTENSION}/no-dashboard.html` });
    root.close();
    let state;
    for (const end = Date.now() + 60_000; Date.now() < end; await sleep(500)) {
      state = await evaluate(instance.port, `(async () => {
        const send = (m) => vAPI.messaging.send("dashboard", m);
        const before = await send({ what: "getWhitelist" });
        if (!before.whitelist.includes(${JSON.stringify(OFF)}))
          await send({ what: "setWhitelist", whitelist: before.whitelist.concat([${JSON.stringify(OFF)}]).join("\\n") });
        await send({ what: "userSettings", name: "autoUpdate", value: false });
        const after = await send({ what: "getWhitelist" });
        const lists = await send({ what: "getLists" });
        return { off: after.whitelist.includes(${JSON.stringify(OFF)}), autoUpdate: lists.autoUpdate };
      })()`).catch(() => undefined);
      if (state?.off && state.autoUpdate === false) break;
    }
    if (!state?.off || state.autoUpdate !== false) throw new Error(`the blocker didn't switch off: ${JSON.stringify(state)}`);
    await sleep(3000);
    writeFileSync(join(out, "off-home.json"), JSON.stringify({ made: new Date().toISOString(), app, state }, null, 2));
    console.log("off-home ready: uBO trusts every site");
  } finally {
    await instance.quit();
  }
  for (const f of ["instance.json", "dev-eval.js", "dev-eval-result.json", "app.out.log"]) rmSync(join(offHome, "data", f), { force: true });
}

function run() {
  if (!existsSync(join(out, "off-home.json"))) throw new Error(`run prepare first (no ${join(out, "off-home.json")})`);
  const xbench = join(here, "xbench.mjs");
  const args = ["run", "--out", join(out, "bench"), "--browsers", "astro,astro-off", "--app", `astro=${app}`, "--app", `astro-off=${app}`,
    "--base", `astro-off=${offHome}`, "--rows", "session,restore,link", ...more];
  const r = spawnSync(process.execPath, [xbench, ...args], { stdio: "inherit" });
  if (r.status !== 0) process.exit(r.status ?? 1);
  execFileSync(process.execPath, [xbench, "report", "--out", join(out, "bench"), "--json", join(out, "bench.json"), "--md", join(out, "table.md")], { stdio: "inherit" });
}

if (positionals[0] === "prepare") await prepare();
else if (positionals[0] === "run") run();
else throw new Error(`unknown command ${positionals[0]}`);
