import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { bangTable, slimBangs } from "../src/bangs.ts";

const HELP = `Turns Helium's bang list into Astro's bundled snapshot, packages/core/src/bangList.ts.

  curl -sS --compressed -D headers.txt -o bangs.json https://services.helium.imput.net/bangs.json
  node packages/core/scripts/bangs.ts <bangs.json> <the ETag in headers.txt, with the quotes>

Fetch it gzipped (--compressed), as the app does: the server gives the gzipped file its own ETag.

The list is Kagi's bangs plus imput's extras (MIT, "Kagi Search, 2026 imput").
The app refreshes it from the same URL at most once a day; the ETag lets the first refresh answer 304.`;

const [input, etag] = process.argv.slice(2);
if (!input || input === "-h" || input === "--help" || !etag) {
  console.log(HELP);
  process.exit(input && input !== "-h" && input !== "--help" ? 1 : 0);
}

const raw = readFileSync(input, "utf8");
const slim = slimBangs(raw);
if (!slim) {
  console.error("not a bang list");
  process.exit(1);
}
const generatedAt = /^\/\/\s*Generated at (\S+)/m.exec(raw)?.[1] ?? "";
const literal = (lines: string[]) => `\`${lines.join("\n").replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${")}\``;
const lines = slim.split("\n");
const ascii = lines.filter((line) => /^[\x00-\x7f]*$/.test(line));
const unicode = lines.filter((line) => !/^[\x00-\x7f]*$/.test(line));
const out = join(dirname(fileURLToPath(import.meta.url)), "../src/bangList.ts");
writeFileSync(
  out,
  [
    `export const BANG_LIST_ETAG = ${JSON.stringify(etag)};`,
    `export const BANG_LIST_GENERATED_AT = ${JSON.stringify(generatedAt)};`,
    `export const BANG_LIST = ${literal(ascii)};`,
    `export const BANG_LIST_UNICODE = ${literal(unicode)};`,
    "",
  ].join("\n"),
);
const table = bangTable(slim);
console.log(`${out}: ${lines.length} bangs (${unicode.length} with non-ASCII text), ${table.size} triggers, ${Buffer.byteLength(slim)} bytes`);
