// On startup.
//
// The choice is a pref; the list of pages is a handler. They are not
// interchangeable and neither can be read from the other.
//
// `session.restore_on_startup` is allowlisted and holds SessionStartupPref's
// PrefValue, which is NOT the enum beside it in
// chrome/browser/prefs/session_startup_pref.h -- the file says so itself: "for
// historical reasons the enum and value registered in the prefs don't line
// up". The stored numbers are 1 last session, 4 specific URLs, 5 new tab page,
// 6 last session and URLs. Writing the Type enum instead (0/2/3/4) would set a
// browser that starts somewhere the user did not choose, and 4 means two
// different things in the two scales, so it would even look plausible.
//
// `session.startup_urls` is allowlisted too, and is deliberately NOT what this
// screen reads. StartupPagesHandler owns a table model over those URLs, gives
// each row a title the browser resolved and a stable `modelIndex`, and every
// edit goes through the model so the pref and the model cannot drift. Editing
// the list pref directly would be a second writer to the same state.
//
// The messages, as settings_startup_pages_handler.cc registers them:
//
//   onStartupPrefsPageLoad          fire-and-forget. Turns the push on; the
//                                   handler answers with the list immediately.
//   update-startup-pages            push, [{title, url, tooltip, modelIndex}]
//   addStartupPage                  promise, (url) -> bool. False means the
//                                   browser could not make a URL of it.
//   removeStartupPage               fire-and-forget, (modelIndex)
//   setStartupPagesToCurrentPages   fire-and-forget
//
// The handler registers NOTHING in an off-the-record profile, so the list group
// reports that it could not be read rather than showing an empty list -- "you
// have no startup pages" and "this window cannot see them" are different facts.

import {Button, SettingsListItem, TextField, TextFieldInput} from '@oxyhq/bloom';
import {useState, useSyncExternalStore} from 'react';
import {View} from 'react-native';

import {SectionCard, addWebUIListener, send, sendWithPromise, t, usePref} from '@astro/platform';

import {RadioGroup} from '../components/radio-group.tsx';
import {RowGroup} from '../components/row-group.tsx';
import {SectionHeader} from '../components/section-header.tsx';

const STARTUP_MODE_PREF = 'session.restore_on_startup';

/** SessionStartupPref::PrefValue -- the numbers actually stored in the profile. */
const STARTUP_LAST = 1;
const STARTUP_URLS = 4;
const STARTUP_NEW_TAB = 5;
const STARTUP_LAST_AND_URLS = 6;

/** One row of StartupPagesHandler's table model. */
interface StartupPage {
  readonly title: string;
  readonly url: string;
  readonly modelIndex: number;
}

interface PagesState {
  /** Undefined until the handler has pushed a list; it never pushes in Incognito. */
  readonly pages: readonly StartupPage[] | undefined;
}

let snapshot: PagesState = {pages: undefined};
const listeners = new Set<() => void>();
let started = false;

function publish(next: PagesState): void {
  snapshot = next;
  for (const listener of listeners) {
    listener();
  }
}

function toPage(value: unknown): StartupPage | undefined {
  if (typeof value !== 'object' || value === null) {
    return undefined;
  }
  const candidate = value as {title?: unknown; url?: unknown; modelIndex?: unknown};
  if (typeof candidate.modelIndex !== 'number') {
    return undefined;
  }
  return {
    title: typeof candidate.title === 'string' ? candidate.title : '',
    url: typeof candidate.url === 'string' ? candidate.url : '',
    modelIndex: candidate.modelIndex,
  };
}

