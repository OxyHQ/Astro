// astro://settings.
//
// The first page of the app, and the one the rest are shaped by: a rail of
// sections, one screen rendered at a time, everything it shows coming from the
// browser rather than from page state.
//
// SECTIONS below is the page's whole definition -- what exists, where it lives,
// what it is called, what it can be found by, which of Chromium's own screens
// it stands in for, and what draws it. The rail, the router, the search index
// and the parity gate are all read out of that one table, so a screen cannot be
// reachable without being listed, listed without being reachable, or claimed as
// covering an upstream screen it does not route.
//
// The `upstream` field is the claim the gate checks. Chromium's settings has
// 110 routes (`docs/astro-next/baseline/settings-parity.md`, measured from
// `router.ts` rather than listed by hand); every one of them is either named
// here or declared in `settings-route-dispositions.json` with a reason, and
// `tools/tests/cases/settings-parity-covers-upstream.sh` fails naming any that
// is neither. Coverage here means ROUTED -- the screen exists and the fragment
// lands on it. Most of them render a pending state and say so.
//
// Nothing in this file needs editing to fill a section in. A section's strings,
// its searchable control list and its dev fixtures all live in files the
// section owns; this table names them once.

import {SettingsListGroup, SettingsListItem} from '@oxyhq/bloom';
import {
  Accessibility_Stroke2_Corner2_Rounded,
  ArrowRotateCounterClockwise_Stroke2_Corner0_Rounded,
  CircleBanSign_Stroke2_Corner0_Rounded,
  CircleInfo_Stroke2_Corner0_Rounded,
  ColorPalette_Stroke2_Corner0_Rounded,
  Download_Stroke2_Corner0_Rounded,
  Globe_Stroke2_Corner0_Rounded,
  Key_Stroke2_Corner2_Rounded,
  Macintosh_Stroke2_Corner2_Rounded,
  MagnifyingGlass_Stroke2_Corner0_Rounded,
  Play_Stroke2_Corner0_Rounded,
  SettingsSliderVertical_Stroke2_Corner0_Rounded,
  Shield_Stroke2_Corner0_Rounded,
  Sparkle_Stroke2_Corner0_Rounded,
  UserCircle_Stroke2_Corner0_Rounded,
  Window_Stroke2_Corner2_Rounded,
  Zap_Stroke2_Corner0_Rounded,
} from '@oxyhq/bloom/icons';
import {Text} from '@oxyhq/bloom/typography';
import {Suspense, lazy, useState, type ComponentType} from 'react';

import {
  PageShell,
  SectionCard,
  setHashPath,
  t,
  useHashPath,
  type MessageId,
  type NavGroup,
  type NavIcon,
} from '@astro/platform';

import {CONTENT_TYPES} from './sections/site-settings.content-types.ts';

// The searchable control list each section declares. Read here rather than
// written here: a section fills its own list in as it grows controls, and this
// file is not touched.
import {aboutControls} from './sections/about.strings.ts';
import {accessibilityControls} from './sections/accessibility.strings.ts';
import {adblockControls} from './sections/adblock.strings.ts';
import {aliaControls} from './sections/alia.strings.ts';
import {appearanceControls} from './sections/appearance.strings.ts';
import {autofillControls} from './sections/autofill.strings.ts';
import {defaultBrowserControls} from './sections/default-browser.strings.ts';
import {downloadsControls} from './sections/downloads.strings.ts';
import {languagesControls} from './sections/languages.strings.ts';
import {onStartupControls} from './sections/on-startup.strings.ts';
import {performanceControls} from './sections/performance.strings.ts';
import {privacyControls} from './sections/privacy.strings.ts';
import {resetControls} from './sections/reset.strings.ts';
import {searchControls} from './sections/search.strings.ts';
import {siteSettingsControls} from './sections/site-settings.strings.ts';
import {systemControls} from './sections/system.strings.ts';
import {youAndAstroControls} from './sections/you-and-astro.strings.ts';

/**
 * A screen: one thing the content column can be showing.
 *
 * Lazy on purpose. There are 90 of them, and a settings page that parsed every
 * screen it has before drawing the first one would pay for the whole surface at
 * every navigation to `astro://settings`.
 */
interface ScreenDef {
  readonly title: MessageId;
  /**
   * The fragment this screen owns. Upstream Chromium's own spelling wherever
   * upstream has one (`chrome/browser/resources/settings/route.ts`), so a link
   * or a bookmark made against the browser being replaced still lands.
   */
  readonly path: string;
  /**
   * The upstream route names this screen stands in for.
   *
   * Empty for a screen Astro invented. Never a guess: a name here is a claim
   * that a user looking for Chromium's screen of that name finds this one.
   */
  readonly upstream: readonly string[];
  readonly render: ComponentType;
}

