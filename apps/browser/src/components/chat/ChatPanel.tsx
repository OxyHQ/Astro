import { AliaRuntimeProvider, useConversationThread, type AliaRuntimeHost, type AliaTurnRequest } from "@alia.onl/sdk/runtime";
import type { Message } from "@alia.onl/sdk/model";
import { getTextFromContent } from "@alia.onl/sdk/content";
import { useDeleteConversation } from "@alia.onl/sdk/runtime";
import { AiChatContainer } from "@oxy.so/bloom/ai-chat";
import { AppShell } from "@oxy.so/bloom/app-shell";
import { ButtonGroup, ButtonGroupItem } from "@oxy.so/bloom/button-group";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@oxy.so/bloom/dropdown-menu";
import { EmptyState, type EmptyStateSuggestion } from "@oxy.so/bloom/empty-state";
import { RiAddLine } from "@oxy.so/bloom/icons/RiAddLine";
import { RiCheckboxCircleLine } from "@oxy.so/bloom/icons/RiCheckboxCircleLine";
import { RiCloseLine } from "@oxy.so/bloom/icons/RiCloseLine";
import { RiHistoryLine } from "@oxy.so/bloom/icons/RiHistoryLine";
import { RiLightbulbLine } from "@oxy.so/bloom/icons/RiLightbulbLine";
import { RiMoreFill } from "@oxy.so/bloom/icons/RiMoreFill";
import { RiSparklingLine } from "@oxy.so/bloom/icons/RiSparklingLine";
import { RiSunLine } from "@oxy.so/bloom/icons/RiSunLine";
import { RiTeamLine } from "@oxy.so/bloom/icons/RiTeamLine";
import { RiChat3Line } from "@oxy.so/bloom/icons/RiChat3Line";
import { RiGlobalLine } from "@oxy.so/bloom/icons/RiGlobalLine";
import { PageHeader } from "@oxy.so/bloom/page-header";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PanResponder, View, type TextInput } from "react-native";
import { closeChat, newChat, openChatTab, setChatPlacement, setComposerFocused, showChatConversation, toggleChatHistory } from "../../ai/chat/actions";
import { buildTurnContext, notePdfAttached } from "../../ai/chat/clientContext";
import { astroHostTools, dropApprovals } from "../../ai/chat/hostTools";
import { chatKey } from "../../ai/chat/approvals";
import { AGENT_CONTINUE, endRun, noteContinuation, noteOutput, registerAgentStopper, resetAgentStop, shouldContinue, stopAgent } from "../../ai/agent/session";
import { loadContentPolicy } from "../../ai/safety/policy";
import {
  personalizationOff,
  setPersonalizationOff,
  updateWindowChat,
  useChat,
  useWindowChat,
  windowChat,
  chatItemId,
  type ChatContextItem,
} from "../../ai/chat/state";
import { PROMPT_ACTIONS } from "../../ai/oneShotPrompts";
import { ASTRO_COMMANDS, parseSlash, refreshSkills, useSkills, type AstroCommand } from "../../ai/skills/skills";
import { briefDoneToday, noteCommandSent } from "../../ai/work/briefDay";
import { proactiveCommands, welcomeContext, welcomeSuggestions, type WelcomeSuggestion } from "../../ai/work/suggestions";
import { useCalendar, useNow } from "../../live/calendar";
import { astroCommandTurn } from "../../ai/work/gather";
import { openInternalPage, openSkillsPage } from "../pages/urls";
import { artifactOfTool, rememberArtifacts, rememberLiveArtifact, type Artifact } from "../../ai/artifacts/artifacts";
import { openArtifactTab } from "../artifacts/open";
import { webviews } from "../../lib/webviews";
import { useBrowser } from "../../store/browser";
import { activeTabId } from "../../store/model";
import { ChatComposer, type ComposerAction } from "./ChatComposer";
import { ChatHistory, ASTRO_APP, deleteAllChats, useChatList } from "./ChatHistory";
import { moveFloatingChat } from "./ChatSlots";
import { captureFullPage, startAreaCapture } from "./capture";
import { ChatThreadView, type ThreadActions } from "./ChatThread";
import { ToolApprovals } from "./ToolApproval";
import { pickChatFiles } from "./files";
import type { MentionCandidate } from "./mentions";
import { powerLevelOf } from "./powerLevels";

