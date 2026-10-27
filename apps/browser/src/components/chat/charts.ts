export type ChartType = "bar" | "line" | "pie";
export type ChartSeries = { label: string; values: number[] };
export type ReplyChart = { id: string; title: string; chartType: ChartType; labels: string[]; datasets: ChartSeries[] };

type ToolLike = { toolCallId: string; toolName: string; state?: string; args?: unknown; result?: unknown };

const CHART_TYPES = new Set<ChartType>(["bar", "line", "pie"]);
const MAX_POINTS = 200;
const MAX_SERIES = 12;

const record = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;

const finite = (value: unknown) => {
  const number = typeof value === "string" ? Number(value) : value;
  return typeof number === "number" && Number.isFinite(number) ? number : 0;
};

function series(value: unknown, points: number): ChartSeries | null {
  const entry = record(value);
  if (!entry || !Array.isArray(entry.values)) return null;
  const values = entry.values.slice(0, points).map(finite);
  while (values.length < points) values.push(0);
  return { label: typeof entry.label === "string" ? entry.label : "", values };
}

export function chartOf(tool: ToolLike): ReplyChart | null {
  if (tool.toolName !== "canvas" || tool.state === "partial-call") return null;
  const block = record(tool.result) ?? record(tool.args);
  if (!block || block.type !== "chart") return null;
  const data = record(block.data);
  const chartType = data?.chartType;
  if (!data || typeof chartType !== "string" || !CHART_TYPES.has(chartType as ChartType) || !Array.isArray(data.labels)) return null;
  const labels = data.labels.slice(0, MAX_POINTS).map((label) => String(label ?? ""));
  if (!labels.length || !Array.isArray(data.datasets)) return null;
  const datasets = data.datasets.slice(0, MAX_SERIES).flatMap((entry) => series(entry, labels.length) ?? []);
  if (!datasets.length) return null;
  return { id: tool.toolCallId, title: typeof block.title === "string" ? block.title : "", chartType: chartType as ChartType, labels, datasets };
}

export const chartsOf = (tools: readonly ToolLike[]) => tools.flatMap((tool) => chartOf(tool) ?? []);

export const isChartTool = (tool: ToolLike) => chartOf(tool) !== null;
