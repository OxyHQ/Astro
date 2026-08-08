// One content-setting type, whichever one the fragment names.
//
// The single screen behind 48 of upstream's routes. It reads the type back out
// of the fragment rather than taking it as a prop, because the registry's other
// screens take no props either -- the router's job is to pick a component, and
// giving one of them a parameter would put route parsing in the registry for
// the sake of a single entry.
//
// The type is the segment straight after `/content/`, NOT the last segment of
// the path: the router picks this screen by longest prefix, so `/content/camera`
// and anything below it both land here, and reading the last segment would make
// `/content/camera/anything` fail to find a type it plainly has.
//
// The fallback is not a default. The registry only routes fragments built from
// this same table, so reaching it means the registry and the table disagree --
// which is worth saying rather than papering over by rendering the first type in
// the list, a screen that would be editing a permission nobody asked for.
//
// A content setting is NOT a pref, and this is the whole reason the screen has
// its own store rather than using `usePref`. The default behaviour of a
// permission lives in `HostContentSettingsMap`, which `chrome.settingsPrivate`
// cannot see at all; it is reached through `SiteSettingsHandler`
// (chrome/browser/ui/webui/settings/site_settings_handler.cc):
//
//   getDefaultValueForContentType  2 args (callback id, group name) -> {setting, source?}
//   setDefaultValueForContentType  2 args (group name, ContentSetting)
//
// and the handler pushes `contentSettingCategoryChanged` with the group name
// whenever a default moves -- including when ANOTHER settings tab moves it,
// which is why the screen renders from that echo rather than from the value it
// just wrote.

import {RadioIndicator, SettingsListItem} from '@oxyhq/bloom';
import {Text} from '@oxyhq/bloom/typography';
import {useCallback, useSyncExternalStore} from 'react';
import {View} from 'react-native';

import {addWebUIListener, SectionCard, send, sendWithPromise, t, useHashPath} from '@astro/platform';

import {PendingScreen} from '../components/pending-screen.tsx';
import {SearchableLabel} from '../components/searchable-label.tsx';
import {SubpageHeader} from '../components/section-header.tsx';
import {contentTypeForSegment, type ContentTypeDef} from './site-settings.content-types.ts';

const PREFIX = '/content/';

/** `ContentSetting`, as the handler spells the three values this screen writes. */
const ALLOW = 'allow';
const ASK = 'ask';
const BLOCK = 'block';

/**
 * The provider that supplied the default, when it was not the user.
 *
 * `source` is absent entirely when the value came from the default provider,
 * and reads `preference` when the user set it. Anything else -- `policy`,
 * `supervised_user`, `extension` -- means the control must refuse input, which
 * is the same rule upstream's own radio group applies.
 */
const USER_SOURCE = 'preference';

interface DefaultSetting {
  /** One of `allow`, `ask`, `block`, `session_only`. */
  readonly setting: string;
  readonly source: string | undefined;
}

function parse(reply: unknown): DefaultSetting | undefined {
  if (typeof reply !== 'object' || reply === null) {
    return undefined;
  }
  const record: Record<string, unknown> = {...reply};
  const setting = record['setting'];
  const source = record['source'];
  if (typeof setting !== 'string') {
    return undefined;
  }
  return {setting, source: typeof source === 'string' ? source : undefined};
}

// The defaults, as an external store keyed by group name.
//
// Same shape as `platform/browser/pref-store.ts`: `subscribe` is where the
// first read for a key is started and where the push listener is registered, so
// no mount effect is needed -- React calls it itself, and a key that nothing is
// rendering is never fetched. The snapshot is replaced rather than mutated,
// because useSyncExternalStore compares by reference.
let snapshot: ReadonlyMap<string, DefaultSetting> = new Map();
const listeners = new Set<() => void>();
const requested = new Set<string>();
let listening = false;

function publish(contentType: string, value: DefaultSetting | undefined): void {
  if (!value) {
    return;
  }
  const next = new Map(snapshot);
  next.set(contentType, value);
  snapshot = next;
  for (const listener of listeners) {
    listener();
  }
}

function load(contentType: string): void {
  void sendWithPromise<unknown>('getDefaultValueForContentType', contentType).then(reply =>
    publish(contentType, parse(reply)),
  );
}

