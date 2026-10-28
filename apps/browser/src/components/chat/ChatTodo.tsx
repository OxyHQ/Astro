import { AgentProgress } from "@oxy.so/bloom/agent-progress";
import type { Message } from "@alia.onl/sdk/model";
import { useMemo } from "react";
import { planOf, stepsDone, type TurnState } from "../../ai/chat/questions";

export function ChatTodo({ message, turn }: { message: Message; turn: TurnState }) {
  const plan = useMemo(() => planOf(message), [message.plan, message.toolInvocations]);
  const tools = message.toolInvocations ?? [];
  const done = plan ? stepsDone(plan.steps, tools, plan.after, turn) : 0;
  const labels = useMemo(() => plan?.steps.map((s) => s.action) ?? [], [plan]);
  if (!plan) return null;
  const live = turn === "running" || turn === "queued";
  return (
    <AgentProgress
      testID={`todo-${message.id}`}
      steps={labels}
      completedCount={done}
      paused={!live}
      style={{ width: "100%" }}
      labels={{ stepsLeft: (n) => (n === 1 ? "1 to-do left" : `${n} to-dos left`), allCompleted: "All to-dos done" }}
    />
  );
}
