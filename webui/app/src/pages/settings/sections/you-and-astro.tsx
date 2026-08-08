// You and Astro.
//
// Astro's own section, with no upstream counterpart. It is where identity
// lives, and the registry routes upstream's `/people`, `/account`, `/signOut`
// and `/manageProfile` fragments here, because those are Google-account
// screens Astro replaces rather than reimplements.
//
// THE OXY ACCOUNT HAS NO TRANSPORT, AND THIS SCREEN DOES NOT PRETEND OTHERWISE.
// There is no C++ service in `src/chrome/browser/oxy/` that this page can ask
// who is signed in, no Mojo interface to it, and no handler message that would
// answer -- and a message no handler registered is not a quiet failure but a
// CHECK that takes the renderer down. So the account card is a SENTENCE, not a
// control. No sign-in button, no signed-out avatar, no "not signed in" row
// with an action beside it: every one of those would be a control wired to
// nothing, which is the one thing a settings page must never draw. When the
// transport lands, the card is where the real state goes.
//
// Oxy Sync is issue #23 and is deliberately out of scope here.
//
// What IS real on this screen is the local Chromium profile, and it is worth
// keeping separate in the user's mind from an account: ProfileInfoHandler
// answers `getProfileInfo` with `{name, iconUrl}` and pushes
// `profile-info-changed`, and ManageProfileHandler takes `setProfileName`.
// Both are registered by settings_ui.cc and both work today.
//
// `setProfileName` opens with `CHECK(!new_profile_name.empty())` AFTER
// trimming whitespace, so sending a blank or space-only name crashes the
// browser process. The button below is disabled on exactly that input; the
// guard is not politeness.

import {Button, TextField, TextFieldInput} from '@oxyhq/bloom';
import {Text} from '@oxyhq/bloom/typography';
import {useState, useSyncExternalStore} from 'react';
import {View} from 'react-native';

import {SectionCard, addWebUIListener, send, sendWithPromise, t} from '@astro/platform';

import {LinkRow} from '../components/link-row.tsx';
import {RowGroup} from '../components/row-group.tsx';
import {SearchableLabel} from '../components/searchable-label.tsx';
import {SectionHeader} from '../components/section-header.tsx';

interface ProfileState {
  readonly status: 'pending' | 'ready' | 'failed';
  readonly name: string | undefined;
  readonly reason: string | undefined;
}

let snapshot: ProfileState = {status: 'pending', name: undefined, reason: undefined};
const listeners = new Set<() => void>();
let started = false;

function publish(next: ProfileState): void {
  snapshot = next;
  for (const listener of listeners) {
    listener();
  }
}

function nameOf(value: unknown): string | undefined {
  if (typeof value !== 'object' || value === null) {
    return undefined;
  }
  const candidate = value as {name?: unknown};
  return typeof candidate.name === 'string' ? candidate.name : undefined;
}

function subscribe(listener: () => void): () => void {
  if (!started) {
    started = true;
    addWebUIListener('profile-info-changed', (...args: unknown[]) => {
      const name = nameOf(args[0]);
      if (name !== undefined) {
        publish({status: 'ready', name, reason: undefined});
      }
    });
    void sendWithPromise<unknown>('getProfileInfo').then(
      raw => {
        publish({status: 'ready', name: nameOf(raw), reason: undefined});
      },
      (reason: unknown) => {
        publish({
          status: 'failed',
          name: undefined,
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

function getSnapshot(): ProfileState {
  return snapshot;
}

/**
 * The rename field.
 *
 * Seeded from the browser's value through the key on the element that renders
 * it, so a name changed elsewhere remounts this with the new one instead of
 * being copied in by an effect. Nothing is applied locally: the write goes out
 * and `profile-info-changed` is what moves the row.
 */
function ProfileNameEditor({initial}: {initial: string}) {
  const [draft, setDraft] = useState(initial);
  const trimmed = draft.trim();

  return (
    <View className="flex-row items-end gap-2">
      <View className="flex-1 gap-1">
        {/* The label is drawn rather than left to the field's accessibility
            label, because the page's search index matches on what a section
            declares it renders -- an invisible label would make "Profile name"
            findable and then land on a screen with no such words on it. */}
        <SearchableLabel id="settings.youAndAstro.profile.name" />
        <TextField>
          <TextFieldInput
            label={t('settings.youAndAstro.profile.name.field')}
            value={draft}
            onChangeText={setDraft}
          />
        </TextField>
      </View>
      <Button
        variant="secondary"
        size="small"
        // Empty after trimming is the input the handler CHECKs on, and
        // unchanged is a write with nothing to write.
        disabled={trimmed === '' || trimmed === initial}
        onPress={() => send('setProfileName', trimmed)}
      >
        {t('settings.youAndAstro.profile.name.save')}
      </Button>
    </View>
  );
}

function LocalProfile() {
  const profile = useSyncExternalStore(subscribe, getSnapshot);

  if (profile.status === 'failed') {
    return (
      <SectionCard
        description={t('settings.youAndAstro.profile.failed', {reason: profile.reason ?? ''})}
      />
    );
  }

  return (
    <SectionCard
      title={t('settings.youAndAstro.profile')}
      description={t('settings.youAndAstro.profile.footer')}
    >
      {profile.name === undefined ? (
        <Text className="text-body text-text-secondary">
          {t('settings.youAndAstro.profile.pending')}
        </Text>
      ) : (
        <ProfileNameEditor key={profile.name} initial={profile.name} />
      )}
    </SectionCard>
  );
}

export function YouAndAstroSection() {
  return (
    <>
      <SectionHeader
        title="settings.youAndAstro.title"
        description="settings.youAndAstro.description"
      />

      <SectionCard
        title={t('settings.youAndAstro.account')}
        description={t('settings.youAndAstro.account.body')}
      >
        <Text className="text-bodySmall text-text-secondary">
          {t('settings.youAndAstro.account.sync')}
        </Text>
        <Text className="text-bodySmall text-text-tertiary">
          {t('settings.youAndAstro.account.replaces')}
        </Text>
      </SectionCard>

      <LocalProfile />

      <RowGroup>
        <LinkRow
          label="settings.youAndAstro.importData.title"
          sublabel="settings.youAndAstro.importData.sublabel"
          to="/importData"
        />
      </RowGroup>
    </>
  );
}
