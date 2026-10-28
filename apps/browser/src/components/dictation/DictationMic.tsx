import { ActivitySpinner, Symbol } from "@astro-browser/shell";
import { useEffect, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import {
  clearDictationError,
  pressDictation,
  registerDictationField,
  releaseDictation,
  useDictation,
  useDictationError,
  useDictationPhase,
  type DictationMode,
} from "../../ai/dictation/dictation";
import { useTheme } from "../../lib/theme";
import { signInWithOxy } from "../../oxy/session";
import { useHover } from "../primitives";

const ERROR_SHOWN_MS = 6000;
const BARS = 5;

export const recordingRed = (dark: boolean) => (dark ? "#FF453A" : "#FF3B30");

export function useDictationField(key: string, element: () => unknown, begin: (mode: DictationMode) => void) {
  const latest = useRef({ element, begin });
  latest.current = { element, begin };
  useEffect(
    () => registerDictationField(key, { element: () => latest.current.element(), begin: (mode) => latest.current.begin(mode) }),
    [key],
  );
}

export function useDictationSeconds(key: string): number {
  const startedAt = useDictation((s) => (s.key === key && s.phase === "listening" ? s.startedAt : 0));
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!startedAt) return;
    setNow(Date.now());
    const tick = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(tick);
  }, [startedAt]);
  return startedAt ? Math.max(0, Math.floor((now - startedAt) / 1000)) : 0;
}

export function useShownDictationError(key: string) {
  const error = useDictationError(key);
  useEffect(() => {
    if (!error) return;
    const hide = setTimeout(() => clearDictationError(key), Math.max(0, error.at + ERROR_SHOWN_MS - Date.now()));
    return () => clearTimeout(hide);
  }, [error, key]);
  return error;
}

export function DictationMic({
  dictationKey,
  ready,
  begin,
  fallback,
  size = 14,
  box = 30,
}: {
  dictationKey: string;
  ready: boolean;
  begin: (mode: DictationMode) => void;
  fallback: () => void;
  size?: number;
  box?: number;
}) {
  const theme = useTheme();
  const { hovered, hoverProps } = useHover();
  const phase = useDictationPhase(dictationKey);
  const error = useShownDictationError(dictationKey);
  const live = phase === "starting" || phase === "listening";
  const signIn = error?.code === "not-signed-in";
  const tooltip = !ready
    ? "Dictate"
    : signIn
      ? "Sign In with Oxy to Dictate…"
      : live
        ? "Stop Dictating"
        : phase === "finishing"
          ? "Transcribing…"
          : "Dictate (hold to talk)";
  const holds = ready && !signIn;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", flexShrink: 1 }}>
      {error && (
        <Text numberOfLines={1} style={{ flexShrink: 1, fontSize: 12, color: theme.textSecondary, marginRight: 6 }}>
          {error.message}
        </Text>
      )}
      <View tooltip={tooltip} {...hoverProps}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={tooltip}
          accessibilityState={{ busy: phase === "finishing", selected: live }}
          disabled={phase === "finishing"}
          onPress={!ready ? fallback : signIn ? () => void signInWithOxy() : undefined}
          onPressIn={holds ? () => pressDictation(dictationKey, begin) : undefined}
          onPressOut={holds ? () => releaseDictation(dictationKey) : undefined}
        >
          {({ pressed }) => (
            <View
              style={{
                height: box,
                minWidth: box,
                paddingHorizontal: live ? 8 : 0,
                borderRadius: live ? box / 2 : 7,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: live
                  ? recordingRed(theme.dark) + (pressed ? "40" : "29")
                  : pressed
                    ? theme.toolbarPressed
                    : hovered
                      ? theme.toolbarHover
                      : undefined,
              }}
            >
              {live ? (
                <LevelBars dictationKey={dictationKey} color={recordingRed(theme.dark)} height={size} />
              ) : phase === "finishing" ? (
                <ActivitySpinner style={{ width: 12, height: 12 }} />
              ) : (
                <Symbol
                  name={error ? "exclamationmark.triangle" : "mic"}
                  size={size}
                  color={theme.textTertiary}
                  style={{ width: box, height: box }}
                />
              )}
            </View>
          )}
        </Pressable>
      </View>
    </View>
  );
}

function LevelBars({ dictationKey, color, height }: { dictationKey: string; color: string; height: number }) {
  const levels = useDictation((s) => (s.key === dictationKey ? s.levels : null));
  const listening = useDictation((s) => s.key === dictationKey && s.phase === "listening");
  const recent = levels?.slice(-BARS * 2) ?? [];
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 2, height }}>
      {Array.from({ length: BARS }, (_, i) => {
        const a = recent[i * 2] ?? 0;
        const b = recent[i * 2 + 1] ?? 0;
        const level = listening ? Math.max(a, b) : 0;
        return (
          <View
            key={i}
            style={{ width: 2.5, borderRadius: 1.25, backgroundColor: color, opacity: listening ? 1 : 0.5, height: Math.max(3, Math.round(level * height)) }}
          />
        );
      })}
    </View>
  );
}
