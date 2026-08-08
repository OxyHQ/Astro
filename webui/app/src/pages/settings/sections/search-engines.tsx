// Manage search engines and site search.
//
// Everything on this screen except the keyboard-shortcut toggle comes from
// `SearchEnginesHandler` (chrome/browser/ui/webui/settings/search_engines_handler.cc),
// which `settings_ui.cc` installs on the controller this page derives from. The
// messages used, with the argument list each one CHECKs:
//
//   getSearchEnginesList    1 arg  (the callback id) -> the four lists below
//   setDefaultSearchEngine  3 args (modelIndex, ChoiceMadeLocation, saveGuestChoice)
//   setIsActiveSearchEngine 2 args (modelIndex, isActive)
//
// and the handler pushes `search-engines-changed` with the same payload as
// `getSearchEnginesList` whenever the model moves, which is what makes a write
// from this page come back as a re-render rather than as a local guess.
//
// NOT used, deliberately: `searchEngineEditStarted` / `searchEngineEditCompleted`
// (adding and editing an engine) and `removeSearchEngine`. Editing needs a
// dialog this page does not have -- and in THIS checkout the handler is locally
// patched to CHECK_EQ(4U) on `searchEngineEditCompleted` while upstream's own
// WebUI still sends three arguments, so the upstream caller would take the
// renderer down. Deleting needs the confirmation upstream puts in front of it,
// and a destructive button without that dialog is not the same control.

import {Button, RadioIndicator, SettingsListItem} from '@oxyhq/bloom';
import {Text} from '@oxyhq/bloom/typography';
import {useSyncExternalStore, type ReactNode} from 'react';
import {View} from 'react-native';

import {
  addWebUIListener,
  SectionCard,
  send,
  sendWithPromise,
  t,
  type MessageId,
} from '@astro/platform';

import {RowGroup} from '../components/row-group.tsx';
import {SubpageHeader} from '../components/section-header.tsx';
import {ToggleRow} from '../components/toggle-row.tsx';

/**
 * One engine, as `CreateDictionaryForEngine` builds it.
 *
 * A subset of the handler's keys: the ones this page renders or decides from.
 * `modelIndex` is the only identifier the write messages accept -- it is the
 * engine's row in `TemplateURLTableModel`, not a stable id, which is why every
 * write is followed by the handler's own `search-engines-changed` push rather
 * than by patching this list in place.
 */
export interface SearchEngine {
  readonly modelIndex: number;
  readonly displayName: string;
  readonly keyword: string;
  readonly url: string;
  readonly isDefault: boolean;
  readonly canBeDefault: boolean;
  readonly canBeActivated: boolean;
  readonly canBeDeactivated: boolean;
  readonly isManaged: boolean;
}

/** The four lists `getSearchEnginesList` returns, by the handler's own key names. */
export interface SearchEngineList {
  readonly defaults: readonly SearchEngine[];
  readonly actives: readonly SearchEngine[];
  readonly others: readonly SearchEngine[];
  readonly extensions: readonly SearchEngine[];
}

const EMPTY: SearchEngineList = {defaults: [], actives: [], others: [], extensions: []};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * One entry of the handler's reply, narrowed.
 *
 * The reply crosses an IPC boundary as untyped data, so it is narrowed here
 * rather than asserted: an entry without a numeric `modelIndex` cannot be
 * written back and is dropped, and every other field falls back to a value the
 * UI can render. An assertion would turn a handler change into a blank screen
 * with no message.
 */
function toEngine(value: unknown): SearchEngine | undefined {
  if (!isRecord(value) || typeof value['modelIndex'] !== 'number') {
    return undefined;
  }
  const displayName = value['displayName'];
  const name = value['name'];
  const keyword = value['keyword'];
  const url = value['url'];
  return {
    modelIndex: value['modelIndex'],
    displayName:
      typeof displayName === 'string' && displayName !== ''
        ? displayName
        : typeof name === 'string'
          ? name
          : '',
    keyword: typeof keyword === 'string' ? keyword : '',
    url: typeof url === 'string' ? url : '',
    // `default` is the handler's own key name and a reserved word here, so it
    // is read by index rather than destructured.
    isDefault: value['default'] === true,
    canBeDefault: value['canBeDefault'] === true,
    canBeActivated: value['canBeActivated'] === true,
    canBeDeactivated: value['canBeDeactivated'] === true,
    isManaged: value['isManaged'] === true,
  };
}

function toList(reply: Record<string, unknown>, key: keyof SearchEngineList): SearchEngine[] {
  const raw = reply[key];
  if (!Array.isArray(raw)) {
    return [];
  }
  const engines: SearchEngine[] = [];
  for (const entry of raw) {
    const engine = toEngine(entry);
    if (engine) {
      engines.push(engine);
    }
  }
  return engines;
}

function parse(reply: unknown): SearchEngineList {
  if (!isRecord(reply)) {
    return EMPTY;
  }
  return {
    defaults: toList(reply, 'defaults'),
    actives: toList(reply, 'actives'),
    others: toList(reply, 'others'),
    extensions: toList(reply, 'extensions'),
  };
}

// The engine list, as an external store rather than component state.
//
// Same shape as `platform/browser/pref-store.ts`, and for the same reason: the
// browser owns this data and pushes changes at it, so `subscribe` is where the
// first read is started and the push listener is registered. Both screens that
// render engines share one snapshot, so a default chosen on the section shows
// on the subpage without either of them refetching -- and no mount effect is
// involved, because React calls `subscribe` itself.
let snapshot: SearchEngineList = EMPTY;
const listeners = new Set<() => void>();
let started = false;

