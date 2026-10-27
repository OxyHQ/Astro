import { Button } from "@oxy.so/bloom/button";
import { Card } from "@oxy.so/bloom/card";
import { BarListCard, LineChartCard } from "@oxy.so/bloom/chart-cards";
import { RiArrowLeftSLine } from "@oxy.so/bloom/icons/RiArrowLeftSLine";
import { RiArrowRightSLine } from "@oxy.so/bloom/icons/RiArrowRightSLine";
import { RiBarChartLine } from "@oxy.so/bloom/icons/RiBarChartLine";
import { RiCloseLine } from "@oxy.so/bloom/icons/RiCloseLine";
import { Markdown } from "@oxy.so/bloom/markdown";
import { StatCard } from "@oxy.so/bloom/stat-cards";
import { Table, TableBody, TableCell, TableColumn, TableHeader, TableRow } from "@oxy.so/bloom/table";
import { useTheme } from "@oxy.so/bloom/theme";
import { Text } from "@oxy.so/bloom/typography";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import type { ArtifactBody, ChartData, Slide, Widget } from "../../ai/artifacts/artifacts";
import { renderCodeBlock } from "../chat/ChatCode";

export function ArtifactBodyView({ body, onLink, compact }: { body: ArtifactBody; onLink: (url: string) => void; compact?: boolean }) {
  switch (body.kind) {
    case "report":
      return <ReportView markdown={body.markdown} onLink={onLink} />;
    case "deck":
      return <DeckView slides={body.slides} onLink={onLink} compact={compact} />;
    case "dashboard":
      return <DashboardView widgets={body.widgets} onLink={onLink} />;
    case "table":
      return <TableView headers={body.headers} rows={body.rows} />;
    case "code":
      return <>{renderCodeBlock(body.code, body.language)}</>;
  }
}

function ReportView({ markdown, onLink }: { markdown: string; onLink: (url: string) => void }) {
  return (
    <Markdown onLinkPress={onLink} renderCodeBlock={renderCodeBlock}>
      {markdown}
    </Markdown>
  );
}

export function SlideView({ slide, index, onLink, big }: { slide: Slide; index: number; onLink: (url: string) => void; big?: boolean }) {
  const { colors } = useTheme();
  const scale = big ? 1.6 : 1;
  return (
    <Card
      border="hairline"
      radius="radius-12"
      clipContent
      style={{ width: "100%", aspectRatio: 16 / 9 }}
      contentStyle={{ flex: 1, paddingHorizontal: 40 * scale, paddingVertical: 32 * scale, gap: 10 * scale }}
    >
      <Text variant="title-1-bold" style={{ fontSize: 26 * scale, lineHeight: 32 * scale }}>
        {slide.title}
      </Text>
      {slide.subtitle ? (
        <Text variant="headline-regular" style={{ fontSize: 17 * scale, lineHeight: 24 * scale, color: colors.textSecondary }}>
          {slide.subtitle}
        </Text>
      ) : null}
      {slide.bullets?.map((b, i) => (
        <View key={i} style={{ flexDirection: "row", gap: 10 * scale }}>
          <Text variant="headline-regular" style={{ fontSize: 17 * scale, lineHeight: 25 * scale, color: colors.textSecondary }}>
            •
          </Text>
          <Text variant="headline-regular" style={{ flex: 1, fontSize: 17 * scale, lineHeight: 25 * scale }}>
            {b}
          </Text>
        </View>
      ))}
      {slide.body ? (
        <Markdown onLinkPress={onLink} renderCodeBlock={renderCodeBlock}>
          {slide.body}
        </Markdown>
      ) : null}
      <Text variant="caption-2-regular" style={{ position: "absolute", right: 16, bottom: 12, color: colors.textTertiary }}>
        {index + 1}
      </Text>
    </Card>
  );
}

function DeckView({ slides, onLink, compact }: { slides: Slide[]; onLink: (url: string) => void; compact?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: 18 }}>
      {slides.map((slide, i) => (
        <View key={i} style={{ gap: 6 }}>
          <SlideView slide={slide} index={i} onLink={onLink} />
          {!compact && slide.notes ? (
            <Text variant="body-2-regular" style={{ color: colors.textSecondary }}>
              Notes: {slide.notes}
            </Text>
          ) : null}
        </View>
      ))}
    </View>
  );
}

const NUMBER = new Intl.NumberFormat();
const format = (value: number) => NUMBER.format(value);

export function ChartView({ chart, title }: { chart: ChartData; title?: string }) {
  const { labels, datasets, chartType } = chart;
  const itemsOf = (values: number[]) => labels.map((label, i) => ({ label, value: values[i] ?? 0 }));
  const first = datasets[0];
  if (!first) return null;
  if (chartType === "line" && datasets.length === 1)
    return (
      <LineChartCard
        title={title || first.label}
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
        title={title || first.label}
        metricLabel={chartType === "pie" ? "Share" : "Value"}
        metric={chartType === "pie" ? "share" : "value"}
        format={format}
        items={itemsOf(first.values)}
        limit={labels.length}
      />
    );
  return (
    <BarListCard
      title={title ?? ""}
      metricLabel="Value"
      metric="value"
      format={format}
      tabs={datasets.map((series, i) => ({ id: `series-${i}`, label: series.label || `Series ${i + 1}`, items: itemsOf(series.values) }))}
      limit={labels.length}
    />
  );
}

