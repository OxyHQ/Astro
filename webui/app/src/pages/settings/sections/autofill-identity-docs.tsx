// Identity documents.
//
// Routed, named, and not built yet. The screen exists in the registry so the
// fragment resolves and the rail is honest about how much of the browser's own
// settings this page does not cover; replace the body with the real controls.

import {PendingScreen} from '../components/pending-screen.tsx';

export function AutofillIdentityDocsScreen() {
  return (
    <PendingScreen
      title="settings.autofill.identityDocs.title"
      backTo="/autofill"
      backLabel="settings.nav.autofill"
    />
  );
}
