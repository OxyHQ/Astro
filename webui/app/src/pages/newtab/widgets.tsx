// The cards on the new tab page.
//
// One square card per widget, in a grid the user arranges. They are together
// in one file because they are one visual family: the surface, the radius and
// the padding are the card's, not each widget's, and a change to the family
// should be one edit rather than seven.
//
// Every colour here is a Bloom token. That is the whole point of the port —
// the page this replaces carried its own palette (`bg-raised`, `text-quiet`,
// `text-super`) in a stylesheet of its own, so changing Astro's colour did
// nothing to it. These classes resolve through BloomThemeProvider at the root
// of the app, which is driven by astro_theme.mojom, so a preset change repaints
// this page at the same instant it repaints the toolbar.

import {Bot_Stroke} from '@oxyhq/bloom/icons';
import {useThemeColor} from '@oxyhq/bloom/theme';
import {Text} from '@oxyhq/bloom/typography';
import {useRef, useState, useSyncExternalStore, type ReactNode} from 'react';
import {Image, Pressable, TextInput, View} from 'react-native';

import {t} from '@astro/platform';

import {
  openAliaSidePanel,
  search,
  setNotes,
  useNtp,
  type QuickLink,
  type Tile,
} from './ntp-store.ts';

/**
 * The browser's own icon for a site.
 *
 * SCHEME-RELATIVE, like every other internal address in this app: `//favicon2`
 * resolves against whatever scheme the page is served under, so it survives
 * the rename in #12 that a hard-coded `chrome://favicon2` would not — as a
 * page whose every icon silently stopped loading, since a CSP source that
 * stops matching denies rather than errors.
 *
 * `showFallbackMonogram` is what removes the error handling this used to need:
 * the browser draws a lettered tile for a site it has no icon for, so there is
 * no broken-image state for the page to detect and replace.
 */
function faviconUrl(pageUrl: string, size: number): string {
  const query = new URLSearchParams({
    size: String(size),
    scaleFactor: '1x',
    showFallbackMonogram: '',
    pageUrl,
  });
  return `//favicon2/?${query.toString()}`;
}

/**
 * The card every widget is drawn on.
 *
 * `aspect-square` rather than a height: the grid's columns change with the
 * window, so the card's height has to follow its own width or the rows stop
 * lining up at every breakpoint.
 */
export function WidgetCard({children}: {children: ReactNode}) {
  return (
    <View className="aspect-square w-full overflow-hidden rounded-2xl border border-border bg-card">
      {children}
    </View>
  );
}

/** The small uppercase label at the top of a card. */
function CardKicker({children}: {children: ReactNode}) {
  return (
    <Text className="text-caption text-text-tertiary uppercase">{children}</Text>
  );
}

// -- Clock --------------------------------------------------------------------

/**
 * The minute, as an external store.
 *
 * A `useEffect` with a `setInterval` is the usual shape and is a worse one
 * here: it re-runs on every render that changes a dependency, and the snapshot
 * it produces is state React did not know about. This subscribes once per
 * mounted clock, returns a stable snapshot while the minute is unchanged, and
 * so re-renders exactly when the displayed time actually differs.
 */
const clockListeners = new Set<() => void>();
let clockTimer: ReturnType<typeof setInterval> | undefined;
let clockSnapshot = Math.floor(Date.now() / 60_000);

function subscribeClock(listener: () => void): () => void {
  clockListeners.add(listener);
  clockTimer ??= setInterval(() => {
    const minute = Math.floor(Date.now() / 60_000);
    if (minute === clockSnapshot) {
      return;
    }
    clockSnapshot = minute;
    for (const each of clockListeners) {
      each();
    }
    // Ten seconds, not sixty: a minute-long tick lands up to a minute late
    // against the wall clock, and a clock that is visibly behind is worse than
    // one that costs five wakeups a minute.
  }, 10_000);
  return () => {
    clockListeners.delete(listener);
    if (clockListeners.size === 0 && clockTimer) {
      clearInterval(clockTimer);
      clockTimer = undefined;
    }
  };
}

