import type { ViewStyle } from "react-native";
import { toggleChat } from "../../ai/chat/actions";
import { useWindowChat } from "../../ai/chat/state";
import { ToolbarButton } from "../layout/controls";
import type { ToolbarPalette } from "../layout/toolbarColors";

export const CHAT_BUTTON_ROOM = 32;

const isMac = typeof navigator !== "undefined" && /Mac/.test(navigator.platform);

export function ChatButton({ windowId, palette, style }: { windowId: string; palette: ToolbarPalette; style: ViewStyle }) {
  const open = useWindowChat(windowId, (c) => c.open);
  return (
    <ToolbarButton
      style={style}
      palette={palette}
      icon="sparkles"
      size={14}
      active={open}
      onPress={() => toggleChat(windowId)}
      tooltip={`Chat (${isMac ? "⌘E" : "Ctrl+E"})`}
    />
  );
}
