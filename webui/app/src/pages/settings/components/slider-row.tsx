// One numeric pref, as a labelled slider.
//
// Rare on purpose: upstream uses a slider for exactly the settings where the
// value is a continuum a user judges by eye — page zoom, font size — and a
// dropdown everywhere else. Reach for `SelectRow` unless the value really is
// one of those.
//
// The write is deferred to `onSlidingComplete`, not sent on every frame of the
// drag. `settingsPrivate.setPref` is an IPC round trip that lands in the
// profile's `PrefService` and notifies every observer in the browser; a write
// per pixel would push hundreds of them through the browser process, and the
// echo of an early one arriving mid-drag would fight the thumb. The label
// tracks the live position so the drag still reads as immediate.

import {SettingsListItem, Slider} from '@oxyhq/bloom';
import {Text} from '@oxyhq/bloom/typography';
import {useState} from 'react';
import {View} from 'react-native';

import {setPref, t, type MessageId} from '@astro/platform';

import {ControlAnchor} from './control-anchor.tsx';
import {usePrefControl} from './policy.ts';

export interface SliderRowProps {
  prefKey: string;
  label: MessageId;
  sublabel?: MessageId;
  min: number;
  max: number;
  step?: number;
  /** Renders the value in the unit the user thinks in ("14 px", "125%"). */
  format: (value: number) => string;
}

export function SliderRow({
  prefKey,
  label,
  sublabel,
  min,
  max,
  step = 1,
  format,
}: SliderRowProps) {
  const {pref, enforced, note} = usePrefControl(prefKey, value =>
    typeof value === 'number' ? format(value) : String(value ?? ''),
  );
  // The position under the thumb DURING a drag. Undefined at rest, so the row
  // renders the browser's value and not a stale copy of it.
  const [dragging, setDragging] = useState<number | undefined>(undefined);

  if (!pref) {
    return (
      <ControlAnchor id={label}>
        <SettingsListItem title={t(label)} description={note} disabled showChevron={false} />
      </ControlAnchor>
    );
  }

  const stored = typeof pref.value === 'number' ? pref.value : min;
  const shown = dragging ?? stored;

  return (
    <ControlAnchor id={label}>
      <View className="gap-2 rounded-2xl bg-card p-4">
        <View className="flex-row items-center justify-between gap-4">
          <Text className="text-bodyTitleSmall text-foreground">{t(label)}</Text>
          <Text className="text-body text-text-secondary">{format(shown)}</Text>
        </View>
        {note ?? sublabel ? (
          <Text className="text-bodySmall text-text-secondary">
            {note ?? (sublabel ? t(sublabel) : '')}
          </Text>
        ) : undefined}
        <Slider
          accessibilityLabel={t(label)}
          value={shown}
          min={min}
          max={max}
          step={step}
          disabled={enforced}
          onValueChange={setDragging}
          onSlidingComplete={next => {
            setDragging(undefined);
            setPref(prefKey, next);
          }}
        />
      </View>
    </ControlAnchor>
  );
}
