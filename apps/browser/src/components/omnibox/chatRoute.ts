import type { CommandAction, Suggestion } from "@astro-browser/core";
import { useMemo } from "react";
import { useChatAvailable } from "../../ai/chatEntry";
import { openChatWithQuery, openChatWithSkill, promptActionId, promptActionsForWindow } from "../../ai/pagePrompts";
import { ASTRO_COMMANDS, slashCandidates, useSkills, type SlashCandidate } from "../../ai/skills/skills";
import { ON_MAC } from "../../lib/device";
import { signInWithOxy, useOxySession } from "../../oxy/session";
import { useBrowser } from "../../store/browser";
import { openSkillsPage } from "../pages/urls";

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

const SKILLS_ACTIONS: CommandAction[] = [
  { id: "astroSkills:yours", title: "Skills", icon: "sparkles", hint: "Chat", keywords: ["skills", "slash commands", "gallery"] },
  { id: "astroSkills:new", title: "New Skill", icon: "wand.and.stars", hint: "Chat", keywords: ["create skill", "skill builder"] },
  { id: "astroSkills:gallery", title: "Skills Gallery", icon: "sparkles", hint: "Chat", keywords: ["skills gallery", "browse skills"] },
];

export const skillsBarActions = (signIn: boolean): CommandAction[] => (signIn ? [] : SKILLS_ACTIONS);

export const isSkillsActionId = (id: string) => id.startsWith("astroSkills:");

export function runSkillsAction(id: string, windowId: string) {
  const route = id.slice("astroSkills:".length) as "yours" | "new" | "gallery";
  openSkillsPage(windowId, route);
}

export const forcesChat = (keys: { metaKey?: boolean; altKey?: boolean; ctrlKey?: boolean }) =>
  !!keys.ctrlKey && (ON_MAC ? !!keys.metaKey : !!keys.altKey);

export async function sendToChat(windowId: string, query: string): Promise<boolean> {
  if (!useOxySession.getState().account && !(await signInWithOxy())) return false;
  return openChatWithQuery(windowId, query);
}

const BAR_SLASH = /^\/([a-z0-9-]*)(?:\s+([\s\S]*))?$/;
const SLASH_PREFIX = "slash:";

export const isSlashActionId = (id: string) => id.startsWith(SLASH_PREFIX);

export function slashBarRows(text: string, signIn: boolean): Suggestion[] {
  const m = BAR_SLASH.exec(text.trimStart());
  if (!m) return [];
  const name = m[1] ?? "";
  const rest = (m[2] ?? "").trim();
  const installed = useSkills.getState().installed;
  const all = slashCandidates(installed, name, { limit: 20 });
  const exact = all.filter((c) => c.name === name);
  const list = rest ? (exact.length ? exact : all.filter((c) => c.name.startsWith(name)).slice(0, 3)) : all.slice(0, 6);
  return list.map((c) => ({
    kind: "action",
    id: `${SLASH_PREFIX}${c.kind === "command" ? `command:${c.command}` : `skill:${c.name}`}\u0000${rest}`,
    title: rest ? `/${c.name} ${rest}` : `/${c.name} — ${c.title}`,
    icon: c.kind === "command" ? c.icon : "sparkles",
    hint: signIn ? "Sign in" : "Skill",
  }));
}

export async function runSlashAction(id: string, windowId: string): Promise<boolean> {
  const [head = "", rest = ""] = id.slice(SLASH_PREFIX.length).split("\u0000");
  const [kind, name = ""] = head.split(/:(.*)/s);
  let candidate: SlashCandidate | undefined;
  if (kind === "command") {
    const c = ASTRO_COMMANDS.find((x) => x.command === name);
    if (c) candidate = { kind: "command", key: head, command: c.command, name: c.name, title: c.title, description: c.description, icon: c.icon };
  } else {
    const k = useSkills.getState().installed.find((x) => x.name === name);
    if (k) candidate = { kind: "skill", key: head, name: k.name, title: k.displayName || k.name, description: k.description, icon: k.icon, auto: k.autoInvoke };
  }
  if (!candidate) return false;
  if (!useOxySession.getState().account && !(await signInWithOxy())) return false;
  return openChatWithSkill(windowId, rest, { name: candidate.name, title: candidate.title, ...(candidate.kind === "command" ? { command: candidate.command } : {}) });
}