function subscribe(listener: () => void): () => void {
  if (!started) {
    started = true;
    // Registered before the call that turns the push on, or the first list --
    // which the handler sends as soon as JavaScript is allowed -- is lost.
    addWebUIListener('update-startup-pages', (...args: unknown[]) => {
      const [raw] = args;
      if (Array.isArray(raw)) {
        publish({
          pages: raw
            .map(toPage)
            .filter((page): page is StartupPage => page !== undefined),
        });
      }
    });
    send('onStartupPrefsPageLoad');
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): PagesState {
  return snapshot;
}

function AddPageRow() {
  const [draft, setDraft] = useState('');
  const [rejected, setRejected] = useState(false);

  const add = (): void => {
    const url = draft.trim();
    if (url === '') {
      return;
    }
    void sendWithPromise<boolean>('addStartupPage', url).then(
      accepted => {
        setRejected(!accepted);
        if (accepted) {
          // Cleared only on success, so a mistyped address stays on screen to
          // be corrected rather than vanishing with the error.
          setDraft('');
        }
      },
      () => {
        setRejected(true);
      },
    );
  };

  return (
    <SectionCard
      title={t('settings.onStartup.pages.add')}
      description={rejected ? t('settings.onStartup.pages.add.rejected') : undefined}
    >
      <View className="flex-row items-center gap-2">
        <View className="flex-1">
          <TextField>
            <TextFieldInput
              label={t('settings.onStartup.pages.add.field')}
              placeholder={t('settings.onStartup.pages.add.placeholder')}
              value={draft}
              onChangeText={setDraft}
              onSubmitEditing={add}
            />
          </TextField>
        </View>
        <Button variant="secondary" size="small" disabled={draft.trim() === ''} onPress={add}>
          {t('settings.onStartup.pages.add.button')}
        </Button>
      </View>
    </SectionCard>
  );
}

function StartupPages() {
  const {pages} = useSyncExternalStore(subscribe, getSnapshot);

  if (pages === undefined) {
    return <SectionCard description={t('settings.onStartup.pages.unavailable')} />;
  }

  return (
    <>
      <RowGroup
        title="settings.onStartup.pages"
        footer={pages.length === 0 ? 'settings.onStartup.pages.empty' : undefined}
      >
        {pages.map(page => (
          <SettingsListItem
            key={page.modelIndex}
            title={page.title === '' ? page.url : page.title}
            description={page.title === '' ? undefined : page.url}
            showChevron={false}
            rightElement={
              <Button
                variant="secondary"
                size="small"
                // The model index the handler gave this row, never its position
                // in the array: the two agree today and the handler NOTREACHEDs
                // on an index it does not recognise.
                onPress={() => send('removeStartupPage', page.modelIndex)}
              >
                {t('settings.onStartup.pages.remove')}
              </Button>
            }
          />
        ))}
        <SettingsListItem
          title={t('settings.onStartup.pages.useCurrent')}
          showChevron={false}
          rightElement={
            <Button
              variant="secondary"
              size="small"
              onPress={() => send('setStartupPagesToCurrentPages')}
            >
              {t('settings.onStartup.pages.useCurrent.button')}
            </Button>
          }
        />
      </RowGroup>

      <AddPageRow />
    </>
  );
}

export function OnStartupSection() {
  const mode = usePref(STARTUP_MODE_PREF);
  // The list only decides anything in the two modes that read it. Shown in
  // those and hidden otherwise, because a list of pages beside "open the new
  // tab page" reads as a list that will be opened.
  const usesPages = mode?.value === STARTUP_URLS || mode?.value === STARTUP_LAST_AND_URLS;

  return (
    <>
      <SectionHeader title="settings.onStartup.title" />

      <RadioGroup
        prefKey={STARTUP_MODE_PREF}
        label="settings.onStartup.mode"
        options={[
          {
            value: STARTUP_NEW_TAB,
            label: 'settings.onStartup.mode.newTab',
            description: 'settings.onStartup.mode.newTab.description',
          },
          {
            value: STARTUP_LAST,
            label: 'settings.onStartup.mode.last',
            description: 'settings.onStartup.mode.last.description',
          },
          {
            value: STARTUP_URLS,
            label: 'settings.onStartup.mode.urls',
            description: 'settings.onStartup.mode.urls.description',
          },
          {
            value: STARTUP_LAST_AND_URLS,
            label: 'settings.onStartup.mode.lastAndUrls',
            description: 'settings.onStartup.mode.lastAndUrls.description',
          },
        ]}
      />

      {usesPages ? <StartupPages /> : undefined}
    </>
  );
}
