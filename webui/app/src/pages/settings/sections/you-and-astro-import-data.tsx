// Import bookmarks and settings.
//
// Two transports, both real, and the second one is unusually strict about the
// shape of what it is handed.
//
// The five checkboxes are ordinary allowlisted prefs -- `import_dialog_*` in
// chrome/common/pref_names.h -- and they exist so a choice survives closing
// the dialog. They are also, and this is the part that matters, the KEYS of
// the dictionary `importData` expects: `HandleImportData` reads each with
// `*type_dict.FindBool(prefs::kImportDialog...)` and dereferences the optional
// without checking it, so a dictionary missing any one of the five is not a
// partial import, it is a crash. The payload is therefore built from the same
// table the rows are, with every key always present.
//
// The messages, as import_data_handler.cc registers them:
//
//   initializeImportDialog   promise -> [{name, index, profileName, history,
//                            favorites, passwords, search, autofillFormData}]
//   importData               fire-and-forget, (browserIndex, typesDict)
//   importFromBookmarksFile  fire-and-forget. Opens a file picker in C++.
//   import-data-status-changed   push, "inProgress" | "succeeded" | "failed"
//
// `index` is the browser's position in ImporterList and is what `importData`
// is keyed by; the handler bounds-checks it and silently returns on a bad one,
// so it is passed back exactly as it arrived rather than recomputed from the
// rendered order.
//
// A row is offered per SOURCE PROFILE, not per browser: the handler flattens
// several profiles of one browser into separate entries with the same `name`,
// which is why the sub-label carries `profileName`. Each entry also reports
// which of the five kinds it can actually supply, and a kind the chosen source
// does not have is dropped from the request by the handler anyway -- so the
// row for it is disabled here rather than being offered and quietly ignored.

import {Button, Checkbox, RadioIndicator, SettingsListItem} from '@oxyhq/bloom';
import {useState, useSyncExternalStore} from 'react';

import {
  SectionCard,
  addWebUIListener,
  send,
  sendWithPromise,
  setPref,
  t,
  usePref,
  type MessageId,
} from '@astro/platform';

import {usePrefControl} from '../components/policy.ts';
import {RowGroup} from '../components/row-group.tsx';
import {SubpageHeader} from '../components/section-header.tsx';

/**
 * The five kinds, joined to the pref that stores the choice and to the field
 * each source profile reports its support in.
 *
 * One table for all three so a kind cannot be offered without being sent, or
 * sent without the source having said it can supply it.
 */
const KINDS: readonly {
  readonly pref: string;
  readonly label: MessageId;
  readonly supported: 'history' | 'favorites' | 'passwords' | 'search' | 'autofillFormData';
}[] = [
  {pref: 'import_dialog_bookmarks', label: 'settings.import.kind.bookmarks', supported: 'favorites'},
  {pref: 'import_dialog_history', label: 'settings.import.kind.history', supported: 'history'},
  {
    pref: 'import_dialog_saved_passwords',
    label: 'settings.import.kind.passwords',
    supported: 'passwords',
  },
  {
    pref: 'import_dialog_search_engine',
    label: 'settings.import.kind.searchEngines',
    supported: 'search',
  },
  {
    pref: 'import_dialog_autofill_form_data',
    label: 'settings.import.kind.formData',
    supported: 'autofillFormData',
  },
];

/** One entry of ImporterList, as the handler describes it. */
interface Source {
  readonly name: string;
  readonly index: number;
  readonly profileName: string;
  readonly history: boolean;
  readonly favorites: boolean;
  readonly passwords: boolean;
  readonly search: boolean;
  readonly autofillFormData: boolean;
}

interface ImportState {
  readonly status: 'loading' | 'ready' | 'failed';
  readonly sources: readonly Source[];
  readonly reason: string | undefined;
  /** The handler's own progress word, once an import has been started. */
  readonly progress: string | undefined;
}

let snapshot: ImportState = {
  status: 'loading',
  sources: [],
  reason: undefined,
  progress: undefined,
};
const listeners = new Set<() => void>();
let started = false;

function publish(next: ImportState): void {
  snapshot = next;
  for (const listener of listeners) {
    listener();
  }
}

function toSource(value: unknown): Source | undefined {
  if (typeof value !== 'object' || value === null) {
    return undefined;
  }
  const candidate = value as Record<string, unknown>;
  if (typeof candidate['name'] !== 'string' || typeof candidate['index'] !== 'number') {
    return undefined;
  }
  return {
    name: candidate['name'],
    index: candidate['index'],
    profileName: typeof candidate['profileName'] === 'string' ? candidate['profileName'] : '',
    history: candidate['history'] === true,
    favorites: candidate['favorites'] === true,
    passwords: candidate['passwords'] === true,
    search: candidate['search'] === true,
    autofillFormData: candidate['autofillFormData'] === true,
  };
}

