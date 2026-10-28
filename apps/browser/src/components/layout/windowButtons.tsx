import { PortalHost } from "@astro-browser/shell";
import { StyleSheet } from "react-native";
import { useWindowId } from "../../store/hooks";

export const windowButtonsHost = (windowId: string) => `window-buttons:${windowId}`;

export function WindowButtonsHost() {
  const windowId = useWindowId();
  return <PortalHost name={windowButtonsHost(windowId)} pointerEvents="box-none" style={StyleSheet.absoluteFill} />;
}
