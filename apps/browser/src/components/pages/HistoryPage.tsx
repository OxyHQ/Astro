import { cleanUrl } from "@astro-browser/core";
import { confirm, ContextMenuArea, copyText, MouseArea, showMenu, Symbol } from "@astro-browser/shell";
import { memo, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { markHoverProps } from "../../lib/hoverShift";
import { useTheme } from "../../lib/theme";
import { useBrowser } from "../../store/browser";
import type { HistoryEntry } from "../../store/types";
import { openModeFor, openUrl } from "../bookmarks/actions";
import { HoverSlot } from "../HoverSlot";
import { Favicon, IconButton } from "../primitives";
import { Button, Checkbox, useFormColors } from "../settings/controls";
import { DATE_RANGES, dateInQuery, inSpan, intersect, rangeSpan, type DateRange, type Span } from "../../ai/library/library";
import { ClearDataDialog, useClearDataRequest } from "./ClearDataDialog";
import { HistoryChats } from "./HistoryChats";
import { dayLabel, dayStart, EmptyState, hostLabel, PAGE_WIDTH, PageHeader, queryWords, searchText, timeLabel } from "./PageLayout";

const ROW = 38;
const HEADER = 44;
const NO_HISTORY: HistoryEntry[] = [];
const SCROLL_SETTLE_MS = 150;
let lastScrollAt = 0;

type Day = { label: string; offset: number };
type Row = { entry: HistoryEntry; day: number; first: boolean; last: boolean; offset: number };
type Layout = { days: Day[]; rows: Row[]; height: number };

const searchTexts = new WeakMap<HistoryEntry, string>();
function searchTextOf(entry: HistoryEntry) {
  let text = searchTexts.get(entry);
  if (text === undefined) searchTexts.set(entry, (text = searchText(entry.title, entry.url)));
  return text;
}

function layoutHistory(history: HistoryEntry[], query: string, span: Span | null): Layout {
  const words = queryWords(query);
  const days: Day[] = [];
  const rows: Row[] = [];
  let offset = 0;
  let from = Infinity;
  let to = -Infinity;
  for (const entry of history) {
    if (!inSpan(entry.lastVisit, span)) continue;
    if (words.length) {
      const text = searchTextOf(entry);
      if (!words.every((w) => text.includes(w))) continue;
    }
    const first = entry.lastVisit < from || entry.lastVisit >= to;
    if (first) {
      from = dayStart(entry.lastVisit);
      const d = new Date(from);
      to = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime();
      if (rows.length) rows[rows.length - 1]!.last = true;
      days.push({ label: dayLabel(from), offset });
      offset += HEADER;
    }
    rows.push({ entry, day: days.length - 1, first, last: false, offset });
    offset += ROW;
  }
  if (rows.length) rows[rows.length - 1]!.last = true;
  return { days, rows, height: offset };
}

function assignSlots(keys: string[], previous: Map<string, number>) {
  const next = new Map<string, number>();
  const taken = new Set<number>();
  for (const key of keys) {
    const slot = previous.get(key);
    if (slot !== undefined && slot < keys.length && !taken.has(slot) && !next.has(key)) {
      next.set(key, slot);
      taken.add(slot);
    }
  }
  let free = 0;
  for (const key of keys) {
    if (next.has(key)) continue;
    while (taken.has(free)) free++;
    next.set(key, free);
    taken.add(free);
  }
  return next;
}

function rowAt(rows: Row[], y: number) {
  let lo = 0;
  let hi = rows.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (rows[mid]!.offset + ROW > y) hi = mid;
    else lo = mid + 1;
  }
  return lo;
}

