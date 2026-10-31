import { requireNativeViewManager } from "expo-modules-core";
import type { ReactNode } from "react";
import { StyleSheet, type ViewProps } from "react-native";

export type PortalHostProps = ViewProps & { name: string };
export type PortalProps = { host: string | null; containerRef?: (container: HTMLElement | null) => void; children?: ReactNode };

const NativePortalHost = requireNativeViewManager<PortalHostProps>("AstroPortalHost");
const NativePortal = requireNativeViewManager<ViewProps & { host: string | null; children?: ReactNode }>("AstroPortal");

export function PortalHost(props: PortalHostProps) {
  return <NativePortalHost {...props} />;
}

export function Portal({ host, children }: PortalProps) {
  return (
    <NativePortal host={host} pointerEvents="box-none" style={styles.portal}>
      {children}
    </NativePortal>
  );
}

const styles = StyleSheet.create({
  portal: { position: "absolute", left: 0, top: 0 },
});
