// One pref with a fixed set of values, as a column of radio rows.
//
// The same contract as `SelectRow` and a different shape on purpose: upstream
// uses a radio column wherever each option needs a sentence of its own — the
// three cookie policies, the two safe-browsing levels, the startup choices —
// because a dropdown can show a label and nothing else. Choosing between the
// two is a design decision, not a technical one, so both exist.
//
// The group is a single `radiogroup` with rows inside it rather than a list of
// independent radios: a screen reader announces "2 of 3" only when the rows
// share a group, and keyboard users expect one tab stop for the whole choice.

import {RadioIndicator, SettingsListItem} from '@oxyhq/bloom';
import {View} from 'react-native';

import {setPref, t, type MessageId} from '@astro/platform';

import {usePrefControl} from './policy.ts';
import {SearchableLabel} from './searchable-label.tsx';

export interface RadioOption {
  /** The value as the browser stores it. */
  readonly value: string | number;
  readonly label: MessageId;
  /** The sentence under the label. Upstream gives most of these one. */
  readonly description?: MessageId;
}

export interface RadioGroupProps {
  prefKey: string;
  label: MessageId;
  options: readonly RadioOption[];
}

export function RadioGroup({prefKey, label, options}: RadioGroupProps) {
  const describe = (value: unknown): string => {
    const match = options.find(option => option.value === value);
    return match ? t(match.label) : String(value ?? '');
  };
  const {pref, enforced, note} = usePrefControl(prefKey, describe);
  const allowed = pref?.userSelectableValues;

  return (
    <View className="gap-2">
      <SearchableLabel id={label} note={note} />
      <View accessibilityRole="radiogroup" accessibilityLabel={t(label)}>
        {options
          .filter(option => allowed === undefined || allowed.includes(option.value))
          .map(option => {
            const selected = pref?.value === option.value;
            return (
              <SettingsListItem
                key={String(option.value)}
                title={t(option.label)}
                description={option.description ? t(option.description) : undefined}
                accessibilityRole="none"
                disabled={enforced || !pref}
                showChevron={false}
                onPress={() => setPref(prefKey, option.value)}
                rightElement={<RadioIndicator selected={selected} />}
              />
            );
          })}
      </View>
    </View>
  );
}
