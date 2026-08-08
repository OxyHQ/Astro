// Languages -- every string this section renders, and the controls
// the page's search field can find in it.
//
// A section owns its own catalogue so that filling one in never touches a file
// another section is being filled in from. The two exports are read by two
// different shared files -- the message map by the app's catalogue
// (`platform/i18n/en.ts`), the control list by the page's registry -- and both
// of those are written once and never edited again to add a control here.

export const languagesStrings = {
  'settings.nav.languages': 'Languages',
  'settings.languages.title': 'Languages',
  'settings.languages.spellCheck.title': 'Spell check',
  'settings.languages.editDictionary.title': 'Custom dictionary',

  'settings.languages.description':
    'Which languages Astro asks websites for, and which ones it checks your ' +
    'spelling in.',

  'settings.languages.group.preferred': 'Preferred languages',
  'settings.languages.preferred': 'Languages you read',
  'settings.languages.preferred.sublabel':
    'Sent to websites in the Accept-Language header, best first.',
  'settings.languages.preferred.footer':
    'Reported rather than edited. Adding, removing and reordering a language ' +
    'goes through chrome.languageSettingsPrivate, which is granted to this ' +
    'host but is not part of the browser API layer this page is built on yet.',

  'settings.languages.group.more': 'More',
  'settings.languages.spellCheck.link': 'Spell check',
  'settings.languages.spellCheck.link.sublabel':
    'Whether Astro underlines misspellings, and in which languages.',
  'settings.languages.translate.footer':
    'There is no translate control. Astro inherits the ungoogled-chromium ' +
    'change that switches translation off entirely unless the browser is ' +
    'started with --translate-script-url, and that change deliberately leaves ' +
    'the preference behind the control switched on, so a switch here would ' +
    'write a value the browser has been told to ignore.',

  'settings.languages.spellCheck.enabled': 'Check spelling as I type',
  'settings.languages.spellCheck.enabled.sublabel':
    'Underlines a word Astro does not recognise, in any text field.',
  'settings.languages.spellCheck.dictionaries': 'Languages checked',
  'settings.languages.spellCheck.dictionaries.none': 'None',
  'settings.languages.spellCheck.footer':
    'Which languages are checked is a list preference written whole, and ' +
    'choosing them needs the same language API the list above does. The ' +
    'switch and the languages already chosen are both live.',
  'settings.languages.spellCheck.enhanced.footer':
    'Chromium also offers an "enhanced" spell check that sends what you type ' +
    'to a Google service. Astro does not: the service needs an API key this ' +
    'browser deliberately ships without, and Chromium itself compiles that ' +
    'control out of any build that is not Google Chrome.',
  'settings.languages.editDictionary.link': 'Custom dictionary',
  'settings.languages.editDictionary.link.sublabel':
    'The words you told Astro to stop underlining.',
} as const;

/**
 * The controls this section ACTUALLY renders, for search to match on.
 *
 * The spell-check SUBPAGE's controls are listed too. The search field opens the
 * section a hit belongs to, and a setting that could not be found because it is
 * one row further in would be a setting the page has and cannot surface. The
 * custom dictionary is NOT listed: that screen is still pending, so finding it
 * would promise an editor the page does not draw.
 */
export const languagesControls = [
  'settings.languages.preferred',
  'settings.languages.spellCheck.link',
  'settings.languages.spellCheck.enabled',
  'settings.languages.spellCheck.dictionaries',
] as const;
