import assert from "node:assert/strict";
import { test } from "node:test";

const { grammarFor, tokenizeWith } = await import("./highlight.ts");

const kinds = (lines) => lines.flat().filter((t) => t.text.trim()).map((t) => `${t.kind}:${t.text}`);

test("python: keywords, strings, comments and numbers", () => {
  const lines = tokenizeWith(grammarFor("py"), 'def f(x):\n    return "hi"  # done\n    y = 42');
  const k = kinds(lines);
  assert.ok(k.includes("keyword:def"));
  assert.ok(k.includes("function:f"));
  assert.ok(k.includes('string:"hi"'));
  assert.ok(k.includes("comment:# done"));
  assert.ok(k.includes("constant:42"));
  assert.equal(lines.length, 3);
});

test("a block comment spanning lines keeps the line breaks", () => {
  const lines = tokenizeWith(grammarFor("rust"), "/* a\nb */ fn main() {}");
  assert.equal(lines.length, 2);
  assert.equal(lines[0][0].kind, "comment");
  assert.ok(kinds(lines).includes("keyword:fn"));
});

test("markup tags, attributes and values", () => {
  const k = kinds(tokenizeWith(grammarFor("html"), '<a href="/x">hi</a>'));
  assert.ok(k.includes("className:a"));
  assert.ok(k.includes("attrName:href"));
  assert.ok(k.includes('attrValue:"/x"'));
});

test("unknown languages and JS dialects are left to Bloom", () => {
  assert.equal(grammarFor("brainfuck"), null);
  assert.equal(grammarFor(undefined), null);
});
