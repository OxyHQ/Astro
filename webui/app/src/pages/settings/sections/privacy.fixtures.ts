// Privacy and security -- the dev browser this section renders from. DEV ONLY.
//
// Reached only from `platform/browser/mock/sections.ts`, which is imported only
// from inside an `import.meta.env.DEV` branch, so nothing here is emitted into a
// bundle the browser ships. See `platform/browser/env.ts`.
//
// Every pref here is one of the 448 entries in
// `chrome/browser/extensions/api/settings_private/prefs_util.cc` AS ASTRO
// PATCHES IT -- the ungoogled series deletes the four Safe Browsing entries and
// `generated.password_leak_detection` from that file, so those are absent here
// too and no control is built against them. A pref outside the allowlist is
// invisible to `chrome.settingsPrivate` however correctly it is spelled.
//
// The set is chosen to make every rendering path drivable without C++: a plain
// toggle, one a policy merely RECOMMENDS (the control must stay usable and
// still show the recommendation), one a policy has ENFORCED (it must lock and
// name what locked it) sitting beside unmanaged neighbours, a NUMBER behind a
// radio group, and a STRING behind a select. Keep that spread as this section
// grows -- a fixture set where nothing is managed is a fixture set that never
// exercises the managed state.

import type {SectionFixtures} from '@astro/platform';

/**
 * The DoH provider table, as SecureDnsHandler would hand it over.
 *
 * Real entries from `net::DohProviderEntry`, with the template strings in the
 * form `DnsOverHttpsConfig::ToString` produces, because the resolver rows write
 * exactly what arrives here into `dns_over_https.templates`.
 */
const DOH_PROVIDERS = [
  {name: 'Cloudflare (1.1.1.1)', value: 'https://chrome.cloudflare-dns.com/dns-query'},
  {name: 'Quad9 (9.9.9.9)', value: 'https://dns.quad9.net/dns-query{?dns}'},
  {name: 'OpenDNS', value: 'https://doh.opendns.com/dns-query'},
];

/**
 * Sites Astro has withdrawn a permission from.
 *
 * Mutable, and the regrant below really removes one: a fixture that answered
 * the same list whatever was pressed would make a screen whose regrant does
 * nothing look identical to one whose regrant works.
 */
const revokedSites: {origin: string; permissions: string[]}[] = [
  {origin: 'https://maps.example', permissions: ['location']},
  {origin: 'https://recorder.example', permissions: ['microphone', 'camera']},
];

/** Counter text as ClearBrowsingDataHandler phrases it, per deletion pref. */
const COUNTER_TEXT: Readonly<Record<string, string>> = {
  'browser.clear_data.browsing_history': '1,284 items',
  'browser.clear_data.download_history': '12 items',
  'browser.clear_data.cookies': 'From 96 sites',
  'browser.clear_data.cache': 'Less than 320 MB',
  'browser.clear_data.form_data': '4 suggestions',
  'browser.clear_data.site_settings': '7 sites',
  'browser.clear_data.hosted_apps_data': 'None',
};

/** The dev browser's stand-in for `cr.webUIListenerCallback`. */
interface CrListenerGlobal {
  webUIListenerCallback?: (event: string, ...args: unknown[]) => void;
}

function fireListener(event: string, ...args: unknown[]): void {
  (globalThis as {cr?: CrListenerGlobal}).cr?.webUIListenerCallback?.(event, ...args);
}

/**
 * Push every counter, the way the handler does.
 *
 * Asynchronous on purpose: the real counters run off the UI thread and arrive
 * after the initialise call has resolved, so a screen that only renders an
 * amount it already had at first paint would look right here and be blank in
 * the browser.
 */
function pushCounters(): void {
  for (const [pref, text] of Object.entries(COUNTER_TEXT)) {
    setTimeout(() => fireListener('browsing-data-counter-text-update', pref, text), 120);
  }
}

export const privacyFixtures: SectionFixtures = {
  prefs: [
    {key: 'enable_do_not_track', type: 'BOOLEAN', value: false},
    {key: 'profile.password_manager_leak_detection', type: 'BOOLEAN', value: true},
    {
      key: 'search.suggest_enabled',
      type: 'BOOLEAN',
      value: false,
      controlledBy: 'USER_POLICY',
      controlledByName: 'Astro dev policy',
      enforcement: 'RECOMMENDED',
      recommendedValue: true,
    },

    // Security. `generated.https_first_mode_enabled` is a GENERATED pref: it
    // has no stored value, and its NUMBER is HttpsFirstModeSetting -- 0
    // disabled, 2 full, 3 balanced.
    {key: 'generated.https_first_mode_enabled', type: 'NUMBER', value: 3},
    {key: 'dns_over_https.mode', type: 'STRING', value: 'secure'},
    {
      key: 'dns_over_https.templates',
      type: 'STRING',
      value: 'https://chrome.cloudflare-dns.com/dns-query',
    },

    // Third-party cookies. 0 blocks them everywhere, 1 in Incognito only.
    {key: 'generated.third_party_cookie_blocking_setting', type: 'NUMBER', value: 1},

    // Delete browsing data. The time period is browsing_data::TimePeriod;
    // 1 is LAST_DAY, which is what upstream defaults a fresh profile to.
    {key: 'browser.clear_data.time_period', type: 'NUMBER', value: 1},
    {key: 'browser.clear_data.browsing_history', type: 'BOOLEAN', value: true},
    {key: 'browser.clear_data.download_history', type: 'BOOLEAN', value: false},
    {key: 'browser.clear_data.cookies', type: 'BOOLEAN', value: true},
    {key: 'browser.clear_data.cache', type: 'BOOLEAN', value: true},
    {key: 'browser.clear_data.form_data', type: 'BOOLEAN', value: false},
    {
      // A policy that fixes one row without touching the rest: the checkbox
      // must lock and name what locked it while its neighbours stay usable.
      key: 'browser.clear_data.site_settings',
      type: 'BOOLEAN',
      value: false,
      controlledBy: 'USER_POLICY',
      controlledByName: 'Astro dev policy',
      enforcement: 'ENFORCED',
    },
    {key: 'browser.clear_data.hosted_apps_data', type: 'BOOLEAN', value: false},
  ],

  replies: {
    getSecureDnsResolverList: () => DOH_PROVIDERS,
    getSecureDnsSetting: () => ({
      mode: 'secure',
      config: 'https://chrome.cloudflare-dns.com/dns-query',
      managementMode: 0,
    }),

    initializeClearBrowsingData: () => {
      pushCounters();
      return undefined;
    },
    clearBrowsingData: () => ({showHistoryNotice: false, showPasswordsNotice: false}),

    getVersionCardData: () => ({
      header: 'Astro is up to date',
      subheader: 'Version 141.0.7390.54 (Official build) (64-bit)',
      state: 0,
    }),
    getRevokedUnusedSitePermissionsList: () => revokedSites,
  },

  actions: {
    restartClearBrowsingDataCounters: () => pushCounters(),
    allowPermissionsAgainForUnusedSite: (...args: unknown[]) => {
      const [origin] = args;
      const at = revokedSites.findIndex(site => site.origin === origin);
      if (at !== -1) {
        revokedSites.splice(at, 1);
      }
    },
  },
};
