// The ad blocker page -- an entry of the single Astro WebUI app.
//
// WHAT IT REPLACED, AND WHAT BECAME OF EACH PART
//
// `astro://adblock` was a 284-line HTML document held in a `static constexpr
// char[]` inside its own C++ controller, served through a `SetRequestFilter`
// that answered every path with the same bytes. Every control it drew is
// accounted for here:
//
//   "Ads & trackers blocked"   showed `-` forever. The browser SENT the count
//                              and the page's own script never read the field.
//                              Now real, from the same preference the new tab
//                              page's badge reads, and live: it climbs while
//                              this tab is open.
//   "Filter lists active: 2"   a literal `2` in the markup. Now the count of
//                              lists the browser actually applies, from the
//                              catalogue it sends.
//   EasyList / EasyPrivacy     two `<input type=checkbox checked disabled>`.
//   toggles                    Kept as what they were -- a report, not a
//                              control -- and extended to the whole catalogue
//                              of eleven, which is what the build ships. There
//                              is no per-list preference in the browser, so a
//                              working switch would have had nowhere to store
//                              its answer.
//   Disabled sites + Remove    Kept, and working for the first time. See below.
//   Custom rules + Save        Kept, still stored, and now HONEST about the
//                              fact that nothing reads them.
//
// "Working for the first time" is not a figure of speech. The old page built
// its exceptions list with `list.innerHTML = ''`, and trusted WebUI enforces
// Trusted Types, so that line threw `This document requires 'TrustedHTML'
// assignment` on the shipped binary -- measured -- before any state was
// rendered. The exception rows never appeared, and the custom-rules textarea
// never received its stored value either, because that assignment came after
// the throw in the same function.
//
// WHAT IS NEW, AND WHY IT IS DEFENSIBLE TO ADD IT
//
// The master switch. `oxy.adblock.enabled` was sent to the old page in every
// state message, was never rendered, and had no control anywhere in the browser
// -- the toolbar shield toggles one site, not the profile. A preference nothing
// can reach is not a setting. It works in both directions because the service
// now starts its engine when the preference switches on; before that change the
// off switch would have worked and the on switch would have silently done
// nothing for the rest of the session.

import {
  Button,
  SettingsListGroup,
  SettingsListItem,
  Switch,
  TextField,
  TextFieldInput,
} from '@oxyhq/bloom';
import {useThemeColor} from '@oxyhq/bloom/theme';
import {Text} from '@oxyhq/bloom/typography';
import {useState} from 'react';
import {ScrollView, View} from 'react-native';

import {AstroMark, t} from '@astro/platform';

import {
  removeSiteException,
  setCustomRules,
  setEnabled,
  useAdBlock,
  type AdBlockState,
} from './adblock-store.ts';

/** One of the two numbers at the top. */
function Stat({value, label}: {value: string; label: string}) {
  return (
    <View className="flex-1 items-center gap-1 rounded-2xl bg-card p-4">
      <Text className="text-headerBold text-primary">{value}</Text>
      <Text className="text-caption text-text-secondary text-center">{label}</Text>
    </View>
  );
}

/**
 * The exceptions list.
 *
 * A removal that the browser REFUSES leaves the row in place and says why,
 * rather than removing it optimistically: the usual cause is that the exception
 * is already gone, changed from the shield in another window, and a row
 * disappearing on a click that did nothing would be indistinguishable from one
 * disappearing on a click that worked.
 */
function Exceptions({state}: {state: AdBlockState}) {
  const [refused, setRefused] = useState(false);

  return (
    <SettingsListGroup
      title={t('adblock.group.exceptions')}
      footer={refused ? t('adblock.exceptions.refused') : t('adblock.exceptions.footer')}
    >
      {state.disabledSites.length === 0 ? (
        <SettingsListItem
          title={t('adblock.exceptions.empty')}
          showChevron={false}
          disabled
        />
      ) : (
        state.disabledSites.map(host => (
          <SettingsListItem
            key={host}
            title={host}
            showChevron={false}
            rightElement={
              <Button
                variant="text"
                size="small"
                onPress={() => {
                  void removeSiteException(host).then(accepted => {
                    setRefused(!accepted);
                  });
                }}
              >
                {t('adblock.exceptions.remove')}
              </Button>
            }
          />
        ))
      )}
    </SettingsListGroup>
  );
}

