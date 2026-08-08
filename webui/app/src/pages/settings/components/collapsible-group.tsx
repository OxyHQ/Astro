// A run of rows that starts folded away.
//
// Upstream calls this "Advanced" and puts it at the foot of a section: the
// controls almost nobody needs, kept reachable without making the section look
// like a wall. Use it for that, and not as a way to make a long section short —
// a setting a user cannot see is a setting they cannot find, and the page's
// search field indexes what a section DECLARES it renders, folded or not.

import {Collapsible} from '@oxyhq/bloom';
import type {ReactNode} from 'react';
import {View} from 'react-native';

import {t, type MessageId} from '@astro/platform';

export interface CollapsibleGroupProps {
  title: MessageId;
  /** Open on arrival. Off by default: the point of the group is that it is folded. */
  defaultOpen?: boolean;
  children: ReactNode;
}

export function CollapsibleGroup({title, defaultOpen, children}: CollapsibleGroupProps) {
  return (
    <Collapsible title={t(title)} defaultOpen={defaultOpen}>
      <View className="gap-3 pt-2">{children}</View>
    </Collapsible>
  );
}
