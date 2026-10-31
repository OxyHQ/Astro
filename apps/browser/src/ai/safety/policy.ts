import { engineCall } from "@astro-browser/astrocore";
import { create } from "zustand";
import { DEFAULT_POLICY, parsePolicy, redact, sensitivity, type ContentPolicy, type Sensitivity } from "./sensitive";

type PolicyState = { policy: ContentPolicy; managed: boolean; loaded: boolean };

export const useContentPolicy = create<PolicyState>()(() => ({ policy: DEFAULT_POLICY, managed: false, loaded: false }));

let loading: Promise<void> | null = null;

export function loadContentPolicy(): Promise<void> {
  loading ??= engineCall<{ policy?: unknown }>("ac_ai_policy", "", {})
    .then((answer) => {
      const managed = answer?.policy !== undefined && answer.policy !== null;
      useContentPolicy.setState({ policy: managed ? parsePolicy(answer.policy) : DEFAULT_POLICY, managed, loaded: true });
    })
    .catch(() => useContentPolicy.setState({ loaded: true }));
  return loading;
}

export function setContentPolicy(raw: unknown) {
  useContentPolicy.setState({ policy: raw == null ? DEFAULT_POLICY : parsePolicy(raw), managed: raw != null, loaded: true });
}

export const contentPolicy = () => useContentPolicy.getState().policy;

export const siteSensitivity = (url: string): Sensitivity | null => sensitivity(url, contentPolicy());

export const redactForModel = (text: string) => redact(text, contentPolicy());
