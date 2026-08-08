// Default browser.
//
// No preference at all. Which browser the system opens a link with is the
// system's business, and DefaultBrowserHandler
// (chrome/browser/ui/webui/settings/settings_default_browser_handler.cc) is the
// only way to ask or to change it:
//
//   requestDefaultBrowserState  promise -> {isDefault, canBeDefault,
//                               isUnknownError, isDisabledByPolicy, canPin}
//   setAsDefaultBrowser         fire-and-forget
//   browser-default-state-changed   push, the same dictionary
//
// The push matters more here than on most screens: the state can change while
// this page is open, both because the user accepted the system dialog the
// button raises and because the policy that governs it is watched by the
// handler. Rendering from the answer to the first question alone would leave
// the row saying "not your default" after the user had just made it one.
//
// THE BUTTON IS DISABLED FOR A REASON THAT IS NOT COSMETIC. `SetAsDefaultBrowser`
// opens with `CHECK(!DefaultBrowserIsDisabledByPolicy())`, so sending the
// message on a managed machine takes the browser process down. `canBeDefault`
// is the other refusal -- `shell_integration::CanSetAsDefaultBrowser()` is
// false where the platform or the installation cannot do it -- and there the
// call is merely useless. Both are reported as sentences rather than as a
// greyed-out button with no explanation.
//
// `canPin` is Windows-only (it offers to pin Astro to the taskbar alongside
// making it default) and is not read here: the extra argument
// `setAsDefaultBrowser` takes for it is inside a BUILDFLAG(IS_WIN) block, so
// sending it from a Linux build would be an argument nothing reads.

import {Button, SettingsListItem} from '@oxyhq/bloom';
import {useSyncExternalStore} from 'react';

import {SectionCard, addWebUIListener, send, sendWithPromise, t} from '@astro/platform';

import {ControlAnchor} from '../components/control-anchor.tsx';
import {RowGroup} from '../components/row-group.tsx';
import {SectionHeader} from '../components/section-header.tsx';

interface DefaultBrowserState {
  readonly isDefault: boolean;
  readonly canBeDefault: boolean;
  readonly isUnknownError: boolean;
  readonly isDisabledByPolicy: boolean;
}

interface Snapshot {
  readonly status: 'pending' | 'ready' | 'failed';
  readonly state: DefaultBrowserState | undefined;
  readonly reason: string | undefined;
}

let snapshot: Snapshot = {status: 'pending', state: undefined, reason: undefined};
const listeners = new Set<() => void>();
let started = false;

function publish(next: Snapshot): void {
  snapshot = next;
  for (const listener of listeners) {
    listener();
  }
}

function toState(value: unknown): DefaultBrowserState | undefined {
  if (typeof value !== 'object' || value === null) {
    return undefined;
  }
  const candidate = value as Record<string, unknown>;
  if (typeof candidate['isDefault'] !== 'boolean') {
    return undefined;
  }
  return {
    isDefault: candidate['isDefault'],
    canBeDefault: candidate['canBeDefault'] === true,
    isUnknownError: candidate['isUnknownError'] === true,
    isDisabledByPolicy: candidate['isDisabledByPolicy'] === true,
  };
}

function subscribe(listener: () => void): () => void {
  if (!started) {
    started = true;
    addWebUIListener('browser-default-state-changed', (...args: unknown[]) => {
      const state = toState(args[0]);
      if (state) {
        publish({status: 'ready', state, reason: undefined});
      }
    });
    void sendWithPromise<unknown>('requestDefaultBrowserState').then(
      raw => {
        const state = toState(raw);
        publish(
          state
            ? {status: 'ready', state, reason: undefined}
            : {status: 'failed', state: undefined, reason: 'unrecognised reply'},
        );
      },
      (reason: unknown) => {
        publish({
          status: 'failed',
          state: undefined,
          reason: reason instanceof Error ? reason.message : String(reason),
        });
      },
    );
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): Snapshot {
  return snapshot;
}

function statusText(snapshotValue: Snapshot): string {
  if (snapshotValue.status === 'pending') {
    return t('settings.defaultBrowser.status.pending');
  }
  if (snapshotValue.status === 'failed' || !snapshotValue.state) {
    return t('settings.defaultBrowser.status.failed', {reason: snapshotValue.reason ?? ''});
  }
  if (snapshotValue.state.isDefault) {
    return t('settings.defaultBrowser.status.is');
  }
  if (snapshotValue.state.isUnknownError) {
    return t('settings.defaultBrowser.status.unknown');
  }
  return t('settings.defaultBrowser.status.isNot');
}

export function DefaultBrowserSection() {
  const current = useSyncExternalStore(subscribe, getSnapshot);
  const state = current.state;
  const canAsk = state !== undefined && !state.isDefault && state.canBeDefault && !state.isDisabledByPolicy;

  return (
    <>
      <SectionHeader title="settings.defaultBrowser.title" />

      <RowGroup>
        <ControlAnchor id="settings.defaultBrowser.status">
          <SettingsListItem
            title={t('settings.defaultBrowser.status')}
            description={statusText(current)}
            showChevron={false}
          />
        </ControlAnchor>
        <ControlAnchor id="settings.defaultBrowser.make">
          <SettingsListItem
            title={t('settings.defaultBrowser.make')}
            description={t('settings.defaultBrowser.make.sublabel')}
            showChevron={false}
            rightElement={
              <Button
                variant="secondary"
                size="small"
                disabled={!canAsk}
                onPress={() => send('setAsDefaultBrowser')}
              >
                {t('settings.defaultBrowser.make.button')}
              </Button>
            }
          />
        </ControlAnchor>
      </RowGroup>

      {state?.isDisabledByPolicy === true ? (
        <SectionCard description={t('settings.defaultBrowser.status.managed')} />
      ) : undefined}
      {state !== undefined && !state.canBeDefault && !state.isDisabledByPolicy ? (
        <SectionCard description={t('settings.defaultBrowser.status.cannot')} />
      ) : undefined}
    </>
  );
}
