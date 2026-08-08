// Downloads -- the dev browser this section renders from. DEV ONLY.
//
// Reached only from `platform/browser/mock/sections.ts`, which is imported only
// from inside an `import.meta.env.DEV` branch, so nothing here is emitted into a
// bundle the browser ships. See `platform/browser/env.ts`.
//
// Every Chromium pref declared here must be one of the entries in
// `chrome/browser/extensions/api/settings_private/prefs_util.cc`: a pref outside
// that allowlist is invisible to `chrome.settingsPrivate` however correctly it is
// spelled, so a control built against one works in dev and does nothing in the
// browser. Handler messages must be ones the C++ handler registered by
// `settings_ui.cc` actually answers, for the same reason.

import type {SectionFixtures} from '@astro/platform';

/** The dev browser's stand-in for `cr.webUIListenerCallback`. */
interface CrListenerGlobal {
  webUIListenerCallback?: (event: string, ...args: unknown[]) => void;
}

/** Whether any file type is set to open automatically, as the handler reports it. */
let autoOpenInUse = true;

function pushAutoOpen(): void {
  (globalThis as {cr?: CrListenerGlobal}).cr?.webUIListenerCallback?.(
    'auto-open-downloads-changed',
    autoOpenInUse,
  );
}

export const downloadsFixtures: SectionFixtures = {
  prefs: [
    {key: 'download.default_directory', type: 'STRING', value: '/home/you/Downloads'},
    {key: 'download.prompt_for_download', type: 'BOOLEAN', value: false},
    {key: 'download_bubble.partial_view_enabled', type: 'BOOLEAN', value: true},
  ],

  actions: {
    // Asynchronous, like the handler: it fires the first update from inside
    // the initialise call, which is after the page has subscribed but not in
    // the same turn -- a screen that only rendered what it had synchronously
    // would look right here and be blank in the browser.
    initializeDownloads: () => setTimeout(pushAutoOpen, 0),
    resetAutoOpenFileTypes: () => {
      autoOpenInUse = false;
      setTimeout(pushAutoOpen, 0);
    },
    // The real message opens the browser's own folder picker and writes
    // `download.default_directory` when it is accepted. There is no picker in
    // a dev server and a fixture cannot write a pref, so the row keeps the
    // path it has -- which is also what the browser does when the dialog is
    // cancelled.
    selectDownloadLocation: () => undefined,
  },
};