function subscribeTo(contentType: string, listener: () => void): () => void {
  if (!listening) {
    listening = true;
    // The handler pushes the group NAME, not the value, so a change is a cue to
    // re-read. Only types this page has already asked for are re-read: the
    // event fires for every category the browser changes, and answering for one
    // nothing is rendering would be a round trip for nobody.
    addWebUIListener('contentSettingCategoryChanged', (changed: unknown) => {
      if (typeof changed === 'string' && requested.has(changed)) {
        load(changed);
      }
    });
  }
  if (!requested.has(contentType)) {
    requested.add(contentType);
    load(contentType);
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function useDefaultSetting(contentType: string): DefaultSetting | undefined {
  const subscribe = useCallback(
    (listener: () => void) => subscribeTo(contentType, listener),
    [contentType],
  );
  return useSyncExternalStore(subscribe, () => snapshot.get(contentType));
}

/**
 * The two-way default control.
 *
 * Upstream words the two options per category -- "Sites can ask to use your
 * camera", "Sites can send notifications" -- which is forty pairs of sentences.
 * This page words them once, because the permission is already named by the
 * heading directly above and a second naming of it in every option adds a
 * translation unit per permission for no information.
 *
 * It is hand-rolled rather than built from `components/radio-group.tsx` because
 * that component binds a PREF, and a content setting is not one. The markup is
 * deliberately the same so the two read identically to a screen reader.
 */
function DefaultBehaviour({type}: {type: ContentTypeDef & {contentType: string}}) {
  const current = useDefaultSetting(type.contentType);
  const enforced = current?.source !== undefined && current.source !== USER_SOURCE;
  const enabledValue = type.defaultBehaviour === 'allow' ? ALLOW : ASK;

  if (!current) {
    return (
      <SectionCard>
        <Text className="text-body text-text-secondary">
          {t('settings.siteSettings.default.pending')}
        </Text>
      </SectionCard>
    );
  }

  // `session_only` is a fourth value some categories can hold, and it is not
  // BLOCK, so it selects the enabled option -- the same collapse upstream makes.
  const enabled = current.setting !== BLOCK;

  const write = (value: string): void => {
    send('setDefaultValueForContentType', type.contentType, value);
  };

  return (
    <View className="gap-2">
      <SearchableLabel
        id="settings.siteSettings.default"
        note={
          enforced
            ? t('pref.enforced')
            : t('settings.siteSettings.default.description')
        }
      />
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel={t('settings.siteSettings.default')}
      >
        <SettingsListItem
          title={
            type.defaultBehaviour === 'allow'
              ? t('settings.siteSettings.default.allow')
              : t('settings.siteSettings.default.ask')
          }
          description={
            type.defaultBehaviour === 'allow'
              ? t('settings.siteSettings.default.allow.description')
              : t('settings.siteSettings.default.ask.description')
          }
          accessibilityRole="none"
          disabled={enforced}
          showChevron={false}
          onPress={() => write(enabledValue)}
          rightElement={<RadioIndicator selected={enabled} />}
        />
        <SettingsListItem
          title={t('settings.siteSettings.default.block')}
          description={t('settings.siteSettings.default.block.description')}
          accessibilityRole="none"
          disabled={enforced}
          showChevron={false}
          onPress={() => write(BLOCK)}
          rightElement={<RadioIndicator selected={!enabled} />}
        />
      </View>
    </View>
  );
}

export function SiteSettingsDetailScreen() {
  const path = useHashPath();
  const rest = path.startsWith(PREFIX) ? path.slice(PREFIX.length) : '';
  const cut = rest.indexOf('/');
  const type = contentTypeForSegment(cut === -1 ? rest : rest.slice(0, cut));

  if (!type) {
    return (
      <>
        <SubpageHeader
          title="settings.siteSettings.title"
          backTo="/content"
          backLabel="settings.nav.siteSettings"
        />
        <SectionCard>
          <Text className="text-body text-text-secondary">
            {t('settings.siteSettings.unknownType', {path})}
          </Text>
        </SectionCard>
      </>
    );
  }

  // Eight of the forty-eight are a different screen upstream -- an exception
  // list, a three-way pref, a page of their own, or nothing at all -- and none
  // of them has a default behaviour to offer. A two-way control invented for
  // them would write a value the browser does not read.
  if (type.contentType === undefined || type.defaultBehaviour === undefined) {
    return (
      <PendingScreen title={type.title} backTo="/content" backLabel="settings.nav.siteSettings" />
    );
  }

  return (
    <>
      <SubpageHeader
        title={type.title}
        backTo="/content"
        backLabel="settings.nav.siteSettings"
      />

      <SectionCard>
        <DefaultBehaviour type={{...type, contentType: type.contentType}} />
      </SectionCard>

      <SectionCard title={t('settings.siteSettings.exceptions')}>
        <Text className="text-body text-text-secondary">
          {t('settings.siteSettings.exceptions.body')}
        </Text>
      </SectionCard>
    </>
  );
}
