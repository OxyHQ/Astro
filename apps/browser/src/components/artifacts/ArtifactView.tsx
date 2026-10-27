import { Markdown } from "@oxy.so/bloom/markdown";
import { Symbol } from "@astro-browser/shell";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { ArtifactBody, ChartData, Slide, Widget } from "../../ai/artifacts/artifacts";
import { useTheme } from "../../lib/theme";
import { renderCodeBlock } from "../chat/ChatCode";

const PALETTE = ["#7C5CFC", "#2BB673", "#F5A524", "#E5484D", "#3E8EF7", "#A1A1AA"];

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

function border(dark: boolean) {
  return dark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.1)";
}

export function SlideView({ slide, index, onLink, big }: { slide: Slide; index: number; onLink: (url: string) => void; big?: boolean }) {
  const theme = useTheme();
  const scale = big ? 1.6 : 1;
  return (
    <View
      style={{
        width: "100%",
        aspectRatio: 16 / 9,
        borderRadius: 12,
        borderWidth: StyleSheet.hairlineWidth * 2,
        borderColor: border(theme.dark),
        backgroundColor: theme.dark ? "#1f1d20" : "#FFFFFF",
        paddingHorizontal: 40 * scale,
        paddingVertical: 32 * scale,
        overflow: "hidden",
        gap: 10 * scale,
      }}
    >
      <Text style={{ fontSize: 26 * scale, fontWeight: "700", color: theme.textPrimary }}>{slide.title}</Text>
      {slide.subtitle ? <Text style={{ fontSize: 17 * scale, color: theme.textSecondary }}>{slide.subtitle}</Text> : null}
      {slide.bullets?.map((b, i) => (
        <View key={i} style={{ flexDirection: "row", gap: 10 * scale }}>
          <Text style={{ fontSize: 17 * scale, color: theme.textSecondary }}>•</Text>
          <Text style={{ flex: 1, fontSize: 17 * scale, lineHeight: 25 * scale, color: theme.textPrimary }}>{b}</Text>
        </View>
      ))}
      {slide.body ? (
        <Markdown onLinkPress={onLink} renderCodeBlock={renderCodeBlock}>
          {slide.body}
        </Markdown>
      ) : null}
      <Text style={{ position: "absolute", right: 16, bottom: 12, fontSize: 11, color: theme.textTertiary }}>{index + 1}</Text>
    </View>
  );
}

function DeckView({ slides, onLink, compact }: { slides: Slide[]; onLink: (url: string) => void; compact?: boolean }) {
  const theme = useTheme();
  return (
    <View style={{ gap: 18 }}>
      {slides.map((slide, i) => (
        <View key={i} style={{ gap: 6 }}>
          <SlideView slide={slide} index={i} onLink={onLink} />
          {!compact && slide.notes ? <Text style={{ fontSize: 12.5, color: theme.textSecondary }}>Notes: {slide.notes}</Text> : null}
        </View>
      ))}
    </View>
  );
}

export function ChartView({ chart, height = 180 }: { chart: ChartData; height?: number }) {
  const theme = useTheme();
  const max = Math.max(1, ...chart.datasets.flatMap((d) => d.values));
  if (chart.chartType === "pie") {
    const values = chart.datasets[0]?.values ?? [];
    const total = values.reduce((a, b) => a + Math.max(0, b), 0) || 1;
    return (
      <View style={{ gap: 8 }}>
        <View style={{ flexDirection: "row", height: 18, borderRadius: 9, overflow: "hidden" }}>
          {values.map((v, i) => (
            <View key={i} style={{ flex: Math.max(0, v) / total, backgroundColor: PALETTE[i % PALETTE.length] }} />
          ))}
        </View>
        <Legend labels={chart.labels.map((l, i) => `${l} · ${Math.round((Math.max(0, values[i] ?? 0) / total) * 100)}%`)} />
      </View>
    );
  }
  return (
    <View style={{ gap: 8 }}>
      <View style={{ height, flexDirection: "row", alignItems: "flex-end", gap: 6, borderBottomWidth: 1, borderColor: border(theme.dark) }}>
        {chart.labels.map((label, i) => (
          <View key={i} style={{ flex: 1, alignItems: "center", justifyContent: "flex-end", height: "100%" }}>
            <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 2, height: "100%", width: "100%", justifyContent: "center" }}>
              {chart.datasets.map((d, s) =>
                chart.chartType === "line" ? (
                  <View key={s} style={{ flex: 1, maxWidth: 28, height: `${(Math.max(0, d.values[i] ?? 0) / max) * 100}%`, justifyContent: "flex-start", alignItems: "center" }}>
                    <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: PALETTE[s % PALETTE.length], marginTop: -4 }} />
                    <View style={{ flex: 1, width: 2, backgroundColor: PALETTE[s % PALETTE.length], opacity: 0.25 }} />
                  </View>
                ) : (
                  <View
                    key={s}
                    tooltip={`${d.label ? `${d.label}: ` : ""}${d.values[i]}`}
                    style={{ flex: 1, maxWidth: 28, height: `${(Math.max(0, d.values[i] ?? 0) / max) * 100}%`, borderTopLeftRadius: 4, borderTopRightRadius: 4, backgroundColor: PALETTE[s % PALETTE.length] }}
                  />
                ),
              )}
            </View>
          </View>
        ))}
      </View>
      <View style={{ flexDirection: "row", gap: 6 }}>
        {chart.labels.map((label, i) => (
          <Text key={i} numberOfLines={1} style={{ flex: 1, textAlign: "center", fontSize: 11, color: theme.textSecondary }}>
            {label}
          </Text>
        ))}
      </View>
      {chart.datasets.length > 1 || chart.datasets[0]?.label ? <Legend labels={chart.datasets.map((d) => d.label)} /> : null}
    </View>
  );
}

