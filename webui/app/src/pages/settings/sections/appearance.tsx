// Appearance -- the section that proves the theming is live, plus the rest of
// what Chromium's own appearance page controls.
//
// Two transports on one screen, and the split is not a style choice. The theme
// mode and the colour preset go through the typed Mojo theme transport because
// neither `browser.theme.color_scheme2` nor `astro.theme.preset` is in
// `chrome.settingsPrivate`'s allowlist (`prefs_util.cc`), so the prefs API
// cannot see them however correctly they are spelled. Everything BELOW the
// theme cards is an allowlisted Chromium pref and goes through settingsPrivate
// like every other row on the page.
//
// Nothing here applies a local change. The browser stores the choice, re-themes
// its own toolbar and menus, and echoes back to every open Astro page.

import {SegmentedControl, SegmentedControlItem, SegmentedControlItemText} from '@oxyhq/bloom';
import {APP_COLOR_PRESETS, FREE_COLOR_NAMES, type AppColorName} from '@oxyhq/bloom/color-presets';
import {Pressable, View} from 'react-native';

import {
  SectionCard,
  send,
  setMode,
  setPreset,
  t,
  usePref,
  useThemeState,
  type MessageId,
  type ThemeMode,
} from '@astro/platform';

import {ActionRow} from '../components/action-row.tsx';
import {ControlAnchor} from '../components/control-anchor.tsx';
import {InfoRow} from '../components/info-row.tsx';
import {LinkRow} from '../components/link-row.tsx';
import {RowGroup} from '../components/row-group.tsx';
import {SectionHeader} from '../components/section-header.tsx';
import {SelectRow, type SelectOption} from '../components/select-row.tsx';
import {ToggleRow} from '../components/toggle-row.tsx';

const MODES: readonly {readonly id: ThemeMode; readonly label: MessageId}[] = [
  {id: 'system', label: 'settings.appearance.mode.system'},
  {id: 'light', label: 'settings.appearance.mode.light'},
  {id: 'dark', label: 'settings.appearance.mode.dark'},
];

/** The three mode names, which the section declares as searchable in their own right. */
const MODE_LABELS: readonly MessageId[] = MODES.map(entry => entry.label);

/**
 * The colours offered.
 *
 * Bloom gates two of its presets to the accounts whose brand they are. `oxy`
 * is one of them, and this browser is Oxy's -- so it is offered here and the
 * other reserved brand is not, which is exactly what the gate is for.
 */
const PRESETS: readonly AppColorName[] = ['oxy', ...FREE_COLOR_NAMES];

/**
 * The five sizes upstream's appearance page offers, in pixels.
 *
 * The numbers are the stored values of `webkit.webprefs.default_font_size` and
 * are upstream's own (`appearance_page.html`), not a scale invented here: a
 * profile that has been through Chromium's settings holds one of these, and a
 * different set would show the row as having no selection.
 */
const FONT_SIZES: readonly SelectOption[] = [
  {value: 9, label: 'settings.appearance.fontSize.verySmall'},
  {value: 12, label: 'settings.appearance.fontSize.small'},
  {value: 16, label: 'settings.appearance.fontSize.medium'},
  {value: 20, label: 'settings.appearance.fontSize.large'},
  {value: 24, label: 'settings.appearance.fontSize.veryLarge'},
];

/**
 * One colour, as a target the size of a target.
 *
 * The ring is an OUTER pressable with its own border rather than a thicker
 * border on the swatch itself: a border grows inward, so selecting a colour
 * would shrink the colour, and the grid would twitch as the selection moved.
 * The unselected state keeps the same transparent ring so the geometry is
 * identical in both states.
 */
function Swatch({name, selected}: {name: AppColorName; selected: boolean}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{selected}}
      accessibilityLabel={name}
      onPress={() => setPreset(name)}
      className={
        selected
          ? 'rounded-radius-max border-2 border-primary p-1'
          : 'rounded-radius-max border-2 border-transparent p-1 hover:border-border'
      }
    >
      {/* The seed colour of a preset is data, not a token: there is no utility
          class for "this brand's hex", and inventing one per preset would put
          the palette in two places. */}
      <View
        className="size-8 rounded-radius-max"
        style={{backgroundColor: APP_COLOR_PRESETS[name].hex}}
      />
    </Pressable>
  );
}

