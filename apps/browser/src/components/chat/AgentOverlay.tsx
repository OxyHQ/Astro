import { AgentProgressLoadingText } from "@oxy.so/bloom/agent-progress";
import { Button } from "@oxy.so/bloom/button";
import { Surface } from "@oxy.so/bloom/surface";
import { useTheme } from "@oxy.so/bloom/theme";
import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import { stopAgent, useAgent } from "../../ai/agent/session";

export const AGENT_GLOW_PERIOD_MS = 1600;

export function AgentOverlay({ windowId, tabId, radius }: { windowId: string; tabId: string; radius: number }) {
  const run = useAgent((s) => (s.runs[windowId]?.tabId === tabId ? s.runs[windowId] : undefined));
  const theme = useTheme();
  const pulse = useRef(new Animated.Value(0)).current;
  const working = !!run;

  useEffect(() => {
    if (!working) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: AGENT_GLOW_PERIOD_MS / 2, easing: Easing.inOut(Easing.quad), useNativeDriver: false }),
        Animated.timing(pulse, { toValue: 0, duration: AGENT_GLOW_PERIOD_MS / 2, easing: Easing.inOut(Easing.quad), useNativeDriver: false }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [working, pulse]);

  if (!run) return null;
  const accent = theme.colors.primary;
  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill} testID="agent-overlay">
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          { borderRadius: radius, borderWidth: 3, borderColor: accent, opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.45, 1] }) },
        ]}
      />
      <View pointerEvents="box-none" style={{ position: "absolute", left: 0, right: 0, bottom: 16, alignItems: "center" }}>
        <Surface radius={18} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingLeft: 14, paddingRight: 6, paddingVertical: 6, maxWidth: 420 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: accent }} />
          <View style={{ flexShrink: 1, minWidth: 120 }}>
            <AgentProgressLoadingText variant="body-medium" testID="agent-status">
              {run.status || "Alia is working…"}
            </AgentProgressLoadingText>
          </View>
          <Button size="sm" appearance="subtle" tone="neutral" onPress={() => stopAgent(windowId)} testID="agent-stop" accessibilityLabel="Stop Alia">
            Stop
          </Button>
        </Surface>
      </View>
    </View>
  );
}
