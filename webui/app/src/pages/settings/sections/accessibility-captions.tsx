// Captions.
//
// Seven allowlisted preferences, all in the accessibility block of
// `chrome/browser/extensions/api/settings_private/prefs_util.cc` (lines
// 558-571) and none of them platform-guarded. They are renderer preferences:
// `chrome/browser/ui/prefs/pref_watcher.cc` pushes them to every renderer, and
// `components/live_caption/caption_util.cc` turns them into the CSS that styles
// a video's own text tracks. That is why this screen is useful in a browser with
// no live caption -- it styles the captions a page supplies.
//
// The stored VALUES are a wire format, not a scale invented here, and each set
// is copied from `chrome/browser/resources/settings/a11y_page/captions_page.ts`
// exactly:
//
//   * size is a CSS percentage STRING with the sign ("150%"), and the empty
//     string means the default of 100% -- there is no "100%" entry;
//   * a colour is a bare comma-separated RGB triple with no spaces and no
//     `rgb()` wrapper, which caption_util formats into `rgba(<triple>,<alpha>)`;
//   * an opacity is an integer 0-100 that caption_util divides by 100;
//   * a shadow is a raw CSS `text-shadow` value, and those five strings are
//     load-bearing -- ChromeOS's own settings and Android's ARC bridge parse
//     them back into an enum by exact match, so a stray space is a different
//     setting. The double space inside the outlined value is upstream's and is
//     reproduced deliberately.
//
// `accessibility.captions.text_font` is a CSS font-family name, and choosing
// one needs the list of installed typefaces. That list comes from the fonts
// handler, which the appearance section owns; the row reports the stored value
// rather than claiming a menu it cannot fill.
//
// CaptionsHandler is installed on Linux and registers six messages -- all six
// are about live caption's downloadable speech model, so none is called here.
// `openSystemCaptionsDialog` is registered but its body is
// `IS_WIN || IS_MAC`, so on Linux it does nothing at all.

import {t, usePref} from '@astro/platform';

import {InfoRow} from '../components/info-row.tsx';
import {RowGroup} from '../components/row-group.tsx';
import {SubpageHeader} from '../components/section-header.tsx';
import {SelectRow, type SelectOption} from '../components/select-row.tsx';

const SIZES: readonly SelectOption[] = [
  {value: '25%', label: 'settings.accessibility.captions.size.verySmall'},
  {value: '50%', label: 'settings.accessibility.captions.size.small'},
  {value: '', label: 'settings.accessibility.captions.size.medium'},
  {value: '150%', label: 'settings.accessibility.captions.size.large'},
  {value: '200%', label: 'settings.accessibility.captions.size.veryLarge'},
];

const COLOURS: readonly SelectOption[] = [
  {value: '', label: 'settings.accessibility.captions.colour.default'},
  {value: '0,0,0', label: 'settings.accessibility.captions.colour.black'},
  {value: '255,255,255', label: 'settings.accessibility.captions.colour.white'},
  {value: '255,0,0', label: 'settings.accessibility.captions.colour.red'},
  {value: '0,255,0', label: 'settings.accessibility.captions.colour.green'},
  {value: '0,0,255', label: 'settings.accessibility.captions.colour.blue'},
  {value: '255,255,0', label: 'settings.accessibility.captions.colour.yellow'},
  {value: '0,255,255', label: 'settings.accessibility.captions.colour.cyan'},
  {value: '255,0,255', label: 'settings.accessibility.captions.colour.magenta'},
];

/** Text bottoms out at 10 and background at 0; upstream's own two lists. */
const TEXT_OPACITIES: readonly SelectOption[] = [
  {value: 100, label: 'settings.accessibility.captions.opacity.opaque'},
  {value: 50, label: 'settings.accessibility.captions.opacity.semi'},
  {value: 10, label: 'settings.accessibility.captions.opacity.transparent'},
];

const BACKGROUND_OPACITIES: readonly SelectOption[] = [
  {value: 100, label: 'settings.accessibility.captions.opacity.opaque'},
  {value: 50, label: 'settings.accessibility.captions.opacity.semi'},
  {value: 0, label: 'settings.accessibility.captions.opacity.transparent'},
];

const SHADOWS: readonly SelectOption[] = [
  {value: '', label: 'settings.accessibility.captions.shadow.none'},
  {
    value: '-2px -2px 4px rgba(0, 0, 0, 0.5)',
    label: 'settings.accessibility.captions.shadow.raised',
  },
  {
    value: '2px 2px 4px rgba(0, 0, 0, 0.5)',
    label: 'settings.accessibility.captions.shadow.depressed',
  },
  {
    value:
      '-1px 0px 0px black, 0px -1px 0px black, 1px 0px 0px black, 0px  1px 0px black',
    label: 'settings.accessibility.captions.shadow.uniform',
  },
  {
    value: '0px 0px 2px rgba(0, 0, 0, 0.5), 2px 2px 2px black',
    label: 'settings.accessibility.captions.shadow.dropShadow',
  },
];

export function AccessibilityCaptionsScreen() {
  const font = usePref('accessibility.captions.text_font');
  const family = typeof font?.value === 'string' ? font.value : undefined;

  return (
    <>
      <SubpageHeader
        title="settings.accessibility.captions.title"
        description="settings.accessibility.captions.description"
        backTo="/accessibility"
        backLabel="settings.nav.accessibility"
      />

      <RowGroup title="settings.accessibility.captions.group.text">
        <SelectRow
          prefKey="accessibility.captions.text_size"
          label="settings.accessibility.captions.textSize"
          options={SIZES}
        />
        <SelectRow
          prefKey="accessibility.captions.text_color"
          label="settings.accessibility.captions.textColour"
          options={COLOURS}
        />
        <SelectRow
          prefKey="accessibility.captions.text_opacity"
          label="settings.accessibility.captions.textOpacity"
          options={TEXT_OPACITIES}
        />
        <SelectRow
          prefKey="accessibility.captions.text_shadow"
          label="settings.accessibility.captions.textShadow"
          options={SHADOWS}
        />
        <InfoRow
          label="settings.accessibility.captions.textFont"
          sublabel="settings.accessibility.captions.textFont.sublabel"
          // The empty string is the stored DEFAULT, not an absent value, so it
          // is named. Passing it through would leave the right-hand side blank,
          // which reads as a pref the browser failed to report.
          value={
            family === ''
              ? t('settings.accessibility.captions.textFont.default')
              : family
          }
        />
      </RowGroup>

      <RowGroup
        title="settings.accessibility.captions.group.background"
        footer="settings.accessibility.captions.footer"
      >
        <SelectRow
          prefKey="accessibility.captions.background_color"
          label="settings.accessibility.captions.backgroundColour"
          options={COLOURS}
        />
        <SelectRow
          prefKey="accessibility.captions.background_opacity"
          label="settings.accessibility.captions.backgroundOpacity"
          options={BACKGROUND_OPACITIES}
        />
      </RowGroup>
    </>
  );
}