export function AppearanceSection() {
  const {mode, preset} = useThemeState();
  // `homepage` is a URL-typed pref and there is no text-input row in the
  // control vocabulary, so it is reported rather than offered. Reading it is
  // still worth doing: with the New Tab page toggle off, this is the address
  // the home button opens, and a page that showed the toggle without the
  // address would leave the user unable to see what they had chosen.
  const homepage = usePref('homepage');

  return (
    <>
      <SectionHeader title="settings.appearance.title" />

      {/* Anchored by hand, unlike every row below: `SectionCard` takes a
          rendered string rather than a message id, so it cannot anchor itself
          the way the row components do. */}
      <ControlAnchor id="settings.appearance.mode" also={MODE_LABELS}>
        <SectionCard title={t('settings.appearance.mode')}>
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
        </SectionCard>
      </ControlAnchor>

      <ControlAnchor id="settings.appearance.preset">
        <SectionCard
          title={t('settings.appearance.preset')}
          description={t('settings.appearance.preset.description')}
        >
          <View accessibilityRole="radiogroup" className="flex-row flex-wrap gap-2">
            {PRESETS.map(name => (
              <Swatch key={name} name={name} selected={name === preset} />
            ))}
          </View>
        </SectionCard>
      </ControlAnchor>

      <RowGroup title="settings.appearance.group.homeButton">
        <ToggleRow prefKey="browser.show_home_button" label="settings.appearance.homeButton" />
        <ToggleRow
          prefKey="homepage_is_newtabpage"
          label="settings.appearance.homepageIsNewTab"
          sublabel="settings.appearance.homepageIsNewTab.sublabel"
        />
        <InfoRow
          label="settings.appearance.homepage"
          sublabel="settings.appearance.homepage.sublabel"
          value={typeof homepage?.value === 'string' ? homepage.value : undefined}
        />
      </RowGroup>

      <RowGroup title="settings.appearance.group.bookmarksBar">
        <ToggleRow
          prefKey="bookmark_bar.show_on_all_tabs"
          label="settings.appearance.bookmarksBar"
        />
        <ToggleRow
          prefKey="bookmark_bar.show_tab_groups"
          label="settings.appearance.tabGroupsInBookmarksBar"
        />
        <ToggleRow
          prefKey="auto_pin_new_tab_groups"
          label="settings.appearance.autoPinNewTabGroups"
        />
      </RowGroup>

      <RowGroup title="settings.appearance.group.window">
        <ToggleRow
          prefKey="side_panel.is_right_aligned"
          label="settings.appearance.sidePanelRight"
        />
        <ToggleRow
          prefKey="browser.hovercard.memory_usage_enabled"
          label="settings.appearance.hoverCardMemory"
        />
        <ToggleRow
          prefKey="browser.split_view_drag_and_drop_enabled"
          label="settings.appearance.splitViewDragAndDrop"
        />
        {/* AppearanceHandler's own message, registered in
            chrome/browser/ui/webui/settings/appearance_handler.cc. It takes no
            arguments and sends no reply. Upstream disables the button while the
            set is already the default, which it learns from the separate
            `pinnedToolbarActionsAreDefault` reply; resetting an already-default
            toolbar is a no-op, so the button stays live rather than carrying a
            second round trip to grey itself out. */}
        <ActionRow
          label="settings.appearance.resetToolbar"
          sublabel="settings.appearance.resetToolbar.sublabel"
          actionLabel="settings.appearance.resetToolbar.action"
          onPress={() => send('resetPinnedToolbarActions')}
        />
      </RowGroup>

      <RowGroup title="settings.appearance.group.text">
        {/* Upstream's appearance page ALSO writes
            `webkit.webprefs.default_fixed_font_size` to this value minus three
            whenever it changes. Astro does not: the derived write would have to
            ride along inside a shared row component, and a fixed-width size
            that stops tracking the standard one is a cosmetic divergence rather
            than a broken setting. Both prefs remain editable -- the fixed one
            from the fonts subpage. */}
        <SelectRow
          prefKey="webkit.webprefs.default_font_size"
          label="settings.appearance.fontSize"
          options={FONT_SIZES}
        />
        <LinkRow label="settings.appearance.fonts.link" to="/fonts" />
      </RowGroup>
    </>
  );
}
