// You and Astro -- the dev browser this section renders from. DEV ONLY.
//
// Reached only from `platform/browser/mock/sections.ts`, which is imported only
// from inside an `import.meta.env.DEV` branch, so nothing here is emitted into a
// bundle the browser ships. See `platform/browser/env.ts`.
//
// Every Chromium pref declared here must be one of the entries in
// `chrome/browser/extensions/api/settings_private/prefs_util.cc`: a pref outside
// that allowlist is invisible to `chrome.settingsPrivate` however correctly it is
// spelled, so a control built against one works in dev and does nothing in the
// browser. The five `import_dialog_*` prefs are allowlisted on every desktop
// platform -- they sit in the non-ChromeOS arm of that file. Handler messages
// must be ones the C++ handler registered by `settings_ui.cc` actually answers,
// for the same reason.
//
// NOTHING HERE STANDS IN FOR AN OXY ACCOUNT, and that is deliberate. There is no
// account transport in the browser, so a fixture that answered one would let a
// screen be built against a message no handler registers -- which is a CHECK
// failure in a real build, not a blank card. The account state on this screen
// is a sentence, and a sentence needs no fixture.

import type {SectionFixtures} from '@astro/platform';

/** The dev browser's stand-in for `cr.webUIListenerCallback`. */
interface CrListenerGlobal {
  webUIListenerCallback?: (event: string, ...args: unknown[]) => void;
}

function fire(event: string, ...args: unknown[]): void {
  (globalThis as {cr?: CrListenerGlobal}).cr?.webUIListenerCallback?.(event, ...args);
}

let profileName = 'Person 1';

/**
 * ImporterList, as `SendBrowserProfileData` composes it.
 *
 * Two entries share a browser name and differ by profile, which is the shape
 * that catches a screen keying its rows by name instead of by `index`. The
 * second cannot supply passwords, so the row for that kind has to disable
 * itself once it is chosen.
 */
const SOURCES = [
  {
    name: 'Mozilla Firefox',
    index: 0,
    profileName: 'default-release',
    history: true,
    favorites: true,
    passwords: true,
    search: true,
    autofillFormData: true,
  },
  {
    name: 'Mozilla Firefox',
    index: 1,
    profileName: 'work',
    history: true,
    favorites: true,
    passwords: false,
    search: false,
    autofillFormData: false,
  },
  {
    name: 'Bookmarks HTML File',
    index: 2,
    profileName: '',
    history: false,
    favorites: true,
    passwords: false,
    search: false,
    autofillFormData: false,
  },
];

export const youAndAstroFixtures: SectionFixtures = {
  prefs: [
    {key: 'import_dialog_bookmarks', type: 'BOOLEAN', value: true},
    {key: 'import_dialog_history', type: 'BOOLEAN', value: false},
    {key: 'import_dialog_saved_passwords', type: 'BOOLEAN', value: true},
    {key: 'import_dialog_search_engine', type: 'BOOLEAN', value: false},
    {key: 'import_dialog_autofill_form_data', type: 'BOOLEAN', value: false},
  ],

  replies: {
    getProfileInfo: () => ({name: profileName, iconUrl: ''}),
    initializeImportDialog: () => SOURCES,
  },

  actions: {
    setProfileName: (...args: unknown[]) => {
      const [name] = args;
      if (typeof name === 'string' && name.trim() !== '') {
        profileName = name.trim();
        setTimeout(() => fire('profile-info-changed', {name: profileName, iconUrl: ''}), 0);
      }
    },
    importData: () => {
      // The real handler reports progress and nothing else: the import runs in
      // a separate process and the page learns how it went from the listener.
      fire('import-data-status-changed', 'inProgress');
      setTimeout(() => fire('import-data-status-changed', 'succeeded'), 900);
    },
    // Opens a file picker in C++, so there is nothing for a dev server to do.
    importFromBookmarksFile: () => undefined,
  },
};
