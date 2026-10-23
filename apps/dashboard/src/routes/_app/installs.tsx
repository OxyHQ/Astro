import { createFileRoute } from "@tanstack/react-router";
import { Funnel, PageHeader, Panel, SplitBar, Stat } from "@/components/blocks";
import { OTHER_COLOR, SERIES_COLORS, StackedAreaChart, TimeSeriesChart } from "@/components/charts";
import { DataTable } from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ChartSkeleton, ListSkeleton, Loaded, StatsSkeleton, TableSkeleton, useRange, useSection } from "@/components/section";
import { Skeleton } from "@/components/ui/skeleton";
import { rangeSentence } from "@/lib/compare";
import { formatDate, formatExact, formatPercent } from "@/lib/format";

export const Route = createFileRoute("/_app/installs")({
  head: () => ({ meta: [{ title: "Installs & updates · Astro" }] }),
  component: InstallsPage,
});

function InstallsPage() {
  const range = useRange();
  const daily = useSection("installs.daily");
  const versions = useSection("installs.versions");

  return (
    <>
      <PageHeader
        title="Installs & updates"
        description={`${rangeSentence(range)}, by UTC day. From the always-on, anonymous update checks every installed copy makes (1–3 a day per running copy, the very first one flagged). Download counts are public GitHub data.`}
      />

      <Card className="grid grid-cols-2 gap-x-4 gap-y-5 px-4 py-4 shadow-none sm:px-5 lg:grid-cols-4">
        <Loaded query={daily} skeleton={<StatsSkeleton count={1} />}>
          {(d) => <Stat source="feed" label="First launches" value={formatExact(d.firstInRange)} sub={versions.data ? `${formatExact(versions.data.firstAllTime)} all time` : <Skeleton className="h-3 w-20" />} />}
        </Loaded>
        <Loaded query={daily} skeleton={<StatsSkeleton count={1} />}>
          {(d) => <Stat source="feed" label="Copies running yesterday" value={d.yesterday ? `${d.yesterday.low}–${d.yesterday.high}` : "–"} sub="checks ÷ 3 to checks" />}
        </Loaded>
        <Loaded query={daily} skeleton={<StatsSkeleton count={1} />}>
          {(d) => (
            <Stat
              source="feed"
              label="Update checks"
              value={formatExact(d.channel.stable + d.channel.nightly)}
              sub={`${formatPercent(d.channel.nightly / Math.max(1, d.channel.stable + d.channel.nightly))} from nightlies`}
            />
          )}
        </Loaded>
        <Loaded query={versions} skeleton={<StatsSkeleton count={1} />}>
          {(v) => (
            <Stat
              source="github"
              label="Nightly DMG"
              value={v.nightlyRelease ? formatExact(v.nightlyRelease.dmg) : "–"}
              sub={v.nightlyRelease ? `rolling build, ${formatExact(v.nightlyRelease.zip)} update zips` : "no nightly release"}
            />
          )}
        </Loaded>
      </Card>

      <div className="grid gap-3 sm:gap-4 xl:grid-cols-2">
        <Panel source="feed" title="First launches" description="Copies that opened for the first time and checked for updates, per UTC day.">
          <Loaded query={daily} skeleton={<ChartSkeleton height={240} />}>
            {(d) => <TimeSeriesChart buckets={d.days} series={[{ key: "first", label: "First launches", values: d.firstLaunches, color: "var(--chart-3)" }]} step="day" height={240} />}
          </Loaded>
        </Panel>
        <Panel source="feed" title="Active installs" description="Update checks per day by channel. A running copy checks 1–3 times a day, so copies running sit between a third of the checks and all of them.">
          <Loaded query={daily} skeleton={<ChartSkeleton height={240} legend />}>
            {(d) => (
              <TimeSeriesChart buckets={d.days} series={d.checks.map((s) => ({ ...s, color: s.key === "stable" ? "var(--chart-1)" : "var(--chart-6)" }))} step="day" height={240} />
            )}
          </Loaded>
        </Panel>
      </div>

      <Panel source="feed" title="Version adoption" description="Update checks per day by the version that made them. The five busiest stable versions in the range; nightlies and older versions are grouped.">
        <Loaded query={daily} skeleton={<ChartSkeleton height={300} legend />}>
          {(d) => (
            <StackedAreaChart
              buckets={d.days}
              series={d.adoption.map((s, i) => ({ ...s, color: s.key === "older" ? OTHER_COLOR : s.key === "nightly" ? "var(--chart-6)" : SERIES_COLORS[i] }))}
              step="day"
              height={300}
            />
          )}
        </Loaded>
      </Panel>

      <div className="grid gap-3 sm:gap-4 xl:grid-cols-5">
        <Panel className="xl:col-span-2" source={["github", "feed"]} title="Download to running" description="All time for versions since 0.2.14, the first with counted checks. A download isn't an install, and an install isn't a user.">
          <Loaded query={versions} skeleton={<ListSkeleton rows={3} />}>
            {(v) => (
              <Funnel
                steps={[
                  { key: "dmg", label: "DMG downloads (GitHub)", value: v.funnel.dmg },
                  { key: "first", label: "First launches", value: v.funnel.first },
                  {
                    key: "running",
                    label: "Copies running yesterday",
                    value: daily.data?.yesterday?.high ?? null,
                    display: daily.data?.yesterday ? `${daily.data.yesterday.low}–${daily.data.yesterday.high}` : "–",
                  },
                ]}
                note="The last step is a range: the bar shows the upper end."
              />
            )}
          </Loaded>
        </Panel>
        <Panel className="xl:col-span-3" source="feed" title="Channel split" description="Update checks in the range, stable against nightly.">
          <Loaded query={daily} skeleton={<Skeleton className="h-3 w-full rounded-full" />}>
            {(d) => (
              <SplitBar
                parts={[
                  { key: "stable", label: "Stable", value: d.channel.stable, color: "var(--chart-1)" },
                  { key: "nightly", label: "Nightly", value: d.channel.nightly, color: "var(--chart-6)" },
                ]}
              />
            )}
          </Loaded>
          {versions.data?.githubError ? <p className="mt-4 text-xs text-bad">GitHub: {versions.data.githubError}</p> : null}
        </Panel>
      </div>

      <Panel source={["github", "feed"]} title="Versions" description="Per release: GitHub downloads, first launches (installs), and update checks. Sorted newest first.">
        <Loaded query={versions} skeleton={<TableSkeleton rows={10} columns={8} />}>
          {(v) => (
            <DataTable
              dense
              rows={v.versions}
              rowKey={(r) => r.version}
              limit={15}
              columns={[
                {
                  key: "version",
                  header: "Version",
                  sort: (r) => r.version,
                  cell: (r) => (
                    <span className="flex items-center gap-1.5 font-mono text-[12px]">
                      {r.version}
                      {r.nightly ? (
                        <Badge variant="secondary" className="h-4 px-1 text-[10px]">
                          nightly
                        </Badge>
                      ) : null}
                    </span>
                  ),
                },
                { key: "published", header: "Published", sort: (r) => r.published ?? "", cell: (r) => <span className="whitespace-nowrap text-muted-foreground">{r.published ? formatDate(r.published) : "–"}</span> },
                { key: "dmg", header: "DMG", align: "right", sort: (r) => r.dmg ?? -1, cell: (r) => (r.dmg === null ? "–" : formatExact(r.dmg)) },
                { key: "first", header: "First launches", align: "right", sort: (r) => r.first, cell: (r) => <span className="font-medium">{formatExact(r.first)}</span> },
                { key: "rate", header: "First / DMG", align: "right", sort: (r) => (r.dmg ? r.first / r.dmg : -1), cell: (r) => (r.dmg ? formatPercent(r.first / r.dmg, 0) : "–") },
                { key: "zip", header: "Update zips", align: "right", sort: (r) => r.zip ?? -1, cell: (r) => (r.zip === null ? "–" : formatExact(r.zip)) },
                { key: "inRange", header: "Checks in range", align: "right", sort: (r) => r.checksInRange, cell: (r) => formatExact(r.checksInRange) },
                { key: "last", header: "Last check", align: "right", sort: (r) => r.lastSeen, cell: (r) => <span className="whitespace-nowrap text-muted-foreground">{r.lastSeen ? formatDate(r.lastSeen) : "–"}</span> },
              ]}
            />
          )}
        </Loaded>
      </Panel>
    </>
  );
}
