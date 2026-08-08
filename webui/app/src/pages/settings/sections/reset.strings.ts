// Reset settings -- every string this section renders, and the controls
// the page's search field can find in it.
//
// A section owns its own catalogue so that filling one in never touches a file
// another section is being filled in from. The two exports are read by two
// different shared files -- the message map by the app's catalogue
// (`platform/i18n/en.ts`), the control list by the page's registry -- and both
// of those are written once and never edited again to add a control here.

import type {SettingsControl} from '../controls.ts';

export const resetStrings = {
  'settings.nav.reset': 'Reset settings',
  'settings.reset.title': 'Reset settings',
  'settings.reset.dialog.title': 'Reset settings',
  'settings.reset.triggered.title': 'Reset requested by another program',

  'settings.reset.description':
    'Puts the settings a page or an extension is most likely to have changed ' +
    'back the way Astro ships them.',

  'settings.reset.changes.title': 'What a reset changes',
  'settings.reset.changes.body':
    'Your search engine, your homepage, the pages Astro opens at startup, your ' +
    'pinned tabs, your New Tab page customisations, every site permission and ' +
    'every cookie. Extensions are switched off rather than removed, and your ' +
    'language choices go back to the defaults.',
  'settings.reset.keeps.title': 'What a reset leaves alone',
  'settings.reset.keeps.body':
    'Your bookmarks, your history and your saved passwords are untouched. So ' +
    'is every other profile on this device: a reset is per profile.',

  'settings.reset.link': 'Reset settings to their defaults',
  'settings.reset.link.sublabel': 'You will be asked to confirm on the next screen.',

  'settings.reset.tampered': 'Has anything changed your settings?',
  'settings.reset.tampered.sublabel':
    'Asks Astro whether its own preference tracking has caught anything ' +
    'overwriting your settings.',
  'settings.reset.tampered.action': 'Check',
  'settings.reset.tampered.checking': 'Asking Astro',
  'settings.reset.tampered.result': 'What Astro said',
  'settings.reset.tampered.none': 'Nothing reported',
  'settings.reset.tampered.none.sublabel':
    'Astro only reports what its own preference tracking noticed, and only for ' +
    'five days afterwards, so this is not proof that nothing was changed.',
  'settings.reset.tampered.failed': 'It could not answer',
  'settings.reset.tampered.failed.sublabel':
    'The browser refused the request. Nothing has been changed.',

  'settings.reset.confirm.description':
    'This cannot be undone. Read what a reset changes before you press the ' +
    'button.',
  'settings.reset.confirm': 'Reset settings',
  'settings.reset.confirm.sublabel': 'Applies immediately to this profile.',
  'settings.reset.confirm.action': 'Reset',
  'settings.reset.confirm.running': 'Resetting',
  'settings.reset.outcome': 'Result',
  'settings.reset.done': 'Settings were reset',
  'settings.reset.done.sublabel':
    'Open windows keep the pages they are on. New windows use the defaults.',
  'settings.reset.failed': 'The reset did not run',
  'settings.reset.failed.sublabel':
    'The browser refused the request, so nothing has been changed.',
  'settings.reset.report.footer':
    'Chromium offers to upload a report of the settings that were reset, ' +
    'ticked by default, to a Google endpoint that no enterprise policy can ' +
    'switch off. Astro does not offer it and never sends it: the request this ' +
    'screen makes always says no.',

  'settings.reset.triggered.body':
    'Chromium lets an installer or a cleanup tool ask the browser to reset a ' +
    'profile, and shows this screen when one has. Nothing sets that request on ' +
    'Linux: the part of the browser that reads it is compiled for Windows only, ' +
    'so this screen exists for the address rather than for the flow.',
  'settings.reset.triggered.link': 'Reset settings yourself',
} as const;

/**
 * The controls this section ACTUALLY renders, for search to match on.
 *
 * The confirmation SUBPAGE's button is listed too. Someone searching for
 * "reset" is looking for the thing that resets, and it is one row further in --
 * on `/resetProfileSettings`, which is where the hit now goes.
 */
export const resetControls: readonly SettingsControl[] = [
  'settings.reset.link',
  'settings.reset.tampered',

  {id: 'settings.reset.confirm', on: '/resetProfileSettings'},
];
