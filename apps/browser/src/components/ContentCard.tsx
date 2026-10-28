import { WebView, type OpenWindowRequest } from "@astro-browser/astrocore";
import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Animated, StyleSheet, View } from "react-native";
import { useShallow } from "zustand/react/shallow";
import { focus, switchToTab } from "../lib/actions";
import { noteFavicon } from "../lib/favicons";
import { noteChromeTab } from "../lib/cliControl";
import { takeStartedNavigation } from "../lib/earlyNavigate";
import { isQuitting } from "../lib/native";
import { layout, useTheme } from "../lib/theme";
import { opaqueCard } from "../lib/opaqueCard";
import { startChromeTabs } from "../lib/chromeTabs";
import { handOff, isHandedOff, wantsPage } from "../lib/tabPages";
import { noteDiscarded, noteGone, noteReady } from "../lib/tabLifecycle";
import { usePrewarm } from "../lib/preload";
import { webviewRef, webviews } from "../lib/webviews";
import { useBrowser } from "../store/browser";
import { setPageProgress } from "../store/pageProgress";
import { shallowEqual, useProfilesValue, useStoreWhile, useTabValue } from "../store/tabWatch";
import { useActiveTabId, useWindowId } from "../store/hooks";
import { activeTabId, engineProfile, isIncognitoProfile, navigationTo, wake } from "../store/model";
import { removeTabs } from "../store/tabs";
import { slotsOf, splitOf } from "../store/splits";
import type { SplitView, Tab } from "../store/types";
import { BOOKMARKS_BAR_HEIGHT, BookmarksBar, bookmarksBarShown, useBookmarksBarMode, type BookmarksBarMode } from "./bookmarks/BookmarksBar";
import { CliControlBar, CliControlPill } from "./CliControlBar";
import { FindBar } from "./FindBar";
import { POPOVER_MARGIN } from "./layout/controls";
import { NO_TOOLBAR, toolbarGeometry, type ToolbarGeometry } from "./layout/geometry";
import { dismissPermissions, startPermissionPrompts } from "./site/permissions";
import { patchPage, pageOf, setBrowserId, setPopover, useFullscreenTab, usePages } from "./layout/pageState";
import { useTabDrag } from "./layout/tabDrag";
import { SadTab, StatusBubble } from "./layout/PaneOverlays";
import { notePaneRect, SplitToast, usePaneDrop } from "./layout/SplitChrome";
import { AppShellPanels } from "@oxy.so/bloom/app-shell";
import { SplitEmptyState } from "./layout/SplitEmptyState";
import { pagerFor } from "./layout/profilePager";
import { openFromPage } from "./layout/openFromPage";
import { dockMoving, useDockMotion } from "./layout/dockMotion";
import { FrozenPage } from "./layout/frozenPage";
import { holderOf } from "../store/pinShare";
import { setCardAnchor, setUrlAnchor, useAddressBarInSidebar, useTabLayout, useToolbarExtensionsWidths } from "./layout/windowLayout";
import { NewTabPage } from "./NewTabPage";
import { EmptyCard } from "./EmptyCard";
import { InternalPage } from "./pages";
import { AutofillPrompt, BlockedPopupsPrompt, ExternalAppPrompt, PasswordPrompt, PermissionPrompt, answerExternalApp, shouldPromptForPopups, showAutofillPrompt, showPasswordPrompt } from "./site/Prompts";
import { SiteControls } from "./site/SiteControls";
import { ZoomPopover } from "./site/ZoomControls";
import { SelectionPopover } from "./site/SelectionPopover";
import { copyLinkToSelection, searchSelection, setPageSelection, startSelectionTools, type PageSelection } from "./site/selection";
import { askAboutSelection } from "../ai/chat/actions";
import { startMedia, useAutoPictureInPicture } from "./media/pip";
import { SharePicker, requestDisplayMedia } from "./media/SharePicker";
import { ShareBar } from "./media/ShareBar";
import { CastPicker } from "./media/CastPicker";
import { DeviceChooser } from "./site/DeviceChooser";
import { setNowPlaying, setPictureInPictureState } from "./media/state";
import { Toolbar, ToolbarBackdrop, urlFieldRight } from "./Toolbar";
import { ToolbarSummary, useToolbarBand, useToolbarMode } from "./AutoHideToolbar";
import { AutoHideBarBody, AutoHideBarRegion, useAutoHideBar } from "@oxy.so/bloom/layout";
import { publishPaneChrome, WindowToolbar } from "./WindowToolbar";
import { noteScroll, revealToolbar, STRIP_HEIGHT } from "./layout/toolbarAutoHide";
import { NavigationOverlays } from "./layout/SwipeOverlay";
import "./layout/devExpose";
import { closeWebNotification, showWebNotification } from "../lib/webNotifications";
import { isSmallWindow } from "../store/small";
import { closeLittleAstroOnEscape } from "./littleAstro/actions";

