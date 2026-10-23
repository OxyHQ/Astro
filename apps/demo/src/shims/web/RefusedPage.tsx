import { Symbol } from "@astro-browser/shell";
import { StyleSheet, Text, View } from "react-native";
import { PromptButton } from "../../../../browser/src/components/layout/controls";
import { useTheme } from "../../../../browser/src/lib/theme";
import type { PageTheme } from "../../pages";

export const REFUSED_PAGE_THEME: { light: PageTheme; dark: PageTheme } = {
  light: { color: "#F6F5F6", source: "background" },
  dark: { color: "#1C1A1B", source: "background" },
};

const DOWNLOAD_URL = "https://astro.oxy.so";

export function RefusedPage({ host }: { host: string }) {
  const theme = useTheme();
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: REFUSED_PAGE_THEME[theme.dark ? "dark" : "light"].color, alignItems: "center", justifyContent: "center", padding: 24 }]}>
      <Symbol name="macwindow" size={30} weight="light" color={theme.textSecondary} style={{ width: 44, height: 40, marginBottom: 14 }} />
      <Text style={{ fontSize: 17, fontWeight: "600", color: theme.textPrimary, marginBottom: 6 }}>This one opens in Astro, not in a demo</Text>
      <Text style={{ fontSize: 13, color: theme.textSecondary, textAlign: "center", maxWidth: 340, marginBottom: 18 }}>
        {host} won't load inside another web page. In Astro it's a tab like any other.
      </Text>
      <PromptButton title="Download Astro" primary onPress={() => void window.open(DOWNLOAD_URL, "_blank", "noopener")} />
    </View>
  );
}