interface SectionDef extends ScreenDef {
  readonly icon: NavIcon;
  /**
   * Other fragments that resolve here, and any path BELOW one of them. Astro
   * folds several upstream pages into one section, and a deep link into a page
   * that no longer exists separately should land on the section that absorbed
   * it rather than on the default one.
   */
  readonly aliases?: readonly string[];
  /**
   * The controls this section actually renders, for search to match on.
   *
   * Owned by the section's own `*.strings.ts`. Empty while it renders none:
   * listing a control the section does not draw would make the search field
   * promise a setting the page cannot show.
   */
  readonly controls: readonly MessageId[];
  /** Screens reached from inside this section. The rail stays on the parent. */
  readonly subpages?: readonly ScreenDef[];
}

/**
 * Site settings' 48 content-setting types, as 48 routed entries that all draw
 * the SAME screen. Built rather than written out: they differ only in the
 * fragment and the title, and forty-eight hand-written entries is forty-eight
 * chances to point one at the wrong component.
 */
const SITE_SETTINGS_TYPES: readonly ScreenDef[] = CONTENT_TYPES.map(type => ({
  title: type.title,
  path: `/content/${type.segment}`,
  upstream: [type.route],
  render: lazy(() =>
    import('./sections/site-settings-detail.tsx').then(m => ({
      default: m.SiteSettingsDetailScreen,
    })),
  ),
}));

