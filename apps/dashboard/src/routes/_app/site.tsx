import { createFileRoute } from "@tanstack/react-router";
import { CircleAlert, CircleCheck, CircleDot } from "lucide-react";
import { BarList } from "@/components/bar-list";
import { Delta, Funnel, PageHeader, Panel, Stat } from "@/components/blocks";
import { TimeSeriesChart } from "@/components/charts";
import { DataTable } from "@/components/data-table";
import { Card } from "@/components/ui/card";
import { ChartSkeleton, ListSkeleton, Loaded, StatsSkeleton, TableSkeleton, useRange, useSection } from "@/components/section";
import type { SectionData } from "@/server/sections";
import { SourceBadge } from "@/components/source-badge";
import { compareLabel, compareSentence, rangeSentence } from "@/lib/compare";
import { formatAgo, formatExact, formatMs, formatPercent } from "@/lib/format";
import { windowFor } from "@/lib/range";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/site")({
  head: () => ({ meta: [{ title: "Site · Astro" }] }),
  component: SitePage,
});

type Clicks = SectionData<"site.clicks">;

const OUTCOME: Record<string, string> = {
  "": "Opened the panel",
  shared: "Shared",
  copied: "Copied the link",
  blocked: "Share blocked",
  failed: "Share failed",
  cancelled: "Share cancelled",
};

function SitePage() {
  const range = useRange();
  const w = windowFor(range);
  const compare = compareLabel(range);
  const traffic = useSection("site.traffic");
  const breakdowns = useSection("site.breakdowns");
  const clicks = useSection("site.clicks");
  const experiment = useSection("site.experiment");
  const vitals = useSection("site.vitals");

  return (
    <>
      <PageHeader title="Site" description={`astro.oxy.so, from always-on, anonymous site analytics. ${rangeSentence(range)}${compareSentence(range)}. Times in UTC.`} />

      <Card className="relative px-4 py-4 shadow-none sm:px-5">
        <div className="absolute top-3 right-3"><SourceBadge source="site" /></div>
        <Loaded query={traffic} skeleton={<div className="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-3 lg:grid-cols-5"><StatsSkeleton count={5} /></div>}>
          {(d) => (
            <div className="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-3 lg:grid-cols-5">
              {[
                { label: "Visitors", ...d.kpis.visitors },
                { label: "Page views", ...d.kpis.pageviews },
                { label: "Sessions", ...d.kpis.sessions },
                { label: "Mac visitors", ...d.kpis.mac },
                { label: "Phone visitors", ...d.kpis.phones },
              ].map((s) => (
                <Stat
                  key={s.label}
                  label={s.label}
                  value={formatExact(s.value)}
                  delta={<Delta value={s.value} previous={s.previous} format="count" />}
                  sub={s.previous !== null ? <span className="tnum">vs {formatExact(s.previous)} {compare}</span> : null}
                />
              ))}
            </div>
          )}
        </Loaded>
      </Card>

      <div className="grid gap-3 sm:gap-4 xl:grid-cols-5">
        <Panel source="site" className="xl:col-span-3" title="Visitors over time" description={`Distinct visitors per ${w.step === "hour" ? "hour" : "day"}.`}>
          <Loaded query={traffic} skeleton={<ChartSkeleton height={260} legend />}>
            {(d) => <TimeSeriesChart buckets={d.window.buckets} series={d.trend} step={d.window.step} height={260} />}
          </Loaded>
        </Panel>
        <Panel source="site" className="xl:col-span-2" title="Download funnel" description="Distinct people in the range. The Download button only ships a Mac app, so the funnel follows Macs.">
          <Loaded query={clicks} skeleton={<ListSkeleton rows={4} />}>
            {(d) => {
              const mac = traffic.data?.kpis.mac.value ?? null;
              return (
                <>
                  <Funnel
                    steps={[
                      { key: "visitors", label: "Visitors", value: traffic.data?.kpis.visitors.value ?? null },
                      { key: "mac", label: "Mac visitors", value: mac },
                      { key: "mac-clicked", label: "Mac download clicked", value: d.macClicked },
                    ]}
                    note={
                      <>
                        Mac download rate <span className="font-semibold text-foreground tnum">{formatPercent(mac ? d.macClicked / mac : null)}</span>. {formatExact(d.clickersAll)} people
                        clicked Download on any device.
                      </>
                    }
                  />
                  <div className="mt-5 border-t pt-4">
                    <BarList items={d.locations} dimension="Where they clicked" valueLabel="People" secondaryLabel="Clicks" color="var(--chart-2)" limit={6} />
                  </div>
                </>
              );
            }}
          </Loaded>
        </Panel>
      </div>

      <div className="grid gap-3 sm:gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {(
          [
            ["pages", "Top pages", undefined, "Path", true, "var(--chart-1)", undefined],
            ["referrers", "Referrers", "Referring domain of each page view.", "Source", true, "var(--chart-1)", undefined],
            ["countries", "Countries", undefined, "Country", true, "var(--chart-1)", undefined],
            ["devices", "Devices", undefined, "Device", false, "var(--chart-4)", undefined],
            ["browsers", "Browsers", undefined, "Browser", false, "var(--chart-4)", undefined],
            ["utm", "Campaigns", "utm_source / medium / campaign, from the page or the session's entry.", "Source / medium / campaign", true, "var(--chart-1)", "No tagged traffic in this range"],
          ] as const
        ).map(([key, title, description, dimension, views, color, empty]) => (
          <Panel source="site" key={key} title={title} description={description}>
            <Loaded query={breakdowns} skeleton={<ListSkeleton />}>
              {(d) => <BarList items={d[key]} dimension={dimension} secondaryLabel={views ? "Views" : undefined} color={color} empty={empty} />}
            </Loaded>
          </Panel>
        ))}
      </div>

      <div className="grid gap-3 sm:gap-4 xl:grid-cols-2">
        <Panel source="site" title="Clicks" description={`Tracked clicks. Change compares people with ${compare || "the period before"}.`}>
          <Loaded query={clicks} skeleton={<TableSkeleton rows={8} columns={4} />}>
            {(d) => <ClicksTable rows={d.clicks} />}
          </Loaded>
        </Panel>
        <Panel source="site" title="Rage and dead clicks" description="Grouped by the element's text and the page. Images have no text.">
          <Loaded query={clicks} skeleton={<TableSkeleton rows={8} columns={6} />}>
            {(d) => <DeadClicks rows={d.deadClicks} />}
          </Loaded>
        </Panel>
      </div>

      <div className="grid gap-3 sm:gap-4 xl:grid-cols-2">
        <Panel source="site" title="Experiment: download-band" description="Mac visitors exposed to each variant in the range, and how many clicked Download after exposure. Stop at 300+ per variant and 7+ days.">
          <Loaded query={experiment} skeleton={<TableSkeleton rows={2} columns={5} />}>
            {(d) => <Experiment data={d} />}
          </Loaded>
        </Panel>
        <Panel source="site" title="Send to my Mac" description="The phone panel: taps, how the link got out, and Macs that opened a sent link.">
          <Loaded query={clicks} skeleton={<ListSkeleton rows={4} />}>
            {(d) => <SendToMac rows={d.sendToMac} />}
          </Loaded>
        </Panel>
      </div>

      <Panel source="site" title="Web vitals" description="75th percentile of real visits in the range, against Google's thresholds.">
        <Loaded query={vitals} skeleton={<div className="grid grid-cols-2 gap-x-4 gap-y-5 lg:grid-cols-4"><StatsSkeleton count={4} /></div>}>
          {(d) => <Vitals rows={d} />}
        </Loaded>
      </Panel>
    </>
  );
}

