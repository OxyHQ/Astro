#!/usr/bin/env node
import { clickhouse } from "./telemetry-env.mjs";

const PARALLEL = 4;

function splitStatements(sql) {
  const statements = [];
  let current = "";
  let quote = null;
  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    if (quote) {
      current += ch;
      if (ch === "\\") current += sql[++i] ?? "";
      else if (ch === quote) quote = null;
    } else if (ch === "-" && sql[i + 1] === "-") {
      const end = sql.indexOf("\n", i);
      i = end === -1 ? sql.length : end - 1;
    } else if (ch === "'" || ch === '"' || ch === "`") {
      quote = ch;
      current += ch;
    } else if (ch === ";") {
      statements.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  statements.push(current);
  return statements.map((s) => s.trim()).filter(Boolean);
}

const readStdin = async () => {
  let text = "";
  for await (const chunk of process.stdin) text += chunk;
  return text;
};

const input = process.argv.length > 2 ? process.argv.slice(2).join(" ") : process.stdin.isTTY ? "" : await readStdin();
const queries = splitStatements(input);
if (!queries.length) {
  console.error('usage: node scripts/telemetry-sql.mjs "<query>[; <query>…]"   (or the queries on stdin)');
  process.exit(2);
}

const format = (rows) => rows.map((row) => row.map((v) => (typeof v === "object" ? JSON.stringify(v) : v)).join("\t")).join("\n");
const results = new Array(queries.length);
let next = 0;
await Promise.all(
  Array.from({ length: Math.min(PARALLEL, queries.length) }, async () => {
    while (next < queries.length) {
      const i = next++;
      results[i] = await clickhouse(queries[i]).then(
        (rows) => ({ text: format(rows) }),
        (error) => ({ error: String(error.message ?? error) }),
      );
    }
  }),
);

let failed = false;
results.forEach(({ text, error }, i) => {
  if (queries.length > 1) console.log(`${i ? "\n" : ""}== ${i + 1}: ${queries[i].replace(/\s+/g, " ").slice(0, 100)}`);
  if (error) {
    failed = true;
    console.error(error);
  } else if (text) {
    console.log(text);
  }
});
process.exit(failed ? 1 : 0);
