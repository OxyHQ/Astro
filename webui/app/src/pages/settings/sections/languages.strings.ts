// Languages -- every string this section renders, and the controls
// the page's search field can find in it.
//
// A section owns its own catalogue so that filling one in never touches a file
// another section is being filled in from. The two exports are read by two
// different shared files -- the message map by the app's catalogue
// (`platform/i18n/en.ts`), the control list by the page's registry -- and both
// of those are written once and never edited again to add a control here.

import type {SettingsControl} from '../controls.ts';

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
    'Websites are offered these in order, best first. Astro also checks your ' +
    'spelling in the ones that have a dictionary.',

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
  'settings.languages.primary': 'Preferred',
  'settings.languages.moveUp': 'Move up',
  'settings.languages.remove': 'Remove',
  'settings.languages.preferred.locked':
    'Your organisation has fixed the languages this profile accepts, so they ' +
    'cannot be added, removed or reordered here.',
  'settings.languages.add': 'Add a language',
  'settings.languages.add.filter': 'Filter languages',
  'settings.languages.add.action': 'Add',
  'settings.languages.add.narrow':
    'Only the first 40 are shown. Type above to narrow the list.',
  'settings.languages.editDictionary.description':
    'Words you added are never underlined as misspelled, in any language.',
  'settings.languages.editDictionary.add': 'Add a word',
  'settings.languages.editDictionary.addAction': 'Add',
  'settings.languages.editDictionary.remove': 'Remove',
  'settings.languages.editDictionary.duplicate': '"{word}" is already in the dictionary.',
  'settings.languages.editDictionary.empty':
    'Nothing here yet. Words you add from a page\u2019s right-click menu show up ' +
    'in this list too.',
  'settings.languages.editDictionary.footer':
    'These words are stored on this device only. Astro never sends them ' +
    'anywhere.',
  'settings.languages.editDictionary.inert':
    'Spell check is currently off, so nothing is being underlined and these ' +
    'words are not in use. They are kept for when you turn it back on.',
  'settings.languages.spellCheck.dictionary': 'Dictionary',
  'settings.languages.spellCheck.downloads': 'Dictionaries still arriving',
  'settings.languages.spellCheck.dictionary.downloading': 'downloading',
  'settings.languages.spellCheck.dictionary.notReady': 'not on this device yet',
  'settings.languages.spellCheck.dictionary.failed':
    'could not be downloaded \u2014 spell check will skip this language',
  'settings.languages.editDictionary.link': 'Custom dictionary',
  'settings.languages.editDictionary.link.sublabel':
    'The words you told Astro to stop underlining.',
} as const;

/**
 * The controls this section ACTUALLY renders, for search to match on.
 *
 * Both SUBPAGES' controls are listed too, each naming the screen it is on.
 * Their TITLES are indexed separately by the registry, which already routes a
 * hit on one to that subpage; what needed naming here is the controls INSIDE
 * them, which a bare entry would have sent to `/languages`.
 */
export const languagesControls: readonly SettingsControl[] = [
  'settings.languages.preferred',
  'settings.languages.spellCheck.link',
  'settings.languages.add',

  {id: 'settings.languages.spellCheck.enabled', on: '/spellCheck'},
  {id: 'settings.languages.spellCheck.dictionaries', on: '/spellCheck'},
  {id: 'settings.languages.editDictionary.add', on: '/editDictionary'},
];
