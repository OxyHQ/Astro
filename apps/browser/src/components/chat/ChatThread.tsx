import { getImagesFromContent, getTextFromContent } from "@alia.onl/sdk/content";
import { englishCopy, extractSources, toolLabel, turnLifecycle, type FailedTurn, type Message, type ToolInvocation } from "@alia.onl/sdk/model";
import { AgentLogToolCall, AgentLogToolCalls } from "@oxy.so/bloom/agent-log";
import { AgentThinking } from "@oxy.so/bloom/agent-thinking";
import { AiChatAssistantMessage, AiChatMessageLine, AiChatThread, AiChatUserMessage, type AiChatTurnAction } from "@oxy.so/bloom/ai-chat";
import { Button } from "@oxy.so/bloom/button";
import { Chip, ChipRow } from "@oxy.so/bloom/chip";
import { RiSparklingLine } from "@oxy.so/bloom/icons/RiSparklingLine";
import { RiArrowGoForwardLine } from "@oxy.so/bloom/icons/RiArrowGoForwardLine";
import { RiEditLine } from "@oxy.so/bloom/icons/RiEditLine";
import { RiMagicLine } from "@oxy.so/bloom/icons/RiMagicLine";
import { RiRefreshLine } from "@oxy.so/bloom/icons/RiRefreshLine";
import { Markdown } from "@oxy.so/bloom/markdown";
import { copyText } from "@astro-browser/shell";
import { memo, useMemo, type ReactNode } from "react";
import { Image, View } from "react-native";
import { Favicon } from "../primitives";
import { ChatChart } from "./ChatChart";
import { renderCodeBlock } from "./ChatCode";
import { chartsOf, isChartTool } from "./charts";
import { artifactsOfTools, type Artifact } from "../../ai/artifacts/artifacts";
import { ArtifactCard } from "../artifacts/ArtifactCard";
import { AGENT_CONTINUE } from "../../ai/agent/session";

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
  page_snapshot: "Reading the page",
  click: "Clicking",
  type_text: "Typing",
  press_key: "Pressing a key",
  scroll: "Scrolling",
  select_option: "Choosing an option",
  navigate: "Going to a page",
  wait_for: "Waiting for the page",
  screenshot: "Looking at the page",
  fill_form: "Filling in a form",
};

const stepLabel = (name: string) => {
  const host = /^host_astro__(\w+)$/.exec(name)?.[1];
  return host ? (HOST_STEPS[host] ?? host.replace(/_/g, " ")) : toolLabel(name, englishCopy);
};

function ToolSteps({ tools }: { tools: ToolInvocation[] }) {
  if (!tools.length) return null;
  return (
    <AgentLogToolCalls accessibilityLabel="Steps">
      {tools.map((tool) => (
        <AgentLogToolCall key={tool.toolCallId} name={tool.toolName} label={stepLabel(tool.toolName)} status={RUNNING.has(tool.state) ? "running" : "done"} />
      ))}
    </AgentLogToolCalls>
  );
}

function Sources({ tools, openLink }: { tools: ToolInvocation[]; openLink: (url: string) => void }) {
  const sources = useMemo(() => extractSources(tools).slice(0, 8), [tools]);
  if (!sources.length) return null;
  return (
    <ChipRow accessibilityLabel="Sources" gap={6}>
      {sources.map((source) => (
        <Chip
          key={source.url}
          size="sm"
          variant="outlined"
          startIcon={<Favicon url={source.url} size={12} />}
          accessibilityLabel={source.title || source.domain}
          onPress={() => openLink(source.url)}
        >
          {source.domain || source.title}
        </Chip>
      ))}
    </ChipRow>
  );
}

const UserTurn = memo(function UserTurn({ message, actions, busy }: { message: Message; actions: ThreadActions; busy: boolean }) {
  const text = textOf(message);
  const images = getImagesFromContent(message.content as never);
  const files = filesOf(message);
  const turnActions: AiChatTurnAction[] = [{ key: "edit", label: "Edit", icon: RiEditLine, onPress: () => actions.edit(message), disabled: busy }];
  if (actions.saveAsSkill && text.trim().length >= 10)
    turnActions.push({ key: "skill", label: "Save as Skill", icon: RiMagicLine, onPress: () => actions.saveAsSkill?.(message) });
  return (
    <AiChatUserMessage animate={!!message.unsaved} actions={turnActions}>
      {images.length > 0 && (
        <AiChatMessageLine block>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {images.map((uri, i) => (
              <Image key={i} source={{ uri }} style={{ width: 72, height: 72, borderRadius: 8 }} />
            ))}
          </View>
        </AiChatMessageLine>
      )}
      {files.map((name) => (
        <AiChatMessageLine key={name} tone="secondary">
          {name}
        </AiChatMessageLine>
      ))}
      {text ? <UserText text={text} /> : null}
    </AiChatUserMessage>
  );
});

const LEADING_SKILLS = /^((?:\/[a-z0-9][a-z0-9-]*\s*)+)([\s\S]*)$/;

function UserText({ text }: { text: string }) {
  const quoted = text.lastIndexOf("\n\n");
  const tail = quoted >= 0 ? text.slice(quoted + 2) : text;
  const m = LEADING_SKILLS.exec(tail);
  if (!m) return <AiChatMessageLine>{text}</AiChatMessageLine>;
  const names = m[1]!.trim().split(/\s+/);
  const rest = m[2]!.trim();
  return (
    <>
      {quoted >= 0 && <AiChatMessageLine>{text.slice(0, quoted)}</AiChatMessageLine>}
      <AiChatMessageLine block>
        <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
          {names.map((name, i) => (
            <Chip key={`${name}-${i}`} size="sm" variant="subtle" startIcon={<RiSparklingLine />}>
              {name}
            </Chip>
          ))}
        </View>
      </AiChatMessageLine>
      {rest ? <AiChatMessageLine>{rest}</AiChatMessageLine> : null}
    </>
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
          {thinking ? <AiChatMessageLine tone="secondary">{thinking}</AiChatMessageLine> : null}
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
      {lifecycle === "cancelled" && (
        <AiChatMessageLine tone="secondary" selectable={false}>
          Stopped
        </AiChatMessageLine>
      )}
      {failed && <FailedRow failedTurn={failedTurn} onRetry={actions.retry} />}
    </AiChatAssistantMessage>
  );
});

function FailedRow({ failedTurn, onRetry }: { failedTurn: FailedTurn | null; onRetry: () => void }) {
  return (
    <AiChatMessageLine block>
      <View accessibilityRole="alert" style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        <AiChatMessageLine tone="secondary" selectable={false} style={{ flexShrink: 1 }}>
          {failedTurn?.detail || (failedTurn?.partial ? "The answer was cut short." : "Alia couldn't answer that.")}
        </AiChatMessageLine>
        {failedTurn?.retryable !== false && (
          <Button size="sm" appearance="subtle" tone="accent" onPress={onRetry}>
            Try Again
          </Button>
        )}
      </View>
    </AiChatMessageLine>
  );
}

const AT_BOTTOM = 48;

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
  empty: ReactNode;
}) {
  const shown = messages.filter((m) => m.role !== "system" && !(m.role === "user" && getTextFromContent(m.content as never).trim() === AGENT_CONTINUE));
  const lastAssistant = [...shown].reverse().find((m) => m.role === "assistant");
  const orphan = failedTurn && !shown.some((m) => m.id === failedTurn.anchorMessageId && m.role === "assistant");
  if (!shown.length) return <>{empty}</>;
  return (
    <AiChatThread followThreshold={AT_BOTTOM}>
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
    </AiChatThread>
  );
}
