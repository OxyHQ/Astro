import { forwardRef } from "react";
import { View, type ViewProps } from "react-native-web";

type BlurProps = ViewProps & { intensity?: number; tint?: string; blurTarget?: unknown; experimentalBlurMethod?: string; blurReductionFactor?: number };

export const BlurView = forwardRef<View, BlurProps>(function BlurView({ intensity = 50, tint, blurTarget, experimentalBlurMethod, blurReductionFactor, style, ...props }, ref) {
  const blur = `blur(${intensity * 0.2}px)`;
  return <View ref={ref} {...props} style={[style, { backdropFilter: blur, WebkitBackdropFilter: blur } as object]} />;
});

export const BlurTargetView = View;
