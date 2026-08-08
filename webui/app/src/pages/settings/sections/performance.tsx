// Performance -- Chromium's own memory, battery and tab-discarding controls.
//
// Every pref here is one of the entries in
// `chrome/browser/extensions/api/settings_private/prefs_util.cc` (the
// "Performance settings." block, and `net.network_prediction_options` in the
// preloading subpage), so these rows keep working when the dev fixtures are
// replaced by the browser. Note that most of them are LOCAL STATE rather than
// profile prefs -- `performance_manager::user_tuning::prefs::
// RegisterLocalStatePrefs` registers the memory, battery, ring and intervention
// prefs, and only the two tab-discard exception lists are per profile. That
// makes no difference here: `PrefsUtil::FindServiceForPref` tries the profile
// first and falls back to local state, so settingsPrivate serves both the same
// way. It matters only to whoever writes them from C++.
//
// The numeric enums are `MemorySaverModeState`, `MemorySaverModeAggressiveness`
// and `BatterySaverModeState` from
// `components/performance_manager/public/user_tuning/prefs.h`. The numbers are
// stored values, so they are permanent; a control that offered a value outside
// them would be refused by settingsPrivate without a word.
//
// PerformanceHandler is installed unconditionally (`settings_ui.cc`), and
// registers `getDeviceHasBattery`, `getCurrentOpenSites`,
// `validateTabDiscardExceptionRule` and `openPerformanceFeedbackDialog`. None
// of the four is called here: the first only decides whether to HIDE the
// battery card, the next two serve an exception-list editor this page does not
// have, and the last opens Chrome's feedback dialog, which is a Google service.

import {t, usePref} from '@astro/platform';

import {InfoRow} from '../components/info-row.tsx';
import {LinkRow} from '../components/link-row.tsx';
import {RadioGroup, type RadioOption} from '../components/radio-group.tsx';
import {RowGroup} from '../components/row-group.tsx';
import {SectionHeader} from '../components/section-header.tsx';
import {SelectRow, type SelectOption} from '../components/select-row.tsx';
import {ToggleRow} from '../components/toggle-row.tsx';

/**
 * `MemorySaverModeState`. 1 (`kDeprecated`) is deliberately absent: it was only
 * ever reachable behind an experiment that never launched, and offering it
 * would let a user store a value nothing in the browser reads.
 */
const MEMORY_SAVER_STATES: readonly SelectOption[] = [
  {value: 0, label: 'settings.performance.memorySaver.off'},
  {value: 2, label: 'settings.performance.memorySaver.on'},
];

/** `MemorySaverModeAggressiveness`. */
const AGGRESSIVENESS: readonly RadioOption[] = [
  {
    value: 0,
    label: 'settings.performance.aggressiveness.conservative',
    description: 'settings.performance.aggressiveness.conservative.description',
  },
  {
    value: 1,
    label: 'settings.performance.aggressiveness.medium',
    description: 'settings.performance.aggressiveness.medium.description',
  },
  {
    value: 2,
    label: 'settings.performance.aggressiveness.aggressive',
    description: 'settings.performance.aggressiveness.aggressive.description',
  },
];

/**
 * `BatterySaverModeState`, minus 3.
 *
 * 3 (`kEnabled`, always on) is a real stored value that upstream's own settings
 * never offers either -- battery saver with no battery condition is a state the
 * page has no sentence for. A profile already holding it renders as no
 * selection, which is the honest outcome rather than a silent rewrite.
 */
const BATTERY_SAVER_STATES: readonly RadioOption[] = [
  {value: 0, label: 'settings.performance.batterySaver.off'},
  {
    value: 1,
    label: 'settings.performance.batterySaver.low',
    description: 'settings.performance.batterySaver.low.description',
  },
  {
    value: 2,
    label: 'settings.performance.batterySaver.unplugged',
    description: 'settings.performance.batterySaver.unplugged.description',
  },
];

export function PerformanceSection() {
  // A dictionary keyed by site rule, valued by the Windows-epoch timestamp the
  // rule was added. Only the size is rendered: the row reports how many sites
  // are exempt without claiming the page can change the set.
  const exceptions = usePref('performance_tuning.tab_discarding.exceptions_with_time');
  const exceptionValue = exceptions?.value;
  const exceptionCount =
    typeof exceptionValue === 'object' && exceptionValue !== null
      ? Object.keys(exceptionValue).length
      : undefined;

  return (
    <>
      <SectionHeader title="settings.performance.title" />

      <RowGroup title="settings.performance.group.memory">
        <SelectRow
          prefKey="performance_tuning.high_efficiency_mode.state"
          label="settings.performance.memorySaver"
          sublabel="settings.performance.memorySaver.sublabel"
          options={MEMORY_SAVER_STATES}
        />
      </RowGroup>

      {/* Upstream folds this away unless Memory Saver is on. Astro leaves it
          out in the open: the choice is stored whatever the state pref says, and
          a control that vanishes is a control a user cannot find again. */}
      <RowGroup>
        <RadioGroup
          prefKey="performance_tuning.high_efficiency_mode.aggressiveness"
          label="settings.performance.aggressiveness"
          options={AGGRESSIVENESS}
        />
      </RowGroup>

      <RowGroup footer="settings.performance.exceptions.footer">
        <InfoRow
          label="settings.performance.exceptions"
          sublabel="settings.performance.exceptions.sublabel"
          value={
            exceptionCount === undefined
              ? undefined
              : t('settings.performance.exceptions.count', {count: String(exceptionCount)})
          }
        />
      </RowGroup>

      <RowGroup title="settings.performance.group.battery" footer="settings.performance.battery.footer">
        <RadioGroup
          prefKey="performance_tuning.battery_saver_mode.state"
          label="settings.performance.batterySaver"
          options={BATTERY_SAVER_STATES}
        />
      </RowGroup>

      <RowGroup title="settings.performance.group.tabs">
        <ToggleRow
          prefKey="performance_tuning.discard_ring_treatment.enabled"
          label="settings.performance.discardRing"
          sublabel="settings.performance.discardRing.sublabel"
        />
        <ToggleRow
          prefKey="performance_tuning.intervention_notification.enabled"
          label="settings.performance.intervention"
        />
        <LinkRow
          label="settings.performance.preloading.link"
          sublabel="settings.performance.preloading.link.sublabel"
          to="/preloading"
        />
      </RowGroup>
    </>
  );
}
