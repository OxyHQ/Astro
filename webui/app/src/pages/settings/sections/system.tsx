// System.
//
// Two local-state preferences and two handler-backed buttons.
//
// `background_mode.enabled` and `hardware_acceleration_mode.enabled` are both
// allowlisted in the non-ChromeOS branch of
// `chrome/browser/extensions/api/settings_private/prefs_util.cc` (lines
// 1147-1150), and both live in LOCAL STATE rather than in the profile --
// `BackgroundModeManager::RegisterPrefs` and `GpuModeManager::RegisterPrefs`
// register them into `RegisterLocalState`. settingsPrivate serves them anyway
// (`PrefsUtil::FindServiceForPref` falls back to local state), but the scope is
// worth saying out loud, which is what the group's footer does: changing either
// changes Astro for every profile on the device.
//
// Background mode really is available on Linux -- `enable_background_mode` in
// `chrome/common/features.gni` is `!is_android && !is_chromeos`, and it is the
// pref registration that flag guards, not just the UI.
//
// `relaunch` is BrowserLifetimeHandler's, registered unguarded in
// `chrome/browser/ui/webui/settings/browser_lifetime_handler.cc` and installed
// unconditionally by `settings_ui.cc:240`. Upstream puts a confirmation dialog
// in front of it, built from a second message
// (`shouldShowRelaunchConfirmationDialog`) that reports whether anything would
// be lost. This page has no dialog host mounted, so the warning is in the row
// itself instead -- an explicit "relaunch now" with the consequence written
// under it, rather than a bare button and a surprise.
//
// `showProxySettings` is SystemHandler's only message, registered in
// `system_handler.cc:30-35` and installed in the non-ChromeOS branch of
// `settings_ui.cc:290`. It takes no arguments and sends no reply. On Linux it
// launches the desktop environment's own network settings; there has never been
// an in-browser proxy editor on this platform.

import {send, usePref} from '@astro/platform';

import {ActionRow} from '../components/action-row.tsx';
import {RowGroup} from '../components/row-group.tsx';
import {SectionHeader} from '../components/section-header.tsx';
import {ToggleRow} from '../components/toggle-row.tsx';

export function SystemSection() {
  // The `proxy` pref is not rendered as a control -- it is a dictionary the
  // page cannot compose -- but its policy metadata decides whether the button
  // is worth offering. When a policy or an extension is setting the proxy, the
  // device's own settings are not what Astro uses, so sending the user there
  // would be sending them to the wrong place.
  const proxy = usePref('proxy');
  const proxyManaged = proxy?.enforcement === 'ENFORCED' || proxy?.controlledBy === 'EXTENSION';

  return (
    <>
      <SectionHeader title="settings.system.title" />

      <RowGroup title="settings.system.group.startup" footer="settings.system.startup.footer">
        <ToggleRow
          prefKey="background_mode.enabled"
          label="settings.system.backgroundMode"
          sublabel="settings.system.backgroundMode.sublabel"
        />
        <ToggleRow
          prefKey="hardware_acceleration_mode.enabled"
          label="settings.system.hardwareAcceleration"
          sublabel="settings.system.hardwareAcceleration.sublabel"
        />
        <ActionRow
          label="settings.system.relaunch"
          sublabel="settings.system.relaunch.sublabel"
          actionLabel="settings.system.relaunch.action"
          onPress={() => send('relaunch')}
        />
      </RowGroup>

      <RowGroup title="settings.system.group.network" footer="settings.system.proxy.footer">
        <ActionRow
          label="settings.system.proxy"
          sublabel={proxyManaged ? 'settings.system.proxy.managed' : 'settings.system.proxy.sublabel'}
          actionLabel="settings.system.proxy.action"
          disabled={proxyManaged}
          onPress={() => send('showProxySettings')}
        />
      </RowGroup>
    </>
  );
}
