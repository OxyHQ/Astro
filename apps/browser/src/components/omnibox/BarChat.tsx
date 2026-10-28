import { displayUrl } from "@astro-browser/core";
import { Symbol, pickFiles, showMenu } from "@astro-browser/shell";
import { memo } from "react";
import { Pressable, Text, View } from "react-native";
import { chatItemId, type ChatContextItem } from "../../ai/chat/state";
import { useTheme } from "../../lib/theme";
import { useBrowser } from "../../store/browser";
import { activeTabId, viewTabIds } from "../../store/model";
import { useWindowId } from "../../store/hooks";
import { pickChatFiles } from "../chat/files";
import type { MentionCandidate } from "../chat/mentions";
import { Favicon, IconButton, useHover } from "../primitives";
import { attachmentKey, attachmentLabel, toggleAttachment, type BarDestination } from "./chatBar";
import { switchFromBar } from "./open";

export function MentionIcon({ candidate }: { candidate: MentionCandidate }) {
  const theme = useTheme();
  if (candidate.kind === "tab") return <Favicon url={candidate.url} favicon={candidate.favicon} />;
  return <Symbol name="square.on.square" size={13} color={theme.textSecondary} style={{ width: 16, height: 16 }} />;
}

export const MentionList = memo(function MentionList({
  candidates,
  selectedIndex,
  onPick,
}: {
  candidates: MentionCandidate[];
  selectedIndex: number;
  onPick(candidate: MentionCandidate): void;
}) {
  return (
    <View accessibilityRole="menu" accessibilityLabel="Mention a tab" style={{ paddingHorizontal: 9, paddingBottom: 2 }}>
      {candidates.map((c, i) => (
        <MentionRow key={c.key} candidate={c} selected={i === selectedIndex} onPick={onPick} />
      ))}
    </View>
  );
});

function MentionRow({ candidate, selected, onPick }: { candidate: MentionCandidate; selected: boolean; onPick(c: MentionCandidate): void }) {
  const theme = useTheme();
  const { hovered, hoverProps } = useHover();
  const detail = candidate.kind === "tab" ? displayUrl(candidate.url) : `${candidate.count} tab${candidate.count === 1 ? "" : "s"}`;
  return (
    <View {...hoverProps}>
      <Pressable onPress={() => onPick(candidate)} accessibilityRole="menuitem" accessibilityLabel={candidate.title}>
        <View
          style={{
            height: 35,
            marginVertical: 2.5,
            borderRadius: 11,
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 13,
            gap: 11,
            backgroundColor: selected ? theme.commandBarSelected : hovered ? theme.commandBarHover : undefined,
          }}
        >
          <MentionIcon candidate={candidate} />
          <Text numberOfLines={1} style={{ flexShrink: 1, fontSize: 14, color: theme.textPrimary }}>
            {candidate.title}
            <Text style={{ color: theme.textSecondary }}>
              {" — "}
              {detail}
            </Text>
          </Text>
          <View style={{ flex: 1 }} />
          <Text style={{ fontSize: 12, color: theme.textTertiary }}>Mention</Text>
        </View>
      </Pressable>
    </View>
  );
}

function AttachmentIcon({ item }: { item: ChatContextItem }) {
  const theme = useTheme();
  if (item.kind === "tab") return <Favicon url={item.url} favicon={item.favicon} size={14} />;
  return (
    <Symbol name={item.kind === "group" ? "square.on.square" : "doc"} size={11} color={theme.textSecondary} style={{ width: 14, height: 14 }} />
  );
}

export const AttachmentChips = memo(function AttachmentChips({ items, onRemove }: { items: ChatContextItem[]; onRemove(item: ChatContextItem): void }) {
  if (!items.length) return null;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 1, maxWidth: "60%", overflow: "hidden" }}>
      {items.map((item) => (
        <AttachmentChip key={attachmentKey(item)} item={item} onRemove={onRemove} />
      ))}
    </View>
  );
});

function AttachmentChip({ item, onRemove }: { item: ChatContextItem; onRemove(item: ChatContextItem): void }) {
  const theme = useTheme();
  const label = attachmentLabel(item);
  return (
    <View
      accessibilityLabel={`Attached: ${label}`}
      style={{
        height: 26,
        borderRadius: 13,
        borderWidth: 1,
        borderColor: theme.chipBorder,
        flexDirection: "row",
        alignItems: "center",
        paddingLeft: 7,
        paddingRight: 2,
        gap: 5,
        flexShrink: 1,
        maxWidth: 180,
      }}
    >
      <AttachmentIcon item={item} />
      <Text numberOfLines={1} style={{ flexShrink: 1, fontSize: 12, color: theme.textPrimary }}>
        {label}
      </Text>
      <IconButton icon="xmark" size={8} box={20} radius={10} color={theme.textSecondary} tooltip="Remove" onPress={() => onRemove(item)} />
    </View>
  );
}

