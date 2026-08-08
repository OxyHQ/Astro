// Default browser -- the dev browser this section renders from. DEV ONLY.
//
// Reached only from `platform/browser/mock/sections.ts`, which is imported only
// from inside an `import.meta.env.DEV` branch, so nothing here is emitted into a
// bundle the browser ships. See `platform/browser/env.ts`.
//
// This section declares no prefs, because there is no pref: which browser the
// system opens links with is asked and changed entirely through
// DefaultBrowserHandler. Handler messages must be ones the C++ handler
// registered by `settings_ui.cc` actually answers.

import type {SectionFixtures} from '@astro/platform';

/** The dev browser's stand-in for `cr.webUIListenerCallback`. */
interface CrListenerGlobal {
  webUIListenerCallback?: (event: string, ...args: unknown[]) => void;
}

let isDefault = false;

/**
 * The dictionary both the reply and the push carry, as
 * `DefaultBrowserHandler::OnDefaultCheckFinished` composes it.
 */
function state(): Record<string, boolean> {
  return {
    isDefault,
    canPin: false,
    canBeDefault: true,
    isUnknownError: false,
    isDisabledByPolicy: false,
  };
}

export const defaultBrowserFixtures: SectionFixtures = {
  replies: {
    requestDefaultBrowserState: () => state(),
  },

  actions: {
    // The real message raises the system's own "choose a default browser"
    // dialog and reports the outcome over the listener rather than a reply,
    // which is why the screen renders from the push and not from this call.
    setAsDefaultBrowser: () => {
      isDefault = true;
      setTimeout(() => {
        (globalThis as {cr?: CrListenerGlobal}).cr?.webUIListenerCallback?.(
          'browser-default-state-changed',
          state(),
        );
      }, 200);
    },
  },
};
