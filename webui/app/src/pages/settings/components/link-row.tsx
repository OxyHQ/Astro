// A row that goes somewhere.
//
// Two destinations, and no third. `to` is a fragment inside this page — a
// subpage of the section the row is in — and moves the hash, so Back returns.
// `route` is another Astro page entirely (`astro://alia`), and leaves; it is
// named from the route table rather than built from a scheme and a host,
// because a page that concatenates its own URLs is how a link comes to point
// at `chrome://` after the scheme rename.
//
// There is deliberately no "open this http:// address" variant. A WebUI page
// cannot navigate the tab to the web itself — the browser's own settings asks a
// C++ handler to do it — so offering one here would be a row that looks live
// and does nothing until that handler exists.

import {SettingsListItem} from '@oxyhq/bloom';

import {navigateTo, setHashPath, t, type MessageId, type RouteId} from '@astro/platform';

export type LinkRowProps = {
  label: MessageId;
  sublabel?: MessageId;
  /** The current value, shown at the right ("English", "3 sites"). */
  value?: string;
} & ({to: string; route?: never} | {route: RouteId; to?: never});

// Not destructured: `to` and `route` are the two arms of a union, and TypeScript
// narrows the union on the object, not on variables pulled out of it.
export function LinkRow(props: LinkRowProps) {
  return (
    <SettingsListItem
      title={t(props.label)}
      description={props.sublabel ? t(props.sublabel) : undefined}
      value={props.value}
      accessibilityRole="link"
      onPress={() => {
        if (props.to === undefined) {
          navigateTo(props.route);
        } else {
          setHashPath(props.to);
        }
      }}
    />
  );
}
