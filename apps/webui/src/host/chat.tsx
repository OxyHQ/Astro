import { ChatHost } from "../../../browser/src/oxy/ChatHost";
import { AreaCapture } from "./areaCapture";
import { engineStreamFetch } from "./fetch";
import { usePageWindowId } from "./windows";

export function PageChat({ aliaURL }: { aliaURL: string }) {
  const windowId = usePageWindowId();
  return (
    <ChatHost windowId={windowId} aliaURL={aliaURL} streamFetch={engineStreamFetch as typeof fetch}>
      <AreaCapture />
    </ChatHost>
  );
}
