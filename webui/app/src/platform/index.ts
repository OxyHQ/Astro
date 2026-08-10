// @astro/platform -- the surface a page is allowed to use.
//
// This is a barrel on purpose, and the only one in the app. It is not an
// import convenience: it is the module boundary the build cuts along. At the
// packaging end-state this file is compiled as its own bundle, packed into the
// shared resources target and served once at `astro://resources/astro/
// platform.js`, and every per-host page graph externalises this specifier. One
// URL means React, Bloom and the browser API layer are fetched, parsed and
// V8-code-cached ONCE for all of the browser's internal pages instead of once
// per host -- which only holds while pages reach them through here and not
// through their own imports of `react` or `@oxyhq/bloom`.
//
// What graduates into it: anything two pages use, or anything that is part of
// the design system. Nothing else -- a page's own components stay in the
// page's chunk, which is the half of the split that keeps first paint small.
//
// Not yet routed through here, and not an oversight: `react`, `react-dom` and
// the JSX runtime. The JSX transform emits an import of `react/jsx-runtime`
// into every component file, so no facade can be the only door to React. Those
// three need their own externalised entries when the split lands.

// The stylesheet belongs to this tier, not to an entry: Tailwind's output is
// mostly Bloom's own utilities, so the bundle that carries Bloom carries the
// CSS that makes it render.
import './global.css';

// Re-exported rather than imported from '@oxyhq/bloom/theme' by each entry.
// An entry that reached past this facade for it would pull a second physical
// copy of Bloom's theme module into its own chunk once the split lands, and
// Bloom's theme context is a globalThis-anchored singleton precisely because
// that duplication otherwise ends in "useTheme outside a BloomThemeProvider"
// with the provider plainly mounted.
export {BloomThemeProvider} from '@oxyhq/bloom/theme';

// The product's own mark, drawn by two entries and by neither of them twice.
export {AstroMark} from './brand/astro-mark.tsx';
export type {AstroMarkProps} from './brand/astro-mark.tsx';

export {PageShell} from './shell/page-shell.tsx';
export type {NavEntry, NavGroup, NavIcon, PageShellProps} from './shell/page-shell.tsx';

export {SectionCard} from './shell/section-card.tsx';
export type {SectionCardProps} from './shell/section-card.tsx';

export {t} from './i18n/index.ts';
export type {MessageId} from './i18n/index.ts';

export {MissingBrowserApiError} from './browser/env.ts';

export {settingsPrivate} from './browser/settings-private.ts';
export type {
  ControlledBy,
  Enforcement,
  Pref,
  PrefType,
  SettingsPrivateApi,
} from './browser/settings-private.ts';

export {setPref, usePref} from './browser/pref-store.ts';

// Lane 1 of the transport contract, alongside settingsPrivate: purpose-typed
// Chromium APIs the browser grants this host by URL pattern. Each facade
// exposes only the operations a screen calls -- never the API object -- so the
// surface a page can reach is the surface someone chose to give it.
export {removeAddress, removePaymentsEntity, usePersonalData} from './browser/autofill-store.ts';
export type {
  AutofillMetadata,
  PersonalData,
  SavedAddress,
  SavedCard,
  SavedIban,
} from './browser/autofill-private.ts';

export {
  addCustomWord,
  disableLanguage,
  enableLanguage,
  moveLanguage,
  removeCustomWord,
  useCustomWords,
  useDictionaryStatuses,
  useLanguages,
} from './browser/language-store.ts';
export type {
  DictionaryStatus,
  LanguageInfo,
  LanguageMove,
} from './browser/language-settings-private.ts';

// Type-only, and erased at build: the shape a settings section declares its dev
// fixtures in. Exported here rather than imported from `browser/mock/` by each
// section, so the mock directory stays reachable from exactly one place and a
// section cannot accidentally pull a fixture VALUE into a shipped bundle.
export type {
  AutofillFixtures,
  HandlerAction,
  HandlerReply,
  LanguageFixtures,
  SectionFixtures,
} from './browser/mock/fixtures.ts';

export {setMode, setPreset, useThemeState} from './browser/theme-store.ts';
export type {RawTheme, ThemeMode, ThemeSource, ThemeState} from './browser/theme-store.ts';

export {
  COLOR_SCHEME_DARK,
  COLOR_SCHEME_LIGHT,
  COLOR_SCHEME_PREF,
  COLOR_SCHEME_SYSTEM,
  THEME_PRESET_PREF,
} from './browser/pref-ids.ts';

export {hrefFor, navigateTo, ROUTES} from './browser/navigate.ts';
export type {RouteId} from './browser/navigate.ts';

export {setHashPath, useHashPath} from './browser/hash-route.ts';

export {addWebUIListener, send, sendWithPromise} from './browser/send.ts';