export function TableView({ headers, rows }: { headers: string[]; rows: string[][] }) {
  const columns = Math.max(headers.length, ...rows.map((r) => r.length), 1);
  return (
    <Table minWidth={columns * 90}>
      {headers.length > 0 && (
        <TableHeader>
          {headers.map((h, i) => (
            <TableColumn key={i} flex={1} minWidth={90}>
              {h}
            </TableColumn>
          ))}
        </TableHeader>
      )}
      <TableBody>
        {rows.map((r, i) => (
          <TableRow key={i}>
            {r.map((c, j) => (
              <TableCell key={j} flex={1} minWidth={90}>
                <Text variant="body-2-regular" selectable>
                  {c}
                </Text>
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function WidgetTitle({ title }: { title?: string }) {
  return title ? <Text variant="body-semibold">{title}</Text> : null;
}

function WidgetCard({ widget, onLink }: { widget: Widget; onLink: (url: string) => void }) {
  switch (widget.kind) {
    case "stat": {
      const delta = widget.delta ?? "";
      const down = /^\s*[-−–]/.test(delta);
      return (
        <View style={{ flexGrow: 1, flexBasis: 160 }}>
          <StatCard stat={{ icon: RiBarChartLine, label: widget.label, value: widget.value, delta, deltaColor: !delta ? "neutral" : down ? "rose" : "lime" }} />
        </View>
      );
    }
    case "chart":
      return (
        <View style={{ flexBasis: "100%" }}>
          <ChartView chart={widget} {...(widget.title ? { title: widget.title } : {})} />
        </View>
      );
    case "table":
      return (
        <Card border="hairline" radius="radius-12" style={{ flexBasis: "100%", padding: 14 }} contentStyle={{ gap: 8 }}>
          <WidgetTitle {...(widget.title ? { title: widget.title } : {})} />
          <TableView headers={widget.headers} rows={widget.rows} />
        </Card>
      );
    case "text":
      return (
        <Card border="hairline" radius="radius-12" style={{ flexBasis: "100%", padding: 14 }} contentStyle={{ gap: 8 }}>
          <WidgetTitle {...(widget.title ? { title: widget.title } : {})} />
          <Markdown onLinkPress={onLink} renderCodeBlock={renderCodeBlock}>
            {widget.content}
          </Markdown>
        </Card>
      );
  }
}

function DashboardView({ widgets, onLink }: { widgets: Widget[]; onLink: (url: string) => void }) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
      {widgets.map((w, i) => (
        <WidgetCard key={i} widget={w} onLink={onLink} />
      ))}
    </View>
  );
}

export function Presenter({ slides, start, onClose, onLink }: { slides: Slide[]; start: number; onClose: () => void; onLink: (url: string) => void }) {
  const { colors } = useTheme();
  const [at, setAt] = useState(start);
  const slide = slides[at];
  if (!slide) return null;
  const go = (step: number) => setAt((i) => Math.min(slides.length - 1, Math.max(0, i + step)));
  return (
    <View
      focusable
      onKeyDown={(e: { nativeEvent: { key: string } }) => {
        const key = e.nativeEvent.key;
        if (key === "ArrowRight" || key === " " || key === "PageDown") go(1);
        else if (key === "ArrowLeft" || key === "PageUp") go(-1);
        else if (key === "Escape") onClose();
      }}
      style={{ ...StyleSheet.absoluteFillObject, backgroundColor: colors.background, alignItems: "center", justifyContent: "center", padding: 32 }}
    >
      <View style={{ width: "100%", maxWidth: 1100 }}>
        <SlideView slide={slide} index={at} onLink={onLink} big />
      </View>
      <View style={{ position: "absolute", bottom: 18, flexDirection: "row", alignItems: "center", gap: 14 }}>
        <Button appearance="plain" tone="neutral" size="sm" iconOnly leadingIcon={RiArrowLeftSLine} accessibilityLabel="Previous Slide" disabled={at === 0} onPress={() => go(-1)} />
        <Text variant="body-2-medium">
          {at + 1} / {slides.length}
        </Text>
        <Button
          appearance="plain"
          tone="neutral"
          size="sm"
          iconOnly
          leadingIcon={RiArrowRightSLine}
          accessibilityLabel="Next Slide"
          disabled={at === slides.length - 1}
          onPress={() => go(1)}
        />
        <Button appearance="plain" tone="neutral" size="sm" iconOnly leadingIcon={RiCloseLine} accessibilityLabel="End Presentation" onPress={onClose} />
      </View>
    </View>
  );
}
