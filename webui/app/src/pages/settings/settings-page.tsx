// astro://settings.
//
// The first page of the app, and the one the rest are shaped by: a rail of
// sections, one section rendered at a time, everything it shows coming from
// the browser rather than from page state.
//
// SECTIONS below is the page's whole definition -- what exists, where it
// lives, what it is called, what it can be found by, and what draws it. The
// rail, the router and the search index are all read out of that one table, so
// a section cannot be reachable without being listed, listed without being
// reachable, or findable by a control it does not render.
//
// Two sections are real. The rest are declared and empty ON PURPOSE: an entry
// that is in the browser's own settings but not yet in Astro's is a fact worth
// showing the user, and a rail that hid them would make the page look finished.
// They render an empty state that names the section and says so. None of them
// fabricates a control.

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
  Zap_Stroke2_Corner0_Rounded,
} from '@oxyhq/bloom/icons';
import {Text} from '@oxyhq/bloom/typography';
import {useState, type ComponentType} from 'react';

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

import {AppearanceSection} from './sections/appearance.tsx';
import {PrivacySection} from './sections/privacy.tsx';

interface SectionDef {
  readonly title: MessageId;
  readonly icon: NavIcon;
  /**
   * The fragment this section owns. Upstream Chromium's own spelling wherever
   * upstream has one (`chrome/browser/resources/settings/route.ts`), so a link
   * or a bookmark made against the browser being replaced still lands.
   */
  readonly path: string;
  /**
   * Other fragments that resolve here, and any path BELOW one of them: Astro
   * folds several upstream pages into one section, and a deep link into a page
   * that no longer exists separately should land on the section that absorbed
   * it rather than on the default one.
   */
  readonly aliases?: readonly string[];
  /**
   * The controls this section actually renders, for search to match on.
   *
   * Empty for a section that renders none. Listing a control here that the
   * section does not draw would make the search field promise a setting the
   * page cannot show -- worse than not finding it.
   */
  readonly controls?: readonly MessageId[];
  /** Absent while the section is declared but not built. */
  readonly render?: ComponentType;
}

const SECTIONS = {
  appearance: {
    title: 'settings.nav.appearance',
    icon: ColorPalette_Stroke2_Corner0_Rounded,
    path: '/appearance',
    aliases: ['/fonts'],
    controls: [
      'settings.appearance.mode',
      'settings.appearance.mode.system',
      'settings.appearance.mode.light',
      'settings.appearance.mode.dark',
      'settings.appearance.preset',
    ],
    render: AppearanceSection,
  },
  privacy: {
    title: 'settings.nav.privacy',
    icon: Shield_Stroke2_Corner0_Rounded,
    path: '/privacy',
    aliases: ['/security', '/clearBrowserData', '/cookies', '/safetyCheck', '/adPrivacy'],
    controls: [
      'settings.privacy.doNotTrack',
      'settings.privacy.leakDetection',
      'settings.privacy.httpsOnly',
      'settings.privacy.searchSuggest',
    ],
    render: PrivacySection,
  },
  siteSettings: {
    title: 'settings.nav.siteSettings',
    icon: SettingsSliderVertical_Stroke2_Corner0_Rounded,
    path: '/content',
    aliases: ['/handlers'],
  },
  autofill: {
    title: 'settings.nav.autofill',
    icon: Key_Stroke2_Corner2_Rounded,
    path: '/autofill',
    aliases: ['/payments', '/addresses'],
  },
  search: {
    title: 'settings.nav.search',
    icon: MagnifyingGlass_Stroke2_Corner0_Rounded,
    path: '/search',
    aliases: ['/searchEngines'],
  },
  onStartup: {
    title: 'settings.nav.onStartup',
    icon: Play_Stroke2_Corner0_Rounded,
    path: '/onStartup',
  },
  downloads: {
    title: 'settings.nav.downloads',
    icon: Download_Stroke2_Corner0_Rounded,
    path: '/downloads',
  },
  identity: {
    title: 'settings.nav.identity',
    icon: UserCircle_Stroke2_Corner0_Rounded,
    path: '/identity',
    aliases: ['/people', '/signOut', '/manageProfile', '/syncSetup'],
  },
  adblock: {
    title: 'settings.nav.adblock',
    icon: CircleBanSign_Stroke2_Corner0_Rounded,
    path: '/adblock',
  },
  alia: {
    title: 'settings.nav.alia',
    icon: Sparkle_Stroke2_Corner0_Rounded,
    path: '/alia',
  },
  performance: {
    title: 'settings.nav.performance',
    icon: Zap_Stroke2_Corner0_Rounded,
    path: '/performance',
  },
  languages: {
    title: 'settings.nav.languages',
    icon: Globe_Stroke2_Corner0_Rounded,
    path: '/languages',
    aliases: ['/spellCheck', '/editDictionary'],
  },
  accessibility: {
    title: 'settings.nav.accessibility',
    icon: Accessibility_Stroke2_Corner2_Rounded,
    path: '/accessibility',
    aliases: ['/captions'],
  },
  system: {
    title: 'settings.nav.system',
    icon: Macintosh_Stroke2_Corner2_Rounded,
    path: '/system',
  },
  reset: {
    title: 'settings.nav.reset',
    icon: ArrowRotateCounterClockwise_Stroke2_Corner0_Rounded,
    path: '/reset',
    aliases: ['/resetProfileSettings'],
  },
  about: {
    title: 'settings.nav.about',
    icon: CircleInfo_Stroke2_Corner0_Rounded,
    path: '/help',
    aliases: ['/about'],
  },
} as const satisfies Record<string, SectionDef>;

