// Autofill and passwords -- the dev browser this section renders from. DEV ONLY.
//
// Reached only from `platform/browser/mock/sections.ts`, which is imported only
// from inside an `import.meta.env.DEV` branch, so nothing here is emitted into a
// bundle the browser ships. See `platform/browser/env.ts`.
//
// All three prefs are entries in
// `chrome/browser/extensions/api/settings_private/prefs_util.cc` -- checked by
// the C++ constant the file actually uses (`autofill::prefs::*`,
// `payments::kCanMakePaymentEnabled`), not by grepping for the path string,
// which appears nowhere in that file.
//
// No handler messages: everything this section could otherwise show comes from
// `chrome.autofillPrivate`, not from a `WebUIMessageHandler`, so there is no
// message for a fixture to answer. See the header of `autofill.tsx`.
//
// The saved records below are that API's dataset, and this section is its sole
// declarant -- a second section declaring `autofill` is refused at startup
// naming both. The labels are the browser's own composition
// (`metadata.summaryLabel` / `summarySublabel`), because that is what the real
// API returns and what the screens render; a fixture that put the address in
// separate fields would be exercising a code path the screens do not have.
//
// One ACCOUNT record on purpose (`isLocal: false`). It is the shape that makes
// the delete button disappear, and a fixture set of local records only cannot
// tell a screen that honours that from one that ignores it.

import type {SectionFixtures} from '@astro/platform';

export const autofillFixtures: SectionFixtures = {
  prefs: [
    {key: 'autofill.profile_enabled', type: 'BOOLEAN', value: true},
    // ENFORCED, so the locked rendering path is drivable here without a managed
    // profile: a policy that switches card filling off is one of the commonest
    // real enterprise configurations, and the row must say who locked it rather
    // than accept the tap and do nothing.
    {
      key: 'autofill.credit_card_enabled',
      type: 'BOOLEAN',
      value: false,
      controlledBy: 'USER_POLICY',
      controlledByName: 'Astro dev policy',
      enforcement: 'ENFORCED',
    },
    {key: 'payments.can_make_payment_enabled', type: 'BOOLEAN', value: true},
  ],

  autofill: {
    addresses: [
      {
        guid: 'addr-home',
        metadata: {summaryLabel: 'Carrer de Mallorca 401', summarySublabel: 'Barcelona', isLocal: true},
      },
      {
        guid: 'addr-work',
        metadata: {summaryLabel: 'Gran Via 28', summarySublabel: 'Madrid', isLocal: true},
      },
      {
        guid: 'addr-account',
        metadata: {summaryLabel: '10 Downing Street', summarySublabel: 'London', isLocal: false},
      },
    ],
    cards: [
      {
        guid: 'card-visa',
        network: 'Visa',
        expirationMonth: '04',
        expirationYear: '2029',
        metadata: {summaryLabel: 'Visa \u2022\u2022\u2022\u2022 4242', summarySublabel: '04/2029', isLocal: true},
      },
      {
        guid: 'card-account',
        network: 'Mastercard',
        metadata: {summaryLabel: 'Mastercard \u2022\u2022\u2022\u2022 5454', isLocal: false},
      },
    ],
    ibans: [
      {
        guid: 'iban-savings',
        nickname: 'Savings',
        metadata: {summaryLabel: 'ES91 \u2022\u2022\u2022\u2022 0418', isLocal: true},
      },
    ],
  },
};