export function ContentCard() {
  const windowId = useWindowId();
  const activeId = useActiveTabId();
  const split = useBrowser((s) => splitOf(s, activeId));
  const fullscreenTab = useFullscreenTab(windowId);
  const tabLayout = useTabLayout();
  const addressInSidebar = useAddressBarInSidebar();
  const small = useBrowser((s) => isSmallWindow(s.windows[windowId]));
  const hideWhileScrolling = useBrowser((s) => s.settings.hideToolbarWhileScrolling);
  const showSidebarButton = useBrowser((s) => s.settings.showSidebarButton !== false);
  const barMode = useBookmarksBarMode(windowId);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [origin, setOrigin] = useState<{ x: number; y: number } | null>(null);
  const container = useRef<View>(null);
  useEffect(startPermissionPrompts, []);
  useEffect(startChromeTabs, []);
  useEffect(startMedia, []);
  useEffect(startSelectionTools, []);

  const mountedMemo = useRef<{ tabIds?: string[]; tabs?: object; ids: string[]; seen: (Tab | undefined)[]; wants: boolean[] }>({ ids: [], seen: [], wants: [] });
  const mounted = useBrowser(
    useShallow((s) => {
      const tabIds = s.windows[windowId]?.tabIds;
      const memo = mountedMemo.current;
      if (memo.tabIds === tabIds && memo.tabs === s.tabs) return memo.ids;
      if (tabIds && memo.tabIds === tabIds) {
        let same = true;
        const seen = memo.seen.slice();
        const wants = memo.wants.slice();
        for (let i = 0; i < tabIds.length; i++) {
          const t = s.tabs[tabIds[i]!];
          if (t === seen[i]) continue;
          seen[i] = t;
          const want = wantsPage(t);
          if (want !== wants[i]) same = false;
          wants[i] = want;
        }
        if (same) {
          mountedMemo.current = { ...memo, tabs: s.tabs, seen, wants };
          return memo.ids;
        }
      }
      const seen = (tabIds ?? []).map((id) => s.tabs[id]);
      const wants = seen.map((t) => wantsPage(t));
      const ids = (tabIds ?? []).filter((_, i) => wants[i]);
      mountedMemo.current = { tabIds, tabs: s.tabs, ids, seen, wants };
      return ids;
    }),
  );

  const mountedIds = useMemo(() => new Set(mounted), [mounted]);

  const slots = useMemo<string[][]>(() => {
    if (fullscreenTab) return [[fullscreenTab]];
    if (split) return slotsOf(split);
    return activeId ? [[activeId]] : [];
  }, [split, activeId, fullscreenTab]);
  const panes = useMemo(() => slots.flat(), [slots]);
  const leadingTab = slots[0]?.[0];

  useEffect(() => {
    const s = useBrowser.getState();
    for (const id of panes) {
      const t = s.tabs[id];
      if (!t?.url || t.navigation || t.adoptId || t.pageIn) continue;
      const holder = holderOf(s, id);
      s.updateTab(id, holder ? { pageIn: holder.id, unloaded: undefined } : wake(t));
    }
  }, [panes]);

  const pagerPages = pagerFor(windowId).state((st) => st.pages);
  const leaving = useTabDrag((d) => (d.windowId === windowId && d.tabIds.length && (d.outside || !!(d.lifted ?? d.onPage)) ? d.tabIds : null));
  const successor = useMemo(() => {
    if (!leaving) return undefined;
    const s = useBrowser.getState();
    const next = activeTabId(removeTabs(s, leaving, false), windowId);
    return next && next !== activeTabId(s, windowId) ? next : undefined;
  }, [leaving, windowId]);
  const warm = useBrowser(
    useShallow((s) => {
      const w = s.windows[windowId];
      const ids = !w || !pagerPages ? [] : pagerPages.map((p) => (p.id === w.profileId ? undefined : w.activeTabIds[p.id])).filter((id): id is string => !!id);
      return successor && s.tabs[successor]?.windowId === windowId && !ids.includes(successor) ? [...ids, successor] : ids;
    }),
  );
  const warmSplits = useBrowser(useShallow((s) => warm.map((id) => splitOf(s, id)).filter((v): v is SplitView => !!v)));
  const warmIds = useMemo(() => new Set([...warm, ...warmSplits.flatMap((v) => v.tabIds)]), [warm, warmSplits]);

  const shownMemo = useRef<{ mounted?: string[]; panes?: object; tabs?: object; keys: string[]; ids: string[]; found: (Tab | undefined)[] }>({ keys: [], ids: [], found: [] });
  const shown = useBrowser(
    useShallow((s) => {
      const memo = shownMemo.current;
      if (memo.mounted === mounted && memo.panes === panes) {
        if (memo.tabs === s.tabs) return memo.keys;
        let same = true;
        let found = memo.found;
        for (let i = 0; i < memo.ids.length && same; i++) {
          const t = s.tabs[memo.ids[i]!];
          const was = found[i];
          if (t === was) continue;
          if (!t || !was || t.createdAt !== was.createdAt || t.profileId !== was.profileId) same = false;
          else {
            if (found === memo.found) found = found.slice();
            found[i] = t;
          }
        }
        if (same) {
          shownMemo.current = { ...memo, tabs: s.tabs, found };
          return memo.keys;
        }
      }
      const ids = [...new Set([...mounted, ...panes])];
      const found = ids.map((id) => s.tabs[id]);
      const keys = found
        .filter((t): t is Tab => !!t)
        .sort((a, b) => a.createdAt - b.createdAt)
        .map((t) => `${t.id}|${t.profileId}`);
      shownMemo.current = { mounted, panes, tabs: s.tabs, keys, ids, found };
      return keys;
    }),
  );

  const geometryFor = (leading: boolean): ToolbarGeometry => {
    if (addressInSidebar || small) return NO_TOOLBAR;
    return toolbarGeometry({ sidebarButton: leading && tabLayout === "sidebar" && showSidebarButton });
  };

  useEffect(() => {
    if (origin && size.width > 0) setCardAnchor(windowId, { left: origin.x, top: origin.y, width: size.width, height: size.height });
  }, [origin, size.width, size.height, windowId]);

  const settled = useRef<{ width: number; height: number } | null>(null);
  const measure = (width: number, height: number) => {
    setSize({ width, height });
    container.current?.measureInWindow((x, y) => setOrigin({ x, y }));
  };
  useEffect(
    () =>
      useDockMotion.subscribe((m) => {
        if (m.moving[windowId] || !settled.current) return;
        const { width, height } = settled.current;
        settled.current = null;
        measure(width, height);
      }),
    [windowId],
  );

  const windowToolbar = !split && !fullscreenTab && !addressInSidebar && !small;
  const paneKeys = useMemo(() => {
    const byTab = new Map(shown.map((key) => [key.slice(0, key.indexOf("|")), key]));
    return { byTab, visible: panes.map((id) => byTab.get(id)).filter((key): key is string => !!key) };
  }, [shown, panes]);
  const drop = usePaneDrop(fullscreenTab ? [] : paneKeys.visible);
  const stacked = split && !fullscreenTab ? slots.find((slot) => slot.length > 1) : undefined;
  const spans = useMemo(() => {
    if (!split || fullscreenTab) return undefined;
    const out: Record<string, number> = {};
    const sizes = split.sizes.length === slots.length ? split.sizes : slots.map(() => 1 / slots.length);
    slots.forEach((slot, i) => {
      const key = slot.length > 1 ? STACK : paneKeys.byTab.get(slot[0]!);
      if (key) out[key] = sizes[i]!;
    });
    if (stacked) stacked.forEach((id, j) => {
      const key = paneKeys.byTab.get(id);
      if (key) out[key] = split.stack?.sizes[j] ?? 0.5;
    });
    return out;
  }, [split, fullscreenTab, slots, stacked, paneKeys]);
  const onSpansChange = (next: Readonly<Record<string, number>>) => {
    if (!split) return;
    const weights = slots.map((slot) => next[slot.length > 1 ? STACK : (paneKeys.byTab.get(slot[0]!) ?? "")] ?? 0);
    const total = weights.reduce((sum, w) => sum + w, 0) || 1;
    const stackWeights = stacked?.map((id) => next[paneKeys.byTab.get(id) ?? ""] ?? 0);
    const stackTotal = stackWeights ? stackWeights.reduce((sum, w) => sum + w, 0) || 1 : 1;
    useBrowser.getState().updateSplit(split.id, {
      sizes: weights.map((w) => w / total),
      ...(split.stack && stackWeights ? { stackSizes: [stackWeights[0]! / stackTotal, stackWeights[1]! / stackTotal] as [number, number] } : {}),
    });
  };
  const visibleSet = useMemo(() => new Set(panes), [panes]);
  const layoutKey = JSON.stringify([slots, split?.sizes, split?.stack?.sizes, split?.orientation]);
  const panels = useMemo(() => {
    const order = [...paneKeys.visible, ...shown.filter((key) => !paneKeys.visible.includes(key))];
    return order.map((key) => {
      const tabId = key.slice(0, key.indexOf("|"));
      const visible = visibleSet.has(tabId);
      return {
        id: key,
        visible,
        stack: visible && stacked?.includes(tabId) ? STACK : undefined,
        hiddenPresentation: warmIds.has(tabId) ? ("behind" as const) : undefined,
        resizable: !!split && !fullscreenTab,
        minWidth: MIN_PANE,
        minHeight: MIN_PANE,
        content: (
          <TabPane
            tabId={tabId}
            windowId={windowId}
            visible={visible}
            focused={tabId === activeId}
            inActiveSplit={!!split?.tabIds.includes(tabId)}
            fullscreen={tabId === fullscreenTab}
            geometry={geometryFor(tabId === leadingTab && !fullscreenTab)}
            toolbar={!addressInSidebar && !small}
            autoHide={hideWhileScrolling && !addressInSidebar && !small}
            small={small}
            mounted={mountedIds.has(tabId)}
            warm={warmIds.has(tabId)}
            barMode={barMode}
            windowToolbar={windowToolbar}
            inSplit={!!split}
            layoutKey={layoutKey}
          />
        ),
      };
    });
  }, [paneKeys, shown, visibleSet, stacked, split, fullscreenTab, windowId, activeId, leadingTab, addressInSidebar, small, tabLayout, showSidebarButton, hideWhileScrolling, mountedIds, warmIds, barMode, windowToolbar, layoutKey]);

  return (
    <View
      ref={container}
      style={{ flex: 1 }}
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        if (size.width > 0 && dockMoving(windowId)) settled.current = { width, height };
        else measure(width, height);
      }}
    >
      <AppShellPanels
        scope="local"
        layout={{ mode: "split", flow: "bounded", retain: true, gap: PANE_GAP, axis: split?.orientation ?? "horizontal", resizeHandle: "pill", spans, onSpansChange, drop, panels }}
      />
      {size.width > 0 && windowToolbar && activeId && panes.includes(activeId) && (
        <WindowToolbar windowId={windowId} tabId={activeId} geometry={geometryFor(true)} autoHide={hideWhileScrolling} />
      )}
      {size.width > 0 && !split && !fullscreenTab && (
        <FrozenPage windowId={windowId} tabId={activeId} top={(!addressInSidebar && !small && !hideWhileScrolling ? layout.toolbarHeight : 0) + (barMode === "always" && !small && !hideWhileScrolling ? BOOKMARKS_BAR_HEIGHT : 0)} />
      )}
      <SplitToast windowId={windowId} />
    </View>
  );
}

