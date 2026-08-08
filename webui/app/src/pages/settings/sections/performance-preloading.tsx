// Preload pages.
//
// One pref: `net.network_prediction_options`, an allowlisted profile pref whose
// values are `NetworkPredictionOptions` from
// `chrome/browser/preloading/preloading_prefs.h` -- 0 standard, 2 disabled,
// 3 extended. Value 1 (`kWifiOnlyDeprecated`) is not offered: upstream's own
// page rewrites it to 0 on load, and Astro does not rewrite a stored preference
// behind the user's back, so a profile holding it renders as no selection.
//
// Offered in upstream's own order (off, standard, extended) rather than in
// numeric order, because the three are a scale and reading them as one is the
// point of a radio column.

import {RadioGroup, type RadioOption} from '../components/radio-group.tsx';
import {RowGroup} from '../components/row-group.tsx';
import {SubpageHeader} from '../components/section-header.tsx';

const PRELOADING: readonly RadioOption[] = [
  {
    value: 2,
    label: 'settings.performance.preloading.off',
    description: 'settings.performance.preloading.off.description',
  },
  {
    value: 0,
    label: 'settings.performance.preloading.standard',
    description: 'settings.performance.preloading.standard.description',
  },
  {
    value: 3,
    label: 'settings.performance.preloading.extended',
    description: 'settings.performance.preloading.extended.description',
  },
];

export function PerformancePreloadingScreen() {
  return (
    <>
      <SubpageHeader
        title="settings.performance.preloading.title"
        backTo="/performance"
        backLabel="settings.nav.performance"
      />
      <RowGroup footer="settings.performance.preloading.footer">
        <RadioGroup
          prefKey="net.network_prediction_options"
          label="settings.performance.preloading.choice"
          options={PRELOADING}
        />
      </RowGroup>
    </>
  );
}
