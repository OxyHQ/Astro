import { artifactUrl, parseArtifactUrl, useArtifacts, artifactKey, type Artifact } from "../../ai/artifacts/artifacts";
import { useBrowser } from "../../store/browser";
import { viewTabIds } from "../../store/model";
import { tabDestination } from "../pages/urls";

export function openArtifactTab(windowId: string, artifact: Artifact & { conversationId: string }, options: { background?: boolean } = {}) {
  const s = useBrowser.getState();
  const url = artifactUrl(artifact.conversationId, artifact.id);
  const all = useArtifacts.getState().byId;
  const same = viewTabIds(s, windowId).find((id) => {
    const where = parseArtifactUrl(tabDestination(s.tabs[id]!));
    if (!where || where.conversationId !== artifact.conversationId) return false;
    if (where.id === artifact.id) return true;
    const shown = all[artifactKey(where.conversationId, where.id)];
    return !!shown && shown.body.kind === artifact.body.kind && shown.title.trim().toLowerCase() === artifact.title.trim().toLowerCase();
  });
  if (same) {
    if (tabDestination(s.tabs[same]!) !== url) s.navigate(same, url);
    if (!options.background) s.activate(same);
    return same;
  }
  return s.newTab(windowId, { url, background: !!options.background });
}
