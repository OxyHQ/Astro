// Reset settings -- the confirmation.
//
// Upstream draws this as a modal over the reset section. Astro draws it as its
// own screen at upstream's own fragment (`/resetProfileSettings`), because this
// page's screens are routed rather than layered and a modal that a deep link
// cannot open is a modal a bookmark cannot reach.
//
// `performResetProfileSettings` is ResetSettingsHandler's, and takes three
// arguments: the callback id, whether to upload a report, and where the request
// came from. The origin string is checked against a fixed set in
// `ResetRequestOriginFromString` (`reset_settings_handler.cc:54-71`) and
// anything outside it is a `NOTREACHED()`, so `'userclick'` here is a literal
// and not a description.
//
// The second argument is ALWAYS false, and that is the deliberate part.
// Chromium's dialog carries a checkbox, ticked by default, that uploads a
// report of everything the reset changed. It goes to
// `https://sb-ssl.google.com/safebrowsing/clientreport/chrome-reset`
// (`reset_report_uploader.cc:25`), its traffic annotation records that no
// enterprise policy may switch it off, and this tree has not neutered that URL
// the way it has the feedback one. A de-Googled browser does not offer it, and
// passing false makes `OnResetProfileSettingsDone` skip the snapshot diff and
// the upload entirely. Nothing else about the reset changes.
//
// Two more of the handler's messages are deliberately unused.
// `onShowResetProfileDialog` allocates the settings snapshot the report is
// built from, so with no report there is nothing to snapshot;
// `getReportedSettings` renders that snapshot for inspection, which is a viewer
// for a report this screen never sends.

import {sendWithPromise, t} from '@astro/platform';
import {useState} from 'react';

import {ActionRow} from '../components/action-row.tsx';
import {InfoRow} from '../components/info-row.tsx';
import {RowGroup} from '../components/row-group.tsx';
import {SubpageHeader} from '../components/section-header.tsx';

type Reset = 'idle' | 'running' | 'done' | 'failed';

export function ResetDialogScreen() {
  const [state, setState] = useState<Reset>('idle');

  const run = (): void => {
    setState('running');
    // The promise resolves with no value once the reset has finished, so the
    // button stays busy for as long as the browser is actually working.
    void sendWithPromise<void>('performResetProfileSettings', false, 'userclick').then(
      () => setState('done'),
      // Rendered rather than swallowed: a refusal that left the button back at
      // "Reset" would read as a reset that quietly did nothing.
      () => setState('failed'),
    );
  };

  return (
    <>
      <SubpageHeader
        title="settings.reset.dialog.title"
        description="settings.reset.confirm.description"
        backTo="/reset"
        backLabel="settings.nav.reset"
      />

      <RowGroup footer="settings.reset.report.footer">
        <ActionRow
          label="settings.reset.confirm"
          sublabel="settings.reset.confirm.sublabel"
          actionLabel={
            state === 'running' ? 'settings.reset.confirm.running' : 'settings.reset.confirm.action'
          }
          disabled={state === 'running' || state === 'done'}
          destructive
          onPress={run}
        />
        {/* The outcome goes in the row's VALUE, not its label: `InfoRow` fills
            an absent value with "not reported yet", which would sit next to
            "settings were reset" and say the opposite. */}
        {state === 'done' || state === 'failed' ? (
          <InfoRow
            label="settings.reset.outcome"
            value={t(state === 'done' ? 'settings.reset.done' : 'settings.reset.failed')}
            sublabel={
              state === 'done' ? 'settings.reset.done.sublabel' : 'settings.reset.failed.sublabel'
            }
          />
        ) : undefined}
      </RowGroup>
    </>
  );
}
