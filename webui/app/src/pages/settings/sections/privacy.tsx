// Privacy and security -- four Chromium prefs, straight from
// chrome.settingsPrivate.
//
// Every key here is one of the paths in chrome/common/pref_names.h that the
// settingsPrivate allowlist (prefs_util.cc) actually carries, so these rows
// keep working when the dev mock is replaced by the browser. A pref absent
// from that allowlist is invisible to the API however correctly it is spelled,
// which is why the list is not a place to improvise.

import {RowGroup} from '../components/row-group.tsx';
import {SectionHeader} from '../components/section-header.tsx';
import {ToggleRow} from '../components/toggle-row.tsx';

export function PrivacySection() {
  return (
    <>
      <SectionHeader title="settings.privacy.title" />

      <RowGroup>
        <ToggleRow prefKey="enable_do_not_track" label="settings.privacy.doNotTrack" />
        <ToggleRow
          prefKey="profile.password_manager_leak_detection"
          label="settings.privacy.leakDetection"
        />
        <ToggleRow prefKey="https_only_mode_enabled" label="settings.privacy.httpsOnly" />
        <ToggleRow prefKey="search.suggest_enabled" label="settings.privacy.searchSuggest" />
      </RowGroup>
    </>
  );
}
