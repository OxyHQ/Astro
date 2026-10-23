import { useMemo, type ReactNode } from "react";
import { Area, AreaChart, CartesianGrid, Line, LineChart, ReferenceArea, XAxis, YAxis } from "recharts";
import { SourceBadge, type Source } from "@/components/source-badge";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import { formatBucket, formatCompact, formatExact, formatTick } from "@/lib/format";
import type { Step } from "@/lib/range";
import { cn } from "@/lib/utils";

export const SERIES_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)", "var(--chart-6)"];
export const OTHER_COLOR = "var(--chart-other)";

export type ChartSeries = { key: string; label: string; values: number[]; color?: string; source?: Source };

type TooltipRow = { dataKey?: string | number; value?: unknown; color?: string; name?: string | number };

function SeriesTooltip({
  active,
  payload,
  label,
  step,
  config,
  format,
  total,
}: {
  active?: boolean;
  payload?: TooltipRow[];
  label?: number | string;
  step: Step;
  config: ChartConfig;
  format: (n: number) => string;
  total?: boolean;
}) {
  if (!active || !payload?.length) return null;
  const rows = [...payload].reverse();
  const sum = rows.reduce((s, r) => s + (typeof r.value === "number" ? r.value : 0), 0);
  return (
    <div className="grid min-w-44 gap-1.5 rounded-lg border bg-popover/95 px-3 py-2 text-xs shadow-lg backdrop-blur">
      <div className="label-mono text-muted-foreground">{formatBucket(Number(label), step)}</div>
      {rows.map((row) => {
        const key = String(row.dataKey);
        return (
          <div key={key} className="flex items-center gap-2">
            <span className="h-0.5 w-3 shrink-0 rounded-full" style={{ backgroundColor: row.color }} />
            <span className="font-semibold tnum text-foreground">{format(Number(row.value ?? 0))}</span>
            <span className="truncate text-muted-foreground">{config[key]?.label ?? key}</span>
          </div>
        );
      })}
      {total && rows.length > 1 ? (
        <div className="mt-0.5 flex items-center gap-2 border-t pt-1.5">
          <span className="w-3" />
          <span className="font-semibold tnum">{format(sum)}</span>
          <span className="text-muted-foreground">Total</span>
        </div>
      ) : null}
    </div>
  );
}

export function Legend({ items, className }: { items: { label: string; color: string; shape?: "line" | "box"; source?: Source }[]; className?: string }) {
  return (
    <ul className={cn("flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground", className)}>
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5">
          <span
            className={cn("shrink-0 rounded-full", item.shape === "box" ? "size-2.5 rounded-[3px]" : "h-0.5 w-3.5")}
            style={{ backgroundColor: item.color }}
          />
          {item.label}
          {item.source ? <SourceBadge source={item.source} className="ml-0.5" /> : null}
        </li>
      ))}
    </ul>
  );
}

function useRows(buckets: number[], series: ChartSeries[]) {
  return useMemo(
    () =>
      buckets.map((t, i) => {
        const row: Record<string, number> = { t };
        series.forEach((s, j) => {
          row[`s${j}`] = s.values[i] ?? 0;
        });
        return row;
      }),
    [buckets, series],
  );
}

function configOf(series: ChartSeries[]): ChartConfig {
  return Object.fromEntries(series.map((s, i) => [`s${i}`, { label: s.label, color: s.color ?? SERIES_COLORS[i % SERIES_COLORS.length] }]));
}

const axisProps = {
  tickLine: false,
  axisLine: false,
  tick: { fontSize: 11 },
} as const;

