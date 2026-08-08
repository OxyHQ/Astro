// astro://settings.
//
// The first page of the app, and the one the rest are shaped by: a rail of
// sections, one section rendered at a time, everything it shows coming from
// the browser rather than from page state. Two sections here, both real --
// Appearance drives the live theme end to end, Privacy drives four Chromium
// prefs including one a policy has locked.

import {useState} from 'react';

import {PageShell, t, type NavGroup} from '@astro/platform';

import {AppearanceSection} from './sections/appearance.tsx';
import {PrivacySection} from './sections/privacy.tsx';

const SECTIONS = {
  appearance: AppearanceSection,
  privacy: PrivacySection,
} as const;

type SectionId = keyof typeof SECTIONS;

const NAV: readonly NavGroup<SectionId>[] = [
  {
    entries: [
      {id: 'appearance', title: t('settings.nav.appearance')},
      {id: 'privacy', title: t('settings.nav.privacy')},
    ],
  },
];

export function SettingsPage() {
  const [selected, setSelected] = useState<SectionId>('appearance');
  const Section = SECTIONS[selected];

  return (
    <PageShell title={t('settings.title')} groups={NAV} selected={selected} onSelect={setSelected}>
      <Section />
    </PageShell>
  );
}
