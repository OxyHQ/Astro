import { create } from "zustand";
import { webviews } from "../lib/webviews";
import { signInWithOxy } from "../oxy/session";
import { useBrowser } from "../store/browser";
import { activeTab, isIncognitoProfile } from "../store/model";
import type { ChatContextItem } from "./chat/state";
import { chatAvailable, openChat, type ChatEntrySkill, type ChatPageContext } from "./chatEntry";
import { oneShot, oneShotReady, oneShotSignedIn } from "./inference";
import { promptActionsFor, PROMPT_ACTIONS, transcriptText, VIDEO_SUMMARY_INSTRUCTIONS, videoSummaryInput, youtubeVideoId, type PromptAction } from "./oneShotPrompts";
import { transcriptScript, type TranscriptResult } from "./youtubeTranscript";

const DWELL_MS = 4000;
const MAX_SUMMARY_TOKENS = 512;
const KEPT_VIDEOS = 20;

export type VideoSummary = {
  videoId: string;
  status: "fetching" | "summarizing" | "ready" | "unavailable";
  title: string;
  transcript: string;
  summary: string | null;
  reason?: string;
};

export const useVideoSummaries = create<Record<string, VideoSummary>>()(() => ({}));

const PREFIX = "prompt:";
export const promptActionId = (id: string) => `${PREFIX}${id}`;
export const isPromptActionId = (id: string) => id.startsWith(PREFIX);

export function promptActionsForWindow(windowId: string): PromptAction[] {
  if (!chatAvailable()) return [];
  const s = useBrowser.getState();
  const tab = activeTab(s, windowId);
  if (!tab?.url || isIncognitoProfile(tab.profileId)) return [];
  return promptActionsFor(tab.url);
}

function keep(summary: VideoSummary) {
  useVideoSummaries.setState((all) => {
    const next = { ...all, [summary.videoId]: summary };
    const ids = Object.keys(next);
    if (ids.length > KEPT_VIDEOS) for (const id of ids.slice(0, ids.length - KEPT_VIDEOS)) delete next[id];
    return next;
  }, true);
}

export async function summarizeVideo(tabId: string): Promise<VideoSummary | null> {
  const tab = useBrowser.getState().tabs[tabId];
  const videoId = tab ? youtubeVideoId(tab.url) : null;
  if (!tab || !videoId || isIncognitoProfile(tab.profileId)) return null;
  const known = useVideoSummaries.getState()[videoId];
  if (known && known.status !== "unavailable") return known;
  const web = webviews.get(tabId);
  if (!web) return null;
  keep({ videoId, status: "fetching", title: tab.title, transcript: "", summary: null });
  const result = await web.evaluate<TranscriptResult>(transcriptScript(videoId)).catch(() => null);
  if (!result || "error" in result) {
    const reason = result && "error" in result ? result.error : "no answer from the page";
    keep({ videoId, status: "unavailable", title: tab.title, transcript: "", summary: null, reason });
    return useVideoSummaries.getState()[videoId] ?? null;
  }
  const transcript = transcriptText(result.lines);
  keep({ videoId, status: "summarizing", title: result.title, transcript, summary: null });
  const summary = oneShotReady()
    ? await oneShot("videoSummary", { instructions: VIDEO_SUMMARY_INSTRUCTIONS, input: videoSummaryInput(result.title, transcript), maxOutputTokens: MAX_SUMMARY_TOKENS })
    : null;
  keep({ videoId, status: summary ? "ready" : "unavailable", title: result.title, transcript, summary, ...(summary ? {} : { reason: "not summarized" }) });
  return useVideoSummaries.getState()[videoId] ?? null;
}

function pageContext(tabId: string): ChatPageContext | undefined {
  const tab = useBrowser.getState().tabs[tabId];
  if (!tab?.url) return undefined;
  const videoId = youtubeVideoId(tab.url);
  const video = videoId ? useVideoSummaries.getState()[videoId] : undefined;
  return {
    tabId,
    url: tab.url,
    title: tab.customTitle || tab.title,
    ...(video?.transcript ? { transcript: video.transcript } : {}),
    ...(video?.summary ? { summary: video.summary } : {}),
  };
}

export async function runPromptAction(id: string, windowId: string): Promise<void> {
  const action = PROMPT_ACTIONS.find((a) => promptActionId(a.id) === id);
  const tab = activeTab(useBrowser.getState(), windowId);
  if (!action || !tab) return;
  if (!oneShotSignedIn() && !(await signInWithOxy())) return;
  if (action.when === "video" && !useVideoSummaries.getState()[youtubeVideoId(tab.url) ?? ""]?.summary) await summarizeVideo(tab.id);
  openChat({ windowId, prompt: action.prompt, source: action.when === "video" ? "videoSummary" : "promptAction", page: pageContext(tab.id) });
}

export function openChatWithQuery(windowId: string, prompt: string, items: ChatContextItem[] = []): boolean {
  const tab = activeTab(useBrowser.getState(), windowId);
  return openChat({
    windowId,
    prompt,
    source: "commandBar",
    ...(tab?.url && /^https?:/i.test(tab.url) ? { page: pageContext(tab.id) } : {}),
    ...(items.length ? { items } : {}),
  });
}

export function openChatWithSkill(windowId: string, prompt: string, skill: ChatEntrySkill, items: ChatContextItem[] = []): boolean {
  const tab = activeTab(useBrowser.getState(), windowId);
  return openChat({
    windowId,
    prompt,
    source: "skill",
    skill,
    ...(tab?.url && /^https?:/i.test(tab.url) ? { page: pageContext(tab.id) } : {}),
    ...(items.length ? { items } : {}),
  });
}

export function startVideoSummaries(): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let watched: string | null = null;
  const consider = () => {
    const s = useBrowser.getState();
    const windowId = s.ui.focusedWindowId;
    const tab = windowId ? activeTab(s, windowId) : undefined;
    const videoId = tab ? youtubeVideoId(tab.url) : null;
    const key = tab && videoId ? `${tab.id} ${videoId}` : null;
    if (key === watched) return;
    watched = key;
    if (timer) clearTimeout(timer);
    timer = null;
    if (!tab || !videoId || useVideoSummaries.getState()[videoId]) return;
    timer = setTimeout(() => {
      timer = null;
      if (chatAvailable() && oneShotReady() && useBrowser.getState().settings.aiVideoSummaries !== false) void summarizeVideo(tab.id);
    }, DWELL_MS);
  };
  const stop = useBrowser.subscribe((s, prev) => {
    if (s.tabs !== prev.tabs || s.windows !== prev.windows || s.ui.focusedWindowId !== prev.ui.focusedWindowId) consider();
  });
  consider();
  return () => {
    stop();
    if (timer) clearTimeout(timer);
  };
}
