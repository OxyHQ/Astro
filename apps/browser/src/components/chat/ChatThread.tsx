import { getImagesFromContent, getTextFromContent } from "@alia.onl/sdk/content";
import { englishCopy, extractSources, toolLabel, turnLifecycle, type FailedTurn, type Message, type ToolInvocation } from "@alia.onl/sdk/model";
import { AgentThinking } from "@oxy.so/bloom/agent-thinking";
import { AiChatAssistantMessage, AiChatUserMessage, type AiChatTurnAction } from "@oxy.so/bloom/ai-chat";
import { RiArrowGoForwardLine } from "@oxy.so/bloom/icons/RiArrowGoForwardLine";
import { RiEditLine } from "@oxy.so/bloom/icons/RiEditLine";
import { RiMagicLine } from "@oxy.so/bloom/icons/RiMagicLine";
import { RiRefreshLine } from "@oxy.so/bloom/icons/RiRefreshLine";
import { Markdown } from "@oxy.so/bloom/markdown";
import { copyText, Symbol } from "@astro-browser/shell";
import { memo, useMemo, useRef, type ReactNode } from "react";
import { Image, Pressable, ScrollView, Text, View } from "react-native";
import { useTheme } from "../../lib/theme";
import { Favicon } from "../primitives";
import { ChatChart } from "./ChatChart";
import { renderCodeBlock } from "./ChatCode";
import { chartsOf, isChartTool } from "./charts";
import { artifactsOfTools, type Artifact } from "../../ai/artifacts/artifacts";
import { ArtifactCard } from "../artifacts/ArtifactCard";

export type ThreadActions = {
  openLink: (url: string) => void;
  edit: (message: Message) => void;
  regenerate: (message: Message) => void;
  resume: () => void;
  retry: () => void;
  saveAsSkill?: (message: Message) => void;
  openArtifact?: (artifact: Artifact) => void;
};

const textOf = (message: Message) => getTextFromContent(message.content as never);

function filesOf(message: Message): string[] {
  if (!Array.isArray(message.content)) return [];
  return message.content.flatMap((part) => {
    if (part.type !== "file") return [];
    const file = (part as { file?: { filename?: unknown } }).file;
    return typeof file?.filename === "string" ? [file.filename] : [];
  });
}

const RUNNING = new Set(["partial-call", "call"]);

const HOST_STEPS: Record<string, string> = {
  read_tab: "Reading a tab",
  open_tabs: "Opening tabs",
  switch_to_tab: "Switching tabs",
  close_tabs: "Closing tabs",
};

const stepLabel = (name: string) => {
  const host = /^host_astro__(\w+)$/.exec(name)?.[1];
  return host ? (HOST_STEPS[host] ?? host.replace(/_/g, " ")) : toolLabel(name, englishCopy);
};

function ToolSteps({ tools }: { tools: ToolInvocation[] }) {
  const theme = useTheme();
  if (!tools.length) return null;
  return (
    <View style={{ gap: 4 }}>
      {tools.map((tool) => (
        <View key={tool.toolCallId} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: RUNNING.has(tool.state) ? theme.accent : theme.textSecondary }} />
          <Text numberOfLines={1} style={{ fontSize: 12, color: theme.textSecondary, flexShrink: 1 }}>
            {stepLabel(tool.toolName)}
            {RUNNING.has(tool.state) ? "…" : ""}
          </Text>
        </View>
      ))}
    </View>
  );
}