type SectionId = keyof typeof SECTIONS;

const SECTION_IDS = Object.keys(SECTIONS) as readonly SectionId[];

/**
 * Where the page opens, and where an unrecognised fragment lands.
 *
 * A built section on purpose: an empty state as the first thing a user sees
 * would read as a page that failed to load rather than as one still being
 * filled in.
 */
const DEFAULT_SECTION: SectionId = 'appearance';

/** The rail, in the order a Chromium user expects to find these in. */
const GROUPS: readonly {readonly title?: MessageId; readonly ids: readonly SectionId[]}[] = [
  {ids: ['appearance', 'privacy', 'siteSettings', 'autofill', 'search', 'onStartup', 'downloads']},
  {title: 'settings.group.astro', ids: ['identity', 'adblock', 'alia']},
  {
    title: 'settings.group.advanced',
    ids: ['performance', 'languages', 'accessibility', 'system', 'reset'],
  },
  {ids: ['about']},
];

const BY_PATH = new Map<string, SectionId>(
  SECTION_IDS.flatMap(id => {
    const section: SectionDef = SECTIONS[id];
    return [section.path, ...(section.aliases ?? [])].map(
      path => [path, id] as const satisfies readonly [string, SectionId],
    );
  }),
);

/**
 * The section a fragment names.
 *
 * Longest prefix wins, so `/content/cookies` and `/content/all` -- upstream
 * spellings for pages below Site settings -- reach Site settings rather than
 * falling through to the default. Returns undefined for a fragment nothing
 * claims; the caller decides what that means.
 */
function sectionForPath(path: string): SectionId | undefined {
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
    for (const control of section.controls ?? []) {
      const label = t(control);
      if (label.toLowerCase().includes(query)) {
        hits.push({id, label, context: title});
      }
    }
    return hits;
  });
}

/**
 * A section that exists in the browser and not yet in this page.
 *
 * It says exactly that. The alternative -- leaving the entry out of the rail
 * until it works -- hides how much of the browser's settings this page does
 * not yet cover, from users and from whoever picks the work up next.
 */
function NotBuiltSection({title}: {title: string}) {
  return (
    <>
      <Text className="text-sectionTitle text-foreground">{title}</Text>
      <SectionCard>
        <Text className="text-body text-text-secondary">{t('settings.notBuilt')}</Text>
      </SectionCard>
    </>
  );
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
  const selected = sectionForPath(path) ?? DEFAULT_SECTION;
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

  // Through the interface, not the literal: `as const satisfies` keeps each
  // entry's own narrow type, and the entries without a `render` do not have the
  // property at all.
  const current: SectionDef = SECTIONS[selected];
  const Section = current.render;

  return (
    <PageShell
      title={t('settings.title')}
      groups={groups}
      selected={selected}
      onSelect={open}
      searchLabel={t('settings.search.label')}
      searchValue={query}
      onSearchChange={setQuery}
      emptyNavLabel={t('settings.search.noSection')}
    >
      {normalized === '' ? (
        Section ? (
          <Section />
        ) : (
          <NotBuiltSection title={t(SECTIONS[selected].title)} />
        )
      ) : (
        <SearchResults query={normalized} onOpen={open} />
      )}
    </PageShell>
  );
}
