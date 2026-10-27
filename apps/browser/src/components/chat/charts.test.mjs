import assert from "node:assert/strict";
import { test } from "node:test";

const { chartOf, chartsOf, isChartTool } = await import("./charts.ts");

const canvas = (block, extra = {}) => ({ toolCallId: "call_1", toolName: "canvas", state: "result", args: block, result: { id: "c1", ...block, message: "Canvas component created" }, ...extra });

test("a canvas chart from Alia becomes a chart", () => {
  const chart = chartOf(canvas({ type: "chart", title: "Browser share", data: { chartType: "pie", labels: ["Astro", "Chrome"], datasets: [{ label: "Share", values: [60, 40] }] } }));
  assert.deepEqual(chart, { id: "call_1", title: "Browser share", chartType: "pie", labels: ["Astro", "Chrome"], datasets: [{ label: "Share", values: [60, 40] }] });
});

test("values are padded, trimmed and made numbers", () => {
  const chart = chartOf(canvas({ type: "chart", title: "", data: { chartType: "bar", labels: ["a", "b", "c"], datasets: [{ label: "x", values: ["1", null, 3, 4] }] } }));
  assert.deepEqual(chart?.datasets[0]?.values, [1, 0, 3]);
});

test("the call's arguments stand in until the result arrives", () => {
  const block = { type: "chart", title: "T", data: { chartType: "line", labels: ["Jan"], datasets: [{ label: "v", values: [1] }] } };
  assert.equal(chartOf({ toolCallId: "c", toolName: "canvas", state: "call", args: block })?.chartType, "line");
  assert.equal(chartOf({ toolCallId: "c", toolName: "canvas", state: "partial-call", args: block }), null);
});

test("other canvases, other tools and malformed charts are not charts", () => {
  assert.equal(chartOf(canvas({ type: "table", title: "t", data: { headers: [], rows: [] } })), null);
  assert.equal(chartOf({ toolCallId: "w", toolName: "webSearch", state: "result", result: { type: "chart" } }), null);
  assert.equal(chartOf(canvas({ type: "chart", title: "t", data: { chartType: "radar", labels: ["a"], datasets: [{ values: [1] }] } })), null);
  assert.equal(chartOf(canvas({ type: "chart", title: "t", data: { chartType: "bar", labels: [], datasets: [{ values: [] }] } })), null);
  assert.equal(chartOf(canvas({ type: "chart", title: "t", data: { chartType: "bar", labels: ["a"], datasets: [{ label: "no values" }] } })), null);
});

test("a reply's charts come out in order and leave its other steps alone", () => {
  const tools = [
    { toolCallId: "s", toolName: "webSearch", state: "result", result: {} },
    canvas({ type: "chart", title: "one", data: { chartType: "bar", labels: ["a"], datasets: [{ label: "x", values: [1] }] } }, { toolCallId: "c1" }),
    canvas({ type: "chart", title: "two", data: { chartType: "line", labels: ["a"], datasets: [{ label: "x", values: [2] }] } }, { toolCallId: "c2" }),
  ];
  assert.deepEqual(chartsOf(tools).map((c) => c.title), ["one", "two"]);
  assert.deepEqual(tools.filter((tool) => !isChartTool(tool)).map((t) => t.toolCallId), ["s"]);
});
