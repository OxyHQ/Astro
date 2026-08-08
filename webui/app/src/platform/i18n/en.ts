// Every string the app renders, in one place.
//
// The browser's own strings live in `.grd` files and reach a WebUI page
// through `loadTimeData`, which is worth bridging only for a page that adopts
// an upstream handler surface wholesale. Astro's pages are its own, so they
// carry their own catalog: a flat record with no runtime lookup table, which
// makes a missing or misspelled id a type error rather than a page that shows
// its own key back to the user.

export const en = {
  'app.unknownHost.title': 'No Astro page for this address',
  'app.unknownHost.body':
    'The browser served this bundle to a host it does not implement. Either a ' +
    'WebUIConfig is registered for a page that does not exist yet, or this page ' +
    'was removed and its registration was not.',
  'app.devIndex.title': 'Astro pages',
  'app.devIndex.body': 'Development server. Choose a page.',

  'settings.title': 'Settings',

  'settings.group.astro': 'Astro',
  'settings.group.advanced': 'Advanced',

  'settings.nav.appearance': 'Appearance',
  'settings.nav.privacy': 'Privacy and security',
  'settings.nav.siteSettings': 'Site settings',
  'settings.nav.autofill': 'Autofill and passwords',
  'settings.nav.search': 'Search engine',
  'settings.nav.onStartup': 'On startup',
  'settings.nav.downloads': 'Downloads',
  'settings.nav.identity': 'You and Astro',
  'settings.nav.adblock': 'Ad blocking',
  'settings.nav.alia': 'Alia',
  'settings.nav.performance': 'Performance',
  'settings.nav.languages': 'Languages',
  'settings.nav.accessibility': 'Accessibility',
  'settings.nav.system': 'System',
  'settings.nav.reset': 'Reset settings',
  'settings.nav.about': 'About Astro',

  'settings.search.label': 'Search settings',
  'settings.search.results': 'Search results',
  'settings.search.sectionContext': 'Section',
  'settings.search.none': 'Nothing in this page matches "{query}".',
  'settings.search.noSection': 'No section matches.',

  'settings.notBuilt':
    'This section is part of the browser but is not built into this page yet, ' +
    'so nothing here is editable. It is listed rather than hidden so the page ' +
    'does not imply it covers more than it does.',

  'settings.appearance.title': 'Appearance',
  'settings.appearance.mode': 'Theme',
  'settings.appearance.mode.system': 'System',
  'settings.appearance.mode.light': 'Light',
  'settings.appearance.mode.dark': 'Dark',
  'settings.appearance.preset': 'Colour',
  'settings.appearance.preset.description':
    'Applies to every Astro page and to the browser window itself.',

  'settings.privacy.title': 'Privacy and security',
  'settings.privacy.doNotTrack': 'Send a "Do Not Track" request',
  'settings.privacy.leakDetection': 'Warn if a password is exposed in a breach',
  'settings.privacy.httpsOnly': 'Always use secure connections',
  'settings.privacy.searchSuggest': 'Show search suggestions',

  'pref.unavailable': 'Not available in this profile',
  'pref.enforced': 'Managed by your organisation',
  'pref.enforcedBy': 'Managed by {controller}',
  'pref.recommendedOn': 'Your organisation recommends this setting on',
  'pref.recommendedOff': 'Your organisation recommends this setting off',
} as const;

export type MessageId = keyof typeof en;
