// Safety check.
//
// Upstream's Safety Hub is five cards: Safe Browsing, saved passwords,
// extensions that need review, the browser version, and the permissions the
// browser withdrew from sites you stopped visiting. Two of those are honest to
// draw in Astro and three are not, so this screen draws two and says why the
// rest are missing rather than leaving a user to conclude the check found
// nothing.
//
// The two it draws come from SafetyHubHandler
// (chrome/browser/ui/webui/settings/safety_hub_handler.cc), which Astro
// inherits intact apart from an Enhanced-Safe-Browsing promo the ungoogled
// series empties out:
//
//   getVersionCardData                    promise -> {header, subheader, state}
//   getRevokedUnusedSitePermissionsList   promise -> [{origin, ...}]
//   allowPermissionsAgainForUnusedSite    (origin). Fire-and-forget.
//
// `getSafeBrowsingCardData` is registered and would answer, but it answers
// about a feature compiled out of this browser, so its card would report the
// state of nothing. `getPasswordCardData` and
// `getNumberOfExtensionsThatNeedReview` are real and need surfaces -- the
// password manager and the extensions page -- that this app does not have yet;
// a card that names a problem with no way to reach it is worse than a card that
// admits it is not looking.
//
// Regranting is a one-way row on purpose. The handler has an
// `undoAllowPermissionsAgainForUnusedSite`, but it takes back the whole
// permissions dictionary the row was built from rather than the origin, so an
// undo has to hold that dictionary; the row is not important enough to carry
// the state, and re-revoking is what the site permission screens are for.

import {Button, SettingsListItem} from '@oxyhq/bloom';
import {useSyncExternalStore} from 'react';

import {SectionCard, send, sendWithPromise, t} from '@astro/platform';

import {RowGroup} from '../components/row-group.tsx';
import {SubpageHeader} from '../components/section-header.tsx';

/** The version card, in the browser's own words. */
interface VersionCard {
  readonly header: string;
  readonly subheader: string;
}

interface HubState {
  readonly status: 'loading' | 'ready' | 'failed';
  readonly version: VersionCard | undefined;
  readonly origins: readonly string[];
  readonly reason: string | undefined;
}

let snapshot: HubState = {status: 'loading', version: undefined, origins: [], reason: undefined};
const listeners = new Set<() => void>();
let started = false;

function publish(next: HubState): void {
  snapshot = next;
  for (const listener of listeners) {
    listener();
  }
}

function toVersionCard(value: unknown): VersionCard | undefined {
  if (typeof value !== 'object' || value === null) {
    return undefined;
  }
  const candidate = value as {header?: unknown; subheader?: unknown};
  if (typeof candidate.header !== 'string' || typeof candidate.subheader !== 'string') {
    return undefined;
  }
  return {header: candidate.header, subheader: candidate.subheader};
}

/**
 * The origin of one revoked-permission entry.
 *
 * The handler sets it from `primary_pattern.ToString()`, so it is a content
 * settings PATTERN rather than a URL. It is displayed as it arrives and handed
 * back unchanged; rewriting it into something prettier is how the regrant comes
 * to name a site the browser has no record of.
 */
function originOf(value: unknown): string | undefined {
  if (typeof value !== 'object' || value === null) {
    return undefined;
  }
  const candidate = value as {origin?: unknown};
  return typeof candidate.origin === 'string' ? candidate.origin : undefined;
}

function load(): void {
  void Promise.all([
    sendWithPromise<unknown>('getVersionCardData'),
    sendWithPromise<unknown>('getRevokedUnusedSitePermissionsList'),
  ]).then(
    ([rawVersion, rawSites]) => {
      publish({
        status: 'ready',
        version: toVersionCard(rawVersion),
        origins: Array.isArray(rawSites)
          ? rawSites.map(originOf).filter((origin): origin is string => origin !== undefined)
          : [],
        reason: undefined,
      });
    },
    (reason: unknown) => {
      publish({
        status: 'failed',
        version: undefined,
        origins: [],
        reason: reason instanceof Error ? reason.message : String(reason),
      });
    },
  );
}

function subscribe(listener: () => void): () => void {
  if (!started) {
    started = true;
    load();
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): HubState {
  return snapshot;
}

export function PrivacySafetyHubScreen() {
  const state = useSyncExternalStore(subscribe, getSnapshot);

  const allowAgain = (origin: string): void => {
    send('allowPermissionsAgainForUnusedSite', origin);
    // The handler pushes its own refreshed list to upstream's page over a
    // listener this screen does not subscribe to, so the list is re-read
    // rather than edited locally -- the browser stays the one source.
    load();
  };

  return (
    <>
      <SubpageHeader
        title="settings.privacy.safetyHub.title"
        backTo="/privacy"
        backLabel="settings.nav.privacy"
      />

      {state.status === 'failed' ? (
        <SectionCard
          description={t('settings.privacy.safetyHub.failed', {reason: state.reason ?? ''})}
        />
      ) : undefined}

      {state.version ? (
        <RowGroup title="settings.privacy.safetyHub.version">
          <SettingsListItem
            title={state.version.header}
            description={state.version.subheader}
            showChevron={false}
          />
        </RowGroup>
      ) : undefined}

      <RowGroup
        title="settings.privacy.safetyHub.unusedSites"
        footer={
          state.status === 'ready' && state.origins.length === 0
            ? 'settings.privacy.safetyHub.unusedSites.empty'
            : undefined
        }
      >
        {state.origins.map(origin => (
          <SettingsListItem
            key={origin}
            title={origin}
            showChevron={false}
            rightElement={
              <Button variant="secondary" size="small" onPress={() => allowAgain(origin)}>
                {t('settings.privacy.safetyHub.unusedSites.allow')}
              </Button>
            }
          />
        ))}
      </RowGroup>

      <SectionCard
        title={t('settings.privacy.safetyHub.missing')}
        description={t('settings.privacy.safetyHub.missing.body')}
      />
    </>
  );
}
