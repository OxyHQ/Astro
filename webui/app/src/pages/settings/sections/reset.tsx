// Reset settings.
//
// No preferences at all -- upstream's reset page binds none, and neither does
// this one. Everything is ResetSettingsHandler, installed unguarded by
// `chrome/browser/ui/webui/settings/settings_ui.cc:444`.
//
// This screen makes exactly one handler call, `getTamperedPreferencePaths`,
// which resolves an array of LOCALISED LABELS rather than the pref paths its
// name suggests (`reset_settings_handler.cc:230-250` maps a tampered path to a
// string like "Search engine"). It is the data behind upstream's reset banner,
// surfaced as a button instead: the banner is decided at page load from
// `ShouldShowResetProfileBanner`, which this page has no `loadTimeData` bridge
// to read, and a check the user asks for is in any case easier to word honestly
// than a banner that appears on its own.
//
// The honesty matters here more than usual. An empty answer is NOT proof that
// nothing was changed: the handler returns an empty list outright when
// `features::kShowResetProfileBannerV2` is off, and clears its record five days
// after the tracking noticed anything. The empty state says so rather than
// reporting "all clear".
//
// The reset itself is one screen further in, at `/resetProfileSettings`.

import {SectionCard, sendWithPromise, t} from '@astro/platform';
import {useState} from 'react';

import {ActionRow} from '../components/action-row.tsx';
import {InfoRow} from '../components/info-row.tsx';
import {LinkRow} from '../components/link-row.tsx';
import {RowGroup} from '../components/row-group.tsx';
import {SectionHeader} from '../components/section-header.tsx';

/** What the tampered-settings check has told us so far. */
type Check =
  | {readonly state: 'idle'}
  | {readonly state: 'checking'}
  | {readonly state: 'answered'; readonly labels: readonly string[]}
  | {readonly state: 'failed'};

export function ResetSection() {
  // Handler-backed and asked for, not loaded: the check runs when the user
  // presses the button, so there is no mount effect and no round trip on a
  // screen the user is only passing through.
  const [check, setCheck] = useState<Check>({state: 'idle'});

  const run = (): void => {
    setCheck({state: 'checking'});
    void sendWithPromise<readonly unknown[]>('getTamperedPreferencePaths').then(
      answer => {
        setCheck({
          state: 'answered',
          labels: answer.filter((entry): entry is string => typeof entry === 'string'),
        });
      },
      // The rejection is rendered, not swallowed: a failed check that fell back
      // to the empty state would read as "nothing was changed".
      () => setCheck({state: 'failed'}),
    );
  };

  return (
    <>
      <SectionHeader title="settings.reset.title" description="settings.reset.description" />

      {/* What a reset does is the whole decision, so it is stated before the
          way in rather than on the confirmation screen alone. The list is
          `ProfileResetter::PROFILE_RESETS` from `profile_resetter.h`, minus
          SHORTCUTS: that step is compiled as a no-op outside Windows. */}
      <SectionCard
        title={t('settings.reset.changes.title')}
        description={t('settings.reset.changes.body')}
      />
      <SectionCard
        title={t('settings.reset.keeps.title')}
        description={t('settings.reset.keeps.body')}
      />

      <RowGroup>
        <LinkRow
          label="settings.reset.link"
          sublabel="settings.reset.link.sublabel"
          to="/resetProfileSettings"
        />
      </RowGroup>

      <RowGroup>
        <ActionRow
          label="settings.reset.tampered"
          sublabel="settings.reset.tampered.sublabel"
          actionLabel={
            check.state === 'checking'
              ? 'settings.reset.tampered.checking'
              : 'settings.reset.tampered.action'
          }
          disabled={check.state === 'checking'}
          onPress={run}
        />
        {/* One row for the answer rather than one per outcome. `InfoRow` fills
            an absent value with "not reported yet", so a row that carried the
            answer in its LABEL would contradict itself on the right-hand
            side. */}
        {check.state === 'failed' ? (
          <InfoRow
            label="settings.reset.tampered.result"
            value={t('settings.reset.tampered.failed')}
            sublabel="settings.reset.tampered.failed.sublabel"
          />
        ) : undefined}
        {check.state === 'answered' ? (
          <InfoRow
            label="settings.reset.tampered.result"
            value={
              check.labels.length === 0
                ? t('settings.reset.tampered.none')
                : check.labels.join(', ')
            }
            sublabel={
              check.labels.length === 0 ? 'settings.reset.tampered.none.sublabel' : undefined
            }
          />
        ) : undefined}
      </RowGroup>
    </>
  );
}
