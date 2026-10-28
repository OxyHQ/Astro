import { Surface, Symbol, VisualEffect } from "@astro-browser/shell";
import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Pressable, StyleSheet, Text, View } from "react-native";
import { dismissConnectAppsUpsell, dismissMorningBrief, startMorningBrief } from "../../ai/work/homeState";
import type { HomeCard } from "../../ai/work/home";
import { hex, useTheme } from "../../lib/theme";
import { openInternalPage } from "../pages/urls";
import { useHover } from "../primitives";

export const HOME_CARD_HEIGHT = 58;

const APP_GLYPHS = ["envelope", "calendar", "folder", "doc.text", "bubble.left"];

const COPY = {
  connectApps: { title: "Connect your apps", subtitle: "Ask Chat about your mail, calendar, docs and issues.", action: "Connect" },
  morningBrief: { title: "Your Morning Brief", subtitle: "Today's meetings, what needs you and where you left off.", action: "Start My Day" },
} as const;

export function HomeCardSlot({
  card,
  windowId,
  profileId,
  frame,
  hidden,
}: {
  card: HomeCard;
  windowId: string;
  profileId: string;
  frame: { x: number; y: number; width: number };
  hidden: boolean;
}) {
  const [leaving, setLeaving] = useState<null | (() => void)>(null);
  const [shown, setShown] = useState<HomeCard>(card);
  if (!leaving && card !== shown) setShown(card);
  if (!shown) return null;
  const retire = (action: () => void) =>
    setLeaving(() => () => {
      action();
      setLeaving(null);
      setShown(null);
    });
  const open = () =>
    shown === "connectApps" ? openInternalPage("apps", windowId) : retire(() => void startMorningBrief(windowId, profileId));
  const dismiss = () => retire(() => (shown === "connectApps" ? dismissConnectAppsUpsell() : dismissMorningBrief(profileId)));
  return (
    <View
      style={{ position: "absolute", left: frame.x, top: frame.y, width: frame.width, height: HOME_CARD_HEIGHT, opacity: hidden ? 0 : 1 }}
      pointerEvents={hidden ? "none" : "box-none"}
    >
      <Card key={shown} kind={shown} leaving={leaving} onOpen={open} onDismiss={dismiss} />
    </View>
  );
}

function Card({ kind, leaving, onOpen, onDismiss }: { kind: Exclude<HomeCard, null>; leaving: null | (() => void); onOpen: () => void; onDismiss: () => void }) {
  const theme = useTheme();
  const { hovered, hoverProps } = useHover();
  const opacity = useRef(new Animated.Value(0)).current;
  const lift = useRef(new Animated.Value(6)).current;
  const copy = COPY[kind];
  const ink = theme.dark ? "rgba(255,255,255,0.85)" : "rgba(0,0,0,0.8)";
  const soft = theme.dark ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.53)";

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 300, delay: 200, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(lift, { toValue: 0, duration: 300, delay: 200, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]).start();
  }, []);
  useEffect(() => {
    if (!leaving) return;
    Animated.timing(opacity, { toValue: 0, duration: 200, easing: Easing.out(Easing.quad), useNativeDriver: true }).start(() => leaving());
  }, [leaving]);

  return (
    <Animated.View {...hoverProps} style={{ flex: 1, opacity, transform: [{ translateY: lift }] }} pointerEvents={leaving ? "none" : "auto"}>
      <Pressable onPress={onOpen} accessibilityRole="button" accessibilityLabel={`${copy.title}. ${copy.action}`} style={{ flex: 1 }}>
        <Surface
          style={StyleSheet.absoluteFill}
          fill={theme.dark ? (hovered ? "#FFFFFF1F" : "#FFFFFF14") : hovered ? "#FFFFFFB3" : "#FFFFFF80"}
          cornerRadius={14}
          borderColor={theme.dark ? "#FFFFFF0F" : "#00000014"}
          borderWidth={0.5}
        />
        <View style={{ flex: 1, flexDirection: "row", alignItems: "center", paddingLeft: 14, paddingRight: 12, gap: 12 }}>
          {kind === "connectApps" ? <AppStack /> : <Glyph name="sun.max" />}
          <View style={{ flex: 1, gap: 2 }}>
            <Text numberOfLines={1} style={{ fontSize: 13, fontWeight: "600", color: ink }}>
              {copy.title}
            </Text>
            <Text numberOfLines={1} style={{ fontSize: 12, color: soft }}>
              {copy.subtitle}
            </Text>
          </View>
          <View style={{ height: 28, paddingHorizontal: 12, borderRadius: 14, justifyContent: "center", backgroundColor: theme.goButton }}>
            <Text style={{ fontSize: 13, fontWeight: "600", color: theme.goButtonText }}>{copy.action}</Text>
          </View>
        </View>
      </Pressable>
      <View style={{ position: "absolute", right: -8, top: -8, opacity: hovered ? 1 : 0 }} pointerEvents={hovered ? "auto" : "none"}>
        <DismissButton onPress={onDismiss} />
      </View>
    </Animated.View>
  );
}

function Glyph({ name }: { name: string }) {
  const theme = useTheme();
  return (
    <View style={{ width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: theme.dark ? "#FFFFFF14" : "#0000000D" }}>
      <Symbol name={name} size={15} color={theme.dark ? "#FFFFFFCC" : "#000000B3"} style={{ width: 20, height: 20 }} />
    </View>
  );
}

function AppStack() {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: "row", width: 32 + (APP_GLYPHS.length - 1) * 18 }}>
      {APP_GLYPHS.map((name, i) => (
        <View
          key={name}
          style={{
            position: "absolute",
            left: i * 18,
            width: 32,
            height: 32,
            borderRadius: 16,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: theme.dark ? "#2C2C2E" : "#F2F2F2",
            borderWidth: 1.5,
            borderColor: theme.dark ? "#1C1C1E" : "#FFFFFF",
          }}
        >
          <Symbol name={name} size={13} color={theme.dark ? "#FFFFFFCC" : "#000000B3"} style={{ width: 18, height: 18 }} />
        </View>
      ))}
      <View style={{ height: 32 }} />
    </View>
  );
}

function DismissButton({ onPress }: { onPress: () => void }) {
  const theme = useTheme();
  const { hovered, hoverProps } = useHover();
  const fill = theme.dark ? (hovered ? "#FFFFFF4D" : "#FFFFFF14") : hovered ? "#0000004D" : "#00000033";
  return (
    <View {...hoverProps} tooltip="Dismiss">
      <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel="Dismiss">
        <View style={{ width: 23, height: 23, borderRadius: 11.5, overflow: "hidden", alignItems: "center", justifyContent: "center" }}>
          <VisualEffect material="hudWindow" blendingMode="withinWindow" cornerRadius={11.5} style={StyleSheet.absoluteFill} />
          <Surface style={StyleSheet.absoluteFill} fill={hex(fill)} cornerRadius={11.5} borderColor={theme.dark ? "#FFFFFF1F" : "#00000014"} borderWidth={1} />
          <Symbol name="xmark" size={10} weight="medium" color="#FFFFFFE6" style={{ width: 23, height: 23 }} />
        </View>
      </Pressable>
    </View>
  );
}