function Legend({ labels }: { labels: string[] }) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
      {labels.map((l, i) => (
        <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
          <View style={{ width: 9, height: 9, borderRadius: 2, backgroundColor: PALETTE[i % PALETTE.length] }} />
          <Text style={{ fontSize: 11.5, color: theme.textSecondary }}>{l}</Text>
        </View>
      ))}
    </View>
  );
}

export function TableView({ headers, rows }: { headers: string[]; rows: string[][] }) {
  const theme = useTheme();
  const line = border(theme.dark);
  const cell = { flex: 1, minWidth: 90, paddingHorizontal: 10, paddingVertical: 7 } as const;
  return (
    <ScrollView horizontal contentContainerStyle={{ flexGrow: 1 }}>
      <View style={{ flex: 1, borderWidth: 1, borderColor: line, borderRadius: 8, overflow: "hidden" }}>
        {headers.length > 0 && (
          <View style={{ flexDirection: "row", backgroundColor: theme.dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)" }}>
            {headers.map((h, i) => (
              <Text key={i} style={[cell, { fontSize: 13, fontWeight: "600", color: theme.textPrimary }]}>
                {h}
              </Text>
            ))}
          </View>
        )}
        {rows.map((r, i) => (
          <View key={i} style={{ flexDirection: "row", borderTopWidth: 1, borderColor: line }}>
            {r.map((c, j) => (
              <Text key={j} selectable style={[cell, { fontSize: 13, color: theme.textPrimary }]}>
                {c}
              </Text>
            ))}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

function WidgetCard({ widget, onLink }: { widget: Widget; onLink: (url: string) => void }) {
  const theme = useTheme();
  const card = {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: border(theme.dark),
    backgroundColor: theme.dark ? "rgba(255,255,255,0.03)" : "#FFFFFF",
    padding: 14,
    gap: 8,
  } as const;
  switch (widget.kind) {
    case "stat": {
      const down = /^\s*[-−–]/.test(widget.delta ?? "");
      return (
        <View style={[card, { flexGrow: 1, flexBasis: 160 }]}>
          <Text style={{ fontSize: 12.5, color: theme.textSecondary }}>{widget.label}</Text>
          <Text style={{ fontSize: 26, fontWeight: "700", color: theme.textPrimary }}>{widget.value}</Text>
          {widget.delta ? <Text style={{ fontSize: 12.5, fontWeight: "600", color: down ? "#E5484D" : "#2BB673" }}>{widget.delta}</Text> : null}
        </View>
      );
    }
    case "chart":
      return (
        <View style={[card, { flexBasis: "100%" }]}>
          {widget.title ? <Text style={{ fontSize: 14, fontWeight: "600", color: theme.textPrimary }}>{widget.title}</Text> : null}
          <ChartView chart={widget} />
        </View>
      );
    case "table":
      return (
        <View style={[card, { flexBasis: "100%" }]}>
          {widget.title ? <Text style={{ fontSize: 14, fontWeight: "600", color: theme.textPrimary }}>{widget.title}</Text> : null}
          <TableView headers={widget.headers} rows={widget.rows} />
        </View>
      );
    case "text":
      return (
        <View style={[card, { flexBasis: "100%" }]}>
          {widget.title ? <Text style={{ fontSize: 14, fontWeight: "600", color: theme.textPrimary }}>{widget.title}</Text> : null}
          <Markdown onLinkPress={onLink} renderCodeBlock={renderCodeBlock}>
            {widget.content}
          </Markdown>
        </View>
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
  const theme = useTheme();
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
      style={{ ...StyleSheet.absoluteFillObject, backgroundColor: theme.dark ? "#0f0e10" : "#1a191c", alignItems: "center", justifyContent: "center", padding: 32 }}
    >
      <View style={{ width: "100%", maxWidth: 1100 }}>
        <SlideView slide={slide} index={at} onLink={onLink} big />
      </View>
      <View style={{ position: "absolute", bottom: 18, flexDirection: "row", alignItems: "center", gap: 14 }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Previous Slide" onPress={() => go(-1)}>
          <Symbol name="chevron.left" size={14} color="#FFFFFF" style={{ width: 20, height: 20 }} />
        </Pressable>
        <Text style={{ color: "#FFFFFF", fontSize: 13 }}>
          {at + 1} / {slides.length}
        </Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Next Slide" onPress={() => go(1)}>
          <Symbol name="chevron.right" size={14} color="#FFFFFF" style={{ width: 20, height: 20 }} />
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="End Presentation" onPress={onClose}>
          <Symbol name="xmark" size={13} color="#FFFFFF" style={{ width: 20, height: 20 }} />
        </Pressable>
      </View>
    </View>
  );
}
