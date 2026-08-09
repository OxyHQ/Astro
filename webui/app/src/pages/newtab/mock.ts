// The new tab page's browser, for the dev server.
//
// Dev-only and dynamically imported, so none of it reaches a shipped bundle:
// the store's `import.meta.env.DEV` branch is the only importer and Vite drops
// the whole graph from a production build.
//
// It holds the state in memory rather than in localStorage on purpose. The
// point of this port is that the page has no store of its own; a mock that
// persisted would let a component start reading from one again and the dev
// server would be the last place anyone noticed.

import {WIDGET_IDS, type NtpSource, type NtpState, type WidgetId} from './ntp-store.ts';

type Snapshot = Omit<NtpState, 'ready'>;

const INITIAL: Snapshot = {
  widgets: WIDGET_IDS.map(id => ({id, visible: true})),
  quickLinks: [
    {title: 'GitHub', url: 'https://github.com'},
    {title: 'Reddit', url: 'https://reddit.com'},
    {title: 'YouTube', url: 'https://youtube.com'},
    {title: 'Wikipedia', url: 'https://wikipedia.org'},
  ],
  notes: '',
  blockedCount: 12_408,
  searchEngines: [
    {id: '1', name: 'DuckDuckGo', keyword: 'duckduckgo.com', isDefault: true, selectable: true},
    {id: '2', name: 'Startpage', keyword: 'startpage.com', isDefault: false, selectable: true},
    {id: '3', name: 'Wikipedia', keyword: 'wikipedia.org', isDefault: false, selectable: true},
  ],
  tiles: [
    {title: 'Hacker News', url: 'https://news.ycombinator.com'},
    {title: 'MDN', url: 'https://developer.mozilla.org'},
  ],
};

export function createNtpMock(): NtpSource {
  let state: Snapshot = {...INITIAL};
  const listeners = new Set<(patch: Partial<NtpState>) => void>();

  function push(patch: Partial<NtpState>): void {
    state = {...state, ...patch};
    for (const listener of listeners) {
      listener(patch);
    }
  }

  // The same shape the browser enforces: a URL that does not parse, or is not
  // http(s), is refused rather than corrected. A mock that accepted anything
  // would hide the one branch of the UI that handles a refusal.
  function accepts(url: string): boolean {
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  }

  return {
    getState: () =>
      Promise.resolve({
        widgets: state.widgets,
        quickLinks: state.quickLinks,
        notes: state.notes,
        blockedCount: state.blockedCount,
        searchEngines: state.searchEngines,
      }),

    onChanged: listener => {
      listeners.add(listener);
      // Top sites are pushed rather than returned by getState in the browser
      // too, so the dev server exercises the same "arrives later" path.
      const timer = setTimeout(() => push({tiles: INITIAL.tiles}), 250);
      return () => {
        clearTimeout(timer);
        listeners.delete(listener);
      };
    },

    setWidgetVisible: (id, visible) => {
      push({
        widgets: state.widgets.map(widget =>
          widget.id === id ? {...widget, visible} : widget,
        ),
      });
    },

    setWidgetOrder: (order: readonly WidgetId[]) => {
      const byId = new Map(state.widgets.map(widget => [widget.id, widget]));
      const next = order.flatMap(id => {
        const widget = byId.get(id);
        return widget ? [widget] : [];
      });
      for (const widget of state.widgets) {
        if (!next.includes(widget)) {
          next.push(widget);
        }
      }
      push({widgets: next});
    },

    addQuickLink: (title, url) => {
      if (!accepts(url) || state.quickLinks.length >= 8) {
        return Promise.resolve(false);
      }
      push({quickLinks: [...state.quickLinks, {title, url}]});
      return Promise.resolve(true);
    },

    updateQuickLink: (index, title, url) => {
      if (!accepts(url) || index >= state.quickLinks.length) {
        return Promise.resolve(false);
      }
      push({
        quickLinks: state.quickLinks.map((link, at) =>
          at === index ? {title, url} : link,
        ),
      });
      return Promise.resolve(true);
    },

    removeQuickLink: index => {
      push({quickLinks: state.quickLinks.filter((_, at) => at !== index)});
    },

    setNotes: notes => {
      push({notes});
    },

    setDefaultSearchEngine: id => {
      if (!state.searchEngines.some(engine => engine.id === id)) {
        return Promise.resolve(false);
      }
      push({
        searchEngines: state.searchEngines.map(engine => ({
          ...engine,
          isDefault: engine.id === id,
        })),
      });
      return Promise.resolve(true);
    },

    search: query => {
      // The browser navigates the tab; the dev server has no browser to ask,
      // and a page that opened a real search from a mock would be lying about
      // which engine chose the URL.
      console.info(`[ntp mock] search: ${query}`);
    },

    openCustomizeChrome: () => {
      console.info('[ntp mock] open the Customize Chrome side panel');
    },

    openAliaSidePanel: () => {
      console.info('[ntp mock] open the Alia side panel');
    },
  };
}