export function HistoryPage({ tabId, profileId, initialQuery }: { tabId: string; profileId: string; initialQuery: string }) {
  const theme = useTheme();
  const windowId = useBrowser((s) => s.tabs[tabId]?.windowId ?? "");
  const history = useBrowser((s) => s.history[profileId] ?? NO_HISTORY);
  const [query, setQuery] = useState(initialQuery);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [clearOpen, setClearOpen] = useState(false);
  const [range, setRange] = useState<DateRange>("any");
  const lastClicked = useRef<string | null>(null);

  const clearRequest = useClearDataRequest((r) => r.windowId);
  const activeHere = useBrowser((s) => s.windows[windowId]?.activeTabIds[s.windows[windowId]!.profileId] === tabId);
  useEffect(() => {
    if (clearRequest === windowId && activeHere) {
      setClearOpen(true);
      useClearDataRequest.getState().request(null);
    }
  }, [clearRequest, activeHere]);

  useEffect(() => setQuery(initialQuery), [initialQuery]);

  const search = useMemo(() => {
    const now = Date.now();
    const typed = dateInQuery(query, now);
    return { text: typed.text, span: intersect(rangeSpan(range, now), typed.span) };
  }, [query, range]);
  const layout = useMemo(() => layoutHistory(history, search.text, search.span), [history, search]);
  const latest = useRef({ layout, profileId });
  latest.current = { layout, profileId };

  const toggle = useCallback((url: string, shift: boolean) => {
    const { rows } = latest.current.layout;
    const from = shift && lastClicked.current ? rows.findIndex((r) => r.entry.url === lastClicked.current) : -1;
    setSelected((prev) => {
      const next = new Set(prev);
      if (from >= 0) {
        const to = rows.findIndex((r) => r.entry.url === url);
        const [a, b] = [from, to].sort((x, y) => x - y);
        for (let i = a!; i <= b!; i++) next.add(rows[i]!.entry.url);
      } else if (next.has(url)) next.delete(url);
      else next.add(url);
      return next;
    });
    lastClicked.current = url;
  }, []);
  const moreFromSite = useCallback((url: string) => setQuery(hostLabel(url)), []);
  const remove = useCallback((url: string) => useBrowser.getState().removeHistory(latest.current.profileId, [url]), []);

  const deleteSelected = async () => {
    const { confirmed } = await confirm({
      title: "Remove selected items?",
      message: "Are you sure you want to delete these pages from your history?",
      confirmTitle: "Remove",
      destructive: true,
      windowId,
    });
    if (!confirmed) return;
    useBrowser.getState().removeHistory(profileId, [...selected]);
    setSelected(new Set());
  };

  const actions =
    selected.size > 0 ? (
      <>
        <Text style={{ fontSize: 12, color: theme.textSecondary }}>{`${selected.size} selected`}</Text>
        <Button title="Cancel" onPress={() => setSelected(new Set())} />
        <Button title="Delete" kind="primary" onPress={() => void deleteSelected()} />
      </>
    ) : (
      <Button title="Clear Browsing Data…" onPress={() => setClearOpen(true)} />
    );

  return (
    <View style={{ flex: 1 }}>
      <PageHeader title="History" query={query} onQuery={setQuery} placeholder="Search history, chats and files" actions={actions} />
      <DateFilter range={range} onRange={setRange} />
      <HistoryChats windowId={windowId} text={search.text} span={search.span} query={query} />
      {layout.rows.length === 0 ? (
        <EmptyState
          icon={<Symbol name="clock" size={30} color={theme.textTertiary} style={{ width: 40, height: 40 }} />}
          title={query || search.span ? "No pages match your search" : "Your browsing history appears here"}
        />
      ) : (
        <HistoryList
          layout={layout}
          profileId={profileId}
          windowId={windowId}
          selected={selected}
          onToggle={toggle}
          onMoreFromSite={moreFromSite}
          onRemove={remove}
        />
      )}
      {clearOpen && <ClearDataDialog profileId={profileId} onClose={() => setClearOpen(false)} />}
    </View>
  );
}

function DateFilter({ range, onRange }: { range: DateRange; onRange: (range: DateRange) => void }) {
  const title = DATE_RANGES.find((r) => r.id === range)!.title;
  const pick = async () => {
    const choice = await showMenu(DATE_RANGES.map((r) => ({ id: r.id, title: r.title, checked: r.id === range })));
    const next = DATE_RANGES.find((r) => r.id === choice);
    if (next) onRange(next.id);
  };
  return (
    <View style={{ alignItems: "center" }}>
      <View style={{ width: PAGE_WIDTH, maxWidth: "100%", flexDirection: "row", paddingHorizontal: 28 }}>
        <Button title={title} icon="calendar" onPress={() => void pick()} />
      </View>
    </View>
  );
}