export type ChatPanelProps = { windowId: string; inTab: boolean; personalizationSupported: boolean; faviconUrl?: (url: string) => string | null };

type Pending =
  | { kind: "send"; id: number; text: string; attachments: SdkAttachment[]; skills: string[]; research: boolean; agentContinue?: boolean }
  | { kind: "regenerate"; id: number; messageId: string }
  | { kind: "edit"; id: number; messageId: string; text: string }
  | { kind: "retry"; id: number };

type PendingInput = Pending extends infer P ? (P extends Pending ? Omit<P, "id"> : never) : never;

type SdkAttachment = { id: string; uri: string; type: "image" | "document"; name: string; size: number; mimeType: string };

let pendingSeq = 0;

const TOOLBAR_GLYPH_CENTER = 21.2;
const PAGE_HEADER_COMPACT_CENTER = 18.4;

const researchTurns = new Set<string>();

export function ChatPanel(props: ChatPanelProps) {
  const { windowId } = props;
  const host = useMemo<AliaRuntimeHost>(
    () => ({
      openConversation: (id) => showChatConversation(windowId, id),
      onTurnEnd: () => void researchTurns.delete(windowId),
      onOutput: () => noteOutput(windowId),
      onToolResult: ({ toolCallId, name, output }) => {
        const conversationId = windowChat(windowId).conversationId;
        const artifact = name ? artifactOfTool({ toolCallId, toolName: name, state: "result", result: output }) : null;
        if (!artifact || !conversationId) return;
        openArtifactTab(windowId, rememberLiveArtifact(conversationId, artifact), { background: false });
      },
      closeConversation: () => newChat(windowId),
      turnRequest: (): AliaTurnRequest => {
        const request: AliaTurnRequest = {};
        if (researchTurns.delete(windowId)) request.deepResearch = true;
        if (personalizationOff(windowChat(windowId).conversationId)) request.personalization = false;
        return request;
      },
      ...(props.faviconUrl ? { faviconUrl: props.faviconUrl } : {}),
    }),
    [windowId, props.faviconUrl],
  );
  return (
    <AliaRuntimeProvider host={host} app={ASTRO_APP}>
      <ChatPanelBody {...props} />
    </AliaRuntimeProvider>
  );
}

function attachmentsOf(items: ChatContextItem[]): SdkAttachment[] {
  return items.flatMap((item): SdkAttachment[] => {
    if (item.kind === "file")
      return [
        { id: item.id, uri: item.uri, type: item.mime.startsWith("image/") ? "image" : "document", name: item.name, size: item.size, mimeType: item.mime },
      ];
    if (item.kind === "screenshot")
      return [{ id: item.id, uri: item.uri, type: "image", name: "screenshot.jpg", size: item.uri.length, mimeType: "image/jpeg" }];
    return [];
  });
}

function quoteOf(items: ChatContextItem[]): string {
  const parts = items.flatMap((item) => {
    if (item.kind === "selection") return [`> ${item.text.trim().replace(/\n/g, "\n> ")}\n— ${item.title || item.url} (${item.url})`];
    if (item.kind === "link") return [item.url];
    return [];
  });
  return parts.join("\n\n");
}

const ONE_SHOT = new Set<ChatContextItem["kind"]>(["file", "screenshot", "selection", "link", "skill"]);

