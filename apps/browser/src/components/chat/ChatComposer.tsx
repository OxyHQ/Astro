import { ComposerBanner, SuggestionList, type ChatComposerSuggestion } from "@oxy.so/bloom/chat-composer";
import { Chip, ChipRow } from "@oxy.so/bloom/chip";
import { RiLockLine } from "@oxy.so/bloom/icons/RiLockLine";
import { chatKey } from "../../ai/chat/approvals";
import { shareInChat, shareStateOf, useShareConsent } from "../../ai/safety/consent";
import { useContentPolicy } from "../../ai/safety/policy";
import { ComposerLoader } from "@oxy.so/bloom/composer-loader";
import { ComposerPill, type ComposerPanelAddMenuGroup, type ComposerPanelAttachment } from "@oxy.so/bloom/composer-panel";
import { RiAtLine } from "@oxy.so/bloom/icons/RiAtLine";
import { RiAttachment2 } from "@oxy.so/bloom/icons/RiAttachment2";
import { RiCameraLine } from "@oxy.so/bloom/icons/RiCameraLine";
import { RiCheckboxCircleLine } from "@oxy.so/bloom/icons/RiCheckboxCircleLine";
import { RiCropLine } from "@oxy.so/bloom/icons/RiCropLine";
import { RiDoubleQuotesL } from "@oxy.so/bloom/icons/RiDoubleQuotesL";
import { RiFileImageLine } from "@oxy.so/bloom/icons/RiFileImageLine";
import { RiGlobalLine } from "@oxy.so/bloom/icons/RiGlobalLine";
import { RiSearchLine } from "@oxy.so/bloom/icons/RiSearchLine";
import { RiSparklingLine } from "@oxy.so/bloom/icons/RiSparklingLine";
import { RiStackLine } from "@oxy.so/bloom/icons/RiStackLine";
import { RiSunLine } from "@oxy.so/bloom/icons/RiSunLine";
import { RiTeamLine } from "@oxy.so/bloom/icons/RiTeamLine";
import { RiUserLine } from "@oxy.so/bloom/icons/RiUserLine";
import { Text } from "@oxy.so/bloom/typography";
import { useEffect, useMemo, useState, type ReactNode, type RefObject } from "react";
import { View, type TextInput, type TextInputKeyPressEvent } from "react-native";
import { addChatContext, chatItemId, removeChatContext, updateWindowChat, useWindowChat, type ChatContextItem } from "../../ai/chat/state";
import { refreshSkills, SLASH, slashCandidates, useSkills, type AstroCommand, type SlashCandidate } from "../../ai/skills/skills";
import { useBrowser } from "../../store/browser";
import { activeTabId } from "../../store/model";
import { Favicon } from "../primitives";
import { mentionCandidates, type MentionCandidate } from "./mentions";
import { fullPageCaptureSupported } from "./capture";
import { POWER_LEVEL_OPTIONS } from "./powerLevels";

