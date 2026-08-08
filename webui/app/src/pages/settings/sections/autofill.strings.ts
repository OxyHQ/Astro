// Autofill and passwords -- every string this section renders, and the controls
// the page's search field can find in it.
//
// A section owns its own catalogue so that filling one in never touches a file
// another section is being filled in from. The two exports are read by two
// different shared files -- the message map by the app's catalogue
// (`platform/i18n/en.ts`), the control list by the page's registry -- and both
// of those are written once and never edited again to add a control here.

export const autofillStrings = {
  'settings.nav.autofill': 'Autofill and passwords',
  'settings.autofill.title': 'Autofill and passwords',
  'settings.autofill.payments.title': 'Payment methods',
  'settings.autofill.addresses.title': 'Addresses',
  'settings.autofill.passkeys.title': 'Passkeys',
  'settings.autofill.enhanced.title': 'Enhanced autofill',
  'settings.autofill.contactInfo.title': 'Contact info',
  'settings.autofill.identityDocs.title': 'Identity documents',
  'settings.autofill.travel.title': 'Travel',
} as const;

/**
 * The controls this section ACTUALLY renders, for search to match on.
 *
 * Empty while the section renders none. Listing a control here that the section
 * does not draw makes the search field promise a setting the page cannot show,
 * which is worse than not finding it.
 */
export const autofillControls = [] as const;