const SECTIONS = {
  appearance: {
    title: 'settings.appearance.title',
    icon: ColorPalette_Stroke2_Corner0_Rounded,
    path: '/appearance',
    // BASIC is upstream's root route (`/`), which is where its settings page
    // opens. This is where Astro's opens, so this is the screen that stands in
    // for it.
    upstream: ['APPEARANCE', 'BASIC'],
    controls: appearanceControls,
    render: lazy(() =>
      import('./sections/appearance.tsx').then(m => ({default: m.AppearanceSection})),
    ),
    subpages: [
      {
        title: 'settings.appearance.fonts.title',
        path: '/fonts',
        upstream: ['FONTS'],
        render: lazy(() =>
          import('./sections/appearance-fonts.tsx').then(m => ({default: m.AppearanceFontsScreen})),
        ),
      },
    ],
  },
  search: {
    title: 'settings.searchEngine.title',
    icon: MagnifyingGlass_Stroke2_Corner0_Rounded,
    path: '/search',
    upstream: ['SEARCH'],
    controls: searchControls,
    render: lazy(() => import('./sections/search.tsx').then(m => ({default: m.SearchSection}))),
    subpages: [
      {
        title: 'settings.searchEngine.engines.title',
        path: '/searchEngines',
        upstream: ['SEARCH_ENGINES'],
        render: lazy(() =>
          import('./sections/search-engines.tsx').then(m => ({default: m.SearchEnginesScreen})),
        ),
      },
    ],
  },
  privacy: {
    title: 'settings.privacy.title',
    icon: Shield_Stroke2_Corner0_Rounded,
    path: '/privacy',
    upstream: ['PRIVACY'],
    controls: privacyControls,
    render: lazy(() => import('./sections/privacy.tsx').then(m => ({default: m.PrivacySection}))),
    subpages: [
      {
        title: 'settings.privacy.security.title',
        path: '/security',
        upstream: ['SECURITY'],
        render: lazy(() =>
          import('./sections/privacy-security.tsx').then(m => ({default: m.PrivacySecurityScreen})),
        ),
      },
      {
        title: 'settings.privacy.cookies.title',
        path: '/cookies',
        upstream: ['COOKIES'],
        render: lazy(() =>
          import('./sections/privacy-cookies.tsx').then(m => ({default: m.PrivacyCookiesScreen})),
        ),
      },
      {
        title: 'settings.privacy.clearData.title',
        path: '/clearBrowserData',
        upstream: ['CLEAR_BROWSER_DATA'],
        render: lazy(() =>
          import('./sections/privacy-clear-data.tsx').then(m => ({
            default: m.PrivacyClearDataScreen,
          })),
        ),
      },
      {
        title: 'settings.privacy.safetyHub.title',
        path: '/safetyCheck',
        upstream: ['SAFETY_HUB'],
        render: lazy(() =>
          import('./sections/privacy-safety-hub.tsx').then(m => ({
            default: m.PrivacySafetyHubScreen,
          })),
        ),
      },
      {
        title: 'settings.privacy.securityKeys.title',
        path: '/securityKeys',
        upstream: ['SECURITY_KEYS'],
        render: lazy(() =>
          import('./sections/privacy-security-keys.tsx').then(m => ({
            default: m.PrivacySecurityKeysScreen,
          })),
        ),
      },
    ],
  },
  siteSettings: {
    title: 'settings.siteSettings.title',
    icon: SettingsSliderVertical_Stroke2_Corner0_Rounded,
    path: '/content',
    upstream: ['SITE_SETTINGS'],
    controls: siteSettingsControls,
    render: lazy(() =>
      import('./sections/site-settings.tsx').then(m => ({default: m.SiteSettingsSection})),
    ),
    subpages: [
      {
        title: 'settings.siteSettings.allSites.title',
        path: '/content/all',
        upstream: ['SITE_SETTINGS_ALL'],
        render: lazy(() =>
          import('./sections/site-settings-all.tsx').then(m => ({
            default: m.SiteSettingsAllScreen,
          })),
        ),
      },
      {
        title: 'settings.siteSettings.siteDetails.title',
        path: '/content/siteDetails',
        upstream: ['SITE_SETTINGS_SITE_DETAILS'],
        render: lazy(() =>
          import('./sections/site-settings-site-details.tsx').then(m => ({
            default: m.SiteSettingsSiteDetailsScreen,
          })),
        ),
      },
      {
        title: 'settings.siteSettings.handlers.title',
        path: '/handlers',
        upstream: ['SITE_SETTINGS_HANDLERS'],
        render: lazy(() =>
          import('./sections/site-settings-handlers.tsx').then(m => ({
            default: m.SiteSettingsHandlersScreen,
          })),
        ),
      },
      {
        // Below `/content/filesystem`, which is one of the 48 built above, so
        // it must be declared: longest-prefix matching would otherwise resolve
        // it to the file-editing permission screen.
        title: 'settings.siteSettings.fileSystemDetails.title',
        path: '/content/filesystem/siteDetails',
        upstream: ['SITE_SETTINGS_FILE_SYSTEM_WRITE_DETAILS'],
        render: lazy(() =>
          import('./sections/site-settings-filesystem-details.tsx').then(m => ({
            default: m.SiteSettingsFilesystemDetailsScreen,
          })),
        ),
      },
      ...SITE_SETTINGS_TYPES,
    ],
  },
  autofill: {
    title: 'settings.autofill.title',
    icon: Key_Stroke2_Corner2_Rounded,
    path: '/autofill',
    // Two upstream names, one screen: `YOUR_SAVED_INFO` is the newer spelling
    // of the same `/autofill` section, chosen by a feature flag, and upstream
    // never constructs both.
    upstream: ['AUTOFILL', 'YOUR_SAVED_INFO'],
    controls: autofillControls,
    render: lazy(() => import('./sections/autofill.tsx').then(m => ({default: m.AutofillSection}))),
    subpages: [
      {
        title: 'settings.autofill.payments.title',
        path: '/payments',
        upstream: ['PAYMENTS'],
        render: lazy(() =>
          import('./sections/autofill-payments.tsx').then(m => ({
            default: m.AutofillPaymentsScreen,
          })),
        ),
      },
      {
        title: 'settings.autofill.addresses.title',
        path: '/addresses',
        upstream: ['ADDRESSES'],
        render: lazy(() =>
          import('./sections/autofill-addresses.tsx').then(m => ({
            default: m.AutofillAddressesScreen,
          })),
        ),
      },
      {
        title: 'settings.autofill.passkeys.title',
        path: '/passkeys',
        upstream: ['PASSKEYS'],
        render: lazy(() =>
          import('./sections/autofill-passkeys.tsx').then(m => ({
            default: m.AutofillPasskeysScreen,
          })),
        ),
      },
      {
        title: 'settings.autofill.enhanced.title',
        path: '/enhancedAutofill',
        upstream: ['AUTOFILL_AI'],
        render: lazy(() =>
          import('./sections/autofill-enhanced.tsx').then(m => ({
            default: m.AutofillEnhancedScreen,
          })),
        ),
      },
      {
        title: 'settings.autofill.contactInfo.title',
        path: '/contactInfo',
        upstream: ['YOUR_SAVED_INFO_CONTACT_INFO'],
        render: lazy(() =>
          import('./sections/autofill-contact-info.tsx').then(m => ({
            default: m.AutofillContactInfoScreen,
          })),
        ),
      },
      {
        title: 'settings.autofill.identityDocs.title',
        path: '/identityDocs',
        upstream: ['YOUR_SAVED_INFO_IDENTITY_DOCS'],
        render: lazy(() =>
          import('./sections/autofill-identity-docs.tsx').then(m => ({
            default: m.AutofillIdentityDocsScreen,
          })),
        ),
      },
      {
        title: 'settings.autofill.travel.title',
        path: '/travel',
        upstream: ['YOUR_SAVED_INFO_TRAVEL'],
        render: lazy(() =>
          import('./sections/autofill-travel.tsx').then(m => ({default: m.AutofillTravelScreen})),
        ),
      },
    ],
  },
  onStartup: {
    title: 'settings.onStartup.title',
    icon: Play_Stroke2_Corner0_Rounded,
    path: '/onStartup',
    upstream: ['ON_STARTUP'],
    controls: onStartupControls,
    render: lazy(() =>
      import('./sections/on-startup.tsx').then(m => ({default: m.OnStartupSection})),
    ),
  },
  downloads: {
    title: 'settings.downloads.title',
    icon: Download_Stroke2_Corner0_Rounded,
    path: '/downloads',
    upstream: ['DOWNLOADS'],
    controls: downloadsControls,
    render: lazy(() =>
      import('./sections/downloads.tsx').then(m => ({default: m.DownloadsSection})),
    ),
  },
  defaultBrowser: {
    title: 'settings.defaultBrowser.title',
    icon: Window_Stroke2_Corner2_Rounded,
    path: '/defaultBrowser',
    upstream: ['DEFAULT_BROWSER'],
    controls: defaultBrowserControls,
    render: lazy(() =>
      import('./sections/default-browser.tsx').then(m => ({default: m.DefaultBrowserSection})),
    ),
  },
  youAndAstro: {
    title: 'settings.youAndAstro.title',
    icon: UserCircle_Stroke2_Corner0_Rounded,
    path: '/identity',
    // Upstream's identity fragments land here, and none of them is CLAIMED:
    // `PEOPLE`, `ACCOUNT`, `SIGN_OUT` and `MANAGE_PROFILE` are Google-account
    // screens Astro replaces rather than reimplements, and are declared in
    // settings-route-dispositions.json. Routing them is still right -- a
    // bookmark to `/manageProfile` should reach the screen that took the job
    // over, not the default section.
    aliases: ['/people', '/account', '/signOut', '/manageProfile', '/syncSetup'],
    upstream: [],
    controls: youAndAstroControls,
    render: lazy(() =>
      import('./sections/you-and-astro.tsx').then(m => ({default: m.YouAndAstroSection})),
    ),
    subpages: [
      {
        title: 'settings.youAndAstro.importData.title',
        path: '/importData',
        upstream: ['IMPORT_DATA'],
        render: lazy(() =>
          import('./sections/you-and-astro-import-data.tsx').then(m => ({
            default: m.YouAndAstroImportDataScreen,
          })),
        ),
      },
    ],
  },
  adblock: {
    title: 'settings.adblock.title',
    icon: CircleBanSign_Stroke2_Corner0_Rounded,
    path: '/adblock',
    upstream: [],
    controls: adblockControls,
    render: lazy(() => import('./sections/adblock.tsx').then(m => ({default: m.AdblockSection}))),
  },
  alia: {
    title: 'settings.alia.title',
    icon: Sparkle_Stroke2_Corner0_Rounded,
    path: '/alia',
    upstream: [],
    controls: aliaControls,
    render: lazy(() => import('./sections/alia.tsx').then(m => ({default: m.AliaSection}))),
  },
  performance: {
    title: 'settings.performance.title',
    icon: Zap_Stroke2_Corner0_Rounded,
    path: '/performance',
    // `ADVANCED` is upstream's container for everything below the fold, and
    // `/advanced` is the fragment it opens at. This is the first entry of
    // Astro's own Advanced group, so it is where that fragment lands.
    aliases: ['/advanced'],
    upstream: ['PERFORMANCE', 'ADVANCED'],
    controls: performanceControls,
    render: lazy(() =>
      import('./sections/performance.tsx').then(m => ({default: m.PerformanceSection})),
    ),
    subpages: [
      {
        title: 'settings.performance.preloading.title',
        path: '/preloading',
        upstream: ['PRELOADING'],
        render: lazy(() =>
          import('./sections/performance-preloading.tsx').then(m => ({
            default: m.PerformancePreloadingScreen,
          })),
        ),
      },
    ],
  },
  languages: {
    title: 'settings.languages.title',
    icon: Globe_Stroke2_Corner0_Rounded,
    path: '/languages',
    upstream: ['LANGUAGES'],
    controls: languagesControls,
    render: lazy(() =>
      import('./sections/languages.tsx').then(m => ({default: m.LanguagesSection})),
    ),
    subpages: [
      {
        title: 'settings.languages.spellCheck.title',
        path: '/spellCheck',
        upstream: ['SPELL_CHECK'],
        render: lazy(() =>
          import('./sections/languages-spell-check.tsx').then(m => ({
            default: m.LanguagesSpellCheckScreen,
          })),
        ),
      },
      {
        title: 'settings.languages.editDictionary.title',
        path: '/editDictionary',
        upstream: ['EDIT_DICTIONARY'],
        render: lazy(() =>
          import('./sections/languages-edit-dictionary.tsx').then(m => ({
            default: m.LanguagesEditDictionaryScreen,
          })),
        ),
      },
    ],
  },
  accessibility: {
    title: 'settings.accessibility.title',
    icon: Accessibility_Stroke2_Corner2_Rounded,
    path: '/accessibility',
    upstream: ['ACCESSIBILITY'],
    controls: accessibilityControls,
    render: lazy(() =>
      import('./sections/accessibility.tsx').then(m => ({default: m.AccessibilitySection})),
    ),
    subpages: [
      {
        title: 'settings.accessibility.captions.title',
        path: '/captions',
        upstream: ['CAPTIONS'],
        render: lazy(() =>
          import('./sections/accessibility-captions.tsx').then(m => ({
            default: m.AccessibilityCaptionsScreen,
          })),
        ),
      },
    ],
  },
  system: {
    title: 'settings.system.title',
    icon: Macintosh_Stroke2_Corner2_Rounded,
    path: '/system',
    upstream: ['SYSTEM'],
    controls: systemControls,
    render: lazy(() => import('./sections/system.tsx').then(m => ({default: m.SystemSection}))),
  },
  reset: {
    title: 'settings.reset.title',
    icon: ArrowRotateCounterClockwise_Stroke2_Corner0_Rounded,
    path: '/reset',
    upstream: ['RESET'],
    controls: resetControls,
    render: lazy(() => import('./sections/reset.tsx').then(m => ({default: m.ResetSection}))),
    subpages: [
      {
        title: 'settings.reset.dialog.title',
        path: '/resetProfileSettings',
        upstream: ['RESET_DIALOG'],
        render: lazy(() =>
          import('./sections/reset-dialog.tsx').then(m => ({default: m.ResetDialogScreen})),
        ),
      },
      {
        title: 'settings.reset.triggered.title',
        path: '/triggeredResetProfileSettings',
        upstream: ['TRIGGERED_RESET_DIALOG'],
        render: lazy(() =>
          import('./sections/reset-triggered.tsx').then(m => ({default: m.ResetTriggeredScreen})),
        ),
      },
    ],
  },
  about: {
    title: 'settings.about.title',
    icon: CircleInfo_Stroke2_Corner0_Rounded,
    path: '/help',
    aliases: ['/about'],
    upstream: ['ABOUT'],
    controls: aboutControls,
    render: lazy(() => import('./sections/about.tsx').then(m => ({default: m.AboutSection}))),
  },
} as const satisfies Record<string, SectionDef>;

