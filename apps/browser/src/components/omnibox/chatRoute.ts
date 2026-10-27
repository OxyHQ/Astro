import type { CommandAction } from "@astro-browser/core";
import { useMemo } from "react";
import { useChatAvailable } from "../../ai/chatEntry";
import { openChatWithQuery, promptActionId, promptActionsForWindow } from "../../ai/pagePrompts";
import { ON_MAC } from "../../lib/device";
import { signInWithOxy, useOxySession } from "../../oxy/session";
import { useBrowser } from "../../store/browser";

export function useChatRoute(windowId: string): { signIn: boolean } | null {
  const on = useBrowser((s) => s.settings.aiCommandBarChat !== false && !s.windows[windowId]?.incognito);
  const chat = useChatAvailable();
  const signedIn = useOxySession((s) => !!s.account);
  const offersSignIn = useOxySession((s) => s.available && s.resolved && !s.account);
  return useMemo(() => (on && chat && (signedIn || offersSignIn) ? { signIn: !signedIn } : null), [on, chat, signedIn, offersSignIn]);
}

export function promptBarActions(windowId: string, signIn: boolean): CommandAction[] {
  return promptActionsForWindow(windowId).map((a) => ({
    id: promptActionId(a.id),
    title: a.title,
    icon: a.icon,
    hint: signIn ? "Sign in" : "Chat",
    keywords: a.keywords,
  }));
}

export const forcesChat = (keys: { metaKey?: boolean; altKey?: boolean; ctrlKey?: boolean }) =>
  !!keys.ctrlKey && (ON_MAC ? !!keys.metaKey : !!keys.altKey);

export async function sendToChat(windowId: string, query: string): Promise<boolean> {
  if (!useOxySession.getState().account && !(await signInWithOxy())) return false;
  return openChatWithQuery(windowId, query);
}
