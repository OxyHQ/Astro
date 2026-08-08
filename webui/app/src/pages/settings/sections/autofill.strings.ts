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
  'settings.autofill.description':
    'What Astro offers to fill in for you, and where it keeps what it has saved.',
  'settings.autofill.payments.title': 'Payment methods',
  'settings.autofill.addresses.title': 'Addresses',
  'settings.autofill.passkeys.title': 'Passkeys',
  'settings.autofill.enhanced.title': 'Enhanced autofill',
  'settings.autofill.contactInfo.title': 'Contact info',
  'settings.autofill.identityDocs.title': 'Identity documents',
  'settings.autofill.travel.title': 'Travel',

  'settings.autofill.group.filling': 'Filling forms',
  'settings.autofill.profileEnabled': 'Save and fill addresses',
  'settings.autofill.profileEnabled.sublabel':
    'Names, phone numbers, email addresses and postal addresses.',
  'settings.autofill.creditCardEnabled': 'Save and fill payment methods',
  'settings.autofill.canMakePayment':
    'Let sites check whether you have a payment method saved',
  'settings.autofill.canMakePayment.sublabel':
    'A site is told only whether something is saved, never what it is.',

  'settings.autofill.group.saved': 'What Astro has saved',
  'settings.autofill.saved.footer':
    'Each of these lists lives in the browser rather than in this page, and ' +
    'reading one needs an API this page does not reach yet. The switches above ' +
    'decide whether Astro adds to them; the screens below will show what is in ' +
    'them once they are built.',
} as const;

/**
 * The controls this section ACTUALLY renders, for search to match on.
 *
 * Listing a control here that the section does not draw makes the search field
 * promise a setting the page cannot show, which is worse than not finding it.
 * The subpage titles are listed because the section draws a row for each of
 * them; the saved items inside those subpages are not, because it does not.
 */
export const autofillControls = [
  'settings.autofill.profileEnabled',
  'settings.autofill.creditCardEnabled',
  'settings.autofill.canMakePayment',
  'settings.autofill.contactInfo.title',
  'settings.autofill.payments.title',
  'settings.autofill.identityDocs.title',
  'settings.autofill.travel.title',
  'settings.autofill.passkeys.title',
  'settings.autofill.enhanced.title',
] as const;
