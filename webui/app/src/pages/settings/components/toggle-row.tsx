// One boolean pref, as a row with a switch.
//
// The most common control on the page, and the reason `policy.ts` exists: the
// row locks its switch and names what locked it when a policy has ENFORCED the
// value, and stays usable while saying what is recommended when a policy only
// RECOMMENDS one. A row rendered from a hand-kept table instead accepts the tap
// and quietly does nothing, which is how a managed browser comes to look
// broken.
//
// Nothing is applied locally. The switch shows the pref the browser reported;
// the write goes out and the browser's echo is what moves it. A local guess
// would show the new position on a pref the browser refused.

import {SettingsListItem, Switch} from '@oxyhq/bloom';

import {setPref, t, type MessageId} from '@astro/platform';

import {ControlAnchor} from './control-anchor.tsx';
import {usePrefControl} from './policy.ts';

export interface ToggleRowProps {
  /** The Chromium pref path. Must be one settingsPrivate's allowlist carries. */
  prefKey: string;
  label: MessageId;
  /** Extra explanation, shown when no policy note has claimed the line. */
  sublabel?: MessageId;
}

export function ToggleRow({prefKey, label, sublabel}: ToggleRowProps) {
  const {pref, enforced, note} = usePrefControl(prefKey);

  if (!pref) {
    return (
      <ControlAnchor id={label}>
        <SettingsListItem title={t(label)} description={note} disabled showChevron={false} />
      </ControlAnchor>
    );
  }

  return (
    <ControlAnchor id={label}>
      <SettingsListItem
        title={t(label)}
        // The policy note wins the description line: why the control is locked
        // matters more than what the setting does, and only one line is on offer.
        description={note ?? (sublabel ? t(sublabel) : undefined)}
        disabled={enforced}
        showChevron={false}
        rightElement={
          <Switch
            value={pref.value === true}
            disabled={enforced}
            onValueChange={(next: boolean) => setPref(prefKey, next)}
          />
        }
      />
    </ControlAnchor>
  );
}
