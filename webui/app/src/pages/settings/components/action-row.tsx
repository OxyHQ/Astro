// A row whose right-hand side is a button.
//
// For the things that are not a preference at all: clear browsing data, make
// Astro the default browser, import from another browser, reset settings. Every
// one of those lives in a C++ `WebUIMessageHandler` and is reached with
// `send` / `sendWithPromise`, so this row deliberately knows nothing about
// prefs — it takes a handler the section supplies.
//
// `destructive` is the visual half of a decision the section still has to make:
// upstream puts a confirmation dialog in front of every irreversible one, and a
// red button on its own is not that dialog.

import {Button, SettingsListItem} from '@oxyhq/bloom';

import {t, type MessageId} from '@astro/platform';

import {ControlAnchor} from './control-anchor.tsx';

export interface ActionRowProps {
  label: MessageId;
  sublabel?: MessageId;
  /** The button's own text. Distinct from the row label: "Reset" under "Reset settings". */
  actionLabel: MessageId;
  onPress: () => void;
  disabled?: boolean;
  /** Red button, for an action that destroys something. */
  destructive?: boolean;
}

export function ActionRow({
  label,
  sublabel,
  actionLabel,
  onPress,
  disabled,
  destructive,
}: ActionRowProps) {
  return (
    <ControlAnchor id={label}>
      <SettingsListItem
        title={t(label)}
        description={sublabel ? t(sublabel) : undefined}
        showChevron={false}
        rightElement={
          <Button
            variant={destructive ? 'destructive' : 'secondary'}
            size="small"
            disabled={disabled}
            onPress={onPress}
          >
            {t(actionLabel)}
          </Button>
        }
      />
    </ControlAnchor>
  );
}