export const DestinationToggle = memo(function DestinationToggle({
  engine,
  destination,
  locked,
  onPick,
}: {
  engine: string;
  destination: BarDestination;
  locked: boolean;
  onPick(destination: BarDestination): void;
}) {
  const theme = useTheme();
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel="Send to"
      style={{ height: 28, borderRadius: 14, borderWidth: 1, borderColor: theme.chipBorder, flexDirection: "row", alignItems: "center", padding: 2, marginRight: 6 }}
    >
      <Segment label={engine} icon="magnifyingglass" selected={destination === "search"} disabled={locked} onPress={() => onPick("search")} />
      <Segment label="Chat" icon="sparkles" selected={destination === "chat"} disabled={false} onPress={() => onPick("chat")} />
    </View>
  );
});

function Segment({ label, icon, selected, disabled, onPress }: { label: string; icon: string; selected: boolean; disabled: boolean; onPress(): void }) {
  const theme = useTheme();
  const { hovered, hoverProps } = useHover();
  const color = selected ? theme.textPrimary : disabled ? theme.textTertiary : theme.chipText;
  return (
    <View {...hoverProps}>
      <Pressable onPress={onPress} disabled={disabled} accessibilityRole="radio" accessibilityState={{ checked: selected, disabled }} accessibilityLabel={label}>
        <View
          style={{
            height: 22,
            borderRadius: 11,
            paddingHorizontal: 9,
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
            backgroundColor: selected ? theme.commandBarSelected : hovered && !disabled ? theme.rowHover : undefined,
          }}
        >
          <Symbol name={icon} size={10} weight="medium" color={color} style={{ width: 12, height: 12 }} />
          <Text numberOfLines={1} style={{ fontSize: 12, fontWeight: selected ? "600" : "400", color }}>
            {label}
          </Text>
        </View>
      </Pressable>
    </View>
  );
}

export type AddChipChat = {
  attached: ChatContextItem[];
  onAttach(items: ChatContextItem[]): void;
  holdOpen(hold: boolean): void;
};

export const AddChip = memo(function AddChip({ tabId, onGo, chat }: { tabId: string; onGo(url: string): void; chat: AddChipChat | null }) {
  const theme = useTheme();
  const windowId = useWindowId();
  const { hovered, hoverProps } = useHover();
  const openTabOrFile = async () => {
    const s = useBrowser.getState();
    const active = activeTabId(s, windowId);
    const others = viewTabIds(s, windowId)
      .map((id) => s.tabs[id]!)
      .filter((t) => t.id !== active && t.url)
      .slice(0, 12);
    const choice = await showMenu([
      ...others.map((t) => ({ id: `tab:${t.id}`, title: t.title || displayUrl(t.url) })),
      ...(others.length ? [{ separator: true as const }] : []),
      { id: "files", title: "Open File…", symbol: "doc" },
    ]);
    if (choice?.startsWith("tab:")) switchFromBar(choice.slice(4), "", tabId, "current");
    if (choice === "files") {
      const [file] = await pickFiles();
      if (file) onGo(file);
    }
  };
  const addTabsOrFiles = async (c: AddChipChat) => {
    const s = useBrowser.getState();
    const tabs = viewTabIds(s, windowId)
      .map((id) => s.tabs[id]!)
      .filter((t) => t.url)
      .slice(0, 16);
    const attachedTabs = new Set(c.attached.flatMap((item) => (item.kind === "tab" ? [item.tabId] : [])));
    c.holdOpen(true);
    try {
      const choice = await showMenu([
        { id: "header", title: "Tabs", enabled: false },
        ...tabs.map((t) => ({ id: `tab:${t.id}`, title: t.customTitle || t.title || displayUrl(t.url), checked: attachedTabs.has(t.id) })),
        ...(tabs.length ? [{ separator: true as const }] : []),
        { id: "files", title: "Files…", symbol: "doc" },
      ]);
      if (choice?.startsWith("tab:")) {
        const tab = useBrowser.getState().tabs[choice.slice(4)];
        if (tab)
          c.onAttach(
            toggleAttachment(c.attached, { id: chatItemId("tab"), kind: "tab", tabId: tab.id, title: tab.customTitle || tab.title, url: tab.url, favicon: tab.favicon }),
          );
      }
      if (choice === "files") {
        const files = await pickChatFiles();
        if (files.length) c.onAttach([...c.attached, ...files]);
      }
    } finally {
      c.holdOpen(false);
    }
  };
  const label = chat ? "Add tabs or files" : "Open a tab or file";
  return (
    <View {...hoverProps}>
      <Pressable onPress={() => void (chat ? addTabsOrFiles(chat) : openTabOrFile())} accessibilityRole="button" accessibilityLabel={label}>
        <View
          style={{
            height: chat ? 28 : 32,
            borderRadius: chat ? 14 : 16,
            borderWidth: 1,
            borderColor: theme.chipBorder,
            backgroundColor: hovered ? theme.rowHover : undefined,
            flexDirection: "row",
            alignItems: "center",
            paddingLeft: 9,
            paddingRight: 12,
            gap: 5,
          }}
        >
          <Symbol name={chat ? "plus" : "arrow.up.right"} size={10} weight="medium" color={theme.chipText} style={{ width: 14, height: 14 }} />
          <Text style={{ fontSize: 13, color: theme.chipText }}>{label}</Text>
        </View>
      </Pressable>
    </View>
  );
});
