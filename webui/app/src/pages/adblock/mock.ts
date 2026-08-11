// The ad blocker page's browser, for the dev server.
//
// Dev-only and dynamically imported, so none of it reaches a shipped bundle:
// the store's `import.meta.env.DEV` branch is the only importer and Vite drops
// the whole graph from a production build.
//
// The catalogue below MIRRORS `GetFilterListCatalog()` in
// src/chrome/browser/oxy/adblock/astro_adblock_filter_list_catalog.cc -- same
// eleven entries, same order, same `default_enabled` -- because the dev server
// is where this page's empty states and its long list are actually looked at.
// It is a fixture, not a second source of truth: the browser sends the real
// catalogue over the wire and the page never consults this in a real build.

import type {AdBlockSource, AdBlockState} from './adblock-store.ts';

type Snapshot = Omit<AdBlockState, 'ready'>;

const INITIAL: Snapshot = {
  enabled: true,
  blockedCount: 12_408,
  filterLists: [
    {
      id: 'easylist',
      name: 'EasyList',
      description: 'Primary ad blocking rules used by most ad blockers',
      fetched: true,
    },
    {
      id: 'easyprivacy',
      name: 'EasyPrivacy',
      description: 'Blocks tracking scripts, pixels, and analytics',
      fetched: true,
    },
    {
      id: 'fanboy-annoyance',
      name: "Fanboy's Annoyance List",
      description: 'Blocks cookie notices, social widgets, and other annoyances',
      fetched: false,
    },
    {
      id: 'fanboy-social',
      name: "Fanboy's Social Blocking List",
      description: 'Blocks social media widgets and buttons',
      fetched: false,
    },
    {
      id: 'peter-lowe',
      name: "Peter Lowe's Ad and Tracking Server List",
      description: 'Compact list of known ad and tracking domains',
      fetched: false,
    },
    {
      id: 'easylist-germany',
      name: 'EasyList Germany',
      description: 'German-specific ad blocking rules',
      fetched: false,
    },
    {
      id: 'easylist-spain',
      name: 'EasyList Spain',
      description: 'Spanish-specific ad blocking rules',
      fetched: false,
    },
    {
      id: 'easylist-france',
      name: 'EasyList France',
      description: 'French-specific ad blocking rules',
      fetched: false,
    },
    {
      id: 'easylist-china',
      name: 'EasyList China',
      description: 'Chinese-specific ad blocking rules',
      fetched: false,
    },
    {
      id: 'easylist-dutch',
      name: 'EasyList Dutch',
      description: 'Dutch-specific ad blocking rules',
      fetched: false,
    },
    {
      id: 'easylist-italy',
      name: 'EasyList Italy',
      description: 'Italian-specific ad blocking rules',
      fetched: false,
    },
  ],
  disabledSites: ['example.com', 'news.ycombinator.com'],
  customRules: '',
};

/** The browser's own bound, from AstroAdBlockPageHandler. */
const MAX_CUSTOM_RULES_LENGTH = 64 * 1024;

export function createAdBlockMock(): AdBlockSource {
  let state: Snapshot = {...INITIAL};
  const listeners = new Set<(patch: Partial<AdBlockState>) => void>();

  function push(patch: Partial<AdBlockState>): void {
    state = {...state, ...patch};
    for (const listener of listeners) {
      listener(patch);
    }
  }

  return {
    getState: () => Promise.resolve({...state}),

    onChanged: listener => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    setEnabled: enabled => {
      push({enabled});
    },

    // The same refusal the browser gives: a host it has no exception for
    // changes nothing and says so, rather than removing a row the browser
    // still has. Without it, the one branch of the UI that handles a refusal
    // would never run on the dev server.
    removeSiteException: host => {
      if (!state.disabledSites.includes(host)) {
        return Promise.resolve(false);
      }
      push({disabledSites: state.disabledSites.filter(site => site !== host)});
      return Promise.resolve(true);
    },

    setCustomRules: rules => {
      if (rules.length > MAX_CUSTOM_RULES_LENGTH) {
        return Promise.resolve(false);
      }
      push({customRules: rules});
      return Promise.resolve(true);
    },
  };
}
