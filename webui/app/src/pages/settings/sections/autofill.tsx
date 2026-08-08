// Autofill and passwords.
//
// Upstream ships TWO spellings of this section behind
// `autofill::features::kYourSavedInfoSettingsPage` -- `autofill_page/` and
// `your_saved_info_page/` -- and never constructs both. Astro routes both name
// sets at one section, so this screen is their union rather than either one:
// the switches that decide what Astro saves are here, and every list of saved
// things is a row that opens its own screen. `/addresses` is deliberately NOT
// linked: it is the older spelling of `/contactInfo` and renders the same
// upstream element, so linking both would be two rows to one screen. It stays
// routed, so an old link still lands.
//
// THE SWITCHES ARE THE WHOLE SECTION, and that is a measured limit rather than
// a stopping point. Every list this section is about -- addresses, cards,
// IBANs, identity documents, travel entities -- reaches the browser through
// `chrome.autofillPrivate`, and there is NO C++ handler behind any of it:
// `settings_ui.cc` registers `PasswordManagerHandler`, `SavedInfoHandler` and
// `PasskeysHandler` and nothing else autofill-shaped, and `SavedInfoHandler`
// only answers counts. The API itself is granted to this host (its `matches`
// pattern in chrome/common/extensions/api/_api_features.json is
// `chrome://settings/*`), but this app's browser layer exposes no binding for
// it, and that layer is not this section's to change.
//
// Three prefs are rendered and several are not, on one rule: a pref upstream
// shows unconditionally is here, and a pref upstream shows only when a feature
// flag or an OS capability says so is not. The excluded ones would work against
// the dev fixtures and be inert in a browser where the feature is off, which is
// the exact failure a switch must not have -- the user sets it, believes it,
// and is wrong. Excluded for that reason: `autofill.payment_cvc_storage`
// (`cvcStorageAvailable_`), `autofill.payment_card_benefits`
// (`cardBenefitsFlagEnabled_`) and `autofill.bnpl_enabled`
// (`shouldShowPayOverTimeSettings_`). Excluded for a stronger reason:
// `autofill.payment_methods_mandatory_reauth`, which upstream binds with
// `no-set-pref` and writes only after an OS biometric prompt via
// `authenticateUserAndFlipMandatoryAuthToggle()` -- writing that pref directly
// would turn the reauthentication requirement off without reauthenticating.

import {LinkRow} from '../components/link-row.tsx';
import {RowGroup} from '../components/row-group.tsx';
import {SectionHeader} from '../components/section-header.tsx';
import {ToggleRow} from '../components/toggle-row.tsx';

export function AutofillSection() {
  return (
    <>
      <SectionHeader
        title="settings.autofill.title"
        description="settings.autofill.description"
      />

      <RowGroup title="settings.autofill.group.filling">
        <ToggleRow
          prefKey="autofill.profile_enabled"
          label="settings.autofill.profileEnabled"
          sublabel="settings.autofill.profileEnabled.sublabel"
        />
        <ToggleRow
          prefKey="autofill.credit_card_enabled"
          label="settings.autofill.creditCardEnabled"
        />
        <ToggleRow
          prefKey="payments.can_make_payment_enabled"
          label="settings.autofill.canMakePayment"
          sublabel="settings.autofill.canMakePayment.sublabel"
        />
      </RowGroup>

      <RowGroup title="settings.autofill.group.saved" footer="settings.autofill.saved.footer">
        <LinkRow label="settings.autofill.contactInfo.title" to="/contactInfo" />
        <LinkRow label="settings.autofill.payments.title" to="/payments" />
        <LinkRow label="settings.autofill.identityDocs.title" to="/identityDocs" />
        <LinkRow label="settings.autofill.travel.title" to="/travel" />
        <LinkRow label="settings.autofill.passkeys.title" to="/passkeys" />
        <LinkRow label="settings.autofill.enhanced.title" to="/enhancedAutofill" />
      </RowGroup>
    </>
  );
}
