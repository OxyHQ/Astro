// One card in a section's column.
//
// A settings page is a stack of cards, and there are two kinds: a list of
// rows, which Bloom's `SettingsListGroup` already draws as a card, and
// everything that is not a list -- a colour grid, a segmented control, an
// explanation. This is the second kind, matched to the first so a column that
// mixes them reads as one surface family rather than two.
//
// `rounded-2xl` rather than a Bloom radius token because the radius being
// matched is `SettingsListGroup`'s own literal 16, and Tailwind's `2xl` is
// exactly 16px. Bloom's radius scale steps 12 -> 20 straight past it, so a
// token here would be visibly the odd card out.

import {Text} from '@oxyhq/bloom/typography';
import type {ReactNode} from 'react';
import {View} from 'react-native';

export interface SectionCardProps {
  /** Optional heading, in the same weight `SettingsListGroup` gives its own. */
  title?: string;
  description?: string;
  children?: ReactNode;
}

export function SectionCard({title, description, children}: SectionCardProps) {
  return (
    <View className="gap-3 rounded-2xl bg-card p-4">
      {title ? <Text className="text-bodyTitleSmall text-foreground">{title}</Text> : undefined}
      {description ? (
        <Text className="text-bodySmall text-text-secondary">{description}</Text>
      ) : undefined}
      {children}
    </View>
  );
}
