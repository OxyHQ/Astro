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
  'settings.autofill.remove': 'Remove',
  'settings.autofill.inAccount': 'In your account',
  'settings.autofill.addresses.description':
    'Addresses Astro offers to fill in for you.',
  'settings.autofill.addresses.empty':
    'No saved addresses. Astro offers to save one the first time you fill an ' +
    'address form.',
  'settings.autofill.addresses.unnamed': 'Saved address',
  'settings.autofill.addresses.footer':
    'Stored on this device. Removing one here does not change anything you ' +
    'have already submitted to a site.',
  'settings.autofill.addresses.locked':
    'Your organisation has switched address filling off, so these cannot be ' +
    'removed here.',
  'settings.autofill.addresses.noEditor':
    'Adding and editing an address is not built into this page yet. Astro ' +
    'still offers to save one when you fill an address form.',
  'settings.autofill.payments.description':
    'Cards and account numbers Astro offers to fill in for you.',
  'settings.autofill.payments.cards': 'Cards',
  'settings.autofill.payments.ibans': 'Account numbers',
  'settings.autofill.payments.empty':
    'No saved payment methods. Astro offers to save one the first time you ' +
    'pay on a site.',
  'settings.autofill.payments.unnamedCard': 'Saved card',
  'settings.autofill.payments.expires': 'Expires {month}/{year}',
  'settings.autofill.payments.locked':
    'Your organisation has switched card filling off, so these cannot be ' +
    'removed here.',
  'settings.autofill.payments.noEditor':
    'Adding and editing a payment method is not built into this page yet, and ' +
    'card numbers are deliberately never shown here.',
} as const;

/**
 * The controls this section ACTUALLY renders, for search to match on.
 *
 * Listing a control here that the section does not draw makes the search field
 * promise a setting the page cannot show, which is worse than not finding it.
 * The subpage titles are listed because the section draws a row for each of
 * them; the saved items inside those subpages are not, because it does not.
 *
 * No entry here names a subpage, and none should yet: what those screens draw
 * is saved records -- cards, addresses, account numbers -- not settings. The
 * three switches that decide whether Astro adds to them are on this screen.
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