const STACK = "stack";
const PANE_GAP = 7;
const MIN_PANE = 220;

const TabPane = memo(function TabPane({
  tabId,
  windowId,
  visible,
  focused,
  inActiveSplit,
  fullscreen,
  geometry,
  toolbar,
  autoHide,
  small,
  mounted,
  warm,
  barMode,
  windowToolbar,
  inSplit: splitShown,
  layoutKey,
}: {
  tabId: string;
  windowId: string;
  visible: boolean;
  focused: boolean;
  inActiveSplit: boolean;
  fullscreen: boolean;
  geometry: ToolbarGeometry;
  toolbar: boolean;
  autoHide: boolean;
  small: boolean;
  mounted: boolean;
  warm: boolean;
  barMode: BookmarksBarMode;
  windowToolbar: boolean;
  inSplit: boolean;
  layoutKey: string;
}) {
  const theme = useTheme();
  const live = visible || warm;
  const pane = useRef<View>(null);
  const [frame, setFrame] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const own = useTabValue(tabId, paneTab, shallowEqual);
  const isNewTab = !own.url;
  const emptyCard = useBrowser((s) => isNewTab && s.settings.newTabOpens === "commandBar");
  const zoom = own.zoom;
  const popover = useStoreWhile(usePages, visible, (s) => s.popover[tabId] ?? null);
  const newTabShown = useStoreWhile(usePages, live, (s) => !!s.pages[tabId]?.newTabShown);
  const inSomeSplit = useStoreWhile(useBrowser, warm, (s) => warm && !!splitOf(s, tabId));
  const inSplit = visible ? inActiveSplit : inSomeSplit;
  const paneKey = `${tabId}|${useTabValue(tabId, (t) => t?.profileId ?? "")}`;
  const place = () =>
    pane.current?.measureInWindow((x, y, width, height) => {
      setFrame((f) => (f.x === x && f.y === y && f.width === width && f.height === height ? f : { x, y, width, height }));
    });
  useLayoutEffect(() => {
    if (visible) place();
  }, [visible, layoutKey]);
  useEffect(() => {
    if (!visible) return notePaneRect(windowId, paneKey, null);
    notePaneRect(windowId, paneKey, frame);
    return () => notePaneRect(windowId, paneKey, null);
  }, [visible, windowId, paneKey, frame]);
  useEffect(() => {
    if (!visible || !focused || !toolbar || frame.width === 0) return;
    const anchor = (extensionsWidth = 0) =>
      setUrlAnchor(windowId, { left: frame.x + geometry.urlLeft, top: frame.y, width: frame.width - geometry.urlLeft - urlFieldRight(splitShown, extensionsWidth) });
    anchor(useToolbarExtensionsWidths.getState()[windowId]);
    return useToolbarExtensionsWidths.subscribe((w, prev) => {
      if (w[windowId] !== prev[windowId]) anchor(w[windowId]);
    });
  }, [visible, focused, toolbar, frame.x, frame.y, frame.width, geometry.urlLeft, splitShown, windowId]);
  useEffect(() => {
    if (visible && isNewTab && !mounted) patchPage(tabId, { wasNewTab: true });
  }, [visible, isNewTab, mounted]);
  const prewarmed = usePrewarm(visible && isNewTab && !emptyCard && !mounted && !small && !inSplit);
  const hideBar = autoHide && visible && !fullscreen;
  const mode = useToolbarMode(tabId, windowId, hideBar);
  const bookmarksBar = bookmarksBarShown(barMode, own.exists ? own : undefined) && !fullscreen && !inSplit && !small;
  const autoLayout = autoHide && toolbar && !fullscreen;
  const band = useToolbarBand(tabId);
  const controller = useAutoHideBar({
    collapsed: autoLayout && mode !== "shown",
    height: autoLayout ? layout.toolbarHeight : 0,
    collapsedHeight: STRIP_HEIGHT,
    onReveal: () => revealToolbar(tabId),
    background: band,
    revealLabel: "Show Toolbar",
  });
  useEffect(() => {
    if (visible) revealToolbar(tabId);
  }, [visible]);
  const chromeInWindow = hideBar && windowToolbar;
  useLayoutEffect(() => {
    if (chromeInWindow) publishPaneChrome(windowId, { tabId, controller });
  });

  return (
    <View
      ref={pane}
      onLayout={place}
      pointerEvents={visible ? "auto" : "none"}
      onTouchStart={() => {
        if (visible && !focused) useBrowser.getState().activate(tabId);
      }}
      style={{
        flex: 1,
        borderRadius: fullscreen ? 0 : layout.cardRadius,
        overflow: "hidden",
        backgroundColor: visible && !fullscreen ? theme.card : undefined,
      }}
    >
      {!toolbar || fullscreen || autoLayout ? null : visible && !windowToolbar ? (
        <Toolbar tabId={tabId} geometry={geometry} windowId={windowId} inSplit={inSplit} focused={focused || !inSplit} />
      ) : visible ? (
        <ToolbarBackdrop tabId={tabId} />
      ) : (
        <View style={{ height: layout.toolbarHeight }} />
      )}
      {!autoLayout && bookmarksBar && <BookmarksBar placeholder={!visible} />}
      <View style={{ flex: 1 }}>
        <AutoHideBarBody controller={controller}>
        {autoLayout && bookmarksBar && <BookmarksBar placeholder={!visible} />}
        <View style={{ flex: 1 }}>
          {visible && !fullscreen && (focused || !inSplit) && <CliControlBar />}
          {visible && !fullscreen && <ShareBar tabId={tabId} />}
          <View style={{ flex: 1 }}>
            {(mounted || prewarmed) && <TabWebView tabId={tabId} visible={visible && !newTabShown && !isNewTab} warm={warm && !newTabShown && !isNewTab} />}
            {visible && isNewTab && !small && (inSplit ? <SplitEmptyState tabId={tabId} focused={focused} /> : emptyCard ? <EmptyCard windowId={windowId} tabId={tabId} /> : <NewTabPage key={tabId} tabId={tabId} toolbar={toolbar} />)}
            {visible && <InternalPage tabId={tabId} />}
            {visible && (
              <>
                <FindBar tabId={tabId} />
                {fullscreen && <CliControlPill />}
                <View pointerEvents="none" style={StyleSheet.absoluteFill}>
                  <StatusBubble tabId={tabId} maxWidth={Math.max(160, frame.width / 2)} />
                </View>
                <SadTab tabId={tabId} />
                {!newTabShown && <PermissionPrompt tabId={tabId} left={Math.max(POPOVER_MARGIN, Math.min(geometry.urlLeft, frame.width - 308))} top={POPOVER_MARGIN} />}
                <PasswordPrompt tabId={tabId} right={POPOVER_MARGIN} top={POPOVER_MARGIN} />
                <AutofillPrompt tabId={tabId} right={POPOVER_MARGIN} top={POPOVER_MARGIN} />
                {!newTabShown && <ExternalAppPrompt tabId={tabId} left={Math.max(POPOVER_MARGIN, Math.min(geometry.urlLeft, frame.width - 348))} top={POPOVER_MARGIN} />}
                <SiteControls tabId={tabId} open={popover === "siteControls"} {...(toolbar ? { right: POPOVER_MARGIN } : { left: POPOVER_MARGIN })} top={POPOVER_MARGIN} />
                {popover === "popups" && <BlockedPopupsPrompt tabId={tabId} {...(toolbar ? { right: POPOVER_MARGIN } : { left: POPOVER_MARGIN })} top={POPOVER_MARGIN} />}
                {popover === "zoom" && <ZoomPopover tabId={tabId} {...(toolbar ? { right: POPOVER_MARGIN } : { left: POPOVER_MARGIN })} top={POPOVER_MARGIN} />}
                <SharePicker tabId={tabId} paneWidth={frame.width} />
                {!newTabShown && <DeviceChooser tabId={tabId} left={Math.max(POPOVER_MARGIN, Math.min(geometry.urlLeft, frame.width - 348))} top={POPOVER_MARGIN} />}
                <CastPicker tabId={tabId} paneWidth={frame.width} />
                <NavigationOverlays tabId={tabId} windowId={windowId} geometry={geometry} />
                <SelectionPopover tabId={tabId} zoom={zoom} />
              </>
            )}
          </View>
        </View>
        </AutoHideBarBody>
      </View>
      {hideBar && !windowToolbar && (
        <AutoHideBarRegion
          controller={controller}
          bar={<Toolbar tabId={tabId} geometry={geometry} windowId={windowId} inSplit={inSplit} focused={focused || !inSplit} bare />}
          summary={<ToolbarSummary tabId={tabId} />}
        />
      )}
    </View>
  );
});

