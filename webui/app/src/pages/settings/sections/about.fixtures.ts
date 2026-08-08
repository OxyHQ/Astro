// About Astro -- the dev browser this section renders from. DEV ONLY.
//
// Reached only from `platform/browser/mock/sections.ts`, which is imported only
// from inside an `import.meta.env.DEV` branch, so nothing here is emitted into a
// bundle the browser ships. See `platform/browser/env.ts`.
//
// No prefs: neither Astro's about screen nor upstream's binds one. One handler
// message, and it is an ACTION rather than a reply because that is what the C++
// is -- `refreshUpdateStatus` takes no callback id and answers by pushing an
// `update-status-changed` event, which is why the fixture fires the listener
// instead of returning a value.

import type {SectionFixtures} from '@astro/platform';

/** The dev browser's stand-in for `cr.webUIListenerCallback`. */
interface CrListenerGlobal {
  webUIListenerCallback?: (event: string, ...args: unknown[]) => void;
}

function fireListener(event: string, ...args: unknown[]): void {
  (globalThis as {cr?: CrListenerGlobal}).cr?.webUIListenerCallback?.(event, ...args);
}

export const aboutFixtures: SectionFixtures = {
  actions: {
    /**
     * Answer as a Linux `VersionUpdaterBasic` does.
     *
     * `disabled` is the state a machine with no waiting binary reports, and it
     * is the one every real Astro will produce, so it is what the dev browser
     * says. Change it to `nearly_updated` to see the relaunch wording. The
     * payload carries the whole dict `AboutHandler::SetUpdateStatus` builds so
     * the reader is exercised against the real shape, not a two-key stub.
     */
    refreshUpdateStatus: () => {
      // Asynchronous, as the real listener is: the browser answers after the
      // send has returned, and a synchronous fire would let the screen render
      // its answer before the press had finished being a press.
      setTimeout(
        () =>
          fireListener('update-status-changed', {
            status: 'disabled',
            message: '',
            progress: 0,
            rollback: false,
            powerwash: false,
            version: '',
            size: '0',
          }),
        150,
      );
    },
  },
};