type SectionId = keyof typeof SECTIONS;

const SECTION_IDS = Object.keys(SECTIONS) as readonly SectionId[];

/**
 * Where the page opens, and where an unrecognised fragment lands.
 *
 * A built section on purpose: a pending screen as the first thing a user sees
 * would read as a page that failed to load rather than as one still being
 * filled in.
 */
const DEFAULT_SECTION: SectionId = 'appearance';

/** The rail, in the order a Chromium user expects to find these in. */
const GROUPS: readonly {readonly title?: MessageId; readonly ids: readonly SectionId[]}[] = [
  {
    ids: [
      'appearance',
      'search',
      'privacy',
      'siteSettings',
      'autofill',
      'onStartup',
      'downloads',
      'defaultBrowser',
    ],
  },
  {title: 'settings.group.astro', ids: ['youAndAstro', 'adblock', 'alia']},
  {
    title: 'settings.group.advanced',
    ids: ['performance', 'languages', 'accessibility', 'system', 'reset'],
  },
  {ids: ['about']},
];

/** What a fragment resolves to: the rail entry, and the screen in the column. */
interface Target {
  readonly section: SectionId;
  readonly screen: ScreenDef;
}

const BY_PATH = new Map<string, Target>(
  SECTION_IDS.flatMap(id => {
    const section: SectionDef = SECTIONS[id];
    const own = [section.path, ...(section.aliases ?? [])].map(
      path => [path, {section: id, screen: section}] as const,
    );
    const below = (section.subpages ?? []).map(
      subpage => [subpage.path, {section: id, screen: subpage}] as const,
    );
    return [...own, ...below];
  }),
);

