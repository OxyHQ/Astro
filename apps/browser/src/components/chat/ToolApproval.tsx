import { AiChatMessageLine } from "@oxy.so/bloom/ai-chat";
import { Questionnaire } from "@oxy.so/bloom/questionnaire";
import { View } from "react-native";
import { answerApproval, useApprovals, type Approval, type ApprovalChoice, type ApprovalOption } from "../../ai/chat/approvals";
import { Favicon } from "../primitives";

const QUESTION: Record<Approval["kind"], (n: number) => string> = {
  open: (n) => `Open ${n} tabs?`,
  close: (n) => (n === 1 ? "Close this tab?" : `Close ${n} tabs?`),
  read: () => "Let Alia read this tab?",
  act: () => "Let Alia use this site?",
  confirm: () => "Allow this action?",
  fill: (n) => (n === 1 ? "Fill 1 field?" : `Fill ${n} fields?`),
  sensitive: () => "Share this site with Alia?",
};

const ANSWERS: ApprovalOption[] = [
  { value: "allow", label: "Allow" },
  { value: "always", label: "Always Allow in This Chat" },
  { value: "deny", label: "Don't Allow" },
];

const SHOWN: Record<Approval["kind"], number> = { open: 5, close: 5, read: 5, act: 1, confirm: 1, fill: 40, sensitive: 1 };

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
  const shown = approval.tabs.slice(0, SHOWN[approval.kind]);
  const fields = approval.kind === "fill";
  const detail = (
    <View style={{ gap: fields ? 6 : 4 }}>
      {approval.note ? (
        <AiChatMessageLine tone="secondary" selectable={false}>
          {approval.note}
        </AiChatMessageLine>
      ) : null}
      {shown.map((item, i) =>
        fields ? (
          <View key={`${item.title}${i}`} testID={`approval-field-${i}`} style={{ gap: 1 }}>
            <AiChatMessageLine tone="secondary" selectable={false}>
              {item.title}
            </AiChatMessageLine>
            <AiChatMessageLine selectable>{item.detail || "(empty)"}</AiChatMessageLine>
          </View>
        ) : (
          <View key={`${item.url}${i}`} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Favicon url={item.url} size={12} />
            <AiChatMessageLine tone="secondary" selectable={false} style={{ flex: 1 }}>
              {item.title}
            </AiChatMessageLine>
          </View>
        ),
      )}
      {approval.tabs.length > shown.length && (
        <AiChatMessageLine tone="secondary" selectable={false}>
          and {approval.tabs.length - shown.length} more
        </AiChatMessageLine>
      )}
    </View>
  );
  const options = approval.options ?? ANSWERS;
  return (
    <Questionnaire
      testID={`approval-${approval.id}`}
      select="single"
      footer={false}
      advanceDelay={0}
      questions={[{ id: approval.id, question: approval.question ?? QUESTION[approval.kind](approval.tabs.length), detail, options }]}
      onComplete={(answers) => {
        const value = answers[approval.id]?.values[0] as ApprovalChoice | undefined;
        if (value) answerApproval(approval.id, value);
      }}
    />
  );
}
