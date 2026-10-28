import { Symbol } from "@astro-browser/shell";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useAliaReady } from "../../ai/alia/api";
import { KIND_ICON } from "../../ai/artifacts/artifacts";
import { searchChats, searchFiles, shortDate, type Span } from "../../ai/library/library";
import { openLibraryChat, openLibraryFile } from "../../ai/library/open";
import { refreshLibrary, useLibrary } from "../../ai/library/store";
import { useTheme } from "../../lib/theme";
import { useFormColors } from "../settings/controls";
import { PAGE_WIDTH } from "./PageLayout";
import { openInternalPage } from "./urls";

const SHOWN = 3;
const ROW = 38;

type Row = { key: string; icon: string; title: string; detail: string; at: number; open: () => void };

export function HistoryChats({ windowId, text, span, query }: { windowId: string; text: string; span: Span | null; query: string }) {
  const theme = useTheme();
  const ready = useAliaReady();
  const conversations = useLibrary((s) => s.conversations);
  const index = useLibrary((s) => s.index);
  const scanning = useLibrary((s) => s.scanning);
  const active = !!ready && (!!text || !!span);

  useEffect(() => {
    if (active) void refreshLibrary();
  }, [active]);

  if (!active) return null;
  const now = Date.now();
  const chats = searchChats(conversations, index, text, span);
  const files = searchFiles(conversations, index, text, span);
  if (!chats.length && !files.length) return null;
  const rows: Row[] = [
    ...chats.slice(0, SHOWN).map((c) => ({
      key: `c:${c.id}`,
      icon: "bubble.left",
      title: c.title,
      detail: c.match === "url" ? c.snippet : c.snippet || "Chat",
      at: c.at,
      open: () => openLibraryChat(windowId, c.id),
    })),
    ...files.slice(0, SHOWN).map((f) => ({
      key: `f:${f.conversationId}:${f.id}`,
      icon: KIND_ICON[f.kind],
      title: f.title,
      detail: `${f.detail} · ${f.chatTitle}`,
      at: f.at,
      open: () => openLibraryFile(windowId, f.conversationId, f.id),
    })),
  ];
  const more = chats.length + files.length - rows.length;
  return (
    <View style={{ alignItems: "center" }}>
      <View style={{ width: PAGE_WIDTH, maxWidth: "100%", paddingHorizontal: 16 }}>
        <View style={{ height: 36, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", paddingBottom: 8, paddingHorizontal: 14 }}>
          <Text style={{ fontSize: 12.5, fontWeight: "600", color: theme.textSecondary }}>{`Chats and Files${scanning ? " · searching…" : ""}`}</Text>
          <Pressable accessibilityRole="link" onPress={() => openInternalPage("library", windowId, { query })}>
            <Text style={{ fontSize: 12, color: theme.textSecondary }}>{more > 0 ? `Show All ${chats.length + files.length} in Library` : "Open Library"}</Text>
          </Pressable>
        </View>
        {rows.map((row, i) => (
          <MatchRow key={row.key} row={row} first={i === 0} last={i === rows.length - 1} now={now} />
        ))}
      </View>
    </View>
  );
}

function MatchRow({ row, first, last, now }: { row: Row; first: boolean; last: boolean; now: number }) {
  const theme = useTheme();
  const colors = useFormColors();
  const [hovered, setHovered] = useState(false);
  const r = 10;
  return (
    <View style={{ height: ROW }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open ${row.title}`}
        onPress={row.open}
        onHoverIn={() => setHovered(true)}
        onHoverOut={() => setHovered(false)}
        style={{
          flex: 1,
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 12,
          gap: 12,
          backgroundColor: hovered ? theme.rowHover : colors.group,
          borderTopLeftRadius: first ? r : 0,
          borderTopRightRadius: first ? r : 0,
          borderBottomLeftRadius: last ? r : 0,
          borderBottomRightRadius: last ? r : 0,
        }}
      >
        <View style={{ width: 14 }} />
        <Text style={{ width: 64, fontSize: 12, color: theme.textSecondary }}>{shortDate(row.at, now)}</Text>
        <Symbol name={row.icon} size={13} color={theme.textSecondary} style={{ width: 16, height: 16 }} />
        <Text numberOfLines={1} style={{ flexShrink: 1, fontSize: 13, color: theme.textPrimary }}>
          {row.title}
        </Text>
        <Text numberOfLines={1} style={{ flex: 1, fontSize: 12, color: theme.textTertiary }}>
          {row.detail}
        </Text>
      </Pressable>
      {!last && <View style={{ position: "absolute", left: 12, right: 12, bottom: 0, height: StyleSheet.hairlineWidth * 2, backgroundColor: colors.separator }} />}
    </View>
  );
}
