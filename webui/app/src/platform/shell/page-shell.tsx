// The shell every astro:// page is drawn in.
//
// One app serves all of them -- settings, history, downloads, the panels --
// so this is where the browser's internal pages get their shape, once. A page
// supplies its title, its sections and its content; the arrangement is not a
// page's business, which is the whole reason these pages are one app rather
// than five.
//
// The arrangement is Oxy's: a plain navigation rail on the page background
// with no frame of its own, and the content in a single framed Bloom
// ContentPanel that meets the rail.

import {SettingsListGroup, SettingsListItem} from '@oxyhq/bloom';
import {ContentPanel} from '@oxyhq/bloom/content-panel';
import {Text} from '@oxyhq/bloom/typography';
import type {ReactNode} from 'react';
import {ScrollView, View} from 'react-native';

export interface NavEntry<Id extends string> {
  readonly id: Id;
  readonly title: string;
}

export interface NavGroup<Id extends string> {
  /** Optional heading above the group. */
  readonly title?: string;
  readonly entries: readonly NavEntry<Id>[];
}

/**
 * Generic over the page's own section ids, so a rail entry the page has no
 * section for is a type error rather than a row that selects nothing.
 */
export interface PageShellProps<Id extends string> {
  title: string;
  groups: readonly NavGroup<Id>[];
  selected: Id;
  onSelect: (id: Id) => void;
  children: ReactNode;
}

export function PageShell<Id extends string>({
  title,
  groups,
  selected,
  onSelect,
  children,
}: PageShellProps<Id>) {
  return (
    <View className="flex-1 flex-row bg-background">
      <View className="w-64 shrink-0">
        <ScrollView className="flex-1" contentContainerClassName="p-2 gap-2">
          <Text className="text-sectionTitle text-foreground px-2 py-2">{title}</Text>
          {groups.map((group, index) => (
            <SettingsListGroup key={group.title ?? index} title={group.title}>
              {group.entries.map(entry => (
                <SettingsListItem
                  key={entry.id}
                  title={entry.title}
                  onPress={() => onSelect(entry.id)}
                  showChevron={false}
                  accessibilityRole="button"
                  rightElement={
                    entry.id === selected ? (
                      <View className="size-2 rounded-radius-max bg-primary" />
                    ) : undefined
                  }
                />
              ))}
            </SettingsListGroup>
          ))}
        </ScrollView>
      </View>

      {/* Padded on every side except the one facing the rail, so the panel
          meets it rather than floating away from it. */}
      <View className="flex-1 min-w-0 p-2 pl-0">
        <ContentPanel framed>
          <ScrollView className="flex-1" contentContainerClassName="p-4 gap-6">
            {children}
          </ScrollView>
        </ContentPanel>
      </View>
    </View>
  );
}
