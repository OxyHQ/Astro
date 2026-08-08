// One pref with a fixed set of values, as a row with a dropdown.
//
// Upstream spells most of these as an integer enum in `pref_names.h` (a cookie
// policy, a download behaviour, a startup mode), so an option carries the value
// the browser stores and the message id the user reads, and this row is the
// only place the two are joined. A control that stored its own label, or that
// wrote a string where the pref holds a number, is refused by the API without
// a word — `settingsPrivate.setPref` resolves false on a type mismatch.
//
// A policy that NARROWS the choices rather than fixing one reports the
// survivors in `userSelectableValues`; the offered list is filtered by it, so
// the dropdown cannot present an option the browser will refuse.

import {
  Select,
  SelectContent,
  SelectIcon,
  SelectItem,
  SelectItemIndicator,
  SelectItemText,
  SelectTrigger,
  SelectValue,
  SettingsListItem,
} from '@oxyhq/bloom';
import {View} from 'react-native';

import {setPref, t, type MessageId} from '@astro/platform';

import {usePrefControl} from './policy.ts';

export interface SelectOption {
  /** The value as the browser stores it. */
  readonly value: string | number;
  readonly label: MessageId;
}

export interface SelectRowProps {
  prefKey: string;
  label: MessageId;
  sublabel?: MessageId;
  options: readonly SelectOption[];
}

/** Bloom's Select keys items by string; the pref's own type is restored on write. */
interface Item {
  readonly value: string;
  readonly label: string;
}

export function SelectRow({prefKey, label, sublabel, options}: SelectRowProps) {
  /**
   * The label for a value, wherever the value came from.
   *
   * Compared as strings rather than by identity because the same function is
   * asked about the value in two shapes: the pref's own (a number, for the
   * integer enums most of these are) when a policy note reports a recommended
   * value, and the string Bloom's Select keys its items by when the trigger
   * asks what is selected. An identity comparison answers the first and misses
   * the second.
   */
  const describe = (value: unknown): string => {
    const match = options.find(option => String(option.value) === String(value));
    return match ? t(match.label) : String(value ?? '');
  };
  const {pref, enforced, note} = usePrefControl(prefKey, describe);

  if (!pref) {
    return <SettingsListItem title={t(label)} description={note} disabled showChevron={false} />;
  }

  const allowed = pref.userSelectableValues;
  const items: Item[] = options
    .filter(option => allowed === undefined || allowed.includes(option.value))
    .map(option => ({value: String(option.value), label: t(option.label)}));

  const write = (next: string): void => {
    const option = options.find(candidate => String(candidate.value) === next);
    if (option) {
      setPref(prefKey, option.value);
    }
  };

  return (
    <SettingsListItem
      title={t(label)}
      description={note ?? (sublabel ? t(sublabel) : undefined)}
      disabled={enforced}
      showChevron={false}
      rightElement={
        <View className="min-w-40">
          <Select value={String(pref.value)} onValueChange={write} disabled={enforced}>
            <SelectTrigger label={t(label)}>
              {/* The extractor is not optional here, whatever the placeholder
                  says. Bloom's web fork renders `value ?? placeholder`, so a
                  trigger without one shows the STORED value -- `16` where the
                  option reads "Medium", `2` where it reads "Battery Saver" --
                  and only falls back to the placeholder when nothing is
                  selected at all. Its native fork extracts a label either way,
                  so the defect appears on web only. */}
              <SelectValue placeholder={describe(pref.value)}>{describe}</SelectValue>
              <SelectIcon />
            </SelectTrigger>
            <SelectContent
              label={t(label)}
              items={items}
              renderItem={(item: Item) => (
                <SelectItem value={item.value} label={item.label}>
                  <SelectItemIndicator />
                  <SelectItemText>{item.label}</SelectItemText>
                </SelectItem>
              )}
            />
          </Select>
        </View>
      }
    />
  );
}
