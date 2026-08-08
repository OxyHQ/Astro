// Default browser -- every string this section renders, and the controls
// the page's search field can find in it.
//
// A section owns its own catalogue so that filling one in never touches a file
// another section is being filled in from. The two exports are read by two
// different shared files -- the message map by the app's catalogue
// (`platform/i18n/en.ts`), the control list by the page's registry -- and both
// of those are written once and never edited again to add a control here.

export const defaultBrowserStrings = {
  'settings.nav.defaultBrowser': 'Default browser',
  'settings.defaultBrowser.title': 'Default browser',

  'settings.defaultBrowser.status': 'Default browser',
  'settings.defaultBrowser.status.is': 'Astro is your default browser.',
  'settings.defaultBrowser.status.isNot': 'Astro is not your default browser.',
  'settings.defaultBrowser.status.pending': 'Asking the system.',
  'settings.defaultBrowser.status.unknown':
    'The system did not give a clear answer about which browser is the default.',
  'settings.defaultBrowser.status.cannot':
    'This installation cannot make itself the default. That is usually a system-wide install without the rights to change the setting, or a platform that does not allow it from inside the browser.',
  'settings.defaultBrowser.status.managed':
    'Your organisation has decided which browser is the default, so this cannot be changed here.',
  'settings.defaultBrowser.status.failed':
    'The browser did not answer the question of whether it is the default: {reason}',
  'settings.defaultBrowser.make': 'Make Astro the default',
  'settings.defaultBrowser.make.button': 'Make default',
  'settings.defaultBrowser.make.sublabel':
    'Links opened from other applications will open in Astro.',
} as const;

/**
 * The controls this section ACTUALLY renders, for search to match on.
 *
 * Listing a control here that the section does not draw makes the search field
 * promise a setting the page cannot show, which is worse than not finding it.
 */
export const defaultBrowserControls = [
  'settings.defaultBrowser.status',
  'settings.defaultBrowser.make',
] as const;
