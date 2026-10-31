import { WindowBackdrop } from "@astro-browser/shaders";
import { BloomThemeProvider } from "@oxy.so/bloom/theme";
import { useState, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { CommandPanel } from "./components/CommandPanel";
import { ContentCard } from "./components/ContentCard";
import { BookmarkDialog } from "./components/bookmarks/BookmarkDialog";
import { EditBookmarkDialog } from "./components/bookmarks/EditBookmarkDialog";
import { ExtensionOverlays } from "./components/extensions/ExtensionOverlays";
import { ExtensionSidePanel } from "./components/extensions/SidePanel";
import { ChatFloating, ChatSidebar } from "./components/chat/ChatSlots";
import { DownloadMagnet, DownloadsPopover } from "./components/Downloads";
import { UtilityWindow } from "./components/settings/UtilityWindow";
import { isUtilityWindowId } from "./components/settings/windows";
import { OnboardingOverlay } from "./components/onboarding";
import { CreateProfileHost } from "./components/profiles/CreateProfile";
import { useFullscreenTab } from "./components/layout/pageState";
import { ProfileTint } from "./components/layout/ProfileSwipe";
import { useTabLayout } from "./components/layout/windowLayout";
import { WindowProfile } from "./components/layout/WindowProfile";
import { WindowShell } from "./components/layout/WindowShell";
import { LittleAstroWindow } from "./components/littleAstro/LittleAstroWindow";
import { SidebarOverlays } from "./components/sidebar/Overlays";
import { ThemeScope, useTheme } from "./lib/theme";
import { useBrowser } from "./store/browser";
import { useWindowId, WindowContext } from "./store/hooks";

export function WindowRoot({ windowId }: { windowId?: string }) {
  if (isUtilityWindowId(windowId))
    return (
      <ThemeScope>
        <UtilityWindow id={windowId!} />
      </ThemeScope>
    );
  return <BrowserWindowRoot windowId={windowId} />;
}

function BrowserWindowRoot({ windowId }: { windowId?: string }) {
  const id = useBrowser((s) => windowId ?? s.ui.focusedWindowId ?? s.windowOrder[0] ?? null);
  const exists = useBrowser((s) => !!id && !!s.windows[id]);
  const small = useBrowser((s) => !!id && s.windows[id]?.kind === "small");
  if (!id || !exists) return null;
  return (
    <WindowContext.Provider value={id}>
      <WindowThemes>{small ? <LittleAstroWindow /> : <BrowserWindow />}</WindowThemes>
    </WindowContext.Provider>
  );
}

function WindowThemes({ children }: { children: ReactNode }) {
  const dark = useBrowser((s) => s.ui.appDark);
  return (
    <BloomThemeProvider mode={dark ? "dark" : "light"} colorPreset="blue">
      <ThemeScope>{children}</ThemeScope>
    </BloomThemeProvider>
  );
}

function BrowserWindow() {
  const theme = useTheme();
  const windowId = useWindowId();
  const topTabs = useTabLayout() === "top";
  const fullscreen = !!useFullscreenTab(windowId);
  const [area, setArea] = useState({ width: 0, height: 0 });
  const width = area.width;
  const card = (
    <>
      <ContentCard />
      {!fullscreen && <ChatSidebar />}
      {!fullscreen && <ExtensionSidePanel />}
    </>
  );

  return (
    <View style={{ flex: 1, flexDirection: "row" }} onLayout={(e) => setArea({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}>
      <WindowBackdrop vibrancy {...theme.backdrop} colors={theme.windowTint} grainOpacity={theme.grain} style={StyleSheet.absoluteFill} />
      <WindowProfile />
      <ProfileTint />
      <WindowShell fullscreen={fullscreen} topTabs={topTabs} width={width}>
        {card}
      </WindowShell>
      {!fullscreen && <ChatFloating area={area} />}
      <CommandPanel windowWidth={width} />
      <DownloadsPopover />
      <ExtensionOverlays />
      <DownloadMagnet />
      <BookmarkDialog />
      <EditBookmarkDialog />
      <CreateProfileHost />
      <SidebarOverlays windowWidth={width} />
      <OnboardingOverlay />
    </View>
  );
}
