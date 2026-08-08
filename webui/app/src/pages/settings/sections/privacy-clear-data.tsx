// Delete browsing data.
//
// Two transports at once, and they have to agree. WHAT is selected and for HOW
// LONG are ordinary allowlisted prefs under `browser.clear_data.*`, which the
// C++ side reads back out of the profile; the DELETION and the amounts beside
// each row come from ClearBrowsingDataHandler
// (chrome/browser/ui/webui/settings/settings_clear_browsing_data_handler.cc).
//
// The messages, exactly as that file's RegisterMessages spells them:
//
//   initializeClearBrowsingData        promise, resolves void. Also the call
//                                      that turns the handler's push channel
//                                      on -- nothing arrives before it.
//   restartClearBrowsingDataCounters   (basic, timePeriod). Fire-and-forget.
//   clearBrowsingData                  (dataTypePrefNames[], timePeriod) ->
//                                      {showHistoryNotice, showPasswordsNotice}
//   browsing-data-counter-text-update  push, (prefName, text).
//
// THE ROW SET IS NOT A DESIGN CHOICE. `HandleClearBrowsingData` maps each pref
// name it is handed through `GetDataTypeFromDeletionPreference` and CHECKs the
// result, so a name that is not in that table takes the tab down rather than
// being ignored. The seven below are exactly `GetAdvancedCounterPrefs()`, which
// is also exactly the set the handler registers a counter for -- so every row
// can show an amount and none of them can crash the browser.
//
// SAVED PASSWORDS ARE DELIBERATELY MISSING. `browser.clear_data.passwords` is
// in the table, but the PASSWORDS arm of that switch is
// `CHECK(!base::FeatureList::IsEnabled(browsing_data::features::kDbdRevampDesktop))`
// and that feature is FEATURE_ENABLED_BY_DEFAULT. A password row would be a
// row whose only effect is to crash the renderer.
//
// The time range is not a `SelectRow`. Changing it has to do two things --
// write the pref AND ask the handler to recount for the new window -- and a
// counter left over from the previous range is worse than no counter at all,
// because it is a specific, wrong number next to a delete button.

import {
  Button,
  Checkbox,
  Select,
  SelectContent,
  SelectIcon,
  SelectItem,
  SelectItemIndicator,
  SelectItemText,
  SelectTrigger,
  SelectValue,
  SettingsListItem,
} from '@oxyhq/bloom';
import {Text} from '@oxyhq/bloom/typography';
import {useState, useSyncExternalStore} from 'react';
import {View} from 'react-native';

import {
  SectionCard,
  addWebUIListener,
  send,
  sendWithPromise,
  setPref,
  t,
  usePref,
  type MessageId,
} from '@astro/platform';

import {ControlAnchor} from '../components/control-anchor.tsx';
import {usePrefControl} from '../components/policy.ts';
import {RowGroup} from '../components/row-group.tsx';
import {SubpageHeader} from '../components/section-header.tsx';

const TIME_PERIOD_PREF = 'browser.clear_data.time_period';

/**
 * browsing_data::TimePeriod, from components/browsing_data/core/browsing_data_utils.h.
 *
 * The numbers are persisted in the profile and recorded in histograms, so they
 * are permanent; the ORDER below is the one a user reads them in, which is not
 * the numeric one.
 */
const TIME_PERIODS: readonly {readonly value: number; readonly label: MessageId}[] = [
  {value: 6, label: 'settings.privacy.clearData.timeRange.15min'},
  {value: 0, label: 'settings.privacy.clearData.timeRange.hour'},
  {value: 1, label: 'settings.privacy.clearData.timeRange.day'},
  {value: 2, label: 'settings.privacy.clearData.timeRange.week'},
  {value: 3, label: 'settings.privacy.clearData.timeRange.fourWeeks'},
  {value: 4, label: 'settings.privacy.clearData.timeRange.allTime'},
];

/** The seven deletion prefs the handler both counts and accepts. */
const DATA_TYPES: readonly {readonly pref: string; readonly label: MessageId}[] = [
  {pref: 'browser.clear_data.browsing_history', label: 'settings.privacy.clearData.history'},
  {pref: 'browser.clear_data.download_history', label: 'settings.privacy.clearData.downloads'},
  {pref: 'browser.clear_data.cookies', label: 'settings.privacy.clearData.cookies'},
  {pref: 'browser.clear_data.cache', label: 'settings.privacy.clearData.cache'},
  {pref: 'browser.clear_data.form_data', label: 'settings.privacy.clearData.formData'},
  {pref: 'browser.clear_data.site_settings', label: 'settings.privacy.clearData.siteSettings'},
  {pref: 'browser.clear_data.hosted_apps_data', label: 'settings.privacy.clearData.hostedApps'},
];

