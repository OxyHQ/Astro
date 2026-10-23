#!/usr/bin/env node
import { spawnSync } from "node:child_process";

const rounds = Number(process.argv[2] ?? 200);
const repeats = Number(process.argv[3] ?? 3);
const retired = (n) => {
  const r = spawnSync("/usr/bin/time", ["-l", process.execPath, "--no-warnings", "--predictable", "--import", "./src/test-loader.mjs", "scripts/perf/micro-bench.mjs", `suggest-keys=${n}`], { encoding: "utf8" });
  const m = /(\d+)\s+instructions retired/.exec(r.stderr);
  if (!m) throw new Error(`no "instructions retired": ${r.stderr.slice(-300)}`);
  return Number(m[1]);
};
const per = [];
for (let i = 0; i < repeats; i++) per.push((retired(rounds) - retired(0)) / rounds);
per.sort((a, b) => a - b);
console.log(`suggest instructions per round: median ${Math.round(per[repeats >> 1]).toLocaleString()} (min ${Math.round(per[0]).toLocaleString()}, max ${Math.round(per.at(-1)).toLocaleString()}, n=${repeats})`);
