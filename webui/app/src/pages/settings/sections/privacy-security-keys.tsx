// Security keys.
//
// Left as a pending screen, deliberately, and this comment is the reason.
//
// Four handlers back this page -- SecurityKeysPINHandler,
// SecurityKeysResetHandler, SecurityKeysCredentialHandler and
// SecurityKeysBioEnrollmentHandler, all registered in settings_ui.cc -- and
// none of them is a request/response pair. Each drives a multi-step
// conversation with a physical authenticator: begin, wait for the key to be
// touched, ask for a PIN, learn from the reply how many attempts remain,
// enumerate credentials, delete one, and unwind cleanly if the key is pulled
// out halfway. That is a state machine with its own error vocabulary, and the
// control set this page has -- rows bound to prefs, a row bound to an action --
// cannot express any of it. Half of it drawn as rows would be a screen that
// starts an operation on someone's authenticator and then has nowhere to say
// what happened.
//
// It also cannot be verified here. Every one of those flows needs a real key
// plugged in; there is nothing a dev fixture can stand in for that would tell
// a correct implementation from a broken one, so a screen built now would ship
// unmeasured. The honest state is the one that says the screen is not built.

import {PendingScreen} from '../components/pending-screen.tsx';

export function PrivacySecurityKeysScreen() {
  return (
    <PendingScreen
      title="settings.privacy.securityKeys.title"
      backTo="/privacy"
      backLabel="settings.nav.privacy"
    />
  );
}
