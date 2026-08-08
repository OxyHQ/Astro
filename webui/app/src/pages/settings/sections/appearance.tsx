// Appearance -- the section that proves the theming is live.
//
// Both controls write through the theme transport and NOTHING here applies a
// local change: the browser stores the choice, re-themes its own toolbar and
// menus, and echoes back to every open Astro page, which re-renders its
// BloomThemeProvider with the new props. One write, one source, every surface.

import {
  SegmentedControl,
  SegmentedControlItem,
  SegmentedControlItemText,
} from '@oxyhq/bloom';
import {APP_COLOR_PRESETS, FREE_COLOR_NAMES, type AppColorName} from '@oxyhq/bloom/color-presets';
import {Text} from '@oxyhq/bloom/typography';
import {Pressable, View} from 'react-native';

import {setMode, setPreset, t, useThemeState, type MessageId, type ThemeMode} from '@astro/platform';

const MODES: readonly {readonly id: ThemeMode; readonly label: MessageId}[] = [
  {id: 'system', label: 'settings.appearance.mode.system'},
  {id: 'light', label: 'settings.appearance.mode.light'},
  {id: 'dark', label: 'settings.appearance.mode.dark'},
];

/**
 * The colours offered.
 *
 * Bloom gates two of its presets to the accounts whose brand they are. `oxy`
 * is one of them, and this browser is Oxy's -- so it is offered here and the
 * other reserved brand is not, which is exactly what the gate is for.
 */
const PRESETS: readonly AppColorName[] = ['oxy', ...FREE_COLOR_NAMES];

function Swatch({name, selected}: {name: AppColorName; selected: boolean}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{selected}}
      accessibilityLabel={name}
      onPress={() => setPreset(name)}
      className={
        selected
          ? 'size-8 rounded-radius-max border-2 border-foreground'
          : 'size-8 rounded-radius-max border border-border'
      }
      // The seed colour of a preset is data, not a token: there is no utility
      // class for "this brand's hex", and inventing one per preset would put
      // the palette in two places.
      style={{backgroundColor: APP_COLOR_PRESETS[name].hex}}
    />
  );
}

export function AppearanceSection() {
  const {mode, preset} = useThemeState();

  return (
    <View className="gap-6">
      <Text className="text-sectionTitle text-foreground">
        {t('settings.appearance.title')}
      </Text>

      <View className="gap-2">
        <Text className="text-bodyTitleSmall text-text-secondary">
          {t('settings.appearance.mode')}
        </Text>
        <SegmentedControl
          label={t('settings.appearance.mode')}
          type="radio"
          value={mode}
          onChange={setMode}
        >
          {MODES.map(entry => (
            <SegmentedControlItem key={entry.id} value={entry.id}>
              <SegmentedControlItemText>{t(entry.label)}</SegmentedControlItemText>
            </SegmentedControlItem>
          ))}
        </SegmentedControl>
      </View>

      <View className="gap-2">
        <Text className="text-bodyTitleSmall text-text-secondary">
          {t('settings.appearance.preset')}
        </Text>
        <Text className="text-bodySmall text-text-tertiary">
          {t('settings.appearance.preset.description')}
        </Text>
        <View className="flex-row flex-wrap gap-3 pt-1">
          {PRESETS.map(name => (
            <Swatch key={name} name={name} selected={name === preset} />
          ))}
        </View>
      </View>
    </View>
  );
}
