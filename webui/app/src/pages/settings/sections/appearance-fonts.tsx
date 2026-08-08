// Fonts.
//
// The two SIZES are editable here, because a size is a number and a slider is
// a control this page has. The five FAMILIES are reported and not editable,
// because choosing one needs the list of fonts installed on this device, and
// that list only exists behind `FontHandler`'s `fetchFontsData` message
// (chrome/browser/ui/webui/settings/font_handler.cc) -- a runtime list of a few
// hundred strings, which no row in the control vocabulary can present. A row
// that offered a fixed guess at the installed fonts would write a family the
// device does not have and silently fall back.
//
// Every pref below is one of the entries in
// chrome/browser/extensions/api/settings_private/prefs_util.cc, so these
// controls keep working when the dev mock is replaced by the browser. `Zyyy` is
// `prefs::kWebKitCommonScript` -- the per-script suffix Chromium stores font
// families under, and the only script upstream's own fonts page edits.

import {InfoRow} from '../components/info-row.tsx';
import {RowGroup} from '../components/row-group.tsx';
import {SubpageHeader} from '../components/section-header.tsx';
import {SliderRow} from '../components/slider-row.tsx';

import {usePref, type MessageId} from '@astro/platform';

/** Upstream's `FONT_SIZE_RANGE` and `MINIMUM_FONT_SIZE_RANGE`, in pixels. */
const SIZE_MIN = 9;
const SIZE_MAX = 72;
const MINIMUM_SIZE_MAX = 24;

const FAMILIES: readonly {readonly prefKey: string; readonly label: MessageId}[] = [
  {prefKey: 'webkit.webprefs.fonts.standard.Zyyy', label: 'settings.appearance.fonts.standard'},
  {prefKey: 'webkit.webprefs.fonts.serif.Zyyy', label: 'settings.appearance.fonts.serif'},
  {
    prefKey: 'webkit.webprefs.fonts.sansserif.Zyyy',
    label: 'settings.appearance.fonts.sansSerif',
  },
  {prefKey: 'webkit.webprefs.fonts.fixed.Zyyy', label: 'settings.appearance.fonts.fixed'},
  {prefKey: 'webkit.webprefs.fonts.math.Zyyy', label: 'settings.appearance.fonts.math'},
];

/** One family, as the browser currently reports it. */
function FamilyRow({prefKey, label}: {prefKey: string; label: MessageId}) {
  const pref = usePref(prefKey);
  return (
    <InfoRow label={label} value={typeof pref?.value === 'string' ? pref.value : undefined} />
  );
}

const pixels = (value: number): string => `${value} px`;

export function AppearanceFontsScreen() {
  return (
    <>
      <SubpageHeader
        title="settings.appearance.fonts.title"
        backTo="/appearance"
        backLabel="settings.nav.appearance"
      />

      <SliderRow
        prefKey="webkit.webprefs.default_font_size"
        label="settings.appearance.fonts.size"
        min={SIZE_MIN}
        max={SIZE_MAX}
        format={pixels}
      />

      {/* Zero is a real value and means "no minimum", which is why the range
          starts there rather than at the 9 px floor the standard size has. */}
      <SliderRow
        prefKey="webkit.webprefs.minimum_font_size"
        label="settings.appearance.fonts.minimumSize"
        min={0}
        max={MINIMUM_SIZE_MAX}
        format={pixels}
      />

      <RowGroup
        title="settings.appearance.fonts.families"
        footer="settings.appearance.fonts.families.footer"
      >
        {FAMILIES.map(family => (
          <FamilyRow key={family.prefKey} prefKey={family.prefKey} label={family.label} />
        ))}
      </RowGroup>
    </>
  );
}
