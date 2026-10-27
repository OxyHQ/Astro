import { AiChatMessageLine } from "@oxy.so/bloom/ai-chat";
import { Questionnaire } from "@oxy.so/bloom/questionnaire";
import { View } from "react-native";
import { answerApproval, useApprovals, type Approval } from "../../ai/chat/hostTools";
import { Favicon } from "../primitives";

const QUESTION: Record<Approval["kind"], (n: number) => string> = {
  open: (n) => `Open ${n} tabs?`,
  close: (n) => (n === 1 ? "Close this tab?" : `Close ${n} tabs?`),
  read: () => "Let Alia read this tab?",
};

const ANSWERS = [
  { value: "allow", label: "Allow" },
  { value: "always", label: "Always Allow in This Chat" },
  { value: "deny", label: "Don't Allow" },
] as const;

type Answer = (typeof ANSWERS)[number]["value"];

export function ToolApprovals({ windowId }: { windowId: string }) {
  const all = useApprovals((s) => s.pending);
  const pending = all.filter((a) => a.windowId === windowId);
  if (!pending.length) return null;
  return (
    <View style={{ gap: 6 }}>
      {pending.map((approval) => (
        <ApprovalQuestion key={approval.id} approval={approval} />
      ))}
    </View>
  );
}

function ApprovalQuestion({ approval }: { approval: Approval }) {
  const shown = approval.tabs.slice(0, 5);
  const detail = (
    <View style={{ gap: 4 }}>
      {shown.map((tab, i) => (
        <View key={`${tab.url}${i}`} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Favicon url={tab.url} size={12} />
          <AiChatMessageLine tone="secondary" selectable={false} style={{ flex: 1 }}>
            {tab.title}
          </AiChatMessageLine>
        </View>
      ))}
      {approval.tabs.length > shown.length && (
        <AiChatMessageLine tone="secondary" selectable={false}>
          and {approval.tabs.length - shown.length} more
        </AiChatMessageLine>
      )}
    </View>
  );
  return (
    <Questionnaire
      testID={`approval-${approval.id}`}
      select="single"
      footer={false}
      advanceDelay={0}
      questions={[{ id: approval.id, question: QUESTION[approval.kind](approval.tabs.length), detail, options: ANSWERS }]}
      onComplete={(answers) => {
        const value = answers[approval.id]?.values[0] as Answer | undefined;
        if (value) answerApproval(approval.id, value);
      }}
    />
  );
}
