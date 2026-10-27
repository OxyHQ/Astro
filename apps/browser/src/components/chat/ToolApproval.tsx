import { Pressable, Text, View } from "react-native";
import { answerApproval, useApprovals, type Approval } from "../../ai/chat/hostTools";
import { useTheme } from "../../lib/theme";
import { Favicon } from "../primitives";

const QUESTION: Record<Approval["kind"], (n: number) => string> = {
  open: (n) => `Open ${n} tabs?`,
  close: (n) => (n === 1 ? "Close this tab?" : `Close ${n} tabs?`),
  read: () => "Let Alia read this tab?",
};

export function ToolApprovals({ windowId }: { windowId: string }) {
  const all = useApprovals((s) => s.pending);
  const pending = all.filter((a) => a.windowId === windowId);
  if (!pending.length) return null;
  return (
    <View style={{ paddingHorizontal: 10, gap: 6 }}>
      {pending.map((approval) => (
        <ApprovalCard key={approval.id} approval={approval} />
      ))}
    </View>
  );
}

function ApprovalCard({ approval }: { approval: Approval }) {
  const theme = useTheme();
  const shown = approval.tabs.slice(0, 5);
  return (
    <View
      accessibilityRole="alert"
      style={{
        borderRadius: 14,
        padding: 12,
        gap: 8,
        borderWidth: 1,
        borderColor: theme.dark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)",
        backgroundColor: theme.dark ? "rgba(40,38,39,0.96)" : "rgba(255,255,255,0.96)",
      }}
    >
      <Text style={{ fontSize: 13, fontWeight: "600", color: theme.textPrimary }}>{QUESTION[approval.kind](approval.tabs.length)}</Text>
      <View style={{ gap: 4 }}>
        {shown.map((tab, i) => (
          <View key={`${tab.url}${i}`} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Favicon url={tab.url} size={12} />
            <Text numberOfLines={1} style={{ flex: 1, fontSize: 12, color: theme.textSecondary }}>
              {tab.title}
            </Text>
          </View>
        ))}
        {approval.tabs.length > shown.length && (
          <Text style={{ fontSize: 12, color: theme.textSecondary }}>and {approval.tabs.length - shown.length} more</Text>
        )}
      </View>
      <View style={{ flexDirection: "row", gap: 6, justifyContent: "flex-end", flexWrap: "wrap" }}>
        <ApprovalButton label="Don't Allow" onPress={() => answerApproval(approval.id, "deny")} />
        <ApprovalButton label="Always Allow in This Chat" onPress={() => answerApproval(approval.id, "always")} />
        <ApprovalButton label="Allow" primary onPress={() => answerApproval(approval.id, "allow")} />
      </View>
    </View>
  );
}

function ApprovalButton({ label, primary, onPress }: { label: string; primary?: boolean; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({
        height: 28,
        paddingHorizontal: 10,
        borderRadius: 8,
        justifyContent: "center",
        opacity: pressed ? 0.8 : 1,
        backgroundColor: primary ? theme.accent : theme.dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)",
      })}
    >
      <Text style={{ fontSize: 12, fontWeight: "600", color: primary ? "#FFFFFF" : theme.textPrimary }}>{label}</Text>
    </Pressable>
  );
}