/**
 * The custom-rules editor.
 *
 * The draft is `undefined` while untouched, which is what lets the box follow
 * the browser's value without an effect to synchronise them: unedited, it
 * renders what is stored; edited, it renders the edit; saved, it returns to
 * undefined and follows the echo again. A `useState(stored)` initialised once
 * would show a stale value forever after a change made in another window.
 */
function CustomRules({stored}: {stored: string}) {
  const [draft, setDraft] = useState<string | undefined>(undefined);
  const [outcome, setOutcome] = useState<'saved' | 'refused' | undefined>(undefined);
  const value = draft ?? stored;

  return (
    <SettingsListGroup
      title={t('adblock.group.rules')}
      footer={
        outcome === 'refused'
          ? t('adblock.rules.refused')
          : outcome === 'saved'
            ? t('adblock.rules.saved')
            : t('adblock.rules.footer')
      }
    >
      <View className="gap-3 p-4">
        <TextField>
          <TextFieldInput
            label={t('adblock.rules.label')}
            placeholder={t('adblock.rules.placeholder')}
            value={value}
            onChangeText={next => {
              setDraft(next);
              setOutcome(undefined);
            }}
            multiline
            numberOfLines={6}
            // A monospace column, because every line is a filter expression and
            // the anchors (`||`, `@@`, `##`) only line up in one.
            className="min-h-32 font-mono"
          />
        </TextField>
        <View className="flex-row justify-end">
          <Button
            variant="primary"
            size="small"
            disabled={draft === undefined}
            onPress={() => {
              void setCustomRules(value).then(accepted => {
                setOutcome(accepted ? 'saved' : 'refused');
                if (accepted) {
                  // Back to following the browser. The echo carries what was
                  // actually stored, which is the only value worth showing.
                  setDraft(undefined);
                }
              });
            }}
          >
            {t('adblock.rules.save')}
          </Button>
        </View>
      </View>
    </SettingsListGroup>
  );
}

export function AdBlockPage() {
  const markColor = useThemeColor('primary');
  const state = useAdBlock();
  const applied = state.filterLists.filter(list => list.fetched).length;

  return (
    <View className="flex-1 bg-background">
      <ScrollView className="flex-1" contentContainerClassName="items-center px-6 py-12">
        <View className="w-full max-w-2xl gap-6">
          <View className="items-center gap-3">
            <AstroMark size={56} fill={markColor} />
            <Text className="text-headerBold text-foreground text-center">
              {t('adblock.title')}
            </Text>
            <Text className="text-bodySmall text-text-secondary text-center">
              {t('adblock.subtitle')}
            </Text>
          </View>

          <View className="flex-row gap-4">
            <Stat
              value={
                state.ready
                  ? state.blockedCount.toLocaleString()
                  : t('adblock.stat.pending')
              }
              label={t('adblock.stat.blocked')}
            />
            <Stat
              value={state.ready ? String(applied) : t('adblock.stat.pending')}
              label={t('adblock.stat.lists')}
            />
          </View>

          <SettingsListGroup
            title={t('adblock.group.status')}
            footer={t('adblock.status.footer')}
          >
            <SettingsListItem
              title={t('adblock.enabled')}
              description={t('adblock.enabled.sublabel')}
              showChevron={false}
              disabled={!state.ready}
              rightElement={
                <Switch
                  value={state.enabled}
                  disabled={!state.ready}
                  onValueChange={(next: boolean) => setEnabled(next)}
                />
              }
            />
          </SettingsListGroup>

          <Exceptions state={state} />

          <SettingsListGroup
            title={t('adblock.group.lists')}
            footer={t('adblock.lists.footer')}
          >
            {state.filterLists.map(list => (
              <SettingsListItem
                key={list.id}
                title={list.name}
                description={list.description}
                value={t(list.fetched ? 'adblock.list.on' : 'adblock.list.off')}
                showChevron={false}
              />
            ))}
          </SettingsListGroup>

          <CustomRules stored={state.customRules} />
        </View>
      </ScrollView>
    </View>
  );
}
