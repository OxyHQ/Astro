// A screen that is routed, named and not yet built.
//
// Every screen in Chromium's settings has an entry in this page's registry from
// the moment the registry knows about it, and the ones nobody has written yet
// render this. That is a deliberate choice about what the page is allowed to
// imply: an entry the rail hid until it worked would make Astro's settings look
// finished while most of the browser's own settings were missing from it, and
// would hide the remaining work from whoever picks it up next.
//
// It fabricates no control. A stub that drew a switch wired to nothing would be
// worse than an empty section — the user would set it, believe it, and be
// wrong.

import {SectionCard, t, type MessageId} from '@astro/platform';
import {Text} from '@oxyhq/bloom/typography';

import {SectionHeader, SubpageHeader} from './section-header.tsx';

export interface PendingScreenProps {
  title: MessageId;
  /**
   * Present for a subpage: the fragment and name of the section it sits under,
   * so a pending screen reached by deep link still has a way back.
   */
  backTo?: string;
  backLabel?: MessageId;
}

export function PendingScreen({title, backTo, backLabel}: PendingScreenProps) {
  return (
    <>
      {backTo !== undefined && backLabel !== undefined ? (
        <SubpageHeader title={title} backTo={backTo} backLabel={backLabel} />
      ) : (
        <SectionHeader title={title} />
      )}
      <SectionCard>
        <Text className="text-body text-text-secondary">{t('settings.notBuilt')}</Text>
      </SectionCard>
    </>
  );
}
