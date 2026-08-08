// A row that only reports.
//
// The version string, a channel name, a device count, the amount of data a
// site is holding. Nothing here is editable, which is exactly why the row
// exists: rendering read-only information as a disabled control implies the
// user could change it somewhere else, and rendering it as body text loses the
// alignment that makes a column of facts scannable.
//
// `value` is a string rather than a message id: what it reports comes from the
// browser at runtime — a version, a count, a size — and is not translatable
// text this app owns.

import {SettingsListItem} from '@oxyhq/bloom';

import {t, type MessageId} from '@astro/platform';

export interface InfoRowProps {
  label: MessageId;
  /** What the browser reported. Undefined while it has not answered yet. */
  value?: string;
  sublabel?: MessageId;
}

export function InfoRow({label, value, sublabel}: InfoRowProps) {
  return (
    <SettingsListItem
      title={t(label)}
      description={sublabel ? t(sublabel) : undefined}
      // An unanswered value says so. A blank right-hand side reads as a fact
      // whose value happens to be empty.
      value={value ?? t('pref.pending')}
      showChevron={false}
    />
  );
}
