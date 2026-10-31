import { renameDownload, type Download } from "@astro-browser/astrocore";
import { useBrowser } from "../store/browser";
import { oneShot, oneShotReady } from "./inference";
import { DOWNLOAD_NAME_INSTRUCTIONS, downloadNameInput, parseDownloadName } from "./oneShotPrompts";

const MAX_OUTPUT_TOKENS = 48;

export const canUndoTidy = (d: Pick<Download, "tidiedFrom" | "state">) => !!d.tidiedFrom && d.state === "finished";

export async function undoTidy(d: Pick<Download, "id" | "tidiedFrom" | "profile">): Promise<boolean> {
  if (!d.tidiedFrom) return false;
  return renameDownload(d.id, d.tidiedFrom, d.profile ?? "")
    .then(() => true)
    .catch(() => false);
}

const tidyable = (d: Download) =>
  d.state === "finished" && !d.offTheRecord && !d.tidiedFrom && !(d as { dangerous?: boolean }).dangerous && !!d.filename && /^https?:/i.test(d.url);

export function startTidyDownloads(): () => void {
  const asked = new Set<string>();

  const tidy = async (d: Download) => {
    asked.add(d.id);
    const name = parseDownloadName(
      await oneShot("downloadName", { instructions: DOWNLOAD_NAME_INSTRUCTIONS, input: downloadNameInput(d), maxOutputTokens: MAX_OUTPUT_TOKENS }),
      d.filename,
    );
    if (!name) return;
    const now = useBrowser.getState().downloads.find((x) => x.id === d.id);
    if (!now || !tidyable(now) || now.filename !== d.filename || useBrowser.getState().settings.aiTidyDownloads === false) return;
    await renameDownload(d.id, name, d.profile ?? "", { tidy: true }).catch(() => null);
  };

  return useBrowser.subscribe((s, prev) => {
    if (s.downloads === prev.downloads || s.settings.aiTidyDownloads === false || !oneShotReady()) return;
    for (const d of s.downloads) {
      if (asked.has(d.id) || !tidyable(d)) continue;
      const before = prev.downloads.find((x) => x.id === d.id);
      if (before?.state === "downloading") void tidy(d);
    }
  });
}
