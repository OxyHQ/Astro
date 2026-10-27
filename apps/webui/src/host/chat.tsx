import { AliaRuntimeProvider, useAliaApi } from "@alia.onl/sdk/runtime";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Pressable, Text, View } from "react-native";
import { closeChat, isChatTabUrl, openChatFromEntry } from "../../../browser/src/ai/chat/actions";
import { IconButton } from "../../../browser/src/components/primitives";
import { addChatContext, chatItemId, useChat } from "../../../browser/src/ai/chat/state";
import { registerChatOpener } from "../../../browser/src/ai/chatEntry";
import { registerAliaApi } from "../../../browser/src/ai/alia/api";
import { forgetSkills, refreshSkills } from "../../../browser/src/ai/skills/skills";
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
        <SignedInChat windowId={windowId} inTab={inTab} />
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
  const theme = useTheme();
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 12 }}>
      {!inTab && (
        <IconButton
          icon="xmark"
          size={12}
          weight="medium"
          box={28}
          tooltip="Close Chat"
          onPress={() => closeChat(windowId)}
          style={{ position: "absolute", top: 8, right: 6 }}
        />
      )}
      <Text style={{ fontSize: 17, fontWeight: "600", color: theme.textPrimary, textAlign: "center" }}>Chat with Alia</Text>
      <Text style={{ fontSize: 13, lineHeight: 19, color: theme.textSecondary, textAlign: "center" }}>
        Ask about the page you're on, your tabs and files, or anything else. Chat uses your Oxy account.
      </Text>
      <Pressable
        accessibilityRole="button"
        onPress={() => void signInWithOxy()}
        style={{ marginTop: 4, paddingHorizontal: 14, height: 32, borderRadius: 8, justifyContent: "center", backgroundColor: theme.accent }}
      >
        <Text style={{ fontSize: 13, fontWeight: "600", color: "#FFFFFF" }}>Sign In with Oxy…</Text>
      </Pressable>
    </View>
  );
}
