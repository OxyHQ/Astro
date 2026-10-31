import { BarListCard, LineChartCard } from "@oxy.so/bloom/chart-cards";
import type { ReplyChart } from "./charts";

const NUMBER = new Intl.NumberFormat();
const format = (value: number) => NUMBER.format(value);

export function ChatChart({ chart }: { chart: ReplyChart }) {
  const { chartType, labels, datasets, title } = chart;
  const itemsOf = (values: number[]) => labels.map((label, i) => ({ label, value: values[i] ?? 0 }));
  const first = datasets[0]!;
  if (chartType === "line" && datasets.length === 1)
    return (
      <LineChartCard
        title={first.label || title}
        data={itemsOf(first.values)}
        format={format}
        formatAxisValue={format}
        getPointTitle={(point) => point.label}
        accessibilityLabel={title || first.label}
      />
    );
  if (chartType === "pie" || datasets.length === 1)
    return (
      <BarListCard
        title={first.label || title}
        metricLabel={chartType === "pie" ? "Share" : "Value"}
        metric={chartType === "pie" ? "share" : "value"}
        format={format}
        items={itemsOf(first.values)}
        limit={labels.length}
      />
    );
  return (
    <BarListCard
      title={title}
      metricLabel="Value"
      metric="value"
      format={format}
      tabs={datasets.map((series, i) => ({ id: `series-${i}`, label: series.label || `Series ${i + 1}`, items: itemsOf(series.values) }))}
      limit={labels.length}
    />
  );
}
