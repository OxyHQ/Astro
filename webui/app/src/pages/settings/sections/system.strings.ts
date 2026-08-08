// System -- every string this section renders, and the controls
// the page's search field can find in it.
//
// A section owns its own catalogue so that filling one in never touches a file
// another section is being filled in from. The two exports are read by two
// different shared files -- the message map by the app's catalogue
// (`platform/i18n/en.ts`), the control list by the page's registry -- and both
// of those are written once and never edited again to add a control here.

export const systemStrings = {
  'settings.nav.system': 'System',
  'settings.system.title': 'System',
} as const;

/**
 * The controls this section ACTUALLY renders, for search to match on.
 *
 * Empty while the section renders none. Listing a control here that the section
 * does not draw makes the search field promise a setting the page cannot show,
 * which is worse than not finding it.
 */
export const systemControls = [] as const;