/**
 * What a fragment names.
 *
 * Longest prefix wins, so a path below a screen -- an upstream fragment Astro
 * folded into a section, a sub-path of a subpage -- reaches that screen rather
 * than falling through to the default. Returns undefined for a fragment nothing
 * claims; the caller decides what that means.
 */
function targetForPath(path: string): Target | undefined {
  for (let candidate = path; candidate.length > 1; ) {
    const hit = BY_PATH.get(candidate);
    if (hit) {
      return hit;
    }
    const cut = candidate.lastIndexOf('/');
    if (cut <= 0) {
      return undefined;
    }
    candidate = candidate.slice(0, cut);
  }
  return undefined;
}

/** One thing the search field found. */
interface Hit {
  readonly id: SectionId;
  readonly label: string;
  readonly context: string;
}

function search(query: string): readonly Hit[] {
  return SECTION_IDS.flatMap(id => {
    const section: SectionDef = SECTIONS[id];
    const title = t(section.title);
    const hits: Hit[] = [];
    if (title.toLowerCase().includes(query)) {
      hits.push({id, label: title, context: t('settings.search.sectionContext')});
    }
    for (const control of section.controls) {
      const label = t(control);
      if (label.toLowerCase().includes(query)) {
        hits.push({id, label, context: title});
      }
    }
    return hits;
  });
}

