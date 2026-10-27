import { AliaRuntimeProvider, useAliaApi } from "@alia.onl/sdk/runtime";
import { useEffect, useMemo, useState, type ComponentType } from "react";
import { createPortal } from "react-dom";
import { ButtonGroup, ButtonGroupItem } from "@oxy.so/bloom/button-group";
import { EmptyState } from "@oxy.so/bloom/empty-state";
import { RiCloseLine } from "@oxy.so/bloom/icons/RiCloseLine";
import { RiSparklingLine } from "@oxy.so/bloom/icons/RiSparklingLine";
import { View } from "react-native";
import { closeChat, isChatTabUrl, openChatFromEntry } from "../../../browser/src/ai/chat/actions";
import { addChatContext, chatItemId, useChat } from "../../../browser/src/ai/chat/state";
import { registerChatOpener } from "../../../browser/src/ai/chatEntry";
import { registerAliaApi } from "../../../browser/src/ai/alia/api";
import { BloomThemeProvider } from "@oxy.so/bloom/theme";
import { ArtifactPage } from "../../../browser/src/components/artifacts/ArtifactPage";
import { AppsPage } from "../../../browser/src/components/pages/AppsPage";
import { SkillsPage } from "../../../browser/src/components/pages/SkillsPage";
import { registerInternalPage } from "../../../browser/src/components/pages/registry";
import { forgetSkills, refreshSkills } from "../../../browser/src/ai/skills/skills";
import { startOAuthReturns } from "../../../browser/src/ai/apps/oauthReturn";
import { ChatFrame } from "../../../browser/src/components/chat/ChatFrame";
import { ChatPanel } from "../../../browser/src/components/chat/ChatPanel";
import { tabSlotKey, useChatSlots, windowSlotKey } from "../../../browser/src/components/chat/ChatSlots";
import { fileItems, pastedLink } from "../../../browser/src/components/chat/files";
import { ThemeScope, useTheme } from "../../../browser/src/lib/theme";
import { signInWithOxy, useOxySession } from "../../../browser/src/oxy/session";
import { useBrowser } from "../../../browser/src/store/browser";
import { WindowContext } from "../../../browser/src/store/hooks";
import { activeTabId } from "../../../browser/src/store/model";
import { AreaCapture } from "./areaCapture";
import { engineStreamFetch } from "./fetch";
import { usePageWindowId } from "./windows";

function themed(Page: ComponentType<{ tabId: string }>) {
  return function ThemedPage({ tabId }: { tabId: string }) {
    const theme = useTheme();
    return (
      <BloomThemeProvider mode={theme.dark ? "dark" : "light"}>
        <Page tabId={tabId} />
      </BloomThemeProvider>
    );
  };
}

registerInternalPage("artifact", themed(ArtifactPage));
registerInternalPage("skills", themed(SkillsPage));
registerInternalPage("apps", themed(AppsPage));

export function ChatHost({ aliaURL }: { aliaURL: string }) {
  const windowId = usePageWindowId();
  useEffect(() => registerChatOpener(openChatFromEntry), []);
  return (
    <AliaRuntimeProvider apiUrl={aliaURL} streamFetch={engineStreamFetch as typeof fetch} app="astro">
      <AliaApiBridge />
      <AreaCapture />
      {windowId ? <WindowChat key={windowId} windowId={windowId} /> : null}
    </AliaRuntimeProvider>
  );
}

function AliaApiBridge() {
  const api = useAliaApi();
  const account = useOxySession((s) => s.account?.id ?? null);
  useEffect(() => registerAliaApi(api), [api]);
  useEffect(() => startOAuthReturns(), []);
  useEffect(() => {
    forgetSkills();
    if (account) void refreshSkills({ force: true });
  }, [account, api]);
  return null;
}

