// Security.
//
// Upstream's security page is three things: a Safe Browsing radio group, an
// HTTPS-First Mode radio group, and Secure DNS. Astro has two of them.
//
// SAFE BROWSING IS NOT HERE, AND THAT IS THE POINT OF THE CARD AT THE FOOT.
// Astro builds with `safe_browsing_mode = 0` in every file under `gn_args/`,
// and the ungoogled series deletes `generated.safe_browsing`,
// `safebrowsing.enabled`, `safebrowsing.enhanced` and
// `safebrowsing.scout_reporting_enabled` from the settingsPrivate allowlist
// (see the diff on prefs_util.cc). A radio group here would therefore be
// writing to a preference that is invisible to the API and read by no code
// left in the binary -- the exact shape of control this page is not allowed to
// draw. The card says so instead.
//
// HTTPS-First Mode is `generated.https_first_mode_enabled`, a NUMBER, not the
// raw `https_only_mode_enabled` boolean. The generated pref is the only thing
// that can express Balanced mode: it is computed from BOTH
// `kHttpsOnlyModeEnabled` and `kHttpsFirstBalancedMode`
// (chrome/browser/ssl/generated_https_first_mode_pref.cc) and writes both back
// through HttpsFirstModeService. Its values are HttpsFirstModeSetting from
// chrome/browser/ssl/https_first_mode_settings_tracker.h -- 0 disabled, 2 full,
// 3 balanced. 1 is a retired Incognito-only state and is deliberately skipped.
//
// SECURE DNS is half a preference and half a handler. The mode is
// `dns_over_https.mode`, a plain allowlisted STRING whose three values are
// SecureDnsConfig::kModeOff / kModeAutomatic / kModeSecure. The provider list
// is not a preference at all: it is the browser's own filtered DoH provider
// table, which only SecureDnsHandler can produce, and choosing one writes the
// allowlisted `dns_over_https.templates`. The effective configuration is read
// back from the same handler rather than from the two prefs, because the
// browser overrides both when it detects a managed environment or OS parental
// controls -- so the prefs are what you asked for and the handler is what you
// got.

import {RadioIndicator, SettingsListItem} from '@oxyhq/bloom';
import {Text} from '@oxyhq/bloom/typography';
import {useSyncExternalStore} from 'react';
import {View} from 'react-native';

import {
  SectionCard,
  addWebUIListener,
  sendWithPromise,
  setPref,
  t,
  usePref,
} from '@astro/platform';

import {usePrefControl} from '../components/policy.ts';
import {RadioGroup} from '../components/radio-group.tsx';
import {RowGroup} from '../components/row-group.tsx';
import {SearchableLabel} from '../components/searchable-label.tsx';
import {SelectRow} from '../components/select-row.tsx';
import {SubpageHeader} from '../components/section-header.tsx';

const DNS_MODE_PREF = 'dns_over_https.mode';
const DNS_TEMPLATES_PREF = 'dns_over_https.templates';

/** SecureDnsConfig::kModeSecure -- the only mode a provider choice applies to. */
const DNS_MODE_SECURE = 'secure';

/** One entry of the browser's own DoH provider table. */
interface Resolver {
  readonly name: string;
  readonly value: string;
}

/** What SecureDnsHandler reports the browser actually resolved. */
interface EffectiveDns {
  readonly mode: string;
  readonly config: string;
  /** SecureDnsConfig::ManagementMode; anything but 0 means the browser overrode the prefs. */
  readonly managementMode: number;
}

interface DnsState {
  readonly status: 'loading' | 'ready' | 'failed';
  readonly resolvers: readonly Resolver[];
  readonly effective: EffectiveDns | undefined;
  readonly reason: string | undefined;
}

let snapshot: DnsState = {
  status: 'loading',
  resolvers: [],
  effective: undefined,
  reason: undefined,
};
const listeners = new Set<() => void>();
let started = false;

function publish(next: DnsState): void {
  // A new object each time: useSyncExternalStore compares by reference, and
  // mutating the existing snapshot would leave every subscriber convinced
  // nothing had changed.
  snapshot = next;
  for (const listener of listeners) {
    listener();
  }
}

function isResolver(value: unknown): value is Resolver {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as {name?: unknown; value?: unknown};
  return typeof candidate.name === 'string' && typeof candidate.value === 'string';
}

function toEffective(value: unknown): EffectiveDns | undefined {
  if (typeof value !== 'object' || value === null) {
    return undefined;
  }
  const candidate = value as {mode?: unknown; config?: unknown; managementMode?: unknown};
  if (typeof candidate.mode !== 'string' || typeof candidate.config !== 'string') {
    return undefined;
  }
  return {
    mode: candidate.mode,
    config: candidate.config,
    managementMode: typeof candidate.managementMode === 'number' ? candidate.managementMode : 0,
  };
}

function describeError(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason);
}

/**
 * Ask the browser once, then keep listening.
 *
 * Started from `subscribe` rather than from a mount effect, the same shape the
 * pref store uses: the first component to read the value is what makes the
 * request, and a screen nobody opened asks the browser for nothing.
 */