function HistoryList({
  layout,
  profileId,
  windowId,
  selected,
  onToggle,
  onMoreFromSite,
  onRemove,
}: {
  layout: Layout;
  profileId: string;
  windowId: string;
  selected: Set<string>;
  onToggle: (url: string, shift: boolean) => void;
  onMoreFromSite: (url: string) => void;
  onRemove: (url: string) => void;
}) {
  const { rows, days } = layout;
  const [viewport, setViewport] = useState(800);
  const overscan = Math.round(viewport / 2);
  const rowPool = Math.ceil((viewport + 2 * overscan) / ROW) + 1;
  const dayPool = Math.ceil((viewport + 2 * overscan + ROW) / (HEADER + ROW)) + 2;

  const scrollY = useRef(0);
  const [, rerender] = useState(0);
  const band = rowAt(rows, scrollY.current - overscan);
  const rendered = useRef({ rows, overscan, band });
  rendered.current = { rows, overscan, band };
  const [onScroll] = useState(() => (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollY.current = e.nativeEvent.contentOffset.y;
    lastScrollAt = Date.now();
    const { rows, overscan, band } = rendered.current;
    if (rowAt(rows, scrollY.current - overscan) !== band) rerender((n) => n + 1);
  });
  const onLayout = useCallback((e: LayoutChangeEvent) => setViewport(Math.max(ROW, Math.round(e.nativeEvent.layout.height))), []);

  const top = Math.min(band, rows.length - 1);
  const rowCount = Math.min(rowPool, rows.length);
  const firstRow = Math.max(0, Math.min(top, rows.length - rowCount));
  const dayCount = Math.min(dayPool, days.length);
  const firstDay = Math.max(0, Math.min(rows[top]!.day, days.length - dayCount));
  const selecting = selected.size > 0;

  const rowSlots = useRef(new Map<string, number>());
  rowSlots.current = assignSlots(rows.slice(firstRow, firstRow + rowCount).map((r) => r.entry.url), rowSlots.current);

  const slots: ReactNode[] = new Array(dayCount + rowCount);
  for (let i = firstDay; i < firstDay + dayCount; i++) {
    const slot = i % dayPool;
    slots[slot] = <DayHeader key={`d${slot}`} label={days[i]!.label} top={days[i]!.offset} />;
  }
  for (let i = firstRow; i < firstRow + rowCount; i++) {
    const row = rows[i]!;
    const slot = rowSlots.current.get(row.entry.url)!;
    slots[dayCount + slot] = (
      <View key={`r${slot}`} style={{ position: "absolute", top: row.offset, left: 0, right: 0, height: ROW }}>
        <HistoryRow
          entry={row.entry}
          profileId={profileId}
          first={row.first}
          last={row.last}
          selected={selected.has(row.entry.url)}
          selecting={selecting}
          windowId={windowId}
          onToggle={onToggle}
          onMoreFromSite={onMoreFromSite}
          onRemove={onRemove}
        />
      </View>
    );
  }

  return (
    <ScrollView onLayout={onLayout} onScroll={onScroll} scrollEventThrottle={16} contentContainerStyle={{ paddingBottom: 40, alignItems: "center" }}>
      <View style={{ width: PAGE_WIDTH, maxWidth: "100%", height: layout.height }}>{slots}</View>
    </ScrollView>
  );
}

const DayHeader = memo(function DayHeader({ label, top }: { label: string; top: number }) {
  const theme = useTheme();
  return (
    <View style={{ position: "absolute", top, left: 0, right: 0, height: HEADER, justifyContent: "flex-end", paddingBottom: 8, paddingHorizontal: 30 }}>
      <Text style={{ fontSize: 12.5, fontWeight: "600", color: theme.textSecondary }}>{label}</Text>
    </View>
  );
});

