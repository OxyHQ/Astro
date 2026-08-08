// The shell every astro:// page is drawn in.
//
// One app serves all of them -- settings, history, downloads, the panels --
// so this is where the browser's internal pages get their shape, once. A page
// supplies its title, its sections, its search box's contents and its content;
// the arrangement is not a page's business, which is the whole reason these
// pages are one app rather than five.
//
// The arrangement is the one a Chromium user already knows: a title bar with a
// search field, a navigation rail down the left, and a single centred column
// of content with a maximum width. Bloom supplies the surfaces and the tokens.
//
// The shell RENDERS the search field but does not FILTER with it. Filtering
// needs to know what the controls inside a section are called, and only the
// page knows that -- so the shell reports what was typed and the page hands
// back whichever groups and content it wants shown. A shell that filtered by
// nav title alone would silently fail to find any actual setting.

// Type-only: the shell describes what an icon must accept, it does not import
// one. A value import here would put Bloom's whole icon barrel in the shared
// bundle to satisfy a `keyof typeof`.
import type {sizes} from '@oxyhq/bloom/icons';
import {Search} from '@oxyhq/bloom/search';
import {useThemeColor} from '@oxyhq/bloom/theme';
import {Text} from '@oxyhq/bloom/typography';
import type {ComponentType, ReactNode} from 'react';
import {Pressable, ScrollView, View} from 'react-native';

/**
 * A Bloom icon, as the rail uses one.
 *
 * `size` is keyed off Bloom's own scale rather than restated, so a rename in
 * Bloom is a type error here instead of a rail of default-sized icons.
 */
export type NavIcon = ComponentType<{size?: keyof typeof sizes; fill?: string}>;

export interface NavEntry<Id extends string> {
  readonly id: Id;
  readonly title: string;
  readonly icon: NavIcon;
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
  /** The search field is the shell's; what it means is the page's. */
  searchLabel: string;
  searchValue: string;
  onSearchChange: (value: string) => void;
  /** Shown when the rail has been filtered down to nothing. */
  emptyNavLabel: string;
  children: ReactNode;
}

/**
 * One rail row.
 *
 * Not a `SettingsListItem`: below the narrow breakpoint the rail keeps its
 * icons and drops its labels, and a component that owns its own title text
 * cannot be asked to render without one.
 */
function RailRow({
  entry,
  selected,
  onPress,
}: {
  entry: NavEntry<string>;
  selected: boolean;
  onPress: () => void;
}) {
  // Icons take a colour, not a class: on web react-native-css hands the
  // component `{$$css: true, className}` rather than resolved styles, so the
  // `style.color` an icon reads as its fallback fill is never there.
  const iconColor = useThemeColor(selected ? 'primary' : 'textSecondary');
  const Icon = entry.icon;
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{selected}}
      accessibilityLabel={entry.title}
      onPress={onPress}
      className={
        selected
          ? 'flex-row items-center gap-3 rounded-radius-max bg-primary-subtle px-3 py-2.5'
          : 'flex-row items-center gap-3 rounded-radius-max px-3 py-2.5 hover:bg-fill-hover'
      }
    >
      <View className="w-5 shrink-0 items-center">
        <Icon size="md" fill={iconColor} />
      </View>
      {/* The selected row is marked by the pill and the weight, NOT by
          colouring the label. Bloom's `primary` on its own `primary-subtle`
          measures 2.72:1 in the dark scheme (4.84:1 in light) for the oxy
          preset -- below the 4.5:1 WCAG AA floor for body text, so the one row
          the user is looking at would be the hardest one to read. `foreground`
          on the same fill is 10.72:1 dark and 13.55:1 light. The icon keeps the
          accent, which is where the colour cue can afford to live. */}
      <Text
        numberOfLines={1}
        className={
          // Both states keep text-body's 15px/22px metrics: bodyTitleSmall is
          // 13px/18px, so swapping tokens on selection visibly shrinks the
          // label and changes the row height -- it reads as a broken scale
          // animation. Only the weight moves.
          selected
            ? 'text-body font-semibold text-foreground max-rail:hidden'
            : 'text-body text-foreground max-rail:hidden'
        }
      >
        {entry.title}
      </Text>
    </Pressable>
  );
}

export function PageShell<Id extends string>({
  title,
  groups,
  selected,
  onSelect,
  searchLabel,
  searchValue,
  onSearchChange,
  emptyNavLabel,
  children,
}: PageShellProps<Id>) {
  return (
    <View className="flex-1 bg-background">
      {/* The title sits over the rail and is exactly as wide as it, so the two
          share an edge the eye can follow -- upstream settings does the same.
          It collapses with the rail. */}
      <View className="h-16 shrink-0 flex-row items-center gap-4 border-b border-border px-4">
        <Text className="text-headerBold text-foreground w-56 shrink-0 max-rail:w-auto">
          {title}
        </Text>
        <View className="max-w-xl flex-1">
          <Search
            label={searchLabel}
            value={searchValue}
            onChangeText={onSearchChange}
            onClearText={() => onSearchChange('')}
          />
        </View>
      </View>

      {/* min-h-0 so the row may be SHORTER than its content and the two
          scrollers inside it actually scroll. Without it a flex child's
          automatic minimum size is its content, the row grows past the
          viewport, and the page scrolls as one instead. */}
      <View className="min-h-0 flex-1 flex-row">
        {/* `flex-none`, not `shrink-0`: react-native-web's ScrollView base sets
            `flex-grow: 1`, so a width alone becomes a BASIS the rail then grows
            past. Measured at 768px against a declared 256 -- the rail's own
            width plus half the row's free space, which looks like the width was
            ignored rather than outgrown. */}
        <ScrollView
          className="w-64 flex-none max-rail:w-16"
          contentContainerClassName="gap-1 p-3"
        >
          {groups.map((group, index) => (
            <View key={group.title ?? `group-${index}`} className="gap-1">
              {group.title ? (
                <Text className="text-caption text-text-tertiary px-3 pt-3 pb-1 uppercase max-rail:hidden">
                  {group.title}
                </Text>
              ) : undefined}
              {group.entries.map(entry => (
                <RailRow
                  key={entry.id}
                  entry={entry}
                  selected={entry.id === selected}
                  onPress={() => onSelect(entry.id)}
                />
              ))}
            </View>
          ))}
          {groups.length === 0 ? (
            <Text className="text-bodySmall text-text-tertiary px-3 py-2 max-rail:hidden">
              {emptyNavLabel}
            </Text>
          ) : undefined}
        </ScrollView>

        <ScrollView className="flex-1" contentContainerClassName="items-center px-6 py-6">
          <View className="w-full max-w-3xl gap-6">{children}</View>
        </ScrollView>
      </View>
    </View>
  );
}