function subscribe(listener: () => void): () => void {
  if (!started) {
    started = true;
    addWebUIListener('import-data-status-changed', (...args: unknown[]) => {
      const [status] = args;
      if (typeof status === 'string') {
        publish({...snapshot, progress: status});
      }
    });
    void sendWithPromise<unknown>('initializeImportDialog').then(
      raw => {
        publish({
          status: 'ready',
          sources: Array.isArray(raw)
            ? raw.map(toSource).filter((source): source is Source => source !== undefined)
            : [],
          reason: undefined,
          progress: undefined,
        });
      },
      (reason: unknown) => {
        publish({
          status: 'failed',
          sources: [],
          reason: reason instanceof Error ? reason.message : String(reason),
          progress: undefined,
        });
      },
    );
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): ImportState {
  return snapshot;
}

/** The progress word the handler pushed, as a sentence. */
function progressMessage(progress: string | undefined): MessageId | undefined {
  if (progress === 'inProgress') {
    return 'settings.import.progress.inProgress';
  }
  if (progress === 'succeeded') {
    return 'settings.import.progress.succeeded';
  }
  if (progress === 'failed') {
    return 'settings.import.progress.failed';
  }
  return undefined;
}

function KindRow({
  prefKey,
  label,
  supported,
}: {
  prefKey: string;
  label: MessageId;
  supported: boolean;
}) {
  const {pref, enforced, note} = usePrefControl(prefKey);
  const checked = pref?.value === true;
  const locked = enforced || !pref || !supported;

  return (
    <SettingsListItem
      title={t(label)}
      description={supported ? note : t('settings.import.kind.unsupported')}
      disabled={locked}
      showChevron={false}
      accessibilityRole="none"
      onPress={() => setPref(prefKey, !checked)}
      rightElement={
        <Checkbox
          checked={checked && supported}
          disabled={locked}
          accessibilityLabel={t(label)}
          onCheckedChange={next => setPref(prefKey, next)}
        />
      }
    />
  );
}

/**
 * The payload `importData` demands.
 *
 * Every one of the five keys, always, whatever the source supports: the
 * handler dereferences each `FindBool` without checking it, so an omitted key
 * is a crash rather than an unimported kind. A kind the source cannot supply
 * is sent as false, which is also what the handler would compute for it.
 */
function useTypesPayload(source: Source | undefined): Record<string, boolean> {
  const payload: Record<string, boolean> = {};
  for (const kind of KINDS) {
    const pref = usePref(kind.pref);
    payload[kind.pref] = pref?.value === true && source !== undefined && source[kind.supported];
  }
  return payload;
}

export function YouAndAstroImportDataScreen() {
  const state = useSyncExternalStore(subscribe, getSnapshot);
  const [chosen, setChosen] = useState<number | undefined>(undefined);
  const source = state.sources.find(candidate => candidate.index === chosen);
  const types = useTypesPayload(source);
  const anySelected = Object.values(types).some(Boolean);
  const progress = progressMessage(state.progress);

  return (
    <>
      <SubpageHeader
        title="settings.youAndAstro.importData.title"
        backTo="/identity"
        backLabel="settings.nav.youAndAstro"
      />

      {state.status === 'failed' ? (
        <SectionCard
          description={t('settings.import.failed', {reason: state.reason ?? ''})}
        />
      ) : undefined}

      <RowGroup
        title="settings.import.source"
        footer={
          state.status === 'ready' && state.sources.length === 0
            ? 'settings.import.source.none'
            : undefined
        }
      >
        {state.sources.map(candidate => (
          <SettingsListItem
            key={candidate.index}
            title={candidate.name}
            description={candidate.profileName === '' ? undefined : candidate.profileName}
            accessibilityRole="none"
            showChevron={false}
            onPress={() => setChosen(candidate.index)}
            rightElement={<RadioIndicator selected={candidate.index === chosen} />}
          />
        ))}
      </RowGroup>

      <RowGroup title="settings.import.kinds" footer="settings.import.kinds.footer">
        {KINDS.map(kind => (
          <KindRow
            key={kind.pref}
            prefKey={kind.pref}
            label={kind.label}
            // Before a source is chosen every kind is offered, because none has
            // yet said it cannot supply one.
            supported={source === undefined || source[kind.supported]}
          />
        ))}
      </RowGroup>

      <RowGroup>
        <SettingsListItem
          title={t('settings.import.action')}
          description={
            source === undefined
              ? t('settings.import.action.chooseSource')
              : anySelected
                ? progress
                  ? t(progress)
                  : undefined
                : t('settings.import.action.chooseKind')
          }
          showChevron={false}
          rightElement={
            <Button
              variant="primary"
              size="small"
              disabled={source === undefined || !anySelected || state.progress === 'inProgress'}
              loading={state.progress === 'inProgress'}
              onPress={() => {
                if (source) {
                  send('importData', source.index, types);
                }
              }}
            >
              {t('settings.import.action.button')}
            </Button>
          }
        />
        <SettingsListItem
          title={t('settings.import.fromFile')}
          description={t('settings.import.fromFile.sublabel')}
          showChevron={false}
          rightElement={
            <Button
              variant="secondary"
              size="small"
              onPress={() => send('importFromBookmarksFile')}
            >
              {t('settings.import.fromFile.button')}
            </Button>
          }
        />
      </RowGroup>
    </>
  );
}
