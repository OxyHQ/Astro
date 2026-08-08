// On startup -- the dev browser this section renders from. DEV ONLY.
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
//
// The startup pages are held HERE rather than in the screen, because the real
// list is held by StartupPagesHandler's table model and pushed to the page --
// a screen that kept its own copy would look correct in dev and then find, in
// the browser, that the model had already moved on.

import type {SectionFixtures} from '@astro/platform';

/** The dev browser's stand-in for `cr.webUIListenerCallback`. */
interface CrListenerGlobal {
  webUIListenerCallback?: (event: string, ...args: unknown[]) => void;
}

interface Page {
  title: string;
  url: string;
}

const pages: Page[] = [
  {title: 'Oxy', url: 'https://oxy.so/'},
  {title: 'Mention', url: 'https://mention.earth/'},
];

/**
 * Push the list, as StartupPagesHandler's `OnModelChanged` does.
 *
 * The model index is the row's position, which is exactly how the real handler
 * assigns it, so a screen that mishandles an index fails here too.
 */
function pushPages(): void {
  (globalThis as {cr?: CrListenerGlobal}).cr?.webUIListenerCallback?.(
    'update-startup-pages',
    pages.map((page, index) => ({
      title: page.title,
      url: page.url,
      tooltip: page.url,
      modelIndex: index,
    })),
  );
}

export const onStartupFixtures: SectionFixtures = {
  prefs: [
    {
      // SessionStartupPref::PrefValue, not the Type enum beside it: 4 is
      // "open a specific set of pages". A policy that NARROWS the choice
      // rather than fixing it, so the radio group's filtering is exercised --
      // and RECOMMENDS one of the survivors, so the note is exercised too.
      key: 'session.restore_on_startup',
      type: 'NUMBER',
      value: 4,
      controlledBy: 'USER_POLICY',
      controlledByName: 'Astro dev policy',
      enforcement: 'RECOMMENDED',
      recommendedValue: 5,
      userSelectableValues: [1, 4, 5],
    },
  ],

  replies: {
    addStartupPage: (...args: unknown[]) => {
      const [url] = args;
      if (typeof url !== 'string' || !url.includes('.')) {
        // The real handler answers false for anything it cannot fix up into a
        // URL, and the screen has to keep the typed text when it does.
        return false;
      }
      const spec = url.startsWith('http') ? url : `https://${url}/`;
      pages.push({title: spec, url: spec});
      setTimeout(pushPages, 0);
      return true;
    },
  },

  actions: {
    onStartupPrefsPageLoad: () => setTimeout(pushPages, 0),
    removeStartupPage: (...args: unknown[]) => {
      const [index] = args;
      if (typeof index === 'number' && index >= 0 && index < pages.length) {
        pages.splice(index, 1);
        setTimeout(pushPages, 0);
      }
    },
    setStartupPagesToCurrentPages: () => {
      pages.splice(0, pages.length, {title: 'Astro settings', url: 'astro://settings/'});
      setTimeout(pushPages, 0);
    },
  },
};
