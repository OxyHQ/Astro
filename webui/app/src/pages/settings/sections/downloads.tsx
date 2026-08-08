// Downloads.
//
// Three allowlisted prefs and one thing that is not a pref at all.
//
// `download.default_directory` is a STRING and it is READ-ONLY from here. The
// value is a filesystem path, and a page cannot know whether a path a user
// typed exists, is writable, or is somewhere the browser is allowed to write
// at all -- so the row reports the path and the button asks the browser to
// open its own folder picker. `selectDownloadLocation` (downloads_handler.cc)
// writes the pref itself when the dialog is accepted, and the echo through
// settingsPrivate is what moves this row. Nothing is applied locally.
//
// The auto-open row is the one piece of state with no pref behind it:
// `kDownloadExtensionsToOpen` is not in the allowlist, and what the page needs
// is not the list but whether it is empty. DownloadsHandler answers that over
// a listener -- `initializeDownloads` turns the channel on and
// `auto-open-downloads-changed` carries a single boolean -- so the button is
// offered only when there is something to clear. Undefined is a third state
// and is reported as one: "the browser has not said" is not "there is
// nothing".

import {Button, SettingsListItem} from '@oxyhq/bloom';
import {useSyncExternalStore} from 'react';

import {addWebUIListener, send, t} from '@astro/platform';

import {ControlAnchor} from '../components/control-anchor.tsx';
import {usePrefControl} from '../components/policy.ts';
import {RowGroup} from '../components/row-group.tsx';
import {SectionHeader} from '../components/section-header.tsx';
import {ToggleRow} from '../components/toggle-row.tsx';

const DOWNLOAD_DIRECTORY_PREF = 'download.default_directory';

/** Undefined until DownloadsHandler has said; it is not the same as false. */
let snapshot: boolean | undefined;
const listeners = new Set<() => void>();
let started = false;

function subscribe(listener: () => void): () => void {
  if (!started) {
    started = true;
    // Registered before the call that turns the channel on: the handler fires
    // the first update from inside `initializeDownloads` itself.
    addWebUIListener('auto-open-downloads-changed', (...args: unknown[]) => {
      const [value] = args;
      if (typeof value === 'boolean' && value !== snapshot) {
        snapshot = value;
        for (const each of listeners) {
          each();
        }
      }
    });
    send('initializeDownloads');
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): boolean | undefined {
  return snapshot;
}

function DownloadLocationRow() {
  const {pref, enforced, note} = usePrefControl(DOWNLOAD_DIRECTORY_PREF);
  const path = typeof pref?.value === 'string' ? pref.value : undefined;

  return (
    <ControlAnchor id="settings.downloads.location">
      <SettingsListItem
        title={t('settings.downloads.location')}
        description={note}
        value={path}
        showChevron={false}
        rightElement={
          <Button
            variant="secondary"
            size="small"
            disabled={enforced || !pref}
            onPress={() => send('selectDownloadLocation')}
          >
            {t('settings.downloads.location.change')}
          </Button>
        }
      />
    </ControlAnchor>
  );
}

function AutoOpenRow() {
  const hasAutoOpen = useSyncExternalStore(subscribe, getSnapshot);

  return (
    <ControlAnchor id="settings.downloads.autoOpen">
      <SettingsListItem
        title={t('settings.downloads.autoOpen')}
        description={
          hasAutoOpen === undefined
            ? t('settings.downloads.autoOpen.unknown')
            : hasAutoOpen
              ? t('settings.downloads.autoOpen.sublabel')
              : t('settings.downloads.autoOpen.none')
        }
        showChevron={false}
        rightElement={
          <Button
            variant="secondary"
            size="small"
            disabled={hasAutoOpen !== true}
            onPress={() => send('resetAutoOpenFileTypes')}
          >
            {t('settings.downloads.autoOpen.reset')}
          </Button>
        }
      />
    </ControlAnchor>
  );
}

export function DownloadsSection() {
  return (
    <>
      <SectionHeader title="settings.downloads.title" />

      <RowGroup>
        <DownloadLocationRow />
        <ToggleRow
          prefKey="download.prompt_for_download"
          label="settings.downloads.prompt"
          sublabel="settings.downloads.prompt.sublabel"
        />
        <ToggleRow
          prefKey="download_bubble.partial_view_enabled"
          label="settings.downloads.bubble"
          sublabel="settings.downloads.bubble.sublabel"
        />
        <AutoOpenRow />
      </RowGroup>
    </>
  );
}
