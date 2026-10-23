import { createFileRoute } from "@tanstack/react-router";
import { KpiTile, KpiTileSkeleton, PageHeader, Panel, type KpiData } from "@/components/blocks";
import { SERIES_COLORS, TimeSeriesChart } from "@/components/charts";
import { ChartSkeleton, SectionError, useRange, useSection } from "@/components/section";
import type { Source } from "@/components/source-badge";
import { compareLabel, compareSentence, rangeSentence } from "@/lib/compare";
import { windowFor } from "@/lib/range";
import { ratio } from "@/lib/ratio";

export const Route = createFileRoute("/_app/")({
  head: () => ({ meta: [{ title: "Overview · Astro" }] }),
  component: Overview,
});

type TileSpec = { kpi: KpiData | null; error: unknown; retry: () => void; color: string; buckets: number[]; key: string; source: Source | Source[] };

function Overview() {
  const range = useRange();
  const w = windowFor(range);
  const site = useSection("overview.site");
  const installs = useSection("overview.installs");
  const app = useSection("overview.app");
  const errors = useSection("overview.errors");
  const compare = compareLabel(range);
  const days = installs.data?.days ?? [];

  const s = site.data;
  const tile = (key: string, kpi: Omit<KpiData, "key" | "sparkStep"> & { sparkStep?: KpiData["sparkStep"] }): KpiData => ({ key, sparkStep: w.step, ...kpi });
  const tiles: TileSpec[] = [
    {
      key: "visitors",
      source: "site",
      color: SERIES_COLORS[0]!,
      buckets: w.buckets,
      error: site.error,
      retry: () => site.refetch(),
      kpi: s ? tile("visitors", { label: "Site visitors", ...pick(s.visitors), format: "count", goodWhenUp: true, hint: "Distinct visitors on astro.oxy.so" }) : null,
    },
    {
      key: "mac",
      source: "site",
      color: SERIES_COLORS[0]!,
      buckets: w.buckets,
      error: site.error,
      retry: () => site.refetch(),
      kpi: s ? tile("mac", { label: "Mac visitors", ...pick(s.macVisitors), format: "count", goodWhenUp: true, hint: "Desktop macOS visitors" }) : null,
    },
    {
      key: "clickers",
      source: "site",
      color: SERIES_COLORS[1]!,
      buckets: w.buckets,
      error: site.error,
      retry: () => site.refetch(),
      kpi: s ? tile("clickers", { label: "Download clickers", ...pick(s.clickers), format: "count", goodWhenUp: true, hint: "Visitors who clicked Download, any device" }) : null,
    },
    {
      key: "rate",
      source: "site",
      color: SERIES_COLORS[1]!,
      buckets: w.buckets,
      error: site.error,
      retry: () => site.refetch(),
      kpi: s
        ? tile("rate", {
            label: "Mac download rate",
            value: ratio(s.macClickers.value, s.macVisitors.value),
            previous: s.macClickers.previous === null ? null : ratio(s.macClickers.previous, s.macVisitors.previous ?? 0),
            spark: s.macClickers.series.map((c, i) => ratio(c, s.macVisitors.series[i] ?? 0) ?? 0),
            format: "percent",
            goodWhenUp: true,
            hint: "Mac visitors who clicked Download",
          })
        : null,
    },
    {
      key: "first",
      source: "feed",
      color: SERIES_COLORS[2]!,
      buckets: days,
      error: installs.error,
      retry: () => installs.refetch(),
      kpi: installs.data
        ? tile("first", {
            label: "First launches",
            value: installs.data.first.value,
            previous: installs.data.first.previous,
            spark: installs.data.first.series,
            sparkStep: "day",
            format: "count",
            goodWhenUp: true,
            hint: "Installs that opened and checked for updates the first time (UTC days)",
          })
        : null,
    },
    {
      key: "active",
      source: "feed",
      color: SERIES_COLORS[2]!,
      buckets: days,
      error: installs.error,
      retry: () => installs.refetch(),
      kpi: installs.data
        ? tile("active", {
            label: "Copies running",
            value: installs.data.checks.yesterday === null ? null : Math.ceil(installs.data.checks.yesterday / 3),
            display: installs.data.checks.yesterday === null ? "–" : `${Math.ceil(installs.data.checks.yesterday / 3)}–${installs.data.checks.yesterday}`,
            previous: null,
            spark: installs.data.checks.series,
            sparkStep: "day",
            format: "count",
            goodWhenUp: true,
            hint: `Yesterday (UTC). Each running copy checks for updates 1–3 times a day. Avg ${Math.round(installs.data.checks.avg ?? 0)} checks a day in the range${installs.data.checks.avgPrevious !== null ? `, ${Math.round(installs.data.checks.avgPrevious)} before` : ""}.`,
          })
        : null,
    },
    {
      key: "app",
      source: "app",
      color: SERIES_COLORS[3]!,
      buckets: w.buckets,
      error: app.error,
      retry: () => app.refetch(),
      kpi: app.data
        ? tile("app", { label: "Opted-in app users", value: app.data.value, previous: app.data.previous, spark: app.data.series, format: "count", goodWhenUp: true, hint: "Distinct app installs sending opt-in telemetry" })
        : null,
    },
    {
      key: "errors",
      source: ["site", "app"],
      color: "var(--bad)",
      buckets: w.buckets,
      error: errors.error,
      retry: () => errors.refetch(),
      kpi: errors.data
        ? tile("errors", { label: "Errors", value: errors.data.value, previous: errors.data.previous, spark: errors.data.series, format: "count", goodWhenUp: false, hint: "Site and app exceptions, known noise excluded" })
        : null,
    },
  ];

  const firstOnBuckets = w.step === "day" && installs.data ? w.buckets.map((d) => installs.data!.first.series[installs.data!.days.indexOf(d)] ?? 0) : null;

  return (
    <>
      <PageHeader title="Overview" description={`${rangeSentence(range)}${compareSentence(range)}. Site analytics and update checks are always on and anonymous; app users are opt-in only. Times in UTC.`} />
      <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4" aria-label="Key numbers">
        {tiles.map((t) =>
          t.kpi ? (
            <KpiTile key={t.key} kpi={t.kpi} buckets={t.buckets} color={t.color} compareLabel={compare} source={t.source} />
          ) : t.error ? (
            <div key={t.key} className="rounded-xl border bg-card p-3">
              <SectionError error={t.error} onRetry={t.retry} />
            </div>
          ) : (
            <KpiTileSkeleton key={t.key} />
          ),
        )}
      </section>
      <div className="grid gap-3 sm:gap-4 xl:grid-cols-5">
        <Panel className="xl:col-span-3" title="Visitors" source="site" description={`Distinct visitors per ${w.step === "hour" ? "hour" : "day"}, all devices and Macs.`}>
          {s ? (
            <TimeSeriesChart
              buckets={s.window.buckets}
              step={s.window.step}
              height={280}
              series={[
                { key: "visitors", label: "Visitors", values: s.visitors.series, color: SERIES_COLORS[0] },
                { key: "mac", label: "Mac visitors", values: s.macVisitors.series, color: SERIES_COLORS[1] },
              ]}
            />
          ) : site.error ? (
            <SectionError error={site.error} onRetry={() => site.refetch()} />
          ) : (
            <ChartSkeleton height={280} legend />
          )}
        </Panel>
        <Panel
          className="xl:col-span-2"
          source={w.step === "hour" ? "site" : undefined}
          title="Downloads and installs"
          description={w.step === "hour" ? "Download clickers per hour. First launches are counted per UTC day; pick 7d or longer to see them." : "Download clickers and first launches per day."}
        >
          {s ? (
            <TimeSeriesChart
              buckets={s.window.buckets}
              step={s.window.step}
              height={280}
              series={[
                { key: "clickers", label: "Download clickers", values: s.clickers.series, color: "var(--chart-2)", source: "site" as const },
                ...(firstOnBuckets && s.window.step === "day" ? [{ key: "first", label: "First launches", values: firstOnBuckets, color: "var(--chart-3)", source: "feed" as const }] : []),
              ]}
            />
          ) : site.error ? (
            <SectionError error={site.error} onRetry={() => site.refetch()} />
          ) : (
            <ChartSkeleton height={280} legend />
          )}
        </Panel>
      </div>
    </>
  );
}

function pick(m: { value: number; previous: number | null; series: number[] }) {
  return { value: m.value, previous: m.previous, spark: m.series };
}
