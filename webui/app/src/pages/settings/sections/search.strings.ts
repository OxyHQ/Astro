// Search engine -- every string this section renders, and the controls
// the page's search field can find in it.
//
// A section owns its own catalogue so that filling one in never touches a file
// another section is being filled in from. The two exports are read by two
// different shared files -- the message map by the app's catalogue
// (`platform/i18n/en.ts`), the control list by the page's registry -- and both
// of those are written once and never edited again to add a control here.
//
// The prefix is `settings.searchEngine`, not `settings.search`: the app's
// catalogue already uses `settings.search.*` for the page's own search FIELD,
// and two unrelated things under one prefix is how a string ends up rendered in
// the wrong place.

export const searchStrings = {
  'settings.nav.search': 'Search engine',
  'settings.searchEngine.title': 'Search engine',
  'settings.searchEngine.engines.title': 'Manage search engines',

  'settings.searchEngine.default': 'Default search engine',
  'settings.searchEngine.default.description':
    'The engine the address bar uses when what you type is a search rather than an address.',
  'settings.searchEngine.default.pending':
    'The browser has not reported its search engines yet.',
  'settings.searchEngine.manage': 'Manage search engines and site search',

  'settings.searchEngine.keywordSpace': 'Press Space to start a site search',
  'settings.searchEngine.keywordSpace.sublabel':
    'With this off, only Tab starts a site search from the address bar.',

  'settings.searchEngine.siteSearch': 'Site search',
  'settings.searchEngine.siteSearch.footer':
    'Type one of these shortcuts in the address bar to search that site directly.',
  'settings.searchEngine.siteSearch.empty': 'No site search shortcuts are active.',
  'settings.searchEngine.inactive': 'Inactive shortcuts',
  'settings.searchEngine.inactive.footer':
    'Engines Astro knows about but does not offer a shortcut for. Activating one ' +
    'makes its shortcut work in the address bar.',
  'settings.searchEngine.inactive.empty': 'No inactive shortcuts.',
  'settings.searchEngine.extensions': 'Added by extensions',
  'settings.searchEngine.extensions.footer':
    'An extension supplies these. Remove the extension to remove its engine.',

  'settings.searchEngine.activate': 'Activate',
  'settings.searchEngine.deactivate': 'Deactivate',
  'settings.searchEngine.editing.footer':
    'Adding, editing and deleting an engine each need a dialog this page does not ' +
    'carry yet, and deleting one needs the confirmation that goes with it. ' +
    'Choosing the default, and activating or deactivating a shortcut, work here.',
} as const;

/**
 * The controls this section ACTUALLY renders, for search to match on.
 *
 * Listing a control here that the section does not draw makes the search field
 * promise a setting the page cannot show, which is worse than not finding it.
 *
 * The engine names themselves are not listed and cannot be: they come from the
 * browser at runtime, and this list is a compile-time set of message ids.
 */
export const searchControls = [
  'settings.searchEngine.default',
  'settings.searchEngine.manage',
  'settings.searchEngine.keywordSpace',
  'settings.searchEngine.siteSearch',
] as const;
