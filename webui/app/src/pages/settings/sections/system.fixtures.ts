// System -- the dev browser this section renders from. DEV ONLY.
//
// Reached only from `platform/browser/mock/sections.ts`, which is imported only
// from inside an `import.meta.env.DEV` branch, so nothing here is emitted into a
// bundle the browser ships. See `platform/browser/env.ts`.
//
// The three prefs are entries in
// `chrome/browser/extensions/api/settings_private/prefs_util.cc`:
// `background_mode.enabled` and `hardware_acceleration_mode.enabled` at lines
// 1147-1150 (the non-ChromeOS branch), and `proxy` at 1222, unguarded.
//
// Both handler messages are ACTIONS rather than replies, matching the C++:
// `relaunch` (BrowserLifetimeHandler) and `showProxySettings` (SystemHandler)
// each take no arguments and send nothing back. Answering at all is what proves
// the call reached a handler rather than falling through to the dev bridge's
// unknown-message failure -- there is nothing for a dev browser to relaunch.

import type {SectionFixtures} from '@astro/platform';

export const systemFixtures: SectionFixtures = {
  prefs: [
    {key: 'background_mode.enabled', type: 'BOOLEAN', value: false},
    {key: 'hardware_acceleration_mode.enabled', type: 'BOOLEAN', value: true},

    // The dictionary the proxy row reads for its policy state rather than for
    // its value. Unmanaged here, so the button renders live; give it an
    // `enforcement` of `ENFORCED` to see the managed sentence and the disabled
    // button instead.
    {key: 'proxy', type: 'DICTIONARY', value: {mode: 'system'}},
  ],

  actions: {
    relaunch: () => undefined,
    showProxySettings: () => undefined,
  },
};
