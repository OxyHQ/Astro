// Downloads.
//
// The first section that is NOT just preferences, and the reason the handler
// bridge exists. Two of the four controls here have no pref behind them:
//
//   * "Ask where to save each file" and the download folder ARE prefs.
//   * Choosing the folder opens a native directory picker, which only
//     DownloadsHandler can do (`selectDownloadLocation`).
//   * The list of file types that open automatically is not a pref the page
//     can read either -- the handler pushes whether the list is non-empty
//     through the `auto-open-downloads-changed` WebUI listener, and clears it
//     with `resetAutoOpenFileTypes`.
//
// Astro's page inherits DownloadsHandler by deriving from
// settings::SettingsUI, so this is upstream's own browser control with Astro's
// UI in front of it -- not a reimplementation.

import {useEffect, useState} from 'react';
import {ScrollView} from 'react-native';

import {Button, SettingsListGroup, SettingsListItem} from '@oxyhq/bloom';

import {addWebUIListener, send} from '../../../lib/webui-bridge.ts';
import {PrefControl} from '../pref-control.tsx';
import type {Pref} from '../prefs.ts';

const PREFS = [
  'download.default_directory',
  'download.prompt_for_download',
  'download.bubble_partial_view_enabled',
];

export function DownloadsSection({prefs}: {prefs: ReadonlyMap<string, Pref>}) {
  const [hasAutoOpen, setHasAutoOpen] = useState(false);

  useEffect(() => {
    // Subscribe BEFORE initializing: the handler fires the listener from
    // inside its initialize message, so registering afterwards would miss the
    // first value and the button would stay hidden until something else
    // changed.
    const stop = addWebUIListener('auto-open-downloads-changed',
                                  value => setHasAutoOpen(value === true));
    send('initializeDownloads');
    return stop;
  }, []);

  return (
    <ScrollView className="flex-1" contentContainerClassName="p-4 gap-4">
      <SettingsListGroup title="Downloads">
        {PREFS.map(key => {
          const pref = prefs.get(key);
          return pref ? <PrefControl key={key} pref={pref} /> : null;
        })}
        <SettingsListItem
          title="Download location"
          description="Choose the folder new downloads are saved to"
          onPress={() => send('selectDownloadLocation')}
        />
      </SettingsListGroup>

      {hasAutoOpen ? (
        <SettingsListGroup
          title="Automatic opening"
          footer="Some file types open automatically after downloading."
        >
          <SettingsListItem
            title="Clear the list of file types that open automatically"
            showChevron={false}
            rightElement={
              <Button variant="secondary" size="small"
                      onPress={() => send('resetAutoOpenFileTypes')}>
                Clear
              </Button>
            }
          />
        </SettingsListGroup>
      ) : null}
    </ScrollView>
  );
}
