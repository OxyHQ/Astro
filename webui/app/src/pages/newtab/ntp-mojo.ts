// astro_ntp.mojom, as the new tab page binds it.
//
// Named ntp-mojo rather than mojo so the emitted chunk is not a second
// `astro-webui-mojo.js`: rollup disambiguates a collision by appending a
// counter, and `astro-webui-mojo2.js` names itself after the order two files
// happened to be visited in. The manifest that GN packs from is committed, so
// a name that can swap between builds is a diff nobody can review.
//
// The only file in the page that knows the interface exists. Everything above
// it works in the store's own types, which is what lets the dev server run the
// identical page against ./mock.ts with no branch anywhere in a component.
//
// Nothing here is vendored. The bindings are generated from the committed
// `src/chrome/browser/oxy/webui/astro_ntp.mojom` into a Chromium build's gen/
// directory and compiled in by the `astro-mojom` plugin in vite.config.ts,
// which is also where the reasoning about Mojo's own runtime staying a
// `//resources` URL is written down.

import {
  PageCallbackRouter,
  PageHandlerFactory,
  PageHandlerRemote,
  WidgetId as MojoWidgetId,
  type QuickLink as MojoQuickLink,
  type SearchEngine as MojoSearchEngine,
  type Tile as MojoTile,
  type Widget as MojoWidget,
} from 'astro-mojom/chrome/browser/oxy/webui/astro_ntp.mojom-webui.js';

import type {
  NtpSource,
  QuickLink,
  SearchEngine,
  Tile,
  Widget,
  WidgetId,
} from './ntp-store.ts';

/**
 * The enum, both ways.
 *
 * One table rather than two switches: the halves of a two-switch mapping drift
 * the moment a widget is added, and the direction that goes stale is the one
 * that turns a stored order into an order the browser drops.
 */
const WIDGET_BY_MOJO: ReadonlyMap<MojoWidgetId, WidgetId> = new Map([
  [MojoWidgetId.kWeather, 'weather'],
  [MojoWidgetId.kClock, 'clock'],
  [MojoWidgetId.kQuickLinks, 'quickLinks'],
  [MojoWidgetId.kNotes, 'notes'],
  [MojoWidgetId.kDiscover, 'discover'],
  [MojoWidgetId.kAlia, 'alia'],
  [MojoWidgetId.kSites, 'sites'],
]);

const MOJO_BY_WIDGET: ReadonlyMap<WidgetId, MojoWidgetId> = new Map(
  [...WIDGET_BY_MOJO].map(([mojo, id]) => [id, mojo]),
);

function toWidgets(widgets: MojoWidget[]): Widget[] {
  // A widget this build does not know is DROPPED rather than rendered as a
  // hole. The browser sends only what it has, so this fires when a page and
  // the browser serving it were built from different .mojom files — the one
  // case where the page cannot know what to draw.
  return widgets.flatMap(widget => {
    const id = WIDGET_BY_MOJO.get(widget.id);
    return id ? [{id, visible: widget.visible}] : [];
  });
}

function toQuickLinks(links: MojoQuickLink[]): QuickLink[] {
  return links.map(link => ({title: link.title, url: link.url}));
}

function toTiles(tiles: MojoTile[]): Tile[] {
  return tiles.map(tile => ({title: tile.title, url: tile.url}));
}

function toSearchEngines(engines: MojoSearchEngine[]): SearchEngine[] {
  return engines.map(engine => ({
    // int64 arrives as a bigint. Decimal string from here on — see the field's
    // comment in ntp-store.ts.
    id: engine.id.toString(),
    name: engine.name,
    keyword: engine.keyword,
    isDefault: engine.isDefault,
    selectable: engine.selectable,
  }));
}

export function createNtpSource(): NtpSource {
  const router = new PageCallbackRouter();
  const handler = new PageHandlerRemote();
  PageHandlerFactory.getRemote().createPageHandler(
    router.$.bindNewPipeAndPassRemote(),
    handler.$.bindNewPipeAndPassReceiver(),
  );

  return {
    getState: () =>
      handler.getState().then(({state}) => ({
        widgets: toWidgets(state.widgets),
        quickLinks: toQuickLinks(state.quickLinks),
        notes: state.notes,
        blockedCount: state.blockedCount,
        searchEngines: toSearchEngines(state.searchEngines),
      })),

    onChanged: listener => {
      // Six callbacks, one subscription. Each publishes only the slice it
      // carries, so a widget change does not make the notes textarea
      // re-render with a value the user is in the middle of typing over.
      const ids = [
        router.onWidgetsChanged.addListener((widgets: MojoWidget[]) => {
          listener({widgets: toWidgets(widgets)});
        }),
        router.onQuickLinksChanged.addListener((links: MojoQuickLink[]) => {
          listener({quickLinks: toQuickLinks(links)});
        }),
        router.onNotesChanged.addListener((notes: string) => {
          listener({notes});
        }),
        router.onBlockedCountChanged.addListener((blockedCount: number) => {
          listener({blockedCount});
        }),
        router.onTopSitesChanged.addListener((tiles: MojoTile[]) => {
          listener({tiles: toTiles(tiles)});
        }),
        router.onSearchEnginesChanged.addListener(
          (engines: MojoSearchEngine[]) => {
            listener({searchEngines: toSearchEngines(engines)});
          },
        ),
      ];
      return () => {
        for (const id of ids) {
          router.removeListener(id);
        }
      };
    },

    setWidgetVisible: (id, visible) => {
      const mojoId = MOJO_BY_WIDGET.get(id);
      if (mojoId !== undefined) {
        handler.setWidgetVisible(mojoId, visible);
      }
    },

    setWidgetOrder: order => {
      handler.setWidgetOrder(
        order.flatMap(id => {
          const mojoId = MOJO_BY_WIDGET.get(id);
          return mojoId === undefined ? [] : [mojoId];
        }),
      );
    },

    addQuickLink: (title, url) =>
      handler.addQuickLink(title, url).then(({accepted}) => accepted),

    updateQuickLink: (index, title, url) =>
      handler.updateQuickLink(index, title, url).then(({accepted}) => accepted),

    removeQuickLink: index => {
      handler.removeQuickLink(index);
    },

    setNotes: notes => {
      handler.setNotes(notes);
    },

    setDefaultSearchEngine: id =>
      handler.setDefaultSearchEngine(BigInt(id)).then(({accepted}) => accepted),

    search: query => {
      handler.searchWithDefaultEngine(query);
    },

    openCustomizeChrome: () => {
      handler.openCustomizeChrome();
    },

    openAliaSidePanel: () => {
      handler.openAliaSidePanel();
    },
  };
}
