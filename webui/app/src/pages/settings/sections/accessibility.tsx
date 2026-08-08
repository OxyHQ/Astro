// Accessibility.
//
// Four allowlisted preferences and a way in to the captions screen. Every one
// was checked against
// `chrome/browser/extensions/api/settings_private/prefs_util.cc`:
// `settings.a11y.focus_highlight` at line 1217 (guarded `!IS_CHROMEOS`),
// `settings.a11y.caretbrowsing.enabled` at 596, `settings.toast.alert_level` at
// 593 (`!IS_CHROMEOS && !IS_ANDROID`) and
// `settings.a11y.overscroll_history_navigation` at 589, which is guarded
// `defined(USE_AURA)` -- true for Linux desktop, so the row belongs here.
//
// Everything named `ash::prefs::kAccessibility*` -- ChromeVox, Select to Speak,
// the magnifier, sticky keys, dictation, high contrast -- is ChromeOS and does
// not exist in this browser. It is absent rather than disabled.
//
// Three switches upstream draws here are deliberately missing, and the footer
// on the second group says so to the user:
//
//   * `settings.a11y.enable_accessibility_image_labels` sends page images to a
//     Google service for captioning, and posts a consent bubble through
//     AccessibilityMainHandler's `confirmA11yImageLabels`.
//   * `settings.a11y.enable_main_node_annotations` needs the ScreenAI
//     component, a Google-hosted download.
//   * `settings.a11y.enable_ax_tree_fixing` sits behind the same install state;
//     this tree has patched `getScreenAiInstallState` out of
//     AccessibilityMainHandler entirely, so the sub-label upstream renders
//     would never resolve.
//
// AccessibilityMainHandler's remaining message, `getScreenReaderState`, is
// registered and would work -- upstream uses it only to reveal the image-labels
// row, which is not drawn, so nothing here calls it.

import {LinkRow} from '../components/link-row.tsx';
import {RowGroup} from '../components/row-group.tsx';
import {SectionHeader} from '../components/section-header.tsx';
import {SelectRow, type SelectOption} from '../components/select-row.tsx';
import {ToggleRow} from '../components/toggle-row.tsx';

/**
 * `ToastAlertLevel`, whose values run the other way round from the switch
 * upstream draws over them: 0 is ALL and 1 is ACTIONABLE, so "more messages" is
 * the LOWER number. Spelling both out as named options rather than as a switch
 * is what keeps that from reading backwards.
 */
const TOAST_LEVELS: readonly SelectOption[] = [
  {value: 0, label: 'settings.accessibility.toastLevel.all'},
  {value: 1, label: 'settings.accessibility.toastLevel.actionable'},
];

export function AccessibilitySection() {
  return (
    <>
      <SectionHeader title="settings.accessibility.title" />

      <RowGroup title="settings.accessibility.group.navigation">
        <ToggleRow
          prefKey="settings.a11y.focus_highlight"
          label="settings.accessibility.focusHighlight"
          sublabel="settings.accessibility.focusHighlight.sublabel"
        />
        <ToggleRow
          prefKey="settings.a11y.caretbrowsing.enabled"
          label="settings.accessibility.caretBrowsing"
          sublabel="settings.accessibility.caretBrowsing.sublabel"
        />
        <ToggleRow
          prefKey="settings.a11y.overscroll_history_navigation"
          label="settings.accessibility.overscroll"
          sublabel="settings.accessibility.overscroll.sublabel"
        />
      </RowGroup>

      <RowGroup
        title="settings.accessibility.group.notifications"
        footer="settings.accessibility.omitted.footer"
      >
        <SelectRow
          prefKey="settings.toast.alert_level"
          label="settings.accessibility.toastLevel"
          options={TOAST_LEVELS}
        />
        <LinkRow
          label="settings.accessibility.captions.link"
          sublabel="settings.accessibility.captions.link.sublabel"
          to="/captions"
        />
      </RowGroup>
    </>
  );
}
