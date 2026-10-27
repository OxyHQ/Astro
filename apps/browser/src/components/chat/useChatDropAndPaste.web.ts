import { useCallback, useEffect, useState } from "react";
import { addChatContext, chatItemId } from "../../ai/chat/state";
import { fileItems, pastedLink } from "./files";

export function useChatDropAndPaste(windowId: string): (container: HTMLElement | null) => void {
  const [container, setContainer] = useState<HTMLElement | null>(null);
  useEffect(() => {
    if (!container) return;
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
  return useCallback((element: HTMLElement | null) => setContainer(element), []);
}