function publish(reply: unknown): void {
  snapshot = parse(reply);
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(listener: () => void): () => void {
  if (!started) {
    started = true;
    // Registered BEFORE the first read, so a change that lands while
    // getSearchEnginesList is in flight is not lost.
    addWebUIListener('search-engines-changed', publish);
    void sendWithPromise<unknown>('getSearchEnginesList').then(publish);
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Every engine the browser knows about, live. */
export function useSearchEngines(): SearchEngineList {
  return useSyncExternalStore(subscribe, () => snapshot);
}

/**
 * `ChoiceMadeLocation::kSearchSettings`.
 *
 * The handler CHECKs this against its own enum, so it is not free-form: 0 is a
 * choice made on the search settings page, 1 one made in the engine manager.
 * Astro presents the chooser on the section, so both screens report 0.
 */
export const CHOICE_MADE_ON_SEARCH_SETTINGS = 0;

/**
 * Make an engine the default.
 *
 * The third argument is the guest-profile "remember this" answer, which only
 * the guest flow collects; a non-guest page has no answer to give and passes
 * null, which the handler reads as absent. It cannot be omitted -- the handler
 * CHECKs for exactly three arguments.
 */
export function makeDefaultSearchEngine(modelIndex: number): void {
  send('setDefaultSearchEngine', modelIndex, CHOICE_MADE_ON_SEARCH_SETTINGS, null);
}

/** A row that names an engine, with whatever control belongs on its right. */
function EngineRow({engine, action}: {engine: SearchEngine; action?: ReactNode}) {
  return (
    <SettingsListItem
      title={engine.displayName}
      description={engine.keyword === '' ? engine.url : engine.keyword}
      showChevron={false}
      rightElement={action}
    />
  );
}

/** What a group renders instead of itself when the browser reported none. */
function EmptyGroup({message}: {message: MessageId}) {
  return (
    <SectionCard>
      <Text className="text-body text-text-secondary">{t(message)}</Text>
    </SectionCard>
  );
}

export function SearchEnginesScreen() {
  const engines = useSearchEngines();

  return (
    <>
      <SubpageHeader
        title="settings.searchEngine.engines.title"
        backTo="/search"
        backLabel="settings.nav.search"
      />

      <RowGroup>
        <ToggleRow
          prefKey="omnibox.keyword_space_triggering_enabled"
          label="settings.searchEngine.keywordSpace"
          sublabel="settings.searchEngine.keywordSpace.sublabel"
        />
      </RowGroup>

      {engines.actives.length === 0 ? (
        <EmptyGroup message="settings.searchEngine.siteSearch.empty" />
      ) : (
        <RowGroup
          title="settings.searchEngine.siteSearch"
          footer="settings.searchEngine.siteSearch.footer"
        >
          {engines.actives.map(engine => (
            <EngineRow
              key={engine.modelIndex}
              engine={engine}
              action={
                engine.canBeDeactivated ? (
                  <Button
                    variant="secondary"
                    size="small"
                    onPress={() => send('setIsActiveSearchEngine', engine.modelIndex, false)}
                  >
                    {t('settings.searchEngine.deactivate')}
                  </Button>
                ) : undefined
              }
            />
          ))}
        </RowGroup>
      )}

      {engines.others.length === 0 ? (
        <EmptyGroup message="settings.searchEngine.inactive.empty" />
      ) : (
        <RowGroup
          title="settings.searchEngine.inactive"
          footer="settings.searchEngine.inactive.footer"
        >
          {engines.others.map(engine => (
            <EngineRow
              key={engine.modelIndex}
              engine={engine}
              action={
                engine.canBeActivated ? (
                  <Button
                    variant="secondary"
                    size="small"
                    onPress={() => send('setIsActiveSearchEngine', engine.modelIndex, true)}
                  >
                    {t('settings.searchEngine.activate')}
                  </Button>
                ) : undefined
              }
            />
          ))}
        </RowGroup>
      )}

      {engines.extensions.length === 0 ? undefined : (
        <RowGroup
          title="settings.searchEngine.extensions"
          footer="settings.searchEngine.extensions.footer"
        >
          {engines.extensions.map(engine => (
            <EngineRow key={engine.modelIndex} engine={engine} />
          ))}
        </RowGroup>
      )}

      <SectionCard>
        <Text className="text-body text-text-secondary">
          {t('settings.searchEngine.editing.footer')}
        </Text>
      </SectionCard>
    </>
  );
}

/**
 * The default-engine chooser, drawn on the SECTION and defined here.
 *
 * It lives next to the store it reads rather than in `search.tsx`, so the one
 * place that knows the handler's payload shape is the one place that knows what
 * `canBeDefault` means. A policy that fixes the default reports it on
 * `default_search_provider_data.template_url_data`, which is why the group
 * takes an `enforced` flag from the caller rather than deciding for itself.
 */
export function DefaultEngineChooser({enforced}: {enforced: boolean}) {
  const engines = useSearchEngines();

  if (engines.defaults.length === 0) {
    return (
      <SectionCard>
        <Text className="text-body text-text-secondary">
          {t('settings.searchEngine.default.pending')}
        </Text>
      </SectionCard>
    );
  }

  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={t('settings.searchEngine.default')}>
      {engines.defaults.map(engine => (
        <SettingsListItem
          key={engine.modelIndex}
          title={engine.displayName}
          description={engine.keyword}
          accessibilityRole="none"
          // The engine that IS the default reports canBeDefault false -- there
          // is nothing to make default. It must still render selectable-looking
          // rather than greyed, or the current choice would read as the one
          // option the user may not have.
          disabled={enforced || (!engine.canBeDefault && !engine.isDefault)}
          showChevron={false}
          onPress={() => makeDefaultSearchEngine(engine.modelIndex)}
          rightElement={<RadioIndicator selected={engine.isDefault} />}
        />
      ))}
    </View>
  );
}