const HistoryRow = memo(function HistoryRow({
  entry,
  profileId,
  first,
  last,
  selected,
  selecting,
  windowId,
  onToggle,
  onMoreFromSite,
  onRemove,
}: {
  entry: HistoryEntry;
  profileId: string;
  first: boolean;
  last: boolean;
  selected: boolean;
  selecting: boolean;
  windowId: string;
  onToggle: (url: string, shift: boolean) => void;
  onMoreFromSite: (url: string) => void;
  onRemove: (url: string) => void;
}) {
  const theme = useTheme();
  const colors = useFormColors();
  const url = useRef(entry.url);
  url.current = entry.url;
  const [hoveredUrl, setHoveredUrl] = useState<string | null>(null);
  const [restingUrl, setRestingUrl] = useState<string | null>(null);
  const [hoverProps] = useState(() => {
    let settle: ReturnType<typeof setTimeout> | undefined;
    const rest = (hoveredEntry: string) => {
      const wait = lastScrollAt + SCROLL_SETTLE_MS - Date.now();
      if (wait <= 0) setRestingUrl(hoveredEntry);
      else settle = setTimeout(() => rest(hoveredEntry), wait);
    };
    return markHoverProps({
      onMouseEnter: () => {
        clearTimeout(settle);
        setHoveredUrl(url.current);
        rest(url.current);
      },
      onMouseLeave: () => {
        clearTimeout(settle);
        setHoveredUrl(null);
        setRestingUrl(null);
      },
    });
  });
  const hovered = hoveredUrl === entry.url;
  const [focusedUrl, setFocusedUrl] = useState<string | null>(null);
  const [focusProps] = useState(() => {
    let blurTimer: ReturnType<typeof setTimeout> | undefined;
    return {
      onFocus: () => {
        clearTimeout(blurTimer);
        setFocusedUrl(url.current);
      },
      onBlur: () => {
        clearTimeout(blurTimer);
        blurTimer = setTimeout(() => setFocusedUrl(null), 0);
      },
    };
  });
  const showControls = restingUrl === entry.url || focusedUrl === entry.url;
  const menu = async () => {
    const choice = await showMenu([
      { id: "tab", title: "Open in New Tab" },
      { id: "window", title: "Open in New Window" },
      { id: "incognito", title: "Open in Incognito Window" },
      { separator: true },
      { id: "copy", title: "Copy Link" },
      { id: "more", title: "More from This Site" },
      { separator: true },
      { id: "remove", title: "Remove from History" },
    ]);
    if (choice === "tab") openUrl(entry.url, windowId, "foreground");
    if (choice === "window") openUrl(entry.url, windowId, "window");
    if (choice === "incognito") openUrl(entry.url, windowId, "incognito");
    if (choice === "copy") copyText(cleanUrl(entry.url));
    if (choice === "more") onMoreFromSite(entry.url);
    if (choice === "remove") onRemove(entry.url);
  };
  const r = 10;
  return (
    <View {...hoverProps} {...focusProps} style={{ height: ROW, paddingHorizontal: 16 }}>
      <ContextMenuArea onContextMenu={() => void menu()} style={{ flex: 1 }}>
        <View
          style={{
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 12,
            gap: 12,
            backgroundColor: selected ? colors.selected : hovered ? theme.rowHover : colors.group,
            borderTopLeftRadius: first ? r : 0,
            borderTopRightRadius: first ? r : 0,
            borderBottomLeftRadius: last ? r : 0,
            borderBottomRightRadius: last ? r : 0,
          }}
        >
          <HoverSlot hovered={showControls || selecting} width={14} hover={<Checkbox value={selected} onChange={() => onToggle(entry.url, false)} />} />
          <Text style={{ width: 64, fontSize: 12, color: theme.textSecondary }}>{timeLabel(entry.lastVisit)}</Text>
          <MouseArea style={{ flex: 1 }} onMiddleClick={() => openUrl(entry.url, windowId, "background")}>
            <Pressable
              onPress={(e) => {
                const ev = e.nativeEvent as unknown as { metaKey?: boolean; shiftKey?: boolean; altKey?: boolean };
                if (selecting) return onToggle(entry.url, !!ev.shiftKey);
                openUrl(entry.url, windowId, openModeFor(ev));
              }}
              accessibilityActions={[
                { name: "select", label: selected ? "Deselect" : "Select" },
                { name: "menu", label: "More Actions" },
              ]}
              onAccessibilityAction={(e) => {
                if (e.nativeEvent.actionName === "select") onToggle(entry.url, false);
                if (e.nativeEvent.actionName === "menu") void menu();
              }}
              style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
            >
              <Favicon url={entry.url} favicon={entry.favicon} profileId={profileId} />
              <Text numberOfLines={1} style={{ flexShrink: 1, fontSize: 13, color: theme.textPrimary }}>
                {entry.title || entry.url}
              </Text>
              <Text numberOfLines={1} style={{ flexShrink: 0, maxWidth: 220, fontSize: 12, color: theme.textTertiary }}>
                {hostLabel(entry.url)}
              </Text>
            </Pressable>
          </MouseArea>
          <HoverSlot hovered={showControls} width={26} hover={<IconButton icon="ellipsis" size={13} box={26} radius={6} onPress={() => void menu()} tooltip="More actions" />} />
        </View>
      </ContextMenuArea>
      {!last && <View style={{ position: "absolute", left: 16 + 12, right: 16 + 12, bottom: 0, height: StyleSheet.hairlineWidth * 2, backgroundColor: colors.separator }} />}
    </View>
  );
});
