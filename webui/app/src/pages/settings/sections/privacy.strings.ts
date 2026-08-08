// Privacy and security -- every string this section renders, and the controls
// the page's search field can find in it.
//
// A section owns its own catalogue so that filling one in never touches a file
// another section is being filled in from. The two exports are read by two
// different shared files -- the message map by the app's catalogue
// (`platform/i18n/en.ts`), the control list by the page's registry -- and both
// of those are written once and never edited again to add a control here.

export const privacyStrings = {
  'settings.nav.privacy': 'Privacy and security',
  'settings.privacy.title': 'Privacy and security',
  'settings.privacy.security.title': 'Security',
  'settings.privacy.cookies.title': 'Third-party cookies',
  'settings.privacy.clearData.title': 'Delete browsing data',
  'settings.privacy.safetyHub.title': 'Safety check',
  'settings.privacy.securityKeys.title': 'Security keys',

  'settings.privacy.doNotTrack': 'Send a "Do Not Track" request',
  'settings.privacy.leakDetection': 'Warn if a password is exposed in a breach',
  'settings.privacy.httpsOnly': 'Always use secure connections',
  'settings.privacy.searchSuggest': 'Show search suggestions',
} as const;

/**
 * The controls this section ACTUALLY renders, for search to match on.
 *
 * Listing a control here that the section does not draw makes the search field
 * promise a setting the page cannot show, which is worse than not finding it.
 */
export const privacyControls = [
  'settings.privacy.doNotTrack',
  'settings.privacy.leakDetection',
  'settings.privacy.httpsOnly',
  'settings.privacy.searchSuggest',
] as const;
