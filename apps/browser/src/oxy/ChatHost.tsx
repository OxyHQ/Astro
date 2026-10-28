import { AliaRuntimeProvider, useAliaApi } from "@alia.onl/sdk/runtime";
import { Portal } from "@astro-browser/shell";
import { ButtonGroup, ButtonGroupItem } from "@oxy.so/bloom/button-group";
import { useOxy } from "@oxy.so/services";
import { EmptyState } from "@oxy.so/bloom/empty-state";
import { RiCloseLine } from "@oxy.so/bloom/icons/RiCloseLine";
import { RiSparklingLine } from "@oxy.so/bloom/icons/RiSparklingLine";
import { BloomThemeProvider } from "@oxy.so/bloom/theme";
import { useEffect, useState, type ComponentType, type ReactNode } from "react";
import { View } from "react-native";
import { registerAliaApi } from "../ai/alia/api";
import { startOAuthReturns } from "../ai/apps/oauthReturn";
import { closeChat, isChatTabUrl, openChatFromEntry } from "../ai/chat/actions";
import { useChat } from "../ai/chat/state";
import { startWorkspaceFollow } from "../ai/chat/workspace";
import { registerChatOpener } from "../ai/chatEntry";
import { aliaTranscriber } from "../ai/dictation/alia";
import { registerDictationTranscriber } from "../ai/dictation/dictation";
import { forgetSkills, refreshSkills } from "../ai/skills/skills";
import { ArtifactPage } from "../components/artifacts/ArtifactPage";
import { ChatFrame } from "../components/chat/ChatFrame";
import { ChatPanel } from "../components/chat/ChatPanel";
import { tabSlotKey, useChatSlots, windowSlotKey } from "../components/chat/ChatSlots";
import { useChatDropAndPaste } from "../components/chat/useChatDropAndPaste";
import { AppsPage } from "../components/pages/AppsPage";
import { LibraryPage } from "../components/pages/LibraryPage";
import { registerInternalPage } from "../components/pages/registry";
import { SkillsPage } from "../components/pages/SkillsPage";
import { ThemeScope, useTheme } from "../lib/theme";
import { useBrowser } from "../store/browser";
import { WindowContext } from "../store/hooks";
import { activeTabId } from "../store/model";
import { signInWithOxy, useOxySession } from "./session";

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
registerInternalPage("library", themed(LibraryPage));

export type ChatHostProps = { windowId: string | null; aliaURL: string; streamFetch: typeof fetch; children?: ReactNode };

export function ChatHost({ windowId, aliaURL, streamFetch, children }: ChatHostProps) {
  useEffect(() => registerChatOpener(openChatFromEntry), []);
  return (
    <AliaRuntimeProvider apiUrl={aliaURL} streamFetch={streamFetch} app="astro">
      <AliaApiBridge aliaURL={aliaURL} />
      {children}
      {windowId ? <WindowChat key={windowId} windowId={windowId} /> : null}
    </AliaRuntimeProvider>
  );
}

function AliaApiBridge({ aliaURL }: { aliaURL: string }) {
  const api = useAliaApi();
  const { oxyServices } = useOxy();
  useEffect(() => {
    const linked = oxyServices.createLinkedClient({ baseURL: aliaURL });
    const unregister = registerDictationTranscriber(aliaTranscriber(aliaURL, linked.fetch));
    return () => {
      unregister();
      linked.dispose();
    };
  }, [oxyServices, aliaURL]);
  const account = useOxySession((s) => s.account?.id ?? null);
  useEffect(() => registerAliaApi(api), [api]);
  useEffect(() => startOAuthReturns(), []);
  useEffect(() => {
    forgetSkills();
    if (account) void refreshSkills({ force: true });
  }, [account, api]);
  return null;
}

function useActiveSlot(windowId: string): string | null {
  const chatTab = useBrowser((s) => {
    const id = activeTabId(s, windowId);
    return id && isChatTabUrl(s.tabs[id]?.url) ? id : null;
  });
  const key = chatTab ? tabSlotKey(chatTab) : windowSlotKey(windowId);
  return useChatSlots((s) => (s.slots[key] ? key : null));
}

function WindowChat({ windowId }: { windowId: string }) {
  useEffect(() => startWorkspaceFollow(windowId), [windowId]);
  const used = useChat((s) => !!s.windows[windowId]?.open);
  const slot = useActiveSlot(windowId);
  const [mounted, setMounted] = useState(false);
  const containerRef = useChatDropAndPaste(windowId);
  const inTab = useBrowser((s) => {
    const id = activeTabId(s, windowId);
    return !!id && isChatTabUrl(s.tabs[id]?.url);
  });
  useEffect(() => {
    if (used || inTab) setMounted(true);
  }, [used, inTab]);
  if (!mounted) return null;
  return (
    <Portal host={slot} containerRef={containerRef}>
      <WindowContext.Provider value={windowId}>
        <ThemeScope>
          <ChatFrame windowId={windowId} inTab={inTab}>
            <SignedInChat windowId={windowId} inTab={inTab} />
          </ChatFrame>
        </ThemeScope>
      </WindowContext.Provider>
    </Portal>
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
