import { ComposerPill, type ComposerPanelAddMenuGroup, type ComposerPanelAttachment } from "@oxy.so/bloom/composer-panel";
import { RiAtLine } from "@oxy.so/bloom/icons/RiAtLine";
import { RiAttachment2 } from "@oxy.so/bloom/icons/RiAttachment2";
import { RiCameraLine } from "@oxy.so/bloom/icons/RiCameraLine";
import { RiGlobalLine } from "@oxy.so/bloom/icons/RiGlobalLine";
import { RiUserLine } from "@oxy.so/bloom/icons/RiUserLine";
import { Symbol } from "@astro-browser/shell";
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { Pressable, ScrollView, Text, TextInput, View, type TextInputKeyPressEvent } from "react-native";
import { removeChatContext, updateWindowChat, useWindowChat, type ChatContextItem } from "../../ai/chat/state";
import { useTheme } from "../../lib/theme";
import { useBrowser } from "../../store/browser";
import { activeTabId } from "../../store/model";
import { Favicon } from "../primitives";
import { mentionCandidates, type MentionCandidate } from "./mentions";
import { POWER_LEVEL_OPTIONS } from "./powerLevels";

export type ComposerAction = "files" | "screenshot" | "mention" | "currentTab" | "personalization";

const MENTION = /(^|\s)@([^\s@]*)$/;

export function ChatComposer({
  windowId,
  busy,
  disabled,
  powerLevel,
  personalization,
  inputRef,
  onSubmit,
  onStop,
  onAction,
  onPickMention,
  onPowerLevel,
}: {
  windowId: string;
  busy: boolean;
  disabled: boolean;
  powerLevel: string;
  personalization: boolean | null;
  inputRef: RefObject<TextInput | null>;
  onSubmit: (text: string) => void;
  onStop: () => void;
  onAction: (action: ComposerAction) => void;
  onPickMention: (candidate: MentionCandidate) => void;
  onPowerLevel: (level: string) => void;
}) {
  const draft = useWindowChat(windowId, (c) => c.draft);
  const context = useWindowChat(windowId, (c) => c.context);
  const currentTab = useWindowChat(windowId, (c) => c.currentTab);
  const onWebTab = useBrowser((s) => {
    const id = activeTabId(s, windowId);
    return currentTab && !!id && /^(https?|file):/i.test(s.tabs[id]?.url ?? "");
  });
  const mention = MENTION.exec(draft);
  const query = mention?.[2] ?? null;
  const candidates = useMentionCandidates(windowId, query);
  const [highlight, setHighlight] = useState(0);
  useEffect(() => setHighlight(0), [query]);

  const attachments: ComposerPanelAttachment[] = context.flatMap((item): ComposerPanelAttachment[] => {
    if (item.kind === "file")
      return [{ id: item.id, name: item.name, kind: kindOf(item.mime, item.name), ...(item.mime.startsWith("image/") ? { src: item.uri } : {}) }];
    if (item.kind === "screenshot") return [{ id: item.id, name: `Screenshot of ${item.title || item.url}`, kind: "image", src: item.uri }];
    return [];
  });

  const addMenu: ComposerPanelAddMenuGroup[] = [
    {
      label: "Add",
      rows: [
        { id: "mention", label: "Tabs…", description: "Type @ to mention a tab", icon: RiAtLine },
        { id: "files", label: "Files…", icon: RiAttachment2 },
        { id: "screenshot", label: "Screenshot of This Tab", icon: RiCameraLine },
      ],
    },
    {
      label: "Context",
      rows: [
        { id: "currentTab", label: "Include Current Tab", icon: RiGlobalLine, checked: currentTab },
        ...(personalization === null
          ? []
          : [{ id: "personalization", label: "Personalization", description: "Use what Alia knows about you", icon: RiUserLine, checked: personalization }]),
      ],
    },
  ];

  const pick = (candidate: MentionCandidate) => {
    const next = draft.replace(MENTION, (_, lead: string) => lead);
    updateWindowChat(windowId, { draft: next });
    onPickMention(candidate);
  };

  const onKeyPress = (event: TextInputKeyPressEvent) => {
    if (!candidates.length || query === null) return;
    const key = event.nativeEvent.key;
    if (key === "ArrowDown" || key === "ArrowUp") {
      event.preventDefault();
      setHighlight((i) => (i + (key === "ArrowDown" ? 1 : candidates.length - 1)) % candidates.length);
    } else if (key === "Enter" || key === "Tab") {
      event.preventDefault();
      const chosen = candidates[Math.min(highlight, candidates.length - 1)];
      if (chosen) pick(chosen);
    } else if (key === "Escape") {
      event.preventDefault();
      updateWindowChat(windowId, { draft: draft.replace(/@[^\s@]*$/, "") });
    }
  };

  return (
    <View style={{ gap: 6, paddingHorizontal: 10, paddingBottom: 10 }}>
      {query !== null && candidates.length > 0 && <MentionList candidates={candidates} highlight={highlight} onPick={pick} />}
      <ContextChips windowId={windowId} />
      <ComposerPill
        value={draft}
        onValueChange={(value) => updateWindowChat(windowId, { draft: value })}
        onSubmit={(value) => {
          if (query !== null && candidates.length) return;
          onSubmit(value);
        }}
        onStop={onStop}
        busy={busy}
        disabled={disabled}
        placeholder={onWebTab ? "Ask about this tab, or anything" : "Ask anything"}
        compactPlaceholder="Ask anything"
        addMenu={addMenu}
        onAddMenuSelect={(id) => onAction(id as ComposerAction)}
        permissions={POWER_LEVEL_OPTIONS}
        permission={powerLevel}
        onPermissionChange={onPowerLevel}
        showVoice={false}
        attachments={attachments}
        onRemoveAttachment={(id) => removeChatContext(windowId, id)}
        maxLines={10}
        onKeyPress={onKeyPress}
        inputRef={inputRef as never}
        labels={{ permissions: "Power Level", permissionMode: "Power level" }}
      />
    </View>
  );
}

