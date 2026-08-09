// Astro's New Tab Page.
//
// An entry of the single Astro WebUI app, chosen by host in main.tsx, drawn
// with Bloom against the same tokens as astro://settings and the browser's own
// toolbar. There is no page-local palette, no page-local storage and no
// untyped message: what it shows comes over astro_ntp.mojom, and what colour
// it shows it in comes over astro_theme.mojom, which the app's root
// BloomThemeProvider is driven by.
//
// The arrangement is the one it replaces: a rail of browser actions on the
// left, the ad blocker's count centred at the top, and a centred column with
// the search field above a grid of square cards. What changed is what is
// BEHIND each of them.
//
// The grid is flex-wrap with fractional widths rather than CSS grid.
// react-native-web's View reset sets `display: flex` from an unlayered
// stylesheet, and while Tailwind's own utilities are deliberately unlayered
// too (see platform/global.css) and would win on document order, a layout that
// depends on which of two unlayered sheets was inserted first is a layout one
// upstream change quietly breaks. Flex wrapping needs no such argument.

import {
  ColorPalette_Stroke2_Corner0_Rounded,
  SettingsGear2_Stroke2_Corner0_Rounded,
  SettingsSliderVertical_Stroke2_Corner0_Rounded,
  Shield_Stroke2_Corner0_Rounded,
  Sparkle_Stroke2_Corner0_Rounded,
} from '@oxyhq/bloom/icons';
import {useThemeColor} from '@oxyhq/bloom/theme';
import {Text} from '@oxyhq/bloom/typography';
import {useState, type ReactNode} from 'react';
import {Pressable, ScrollView, View} from 'react-native';

import {hrefFor, t, type MessageId, type NavIcon} from '@astro/platform';

import {CustomizePanel} from './customize-panel.tsx';
import {openCustomizeChrome, useNtp, type WidgetId} from './ntp-store.ts';
import {SearchBox} from './search-box.tsx';
import {
  AliaWidget,
  ClockWidget,
  DiscoverWidget,
  NotesWidget,
  QuickLinksWidget,
  SitesWidgets,
  WeatherWidget,
} from './widgets.tsx';

/** One row of the rail: an action the browser performs, not a page control. */
function RailRow({
  icon: Icon,
  label,
  href,
  onPress,
}: {
  icon: NavIcon;
  label: MessageId;
  href?: string;
  onPress?: () => void;
}) {
  const iconColor = useThemeColor('textSecondary');
  const content = (
    <>
      <Icon size="sm" fill={iconColor} />
      <Text className="text-bodySmall text-foreground">{t(label)}</Text>
    </>
  );
  // A link is an ANCHOR and a command is a BUTTON, and the difference is not
  // cosmetic: middle-click, ctrl-click and "open in new tab" all come from the
  // element, and a rail row that opened a side panel would have no business
  // offering them.
  return href === undefined ? (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className="flex-row items-center gap-3 rounded-radius-12 px-3 py-2 hover:bg-fill-hover"
    >
      {content}
    </Pressable>
  ) : (
    <View
      href={href}
      accessibilityRole="link"
      className="flex-row items-center gap-3 rounded-radius-12 px-3 py-2 hover:bg-fill-hover"
    >
      {content}
    </View>
  );
}

/** The ad blocker's lifetime count, live. */
function BlockedBadge() {
  const {blockedCount} = useNtp();
  const iconColor = useThemeColor('primary');
  return (
    <View className="flex-row items-center gap-2 rounded-radius-max border border-border bg-card px-3 py-1.5">
      <Shield_Stroke2_Corner0_Rounded size="sm" fill={iconColor} />
      <Text className="text-bodySmall text-primary">
        {t('newtab.blocked', {count: blockedCount.toLocaleString()})}
      </Text>
    </View>
  );
}

/** One grid cell. The widgets do not know how wide they are. */
function Cell({children}: {children: ReactNode}) {
  return <View className="w-1/2 p-1.5 md:w-1/3 lg:w-1/4">{children}</View>;
}

export function NewTabPage() {
  const {widgets} = useNtp();
  const [customizing, setCustomizing] = useState(false);
  const railIconColor = useThemeColor('textSecondary');

  function widgetFor(id: WidgetId): ReactNode {
    switch (id) {
      case 'weather':
        return <Cell key={id}><WeatherWidget /></Cell>;
      case 'clock':
        return <Cell key={id}><ClockWidget /></Cell>;
      case 'quickLinks':
        return (
          <Cell key={id}>
            <QuickLinksWidget onEdit={() => setCustomizing(true)} />
          </Cell>
        );
      case 'notes':
        return <Cell key={id}><NotesWidget /></Cell>;
      case 'discover':
        return <Cell key={id}><DiscoverWidget /></Cell>;
      case 'alia':
        return <Cell key={id}><AliaWidget /></Cell>;
      case 'sites':
        // A group, not a card: it draws one cell per tile the browser sent, at
        // whatever position the arrangement puts it.
        return <SitesWidgets key={id} />;
    }
  }

  return (
    <View className="flex-1 flex-row bg-background">
      {/* The rail is the page's only chrome and the first thing to go when
          there is no room for it. Its four rows are all reachable from the
          browser's own menus, so a narrow window loses nothing but a
          shortcut — except Customize, which the links card also opens. */}
      <View className="w-56 shrink-0 justify-end gap-1 border-r border-border bg-card p-3 max-rail:hidden">
        <RailRow
          icon={SettingsSliderVertical_Stroke2_Corner0_Rounded}
          label="newtab.nav.customize"
          onPress={() => setCustomizing(true)}
        />
        <RailRow
          icon={ColorPalette_Stroke2_Corner0_Rounded}
          label="newtab.nav.appearance"
          onPress={openCustomizeChrome}
        />
        <RailRow
          icon={Sparkle_Stroke2_Corner0_Rounded}
          label="newtab.nav.whatsNew"
          href={hrefFor('whatsNew')}
        />
        <RailRow
          icon={SettingsGear2_Stroke2_Corner0_Rounded}
          label="newtab.nav.settings"
          href={hrefFor('settings')}
        />
      </View>

      <View className="min-w-0 flex-1">
        <View className="h-14 shrink-0 flex-row items-center justify-center px-3">
          <BlockedBadge />
          {/* Below the rail breakpoint the rail is gone, so Customize needs a
              way back. Same control, same panel. */}
          <View className="absolute right-3 rail:hidden">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('newtab.nav.customize')}
              onPress={() => setCustomizing(true)}
              className="rounded-radius-max p-2 hover:bg-fill-hover"
            >
              <SettingsSliderVertical_Stroke2_Corner0_Rounded
                size="md"
                fill={railIconColor}
              />
            </Pressable>
          </View>
        </View>

        <ScrollView className="flex-1" contentContainerClassName="items-center px-4 pb-16">
          <View className="w-full max-w-3xl gap-4 pt-6">
            <SearchBox />
            <View className="w-full flex-row flex-wrap -m-1.5">
              {widgets
                .filter(widget => widget.visible)
                .map(widget => widgetFor(widget.id))}
            </View>
          </View>
        </ScrollView>
      </View>

      {customizing ? <CustomizePanel onClose={() => setCustomizing(false)} /> : undefined}
    </View>
  );
}
