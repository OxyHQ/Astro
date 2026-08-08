// Reset settings -- the dev browser this section renders from. DEV ONLY.
//
// Reached only from `platform/browser/mock/sections.ts`, which is imported only
// from inside an `import.meta.env.DEV` branch, so nothing here is emitted into a
// bundle the browser ships. See `platform/browser/env.ts`.
//
// No prefs: upstream's reset page binds none and neither does Astro's. The
// whole section is ResetSettingsHandler, installed unguarded by
// `settings_ui.cc:444`, and both messages below are `sendWithPromise` in the
// C++ as well -- each takes a callback id and resolves.

import type {SectionFixtures} from '@astro/platform';

export const resetFixtures: SectionFixtures = {
  replies: {
    /**
     * The tampered-settings check.
     *
     * The real handler resolves LOCALISED LABELS rather than pref paths --
     * `reset_settings_handler.cc:230-250` maps `kHomePage` to "Homepage",
     * anything under the extensions prefix to "Extensions", and so on -- so the
     * fixture answers in that shape and not in pref paths. A non-empty answer
     * on purpose: the empty case is the one every real profile produces, and
     * the row that renders a list is the one that would otherwise never be
     * seen. Return `[]` here to drive the "nothing reported" wording.
     */
    getTamperedPreferencePaths: () => ['Search engine', 'Homepage', 'Extensions'],

    /**
     * The reset itself, which resolves with no value once it has finished.
     *
     * Deliberately slow. The real reset clears cookies and site data and takes
     * long enough to see; an instant answer would leave the button's busy state
     * untested, which is the state a user actually looks at. The dev bridge
     * hands a reply's return value straight to `cr.webUIResponse`, and
     * `sendWithPromise` resolves with it -- a promise is adopted rather than
     * delivered as a value, which is what makes a delayed answer work here at
     * all.
     */
    performResetProfileSettings: () =>
      new Promise<undefined>(resolve => {
        setTimeout(() => resolve(undefined), 900);
      }),
  },
};
