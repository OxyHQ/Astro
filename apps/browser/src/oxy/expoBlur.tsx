import { VisualEffect } from "@astro-browser/shell";
import { forwardRef } from "react";
import { StyleSheet, View, type ViewProps } from "react-native";

export type BlurTint = "light" | "dark" | "default" | "extraLight" | "regular" | "prominent" | (string & {});

export type BlurViewProps = ViewProps & {
  intensity?: number;
  tint?: BlurTint;
  blurTarget?: unknown;
  blurMethod?: string;
  experimentalBlurMethod?: string;
  blurReductionFactor?: number;
};

const materialOf = (tint: BlurTint | undefined) => {
  if (!tint) return "popover";
  if (/dark/i.test(tint)) return "hudWindow";
  if (/prominent|thick/i.test(tint)) return "sheet";
  if (/thin|ultra/i.test(tint)) return "popover";
  return "menu";
};

export const BlurView = forwardRef<View, BlurViewProps>(function BlurView(
  { intensity = 50, tint, blurTarget: _target, blurMethod: _method, experimentalBlurMethod: _experimental, blurReductionFactor: _reduction, style, ...props },
  ref,
) {
  return (
    <View ref={ref} {...props} style={style}>
      <VisualEffect
        material={materialOf(tint)}
        blendingMode="withinWindow"
        style={[StyleSheet.absoluteFill, { opacity: Math.max(0, Math.min(1, intensity / 100)) }]}
      />
      {props.children}
    </View>
  );
});

export const BlurTargetView = View;
