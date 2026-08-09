// Appearance -- every string this section renders, and the controls
// the page's search field can find in it.
//
// A section owns its own catalogue so that filling one in never touches a file
// another section is being filled in from. The two exports are read by two
// different shared files -- the message map by the app's catalogue
// (`platform/i18n/en.ts`), the control list by the page's registry -- and both
// of those are written once and never edited again to add a control here.

import type {SettingsControl} from '../controls.ts';

export const appearanceStrings = {
  'settings.nav.appearance': 'Appearance',
  'settings.appearance.title': 'Appearance',
  'settings.appearance.fonts.title': 'Fonts',

  'settings.appearance.mode': 'Theme',
  'settings.appearance.mode.system': 'System',
  'settings.appearance.mode.light': 'Light',
  'settings.appearance.mode.dark': 'Dark',
  'settings.appearance.preset': 'Colour',
  'settings.appearance.preset.description':
    'Applies to every Astro page and to the browser window itself.',

  'settings.appearance.group.customize': 'Customise',
  'settings.appearance.customize': 'Customise Astro',
  'settings.appearance.customize.sublabel':
    'Opens the side panel, where the New Tab page background and the toolbar are ' +
    'set. Its wallpaper controls appear only while a New Tab page is open.',
  'settings.appearance.customize.action': 'Open',

  'settings.appearance.group.homeButton': 'Home button',
  'settings.appearance.homeButton': 'Show home button',
  'settings.appearance.homepageIsNewTab': 'Open the New Tab page from the home button',
  'settings.appearance.homepageIsNewTab.sublabel':
    'Turn this off to open the custom web address instead.',
  'settings.appearance.homepage': 'Custom web address',
  'settings.appearance.homepage.sublabel':
    'Reported rather than edited: this page has no address field yet.',

  'settings.appearance.group.bookmarksBar': 'Bookmarks bar',
  'settings.appearance.bookmarksBar': 'Show bookmarks bar',
  'settings.appearance.tabGroupsInBookmarksBar': 'Show tab groups in the bookmarks bar',
  'settings.appearance.autoPinNewTabGroups':
    'Pin new tab groups to the bookmarks bar automatically',

  'settings.appearance.group.window': 'Window',
  'settings.appearance.sidePanelRight': 'Show the side panel on the right',
  'settings.appearance.hoverCardMemory': 'Show memory use on the tab preview card',
  'settings.appearance.splitViewDragAndDrop':
    'Allow split view by dragging to the left or right edge of the window',
  'settings.appearance.resetToolbar': 'Toolbar buttons',
  'settings.appearance.resetToolbar.sublabel':
    'Puts the pinned toolbar buttons back to the set Astro ships with.',
  'settings.appearance.resetToolbar.action': 'Reset',

  'settings.appearance.group.text': 'Text',
  'settings.appearance.fontSize': 'Font size',
  'settings.appearance.fontSize.verySmall': 'Very small',
  'settings.appearance.fontSize.small': 'Small',
  'settings.appearance.fontSize.medium': 'Medium (recommended)',
  'settings.appearance.fontSize.large': 'Large',
  'settings.appearance.fontSize.veryLarge': 'Very large',
  'settings.appearance.fonts.link': 'Customise fonts',

  'settings.appearance.fonts.size': 'Font size',
  'settings.appearance.fonts.minimumSize': 'Minimum font size',
  'settings.appearance.fonts.families': 'Font families',
  'settings.appearance.fonts.families.footer':
    'Choosing a family needs the list of fonts installed on this device, which ' +
    'the browser reports through a handler this page does not read yet. The ' +
    'current choice is shown so the page reports the truth rather than nothing.',
  'settings.appearance.fonts.standard': 'Standard font',
  'settings.appearance.fonts.serif': 'Serif font',
  'settings.appearance.fonts.sansSerif': 'Sans-serif font',
  'settings.appearance.fonts.fixed': 'Fixed-width font',
  'settings.appearance.fonts.math': 'Mathematical font',
} as const;

/**
 * The controls this section ACTUALLY renders, for search to match on.
 *
 * Listing a control here that the section does not draw makes the search field
 * promise a setting the page cannot show, which is worse than not finding it.
 *
 * The fonts SUBPAGE's controls are listed too, each naming `/fonts` as the
 * screen it is on. Before that they were listed bare, so a search for
 * "Minimum font size" opened `/appearance`, which does not have one -- found,
 * and then not there.
 */
export const appearanceControls: readonly SettingsControl[] = [
  'settings.appearance.mode',
  'settings.appearance.mode.system',
  'settings.appearance.mode.light',
  'settings.appearance.mode.dark',
  'settings.appearance.preset',
  'settings.appearance.customize',
  'settings.appearance.homeButton',
  'settings.appearance.homepageIsNewTab',
  'settings.appearance.homepage',
  'settings.appearance.bookmarksBar',
  'settings.appearance.tabGroupsInBookmarksBar',
  'settings.appearance.autoPinNewTabGroups',
  'settings.appearance.sidePanelRight',
  'settings.appearance.hoverCardMemory',
  'settings.appearance.splitViewDragAndDrop',
  'settings.appearance.resetToolbar',
  'settings.appearance.fontSize',
  'settings.appearance.fonts.link',

  {id: 'settings.appearance.fonts.size', on: '/fonts'},
  {id: 'settings.appearance.fonts.minimumSize', on: '/fonts'},
  {id: 'settings.appearance.fonts.standard', on: '/fonts'},
  {id: 'settings.appearance.fonts.serif', on: '/fonts'},
  {id: 'settings.appearance.fonts.sansSerif', on: '/fonts'},
  {id: 'settings.appearance.fonts.fixed', on: '/fonts'},
  {id: 'settings.appearance.fonts.math', on: '/fonts'},
];