export type ComposerAction = "files" | "screenshot" | "screenshotArea" | "screenshotFullPage" | "mention" | "currentTab" | "personalization";

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
  editing,
  onCancelEdit,
  question,
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
  editing: boolean;
  onCancelEdit: () => void;
  question?: ReactNode;
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
  const slash = query === null ? SLASH.exec(draft) : null;
  const slashQuery = slash?.[2] ?? null;
  const skills = useSlashCandidates(slashQuery);
  const [highlight, setHighlight] = useState(0);
  useEffect(() => setHighlight(0), [query, slashQuery]);
  useEffect(() => {
    if (slashQuery !== null) void refreshSkills();
  }, [slashQuery !== null]);

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
        { id: "screenshotArea", label: "Capture Area…", description: "Drag over the page", icon: RiCropLine },
        ...(fullPageCaptureSupported(windowId) ? [{ id: "screenshotFullPage", label: "Screenshot of Full Page", icon: RiFileImageLine }] : []),
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

  const pickSkill = (candidate: SlashCandidate) => {
    updateWindowChat(windowId, { draft: draft.replace(SLASH, (_, lead: string) => lead) });
    addChatContext(windowId, [
      { id: chatItemId("skill"), kind: "skill", name: candidate.name, title: candidate.title, ...(candidate.kind === "command" ? { command: candidate.command } : {}) },
    ]);
  };

  const onKeyPress = (event: TextInputKeyPressEvent) => {
    if (slashQuery !== null && skills.length) {
      const key = event.nativeEvent.key;
      if (key === "ArrowDown" || key === "ArrowUp") {
        event.preventDefault();
        setHighlight((i) => (i + (key === "ArrowDown" ? 1 : skills.length - 1)) % skills.length);
      } else if (key === "Enter" || key === "Tab") {
        event.preventDefault();
        const chosen = skills[Math.min(highlight, skills.length - 1)];
        if (chosen) pickSkill(chosen);
      } else if (key === "Escape") {
        event.preventDefault();
        updateWindowChat(windowId, { draft: draft.replace(/\/[a-z0-9-]*$/, "") });
      }
      return;
    }
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

  const listing = query !== null && candidates.length > 0 ? "mention" : slashQuery !== null && skills.length > 0 ? "command" : null;
  const suggestions = useMemo<ChatComposerSuggestion[]>(
    () => (listing === "mention" ? candidates.map(mentionSuggestion) : listing === "command" ? skills.map(slashSuggestion) : []),
    [listing, candidates, skills],
  );

  return (
    <View style={{ gap: 8 }}>
      {question}
      {editing && <ComposerBanner kind="edit" title="Editing your message" preview={draft} onClose={onCancelEdit} closeLabel="Cancel editing" />}
      {listing && (
        <SuggestionList
          kind={listing}
          header={listing === "command" ? "Skills" : undefined}
          suggestions={suggestions}
          activeIndex={Math.min(highlight, suggestions.length - 1)}
          onActiveIndexChange={setHighlight}
          onSelectSuggestion={(_, index) => {
            if (listing === "mention") {
              const chosen = candidates[index];
              if (chosen) pick(chosen);
            } else {
              const chosen = skills[index];
              if (chosen) pickSkill(chosen);
            }
          }}
          maxHeight={listing === "command" ? 300 : 248}
        />
      )}
      <ContextChips windowId={windowId} />
      <ComposerLoader active={busy}>
        <ComposerPill
          surface={false}
          frosted={busy}
          value={draft}
          onValueChange={(value) => updateWindowChat(windowId, { draft: value })}
          onSubmit={(value) => {
            if (listing) return;
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
      </ComposerLoader>
    </View>
  );
}

const COMMAND_ICONS: Record<AstroCommand, typeof RiSearchLine> = {
  research: RiSearchLine,
  brief: RiSunLine,
  prep: RiTeamLine,
  recap: RiCheckboxCircleLine,
};

function mentionSuggestion(candidate: MentionCandidate): ChatComposerSuggestion {
  if (candidate.kind === "group") return { id: candidate.key, label: candidate.title, description: `${candidate.count} tabs`, icon: RiStackLine };
  return { id: candidate.key, label: candidate.title, leading: <Favicon url={candidate.url} favicon={candidate.favicon} size={16} /> };
}

function slashSuggestion(candidate: SlashCandidate): ChatComposerSuggestion {
  const title = candidate.title && candidate.title !== candidate.name ? candidate.title : undefined;
  const base = { id: candidate.key, label: `/${candidate.name}`, description: candidate.description, ...(title ? { handle: title } : {}) };
  if (candidate.kind === "command") return { ...base, icon: COMMAND_ICONS[candidate.command] };
  const emoji = candidate.icon && !/^[a-z.]+$/i.test(candidate.icon) ? candidate.icon : null;
  return emoji ? { ...base, leading: <Text variant="body-medium">{emoji}</Text> } : { ...base, icon: RiSparklingLine };
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

function useSlashCandidates(query: string | null): SlashCandidate[] {
  const installed = useSkills((s) => s.installed);
  return useMemo(() => (query === null ? [] : slashCandidates(installed, query)), [installed, query]);
}

function ContextChips({ windowId }: { windowId: string }) {
  const context = useWindowChat(windowId, (c) => c.context);
  const currentTab = useWindowChat(windowId, (c) => c.currentTab);
  const activeId = useBrowser((s) => activeTabId(s, windowId));
  const active = useBrowser((s) => (activeId ? s.tabs[activeId] : undefined));
  const showCurrent = currentTab && !!active?.url && /^(https?|file):/i.test(active.url);
  const conversationId = useWindowChat(windowId, (c) => c.conversationId);
  const key = chatKey(windowId, conversationId);
  useShareConsent((s) => s.shared[key]);
  useBrowser((s) => s.settings.aiSharedSites);
  useContentPolicy((s) => s.policy);
  const share = showCurrent && active ? shareStateOf(active.url, key) : null;
  const chips = context.filter((item) => item.kind !== "file" && item.kind !== "screenshot");
  if (!showCurrent && !chips.length) return null;
  const withheld = share?.state === "withheld" || share?.state === "blocked";
  return (
    <ChipRow accessibilityLabel="Context" gap={6}>
      {showCurrent && active && (
        <ContextChip
          icon={withheld ? <RiLockLine /> : <Favicon url={active.url} favicon={active.favicon} size={12} />}
          label={
            share?.state === "blocked"
              ? `${share.sensitivity?.host} · Blocked by your organization`
              : withheld
                ? `${active.customTitle || active.title || active.url} · Not shared`
                : active.customTitle || active.title || active.url
          }
          hint={share?.state === "withheld" ? "Sensitive site: press to share it in this chat" : "Current tab"}
          {...(share?.state === "withheld" && share.sensitivity ? { onPress: () => shareInChat(key, share.sensitivity!.host) } : {})}
          onRemove={() => updateWindowChat(windowId, { currentTab: false })}
        />
      )}
      {chips.map((item) => (
        <ContextChip
          key={item.id}
          icon={chipIcon(item)}
          label={chipLabel(item)}
          {...(item.kind === "skill" ? { hint: item.title } : {})}
          onRemove={() => removeChatContext(windowId, item.id)}
        />
      ))}
    </ChipRow>
  );
}

function chipIcon(item: ChatContextItem): ReactNode {
  switch (item.kind) {
    case "tab":
      return <Favicon url={item.url} favicon={item.favicon} size={12} />;
    case "group":
      return <RiStackLine />;
    case "selection":
      return <RiDoubleQuotesL />;
    case "link":
      return <Favicon url={item.url} size={12} />;
    case "skill":
      return <RiSparklingLine />;
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
    case "skill":
      return `/${item.name}`;
    default:
      return "";
  }
}

function ContextChip({ icon, label, hint, onRemove, onPress }: { icon: ReactNode; label: string; hint?: string; onRemove: () => void; onPress?: () => void }) {
  return (
    <Chip
      size="sm"
      variant="subtle"
      startIcon={icon}
      {...(onPress ? { onPress } : {})}
      onClose={onRemove}
      closeLabel={`Remove ${label}`}
      accessibilityLabel={hint ? `${hint}: ${label}` : label}
      style={{ maxWidth: 220 }}
    >
      {label}
    </Chip>
  );
}
