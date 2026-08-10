// What's New -- every string this page renders.
//
// The six feature entries are shipped editorial content, not a changelog the
// browser computes, so they live here beside the page that draws them. Four of
// the six were REWRITTEN rather than copied across, because what the previous
// page claimed and what this browser does had drifted apart -- see the notes in
// whats-new-page.tsx, which name the measurement behind each correction.

export const whatsNewStrings = {
  'whatsNew.title': 'What’s new in Astro',
  'whatsNew.subtitle': 'What this browser does that Chromium does not.',
  'whatsNew.version': 'Astro {version}',
  'whatsNew.version.unknown': 'Astro',

  'whatsNew.feature.adblock': 'Ads and trackers, blocked',
  'whatsNew.feature.adblock.body':
    'The blocker is part of the browser and is on from the first launch. No ' +
    'extension to install, nothing to configure, and the shield in the toolbar ' +
    'says what it stopped on the page you are looking at.',

  'whatsNew.feature.alia': 'A place for Alia',
  'whatsNew.feature.alia.body':
    'Oxy’s assistant has a panel of its own beside the page, reachable from ' +
    'every window. What it can answer is still being built — open it and it ' +
    'tells you exactly what is missing rather than pretending.',

  'whatsNew.feature.account': 'Your Oxy account, in the browser',
  'whatsNew.feature.account.body':
    'Sign in once and the browser knows who you are: the profile menu is your ' +
    'Oxy identity rather than a Google one. Signing in does not upload your ' +
    'browsing — there is no sync service behind it.',

  'whatsNew.feature.theme': 'A colour you choose',
  'whatsNew.feature.theme.body':
    'Astro is drawn in Oxy’s design language, and the colour is a setting. ' +
    'Pick a preset and the toolbar, the menus and every one of the browser’s ' +
    'own pages repaint together, with no restart.',

  'whatsNew.feature.search': 'Search that does not profile you',
  'whatsNew.feature.search.body':
    'DuckDuckGo is the default search engine, in the omnibox and on the new ' +
    'tab page — which use the same engine, because the new tab page asks the ' +
    'browser rather than keeping a list of its own.',

  'whatsNew.feature.degoogled': 'De-Googled',
  'whatsNew.feature.degoogled.body':
    'Built on Chromium with Google’s services taken out rather than switched ' +
    'off: no Safe Browsing calls, no field trials, no Google account plumbing ' +
    'left waiting to be re-enabled.',

  'whatsNew.getStarted': 'Get started',
  'whatsNew.footer': 'Made with care in the world, by Oxy.',
  'whatsNew.footer.website': 'Website',
  'whatsNew.footer.github': 'GitHub',
  'whatsNew.footer.privacy': 'Privacy policy',
} as const;