function SearchResults({query, onOpen}: {query: string; onOpen: (id: SectionId) => void}) {
  const hits = search(query);
  return (
    <>
      <Text className="text-sectionTitle text-foreground">{t('settings.search.results')}</Text>
      {hits.length === 0 ? (
        <SectionCard>
          <Text className="text-body text-text-secondary">
            {t('settings.search.none', {query})}
          </Text>
        </SectionCard>
      ) : (
        <SettingsListGroup>
          {hits.map(hit => (
            <SettingsListItem
              key={`${hit.id}:${hit.label}`}
              title={hit.label}
              description={hit.context}
              onPress={() => onOpen(hit.id)}
            />
          ))}
        </SettingsListGroup>
      )}
    </>
  );
}

export function SettingsPage() {
  const [query, setQuery] = useState('');
  const path = useHashPath();
  const target = targetForPath(path) ?? {
    section: DEFAULT_SECTION,
    screen: SECTIONS[DEFAULT_SECTION],
  };
  const normalized = query.trim().toLowerCase();

  const open = (id: SectionId): void => {
    setQuery('');
    setHashPath(SECTIONS[id].path);
  };

  // While searching, the rail narrows to the sections that matched -- the same
  // index the results are built from, so the two can never disagree.
  const matched = new Set(search(normalized).map(hit => hit.id));
  const groups: readonly NavGroup<SectionId>[] = GROUPS.flatMap(group => {
    const entries = group.ids
      .filter(id => normalized === '' || matched.has(id))
      .map(id => ({id, title: t(SECTIONS[id].title), icon: SECTIONS[id].icon}));
    return entries.length === 0 ? [] : [{title: group.title ? t(group.title) : undefined, entries}];
  });

  const Screen = target.screen.render;

  return (
    <PageShell
      title={t('settings.title')}
      groups={groups}
      selected={target.section}
      onSelect={open}
      searchLabel={t('settings.search.label')}
      searchValue={query}
      onSearchChange={setQuery}
      emptyNavLabel={t('settings.search.noSection')}
    >
      {normalized === '' ? (
        // No fallback element: a screen's own chunk arrives in a frame or two
        // over a `astro://resources` load, and a spinner that flashes for one
        // frame reads as the page stuttering.
        <Suspense fallback={null}>
          <Screen />
        </Suspense>
      ) : (
        <SearchResults query={normalized} onOpen={open} />
      )}
    </PageShell>
  );
}
