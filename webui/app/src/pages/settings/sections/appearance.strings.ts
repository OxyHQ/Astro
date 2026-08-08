// Appearance -- every string this section renders, and the controls
// the page's search field can find in it.
//
// A section owns its own catalogue so that filling one in never touches a file
// another section is being filled in from. The two exports are read by two
// different shared files -- the message map by the app's catalogue
// (`platform/i18n/en.ts`), the control list by the page's registry -- and both
// of those are written once and never edited again to add a control here.

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
} as const;

/**
 * The controls this section ACTUALLY renders, for search to match on.
 *
 * Listing a control here that the section does not draw makes the search field
 * promise a setting the page cannot show, which is worse than not finding it.
 */
export const appearanceControls = [
  'settings.appearance.mode',
  'settings.appearance.mode.system',
  'settings.appearance.mode.light',
  'settings.appearance.mode.dark',
  'settings.appearance.preset',
] as const;
