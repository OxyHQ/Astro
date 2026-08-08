// Reset requested by another program.
//
// Routed for the address, not for a flow this platform has. Chromium's
// triggered reset lets an installer or a cleanup utility leave a request in the
// profile that the browser picks up at startup; the component that reads it,
// `TriggeredProfileResetter`, is compiled under `#if BUILDFLAG(IS_WIN)` and the
// registration around it in `reset_settings_handler.cc:316-327` is too. On
// Linux `getTriggeredResetToolName` is registered, but its Windows body never
// runs and it resolves the generic fallback name -- so calling it would produce
// a sentence naming a tool that never asked for anything.
//
// Rather than fabricate that, the screen says what the address is for and sends
// the user to the reset they can actually perform. No handler call, and no
// control that writes anywhere.

import {SectionCard, t} from '@astro/platform';

import {LinkRow} from '../components/link-row.tsx';
import {RowGroup} from '../components/row-group.tsx';
import {SubpageHeader} from '../components/section-header.tsx';

export function ResetTriggeredScreen() {
  return (
    <>
      <SubpageHeader
        title="settings.reset.triggered.title"
        backTo="/reset"
        backLabel="settings.nav.reset"
      />
      <SectionCard description={t('settings.reset.triggered.body')} />
      <RowGroup>
        <LinkRow label="settings.reset.triggered.link" to="/resetProfileSettings" />
      </RowGroup>
    </>
  );
}
