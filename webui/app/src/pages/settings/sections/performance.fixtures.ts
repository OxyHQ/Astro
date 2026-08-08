// Performance -- the dev browser this section renders from. DEV ONLY.
//
// Reached only from `platform/browser/mock/sections.ts`, which is imported only
// from inside an `import.meta.env.DEV` branch, so nothing here is emitted into a
// bundle the browser ships. See `platform/browser/env.ts`.
//
// Every pref below is one of the entries in
// `chrome/browser/extensions/api/settings_private/prefs_util.cc` -- the
// "Performance settings." block at lines 1238-1262, plus
// `net.network_prediction_options` in the miscellaneous block -- and each was
// checked against that file by name. A pref outside the allowlist is invisible
// to `chrome.settingsPrivate` however correctly it is spelled.
//
// No handler fixtures. PerformanceHandler registers four messages and this
// section calls none of them: `getDeviceHasBattery` only decides whether to hide
// the battery card, `getCurrentOpenSites` and `validateTabDiscardExceptionRule`
// serve an exception-list editor this page does not have, and
// `openPerformanceFeedbackDialog` opens Chrome's feedback dialog.

import type {SectionFixtures} from '@astro/platform';

export const performanceFixtures: SectionFixtures = {
  prefs: [
    // MemorySaverModeState::kEnabled.
    {key: 'performance_tuning.high_efficiency_mode.state', type: 'NUMBER', value: 2},
    // MemorySaverModeAggressiveness::kMedium.
    {key: 'performance_tuning.high_efficiency_mode.aggressiveness', type: 'NUMBER', value: 1},

    // BatterySaverModeState::kEnabledBelowThreshold, ENFORCED so the locked
    // radio column -- disabled rows, and the sentence naming what locked them --
    // is drivable without a managed profile. Every group of sections is asked to
    // carry at least one enforced pref; this is Group C's.
    {
      key: 'performance_tuning.battery_saver_mode.state',
      type: 'NUMBER',
      value: 1,
      controlledBy: 'USER_POLICY',
      controlledByName: 'Astro dev policy',
      enforcement: 'ENFORCED',
    },

    {key: 'performance_tuning.discard_ring_treatment.enabled', type: 'BOOLEAN', value: true},
    {key: 'performance_tuning.intervention_notification.enabled', type: 'BOOLEAN', value: true},

    // Keyed by the exception rule, valued by the Windows-epoch timestamp the
    // rule was added -- the shape `setPrefDictEntry` writes. Only the number of
    // keys is rendered, so the timestamps are plausible rather than exact.
    {
      key: 'performance_tuning.tab_discarding.exceptions_with_time',
      type: 'DICTIONARY',
      value: {
        'mail.example': '13387564800000000',
        'docs.example': '13387651200000000',
        '[*.]music.example': '13387737600000000',
      },
    },

    // NetworkPredictionOptions::kStandard. Chromium registers this pref at
    // kDisabled (2); the fixture sits at 0 so the middle option of the three is
    // the one rendered as chosen.
    {key: 'net.network_prediction_options', type: 'NUMBER', value: 0},
  ],
};
