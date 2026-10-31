import { openArtifactTab } from "../../components/artifacts/open";
import { tabDestination } from "../../components/pages/urls";
import { useBrowser } from "../../store/browser";
import { viewTabIds } from "../../store/model";
import { newChat, openChatPanel, showChatConversation } from "../chat/actions";
import { windowChat } from "../chat/state";
import { artifactKey, artifactUrl, useArtifacts } from "../artifacts/artifacts";

export function openLibraryChat(windowId: string, conversationId: string) {
  openChatPanel(windowId);
  showChatConversation(windowId, conversationId);
}

export function openLibraryFile(windowId: string, conversationId: string, id: string, options: { background?: boolean } = {}) {
  const known = useArtifacts.getState().byId[artifactKey(conversationId, id)];
  if (known) return openArtifactTab(windowId, known, options);
  const s = useBrowser.getState();
  const url = artifactUrl(conversationId, id);
  const open = viewTabIds(s, windowId).find((tabId) => tabDestination(s.tabs[tabId]!) === url);
  if (open) {
    if (!options.background) s.activate(open);
    return open;
  }
  return s.newTab(windowId, { url, background: !!options.background });
}

export function closeDeletedChat(windowId: string, conversationId: string) {
  if (windowChat(windowId).conversationId === conversationId) newChat(windowId);
}
