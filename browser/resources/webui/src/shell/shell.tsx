// The shell every astro:// page is drawn in.
//
// One app serves all of them -- settings, history, downloads, extensions, the
// new tab page -- so this is where the browser's internal pages get their
// shape, once. A page supplies its title, its navigation entries and its
// content; the arrangement is not a page's business.
//
// The arrangement is Alia's: a plain navigation rail on the page background
// with no frame of its own, and the content in a single framed Bloom
// ContentPanel that meets the rail.

import type {ReactNode} from 'react';
import {ScrollView, View} from 'react-native';

import {ContentPanel} from '@oxyhq/bloom/content-panel';
import {SettingsListGroup, SettingsListItem} from '@oxyhq/bloom';
// Bloom does not re-export Text on web; the RN primitive is what its own
// components render, and react-native-web maps it to a DOM node.
import {Text} from 'react-native';

export interface NavEntry {
  id: string;
  title: string;
}

export interface NavGroup {
  /** Optional heading above the group. */
  title?: string;
  entries: NavEntry[];
}

export function Shell({title, groups, selected, onSelect, children}: {
  title: string,
  groups: NavGroup[],
  selected: string,
  onSelect: (id: string) => void,
  children: ReactNode,
}) {
  return (
    <View className="flex-1 flex-row bg-background">
      <View className="w-64 shrink-0">
        <ScrollView className="flex-1" contentContainerClassName="p-2 gap-2">
          <Text className="text-lg font-bold text-foreground px-2 py-2">
            {title}
          </Text>
          {groups.map((group, index) => (
            <SettingsListGroup key={group.title ?? index} title={group.title}>
              {group.entries.map(entry => (
                <SettingsListItem
                  key={entry.id}
                  title={entry.title}
                  onPress={() => onSelect(entry.id)}
                />
              ))}
            </SettingsListGroup>
          ))}
        </ScrollView>
      </View>

      {/* Padded on every side except the one facing the rail, so the panel
          meets it rather than floating away from it. */}
      <View className="flex-1 min-w-0 p-2 pl-0">
        <ContentPanel framed surfaceClassName="bg-background">
          {children}
        </ContentPanel>
      </View>
    </View>
  );
}
