// Astro's settings page.
//
// Nothing of Chromium's settings UI is reused. What IS reused is the API
// underneath it -- chrome.settingsPrivate -- which is what actually controls
// the browser: prefs.ts reads and writes it, pref-store.ts makes it a store the
// UI can subscribe to, and every control here is rendered FROM a pref rather
// than from a hand-written table. That is the difference that matters: the page
// this replaces mapped 41 prefs by hand, out of the 157 the browser has.

import {useMemo, useState, useSyncExternalStore} from 'react';
import {ScrollView} from 'react-native';

import {Search} from '@oxyhq/bloom/search';
import {SettingsListGroup} from '@oxyhq/bloom';

import {Shell} from '../../shell/shell.tsx';
import {DownloadsSection} from './sections/downloads.tsx';
import {labelFor, SECTIONS, sectionFor, type Section} from './catalog.ts';
import {getSnapshot, subscribe} from './pref-store.ts';
import {PrefControl} from './pref-control.tsx';
import type {Pref} from './prefs.ts';

// Sections with a screen of their own.
//
// A section is generic UNTIL it needs something prefs cannot express -- a
// native picker, a handler-backed list, a dialog. Then it gets a component
// here and the generic renderer steps aside for it. Every remaining section in
// docs/astro-next/baseline/settings-parity.md arrives this way.
const CUSTOM: Record<string, (props: {prefs: ReadonlyMap<string, Pref>}) =>
    React.JSX.Element> = {
  downloads: DownloadsSection,
};

/** Every pref the browser has, keyed, live. */
function usePrefs(): ReadonlyMap<string, Pref> {
  return useSyncExternalStore(subscribe, getSnapshot);
}

function SectionView({section, prefs, query}: {
  section: Section,
  prefs: ReadonlyMap<string, Pref>,
  query: string,
}) {
  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return [...prefs.values()]
        .filter(pref => sectionFor(pref.key)?.id === section.id)
        .filter(pref => !needle ||
            labelFor(pref.key).toLowerCase().includes(needle) ||
            pref.key.toLowerCase().includes(needle))
        .sort((a, b) => labelFor(a.key).localeCompare(labelFor(b.key)));
  }, [prefs, section.id, query]);

  if (rows.length === 0) {
    return null;
  }

  return (
    <SettingsListGroup title={section.title}>
      {rows.map(pref => <PrefControl key={pref.key} pref={pref} />)}
    </SettingsListGroup>
  );
}

export function SettingsPage() {
  const prefs = usePrefs();
  const [selected, setSelected] = useState<string>(SECTIONS[0]!.id);
  const [query, setQuery] = useState('');

  // Searching spans the whole browser, not the section on screen: someone
  // looking for a setting does not know which section it was filed under.
  const searching = query.trim().length > 0;
  const shown = searching ? SECTIONS : SECTIONS.filter(s => s.id === selected);
  const Custom = CUSTOM[selected];

  return (
    <Shell
      title="Settings"
      groups={[{entries: SECTIONS.map(s => ({id: s.id, title: s.title}))}]}
      selected={selected}
      onSelect={id => {
        setQuery('');
        setSelected(id);
      }}
    >
      {Custom && !searching ? <Custom prefs={prefs} /> : (
      <ScrollView className="flex-1" contentContainerClassName="p-4 gap-4">
        <Search
          value={query}
          placeholder="Search settings"
          onChangeText={setQuery}
          onClearText={() => setQuery('')}
        />
        {shown.map(section => (
          <SectionView
            key={section.id}
            section={section}
            prefs={prefs}
            query={query}
          />
        ))}
      </ScrollView>
      )}
    </Shell>
  );
}
