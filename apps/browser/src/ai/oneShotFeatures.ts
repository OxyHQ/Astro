import { useOxySession } from "../oxy/session";
import { useChatEntry } from "./chatEntry";
import { startGroupNaming } from "./groupNaming";
import { useOneShotStatus, setTestEndpoint } from "./inference";
import { startVideoSummaries, summarizeVideo, useVideoSummaries } from "./pagePrompts";
import { startPinnedTitles } from "./pinnedTitles";
import { startTidyDownloads, undoTidy } from "./tidyDownloads";

let leading: (() => void) | null = null;
let page: (() => void) | null = null;

const together = (stops: (() => void)[]) => () => {
  for (const stop of stops) stop();
};

export function startOneShotFeatures(): () => void {
  leading ??= together([startGroupNaming(), startPinnedTitles(), startTidyDownloads()]);
  return leading;
}

export function startPageOneShotFeatures(): () => void {
  page ??= startVideoSummaries();
  return page;
}

export const oneShotDebug = { session: useOxySession, status: useOneShotStatus, chat: useChatEntry, videos: useVideoSummaries, summarizeVideo, undoTidy, setTestEndpoint };