function kindOf(mime: string, name: string): ComposerPanelAttachment["kind"] {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (/sheet|excel|csv/.test(mime) || /\.(xlsx?|csv)$/i.test(name)) return "spreadsheet";
  if (/presentation|powerpoint/.test(mime) || /\.pptx?$/i.test(name)) return "presentation";
  if (/^text\//.test(mime) || /json|xml|javascript/.test(mime)) return "code";
  return "document";
}

function useMentionCandidates(windowId: string, query: string | null): MentionCandidate[] {
  const tabs = useBrowser((s) => s.tabs);
  const groups = useBrowser((s) => s.groups);
  const order = useBrowser((s) => s.windows[windowId]?.tabIds);
  return useMemo(() => (query === null ? [] : mentionCandidates(useBrowser.getState(), windowId, query)), [tabs, groups, order, windowId, query]);
}

function MentionList({ candidates, highlight, onPick }: { candidates: MentionCandidate[]; highlight: number; onPick: (candidate: MentionCandidate) => void }) {
  const theme = useTheme();
  return (
    <View
      style={{
        maxHeight: 248,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: theme.dark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)",
        backgroundColor: theme.dark ? "rgba(36,34,35,0.98)" : "rgba(255,255,255,0.98)",
        boxShadow: theme.dark ? "0 10px 30px rgba(0,0,0,0.5)" : "0 10px 30px rgba(0,0,0,0.12)",
        overflow: "hidden",
      }}
    >
      <ScrollView contentContainerStyle={{ padding: 4 }} keyboardShouldPersistTaps="always">
        {candidates.map((candidate, i) => (
          <Pressable
            key={candidate.key}
            accessibilityRole="button"
            onPress={() => onPick(candidate)}
            style={{
              height: 32,
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              paddingHorizontal: 8,
              borderRadius: 8,
              backgroundColor: i === highlight ? (theme.dark ? "rgba(255,255,255,0.09)" : "rgba(0,0,0,0.06)") : undefined,
            }}
          >
            {candidate.kind === "group" ? (
              <Symbol name="square.stack" size={12} color={theme.icon} style={{ width: 16, height: 16 }} />
            ) : (
              <Favicon url={candidate.url} favicon={candidate.favicon} size={16} />
            )}
            <Text numberOfLines={1} style={{ flex: 1, fontSize: 13, color: theme.textPrimary }}>
              {candidate.title}
            </Text>
            {candidate.kind === "group" && <Text style={{ fontSize: 12, color: theme.textSecondary }}>{candidate.count} tabs</Text>}
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

function ContextChips({ windowId }: { windowId: string }) {
  const theme = useTheme();
  const context = useWindowChat(windowId, (c) => c.context);
  const currentTab = useWindowChat(windowId, (c) => c.currentTab);
  const activeId = useBrowser((s) => activeTabId(s, windowId));
  const active = useBrowser((s) => (activeId ? s.tabs[activeId] : undefined));
  const showCurrent = currentTab && !!active?.url && /^(https?|file):/i.test(active.url);
  const chips = context.filter((item) => item.kind !== "file" && item.kind !== "screenshot");
  if (!showCurrent && !chips.length) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingHorizontal: 2 }}>
      {showCurrent && active && (
        <Chip
          icon={<Favicon url={active.url} favicon={active.favicon} size={12} />}
          label={active.customTitle || active.title || active.url}
          hint="Current tab"
          onRemove={() => updateWindowChat(windowId, { currentTab: false })}
        />
      )}
      {chips.map((item) => (
        <Chip key={item.id} icon={chipIcon(item, theme.icon)} label={chipLabel(item)} onRemove={() => removeChatContext(windowId, item.id)} />
      ))}
    </ScrollView>
  );
}

function chipIcon(item: ChatContextItem, color: string) {
  switch (item.kind) {
    case "tab":
      return <Favicon url={item.url} favicon={item.favicon} size={12} />;
    case "group":
      return <Symbol name="square.stack" size={10} color={color} style={{ width: 12, height: 12 }} />;
    case "selection":
      return <Symbol name="text.alignleft" size={10} color={color} style={{ width: 12, height: 12 }} />;
    case "link":
      return <Favicon url={item.url} size={12} />;
    default:
      return null;
  }
}

function chipLabel(item: ChatContextItem): string {
  switch (item.kind) {
    case "tab":
      return item.title || item.url;
    case "group":
      return `${item.title} · ${item.tabs.length} tabs`;
    case "selection":
      return `“${item.text.replace(/\s+/g, " ").slice(0, 60)}${item.text.length > 60 ? "…" : ""}”`;
    case "link":
      return item.url.replace(/^https?:\/\/(www\.)?/, "");
    default:
      return "";
  }
}

function Chip({ icon, label, hint, onRemove }: { icon: React.ReactNode; label: string; hint?: string; onRemove: () => void }) {
  const theme = useTheme();
  return (
    <View
      tooltip={hint}
      style={{
        height: 24,
        maxWidth: 220,
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        paddingLeft: 7,
        paddingRight: 3,
        borderRadius: 8,
        backgroundColor: theme.dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)",
      }}
    >
      {icon}
      <Text numberOfLines={1} style={{ fontSize: 12, color: theme.textPrimary, flexShrink: 1 }}>
        {label}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Remove ${label}`}
        onPress={onRemove}
        style={{ width: 18, height: 18, alignItems: "center", justifyContent: "center", borderRadius: 5 }}
      >
        <Symbol name="xmark" size={8} weight="semibold" color={theme.textSecondary} style={{ width: 12, height: 12 }} />
      </Pressable>
    </View>
  );
}