interface CountersState {
  /** The handler never answered the initialise call, so no amount will arrive. */
  readonly failed: boolean;
  /** Counter text by deletion pref name, as the handler phrased it. */
  readonly text: ReadonlyMap<string, string>;
}

let snapshot: CountersState = {failed: false, text: new Map()};
const listeners = new Set<() => void>();
let started = false;

function publish(next: CountersState): void {
  snapshot = next;
  for (const listener of listeners) {
    listener();
  }
}

/**
 * Turn the handler's push channel on, once.
 *
 * Started from `subscribe` rather than a mount effect, the same shape the pref
 * store uses. The listener is registered before the initialise call so a
 * counter that finishes early is not dropped on the floor.
 */
function subscribe(listener: () => void): () => void {
  if (!started) {
    started = true;
    addWebUIListener('browsing-data-counter-text-update', (...args: unknown[]) => {
      const [pref, text] = args;
      if (typeof pref === 'string' && typeof text === 'string') {
        const next = new Map(snapshot.text);
        next.set(pref, text);
        publish({...snapshot, text: next});
      }
    });
    void sendWithPromise<void>('initializeClearBrowsingData').catch(() => {
      publish({...snapshot, failed: true});
    });
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): CountersState {
  return snapshot;
}

function useCounters(): CountersState {
  return useSyncExternalStore(subscribe, getSnapshot);
}

/** Ask the handler to recount for a window the user just chose. */
function restartCounters(period: number): void {
  // `false` is the ADVANCED counter set. The basic set is empty in this build
  // (GetBasicCounterPrefs returns nothing once kDbdRevampDesktop is on), so
  // restarting it would recount nothing.
  send('restartClearBrowsingDataCounters', false, period);
}

/**
 * The deletion prefs currently ticked, and the window they apply to.
 *
 * One `usePref` per entry of a module-level constant whose length never varies,
 * so the hook order is fixed between renders. Read here rather than gathered
 * from the rows, because the delete call and the rows must be describing the
 * same selection and two copies of it is how they come to differ.
 */
function useSelectedDataTypes(): readonly string[] {
  const selected: string[] = [];
  for (const type of DATA_TYPES) {
    const pref = usePref(type.pref);
    if (pref?.value === true) {
      selected.push(type.pref);
    }
  }
  return selected;
}

/** Undefined while the browser has not reported the pref; the action stays refused. */
function useTimePeriod(): number | undefined {
  const pref = usePref(TIME_PERIOD_PREF);
  return typeof pref?.value === 'number' ? pref.value : undefined;
}

function TimeRangeRow() {
  const describe = (value: unknown): string => {
    const match = TIME_PERIODS.find(period => period.value === value);
    return match ? t(match.label) : String(value ?? '');
  };
  const {pref, enforced, note} = usePrefControl(TIME_PERIOD_PREF, describe);

  if (!pref) {
    return (
      <ControlAnchor id="settings.privacy.clearData.timeRange">
        <SettingsListItem
          title={t('settings.privacy.clearData.timeRange')}
          description={note}
          disabled
          showChevron={false}
        />
      </ControlAnchor>
    );
  }

  const allowed = pref.userSelectableValues;
  const items = TIME_PERIODS.filter(
    period => allowed === undefined || allowed.includes(period.value),
  ).map(period => ({value: String(period.value), label: t(period.label)}));

  return (
    <ControlAnchor id="settings.privacy.clearData.timeRange">
      <SettingsListItem
        title={t('settings.privacy.clearData.timeRange')}
        description={note}
        disabled={enforced}
        showChevron={false}
        rightElement={
          <View className="min-w-40">
            <Select
              value={String(pref.value)}
              disabled={enforced}
              onValueChange={(next: string) => {
                const period = TIME_PERIODS.find(candidate => String(candidate.value) === next);
                if (!period) {
                  return;
                }
                setPref(TIME_PERIOD_PREF, period.value);
                restartCounters(period.value);
              }}
            >
              <SelectTrigger label={t('settings.privacy.clearData.timeRange')}>
                {/* The function child is not optional decoration: `SelectValue`
                    renders the raw context value whenever there is one, and the
                    value here is a browsing_data::TimePeriod, so without it the
                    trigger reads "1" instead of "Last 24 hours". */}
                <SelectValue placeholder={describe(pref.value)}>
                  {value => describe(Number(value))}
                </SelectValue>
                <SelectIcon />
              </SelectTrigger>
              <SelectContent
                label={t('settings.privacy.clearData.timeRange')}
                items={items}
                renderItem={(item: {value: string; label: string}) => (
                  <SelectItem value={item.value} label={item.label}>
                    <SelectItemIndicator />
                    <SelectItemText>{item.label}</SelectItemText>
                  </SelectItem>
                )}
              />
            </Select>
          </View>
        }
      />
    </ControlAnchor>
  );
}

function DataTypeRow({
  prefKey,
  label,
  counter,
}: {
  prefKey: string;
  label: MessageId;
  counter: string | undefined;
}) {
  const {pref, enforced, note} = usePrefControl(prefKey);
  const checked = pref?.value === true;
  const locked = enforced || !pref;

  return (
    <ControlAnchor id={label}>
      <SettingsListItem
        title={t(label)}
        description={note}
        // The handler's own phrasing of how much there is ("1,234 items",
        // "Less than 1 MB"). Absent until it has finished counting.
        value={counter}
        disabled={locked}
        showChevron={false}
        onPress={() => setPref(prefKey, !checked)}
        accessibilityRole="none"
        rightElement={
          <Checkbox
            checked={checked}
            disabled={locked}
            accessibilityLabel={t(label)}
            onCheckedChange={next => setPref(prefKey, next)}
          />
        }
      />
    </ControlAnchor>
  );
}

/** What the delete button is doing right now. Per-interaction, not shared. */
type Progress =
  | {readonly kind: 'idle'}
  | {readonly kind: 'confirming'}
  | {readonly kind: 'working'}
  | {readonly kind: 'done'}
  | {readonly kind: 'failed'; readonly reason: string};

export function PrivacyClearDataScreen() {
  const counters = useCounters();
  const [progress, setProgress] = useState<Progress>({kind: 'idle'});

  const selected = useSelectedDataTypes();
  const period = useTimePeriod();
  const canDelete = selected.length > 0 && period !== undefined;

  const clear = (period: number): void => {
    setProgress({kind: 'working'});
    sendWithPromise<unknown>('clearBrowsingData', selected, period).then(
      () => {
        setProgress({kind: 'done'});
        // What is left to delete has just changed, so every amount on screen
        // is now describing data that is gone.
        restartCounters(period);
      },
      (reason: unknown) => {
        setProgress({
          kind: 'failed',
          reason: reason instanceof Error ? reason.message : String(reason),
        });
      },
    );
  };

  return (
    <>
      <SubpageHeader
        title="settings.privacy.clearData.title"
        backTo="/privacy"
        backLabel="settings.nav.privacy"
      />

      <RowGroup>
        <TimeRangeRow />
      </RowGroup>

      <RowGroup
        title="settings.privacy.clearData.types"
        footer={counters.failed ? 'settings.privacy.clearData.countersFailed' : undefined}
      >
        {DATA_TYPES.map(type => (
          <DataTypeRow
            key={type.pref}
            prefKey={type.pref}
            label={type.label}
            counter={counters.text.get(type.pref)}
          />
        ))}
      </RowGroup>

      {progress.kind === 'confirming' && period !== undefined ? (
        // A step, not a red button. The deletion is irreversible and the row
        // above it can be pressed by accident; upstream puts a dialog here and
        // this page has no dialog host, so the card takes its place.
        <SectionCard
          title={t('settings.privacy.clearData.confirm.title')}
          description={t('settings.privacy.clearData.confirm.body')}
        >
          <View className="flex-row gap-2">
            <Button variant="destructive" size="small" onPress={() => clear(period)}>
              {t('settings.privacy.clearData.confirm.yes')}
            </Button>
            <Button variant="secondary" size="small" onPress={() => setProgress({kind: 'idle'})}>
              {t('settings.privacy.clearData.confirm.no')}
            </Button>
          </View>
        </SectionCard>
      ) : (
        <RowGroup>
          <ControlAnchor id="settings.privacy.clearData.action">
            <SettingsListItem
              title={t('settings.privacy.clearData.action')}
              description={
                canDelete ? undefined : t('settings.privacy.clearData.action.nothing')
              }
              showChevron={false}
              rightElement={
                <Button
                  variant="destructive"
                  size="small"
                  disabled={!canDelete || progress.kind === 'working'}
                  loading={progress.kind === 'working'}
                  onPress={() => setProgress({kind: 'confirming'})}
                >
                  {t('settings.privacy.clearData.action.button')}
                </Button>
              }
            />
          </ControlAnchor>
        </RowGroup>
      )}

      {progress.kind === 'done' ? (
        <SectionCard description={t('settings.privacy.clearData.done')} />
      ) : undefined}
      {progress.kind === 'failed' ? (
        <SectionCard
          description={t('settings.privacy.clearData.failed', {reason: progress.reason})}
        />
      ) : undefined}

      <SectionCard>
        <Text className="text-bodySmall text-text-tertiary">
          {t('settings.privacy.clearData.passwordsNote')}
        </Text>
      </SectionCard>
    </>
  );
}
