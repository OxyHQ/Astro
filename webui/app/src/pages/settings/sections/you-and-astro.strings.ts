// You and Astro -- every string this section renders, and the controls
// the page's search field can find in it.
//
// A section owns its own catalogue so that filling one in never touches a file
// another section is being filled in from. The two exports are read by two
// different shared files -- the message map by the app's catalogue
// (`platform/i18n/en.ts`), the control list by the page's registry -- and both
// of those are written once and never edited again to add a control here.

export const youAndAstroStrings = {
  'settings.nav.youAndAstro': 'You and Astro',
  'settings.youAndAstro.title': 'You and Astro',
  'settings.youAndAstro.description':
    'Who you are to this browser: the account Astro would know you by, and the profile this copy of Astro keeps on this device.',
  'settings.youAndAstro.importData.title': 'Import bookmarks and settings',

  'settings.youAndAstro.account': 'Your Oxy account',
  'settings.youAndAstro.account.body':
    'Astro signs in with an Oxy account rather than a Google one, and nothing here can sign you in yet: this page has no way to reach an Oxy account, because the browser does not carry one. Wiring it up means a service in Astro\'s own overlay and a typed interface from it to this page, and neither exists. Until then this screen deliberately shows no sign-in control -- a button that opened nothing would be worse than the sentence you are reading.',
  'settings.youAndAstro.account.sync':
    'Syncing bookmarks, history and settings between your devices is tracked separately as issue #23 and is not part of this screen.',
  'settings.youAndAstro.account.replaces':
    'Chromium\'s own sign-in, account and profile-management screens all lead here. Astro removes them rather than reimplementing them: this build reports that signing in is not available, so nothing in the browser offers a Google account.',

  'settings.youAndAstro.profile': 'This profile, on this device',
  'settings.youAndAstro.profile.name': 'Profile name',
  'settings.youAndAstro.profile.name.field': 'Profile name',
  'settings.youAndAstro.profile.name.save': 'Rename',
  'settings.youAndAstro.profile.pending': 'Asking the browser which profile this is.',
  'settings.youAndAstro.profile.failed':
    'The browser did not answer with the profile: {reason}',
  'settings.youAndAstro.profile.footer':
    'A profile is local to this device. It is the set of bookmarks, history, extensions and settings this window is using, and it is not an account.',

  'settings.youAndAstro.importData.sublabel':
    'Take bookmarks, history and saved passwords from another browser on this device',

  // Import subpage.
  'settings.import.source': 'Import from',
  'settings.import.source.none':
    'Astro did not find another browser on this device that it knows how to read. You can still import a bookmarks file below.',
  'settings.import.kinds': 'What to bring over',
  'settings.import.kinds.footer':
    'Your choices are remembered, so the next import starts where this one left off.',
  'settings.import.kind.bookmarks': 'Bookmarks',
  'settings.import.kind.history': 'Browsing history',
  'settings.import.kind.passwords': 'Saved passwords',
  'settings.import.kind.searchEngines': 'Search engines',
  'settings.import.kind.formData': 'Autofill form data',
  'settings.import.kind.unsupported': 'The browser you chose cannot hand this over.',
  'settings.import.action': 'Import',
  'settings.import.action.button': 'Import',
  'settings.import.action.chooseSource': 'Choose a browser above first.',
  'settings.import.action.chooseKind': 'Choose at least one thing to bring over.',
  'settings.import.progress.inProgress': 'Importing.',
  'settings.import.progress.succeeded': 'Imported.',
  'settings.import.progress.failed': 'The import did not finish. Nothing was changed.',
  'settings.import.fromFile': 'Import a bookmarks file',
  'settings.import.fromFile.sublabel':
    'An HTML file exported from another browser. Astro opens a file picker.',
  'settings.import.fromFile.button': 'Choose a file',
  'settings.import.failed':
    'The browser did not answer with the list of browsers it can import from: {reason}',
} as const;

/**
 * The controls this section ACTUALLY renders, for search to match on.
 *
 * Listing a control here that the section does not draw makes the search field
 * promise a setting the page cannot show, which is worse than not finding it.
 */
export const youAndAstroControls = [
  'settings.youAndAstro.account',
  'settings.youAndAstro.profile.name',
  'settings.youAndAstro.importData.title',
] as const;
