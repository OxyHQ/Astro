// On startup -- every string this section renders, and the controls
// the page's search field can find in it.
//
// A section owns its own catalogue so that filling one in never touches a file
// another section is being filled in from. The two exports are read by two
// different shared files -- the message map by the app's catalogue
// (`platform/i18n/en.ts`), the control list by the page's registry -- and both
// of those are written once and never edited again to add a control here.

export const onStartupStrings = {
  'settings.nav.onStartup': 'On startup',
  'settings.onStartup.title': 'On startup',

  'settings.onStartup.mode': 'When Astro opens',
  'settings.onStartup.mode.newTab': 'Open the New Tab page',
  'settings.onStartup.mode.newTab.description':
    'Every window starts on Astro\'s own new tab page.',
  'settings.onStartup.mode.last': 'Continue where you left off',
  'settings.onStartup.mode.last.description':
    'Reopens the tabs that were on screen when you last closed Astro.',
  'settings.onStartup.mode.urls': 'Open a specific set of pages',
  'settings.onStartup.mode.urls.description': 'Only the pages listed below.',
  'settings.onStartup.mode.lastAndUrls': 'Continue where you left off, and open these pages too',
  'settings.onStartup.mode.lastAndUrls.description':
    'The tabs from last time, plus the pages listed below.',

  'settings.onStartup.pages': 'Pages to open',
  'settings.onStartup.pages.empty': 'No pages yet. Add one below, or use the pages open now.',
  'settings.onStartup.pages.remove': 'Remove',
  'settings.onStartup.pages.add': 'Add a page',
  'settings.onStartup.pages.add.field': 'Site address',
  'settings.onStartup.pages.add.placeholder': 'example.com',
  'settings.onStartup.pages.add.button': 'Add',
  'settings.onStartup.pages.add.rejected':
    'The browser did not accept that address, so nothing was added.',
  'settings.onStartup.pages.useCurrent': 'Use the pages that are open now',
  'settings.onStartup.pages.useCurrent.button': 'Use current pages',
  'settings.onStartup.pages.unavailable':
    'The browser did not answer with the list of startup pages, so it cannot be shown or edited here. The choice above is a real preference and still applies.',
} as const;

/**
 * The controls this section ACTUALLY renders, for search to match on.
 *
 * Listing a control here that the section does not draw makes the search field
 * promise a setting the page cannot show, which is worse than not finding it.
 */
export const onStartupControls = [
  'settings.onStartup.mode',
  'settings.onStartup.mode.newTab',
  'settings.onStartup.mode.last',
  'settings.onStartup.mode.urls',
  'settings.onStartup.pages',
  'settings.onStartup.pages.add',
  'settings.onStartup.pages.useCurrent',
] as const;
