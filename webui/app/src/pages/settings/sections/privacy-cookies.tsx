// Third-party cookies.
//
// One choice, over `generated.third_party_cookie_blocking_setting`. That is a
// GENERATED pref -- there is no such value in the profile. Reading it maps
// `profile.cookie_controls_mode` down to the two states this screen offers, and
// writing it maps back up (chrome/browser/content_settings/generated_cookie_prefs.cc,
// GeneratedThirdPartyCookieBlockingSettingPref). Its values are the
// ThirdPartyCookieBlockingSetting enum from the header beside it: 0 blocks
// third-party cookies everywhere, 1 blocks them in Incognito only. Writing
// `profile.cookie_controls_mode` directly would work too and is worse -- that
// enum has a third value, kOff, which the generated pref exists to hide because
// it behaves identically to kIncognitoOnly and offering both would be offering
// the same setting twice.
//
// What is NOT here, on purpose:
//
//   * Whether a site may store cookies AT ALL. That is the COOKIES content
//     setting, it lives under Site settings as one of the 48 permission
//     screens, and its generated pref (`generated.cookie_default_content_setting`)
//     belongs to that section. Two sections rendering one pref is how the dev
//     fixture merge refuses to start, and rightly.
//   * Anything the ad blocker does. Astro ships its own blocking engine with
//     its own section; a cookie policy decides who may SET a cookie, not what
//     is filtered out of a page, and putting the two together would leave a
//     user unsure which one they had just turned off.
//   * Related Website Sets (`privacy_sandbox.first_party_sets_enabled`). Still
//     allowlisted, but the Privacy Sandbox is dismantled by
//     patches/ungoogled/core/ungoogled-chromium/disable-privacy-sandbox.patch,
//     so the pref is read by nothing left in the binary.

import {SectionCard, t} from '@astro/platform';
import {Text} from '@oxyhq/bloom/typography';

import {RadioGroup} from '../components/radio-group.tsx';
import {SubpageHeader} from '../components/section-header.tsx';

export function PrivacyCookiesScreen() {
  return (
    <>
      <SubpageHeader
        title="settings.privacy.cookies.title"
        backTo="/privacy"
        backLabel="settings.nav.privacy"
      />

      <RadioGroup
        prefKey="generated.third_party_cookie_blocking_setting"
        label="settings.privacy.cookies.policy"
        options={[
          {
            value: 0,
            label: 'settings.privacy.cookies.policy.block',
            description: 'settings.privacy.cookies.policy.block.description',
          },
          {
            value: 1,
            label: 'settings.privacy.cookies.policy.incognito',
            description: 'settings.privacy.cookies.policy.incognito.description',
          },
        ]}
      />

      <SectionCard description={t('settings.privacy.cookies.footer')}>
        <Text className="text-bodySmall text-text-tertiary">
          {t('settings.privacy.cookies.onDeviceNote')}
        </Text>
      </SectionCard>
    </>
  );
}