function Vitals({ rows }: { rows: SectionData<"site.vitals"> }) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-5 lg:grid-cols-4">
      {rows.map((v) => {
        const rating = v.samples === 0 ? null : v.p75 <= v.good ? "good" : v.p75 <= v.poor ? "needs work" : "poor";
        const Icon = rating === "good" ? CircleCheck : rating === "poor" ? CircleAlert : CircleDot;
        return (
          <Stat
            key={v.key}
            label={`${v.key} · ${v.label}`}
            value={v.samples === 0 ? "–" : v.unit === "ms" ? formatMs(v.p75) : v.p75.toFixed(3)}
            sub={
              <span className="flex items-center gap-1.5">
                {rating ? (
                  <span className={cn("inline-flex items-center gap-1 font-medium", rating === "good" ? "text-good" : rating === "poor" ? "text-bad" : "text-amber-600 dark:text-amber-400")}>
                    <Icon className="size-3.5" aria-hidden />
                    {rating}
                  </span>
                ) : null}
                <span className="tnum">{formatExact(v.samples)} samples</span>
              </span>
            }
          />
        );
      })}
    </div>
  );
}

function DeadClicks({ rows }: { rows: Clicks["deadClicks"] }) {
  return (
    <DataTable
      dense
      rows={rows}
      rowKey={(r) => `${r.kind}|${r.text}|${r.path}`}
      initialSort={{ key: "count", desc: true }}
      limit={10}
      empty="No rage or dead clicks in this range"
      columns={[
        {
          key: "kind",
          header: "Kind",
          sort: (r) => r.kind,
          cell: (r) => <span className={cn("rounded px-1.5 py-0.5 text-[11px] font-medium", r.kind === "Rage" ? "bg-bad/12 text-bad" : "bg-muted text-muted-foreground")}>{r.kind}</span>,
        },
        { key: "text", header: "Element text", sort: (r) => r.text, cell: (r) => <span className="line-clamp-1 max-w-52 break-all">{r.text || <span className="text-muted-foreground">no text</span>}</span> },
        { key: "path", header: "Page", sort: (r) => r.path, cell: (r) => <span className="font-mono text-[11px] text-muted-foreground">{r.path}</span> },
        { key: "count", header: "Clicks", align: "right", sort: (r) => r.count, cell: (r) => formatExact(r.count) },
        { key: "people", header: "People", align: "right", sort: (r) => r.people, cell: (r) => formatExact(r.people) },
        { key: "last", header: "Last", align: "right", sort: (r) => r.lastSeen, cell: (r) => <span className="whitespace-nowrap text-muted-foreground">{formatAgo(r.lastSeen)}</span> },
      ]}
    />
  );
}

