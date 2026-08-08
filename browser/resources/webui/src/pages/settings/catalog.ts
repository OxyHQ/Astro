// What the page SHOWS, and what it calls things.
//
// The distinction that matters: prefs.ts gets every preference the browser has
// from chrome.settingsPrivate, complete and unfiltered. This file decides which
// of them a person is offered and what words describe them -- which is what a
// settings page IS. Curating presentation is not the same defect as hard-wiring
// data; the page this replaces did the latter, and could therefore only ever
// offer the 41 prefs someone had remembered to type out.
//
// A pref with no entry here is not lost. It appears under "All settings",
// labelled from its own key, so the page can never silently hide something the
// browser can do.

export interface Section {
  id: string;
  title: string;
  /** Key prefixes that belong to this section, longest match wins. */
  prefixes: string[];
}

export const SECTIONS: Section[] = [
  {id: 'appearance', title: 'Appearance',
   prefixes: ['bookmark_bar', 'browser.show_home_button', 'browser.custom_chrome_frame',
              'extensions.toolbar', 'webkit.webprefs']},
  {id: 'privacy', title: 'Privacy and security',
   prefixes: ['profile.block_third_party_cookies', 'profile.cookie_controls_mode',
              'enable_do_not_track', 'safebrowsing', 'privacy_sandbox',
              'https_only_mode_enabled', 'dns_over_https']},
  {id: 'autofill', title: 'Autofill and passwords',
   prefixes: ['autofill', 'credentials_enable', 'payments']},
  {id: 'downloads', title: 'Downloads',
   prefixes: ['download', 'savefile']},
  {id: 'search', title: 'Search',
   prefixes: ['default_search_provider', 'search']},
  {id: 'accessibility', title: 'Accessibility',
   prefixes: ['settings.a11y', 'accessibility', 'caret_browsing']},
  {id: 'performance', title: 'Performance',
   prefixes: ['performance_tuning', 'memory_saver', 'battery_saver']},
  {id: 'languages', title: 'Languages',
   prefixes: ['intl', 'translate', 'spellcheck']},
];

/** Human wording for the prefs worth wording. */
export const LABELS: Record<string, string> = {
  'bookmark_bar.show_on_all_tabs': 'Show bookmarks bar on every tab',
  'browser.show_home_button': 'Show home button',
  'enable_do_not_track': 'Send a “Do Not Track” request',
  'https_only_mode_enabled': 'Always use secure connections',
  'profile.block_third_party_cookies': 'Block third-party cookies',
  'autofill.profile_enabled': 'Save and fill addresses',
  'autofill.credit_card_enabled': 'Save and fill payment methods',
  'credentials_enable_service': 'Offer to save passwords',
  'credentials_enable_autosignin': 'Sign in automatically',
  'download.prompt_for_download': 'Ask where to save each file',
  'search.suggest_enabled': 'Show search suggestions',
  'translate.enabled': 'Offer to translate pages',
  'settings.a11y.caretbrowsing.enabled': 'Navigate pages with a text cursor',
  'webkit.webprefs.default_font_size': 'Default font size',
  'webkit.webprefs.minimum_font_size': 'Minimum font size',
  'intl.accept_languages': 'Preferred languages',
};

/** The section a pref belongs to, or null when nothing claims it. */
export function sectionFor(key: string): Section | null {
  let best: Section | null = null;
  let bestLength = 0;
  for (const section of SECTIONS) {
    for (const prefix of section.prefixes) {
      if (key.startsWith(prefix) && prefix.length > bestLength) {
        best = section;
        bestLength = prefix.length;
      }
    }
  }
  return best;
}

/** A readable name, from the curated list or derived from the key itself. */
export function labelFor(key: string): string {
  const curated = LABELS[key];
  if (curated) {
    return curated;
  }
  // Derived, so an uncurated pref is still usable rather than hidden:
  // `profile.cookie_controls_mode` -> `Cookie controls mode`.
  const last = key.split('.').pop() ?? key;
  const words = last.replace(/_/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * Prefs whose value is a choice, and what each value means.
 *
 * chrome.settingsPrivate reports these as plain NUMBER or STRING: nothing in
 * the API says that cookie_controls_mode 1 is "block third-party in Incognito".
 * Naming a choice is presentation -- the same job as labelFor -- so it belongs
 * here rather than being inferred. A pref missing from this table still renders
 * with its real value in an editable field; it is never hidden.
 */
export interface Choice {
  value: string | number;
  label: string;
}

export const CHOICES: Record<string, Choice[]> = {
  'profile.cookie_controls_mode': [
    {value: 0, label: 'Allow all cookies'},
    {value: 1, label: 'Block third-party cookies in Incognito'},
    {value: 3, label: 'Block third-party cookies'},
  ],
  'generated.safe_browsing': [
    {value: 0, label: 'No protection'},
    {value: 1, label: 'Standard protection'},
    {value: 2, label: 'Enhanced protection'},
  ],
  'download.default_directory': [],
  'session.restore_on_startup': [
    {value: 1, label: 'Open a specific page or set of pages'},
    {value: 4, label: 'Continue where you left off'},
    {value: 5, label: 'Open the New Tab page'},
  ],
  'browser.clear_data.time_period': [
    {value: 0, label: 'Last hour'},
    {value: 1, label: 'Last 24 hours'},
    {value: 2, label: 'Last 7 days'},
    {value: 3, label: 'Last 4 weeks'},
    {value: 4, label: 'All time'},
  ],
  'performance_tuning.high_efficiency_mode.state': [
    {value: 0, label: 'Off'},
    {value: 1, label: 'When memory is low'},
    {value: 2, label: 'Always'},
  ],
  'net.network_prediction_options': [
    {value: 0, label: 'Standard preloading'},
    {value: 1, label: 'Extended preloading'},
    {value: 2, label: 'No preloading'},
  ],
};

/** The choices for a pref, or null when it is not a choice. */
export function choicesFor(key: string): Choice[] | null {
  const choices = CHOICES[key];
  // An empty array is a deliberate "known, but not a choice" marker for a pref
  // whose value looks enum-like and is not; returning it would render an empty
  // dropdown.
  return choices && choices.length > 0 ? choices : null;
}
