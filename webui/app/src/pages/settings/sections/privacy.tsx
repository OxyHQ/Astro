// Privacy and security -- four Chromium prefs, straight from
// chrome.settingsPrivate.
//
// Every key here is one of the paths in chrome/common/pref_names.h that the
// settingsPrivate allowlist (prefs_util.cc) actually carries, so these rows
// keep working when the dev mock is replaced by the browser. A pref absent
// from that allowlist is invisible to the API however correctly it is spelled,
// which is why the list is not a place to improvise.

import {SettingsListGroup} from '@oxyhq/bloom';
import {Text} from '@oxyhq/bloom/typography';

import {t} from '@astro/platform';

import {PrefSwitchRow} from '../pref-switch-row.tsx';

export function PrivacySection() {
  return (
    <>
      <Text className="text-sectionTitle text-foreground">{t('settings.privacy.title')}</Text>

      <SettingsListGroup>
        <PrefSwitchRow prefKey="enable_do_not_track" label="settings.privacy.doNotTrack" />
        <PrefSwitchRow
          prefKey="profile.password_manager_leak_detection"
          label="settings.privacy.leakDetection"
        />
        <PrefSwitchRow prefKey="https_only_mode_enabled" label="settings.privacy.httpsOnly" />
        <PrefSwitchRow prefKey="search.suggest_enabled" label="settings.privacy.searchSuggest" />
      </SettingsListGroup>
    </>
  );
}
