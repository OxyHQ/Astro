// Astro's internal pages, as ONE app.
//
// Every astro:// page the browser owns -- settings today, history, downloads
// and the panels next -- is an entry in this single Vite + Tailwind + Bloom
// app, not an app of its own. They share one shell, one design system and one
// build, so a fix to a row or a colour lands in all of them at once.
//
// The entry is the HOST, because that is what Chromium navigates to:
// astro://settings and astro://history are separate origins served the same
// bytes by the same C++ controller. Path segments below the host belong to the
// page.

import {Text} from '@oxyhq/bloom/typography';
import {Suspense, lazy, type ComponentType, type LazyExoticComponent, type ReactNode} from 'react';
import {createRoot} from 'react-dom/client';
import {Pressable, View} from 'react-native';

import {
  BloomThemeProvider,
  ROUTES,
  navigateTo,
  t,
  useThemeState,
  type RouteId,
} from './platform/index.ts';

/**
 * The pages, by host.
 *
 * Each is a lazy import so a host downloads its own page and no other. The
 * shared layer they all reach for is `@astro/platform`, which the packaging
 * step lifts out into one bundle served from the shared resources host.
 */
const PAGES: Record<string, LazyExoticComponent<ComponentType>> = {
  settings: lazy(() =>
    import('./pages/settings/settings-page.tsx').then(module => ({default: module.SettingsPage})),
  ),
  // Keyed by the HOST the browser serves it from, which is not `newtab` — see
  // kAstroNtpHost in astro_ntp_ui.h for why the canonical spelling has to wait
  // for the scheme composition.
  'astro-ntp': lazy(() =>
    import('./pages/newtab/new-tab-page.tsx').then(module => ({default: module.NewTabPage})),
  ),
  alia: lazy(() =>
    import('./pages/alia/alia-page.tsx').then(module => ({default: module.AliaPage})),
  ),
  // Astro's own host, ADDED rather than swapped: nothing upstream registers
  // `adblock`, so 054-adblock-webui-register.patch has a line of its own.
  adblock: lazy(() =>
    import('./pages/adblock/adblock-page.tsx').then(module => ({
      default: module.AdBlockPage,
    })),
  ),
  // Upstream's own host, taken over by 073-management-webui-takeover.patch.
  // Safe to swap because nothing under chrome/browser/ui/views/ names
  // ManagementUI's concrete type — see the controller header.
  management: lazy(() =>
    import('./pages/management/management-page.tsx').then(module => ({
      default: module.ManagementPage,
    })),
  ),
  // Upstream's own host, taken over by 071-whats-new-webui-takeover.patch
  // rather than registered beside it — WebUIConfigMap CHECKs on a duplicate
  // origin.
  'whats-new': lazy(() =>
    import('./pages/whatsnew/whats-new-page.tsx').then(module => ({
      default: module.WhatsNewPage,
    })),
  ),
};

/**
 * Which page this document is.
 *
 * The dev server has a single origin and no WebUI hosts, so the first path
 * segment stands in for the host -- the same key `navigate.ts` builds its dev
 * URLs from.
 */
function pageKey(): string {
  return import.meta.env.DEV ? (location.pathname.split('/')[1] ?? '') : location.hostname;
}

const PAGE_KEY = pageKey();
const ROUTE_IDS = Object.keys(ROUTES) as readonly RouteId[];
const IMPLEMENTED = ROUTE_IDS.filter(id => ROUTES[id].host in PAGES);

/**
 * A host that reached this bundle with no page behind it.
 *
 * Not a friendly placeholder. Every host here is one a C++ WebUIConfig
 * deliberately routed to this app, so arriving with nothing to render means
 * the registration and the app disagree -- and a placeholder would ship as
 * though the page existed.
 */
function UnknownHost({host}: {host: string}) {
  return (
    <View className="flex-1 items-center justify-center gap-3 bg-background p-8">
      <Text className="text-headerBold text-destructive">{t('app.unknownHost.title')}</Text>
      <Text className="text-body text-foreground">{host}</Text>
      <Text className="text-bodySmall text-text-secondary max-w-lg text-center">
        {t('app.unknownHost.body')}
      </Text>
    </View>
  );
}

/** The dev server's landing page: the entries that have a page behind them. */
function DevIndex() {
  return (
    <View className="flex-1 items-center justify-center gap-4 bg-background p-8">
      <Text className="text-headerBold text-foreground">{t('app.devIndex.title')}</Text>
      <Text className="text-body text-text-secondary">{t('app.devIndex.body')}</Text>
      <View className="gap-2">
        {IMPLEMENTED.map(id => (
          <Pressable
            key={id}
            accessibilityRole="link"
            onPress={() => navigateTo(id)}
            className="rounded-radius-12 border border-border px-4 py-2"
          >
            <Text className="text-body text-primary">{ROUTES[id].title}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function Page() {
  if (import.meta.env.DEV && PAGE_KEY === '') {
    return <DevIndex />;
  }
  const Resolved = PAGES[PAGE_KEY];
  if (!Resolved) {
    return <UnknownHost host={PAGE_KEY} />;
  }
  return (
    <Suspense fallback={null}>
      <Resolved />
    </Suspense>
  );
}

/**
 * The theme, from the browser, live.
 *
 * The provider sits above everything so a scheme or preset change re-renders
 * the whole page with new tokens -- no reload, and no page-side copy of the
 * choice to drift from the browser's own UI.
 */
function ThemeRoot({children}: {children: ReactNode}) {
  const {mode, preset} = useThemeState();
  return (
    <BloomThemeProvider mode={mode} colorPreset={preset}>
      {children}
    </BloomThemeProvider>
  );
}

const routeTitle = ROUTE_IDS.map(id => ROUTES[id]).find(route => route.host === PAGE_KEY)?.title;
if (routeTitle) {
  document.title = routeTitle;
}

const container = document.getElementById('root');
if (!container) {
  // The HTML and this bundle have drifted apart; the page would come up blank
  // with nothing in the console to say why.
  throw new Error('#root is missing from the document');
}

// Deliberately NO <StrictMode>: on web, react-native-web's Modal -- which
// Bloom's BottomSheet and bottom-placement Dialog use -- mounts its portal
// host during render and removes it in an effect cleanup, and StrictMode's dev
// double-invoke never re-attaches it, so those surfaces never paint. Console,
// accounts and the Oxy IdP all render without StrictMode for the same reason.
createRoot(container).render(
  <ThemeRoot>
    <Page />
  </ThemeRoot>,
);