function ChatPanelBody({ windowId, inTab, personalizationSupported }: ChatPanelProps) {
  const conversationId = useWindowChat(windowId, (c) => c.conversationId);
  const history = useWindowChat(windowId, (c) => c.history);
  const placement = useWindowChat(windowId, (c) => c.placement);
  const focusRequest = useWindowChat(windowId, (c) => c.focusRequest);
  const ask = useWindowChat(windowId, (c) => c.ask);
  const powerLevel = powerLevelOf(useBrowser((s) => s.settings.chatPowerLevel));
  const offMap = useChat((s) => s.personalizationOff);
  const newChatPersonal = useWindowChat(windowId, (c) => c.personal);
  const personal = conversationId ? !offMap[conversationId] : newChatPersonal;
  const [clientContext, setClientContext] = useState<string | undefined>(undefined);
  const [pending, setPending] = useState<Pending | null>(null);
  const [preparing, setPreparing] = useState(false);
  const inputRef = useRef<TextInput | null>(null);

  const hostTools = useMemo(() => astroHostTools(windowId), [windowId]);
  const thread = useConversationThread({ conversationId: conversationId ?? undefined, model: powerLevel, clientContext, hostTools });
  const busy = thread.isLoading || preparing;
  const title = thread.conversation?.title && thread.messages.length ? thread.conversation.title : "New Chat";

  useEffect(() => {
    void refreshSkills();
    void loadContentPolicy();
  }, []);

  useEffect(() => registerAgentStopper(windowId, () => void thread.stopGeneration()), [windowId, thread.stopGeneration]);

  const wasLoading = useRef(false);
  useEffect(() => {
    const ended = wasLoading.current && !thread.isLoading;
    wasLoading.current = thread.isLoading;
    if (!ended) return;
    dropApprovals(windowId);
    const last = [...thread.messages].reverse().find((m) => m.role === "assistant");
    if (shouldContinue(windowId, last?.turnOutcome)) {
      noteContinuation(windowId);
      void prepare({ kind: "send", text: AGENT_CONTINUE, attachments: [], skills: [], research: false, agentContinue: true });
    } else endRun(windowId);
  }, [thread.isLoading]);

  useEffect(() => {
    if (thread.conversationId && !thread.conversationLoading) rememberArtifacts(thread.conversationId, thread.messages);
  }, [thread.messages, thread.conversationId, thread.conversationLoading]);

  useEffect(() => {
    if (!focusRequest) return;
    const timer = setTimeout(() => inputRef.current?.focus(), 30);
    return () => clearTimeout(timer);
  }, [focusRequest]);

  const prepare = useCallback(
    async (next: PendingInput, extra: string[] = []) => {
      setPreparing(true);
      try {
        const context = await buildTurnContext(windowId, extra);
        setClientContext(context.text);
        const key = chatKey(windowId, windowChat(windowId).conversationId);
        const pdfs: SdkAttachment[] =
          next.kind === "send"
            ? context.pdfs.map((pdf) => {
                notePdfAttached(key, pdf.url);
                return { id: chatItemId("file"), uri: `data:application/pdf;base64,${pdf.data}`, type: "document", name: pdf.name, size: pdf.size, mimeType: "application/pdf" };
              })
            : [];
        setPending({ ...next, ...(next.kind === "send" ? { attachments: [...next.attachments, ...pdfs] } : {}), id: ++pendingSeq } as Pending);
      } finally {
        setPreparing(false);
      }
    },
    [windowId],
  );

  useEffect(() => {
    if (!pending) return;
    setPending(null);
    switch (pending.kind) {
      case "send": {
        const options = pending.skills.length ? { skillNames: pending.skills } : undefined;
        if (pending.research) researchTurns.add(windowId);
        if (thread.conversationId) void thread.sendMessage(pending.text, pending.attachments, options);
        else void thread.createNewConversation(pending.text, pending.attachments, options);
        return;
      }
      case "regenerate":
        return void thread.regenerateMessage(pending.messageId);
      case "edit":
        return void thread.editMessage(pending.messageId, pending.text);
      case "retry":
        return void thread.retryFailedTurn();
    }
  }, [pending]);

  const send = useCallback(
    (raw: string, extra: ChatContextItem[] = [], extraContext: string[] = []) => {
      const chat = windowChat(windowId);
      const typed = parseSlash(raw, useSkills.getState().installed);
      const slashItem: ChatContextItem[] = typed
        ? [
            {
              id: chatItemId("skill"),
              kind: "skill",
              name: typed.candidate.name,
              title: typed.candidate.title,
              ...(typed.candidate.kind === "command" ? { command: typed.candidate.command } : {}),
            },
          ]
        : [];
      const items = [...chat.context, ...extra, ...slashItem];
      const words = typed ? typed.rest : raw.trim();
      const chosen = items.flatMap((item) => (item.kind === "skill" ? [item] : []));
      const skills = chosen.filter((item) => !item.command).map((item) => item.name);
      const research = chosen.some((item) => item.command === "research");
      for (const item of chosen) if (item.command) noteCommandSent(item.command);
      const turns = chosen.flatMap((item) => {
        const turn = item.command && item.command !== "research" ? astroCommandTurn(item.command, windowId, item.occurrence) : null;
        return turn ? [[`## The person ran /${item.name} (${item.title})`, turn.prompt, ...turn.context]] : [];
      });
      const asked = [chosen.map((item) => `/${item.name}`).join(" "), words].filter(Boolean).join(" ");
      const quote = quoteOf(items);
      const text = [quote, asked].filter(Boolean).join("\n\n");
      const attachments = attachmentsOf(items);
      if (!text && !attachments.length) return;
      resetAgentStop(windowId);
      endRun(windowId);
      updateWindowChat(windowId, (c) => ({ draft: "", context: c.context.filter((item) => !ONE_SHOT.has(item.kind)), history: false }));
      void prepare(
        { kind: "send", text, attachments, skills, research },
        [...turns.flat(), ...extraContext],
      );
    },
    [windowId, prepare],
  );

  useEffect(() => {
    if (!ask) return;
    if (ask.conversationId && (thread.conversationId !== ask.conversationId || thread.conversationLoading)) return;
    updateWindowChat(windowId, { ask: null });
    if (ask.fresh && windowChat(windowId).conversationId) newChat(windowId);
    const tabItems = ask.context.filter((item) => item.kind !== "tab" || item.tabId !== activeTabId(useBrowser.getState(), windowId));
    if (ask.context.some((item) => item.kind === "tab" && item.tabId === activeTabId(useBrowser.getState(), windowId)))
      updateWindowChat(windowId, { currentTab: true });
    if (!ask.send) {
      updateWindowChat(windowId, (c) => ({ draft: ask.text, context: [...c.context, ...tabItems] }));
      return;
    }
    updateWindowChat(windowId, (c) => ({ context: [...c.context.filter((item) => item.kind !== "tab"), ...tabItems] }));
    const page = ask.context.find((item) => item.kind === "tab");
    const summary: ChatContextItem[] =
      ask.summary && page?.kind === "tab"
        ? [{ id: chatItemId("selection"), kind: "selection", tabId: page.tabId, title: `Summary of ${page.title}`, url: page.url, text: ask.summary }]
        : [];
    send(ask.text, summary, ask.extra ?? []);
  }, [ask, thread.conversationId, thread.conversationLoading]);

  const actions: ThreadActions = useMemo(
    () => ({
      openLink: (url) => {
        const s = useBrowser.getState();
        const opener = activeTabId(s, windowId);
        s.newTab(windowId, { url, ...(opener ? { openerId: opener } : {}) });
      },
      edit: (message: Message) => {
        const text = getTextFromContent(message.content as never);
        updateWindowChat(windowId, { draft: text, focusRequest: Date.now() });
        setEditing(message.id);
      },
      regenerate: (message: Message) => void prepare({ kind: "regenerate", messageId: message.id }),
      resume: () => send("Continue from where you stopped."),
      retry: () => void prepare({ kind: "retry" }),
      openArtifact: (artifact: Artifact) => {
        const conversationId = windowChat(windowId).conversationId;
        if (conversationId) openArtifactTab(windowId, { ...artifact, conversationId });
      },
      saveAsSkill: (message: Message) => openSkillsPage(windowId, "new", getTextFromContent(message.content as never)),
    }),
    [windowId, prepare, send],
  );
  const [editing, setEditing] = useState<string | null>(null);

  const submit = (text: string) => {
    if (editing) {
      const id = editing;
      setEditing(null);
      updateWindowChat(windowId, { draft: "" });
      return void prepare({ kind: "edit", messageId: id, text });
    }
    send(text);
  };

  const onAction = async (action: ComposerAction) => {
    switch (action) {
      case "mention":
        updateWindowChat(windowId, (c) => ({ draft: `${c.draft}${c.draft && !c.draft.endsWith(" ") ? " " : ""}@`, focusRequest: Date.now() }));
        return;
      case "files": {
        const files = await pickChatFiles();
        if (files.length) updateWindowChat(windowId, (c) => ({ context: [...c.context, ...files] }));
        return;
      }
      case "screenshot":
        return void screenshotActiveTab(windowId);
      case "screenshotArea":
        return startAreaCapture(windowId);
      case "screenshotFullPage":
        return void captureFullPage(windowId);
      case "currentTab":
        return updateWindowChat(windowId, (c) => ({ currentTab: !c.currentTab }));
      case "personalization":
        if (conversationId) setPersonalizationOff(conversationId, personal);
        else updateWindowChat(windowId, { personal: !personal });
        return;
    }
  };

  const onPickMention = (candidate: MentionCandidate) => {
    const s = useBrowser.getState();
    if (candidate.kind === "tab") {
      updateWindowChat(windowId, (c) => ({
        context: [
          ...c.context,
          { id: chatItemId("tab"), kind: "tab", tabId: candidate.tabId, title: candidate.title, url: candidate.url, favicon: candidate.favicon },
        ],
      }));
      return;
    }
    const group = s.groups[candidate.groupId];
    if (!group) return;
    const tabs = group.tabIds.flatMap((id) => {
      const tab = s.tabs[id];
      return tab?.url ? [{ tabId: id, title: tab.customTitle || tab.title, url: tab.url, favicon: tab.favicon }] : [];
    });
    updateWindowChat(windowId, (c) => ({
      context: [...c.context, { id: chatItemId("group"), kind: "group", groupId: group.id, title: group.name || "Tab Group", tabs }],
    }));
  };

  const dragHeader = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) + Math.abs(g.dy) > 3,
        onPanResponderMove: (_, g) => moveFloatingChat(g.dx, g.dy, false),
        onPanResponderRelease: (_, g) => moveFloatingChat(g.dx, g.dy, true),
        onPanResponderTerminate: (_, g) => moveFloatingChat(g.dx, g.dy, true),
      }),
    [],
  );

  const empty = (
    <EmptyChat
      windowId={windowId}
      onPrompt={(prompt) => send(prompt)}
      onCommand={(command, title) => {
        const known = ASTRO_COMMANDS.find((c) => c.command === command);
        send("", [{ id: chatItemId("skill"), kind: "skill", name: known?.name ?? command, title: known?.title ?? title, command }]);
      }}
    />
  );

  const cancelEdit = () => {
    setEditing(null);
    updateWindowChat(windowId, { draft: "" });
  };

  const header = (
    <View {...(placement === "floating" && !inTab ? dragHeader.panHandlers : {})} style={{ paddingTop: TOOLBAR_GLYPH_CENTER - PAGE_HEADER_COMPACT_CENTER }}>
      <PageHeader
        density="compact"
        safeArea={false}
        titleAlign="start"
        headingLevel={2}
        title={history ? "Chats" : title}
        actions={
          <ButtonGroup size="sm" accessibilityLabel="Chat">
            <ButtonGroupItem iconOnly leadingIcon={RiAddLine} accessibilityLabel="New Chat" onPress={() => newChat(windowId)} />
            <ButtonGroupItem
              iconOnly
              leadingIcon={RiHistoryLine}
              accessibilityLabel="Chat History"
              checked={history}
              onPress={() => toggleChatHistory(windowId)}
            />
            <PanelMenu
              windowId={windowId}
              inTab={inTab}
              placement={placement}
              conversationId={conversationId}
              personal={personal}
              personalizationSupported={personalizationSupported}
              history={history}
              clear={thread.clearConversation}
            />
            {!inTab && <ButtonGroupItem iconOnly leadingIcon={RiCloseLine} accessibilityLabel="Close Chat" onPress={() => closeChat(windowId)} />}
          </ButtonGroup>
        }
      />
    </View>
  );

  const composer = history ? undefined : (
    <ChatComposer
      windowId={windowId}
      busy={busy}
      disabled={false}
      powerLevel={powerLevel}
      personalization={personalizationSupported ? personal : null}
      inputRef={inputRef}
      onSubmit={submit}
      onStop={() => stopAgent(windowId)}
      onAction={(action) => void onAction(action)}
      onPickMention={onPickMention}
      onPowerLevel={(level) => useBrowser.getState().updateSettings({ chatPowerLevel: level })}
      editing={!!editing}
      onCancelEdit={cancelEdit}
      question={<ToolApprovals windowId={windowId} />}
    />
  );

  return (
    <View style={{ flex: 1 }} onFocus={() => setComposerFocused(windowId)} onBlur={() => setComposerFocused(null)}>
      <AppShell
        gutter={0}
        safeArea={false}
        contentMaxWidth="none"
        style={{ flex: 1, backgroundColor: "transparent" }}
        panelLayout={{
          mode: "split",
          flow: "bounded",
          activePanel: "chat",
          panels: [
            {
              id: "chat",
              appearance: "plain",
              scroll: "content",
              content: (
                <AiChatContainer surface={false} header={header} composer={composer}>
                  {history ? (
                    <ChatHistory current={conversationId} onOpen={(id) => showChatConversation(windowId, id)} onNewChat={() => newChat(windowId)} />
                  ) : thread.conversationLoading ? null : (
                    <ChatThreadView messages={thread.messages} isLoading={thread.isLoading} failedTurn={thread.failedTurn} actions={actions} empty={empty} />
                  )}
                </AiChatContainer>
              ),
            },
          ],
        }}
      />
    </View>
  );
}

