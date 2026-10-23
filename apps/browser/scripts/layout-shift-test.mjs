import { execFileSync, spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { launch, quit } from "./perf/js-bench.mjs";
import { writeSeed } from "./perf/seed.mjs";

const { values: flags, positionals } = parseArgs({ allowPositionals: true, options: { bundle: { type: "string" }, runs: { type: "string" }, out: { type: "string" } } });
const appArg = positionals[0];
if (!appArg) {
  console.error("usage: node layout-shift-test.mjs <Astro.app> [--bundle <main.jsbundle>] [--runs 3] [--out <dir>]");
  process.exit(2);
}
const out = resolve(flags.out ?? join(tmpdir(), "ac-layout-shift"));
mkdirSync(out, { recursive: true });
let app = resolve(appArg);
if (flags.bundle) {
  const clone = join(out, "app", "Astro.app");
  rmSync(dirname(clone), { recursive: true, force: true });
  mkdirSync(dirname(clone), { recursive: true });
  execFileSync("cp", ["-cR", app, clone]);
  cpSync(resolve(flags.bundle), join(clone, "Contents/Resources/main.jsbundle"));
  const info = spawnSync("codesign", ["-dvv", app], { encoding: "utf8" }).stderr;
  const identity = info.match(/^Authority=(.+)$/m)?.[1] ?? "-";
  const entitlements = `${clone}.entitlements.plist`;
  writeFileSync(entitlements, execFileSync("codesign", ["-d", "--entitlements", "-", "--xml", app], { encoding: "utf8" }));
  execFileSync("codesign", ["--force", "--sign", identity, "--timestamp=none", "--options", "runtime", "--entitlements", entitlements, clone], { stdio: "inherit" });
  app = clone;
}

let failed = 0;
const runs = Number(flags.runs ?? 3);
for (let r = 0; r <= runs; r++) {
  const editing = r === runs;
  const data = join(out, `data-${r}`);
  rmSync(data, { recursive: true, force: true });
  writeSeed(data, "http://127.0.0.1:9", "");
  writeFileSync(join(data, "perf-probe"), editing ? "layout layoutEdit" : "layout");
  const { pid } = await launch(app, data, 9790 + (r % 10));
  const file = join(data, "layout-watch.json");
  try {
    for (let i = 0; i < 300 && !existsSync(file); i++) await new Promise((res) => setTimeout(res, 200));
  } finally {
    await quit(pid);
  }
  if (!existsSync(file)) {
    console.log(`run ${r}: no layout-watch.json (the probe's layout option never ran)`);
    failed++;
    continue;
  }
  const watch = JSON.parse(readFileSync(file, "utf8"));
  const ok = watch.shown > 0 && watch.missing.length === 0 && (editing || watch.moves.length === 0);
  if (!ok) failed++;
  const what = editing ? `edited while filling (${watch.edits.join(", ")})` : "launch";
  console.log(`run ${r} ${what}: ${ok ? "ok" : "FAIL"}  ${watch.commits} commits, ${watch.rows} rows measured, ${watch.shown} on screen, ${watch.moves.length} moved, ${watch.missing.length} missing`);
  if (watch.missing.length) console.log(`  missing: ${watch.missing.slice(0, 10).join(" ")}`);
  if (editing) continue;
  for (const m of watch.moves.slice(0, 10)) console.log(`  ${m.row}: (${m.from.x}, ${m.from.y}) at commit ${m.from.commit} -> (${m.to.x}, ${m.to.y}) at commit ${m.to.commit}`);
}
process.exit(failed ? 1 : 0);
