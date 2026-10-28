import { create } from "zustand";
import { useBrowser } from "../../store/browser";
import { ask, chatKey } from "../chat/approvals";
import { siteSensitivity } from "./policy";
import { sensitiveKindName, type Sensitivity } from "./sensitive";

export type ShareState = "free" | "shared" | "withheld" | "blocked";

type Consent = { shared: Record<string, string[]> };

export const useShareConsent = create<Consent>()(() => ({ shared: {} }));

const alwaysShared = (host: string) => (useBrowser.getState().settings.aiSharedSites ?? []).includes(host);

export function shareStateOf(url: string, key: string): { state: ShareState; sensitivity: Sensitivity | null } {
  const found = siteSensitivity(url);
  if (!found) return { state: "free", sensitivity: null };
  if (found.blocked) return { state: "blocked", sensitivity: found };
  if (alwaysShared(found.host) || useShareConsent.getState().shared[key]?.includes(found.host)) return { state: "shared", sensitivity: found };
  return { state: "withheld", sensitivity: found };
}

export function shareInChat(key: string, host: string) {
  useShareConsent.setState((s) => ({ shared: { ...s.shared, [key]: [...new Set([...(s.shared[key] ?? []), host])] } }));
}

export function shareAlways(host: string) {
  const s = useBrowser.getState();
  const sites = new Set(s.settings.aiSharedSites ?? []);
  sites.add(host);
  s.updateSettings({ aiSharedSites: [...sites] });
}

export function withheldNote(found: Sensitivity): string {
  return found.blocked
    ? `${found.host} is blocked for AI by the person's organization: never ask for or describe its content.`
    : `${found.host} is ${sensitiveKindName(found.kind)}, so its content is not shared by default. If you need it, call read_tab with its id: the person will be asked to share it.`;
}

export async function consentToShare(
  windowId: string,
  conversation: string | null,
  tab: { tabId?: string; title: string; url: string },
): Promise<boolean> {
  const key = chatKey(windowId, conversation);
  const { state, sensitivity } = shareStateOf(tab.url, key);
  if (state === "free" || state === "shared") return true;
  if (state === "blocked" || !sensitivity) return false;
  const choice = await ask(windowId, {
    kind: "sensitive",
    tabs: [tab],
    question: `Share ${sensitivity.host} with Alia?`,
    note: `It’s ${sensitiveKindName(sensitivity.kind)}. Its content stays on this device unless you share it.`,
    options: [
      { value: "allow", label: "Share in This Chat" },
      { value: "always", label: "Always Share This Site" },
      { value: "deny", label: "Don’t Share" },
    ],
  });
  if (choice === "deny") return false;
  if (choice === "always") shareAlways(sensitivity.host);
  else shareInChat(key, sensitivity.host);
  return true;
}
