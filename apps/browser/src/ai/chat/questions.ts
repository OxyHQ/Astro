import type { Message, ToolInvocation } from "@alia.onl/sdk/model";

export const ASK_USER_QUESTION_TOOL = "askUserQuestion";
export const PLAN_PREVIEW_TOOL = "planPreview";

export const isQuietTool = (name: string) => name === ASK_USER_QUESTION_TOOL || name === PLAN_PREVIEW_TOOL;

export type AskedOption = { label: string; description?: string };
export type AskedQuestion = { question: string; options: AskedOption[]; multiSelect: boolean };
export type QuestionAnswer = { picked: number[]; other?: string };
export type Asked = { toolCallId: string; questions: AskedQuestion[] };

const text = (value: unknown): string | null => (typeof value === "string" && value.trim() !== "" ? value.trim() : null);

export function askedQuestions(inv: Pick<ToolInvocation, "toolName" | "state" | "args">): AskedQuestion[] | null {
  if (inv.toolName !== ASK_USER_QUESTION_TOOL || inv.state !== "result") return null;
  const raw = (inv.args as { questions?: unknown } | undefined)?.questions;
  if (!Array.isArray(raw)) return null;
  const questions: AskedQuestion[] = [];
  for (const item of raw) {
    const q = item as { question?: unknown; options?: unknown; multiSelect?: unknown };
    const question = text(q?.question);
    if (question === null || !Array.isArray(q.options)) return null;
    const options: AskedOption[] = [];
    for (const o of q.options) {
      const label = text((o as { label?: unknown })?.label);
      if (label === null) return null;
      const description = text((o as { description?: unknown }).description);
      options.push(description === null ? { label } : { label, description });
    }
    if (options.length < 2) return null;
    questions.push({ question, options, multiSelect: q.multiSelect === true });
  }
  return questions.length ? questions : null;
}

export function askedIn(message: Pick<Message, "toolInvocations">): Asked | null {
  for (const inv of message.toolInvocations ?? []) {
    const questions = askedQuestions(inv);
    if (questions) return { toolCallId: inv.toolCallId, questions };
  }
  return null;
}

export function pendingQuestions(messages: readonly Pick<Message, "role" | "toolInvocations">[], isStreaming: boolean): Asked | null {
  const last = messages.at(-1);
  if (isStreaming || last?.role !== "assistant") return null;
  return askedIn(last);
}

export function formatAnswers(questions: AskedQuestion[], answers: QuestionAnswer[]): string {
  return questions
    .map((q, i) => {
      const answer = answers[i];
      const parts = [...(answer?.picked ?? []).map((index) => q.options[index]?.label), answer?.other?.trim()].filter((part): part is string => !!part);
      return `${q.question}\n→ ${parts.length ? parts.join(", ") : "(skipped)"}`;
    })
    .join("\n\n");
}

export type PlanStep = { action: string; description: string; toolName?: string };

function stepsOf(value: unknown): PlanStep[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((step) => {
    const s = step as { action?: unknown; description?: unknown; toolName?: unknown };
    const action = text(s?.action);
    if (!action) return [];
    const toolName = text(s.toolName);
    return [{ action, description: text(s.description) ?? "", ...(toolName ? { toolName } : {}) }];
  });
}

export function planOf(message: Pick<Message, "toolInvocations"> & { plan?: { steps?: unknown } }): { steps: PlanStep[]; after: number } | null {
  const tools = message.toolInvocations ?? [];
  const index = tools.findIndex((t) => t.toolName === PLAN_PREVIEW_TOOL);
  const fromPlan = stepsOf(message.plan?.steps);
  const steps = fromPlan.length ? fromPlan : index >= 0 ? stepsOf(tools[index]!.args?.steps) : [];
  if (steps.length < 2) return null;
  if (index >= 0 && tools[index]!.state === "result" && (tools[index]!.result as { shown?: unknown } | undefined)?.shown === false) return null;
  return { steps, after: index };
}

const bareTool = (name: string) => name.replace(/^host_[a-z0-9]+__/i, "").toLowerCase();

export type TurnState = "running" | "queued" | "completed" | "cancelled" | "failed";

export function stepsDone(steps: PlanStep[], tools: readonly Pick<ToolInvocation, "toolName" | "state">[], after: number, turn: TurnState): number {
  if (turn === "completed") return steps.length;
  let done = 0;
  for (const tool of tools.slice(after + 1)) {
    if (tool.state !== "result" || isQuietTool(tool.toolName)) continue;
    const name = bareTool(tool.toolName);
    const match = steps.findIndex((step, i) => i >= done && !!step.toolName && bareTool(step.toolName) === name);
    if (match >= 0) done = match + 1;
  }
  return Math.min(done, steps.length);
}
