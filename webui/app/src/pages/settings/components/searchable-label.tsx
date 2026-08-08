// The label of a control that is not a row.
//
// Rows take their title as a `MessageId` and render it themselves. Everything
// else — a segmented control, a colour grid, a radio group, a slider — needs a
// label above it, and this is the one component that draws one.
//
// It takes the message ID rather than the string because the page's search
// index is built from message IDs: a section declares the controls it renders
// in its own `*.strings.ts`, and the field finds a setting by matching those.
// A label rendered from a literal would be findable only by accident, and a
// label rendered from a different id than the section declared would make the
// field promise a control the page does not draw. Passing the id through is
// what keeps the two the same value.

import {Text} from '@oxyhq/bloom/typography';
import {View} from 'react-native';

import {t, type MessageId} from '@astro/platform';

import {ControlAnchor} from './control-anchor.tsx';

export interface SearchableLabelProps {
  id: MessageId;
  /**
   * The sentence under the label — an explanation, or the policy note a
   * pref-bound control produced. Rendered in the same muted style either way.
   */
  note?: string;
  /** Option names inside the control, which reveal the control itself. */
  also?: readonly MessageId[];
}

export function SearchableLabel({id, note, also}: SearchableLabelProps) {
  return (
    <ControlAnchor id={id} also={also}>
      <View className="gap-1">
        <Text className="text-bodyTitleSmall text-foreground">{t(id)}</Text>
        {note ? <Text className="text-bodySmall text-text-secondary">{note}</Text> : undefined}
      </View>
    </ControlAnchor>
  );
}