function useContainer(windowId: string): HTMLDivElement {
  const container = useMemo(() => {
    const div = document.createElement("div");
    div.className = "astro-chat";
    div.style.cssText = "position:absolute;inset:0;display:flex;flex-direction:column;";
    return div;
  }, []);
  useEffect(() => {
    const paste = (event: ClipboardEvent) => {
      const data = event.clipboardData;
      if (!data) return;
      const images = Array.from(data.files).filter((file) => file.type.startsWith("image/"));
      if (images.length) {
        event.preventDefault();
        void fileItems(images).then((items) => addChatContext(windowId, items));
        return;
      }
      const link = pastedLink(data.getData("text/plain"));
      if (link) {
        event.preventDefault();
        addChatContext(windowId, [{ id: chatItemId("link"), kind: "link", url: link }]);
      }
    };
    const over = (event: DragEvent) => {
      if (event.dataTransfer?.types.includes("Files")) event.preventDefault();
    };
    const drop = (event: DragEvent) => {
      const files = Array.from(event.dataTransfer?.files ?? []);
      if (!files.length) return;
      event.preventDefault();
      void fileItems(files).then((items) => addChatContext(windowId, items));
    };
    container.addEventListener("paste", paste, true);
    container.addEventListener("dragover", over);
    container.addEventListener("drop", drop);
    return () => {
      container.removeEventListener("paste", paste, true);
      container.removeEventListener("dragover", over);
      container.removeEventListener("drop", drop);
    };
  }, [container, windowId]);
  return container;
}

function useActiveSlot(windowId: string): Element | null {
  const chatTab = useBrowser((s) => {
    const id = activeTabId(s, windowId);
    return id && isChatTabUrl(s.tabs[id]?.url) ? id : null;
  });
  return useChatSlots((s) => (s.slots[chatTab ? tabSlotKey(chatTab) : windowSlotKey(windowId)] as Element | undefined) ?? null);
}

function WindowChat({ windowId }: { windowId: string }) {
  const used = useChat((s) => !!s.windows[windowId]?.open);
  const slot = useActiveSlot(windowId);
  const [mounted, setMounted] = useState(false);
  const container = useContainer(windowId);
  const inTab = useBrowser((s) => {
    const id = activeTabId(s, windowId);
    return !!id && isChatTabUrl(s.tabs[id]?.url);
  });
  useEffect(() => {
    if (used || inTab) setMounted(true);
  }, [used, inTab]);
  useEffect(() => {
    if (slot && container.parentElement !== slot) slot.appendChild(container);
    else if (!slot && container.parentElement) container.remove();
  }, [slot, container]);
  useEffect(() => () => container.remove(), [container]);
  if (!mounted) return null;
  return createPortal(
    <WindowContext.Provider value={windowId}>
      <ThemeScope>
        <ChatFrame windowId={windowId} inTab={inTab}>
          <SignedInChat windowId={windowId} inTab={inTab} />
        </ChatFrame>
      </ThemeScope>
    </WindowContext.Provider>,
    container,
  );
}

function SignedInChat({ windowId, inTab }: { windowId: string; inTab: boolean }) {
  const resolved = useOxySession((s) => s.resolved);
  const account = useOxySession((s) => s.account);
  if (!resolved) return null;
  if (!account) return <SignInToChat windowId={windowId} inTab={inTab} />;
  return <ChatPanel key={account.id} windowId={windowId} inTab={inTab} personalizationSupported />;
}

function SignInToChat({ windowId, inTab }: { windowId: string; inTab: boolean }) {
  return (
    <View style={{ flex: 1, justifyContent: "center" }}>
      {!inTab && (
        <ButtonGroup size="sm" accessibilityLabel="Chat" style={{ position: "absolute", top: 8, right: 6 }}>
          <ButtonGroupItem iconOnly leadingIcon={RiCloseLine} accessibilityLabel="Close Chat" onPress={() => closeChat(windowId)} />
        </ButtonGroup>
      )}
      <EmptyState
        variant="compact"
        media="circle"
        icon={RiSparklingLine}
        title="Chat with Alia"
        description="Ask about the page you're on, your tabs and files, or anything else. Chat uses your Oxy account."
        action={{ label: "Sign In with Oxy…", onPress: () => void signInWithOxy() }}
      />
    </View>
  );
}