function subscribe(listener: () => void): () => void {
  if (!started) {
    started = true;
    // Registered BEFORE the first read, so an update that lands while the
    // request is in flight is not lost.
    addWebUIListener('secure-dns-setting-changed', (...args: unknown[]) => {
      const effective = toEffective(args[0]);
      if (effective) {
        publish({...snapshot, effective});
      }
    });
    void Promise.all([
      sendWithPromise<unknown>('getSecureDnsResolverList'),
      sendWithPromise<unknown>('getSecureDnsSetting'),
    ]).then(
      ([rawResolvers, rawSetting]) => {
        publish({
          status: 'ready',
          resolvers: Array.isArray(rawResolvers) ? rawResolvers.filter(isResolver) : [],
          effective: toEffective(rawSetting),
          reason: undefined,
        });
      },
      (reason: unknown) => {
        publish({
          status: 'failed',
          resolvers: [],
          effective: undefined,
          reason: describeError(reason),
        });
      },
    );
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): DnsState {
  return snapshot;
}

function useSecureDns(): DnsState {
  return useSyncExternalStore(subscribe, getSnapshot);
}

/**
 * The provider choice.
 *
 * Not a `SelectRow`: its options are message ids resolved at build time, and
 * these are provider names the browser produced at runtime -- and the browser
 * shuffles the list on every call, so there is no stable order to hard-code
 * even if the names were known. The written value is the DoH template string
 * the handler handed over, never one this page composed.
 */
function ResolverChoice({resolvers}: {resolvers: readonly Resolver[]}) {
  const {pref, enforced, note} = usePrefControl(DNS_TEMPLATES_PREF);
  const current = typeof pref?.value === 'string' ? pref.value : '';

  return (
    <View className="gap-2">
      <SearchableLabel id="settings.privacy.security.dns.resolver" note={note} />
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel={t('settings.privacy.security.dns.resolver')}
      >
        {resolvers.map(resolver => (
          <SettingsListItem
            key={resolver.value}
            title={resolver.name}
            accessibilityRole="none"
            disabled={enforced || !pref}
            showChevron={false}
            onPress={() => setPref(DNS_TEMPLATES_PREF, resolver.value)}
            rightElement={<RadioIndicator selected={current === resolver.value} />}
          />
        ))}
      </View>
    </View>
  );
}

function SecureDnsCard() {
  const state = useSecureDns();
  const modePref = usePref(DNS_MODE_PREF);
  const inSecureMode = modePref?.value === DNS_MODE_SECURE;

  return (
    <>
      <RowGroup title="settings.privacy.security.dns">
        <SelectRow
          prefKey={DNS_MODE_PREF}
          label="settings.privacy.security.dns.mode"
          options={[
            {value: 'off', label: 'settings.privacy.security.dns.mode.off'},
            {value: 'automatic', label: 'settings.privacy.security.dns.mode.automatic'},
            {value: 'secure', label: 'settings.privacy.security.dns.mode.secure'},
          ]}
        />
        {state.effective ? (
          <SettingsListItem
            title={t('settings.privacy.security.dns.effective')}
            // The handler's own words for what the browser resolved. A managed
            // environment or OS parental controls turn secure DNS off behind
            // the prefs, and this row is the only place that shows it.
            value={state.effective.config === '' ? state.effective.mode : state.effective.config}
            showChevron={false}
          />
        ) : undefined}
      </RowGroup>

      {state.effective && state.effective.managementMode !== 0 ? (
        <SectionCard description={t('settings.privacy.security.dns.managed')} />
      ) : undefined}

      {inSecureMode ? (
        <SectionCard>
          {state.status === 'loading' ? (
            <Text className="text-body text-text-secondary">
              {t('settings.privacy.security.dns.loading')}
            </Text>
          ) : undefined}
          {state.status === 'failed' ? (
            <Text className="text-body text-text-secondary">
              {t('settings.privacy.security.dns.failed')}
            </Text>
          ) : undefined}
          {state.status === 'ready' ? <ResolverChoice resolvers={state.resolvers} /> : undefined}
          <Text className="text-bodySmall text-text-tertiary">
            {t('settings.privacy.security.dns.customNotOffered')}
          </Text>
        </SectionCard>
      ) : undefined}
    </>
  );
}

export function PrivacySecurityScreen() {
  return (
    <>
      <SubpageHeader
        title="settings.privacy.security.title"
        backTo="/privacy"
        backLabel="settings.nav.privacy"
      />

      <RadioGroup
        prefKey="generated.https_first_mode_enabled"
        label="settings.privacy.security.httpsMode"
        options={[
          {
            value: 2,
            label: 'settings.privacy.security.httpsMode.full',
            description: 'settings.privacy.security.httpsMode.full.description',
          },
          {
            value: 3,
            label: 'settings.privacy.security.httpsMode.balanced',
            description: 'settings.privacy.security.httpsMode.balanced.description',
          },
          {
            value: 0,
            label: 'settings.privacy.security.httpsMode.off',
            description: 'settings.privacy.security.httpsMode.off.description',
          },
        ]}
      />

      <SecureDnsCard />

      <SectionCard
        title={t('settings.privacy.security.safeBrowsing')}
        description={t('settings.privacy.security.safeBrowsing.body')}
      />
    </>
  );
}
