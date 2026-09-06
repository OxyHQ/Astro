// A run of rows that starts folded away.
//
// Upstream calls this "Advanced" and puts it at the foot of a section: the
// controls almost nobody needs, kept reachable without making the section look
// like a wall. Use it for that, and not as a way to make a long section short —
// a setting a user cannot see is a setting they cannot find, and the page's
// search field indexes what a section DECLARES it renders, folded or not.

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@oxyhq/bloom/accordion';
import {useState, type ReactNode} from 'react';
import {View} from 'react-native';

import {t, type MessageId} from '@astro/platform';

import {ControlAnchor} from './control-anchor.tsx';

export interface CollapsibleGroupProps {
  title: MessageId;
  /** Open on arrival. Off by default: the point of the group is that it is folded. */
  defaultOpen?: boolean;
  children: ReactNode;
}

// Bloom's accordion is controlled and addresses its rows by value, so a group
// of one still needs a name for its single row and a place to keep whether it
// is open. `defaultOpen` seeds that state; nothing else reads the name.
const GROUP_ROW = 'group';

export function CollapsibleGroup({title, defaultOpen, children}: CollapsibleGroupProps) {
  const [open, setOpen] = useState<string | string[] | undefined>(
    defaultOpen ? GROUP_ROW : undefined,
  );

  return (
    <ControlAnchor id={title}>
      <Accordion type="single" value={open} onValueChange={setOpen}>
        <AccordionItem value={GROUP_ROW}>
          <AccordionTrigger>{t(title)}</AccordionTrigger>
          <AccordionContent>
            <View className="gap-3 pt-2">{children}</View>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </ControlAnchor>
  );
}