function ClicksTable({ rows }: { rows: Clicks["clicks"] }) {
  return (
    <DataTable
      dense
      rows={rows.filter((r) => r.count > 0 || (r.previousCount ?? 0) > 0)}
      rowKey={(r) => r.key}
      initialSort={{ key: "people", desc: true }}
      columns={[
        { key: "label", header: "Click", sort: (r) => r.label, cell: (r) => r.label },
        { key: "people", header: "People", align: "right", sort: (r) => r.people, cell: (r) => <span className="font-medium">{formatExact(r.people)}</span> },
        { key: "count", header: "Clicks", align: "right", sort: (r) => r.count, cell: (r) => formatExact(r.count) },
        {
          key: "delta",
          header: "Change",
          align: "right",
          sort: (r) => (r.previousPeople ? r.people / r.previousPeople : r.people),
          cell: (r) => <Delta value={r.people} previous={r.previousPeople} format="count" goodWhenUp={!r.key.startsWith("$")} />,
        },
      ]}
    />
  );
}

function Experiment({ data }: { data: SectionData<"site.experiment"> }) {
  const exposedMin = Math.min(...data.variants.map((v) => v.exposed), Number.POSITIVE_INFINITY);
  const ready = data.variants.length >= 2 && exposedMin >= 300;
  return (
    <>
      <DataTable
        dense
        rows={data.variants}
        rowKey={(r) => r.variant}
        empty="No exposures in this range"
        columns={[
          { key: "variant", header: "Variant", cell: (r) => <span className="font-medium">{r.variant}</span> },
          { key: "exposed", header: "Exposed", align: "right", sort: (r) => r.exposed, cell: (r) => formatExact(r.exposed) },
          { key: "clicked", header: "Clicked", align: "right", sort: (r) => r.clicked, cell: (r) => formatExact(r.clicked) },
          { key: "rate", header: "Rate", align: "right", sort: (r) => (r.exposed ? r.clicked / r.exposed : 0), cell: (r) => <span className="font-semibold">{formatPercent(r.exposed ? r.clicked / r.exposed : null)}</span> },
          { key: "band", header: "Band clicks", align: "right", sort: (r) => r.bandClicks, cell: (r) => formatExact(r.bandClicks) },
        ]}
      />
      <p className="mt-3 text-xs text-muted-foreground">
        {data.pValue === null ? "Not enough data for a test yet." : <>Two-sided p = <span className="font-medium text-foreground tnum">{data.pValue.toFixed(3)}</span>. </>}
        {ready ? "Both variants have 300+ exposures." : "Still under 300 exposures per variant, so don't call it yet."}
      </p>
    </>
  );
}

function SendToMac({ rows }: { rows: Clicks["sendToMac"] }) {
  const taps = rows.filter((r) => r.event === "send_to_mac_clicked");
  const fallback = rows.filter((r) => r.event === "send_to_mac_fallback");
  const visits = rows.filter((r) => r.event === "mac_link_visit");
  const people = (list: typeof rows) => list.reduce((s, r) => s + r.people, 0);
  return (
    <>
      <div className="grid grid-cols-3 gap-4 border-b pb-4">
        <Stat label="Taps" value={formatExact(taps.reduce((s, r) => s + r.count, 0))} sub={`${formatExact(people(taps))} people`} />
        <Stat label="Fallbacks" value={formatExact(fallback.reduce((s, r) => s + r.count, 0))} sub={`${formatExact(people(fallback))} people`} />
        <Stat label="Macs opened" value={formatExact(people(visits))} sub="sent links" />
      </div>
      <div className="mt-4 grid gap-5 sm:grid-cols-2">
        <BarList dimension="Outcome" valueLabel="People" items={taps.map((r) => ({ key: r.outcome, label: OUTCOME[r.outcome] ?? r.outcome, value: r.people, secondary: r.count }))} color="var(--chart-3)" empty="No taps" />
        <BarList dimension="Fallback" valueLabel="People" items={fallback.map((r) => ({ key: r.action, label: r.action || "other", value: r.people }))} color="var(--chart-3)" empty="No fallbacks" />
      </div>
    </>
  );
}
