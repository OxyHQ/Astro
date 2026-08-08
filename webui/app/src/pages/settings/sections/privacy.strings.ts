// Privacy and security -- every string this section renders, and the controls
// the page's search field can find in it.
//
// A section owns its own catalogue so that filling one in never touches a file
// another section is being filled in from. The two exports are read by two
// different shared files -- the message map by the app's catalogue
// (`platform/i18n/en.ts`), the control list by the page's registry -- and both
// of those are written once and never edited again to add a control here.

export const privacyStrings = {
  'settings.nav.privacy': 'Privacy and security',
  'settings.privacy.title': 'Privacy and security',
  'settings.privacy.security.title': 'Security',
  'settings.privacy.cookies.title': 'Third-party cookies',
  'settings.privacy.clearData.title': 'Delete browsing data',
  'settings.privacy.safetyHub.title': 'Safety check',
  'settings.privacy.securityKeys.title': 'Security keys',

  'settings.privacy.group.requests': 'What Astro asks of sites',
  'settings.privacy.doNotTrack': 'Send a "Do Not Track" request',
  'settings.privacy.doNotTrack.sublabel':
    'Sites are free to ignore the request, and most of them do.',
  'settings.privacy.leakDetection': 'Warn if a password is exposed in a breach',
  'settings.privacy.searchSuggest': 'Show search suggestions',
  'settings.privacy.searchSuggest.sublabel':
    'Sends what you type in the address bar to your search engine before you press Enter.',

  'settings.privacy.group.more': 'More',
  'settings.privacy.security.sublabel': 'Secure connections and secure DNS',
  'settings.privacy.cookies.sublabel': 'What cookies a site other than the one you are on may set',
  'settings.privacy.clearData.sublabel': 'History, cookies, cache, downloads and site data',
  'settings.privacy.siteSettings': 'Site settings',
  'settings.privacy.siteSettings.sublabel': 'What a site may use, and what it may show you',
  'settings.privacy.safetyHub.sublabel': 'Your version, and permissions withdrawn from unused sites',
  'settings.privacy.securityKeys.sublabel': 'PINs and credentials stored on a physical key',

  // Security subpage.
  'settings.privacy.security.httpsMode': 'Use secure connections',
  'settings.privacy.security.httpsMode.full': 'Always use secure connections',
  'settings.privacy.security.httpsMode.full.description':
    'Astro warns you before loading any site over HTTP, including ones that have never offered HTTPS.',
  'settings.privacy.security.httpsMode.balanced': 'Warn on sites that usually use HTTPS',
  'settings.privacy.security.httpsMode.balanced.description':
    'Astro upgrades what it can and warns only where dropping to HTTP is unexpected.',
  'settings.privacy.security.httpsMode.off': 'Do not warn',
  'settings.privacy.security.httpsMode.off.description':
    'Sites load over HTTP without a warning.',

  'settings.privacy.security.dns': 'Secure DNS',
  'settings.privacy.security.dns.mode': 'Use secure DNS',
  'settings.privacy.security.dns.mode.off': 'Off',
  'settings.privacy.security.dns.mode.automatic': 'With your current service provider',
  'settings.privacy.security.dns.mode.secure': 'With a provider you choose',
  'settings.privacy.security.dns.resolver': 'Provider',
  'settings.privacy.security.dns.effective': 'In effect now',
  'settings.privacy.security.dns.managed':
    'Secure DNS is being decided outside this profile, so what is chosen here may not be what the browser uses. The row above reports what the browser resolved.',
  'settings.privacy.security.dns.loading': 'Asking the browser for the provider list.',
  'settings.privacy.security.dns.failed':
    'The browser did not answer with a provider list, so no provider can be offered. The mode above is still a real preference and still applies.',
  'settings.privacy.security.dns.customNotOffered':
    'Typing a provider address by hand is not offered here yet. The browser validates and probes one through isValidConfig and probeConfig, and neither is wired up.',

  'settings.privacy.security.safeBrowsing': 'Safe Browsing is not part of Astro',
  'settings.privacy.security.safeBrowsing.body':
    'Chromium checks the pages you visit against a Google service. Astro is built with that service compiled out (safe_browsing_mode is 0 on every platform), and the preferences behind it are removed from the browser API this page reads. There is therefore no setting to offer: showing a switch here would be showing one that writes to a preference nothing in this build reads.',

  // Third-party cookies subpage.
  'settings.privacy.cookies.policy': 'Third-party cookies',
  'settings.privacy.cookies.policy.block': 'Block third-party cookies',
  'settings.privacy.cookies.policy.block.description':
    'Sites cannot use cookies to follow you from one site to the next. Some features that depend on a shared sign-in may stop working.',
  'settings.privacy.cookies.policy.incognito': 'Block third-party cookies in Incognito',
  'settings.privacy.cookies.policy.incognito.description':
    'Third-party cookies work as usual in a normal window and are blocked in an Incognito one.',
  'settings.privacy.cookies.footer':
    'This decides who may set a cookie, not what is filtered out of a page. Astro\'s ad blocker is a separate section with its own controls.',
  'settings.privacy.cookies.onDeviceNote':
    'Whether a site may store cookies at all is a site permission, and lives under Site settings.',

  // Delete browsing data subpage.
  'settings.privacy.clearData.timeRange': 'Time range',
  'settings.privacy.clearData.timeRange.15min': 'Last 15 minutes',
  'settings.privacy.clearData.timeRange.hour': 'Last hour',
  'settings.privacy.clearData.timeRange.day': 'Last 24 hours',
  'settings.privacy.clearData.timeRange.week': 'Last 7 days',
  'settings.privacy.clearData.timeRange.fourWeeks': 'Last 4 weeks',
  'settings.privacy.clearData.timeRange.allTime': 'All time',
  'settings.privacy.clearData.types': 'What to delete',
  'settings.privacy.clearData.history': 'Browsing history',
  'settings.privacy.clearData.downloads': 'Download history',
  'settings.privacy.clearData.cookies': 'Cookies and other site data',
  'settings.privacy.clearData.cache': 'Cached images and files',
  'settings.privacy.clearData.formData': 'Autofill form data',
  'settings.privacy.clearData.siteSettings': 'Site settings',
  'settings.privacy.clearData.hostedApps': 'Hosted app data',
  'settings.privacy.clearData.action': 'Delete the selected data',
  'settings.privacy.clearData.action.button': 'Delete',
  'settings.privacy.clearData.action.nothing': 'Choose at least one kind of data above.',
  'settings.privacy.clearData.confirm.title': 'Delete this data?',
  'settings.privacy.clearData.confirm.body':
    'This cannot be undone. Anything you delete here is gone from this profile on this device.',
  'settings.privacy.clearData.confirm.yes': 'Delete',
  'settings.privacy.clearData.confirm.no': 'Cancel',
  'settings.privacy.clearData.done': 'Deleted.',
  'settings.privacy.clearData.failed': 'The browser refused the deletion: {reason}',
  'settings.privacy.clearData.countersFailed':
    'The browser did not answer the request to start counting, so the amounts beside each kind are missing. The deletion itself still works.',
  'settings.privacy.clearData.passwordsNote':
    'Saved passwords are not offered here. This build of Chromium refuses a deletion request that includes them from a page like this one, so the row is left out rather than shipped as one that crashes the tab.',

  // Safety check subpage.
  'settings.privacy.safetyHub.version': 'Version',
  'settings.privacy.safetyHub.unusedSites': 'Permissions withdrawn from unused sites',
  'settings.privacy.safetyHub.unusedSites.empty':
    'Astro has not withdrawn a permission from any site. It withdraws one when a site you granted something to has gone unvisited for a long time.',
  'settings.privacy.safetyHub.unusedSites.allow': 'Allow again',
  'settings.privacy.safetyHub.failed': 'The browser did not answer: {reason}',
  'settings.privacy.safetyHub.missing': 'What this check does not cover',
  'settings.privacy.safetyHub.missing.body':
    'Chromium\'s own safety check also reports a Safe Browsing card, a saved-password card and an extension-review card. Safe Browsing is compiled out of Astro entirely. The other two need the password manager and the extensions surface, neither of which this page reaches yet.',
} as const;

/**
 * The controls this section ACTUALLY renders, for search to match on.
 *
 * The SECTION screen only -- a hit opens the section, not one of its subpages,
 * so listing a subpage's controls here would send someone looking for "time
 * range" to a screen that does not draw one. The subpage titles ARE listed,
 * because the section draws a row for each of them and that row is what the
 * search is meant to find.
 */
export const privacyControls = [
  'settings.privacy.doNotTrack',
  'settings.privacy.leakDetection',
  'settings.privacy.searchSuggest',
  'settings.privacy.security.title',
  'settings.privacy.cookies.title',
  'settings.privacy.clearData.title',
  'settings.privacy.siteSettings',
  'settings.privacy.safetyHub.title',
  'settings.privacy.securityKeys.title',
] as const;
