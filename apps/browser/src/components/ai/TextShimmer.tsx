import { useEffect, useRef, useState, type ReactNode } from "react";
import { Animated, Easing, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

export const SHIMMER_MS = 1100;
const BAND = 56;
const STRIPS = [0.25, 0.55, 0.85, 1, 0.85, 0.55, 0.25];
const STRIP = BAND / STRIPS.length;
const DIMMED = 0.35;

export function useShimmerOn(value: string | undefined | null, when = true): number {
  const last = useRef(value);
  const [runs, setRuns] = useState(0);
  useEffect(() => {
    const before = last.current;
    last.current = value;
    if (when && value && value !== before) setRuns((n) => n + 1);
  }, [value, when]);
  return runs;
}

export function TextShimmer({
  runs,
  highlight,
  children,
  fill,
  style,
}: {
  runs: number;
  highlight: ReactNode;
  children: ReactNode;
  fill?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState(false);
  const progress = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!runs) return;
    setActive(true);
    progress.setValue(0);
    const animation = Animated.timing(progress, { toValue: 1, duration: SHIMMER_MS, easing: Easing.inOut(Easing.quad), useNativeDriver: false });
    animation.start(({ finished }) => finished && setActive(false));
    return () => animation.stop();
  }, [runs]);
  const opacity = progress.interpolate({ inputRange: [0, 0.15, 0.85, 1], outputRange: [1, DIMMED, DIMMED, 1] });
  const x = progress.interpolate({ inputRange: [0, 1], outputRange: [-BAND, Math.max(width, BAND)] });
  return (
    <>
      <Animated.View style={[fill ? StyleSheet.absoluteFill : null, { opacity }]}>{children}</Animated.View>
      {active ? (
        <View pointerEvents="none" onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={[StyleSheet.absoluteFill, { overflow: "hidden" }, style]}>
          {STRIPS.map((strength, i) => {
            const at = Animated.add(x, i * STRIP);
            return (
              <Animated.View
                key={i}
                style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: STRIP + 0.5, overflow: "hidden", opacity: strength, transform: [{ translateX: at }] }}
              >
                <Animated.View style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: Math.max(width, 1), transform: [{ translateX: Animated.multiply(at, -1) }] }}>
                  {highlight}
                </Animated.View>
              </Animated.View>
            );
          })}
        </View>
      ) : null}
    </>
  );
}