const paneTab = (t: Tab | undefined) => ({ exists: !!t, url: t?.url ?? "", zoom: t?.zoom ?? 1 });
const webViewTab = (t: Tab | undefined) => ({ navigation: t?.navigation, adoptId: t?.adoptId, profileId: t?.profileId ?? "", shownUrl: t?.url ?? "" });

const isBlank = (url: string) => !url || url === "about:blank";
const pageKey = (url: string) => url.replace(/#.*$/, "");
const hostOf = (url: string) => url.match(/^[a-z][\w+.-]*:\/\/([^/?#]*)/i)?.[1]?.toLowerCase() ?? "";

const TabWebView = memo(function TabWebView({ tabId, visible, warm }: { tabId: string; visible: boolean; warm: boolean }) {
  const { navigation, adoptId, profileId, shownUrl } = useTabValue(tabId, webViewTab, shallowEqual);
  const neighbour = useStoreWhile(useBrowser, warm, (s) => warm && s.windows[s.tabs[tabId]?.windowId ?? ""]?.profileId !== profileId);
  const tab = () => useBrowser.getState().tabs[tabId];
  const store = () => useBrowser.getState();
  const ref = useMemo(() => webviewRef(tabId), [tabId]);
  const autoPictureInPicture = useAutoPictureInPicture(tabId, visible);
  const pageColor = useProfilesValue(profileId, (profiles) => (isIncognitoProfile(profileId) ? "incognito" : (profiles[profileId]?.color ?? "plum")));
  const theme = useTheme();
  const backdrop = useMemo(() => opaqueCard(theme), [theme.card, theme.windowTint[0], theme.windowTint[1]]);

  const lastPage = useRef<string | null>(null);
  const pending = useRef<string | null>(navigation?.url ?? (adoptId ? (tab()?.url ?? null) : null));

  const seq = navigation?.seq;
  const adopted = useRef<string | null>(null);
  const arrived = useRef(isHandedOff(tabId));
  useEffect(() => {
    if (!navigation) return;
    if (arrived.current) {
      arrived.current = false;
      return;
    }
    if (navigation.url === adopted.current) {
      adopted.current = null;
      return;
    }
    pending.current = navigation.url;
    if (pageOf(tabId).newTabShown) patchPage(tabId, { newTabShown: null });
    if (takeStartedNavigation(tabId, navigation.seq)) return;
    void webviews.get(tabId)?.loadUrl(navigation.url, { userInitiated: !!navigation.userInitiated });
  }, [seq]);
  const fromNewTab = useRef(pageOf(tabId).wasNewTab && !adoptId);
  useEffect(
    () => () => {
      noteGone(tabId);
    },
    [],
  );
  const mountedProfile = useRef(profileId);
  useLayoutEffect(
    () => () => {
      const t = tab();
      if (wantsPage(t) && engineProfile(t.profileId) === engineProfile(mountedProfile.current) && !isQuitting()) handOff(tabId, engineProfile(t.profileId));
      else setPageProgress(tabId, 0);
    },
    [],
  );

  const prewarmOnly = () => !tab()?.navigation && !adoptId;

  const onOpenWindow = (request: OpenWindowRequest) => {
    const t = tab();
    if (t) openFromPage(request, { windowId: t.windowId, profileId: t.profileId, tabId });
  };

  return (
    <WebView
      ref={ref}
      style={StyleSheet.absoluteFill}
      url={navigation?.url ?? (adoptId ? tab()?.url : undefined)}
      profile={engineProfile(profileId)}
      adoptId={adoptId}
      transferKey={tabId}
      visible={visible}
      warm={warm}
      neighbour={neighbour}
      autoPictureInPicture={autoPictureInPicture}
      pageColor={pageColor}
      contentsBackgroundColor={backdrop}
      shownUrl={shownUrl}
      onReady={(browserId, chromeTabId) => {
        setBrowserId(tabId, browserId);
        noteChromeTab(tabId, chromeTabId);
        noteReady(tabId);
        if (tab()?.muted) void webviews.get(tabId)?.setMuted(true);
      }}
      onNavigationChange={({ url: reported, title, canGoBack, canGoForward, isLoading, themeColor, themeColorSource, initialDocumentAccessed, committedInitial }) => {
        const url = initialDocumentAccessed && committedInitial ? "about:blank" : reported;
        const untouched = committedInitial === undefined ? reported === "" && !(tab()?.openerId && adoptId) : committedInitial && !initialDocumentAccessed;
        const target = pending.current ?? (lastPage.current === null ? (tab()?.navigation?.url ?? null) : null);
        if (target === null && prewarmOnly()) {
          if (isBlank(url)) return;
          adopted.current = url;
          store().updateTab(tabId, { navigation: navigationTo(url) });
        }
        if (target !== null && isBlank(url) && !target.startsWith("about:") && untouched) {
          store().updateLive(tabId, { isLoading: true });
          return;
        }
        pending.current = null;
        const kept = pageOf(tabId).newTabShown;
        if (kept) {
          if (url === kept.url) {
            patchPage(tabId, { newTabShown: { ...kept, title } });
            store().updateLive(tabId, { isLoading, canGoBack, canGoForward, themeColor });
            return;
          }
          patchPage(tabId, { newTabShown: null });
        }
        if (fromNewTab.current && url && !isBlank(url)) patchPage(tabId, { backToNewTab: true });
        store().navigated(tabId, { url, title }, { isLoading, canGoBack, canGoForward, themeColor });
        if (lastPage.current !== null && pageKey(url) !== lastPage.current) {
          if (pageOf(tabId).externalApp && hostOf(url) !== hostOf(lastPage.current)) answerExternalApp(tabId, false);
          dismissPermissions(tabId);
          setPopover(tabId, null);
          setPageSelection(tabId, null);
          patchPage(tabId, { popups: [], passwordPrompt: null, crashed: null, status: "" });
          revealToolbar(tabId);
        }
        lastPage.current = pageKey(url);
        patchPage(tabId, { themeColorSource: themeColorSource ?? null });
      }}
      onLoadError={() => {
        pending.current = null;
      }}
      onDownloadNavigation={({ committedUrl, skipped }) => {
        pending.current = null;
        const t = tab();
        if (!t) return;
        const s = store();
        store().updateLive(tabId, { isLoading: false });
        if (committedUrl) {
          if (t.url !== committedUrl) store().updateTab(tabId, { url: committedUrl });
          return;
        }
        const others = s.windows[t.windowId]?.tabIds.some((id) => id !== tabId && s.tabs[id]?.profileId === t.profileId);
        const opened = !!(t.openerId || t.adoptId) && !pageOf(tabId).wasNewTab;
        if (!skipped && opened && !s.live[tabId]?.canGoBack && others) return store().closeTab(tabId);
        patchPage(tabId, { backToNewTab: false, newTabShown: null });
        store().updateTab(tabId, { url: "", title: "", favicon: null });
      }}
      onProgress={(progress) => !prewarmOnly() && setPageProgress(tabId, progress)}
      onZoom={({ zoom }) => store().updateTab(tabId, { zoom })}
      onFindResult={({ count, active }) => store().setFind(tabId, { count, active })}
      onFavicon={(favicon) => {
        if (!favicon || !tab()) return;
        store().faviconChanged(tabId, favicon);
        noteFavicon(tabId, favicon);
      }}
      onMedia={({ playing, muted }) => {
        store().updateLive(tabId, { playingAudio: playing });
        if (tab()?.muted && !muted) void webviews.get(tabId)?.setMuted(true);
      }}
      onNowPlaying={(state) => setNowPlaying(tabId, state)}
      onPictureInPicture={(state) => setPictureInPictureState(tabId, state)}
      onDisplayMediaRequest={(request) => requestDisplayMedia(tabId, request)}
      onOpenWindow={onOpenWindow}
      onStatus={(status) => patchPage(tabId, { status })}
      onCrashed={(crashed) => {
        if (!isQuitting()) patchPage(tabId, { crashed, unresponsive: false, fullscreen: false, status: "" });
      }}
      onUnresponsive={() => patchPage(tabId, { unresponsive: true })}
      onResponsive={() => patchPage(tabId, { unresponsive: false })}
      onFullscreen={(fullscreen) => patchPage(tabId, { fullscreen })}
      onMediaAccess={(mediaAccess) => patchPage(tabId, { mediaAccess: mediaAccess.camera || mediaAccess.microphone || mediaAccess.screen ? mediaAccess : null })}
      onSecurity={(security) => !prewarmOnly() && patchPage(tabId, { security })}
      onContentBlocked={({ count }) => patchPage(tabId, { blocked: count })}
      onPopupBlocked={(popup) => {
        const first = !pageOf(tabId).popups.length;
        patchPage(tabId, { popups: [...pageOf(tabId).popups, popup] });
        if (first) void shouldPromptForPopups(engineProfile(profileId), popup.origin).then((ask) => ask && setPopover(tabId, "popups"));
      }}
      onPasswordPrompt={(prompt) => showPasswordPrompt(tabId, prompt)}
      onAutofillPrompt={(prompt, id) => showAutofillPrompt(tabId, prompt, id)}
      onExternalApp={(externalApp) => patchPage(tabId, { externalApp })}
      onPageFocus={() => {
        const t = tab();
        if (t && splitOf(store(), tabId) && store().windows[t.windowId]?.activeTabIds[t.profileId] !== tabId) store().activate(tabId);
      }}
      onWindowClose={() => !isQuitting() && store().closeTab(tabId)}
      onNotification={(notification) => showWebNotification(tabId, notification)}
      onCommand={({ command, text, modifiers }) => {
        if (command === "search") searchSelection(tabId, text, modifiers);
        else if (command === "ask") askAboutSelection(tabId, text);
        else if (command === "copyLinkToHighlight") void copyLinkToSelection(tabId);
        else if (command === "escape" && usePages.getState().popover[tabId]) setPopover(tabId, null);
        else if (command === "escape") closeLittleAstroOnEscape(tabId);
      }}
      onPageMessage={(kind, data) => {
        if (kind === "selection") setPageSelection(tabId, data as PageSelection | null);
        else if (kind === "scroll") noteScroll(tabId, data);
      }}
      onNotificationClose={closeWebNotification}
      onDiscarded={(url) => {
        pending.current = url;
        fromNewTab.current = false;
        patchPage(tabId, { backToNewTab: false, status: "" });
        store().updateLive(tabId, { isLoading: false, canGoBack: false, canGoForward: false, playingAudio: false });
        setPageProgress(tabId, 0);
        noteDiscarded(tabId);
      }}
      onActivateRequest={() => {
        const t = tab();
        if (!t) return;
        switchToTab(tabId);
        focus(t.windowId);
      }}
    />
  );
});
