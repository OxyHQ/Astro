// The new tab page's own catalogue.
//
// Same arrangement as a settings section: the page owns its strings, and
// `platform/i18n/en.ts` names the export once. Nothing here is loaded through
// `loadTimeData` — this page adopts no upstream handler, so it has no upstream
// strings to bridge.

export const newTabStrings = {
  'newtab.title': 'New tab',

  'newtab.search.placeholder': 'Search the web',
  'newtab.search.submit': 'Search',
  'newtab.search.engine': 'Search engine',
  'newtab.search.enginePinned':
    'Your organisation chooses the search engine for this browser.',

  'newtab.blocked': '{count} ads and trackers blocked',

  'newtab.nav.customize': 'Customize',
  'newtab.nav.appearance': 'Appearance',
  'newtab.nav.whatsNew': "What's new",
  'newtab.nav.settings': 'Astro settings',

  'newtab.widget.weather': 'Weather',
  'newtab.widget.clock': 'Clock',
  'newtab.widget.quickLinks': 'Quick links',
  'newtab.widget.notes': 'Notes',
  'newtab.widget.discover': 'Discover',
  'newtab.widget.alia': 'Ask Alia',
  'newtab.widget.sites': 'Frequently visited',

  // Declared, not hidden. The widget is kept and drawn because removing it
  // would silently drop a thing the page had; it says why it is empty because
  // a card that shows nothing and explains nothing reads as a bug.
  'newtab.weather.unavailable': 'Weather is off',
  'newtab.weather.reason':
    'A new tab page may not fetch from the internet, so there is nowhere to ' +
    'get a forecast from until the browser can broker one for it.',

  'newtab.quickLinks.edit': 'Edit',
  'newtab.quickLinks.empty': 'No links yet.',

  'newtab.notes.placeholder': 'New note…',

  'newtab.discover.title': 'Explore trending topics',
  'newtab.discover.kicker': 'Discover',

  'newtab.alia.kicker': '/ask-alia',
  'newtab.alia.prompt': 'Ask Alia anything about the web, code, or ideas',

  'newtab.sites.empty': 'Sites you visit often will appear here.',

  'newtab.customize.title': 'Customize this page',
  'newtab.customize.close': 'Close',
  'newtab.customize.widgets': 'Widgets',
  'newtab.customize.widgetsHint':
    'Show, hide and reorder the cards on this page.',
  'newtab.customize.moveUp': 'Move {widget} earlier',
  'newtab.customize.moveDown': 'Move {widget} later',
  'newtab.customize.links': 'Quick links',
  'newtab.customize.linksHint':
    'Up to eight. Only http and https addresses; the browser refuses the rest.',
  'newtab.customize.linkTitle': 'Title',
  'newtab.customize.linkUrl': 'Address',
  'newtab.customize.linkAdd': 'Add link',
  'newtab.customize.linkRemove': 'Remove {title}',
  'newtab.customize.linkRejected':
    'The browser refused that address. It stored nothing.',
  'newtab.customize.engines': 'Search engine',
  'newtab.customize.enginesHint':
    'The browser’s default search provider — the same one the address bar ' +
    'uses. Changing it here changes it everywhere.',
} as const;
