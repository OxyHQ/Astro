import { create } from "zustand";
import { dropApprovals } from "../chat/approvals";

export type AgentRun = {
  tabId: string;
  status: string;
  busy: boolean;
  steps: number;
  turnSteps: number;
  continuations: number;
  lastStepAt: number;
  lastOutputAt: number;
};

type AgentState = { runs: Record<string, AgentRun>; stopped: Record<string, boolean> };

export const useAgent = create<AgentState>()(() => ({ runs: {}, stopped: {} }));

export const AGENT_CONTINUE = "Continue the task in my tabs.";
export const MAX_CONTINUATIONS = 6;

const stoppers = new Map<string, () => void>();

let seq = 0;

export function registerAgentStopper(windowId: string, stop: () => void) {
  stoppers.set(windowId, stop);
  return () => {
    if (stoppers.get(windowId) === stop) stoppers.delete(windowId);
  };
}

export const agentStopped = (windowId: string) => !!useAgent.getState().stopped[windowId];

function patchRun(windowId: string, patch: (run: AgentRun | undefined) => AgentRun | undefined) {
  useAgent.setState((s) => {
    const next = patch(s.runs[windowId]);
    const runs = { ...s.runs };
    if (next) runs[windowId] = next;
    else delete runs[windowId];
    return { runs };
  });
}

export function beginStep(windowId: string, tabId: string, status: string) {
  const now = ++seq;
  patchRun(windowId, (run) => ({
    tabId,
    status,
    busy: true,
    steps: (run?.steps ?? 0) + 1,
    turnSteps: (run?.turnSteps ?? 0) + 1,
    continuations: run?.continuations ?? 0,
    lastStepAt: now,
    lastOutputAt: run?.lastOutputAt ?? 0,
  }));
}

export function endStep(windowId: string) {
  patchRun(windowId, (run) => (run ? { ...run, busy: false, lastStepAt: ++seq } : run));
}

export function noteOutput(windowId: string) {
  if (useAgent.getState().runs[windowId]) patchRun(windowId, (run) => (run ? { ...run, lastOutputAt: ++seq } : run));
}

export function endRun(windowId: string) {
  patchRun(windowId, () => undefined);
}

export function shouldContinue(windowId: string, outcome: "completed" | "failed" | "cancelled" | undefined): boolean {
  const run = useAgent.getState().runs[windowId];
  if (!run || agentStopped(windowId) || outcome !== "completed") return false;
  return run.turnSteps > 0 && run.lastStepAt > run.lastOutputAt && run.continuations < MAX_CONTINUATIONS;
}

export function noteContinuation(windowId: string) {
  patchRun(windowId, (run) => (run ? { ...run, turnSteps: 0, continuations: run.continuations + 1, status: "Continuing…", busy: true } : run));
}

export function stopAgent(windowId: string) {
  useAgent.setState((s) => ({ stopped: { ...s.stopped, [windowId]: true } }));
  dropApprovals(windowId);
  endRun(windowId);
  stoppers.get(windowId)?.();
}

export function resetAgentStop(windowId: string) {
  if (!useAgent.getState().stopped[windowId]) return;
  useAgent.setState((s) => {
    const stopped = { ...s.stopped };
    delete stopped[windowId];
    return { stopped };
  });
}
