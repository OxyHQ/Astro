// A run of rows, as one card.
//
// Bloom's `SettingsListGroup` already draws the card and the separators; this
// wrapper exists so a section never imports Bloom directly for the commonest
// thing it does, and so the group's optional heading and footer are taken as
// message ids like every other string on the page.
//
// A footer is where upstream puts the sentence that qualifies a whole run of
// rows ("Astro may use a web service to help resolve navigation errors"), and
// it belongs to the group rather than to the last row in it.

import {SettingsListGroup} from '@oxyhq/bloom';
import type {ReactNode} from 'react';

import {t, type MessageId} from '@astro/platform';

import {ControlAnchor} from './control-anchor.tsx';

export interface RowGroupProps {
  title?: MessageId;
  footer?: MessageId;
  children: ReactNode;
}

export function RowGroup({title, footer, children}: RowGroupProps) {
  const group = (
    <SettingsListGroup title={title ? t(title) : undefined} footer={footer ? t(footer) : undefined}>
      {children}
    </SettingsListGroup>
  );
  // A heading is a legitimate thing to search for, and for some runs of rows it
  // is the ONLY name the whole run has -- the startup pages, the site-search
  // engines. A section that declares its heading as a control gets the group
  // revealed; one that does not is unaffected, since the anchor only acts on a
  // request naming it.
  return title ? <ControlAnchor id={title}>{group}</ControlAnchor> : group;
}
