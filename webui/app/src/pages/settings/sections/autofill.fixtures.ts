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
};
