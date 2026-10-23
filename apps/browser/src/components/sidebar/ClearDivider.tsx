import { Symbol } from "@astro-browser/shell";
import { memo } from "react";
import { Pressable, Text, View } from "react-native";
import { useTheme } from "../../lib/theme";
import { useHover } from "../primitives";
import { closeAllTabs } from "./menus";

const CLEAR_DIVIDER_HEIGHT = 16;

export const ClearDivider = memo(function ClearDivider({ windowId, spaced }: { windowId: string; spaced: boolean }) {
  const theme = useTheme();
  const { hovered, hoverProps } = useHover();
  const clear = () => closeAllTabs(windowId);
  return (
    <View style={{ height: CLEAR_DIVIDER_HEIGHT, marginTop: spaced ? 7 : 0, flexDirection: "row", alignItems: "center", paddingLeft: 9, paddingRight: 9 }}>
      <View style={{ flex: 1, height: 1, backgroundColor: theme.divider }} />
      <View {...hoverProps}>
        <Pressable tooltip="Clear unpinned tabs" accessibilityRole="button" accessibilityLabel="Clear unpinned tabs" onAccessibilityTap={clear} onPress={clear}>
          {({ pressed }) => {
            const color = hovered && !pressed ? theme.textPrimary : theme.textSecondary;
            return (
              <View style={{ height: CLEAR_DIVIDER_HEIGHT, flexDirection: "row", alignItems: "center", paddingLeft: 8 }}>
                <Symbol name="arrow.down" size={9} weight="bold" color={color} style={{ width: 8, height: 11, marginRight: 3 }} />
                <Text style={{ fontSize: 10, fontWeight: "600", color }}>Clear</Text>
              </View>
            );
          }}
        </Pressable>
      </View>
    </View>
  );
});
