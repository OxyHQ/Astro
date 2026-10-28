import "./bloom.css";
import { Portal, PortalHost } from "@astro-browser/shell";
import { PortalOutlet, PortalProvider } from "@oxy.so/bloom/portal";
import { BloomThemeProvider } from "@oxy.so/bloom/theme";
import { fetch as expoFetch } from "expo/fetch";
import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import { afterFirstWindow } from "../lib/afterFirstWindow";
import { useBrowser } from "../store/browser";
import { ChatHost } from "./ChatHost";
import { ALIA_API_URL, NILO_API_URL, OXY_API_URL, OXY_CLIENT_ID } from "./config";
import { OxyRoot } from "./OxyRoot";
import { useOxyGenerations, useOxySession, wantOxy } from "./session";

const streamFetch = expoFetch as unknown as typeof fetch;

const overlayName = (windowId: string) => `oxy-overlay:${windowId}`;

export function OxyOverlayHost({ windowId }: { windowId: string }) {
  return <PortalHost name={overlayName(windowId)} pointerEvents="box-none" style={StyleSheet.absoluteFill} />;
}

export function OxyWindowHost({ windowId }: { windowId: string }) {
  const wanted = useOxySession((s) => s.wanted);
  const dark = useBrowser((s) => s.ui.appDark);
  const generation = useOxyGenerations((g) => g[windowId] ?? 0);
  useEffect(() => afterFirstWindow(wantOxy), []);
  if (!wanted) return null;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <PortalProvider>
        <BloomThemeProvider mode={dark ? "dark" : "light"}>
          <OxyRoot key={generation} windowId={windowId} baseURL={OXY_API_URL} niloURL={NILO_API_URL} clientId={OXY_CLIENT_ID}>
            <ChatHost windowId={windowId} aliaURL={ALIA_API_URL} streamFetch={streamFetch} />
          </OxyRoot>
        </BloomThemeProvider>
        <Portal host={overlayName(windowId)}>
          <PortalOutlet />
        </Portal>
      </PortalProvider>
    </View>
  );
}