export function TimeSeriesChart({
  buckets,
  series,
  step,
  height = 260,
  format = formatExact,
  area,
  footer,
  partial = true,
}: {
  buckets: number[];
  series: ChartSeries[];
  step: Step;
  height?: number;
  format?: (n: number) => string;
  area?: boolean;
  footer?: ReactNode;
  partial?: boolean;
}) {
  const rows = useRows(buckets, series);
  const config = configOf(series);
  const filled = area ?? series.length === 1;
  const Chart = filled ? AreaChart : LineChart;
  return (
    <div className="grid gap-3">
      {series.length > 1 ? <Legend items={series.map((s, i) => ({ label: s.label, color: s.color ?? SERIES_COLORS[i]!, source: s.source }))} /> : null}
      <ChartContainer config={config} className="aspect-auto w-full" style={{ height }}>
        <Chart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} accessibilityLayer>
          <CartesianGrid vertical={false} stroke="var(--grid)" />
          <XAxis dataKey="t" {...axisProps} minTickGap={28} tickMargin={8} tickFormatter={(v: number) => formatTick(v, step)} />
          <YAxis {...axisProps} width={40} allowDecimals={false} tickFormatter={(v: number) => formatCompact(v)} />
          {partial && buckets.length > 2 ? (
            <ReferenceArea
              x1={buckets[buckets.length - 2]}
              x2={buckets[buckets.length - 1]}
              fill="var(--foreground)"
              fillOpacity={0.035}
              strokeOpacity={0}
              label={{ value: "so far", position: "insideTopRight", fontSize: 10, fill: "var(--muted-foreground)" }}
            />
          ) : null}
          <ChartTooltip
            cursor={{ stroke: "var(--axis)", strokeWidth: 1 }}
            content={<SeriesTooltip step={step} config={config} format={format} />}
          />
          {series.map((s, i) =>
            filled ? (
              <Area
                key={s.key}
                dataKey={`s${i}`}
                type="monotone"
                stroke={`var(--color-s${i})`}
                strokeWidth={2}
                fill={`var(--color-s${i})`}
                fillOpacity={0.1}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--card)" }}
                isAnimationActive={false}
              />
            ) : (
              <Line
                key={s.key}
                dataKey={`s${i}`}
                type="monotone"
                stroke={`var(--color-s${i})`}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--card)" }}
                isAnimationActive={false}
              />
            ),
          )}
        </Chart>
      </ChartContainer>
      {footer}
    </div>
  );
}

export function StackedAreaChart({
  buckets,
  series,
  step,
  height = 280,
  format = formatExact,
  partial = true,
}: {
  buckets: number[];
  series: ChartSeries[];
  step: Step;
  height?: number;
  format?: (n: number) => string;
  partial?: boolean;
}) {
  const rows = useRows(buckets, series);
  const config = configOf(series);
  return (
    <div className="grid gap-3">
      <Legend items={series.map((s, i) => ({ label: s.label, color: s.color ?? SERIES_COLORS[i]!, shape: "box" }))} />
      <ChartContainer config={config} className="aspect-auto w-full" style={{ height }}>
        <AreaChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} accessibilityLayer>
          <CartesianGrid vertical={false} stroke="var(--grid)" />
          <XAxis dataKey="t" {...axisProps} minTickGap={28} tickMargin={8} tickFormatter={(v: number) => formatTick(v, step)} />
          <YAxis {...axisProps} width={40} allowDecimals={false} tickFormatter={(v: number) => formatCompact(v)} />
          {partial && buckets.length > 2 ? (
            <ReferenceArea
              x1={buckets[buckets.length - 2]}
              x2={buckets[buckets.length - 1]}
              fill="var(--foreground)"
              fillOpacity={0.035}
              strokeOpacity={0}
              label={{ value: "so far", position: "insideTopRight", fontSize: 10, fill: "var(--muted-foreground)" }}
            />
          ) : null}
          <ChartTooltip
            cursor={{ stroke: "var(--axis)", strokeWidth: 1 }}
            content={<SeriesTooltip step={step} config={config} format={format} total />}
          />
          {series.map((s, i) => (
            <Area
              key={s.key}
              dataKey={`s${i}`}
              stackId="stack"
              type="linear"
              stroke="var(--card)"
              strokeWidth={1.5}
              fill={`var(--color-s${i})`}
              fillOpacity={0.85}
              activeDot={false}
              isAnimationActive={false}
            />
          ))}
        </AreaChart>
      </ChartContainer>
    </div>
  );
}
