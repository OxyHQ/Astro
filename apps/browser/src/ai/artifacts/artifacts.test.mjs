import assert from "node:assert/strict";
import { test } from "node:test";

const a = await import("./artifacts.ts");
const html = await import("./html.ts");

const canvas = (toolCallId, type, title, data, state = "result") => ({ toolCallId, toolName: "canvas", state, args: { type, title, data }, result: { id: "x", type, title, data } });

test("Alia's canvas results become reports, decks, dashboards, tables and code; charts stay in the thread", () => {
  assert.deepEqual(a.artifactOfTool(canvas("1", "markdown", "Q3", { content: "# Q3\n\nUp." })), { id: "1", title: "Q3", body: { kind: "report", markdown: "# Q3\n\nUp." } });
  assert.equal(a.artifactOfTool(canvas("2", "deck", "Pitch", { slides: [{ title: "A", bullets: ["x", 2] }, "B"] })).body.slides.length, 2);
  assert.deepEqual(a.artifactOfTool(canvas("2", "deck", "Pitch", { slides: [{ title: "A", bullets: ["x", 2] }] })).body.slides[0].bullets, ["x", "2"]);
  const dash = a.artifactOfTool(
    canvas("3", "dashboard", "Sales", {
      widgets: [
        { kind: "stat", label: "Revenue", value: "10M", delta: "+12%" },
        { kind: "chart", chartType: "line", labels: ["J", "F"], datasets: [{ label: "R", values: [1, "2"] }] },
        { kind: "table", headers: ["a"], rows: [[1], [2]] },
        { kind: "bogus" },
      ],
    }),
  );
  assert.deepEqual(
    dash.body.widgets.map((w) => w.kind),
    ["stat", "chart", "table"],
  );
  assert.deepEqual(dash.body.widgets[1].datasets[0].values, [1, 2]);
  assert.deepEqual(a.artifactOfTool(canvas("4", "table", "T", { rows: [{ a: 1, b: 2 }] })).body, { kind: "table", headers: ["a", "b"], rows: [["1", "2"]] });
  assert.equal(a.artifactOfTool(canvas("5", "artifact", "Script", { content: "print(1)", language: "python" })).body.kind, "code");
  assert.equal(a.artifactOfTool(canvas("6", "chart", "C", { chartType: "bar", labels: ["a"], datasets: [{ values: [1] }] })), null);
  assert.equal(a.artifactOfTool(canvas("7", "markdown", "Q3", { content: "x" }, "call")), null);
  assert.equal(a.artifactOfTool({ toolCallId: "8", toolName: "generateFile", state: "result", result: { filename: "notes.md", content: "# N" } }).body.kind, "report");
});

test("a deck written as markdown splits on horizontal rules", () => {
  const slides = a.slidesFromMarkdown("# One\n- a\n- b\n\n---\n\n## Two\nBody text");
  assert.deepEqual(slides, [{ title: "One", bullets: ["a", "b"] }, { title: "Two", body: "Body text" }]);
});

test("versions are the same title and kind in the same conversation, in thread order", () => {
  a.useArtifacts.setState({ byId: {}, loading: {} });
  a.rememberArtifacts("c1", [
    { id: "m1", role: "assistant", toolInvocations: [canvas("t1", "markdown", "Q3 Report", { content: "v1" })] },
    { id: "m2", role: "user" },
    { id: "m3", role: "assistant", toolInvocations: [canvas("t2", "markdown", "Q3 report ", { content: "v2" }), canvas("t3", "deck", "Q3 Report", { slides: ["s"] })] },
  ]);
  const all = a.useArtifacts.getState().byId;
  assert.deepEqual(
    a.versionsOf(all, "c1", "t1").map((v) => v.id),
    ["t1", "t2"],
  );
  assert.deepEqual(
    a.conversationArtifacts(all, "c1").map((v) => v.id),
    ["t2", "t3"],
  );
  const live = a.rememberLiveArtifact("c1", { id: "t4", title: "Q3 Report", body: { kind: "report", markdown: "v3" } });
  assert.equal(live.order, 3);
  assert.equal(a.versionsOf(a.useArtifacts.getState().byId, "c1", "t1").at(-1).id, "t4");
});

test("artifact addresses round-trip", () => {
  const url = a.artifactUrl("conv 1", "call_9");
  assert.equal(url, "astro://artifact?c=conv%201&id=call_9");
  assert.deepEqual(a.parseArtifactUrl(url), { conversationId: "conv 1", id: "call_9" });
  assert.equal(a.parseArtifactUrl("astro://artifact"), null);
});

test("comments become one revision request carrying the current version", () => {
  const report = { id: "t1", title: "Q3", body: { kind: "report", markdown: "Revenue grew." } };
  const r = a.revisionRequest(report, [
    { id: "1", quote: "Revenue  grew.", text: "Say by how much" },
    { id: "2", quote: "", text: "Add a summary" },
  ]);
  assert.equal(r.prompt, "Revise the report “Q3” with my 2 comments:\n1. On “Revenue grew.”: Say by how much\n2. Add a summary");
  assert.match(r.context.join("\n"), /type "markdown" and the same title “Q3”/);
  assert.match(r.context.join("\n"), /\{"content":"Revenue grew."\}/);
});

test("exports: markdown and a standalone page", () => {
  const deck = { id: "d", title: "Pitch", body: { kind: "deck", slides: [{ title: "A", bullets: ["x"] }, { title: "B", body: "**bold**" }] } };
  assert.equal(a.artifactMarkdown(deck), "## A\n\n- x\n\n---\n\n## B\n\n**bold**");
  const page = html.artifactHtml(deck);
  assert.match(page, /<title>Pitch<\/title>/);
  assert.equal((page.match(/class="slide"/g) ?? []).length, 2);
  assert.match(html.markdownHtml("| a | b |\n| --- | --- |\n| 1 | 2 |"), /<td>1<\/td><td>2<\/td>/);
  assert.match(html.markdownHtml("# T\n\n- **x** and `y`\n\n```js\n<a>\n```"), /<h1>T<\/h1>\n<ul><li><strong>x<\/strong> and <code>y<\/code><\/li><\/ul>\n<pre><code>&lt;a&gt;<\/code><\/pre>/);
  assert.match(html.chartSvg({ chartType: "bar", labels: ["a", "b"], datasets: [{ label: "", values: [1, 2] }] }), /<rect/);
});
