import { createFileRoute } from "@tanstack/react-router";
import { BarList } from "@/components/bar-list";
import { Delta, PageHeader, Panel, Stat } from "@/components/blocks";
import { TimeSeriesChart } from "@/components/charts";
import { DataTable } from "@/components/data-table";
import { Card } from "@/components/ui/card";
import { ChartSkeleton, ListSkeleton, Loaded, StatsSkeleton, TableSkeleton, useRange, useSection } from "@/components/section";
import { compareLabel, compareSentence, rangeSentence } from "@/lib/compare";
import { formatAgo, formatExact, formatMs, formatPercent } from "@/lib/format";
import { windowFor } from "@/lib/range";
import { SourceBadge } from "@/components/source-badge";

export const Route = createFileRoute("/_app/app")({
  head: () => ({ meta: [{ title: "App · Astro" }] }),
  component: AppPage,
});

function AppPage() {
  const range = useRange();
  const w = windowFor(range);
  const compare = compareLabel(range);
  const trend = useSection("app.trend");
  const breakdowns = useSection("app.breakdowns");
  const perf = useSection("app.perf");
  const installs = useSection("overview.installs");
  const share = (() => {
    const t = trend.data;
    const checks = installs.data?.checks.yesterday;
    if (!t || !checks) return null;
    const users = t.window.step === "day" ? (t.users.at(-2) ?? 0) : t.kpis.users.value;
    const low = Math.ceil(checks / 3);
    const high = checks;
    if (!users || !low) return null;
    const pct = (n: number) => Math.min(100, Math.round((100 * users) / n));
    return `${users} opted-in users yesterday against ${low}–${high} copies running, so roughly ${pct(high)}–${pct(low)}% of installs share usage.`;
  })();
  const vs = (previous: number | null, format: (n: number) => string) => (previous !== null ? <span className="tnum">vs {format(previous)} {compare}</span> : null);

  return (
    <>
      <PageHeader
        title="App"
        description={`Opt-in only: Mac app telemetry from users who turned on usage sharing, so every number here undercounts. ${share ?? ""} ${rangeSentence(range)}${compareSentence(range)}.`}
      />

      <Card className="relative px-4 py-4 shadow-none sm:px-5">
        <div className="absolute top-3 right-3"><SourceBadge source="app" /></div>
        <Loaded query={trend} skeleton={<div className="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-3 lg:grid-cols-5"><StatsSkeleton count={5} /></div>}>
          {({ kpis: k }) => (
            <div className="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-3 lg:grid-cols-5">
              <Stat label="Opted-in users" value={formatExact(k.users.value)} delta={<Delta {...k.users} format="count" />} sub={vs(k.users.previous, formatExact)} />
              <Stat label="Launches" value={formatExact(k.launches.value)} delta={<Delta {...k.launches} format="count" />} sub={vs(k.launches.previous, formatExact)} />
              <Stat
                label="Unclean previous exit"
                value={formatPercent(k.uncleanRate.value)}
                delta={<Delta value={k.uncleanRate.value} previous={k.uncleanRate.previous} format="percent" goodWhenUp={false} />}
                sub={vs(k.uncleanRate.previous, (n) => formatPercent(n))}
              />
              <Stat label="Median session" value={`${formatExact(k.medianSession.value)} min`} delta={<Delta {...k.medianSession} format="count" />} sub={vs(k.medianSession.previous, (n) => `${formatExact(n)} min`)} />
              <Stat label="Tabs opened" value={formatExact(k.tabsOpened.value)} delta={<Delta {...k.tabsOpened} format="count" />} sub={vs(k.tabsOpened.previous, formatExact)} />
            </div>
          )}
        </Loaded>
      </Card>

      <div className="grid gap-3 sm:gap-4 xl:grid-cols-2">
        <Panel source="app" title="Opted-in users" description={`Distinct installs sending telemetry per ${w.step === "hour" ? "hour" : "day"}.`}>
          <Loaded query={trend} skeleton={<ChartSkeleton height={220} />}>
            {(d) => <TimeSeriesChart buckets={d.window.buckets} series={[{ key: "users", label: "Opted-in users", values: d.users, color: "var(--chart-4)" }]} step={d.window.step} height={220} />}
          </Loaded>
        </Panel>
        <Panel source="app" title="Launches" description={`App launches per ${w.step === "hour" ? "hour" : "day"}.`}>
          <Loaded query={trend} skeleton={<ChartSkeleton height={220} />}>
            {(d) => <TimeSeriesChart buckets={d.window.buckets} series={[{ key: "launches", label: "Launches", values: d.launches, color: "var(--chart-2)" }]} step={d.window.step} height={220} />}
          </Loaded>
        </Panel>
      </div>

      <div className="grid gap-3 sm:gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <Panel source="app" title="Versions">
          <Loaded query={breakdowns} skeleton={<ListSkeleton />}>{(data) => <BarList items={data.versions} dimension="App version" valueLabel="Users" secondaryLabel="Events" color="var(--chart-4)" />}</Loaded>
        </Panel>
        <Panel source="app" title="macOS">
          <Loaded query={breakdowns} skeleton={<ListSkeleton />}>{(data) => <BarList items={data.osVersions} dimension="Version" valueLabel="Users" color="var(--chart-4)" />}</Loaded>
        </Panel>
        <Panel source="app" title="Engine and chip">
          <Loaded query={breakdowns} skeleton={<ListSkeleton />}>{(data) => <BarList items={data.engines} dimension="Engine" valueLabel="Users" color="var(--chart-4)" limit={4} />}</Loaded>
          <div className="mt-4 border-t pt-4">
            <Loaded query={breakdowns} skeleton={<ListSkeleton />}>{(data) => <BarList items={data.arch} dimension="Architecture" valueLabel="Users" color="var(--chart-4)" />}</Loaded>
          </div>
        </Panel>
        <Panel source="app" title="Session length" description="From the session-ended event.">
          <Loaded query={breakdowns} skeleton={<ListSkeleton />}>{(data) => <BarList items={data.sessionLengths} dimension="Length" valueLabel="Sessions" color="var(--chart-2)" />}</Loaded>
        </Panel>
        <Panel source="app" title="Settings sections opened">
          <Loaded query={breakdowns} skeleton={<ListSkeleton />}>{(data) => <BarList items={data.sections} dimension="Section" valueLabel="Users" secondaryLabel="Opens" color="var(--chart-2)" />}</Loaded>
        </Panel>
        <Panel source="app" title="Omnibox suggestions chosen">
          <Loaded query={breakdowns} skeleton={<ListSkeleton />}>{(data) => <BarList items={data.suggestions} dimension="Type" valueLabel="Users" secondaryLabel="Picks" color="var(--chart-2)" />}</Loaded>
        </Panel>
      </div>

      <Panel source="app" title="Performance by version" description="Medians across the samples each version sent in the range.">
        <Loaded query={perf} skeleton={<TableSkeleton rows={8} columns={8} />}>
          {(rows) => (
            <DataTable
              dense
              rows={rows}
              rowKey={(r) => r.version}
              initialSort={{ key: "version", desc: true }}
              columns={[
                { key: "version", header: "Version", sort: (r) => r.version, cell: (r) => <span className="font-mono text-[12px]">{r.version}</span> },
                { key: "people", header: "Users", align: "right", sort: (r) => r.people, cell: (r) => formatExact(r.people) },
                { key: "launch", header: "Launch to usable", align: "right", sort: (r) => r.launchMs, cell: (r) => (r.launches ? formatMs(r.launchMs) : "–") },
                { key: "launches", header: "Launches", align: "right", sort: (r) => r.launches, cell: (r) => formatExact(r.launches) },
                { key: "omnibox", header: "Omnibox p50", align: "right", sort: (r) => r.omniboxMs, cell: (r) => (r.omniboxMs ? formatMs(r.omniboxMs) : "–") },
                { key: "total", header: "All processes", align: "right", sort: (r) => r.totalMb, cell: (r) => (r.memorySamples ? `${formatExact(r.totalMb)} MB` : "–") },
                { key: "browser", header: "Browser process", align: "right", sort: (r) => r.browserMb, cell: (r) => (r.memorySamples ? `${formatExact(r.browserMb)} MB` : "–") },
                { key: "tabs", header: "Tabs", align: "right", sort: (r) => r.tabs, cell: (r) => (r.memorySamples ? formatExact(r.tabs) : "–") },
              ]}
            />
          )}
        </Loaded>
      </Panel>

      <div className="grid gap-3 sm:gap-4 xl:grid-cols-5">
        <Panel source="app" className="xl:col-span-3" title="Events" description="Everything the app sent in the range.">
          <Loaded query={breakdowns} skeleton={<TableSkeleton rows={8} columns={4} />}>
            {(d) => (
              <DataTable
                dense
                rows={d.events}
                rowKey={(r) => r.key}
                initialSort={{ key: "count", desc: true }}
                columns={[
                  {
                    key: "label",
                    header: "Event",
                    sort: (r) => r.label,
                    cell: (r) => (
                      <span className="grid">
                        <span>{r.label}</span>
                        <span className="font-mono text-[10.5px] text-muted-foreground">{r.key}</span>
                      </span>
                    ),
                  },
                  { key: "count", header: "Count", align: "right", sort: (r) => r.count, cell: (r) => <span className="font-medium">{formatExact(r.count)}</span> },
                  { key: "people", header: "Users", align: "right", sort: (r) => r.people, cell: (r) => formatExact(r.people) },
                  { key: "last", header: "Last", align: "right", sort: (r) => r.lastSeen, cell: (r) => <span className="whitespace-nowrap text-muted-foreground">{formatAgo(r.lastSeen)}</span> },
                ]}
              />
            )}
          </Loaded>
        </Panel>
        <Panel source="app" className="xl:col-span-2" title="Updates" description="From version → to version, as the app reported after updating.">
          <Loaded query={breakdowns} skeleton={<TableSkeleton rows={8} columns={3} />}>
            {(u) => (
              <DataTable
                dense
                rows={u.updates}
                rowKey={(r) => `${r.from}>${r.to}`}
                initialSort={{ key: "count", desc: true }}
                empty="No updates in this range"
                columns={[
                  {
                    key: "path",
                    header: "Update",
                    sort: (r) => r.to,
                    cell: (r) => (
                      <span className="font-mono text-[11.5px] whitespace-nowrap">
                        {r.from} <span className="text-muted-foreground">→</span> {r.to}
                      </span>
                    ),
                  },
                  { key: "count", header: "Count", align: "right", sort: (r) => r.count, cell: (r) => formatExact(r.count) },
                  { key: "people", header: "Users", align: "right", sort: (r) => r.people, cell: (r) => formatExact(r.people) },
                ]}
              />
            )}
          </Loaded>
        </Panel>
      </div>
    </>
  );
}
