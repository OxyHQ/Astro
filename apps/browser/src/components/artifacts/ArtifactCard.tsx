import { Card } from "@oxy.so/bloom/card";
import { RiExternalLinkLine } from "@oxy.so/bloom/icons/RiExternalLinkLine";
import { Item } from "@oxy.so/bloom/item";
import { useTheme } from "@oxy.so/bloom/theme";
import { View } from "react-native";
import { KIND_LABEL, type Artifact } from "../../ai/artifacts/artifacts";
import { KIND_GLYPH } from "./glyphs";

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
  const { colors } = useTheme();
  const Glyph = KIND_GLYPH[artifact.body.kind];
  return (
    <Card border="hairline" radius="radius-12" clipContent>
      <Item
        accessibilityRole="button"
        accessibilityLabel={`Open ${artifact.title}`}
        onPress={onOpen}
        leading={
          <View style={{ width: 34, height: 34, borderRadius: 9, alignItems: "center", justifyContent: "center", backgroundColor: colors.backgroundTertiary }}>
            <Glyph width={18} height={18} fill={colors.icon} />
          </View>
        }
        title={artifact.title}
        subtitle={`${KIND_LABEL[artifact.body.kind]} · ${summary(artifact)}`}
        trailing={<RiExternalLinkLine width={16} height={16} fill={colors.textSecondary} />}
      />
    </Card>
  );
}
