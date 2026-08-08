// Privacy and security -- the three Chromium prefs that belong on the section
// itself, and the way in to the five screens below it.
//
// Every key here is one of the 448 paths the settingsPrivate allowlist
// (chrome/browser/extensions/api/settings_private/prefs_util.cc) carries, so
// these rows keep working when the dev mock is replaced by the browser. A pref
// absent from that allowlist is invisible to the API however correctly it is
// spelled, which is why the list is not a place to improvise.
//
// Two things upstream draws on this page are deliberately absent. Safe
// Browsing is compiled out of Astro (safe_browsing_mode = 0) and the ungoogled
// series removes its four prefs from the allowlist, so the Security subpage
// says that rather than offering a switch. The Privacy Sandbox rows
// (`privacy_sandbox.m1.*`) are still allowlisted but the feature behind them is
// dismantled by patches/ungoogled/core/ungoogled-chromium/disable-privacy-sandbox.patch,
// so a control for them would write a preference no code reads.
//
// `https_only_mode_enabled` used to be a switch here. It moved to the Security
// subpage as the three-way `generated.https_first_mode_enabled`, because the
// raw boolean cannot express Balanced mode: writing it false while
// `kHttpsFirstBalancedMode` is set leaves the browser still warning, and the
// switch would sit there reading "off" while it was on.

import {LinkRow} from '../components/link-row.tsx';
import {RowGroup} from '../components/row-group.tsx';
import {SectionHeader} from '../components/section-header.tsx';
import {ToggleRow} from '../components/toggle-row.tsx';

export function PrivacySection() {
  return (
    <>
      <SectionHeader title="settings.privacy.title" />

      <RowGroup title="settings.privacy.group.requests">
        <ToggleRow
          prefKey="enable_do_not_track"
          label="settings.privacy.doNotTrack"
          sublabel="settings.privacy.doNotTrack.sublabel"
        />
        <ToggleRow
          prefKey="profile.password_manager_leak_detection"
          label="settings.privacy.leakDetection"
        />
        <ToggleRow
          prefKey="search.suggest_enabled"
          label="settings.privacy.searchSuggest"
          sublabel="settings.privacy.searchSuggest.sublabel"
        />
      </RowGroup>

      <RowGroup title="settings.privacy.group.more">
        <LinkRow
          label="settings.privacy.security.title"
          sublabel="settings.privacy.security.sublabel"
          to="/security"
        />
        <LinkRow
          label="settings.privacy.cookies.title"
          sublabel="settings.privacy.cookies.sublabel"
          to="/cookies"
        />
        <LinkRow
          label="settings.privacy.clearData.title"
          sublabel="settings.privacy.clearData.sublabel"
          to="/clearBrowserData"
        />
        {/* Site settings is another section of this same page rather than a
            subpage of this one, so the row crosses to its fragment. The rail
            follows, which is the honest outcome: the user has left privacy. */}
        <LinkRow
          label="settings.privacy.siteSettings"
          sublabel="settings.privacy.siteSettings.sublabel"
          to="/content"
        />
        <LinkRow
          label="settings.privacy.safetyHub.title"
          sublabel="settings.privacy.safetyHub.sublabel"
          to="/safetyCheck"
        />
        <LinkRow
          label="settings.privacy.securityKeys.title"
          sublabel="settings.privacy.securityKeys.sublabel"
          to="/securityKeys"
        />
      </RowGroup>
    </>
  );
}
