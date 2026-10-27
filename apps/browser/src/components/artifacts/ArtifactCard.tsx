import { Symbol } from "@astro-browser/shell";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { KIND_ICON, KIND_LABEL, type Artifact } from "../../ai/artifacts/artifacts";
import { useTheme } from "../../lib/theme";
import { useHover } from "../primitives";

function summary(artifact: Artifact): string {
  const b = artifact.body;
  switch (b.kind) {
    case "report": {
      const words = b.markdown.split(/\s+/).filter(Boolean).length;
      return `${words} word${words === 1 ? "" : "s"}`;
    }
    case "deck":
      return `${b.slides.length} slide${b.slides.length === 1 ? "" : "s"}`;
    case "dashboard":
      return `${b.widgets.length} widget${b.widgets.length === 1 ? "" : "s"}`;
    case "table":
      return `${b.rows.length} row${b.rows.length === 1 ? "" : "s"}`;
    case "code":
      return b.language || "Code";
  }
}

export function ArtifactCard({ artifact, onOpen }: { artifact: Artifact; onOpen: () => void }) {
  const theme = useTheme();
  const { hovered, hoverProps } = useHover();
  return (
    <View {...hoverProps}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open ${artifact.title}`}
        onPress={onOpen}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          padding: 10,
          borderRadius: 12,
          borderWidth: StyleSheet.hairlineWidth * 2,
          borderColor: theme.dark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.1)",
          backgroundColor: hovered ? (theme.dark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.035)") : theme.dark ? "rgba(255,255,255,0.03)" : "#FFFFFF",
        }}
      >
        <View
          style={{
            width: 34,
            height: 34,
            borderRadius: 9,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: theme.dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)",
          }}
        >
          <Symbol name={KIND_ICON[artifact.body.kind]} size={14} color={theme.icon} style={{ width: 18, height: 18 }} />
        </View>
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={{ fontSize: 13.5, fontWeight: "600", color: theme.textPrimary }}>
            {artifact.title}
          </Text>
          <Text numberOfLines={1} style={{ fontSize: 12, color: theme.textSecondary }}>
            {KIND_LABEL[artifact.body.kind]} · {summary(artifact)}
          </Text>
        </View>
        <Symbol name="arrow.up.forward.square" size={12} color={theme.textSecondary} style={{ width: 16, height: 16 }} />
      </Pressable>
    </View>
  );
}
