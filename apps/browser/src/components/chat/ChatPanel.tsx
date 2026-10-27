import { AliaRuntimeProvider, useConversationThread, type AliaRuntimeHost, type AliaTurnRequest } from "@alia.onl/sdk/runtime";
import type { Message } from "@alia.onl/sdk/model";
import { getTextFromContent } from "@alia.onl/sdk/content";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PanResponder, Pressable, Text, View, type TextInput } from "react-native";
import { Symbol } from "@astro-browser/shell";
import { closeChat, newChat, openChatTab, setChatPlacement, setComposerFocused, showChatConversation, toggleChatHistory } from "../../ai/chat/actions";
import { buildTurnContext } from "../../ai/chat/clientContext";
import { astroHostTools } from "../../ai/chat/hostTools";
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
import { layout, useTheme } from "../../lib/theme";
import { useBrowser } from "../../store/browser";
import { activeTabId } from "../../store/model";
import { IconButton } from "../primitives";
import { ChatComposer, type ComposerAction } from "./ChatComposer";
import { ChatHistory, ASTRO_APP } from "./ChatHistory";
import { moveFloatingChat } from "./ChatSlots";
import { captureFullPage, startAreaCapture } from "./capture";
import { ChatThreadView, type ThreadActions } from "./ChatThread";
import { ToolApprovals } from "./ToolApproval";
import { pickChatFiles } from "./files";
import type { MentionCandidate } from "./mentions";
import { powerLevelOf } from "./powerLevels";

export type ChatPanelProps = { windowId: string; inTab: boolean; personalizationSupported: boolean; faviconUrl?: (url: string) => string | null };

type Pending =
  | { kind: "send"; id: number; text: string; attachments: SdkAttachment[]; skills: string[]; research: boolean }
  | { kind: "regenerate"; id: number; messageId: string }
  | { kind: "edit"; id: number; messageId: string; text: string }
  | { kind: "retry"; id: number };

type PendingInput = Pending extends infer P ? (P extends Pending ? Omit<P, "id"> : never) : never;

type SdkAttachment = { id: string; uri: string; type: "image" | "document"; name: string; size: number; mimeType: string };

let pendingSeq = 0;

const TOOLBAR_GLYPH_CENTER = 21.2;
const HEADER_CENTER_SHIFT = 2 * TOOLBAR_GLYPH_CENTER - layout.toolbarHeight;

const researchTurns = new Set<string>();

export function ChatPanel(props: ChatPanelProps) {
  const { windowId } = props;
  const host = useMemo<AliaRuntimeHost>(
    () => ({
      openConversation: (id) => showChatConversation(windowId, id),
      onTurnEnd: () => void researchTurns.delete(windowId),
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
  const theme = useTheme();
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
  }, []);

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
        setPending({ ...next, id: ++pendingSeq } as Pending);
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
        const turn = item.command && item.command !== "research" ? astroCommandTurn(item.command, windowId) : null;
        return turn ? [[`## The person ran /${item.name} (${item.title})`, turn.prompt, ...turn.context]] : [];
      });
      const asked = [chosen.map((item) => `/${item.name}`).join(" "), words].filter(Boolean).join(" ");
      const quote = quoteOf(items);
      const text = [quote, asked].filter(Boolean).join("\n\n");
      const attachments = attachmentsOf(items);
      if (!text && !attachments.length) return;
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

  return (
    <View style={{ flex: 1 }} onFocus={() => setComposerFocused(windowId)} onBlur={() => setComposerFocused(null)}>
      <View
        {...(placement === "floating" && !inTab ? dragHeader.panHandlers : {})}
        style={{ height: layout.toolbarHeight, paddingTop: HEADER_CENTER_SHIFT, flexDirection: "row", alignItems: "center", paddingLeft: 14, paddingRight: 6, gap: 2 }}
      >
        <Text numberOfLines={1} style={{ flex: 1, fontSize: 13, fontWeight: "600", color: theme.textPrimary }}>
          {history ? "Chats" : title}
        </Text>
        <IconButton icon="plus" size={13} box={28} tooltip="New Chat" onPress={() => newChat(windowId)} />
        <IconButton icon="clock" size={13} box={28} tooltip="Chat History" onPress={() => toggleChatHistory(windowId)} />
        <IconButton
          icon="ellipsis"
          size={13}
          box={28}
          tooltip="More"
          onPress={() => void showPanelMenu(windowId, inTab, placement, conversationId, personal, personalizationSupported, thread.clearConversation)}
        />
        {!inTab && <IconButton icon="xmark" size={12} weight="medium" box={28} tooltip="Close Chat" onPress={() => closeChat(windowId)} />}
      </View>
      {history ? (
        <ChatHistory current={conversationId} onOpen={(id) => showChatConversation(windowId, id)} />
      ) : (
        <>
          <View style={{ flex: 1, width: "100%", maxWidth: inTab ? 820 : undefined, alignSelf: "center" }}>
            {thread.conversationLoading ? null : (
              <ChatThreadView messages={thread.messages} isLoading={thread.isLoading} failedTurn={thread.failedTurn} actions={actions} empty={empty} />
            )}
          </View>
          {editing && (
            <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 4, gap: 8 }}>
              <Text style={{ flex: 1, fontSize: 12, color: theme.textSecondary }}>Editing your message</Text>
              <Text
                accessibilityRole="button"
                onPress={() => {
                  setEditing(null);
                  updateWindowChat(windowId, { draft: "" });
                }}
                style={{ fontSize: 12, color: theme.accent }}
              >
                Cancel
              </Text>
            </View>
          )}
          <View style={{ width: "100%", maxWidth: inTab ? 820 : undefined, alignSelf: "center" }}>
            <ToolApprovals windowId={windowId} />
            <ChatComposer
              windowId={windowId}
              busy={busy}
              disabled={false}
              powerLevel={powerLevel}
              personalization={personalizationSupported ? personal : null}
              inputRef={inputRef}
              onSubmit={submit}
              onStop={() => thread.stopGeneration()}
              onAction={(action) => void onAction(action)}
              onPickMention={onPickMention}
              onPowerLevel={(level) => useBrowser.getState().updateSettings({ chatPowerLevel: level })}
            />
          </View>
        </>
      )}
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

