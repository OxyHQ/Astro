// Search engine -- the dev browser this section renders from. DEV ONLY.
//
// Reached only from `platform/browser/mock/sections.ts`, which is imported only
// from inside an `import.meta.env.DEV` branch, so nothing here is emitted into a
// bundle the browser ships. See `platform/browser/env.ts`.
//
// Every Chromium pref declared here is one of the entries in
// `chrome/browser/extensions/api/settings_private/prefs_util.cc`, and every
// handler message is one `SearchEnginesHandler::RegisterMessages` registers
// (chrome/browser/ui/webui/settings/search_engines_handler.cc), so a control
// built against either keeps working when the mock is replaced by the browser.

import type {SectionFixtures} from '@astro/platform';

/** Which of `getSearchEnginesList`'s four lists an engine is currently in. */
type ListName = 'defaults' | 'actives' | 'others';

/**
 * One engine, in the handler's own key names.
 *
 * Deliberately spelled the way `CreateDictionaryForEngine` spells it, `default`
 * and all -- a fixture using the page's own field names would let the screen
 * render in dev from a shape the browser never sends. `list` is the exception:
 * the real handler expresses membership as an index range over its table model,
 * which a fixture has no equivalent of.
 */
interface FixtureEngine {
  readonly list: ListName;
  readonly modelIndex: number;
  readonly name: string;
  readonly displayName: string;
  readonly keyword: string;
  readonly url: string;
  readonly default: boolean;
  readonly canBeDefault: boolean;
  readonly canBeActivated: boolean;
  readonly canBeDeactivated: boolean;
  readonly canBeRemoved: boolean;
  readonly isManaged: boolean;
}

/**
 * The dev browser's engine model, mutable within a session.
 *
 * A frozen snapshot would make Activate, Deactivate and the default chooser
 * look inert: the real handler answers every write by pushing
 * `search-engines-changed` with a NEW model, so this reproduces that.
 * `sections.ts` is imported once, so this lives as long as the page does.
 */
let model: readonly FixtureEngine[] = [
  {
    list: 'defaults',
    modelIndex: 0,
    name: 'Oxy Search',
    displayName: 'Oxy Search',
    keyword: 'oxy.so',
    url: 'https://oxy.so/search?q=%s',
    default: true,
    canBeDefault: false,
    canBeActivated: false,
    canBeDeactivated: false,
    canBeRemoved: false,
    isManaged: false,
  },
  {
    list: 'defaults',
    modelIndex: 1,
    name: 'DuckDuckGo',
    displayName: 'DuckDuckGo',
    keyword: 'duckduckgo.com',
    url: 'https://duckduckgo.com/?q=%s',
    default: false,
    canBeDefault: true,
    canBeActivated: false,
    canBeDeactivated: false,
    canBeRemoved: true,
    isManaged: false,
  },
  {
    list: 'defaults',
    modelIndex: 2,
    name: 'Startpage',
    displayName: 'Startpage',
    keyword: 'startpage.com',
    url: 'https://www.startpage.com/sp/search?query=%s',
    default: false,
    canBeDefault: true,
    canBeActivated: false,
    canBeDeactivated: false,
    canBeRemoved: true,
    isManaged: false,
  },
  {
    list: 'actives',
    modelIndex: 3,
    name: 'Chromium issues',
    displayName: 'Chromium issues',
    keyword: 'crbug',
    url: 'https://issues.chromium.org/issues?q=%s',
    default: false,
    canBeDefault: false,
    canBeActivated: false,
    canBeDeactivated: true,
    canBeRemoved: true,
    isManaged: false,
  },
  {
    list: 'others',
    modelIndex: 4,
    name: 'MDN',
    displayName: 'MDN',
    keyword: 'mdn',
    url: 'https://developer.mozilla.org/search?q=%s',
    default: false,
    canBeDefault: false,
    canBeActivated: true,
    canBeDeactivated: false,
    canBeRemoved: true,
    isManaged: false,
  },
];

function snapshot(): Record<string, readonly FixtureEngine[]> {
  return {
    defaults: model.filter(engine => engine.list === 'defaults'),
    actives: model.filter(engine => engine.list === 'actives'),
    others: model.filter(engine => engine.list === 'others'),
    extensions: [],
  };
}

/**
 * The handler's own push, as the browser makes it.
 *
 * Both writes below are `send` calls with no reply, exactly as the real ones
 * are; the UI moves only because this event carries the new model back. It goes
 * out on a microtask rather than synchronously so the write behaves like the
 * IPC round trip it stands in for.
 */
function notifyChanged(): void {
  queueMicrotask(() => {
    const cr = (
      globalThis as {cr?: {webUIListenerCallback?: (event: string, ...args: unknown[]) => void}}
    ).cr;
    cr?.webUIListenerCallback?.('search-engines-changed', snapshot());
  });
}

export const searchFixtures: SectionFixtures = {
  prefs: [
    {key: 'omnibox.keyword_space_triggering_enabled', type: 'BOOLEAN', value: true},
    // A dictionary the page never writes and only reads enforcement from. The
    // value is the shape `DefaultSearchManager` stores; nothing on the page
    // reads inside it, which is why it is not filled in further.
    {
      key: 'default_search_provider_data.template_url_data',
      type: 'DICTIONARY',
      value: {short_name: 'Oxy Search', keyword: 'oxy.so'},
    },
  ],

  replies: {
    getSearchEnginesList: () => snapshot(),
  },

  actions: {
    setDefaultSearchEngine: (modelIndex: unknown) => {
      model = model.map(engine => {
        const chosen = engine.modelIndex === modelIndex;
        return {
          ...engine,
          default: chosen,
          // The engine that IS the default has nothing to make default, which
          // is how the real list controller reports it too.
          canBeDefault: !chosen && engine.list === 'defaults',
        };
      });
      notifyChanged();
    },
    setIsActiveSearchEngine: (modelIndex: unknown, isActive: unknown) => {
      model = model.map(engine =>
        engine.modelIndex === modelIndex
          ? {
              ...engine,
              list: isActive === true ? 'actives' : 'others',
              canBeActivated: isActive !== true,
              canBeDeactivated: isActive === true,
            }
          : engine,
      );
      notifyChanged();
    },
  },
};