export function ClockWidget() {
  useSyncExternalStore(subscribeClock, () => clockSnapshot);
  const now = new Date();
  return (
    <WidgetCard>
      <View className="flex-1 items-center justify-center gap-1 p-3">
        {/* The user's own locale and clock convention, from the runtime —
            never a format string, which is how a browser ends up showing a
            24-hour clock to someone whose system is set to 12. */}
        <Text className="text-headerBold text-foreground text-4xl tabular-nums">
          {now.toLocaleTimeString(undefined, {hour: '2-digit', minute: '2-digit'})}
        </Text>
        <Text className="text-bodySmall text-text-secondary">
          {now.toLocaleDateString(undefined, {month: 'short', day: 'numeric'})}
        </Text>
        <Text className="text-caption text-text-tertiary uppercase">
          {now.toLocaleDateString(undefined, {weekday: 'short'})}
        </Text>
      </View>
    </WidgetCard>
  );
}

// -- Weather ------------------------------------------------------------------

/**
 * Kept, drawn, and honest about being off.
 *
 * The widget it replaces fetched `wttr.in` directly from the page. That has
 * never worked in the shipped browser — the page's own guard returned before
 * the fetch and the WebUI CSP would have blocked it anyway — so what a user
 * actually saw was a blue card reading `--` and "Weather unavailable" with no
 * explanation. #22 forbids a trusted page fetching remote data at all: a
 * weather widget needs a browser-process broker with a declared endpoint, a
 * refresh cadence and an off switch, and none of that exists yet.
 *
 * So the card stays and says why. Deleting it would silently drop a widget the
 * user had; pretending it works would be worse.
 */
export function WeatherWidget() {
  return (
    <WidgetCard>
      <View className="flex-1 justify-between p-3">
        <CardKicker>{t('newtab.widget.weather')}</CardKicker>
        <View className="gap-1">
          <Text className="text-bodyTitleSmall text-foreground">
            {t('newtab.weather.unavailable')}
          </Text>
          <Text className="text-caption text-text-tertiary">
            {t('newtab.weather.reason')}
          </Text>
        </View>
      </View>
    </WidgetCard>
  );
}

// -- Quick links --------------------------------------------------------------

function LinkTile({link, size}: {link: QuickLink; size: number}) {
  return (
    <View
      href={link.url}
      accessibilityRole="link"
      accessibilityLabel={link.title}
      className="min-w-0 flex-row items-center gap-2 rounded-radius-12 p-1.5 hover:bg-fill-hover"
    >
      <Image
        source={{uri: faviconUrl(link.url, size)}}
        accessibilityLabel=""
        style={{width: size, height: size, borderRadius: 4}}
      />
      <Text numberOfLines={1} className="text-bodySmall text-foreground flex-1">
        {link.title}
      </Text>
    </View>
  );
}

export function QuickLinksWidget({onEdit}: {onEdit: () => void}) {
  const {quickLinks} = useNtp();
  return (
    <WidgetCard>
      <View className="flex-1 gap-1 p-3">
        <View className="flex-row items-center justify-between">
          <CardKicker>{t('newtab.widget.quickLinks')}</CardKicker>
          <Pressable accessibilityRole="button" onPress={onEdit}>
            <Text className="text-caption text-primary">
              {t('newtab.quickLinks.edit')}
            </Text>
          </Pressable>
        </View>
        {quickLinks.length === 0 ? (
          <Text className="text-caption text-text-tertiary">
            {t('newtab.quickLinks.empty')}
          </Text>
        ) : (
          <View className="min-h-0 flex-1 flex-row flex-wrap content-start">
            {quickLinks.slice(0, 8).map(link => (
              <View key={link.url} className="w-1/2">
                <LinkTile link={link} size={16} />
              </View>
            ))}
          </View>
        )}
      </View>
    </WidgetCard>
  );
}

// -- Notes --------------------------------------------------------------------

/**
 * The scratch note, stored in the profile.
 *
 * Two things are going on, and only one of them is obvious. The obvious one is
 * the debounce: a keystroke does not become a pref write. The other is the
 * draft — the browser echoes every write back on the observer, so a widget
 * that rendered straight from the store would have the echo of the user's own
 * typing arrive a beat later and overwrite whatever they typed in between.
 *
 * `sent` is what tells the two apart. A value equal to the last one this
 * widget sent is its own echo and is ignored; anything else came from
 * somewhere the user can see — another window with the same profile — and is
 * adopted.
 */
