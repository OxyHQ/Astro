#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: {
    oxyos: { type: "string" },
    chrome: { type: "string" },
    parallel: { type: "string", default: "8" },
    rounds: { type: "string", default: "8" },
    after: { type: "string", default: "20" },
  },
});
if (!values.oxyos || !values.chrome) {
  console.error("usage: node scripts/oxyos-startup.mjs --oxyos OXYOS_CHECKOUT --chrome CHROME [--parallel 8] [--rounds 8] [--after 20]");
  process.exit(2);
}

const oxyos = resolve(values.oxyos);
const chrome = resolve(values.chrome);
const parallel = Number(values.parallel);
const rounds = Number(values.rounds);
const afterMs = Number(values.after) * 1000;
const page = `file://${oxyos}/tools/rn-host-spike/scenarios/pages/astro.html`;
const work = mkdtempSync(join(tmpdir(), "astro-startup-"));
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

async function storeTabs(port) {
  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const host = targets.find((target) => target.type === "browser_ui");
  if (!host) return null;
  const socket = new WebSocket(host.webSocketDebuggerUrl);
  await new Promise((open) => socket.addEventListener("open", open));
  const expression = "JSON.stringify(Object.values(globalThis.astro?.store?.getState().tabs ?? {}).map((tab) => tab.url))";
  socket.send(JSON.stringify({ id: 1, method: "Runtime.evaluate", params: { expression, returnByValue: true } }));
  const value = await new Promise((answer) =>
    socket.addEventListener("message", (message) => {
      const reply = JSON.parse(message.data);
      if (reply.id === 1) answer(reply.result?.result?.value);
    }),
  );
  socket.close();
  return JSON.parse(value ?? "null");
}

async function launch(slot) {
  const port = 9400 + slot;
  const out = join(work, `run-${slot}`);
  rmSync(out, { recursive: true, force: true });
  const scenario = join(work, `startup-${slot}.json`);
  writeFileSync(
    scenario,
    JSON.stringify({
      about: "Astro's startup: the command line's page is a tab of the window.",
      window: [1000, 500],
      client: ["--ozone-platform=oxyos", `--remote-debugging-port=${port}`, "--user-data-dir={out}/profile", "--no-first-run", "--no-default-browser-check", "--window-size={width},{height}", page],
      steps: [{ name: "wait", do: ["wait", 60000], allow_unchanged: true, expect: {} }],
    }),
  );
  const run = spawn("python3", ["tools/rn-host-spike/regress.py", scenario, "--offscreen", "target/release/oxyos-offscreen", "--client", chrome, "--out", out], {
    cwd: oxyos,
    detached: true,
    stdio: "ignore",
  });
  await sleep(afterMs);
  let tabs = null;
  try {
    tabs = await storeTabs(port);
  } catch {}
  try {
    process.kill(-run.pid, "SIGKILL");
  } catch {}
  spawnSync("pkill", ["-9", "-f", `remote-debugging-port=${port}`]);
  return { slot, ok: Array.isArray(tabs) && tabs.includes(page), tabs };
}

let failed = 0;
let total = 0;
for (let round = 0; round < rounds; round++) {
  const results = await Promise.all(Array.from({ length: parallel }, (_, i) => launch(i + 1)));
  for (const result of results) {
    total++;
    if (!result.ok) failed++;
    console.log(JSON.stringify(result));
  }
  await sleep(1000);
}
rmSync(work, { recursive: true, force: true });
console.log(`${total - failed} of ${total} launches show the command line's page`);
process.exit(failed ? 1 : 0);