async function showPanelMenu(
  windowId: string,
  inTab: boolean,
  placement: "sidebar" | "floating",
  conversationId: string | null,
  personal: boolean,
  personalizationSupported: boolean,
  clear: () => Promise<boolean>,
) {
  const { showMenu } = await import("@astro-browser/shell");
  const choice = await showMenu([
    ...(inTab ? [] : [{ id: "tab", title: "Open Chat in Tab" }]),
    ...(inTab || placement === "floating" ? [{ id: "sidebar", title: "Show Chat in Sidebar" }] : []),
    ...(inTab || placement === "sidebar" ? [{ id: "floating", title: "Show Chat as Floating Window" }] : []),
    { separator: true as const },
    ...(personalizationSupported && conversationId ? [{ id: "personal", title: "Personalization for This Chat", checked: personal }] : []),
    ...(conversationId ? [{ id: "clear", title: "Clear Chat" }] : []),
    { separator: true as const },
    { id: "skills", title: "Skills…" },
    { id: "apps", title: "Connected Apps…" },
  ]);
  switch (choice) {
    case "tab":
      return openChatTab(windowId);
    case "sidebar":
    case "floating":
      return setChatPlacement(windowId, choice);
    case "personal":
      if (conversationId) setPersonalizationOff(conversationId, personal);
      return;
    case "clear":
      return void clear();
    case "skills":
      return openSkillsPage(windowId);
    case "apps":
      return openInternalPage("apps", windowId);
  }
}

function EmptyChat({ windowId, onPrompt, onCommand }: { windowId: string; onPrompt: (prompt: string) => void; onCommand: (command: AstroCommand, title: string) => void }) {
  const theme = useTheme();
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
  const row = (key: string, title: string, icon: string, onPress: () => void) => (
    <Pressable key={key} accessibilityRole="button" onPress={onPress} style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 6 }}>
      <Symbol name={icon} size={11} color={theme.textSecondary} style={{ width: 14, height: 14 }} />
      <Text numberOfLines={1} style={{ flex: 1, fontSize: 13, color: theme.textSecondary }}>
        {title}
      </Text>
    </Pressable>
  );
  return (
    <View style={{ flex: 1, justifyContent: "flex-end", paddingHorizontal: 16, paddingBottom: 12, gap: 2 }}>
      <Text style={{ fontSize: 20, fontWeight: "600", color: theme.textPrimary, marginBottom: 8 }}>
        {onPage ? "Ask about this tab" : "What's on your mind?"}
      </Text>
      {commands.map((c) => row(c.key, c.title, c.command === "brief" ? "sun.max" : c.command === "prep" ? "person.2" : "text.badge.checkmark", () => onCommand(c.command, c.title)))}
      {prompts.map((p) => row(p.id, p.title, "sparkles", () => onPrompt(p.prompt)))}
      {welcome.slice(0, Math.max(1, 5 - commands.length - prompts.length)).map((w) => row(w.key, w.title, "lightbulb", () => onPrompt(w.prompt)))}
    </View>
  );
}


export { personalizationOff };
