// Site settings -- the dev browser this section renders from. DEV ONLY.
//
// Reached only from `platform/browser/mock/sections.ts`, which is imported only
// from inside an `import.meta.env.DEV` branch, so nothing here is emitted into a
// bundle the browser ships. See `platform/browser/env.ts`.
//
// The one pref below is an entry in
// `chrome/browser/extensions/api/settings_private/prefs_util.cc`, and both
// handler messages are ones `SiteSettingsHandler::RegisterMessages` registers
// (chrome/browser/ui/webui/settings/site_settings_handler.cc), so the controls
// built against them keep working when the mock is replaced by the browser.
//
// The defaults are SEEDED FROM THE TABLE rather than listed here. Forty
// permissions have a default control, and a hand-written fixture for each is
// forty chances to spell a group name the browser does not know -- which in the
// real browser is not a wrong value but a NOTREACHED that takes the renderer
// down. Reading the same table the screen reads means the two cannot disagree.

import type {SectionFixtures} from '@astro/platform';

import {CONTENT_TYPES} from './site-settings.content-types.ts';

/** What `getDefaultValueForContentType` answers: `{setting, source?}`. */
interface DefaultSetting {
  setting: string;
  source?: string;
}

/**
 * Permissions the dev browser starts BLOCKED rather than at their table
 * default, so the "blocked" half of the control is reachable without a click,
 * and so the seeding is visibly not uniform.
 */
const BLOCKED_AT_START: readonly string[] = ['popups', 'ads', 'protected-content'];

/**
 * The one permission a policy has fixed.
 *
 * `source` is what makes the control refuse input -- anything other than
 * `preference` or absent means an authority other than the user decided. Every
 * section is asked to carry a managed case; this is Site settings'.
 */
const POLICY_MANAGED = 'notifications';

const defaults = new Map<string, DefaultSetting>(
  CONTENT_TYPES.filter(type => type.contentType !== undefined && type.defaultBehaviour).map(
    type => {
      const contentType = type.contentType ?? '';
      if (contentType === POLICY_MANAGED) {
        return [contentType, {setting: 'block', source: 'policy'}];
      }
      return [
        contentType,
        {
          setting: BLOCKED_AT_START.includes(contentType)
            ? 'block'
            : type.defaultBehaviour === 'allow'
              ? 'allow'
              : 'ask',
        },
      ];
    },
  ),
);

/**
 * The handler's own push, as the browser makes it.
 *
 * `setDefaultValueForContentType` sends no reply; the screen moves only because
 * the handler follows the write with `contentSettingCategoryChanged` carrying
 * the group name. A mock that skipped the push would make every radio look
 * dead while the write had in fact landed.
 */
function notifyChanged(contentType: string): void {
  queueMicrotask(() => {
    const cr = (
      globalThis as {cr?: {webUIListenerCallback?: (event: string, ...args: unknown[]) => void}}
    ).cr;
    cr?.webUIListenerCallback?.('contentSettingCategoryChanged', contentType);
  });
}

export const siteSettingsFixtures: SectionFixtures = {
  prefs: [
    {key: 'safety_hub.unused_site_permissions_revocation.enabled', type: 'BOOLEAN', value: true},
  ],

  replies: {
    getDefaultValueForContentType: (contentType: unknown) => {
      if (typeof contentType !== 'string') {
        return {};
      }
      // An unknown group name answers with nothing rather than a plausible
      // default: in the real browser it is a NOTREACHED, and a fixture that
      // invented an answer would hide a wrong name until a Chromium build.
      return defaults.get(contentType) ?? {};
    },
  },

  actions: {
    setDefaultValueForContentType: (contentType: unknown, setting: unknown) => {
      if (typeof contentType !== 'string' || typeof setting !== 'string') {
        return;
      }
      const current = defaults.get(contentType);
      if (!current || current.source !== undefined) {
        // A policy-managed default refuses the write, exactly as the browser
        // does -- a control that only ever gets its way in dev is a control
        // whose disabled state nobody has looked at.
        return;
      }
      defaults.set(contentType, {setting});
      notifyChanged(contentType);
    },
  },
};
