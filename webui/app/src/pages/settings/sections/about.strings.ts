// About Astro -- every string this section renders, and the controls
// the page's search field can find in it.
//
// A section owns its own catalogue so that filling one in never touches a file
// another section is being filled in from. The two exports are read by two
// different shared files -- the message map by the app's catalogue
// (`platform/i18n/en.ts`), the control list by the page's registry -- and both
// of those are written once and never edited again to add a control here.

export const aboutStrings = {
  'settings.nav.about': 'About Astro',
  'settings.about.title': 'About Astro',

  'settings.about.group.build': 'This build',
  'settings.about.version': 'Chromium version',
  'settings.about.version.sublabel':
    'The major version only. It is read from the browser\'s own user agent, and ' +
    'Chromium reduces that string to the major number with zeroes after it, so ' +
    'the exact build number is at astro://version rather than here.',
  'settings.about.userAgent': 'User agent',
  'settings.about.build.footer':
    'Astro is Chromium with Google\'s services taken out and Oxy\'s put in, so ' +
    'the version above is the Chromium revision this build was made from.',

  'settings.about.group.updates': 'Updates',
  'settings.about.update': 'Is a newer Astro already installed?',
  'settings.about.update.sublabel':
    'Asks the browser whether a newer build is sitting on disk waiting for a ' +
    'restart. It downloads nothing.',
  'settings.about.update.action': 'Check',
  'settings.about.update.state': 'Answer',
  'settings.about.update.pending': 'Not asked yet',
  'settings.about.update.checking': 'Astro is looking',
  'settings.about.update.none':
    'No updater. Update Astro the way you installed it.',
  'settings.about.update.ready': 'A newer Astro is installed. Relaunch to use it.',
  'settings.about.update.failed': 'Astro could not answer',
  'settings.about.updates.footer':
    'Astro has no automatic updater, and this is not an omission. Chromium\'s ' +
    'own updater on Linux is a stub that never fetches anything, and the ' +
    'Google update service the branded builds use is one of the services this ' +
    'browser exists to remove. A button that offered to download an update ' +
    'would be offering something no code behind it can do.',

  'settings.about.group.attribution': 'Attribution',
  'settings.about.attribution.body':
    'Astro is a product of Oxy, built from the Chromium source. Chromium\'s ' +
    'own copyright and licence notices are the browser\'s, not Astro\'s, and ' +
    'Astro does not rewrite them: read them as the browser reports them, at ' +
    'astro://version and astro://credits.',
} as const;

/**
 * The controls this section ACTUALLY renders, for search to match on.
 *
 * The read-only rows are listed alongside the button: "version" is one of the
 * commonest things anyone types into a settings search field, and it is a row
 * this section really draws.
 */
export const aboutControls = [
  'settings.about.version',
  'settings.about.userAgent',
  'settings.about.update',
] as const;