export function NotesWidget() {
  const {notes} = useNtp();
  const [seen, setSeen] = useState(notes);
  const [draft, setDraft] = useState(notes);
  const sent = useRef<string | undefined>(undefined);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  if (notes !== seen) {
    setSeen(notes);
    if (notes !== sent.current) {
      setDraft(notes);
    }
  }

  return (
    <WidgetCard>
      <View className="flex-1 gap-1 p-3">
        <CardKicker>{t('newtab.widget.notes')}</CardKicker>
        <TextInput
          multiline
          value={draft}
          onChangeText={next => {
            setDraft(next);
            sent.current = next;
            clearTimeout(timer.current);
            timer.current = setTimeout(() => setNotes(next), 400);
          }}
          placeholder={t('newtab.notes.placeholder')}
          accessibilityLabel={t('newtab.widget.notes')}
          className="text-bodySmall text-foreground min-h-0 flex-1"
          style={{textAlignVertical: 'top'}}
        />
      </View>
    </WidgetCard>
  );
}

// -- Discover -----------------------------------------------------------------

/**
 * A shipped card, not a feed.
 *
 * The widget it replaces looked like news and was not: it hid its image
 * element, drew a CSS gradient in its place and linked to a DuckDuckGo search
 * for "trending news" — a search endpoint hard-coded in the page of a browser
 * whose whole point is not to have those. It now runs the search through the
 * profile's own default provider, so it goes wherever the user's searches go.
 *
 * A real Discover feed is remote content and belongs behind #22's broker, in
 * astro-untrusted://, with an endpoint declared in the network manifest. This
 * is deliberately not a placeholder for it.
 */
export function DiscoverWidget() {
  return (
    <WidgetCard>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('newtab.discover.title')}
        onPress={() => search('trending news')}
        className="flex-1 justify-between bg-primary-subtle p-3"
      >
        <CardKicker>{t('newtab.discover.kicker')}</CardKicker>
        <Text className="text-bodyTitleSmall text-foreground">
          {t('newtab.discover.title')}
        </Text>
      </Pressable>
    </WidgetCard>
  );
}

// -- Alia ---------------------------------------------------------------------

export function AliaWidget() {
  const iconColor = useThemeColor('primary');
  return (
    <WidgetCard>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('newtab.widget.alia')}
        onPress={openAliaSidePanel}
        className="flex-1 justify-between p-3 hover:bg-fill-hover"
      >
        <View className="flex-row items-center gap-2">
          {/* Icons take a colour, not a class: on web react-native-css hands
              the component `{$$css: true, className}` rather than resolved
              styles, so the `style.color` an icon reads as its fallback fill
              is never there. */}
          <Bot_Stroke size="lg" fill={iconColor} />
          <Text className="text-caption text-text-tertiary">
            {t('newtab.alia.kicker')}
          </Text>
        </View>
        <Text className="text-bodySmall text-foreground">
          {t('newtab.alia.prompt')}
        </Text>
      </Pressable>
    </WidgetCard>
  );
}

// -- Most visited -------------------------------------------------------------

function TileCard({tile}: {tile: Tile}) {
  return (
    <WidgetCard>
      <View
        href={tile.url}
        accessibilityRole="link"
        accessibilityLabel={tile.title}
        className="flex-1 items-center justify-center gap-2 p-3 hover:bg-fill-hover"
      >
        <Image
          source={{uri: faviconUrl(tile.url, 32)}}
          accessibilityLabel=""
          style={{width: 32, height: 32, borderRadius: 8}}
        />
        <Text
          numberOfLines={1}
          className="text-caption text-text-secondary w-full text-center"
        >
          {tile.title}
        </Text>
      </View>
    </WidgetCard>
  );
}

/**
 * The most-visited cards, which are a GROUP rather than one widget.
 *
 * The others occupy one grid cell each; this one occupies as many as the
 * browser sent tiles for, at whatever position the arrangement puts it. That
 * is why it returns a fragment: a wrapper View would be one grid cell holding
 * four cards instead of four cells.
 */
export function SitesWidgets() {
  const {tiles, ready} = useNtp();
  if (tiles.length === 0) {
    // Before the history query answers there is nothing to say. Afterwards, an
    // empty result is a real state — a fresh profile — and gets a card saying
    // so rather than a hole in the grid.
    return ready ? (
      <View className="w-1/2 p-1.5 md:w-1/3 lg:w-1/4">
        <WidgetCard>
          <View className="flex-1 justify-center p-3">
            <Text className="text-caption text-text-tertiary">
              {t('newtab.sites.empty')}
            </Text>
          </View>
        </WidgetCard>
      </View>
    ) : undefined;
  }
  return (
    <>
      {tiles.map(tile => (
        <View key={tile.url} className="w-1/2 p-1.5 md:w-1/3 lg:w-1/4">
          <TileCard tile={tile} />
        </View>
      ))}
    </>
  );
}
