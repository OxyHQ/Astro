// astro_adblock.mojom, as the ad blocker page binds it.
//
// Named adblock-mojo rather than mojo so the emitted chunk is not a second
// `astro-webui-mojo.js`: rollup disambiguates a collision by appending a
// counter, and a name that can swap between builds is a diff nobody can review
// in a manifest that is committed.
//
// The only file in the page that knows the interface exists. Everything above
// it works in the store's own types, which is what lets the dev server run the
// identical page against ./mock.ts with no branch anywhere in a component.
//
// Nothing here is vendored. The bindings are generated from the committed
// `src/chrome/browser/oxy/webui/astro_adblock.mojom` into a Chromium build's
// gen/ directory and compiled in by the `astro-mojom` plugin in vite.config.ts.

import {
  PageCallbackRouter,
  PageHandlerFactory,
  PageHandlerRemote,
  type FilterList as MojoFilterList,
} from 'astro-mojom/chrome/browser/oxy/webui/astro_adblock.mojom-webui.js';

import type {AdBlockSource, FilterList} from './adblock-store.ts';

function toFilterLists(lists: MojoFilterList[]): FilterList[] {
  return lists.map(list => ({
    id: list.id,
    name: list.name,
    description: list.description,
    fetched: list.fetched,
  }));
}

export function createAdBlockSource(): AdBlockSource {
  const router = new PageCallbackRouter();
  const handler = new PageHandlerRemote();
  PageHandlerFactory.getRemote().createPageHandler(
    router.$.bindNewPipeAndPassRemote(),
    handler.$.bindNewPipeAndPassReceiver(),
  );

  return {
    getState: () =>
      handler.getState().then(({state}) => ({
        enabled: state.enabled,
        blockedCount: state.blockedCount,
        filterLists: toFilterLists(state.filterLists),
        disabledSites: state.disabledSites,
        customRules: state.customRules,
      })),

    onChanged: listener => {
      // Four callbacks, one subscription. Each publishes only the slice it
      // carries -- which is why the interface splits them at all: the blocked
      // count changes while someone is typing in the custom-rules box, and a
      // whole-state push would replace what they typed once per blocked
      // request.
      const ids = [
        router.onEnabledChanged.addListener((enabled: boolean) => {
          listener({enabled});
        }),
        router.onBlockedCountChanged.addListener((blockedCount: number) => {
          listener({blockedCount});
        }),
        router.onDisabledSitesChanged.addListener((disabledSites: string[]) => {
          listener({disabledSites});
        }),
        router.onCustomRulesChanged.addListener((customRules: string) => {
          listener({customRules});
        }),
      ];
      return () => {
        for (const id of ids) {
          router.removeListener(id);
        }
      };
    },

    setEnabled: enabled => {
      handler.setEnabled(enabled);
    },

    removeSiteException: host =>
      handler.removeSiteException(host).then(({accepted}) => accepted),

    setCustomRules: rules =>
      handler.setCustomRules(rules).then(({accepted}) => accepted),
  };
}
