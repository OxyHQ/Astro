import { create } from "zustand";

export type ApprovalKind = "open" | "close" | "read" | "act" | "confirm" | "fill" | "sensitive";

export type ApprovalItem = { tabId?: string; title: string; url: string; detail?: string };

export type ApprovalOption = { value: "allow" | "always" | "deny"; label: string };

export type Approval = {
  id: string;
  windowId: string;
  kind: ApprovalKind;
  tabs: ApprovalItem[];
  question?: string;
  note?: string;
  options?: ApprovalOption[];
};

export type ApprovalChoice = ApprovalOption["value"];

type Approvals = { pending: Approval[]; allowed: Record<string, ApprovalKind[]> };

export const useApprovals = create<Approvals>()(() => ({ pending: [], allowed: {} }));

const answers = new Map<string, (choice: ApprovalChoice) => void>();

export function answerApproval(id: string, choice: ApprovalChoice) {
  const answer = answers.get(id);
  answers.delete(id);
  useApprovals.setState((s) => ({ pending: s.pending.filter((a) => a.id !== id) }));
  answer?.(choice);
}

export function dropApprovals(windowId: string) {
  for (const approval of useApprovals.getState().pending.filter((a) => a.windowId === windowId)) answerApproval(approval.id, "deny");
}

export function ask(windowId: string, question: Omit<Approval, "id" | "windowId">): Promise<ApprovalChoice> {
  const id = `${question.kind}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  return new Promise((resolve) => {
    answers.set(id, resolve);
    useApprovals.setState((s) => ({ pending: [...s.pending, { ...question, id, windowId }] }));
  });
}

export const chatKey = (windowId: string, conversation: string | null) => conversation ?? `window:${windowId}`;

export function allowedInChat(key: string, kind: ApprovalKind) {
  return !!useApprovals.getState().allowed[key]?.includes(kind);
}

export function allowInChat(key: string, kind: ApprovalKind) {
  useApprovals.setState((s) => ({ allowed: { ...s.allowed, [key]: [...(s.allowed[key] ?? []), kind] } }));
}

export async function approve(windowId: string, kind: ApprovalKind, tabs: ApprovalItem[], conversation: string | null): Promise<boolean> {
  const key = chatKey(windowId, conversation);
  if (allowedInChat(key, kind)) return true;
  const choice = await ask(windowId, { kind, tabs });
  if (choice === "always") allowInChat(key, kind);
  return choice !== "deny";
}