async function screenshotActiveTab(windowId: string) {
  const s = useBrowser.getState();
  const tabId = activeTabId(s, windowId);
  const tab = tabId ? s.tabs[tabId] : undefined;
  const web = tabId ? webviews.get(tabId) : undefined;
  if (!tab || !web) return;
  const picture = await web.capturePicture(1).catch(() => null);
  if (!picture?.data) return;
  const uri = picture.data.startsWith("data:") ? picture.data : `data:image/jpeg;base64,${picture.data}`;
  updateWindowChat(windowId, (c) => ({
    context: [...c.context, { id: chatItemId("screenshot"), kind: "screenshot", tabId: tab.id, title: tab.customTitle || tab.title, url: tab.url, uri }],
    focusRequest: Date.now(),
  }));
}

function PanelMenu({
  windowId,
  inTab,
  placement,
  conversationId,
  personal,
  personalizationSupported,
  history,
  clear,
}: {
  windowId: string;
  inTab: boolean;
  placement: "sidebar" | "floating";
  conversationId: string | null;
  personal: boolean;
  personalizationSupported: boolean;
  history: boolean;
  clear: () => Promise<boolean>;
}) {
  const { all } = useChatList();
  const { mutateAsync: remove } = useDeleteConversation();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild label="More">
        <ButtonGroupItem iconOnly leadingIcon={RiMoreFill} accessibilityLabel="More" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {!inTab && <DropdownMenuItem onPress={() => openChatTab(windowId)}>Open Chat in Tab</DropdownMenuItem>}
        {(inTab || placement === "floating") && <DropdownMenuItem onPress={() => setChatPlacement(windowId, "sidebar")}>Show Chat in Sidebar</DropdownMenuItem>}
        {(inTab || placement === "sidebar") && (
          <DropdownMenuItem onPress={() => setChatPlacement(windowId, "floating")}>Show Chat as Floating Window</DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        {personalizationSupported && conversationId && (
          <DropdownMenuCheckboxItem checked={personal} onCheckedChange={() => setPersonalizationOff(conversationId, personal)}>
            Personalization for This Chat
          </DropdownMenuCheckboxItem>
        )}
        {conversationId && !history && <DropdownMenuItem onPress={() => void clear()}>Clear Chat</DropdownMenuItem>}
        {history && all.length > 0 && (
          <DropdownMenuItem tone="danger" onPress={() => void deleteAllChats(all, remove)}>
            Delete All Chats…
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onPress={() => openSkillsPage(windowId)}>Skills…</DropdownMenuItem>
        <DropdownMenuItem onPress={() => openInternalPage("apps", windowId)}>Connected Apps…</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const COMMAND_ICON = { brief: RiSunLine, prep: RiTeamLine, recap: RiCheckboxCircleLine, research: RiSparklingLine } as const;

function EmptyChat({ windowId, onPrompt, onCommand }: { windowId: string; onPrompt: (prompt: string) => void; onCommand: (command: AstroCommand, title: string) => void }) {
  const tab = useBrowser((s) => {
    const id = activeTabId(s, windowId);
    return id ? s.tabs[id] : undefined;
  });
  const url = tab?.url ?? "";
  const currentTab = useWindowChat(windowId, (c) => c.currentTab);
  const events = useCalendar((s) => s.events);
  const now = useNow(60_000);
  const [welcome, setWelcome] = useState<WelcomeSuggestion[]>([]);
  const video = /youtube\.com\/(watch|shorts)|youtu\.be\//.test(url);
  const onPage = currentTab && /^(https?|file):/.test(url);
  const prompts = PROMPT_ACTIONS.filter((p) => (onPage ? p.when === "page" || (video && p.when === "video") : false)).slice(0, 3);
  const commands = useMemo(() => proactiveCommands(now, events, { briefDoneToday: briefDoneToday(now) }), [now, events]);
  const context = welcomeContext(onPage && tab ? { title: tab.customTitle || tab.title, url } : null);
  useEffect(() => {
    let live = true;
    const timer = setTimeout(
      () =>
        void welcomeSuggestions(context, 3)
          .then((list) => live && setWelcome(list))
          .catch(() => live && setWelcome([])),
      250,
    );
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [context]);
  const suggestions: EmptyStateSuggestion[] = [
    ...commands.map((c) => ({ id: c.key, label: c.title, icon: COMMAND_ICON[c.command], onPress: () => onCommand(c.command, c.title) })),
    ...prompts.map((p) => ({ id: p.id, label: p.title, icon: RiSparklingLine, onPress: () => onPrompt(p.prompt) })),
    ...welcome
      .slice(0, Math.max(1, 5 - commands.length - prompts.length))
      .map((w) => ({ id: w.key, label: w.title, icon: RiLightbulbLine, onPress: () => onPrompt(w.prompt) })),
  ];
  return (
    <View style={{ flex: 1, justifyContent: "center", paddingHorizontal: 16 }}>
      <EmptyState
        variant="compact"
        icon={onPage ? RiGlobalLine : RiChat3Line}
        title={onPage ? "Ask about this tab" : "What's on your mind?"}
        suggestions={suggestions}
        suggestionsLabel="Suggestions"
      />
    </View>
  );
}

export { personalizationOff };