function Sources({ tools, openLink }: { tools: ToolInvocation[]; openLink: (url: string) => void }) {
  const theme = useTheme();
  const sources = useMemo(() => extractSources(tools).slice(0, 8), [tools]);
  if (!sources.length) return null;
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
      {sources.map((source) => (
        <Pressable
          key={source.url}
          onPress={() => openLink(source.url)}
          accessibilityRole="link"
          accessibilityLabel={source.title || source.domain}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 5,
            maxWidth: 200,
            height: 24,
            paddingHorizontal: 7,
            borderRadius: 8,
            backgroundColor: theme.dark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.05)",
          }}
        >
          <Favicon url={source.url} size={12} />
          <Text numberOfLines={1} style={{ fontSize: 12, color: theme.textPrimary, flexShrink: 1 }}>
            {source.domain || source.title}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const UserTurn = memo(function UserTurn({ message, actions, busy }: { message: Message; actions: ThreadActions; busy: boolean }) {
  const theme = useTheme();
  const text = textOf(message);
  const images = getImagesFromContent(message.content as never);
  const files = filesOf(message);
  const turnActions: AiChatTurnAction[] = [{ key: "edit", label: "Edit", icon: RiEditLine, onPress: () => actions.edit(message), disabled: busy }];
  if (actions.saveAsSkill && text.trim().length >= 10)
    turnActions.push({ key: "skill", label: "Save as Skill", icon: RiMagicLine, onPress: () => actions.saveAsSkill?.(message) });
  return (
    <AiChatUserMessage animate={!!message.unsaved} actions={turnActions}>
      <View style={{ gap: 6 }}>
        {images.length > 0 && (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {images.map((uri, i) => (
              <Image key={i} source={{ uri }} style={{ width: 72, height: 72, borderRadius: 8 }} />
            ))}
          </View>
        )}
        {files.map((name) => (
          <Text key={name} numberOfLines={1} style={{ fontSize: 12, color: theme.textSecondary }}>
            {name}
          </Text>
        ))}
        {text ? <UserText text={text} /> : null}
      </View>
    </AiChatUserMessage>
  );
});

const LEADING_SKILLS = /^((?:\/[a-z0-9][a-z0-9-]*\s*)+)([\s\S]*)$/;

function UserText({ text }: { text: string }) {
  const theme = useTheme();
  const quoted = text.lastIndexOf("\n\n");
  const tail = quoted >= 0 ? text.slice(quoted + 2) : text;
  const m = LEADING_SKILLS.exec(tail);
  if (!m) return <Text selectable style={{ fontSize: 14, lineHeight: 20, color: theme.textPrimary }}>{text}</Text>;
  const names = m[1]!.trim().split(/\s+/);
  return (
    <View style={{ gap: 6 }}>
      {quoted >= 0 && (
        <Text selectable style={{ fontSize: 14, lineHeight: 20, color: theme.textPrimary }}>
          {text.slice(0, quoted)}
        </Text>
      )}
      <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
        {names.map((name, i) => (
          <View
            key={`${name}-${i}`}
            style={{ flexDirection: "row", alignItems: "center", gap: 4, height: 22, paddingHorizontal: 7, borderRadius: 7, backgroundColor: theme.dark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.06)" }}
          >
            <Symbol name="sparkles" size={10} color={theme.icon} style={{ width: 12, height: 12 }} />
            <Text style={{ fontSize: 12.5, fontWeight: "600", color: theme.textPrimary }}>{name}</Text>
          </View>
        ))}
        {m[2]!.trim() ? (
          <Text selectable style={{ fontSize: 14, lineHeight: 20, color: theme.textPrimary }}>
            {m[2]!.trim()}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const AssistantTurn = memo(function AssistantTurn({
  message,
  actions,
  isLoading,
  last,
  failedTurn,
}: {
  message: Message;
  actions: ThreadActions;
  isLoading: boolean;
  last: boolean;
  failedTurn: FailedTurn | null;
}) {
  const theme = useTheme();
  const text = textOf(message);
  const lifecycle = turnLifecycle(message, { isLoading, isLastAssistant: last, failedTurn });
  const live = lifecycle === "running" || lifecycle === "queued";
  const tools = message.toolInvocations ?? [];
  const charts = useMemo(() => chartsOf(tools), [tools]);
  const steps = useMemo(() => tools.filter((tool) => !isChartTool(tool)), [tools]);
  const made = useMemo(() => (actions.openArtifact ? artifactsOfTools(tools) : []), [tools, actions.openArtifact]);
  const thinking = message.thinking?.trim() ?? "";
  const failed = lifecycle === "failed";
  const turnActions: AiChatTurnAction[] = [];
  if (!live) turnActions.push({ key: "regenerate", label: "Regenerate", icon: RiRefreshLine, onPress: () => actions.regenerate(message), disabled: isLoading });
  if (lifecycle === "cancelled" && last)
    turnActions.push({ key: "resume", label: "Resume", icon: RiArrowGoForwardLine, onPress: actions.resume, disabled: isLoading });
  return (
    <AiChatAssistantMessage
      animate={!!message.unsaved}
      feedback={!live && !!text}
      feedbackProps={{
        onCopy: () => {
          void copyText(text);
          return true;
        },
        actions: turnActions,
      }}
    >
      {(thinking || (live && !text)) && (
        <AgentThinking
          variant="wave"
          label={live && !text ? (tools.length ? "Working" : "Thinking") : "Thought process"}
          thinking={live && !text}
          showTimer={live && !text}
          shimmer={live && !text}
          tone="subtle"
          defaultOpen={false}
        >
          {thinking ? (
            <Text selectable style={{ fontSize: 13, lineHeight: 19, color: theme.textSecondary }}>
              {thinking}
            </Text>
          ) : null}
        </AgentThinking>
      )}
      {steps.length > 0 && <ToolSteps tools={steps} />}
      {text ? (
        <Markdown streaming={live} onLinkPress={actions.openLink} renderCodeBlock={renderCodeBlock}>
          {text}
        </Markdown>
      ) : null}
      {charts.map((chart) => (
        <ChatChart key={chart.id} chart={chart} />
      ))}
      {made.map((artifact) => (
        <ArtifactCard key={artifact.id} artifact={artifact} onOpen={() => actions.openArtifact?.(artifact)} />
      ))}
      <Sources tools={tools} openLink={actions.openLink} />
      {lifecycle === "cancelled" && <Text style={{ fontSize: 12, color: theme.textSecondary }}>Stopped</Text>}
      {failed && <FailedRow failedTurn={failedTurn} onRetry={actions.retry} />}
    </AiChatAssistantMessage>
  );
});

function FailedRow({ failedTurn, onRetry }: { failedTurn: FailedTurn | null; onRetry: () => void }) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
      <Text style={{ fontSize: 13, color: theme.textSecondary, flexShrink: 1 }}>
        {failedTurn?.detail || (failedTurn?.partial ? "The answer was cut short." : "Alia couldn't answer that.")}
      </Text>
      {failedTurn?.retryable !== false && (
        <Pressable accessibilityRole="button" onPress={onRetry}>
          <Text style={{ fontSize: 13, fontWeight: "600", color: theme.accent }}>Try Again</Text>
        </Pressable>
      )}
    </View>
  );
}

export function ChatThreadView({
  messages,
  isLoading,
  failedTurn,
  actions,
  empty,
}: {
  messages: Message[];
  isLoading: boolean;
  failedTurn: FailedTurn | null;
  actions: ThreadActions;
  empty: React.ReactNode;
}) {
  const shown = messages.filter((m) => m.role !== "system");
  const lastAssistant = [...shown].reverse().find((m) => m.role === "assistant");
  const orphan = failedTurn && !shown.some((m) => m.id === failedTurn.anchorMessageId && m.role === "assistant");
  if (!shown.length) return <View style={{ flex: 1 }}>{empty}</View>;
  return (
    <FollowingScroll>
      {shown.map((message) =>
        message.role === "user" ? (
          <View key={message.id} style={{ gap: 8 }}>
            <UserTurn message={message} actions={actions} busy={isLoading} />
            {orphan && failedTurn.anchorMessageId === message.id && <FailedRow failedTurn={failedTurn} onRetry={actions.retry} />}
          </View>
        ) : (
          <AssistantTurn key={message.id} message={message} actions={actions} isLoading={isLoading} last={message === lastAssistant} failedTurn={failedTurn} />
        ),
      )}
    </FollowingScroll>
  );
}

const AT_BOTTOM = 48;

function FollowingScroll({ children }: { children: ReactNode }) {
  const ref = useRef<ScrollView>(null);
  const atBottom = useRef(true);
  return (
    <ScrollView
      ref={ref}
      style={{ flex: 1 }}
      contentContainerStyle={{ minHeight: "100%", justifyContent: "flex-end", paddingHorizontal: 14, paddingTop: 8, paddingBottom: 12, gap: 14 }}
      scrollEventThrottle={32}
      onScroll={(e) => {
        const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
        atBottom.current = contentOffset.y + layoutMeasurement.height >= contentSize.height - AT_BOTTOM;
      }}
      onContentSizeChange={() => {
        if (atBottom.current) ref.current?.scrollToEnd({ animated: false });
      }}
    >
      {children}
    </ScrollView>
  );
}
