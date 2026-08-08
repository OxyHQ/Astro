// One pref, as the control its own type calls for.
//
// The whole point of rendering FROM the pref: chrome.settingsPrivate reports
// each pref's `type`, its current `value` and whether a policy `enforcement`
// controls it, so a control is chosen from what the pref actually is rather
// than from a hand-written table. A pref the browser gains appears here the
// day it exists, with the right control, and one a policy locks says so
// instead of silently ignoring a tap.
//
// Choices are the exception, and deliberately so: a pref whose value is an
// enum arrives as a plain NUMBER, and nothing in the API says what 0, 1 and 2
// mean. Those live in catalog.ts, next to the wording -- naming a choice IS
// presentation, unlike inventing which prefs exist.

import {useState} from 'react';
import {TextInput, View} from 'react-native';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectItemText,
  SelectTrigger,
  SelectValue,
  SettingsListItem,
  Switch,
} from '@oxyhq/bloom';

import {choicesFor, labelFor} from './catalog.ts';
import {setPref} from './pref-store.ts';
import {PrefType, type Pref} from './prefs.ts';

function managedNote(pref: Pref): string | undefined {
  if (pref.enforcement === undefined) {
    return undefined;
  }
  return pref.controlledBy === 'EXTENSION'
      ? 'Controlled by an extension'
      : 'Managed by your organization';
}

/** A number or string pref with a known set of values: Bloom's Select. */
function ChoiceRow({pref, choices}: {
  pref: Pref,
  choices: ReadonlyArray<{value: string | number, label: string}>,
}) {
  const enforced = pref.enforcement !== undefined;
  const current = String(pref.value);
  const selected = choices.find(choice => String(choice.value) === current);

  return (
    <SettingsListItem
      title={labelFor(pref.key)}
      description={managedNote(pref)}
      disabled={enforced}
      showChevron={false}
      rightElement={
        <Select
          value={current}
          disabled={enforced}
          onValueChange={next => {
            // Back to the pref's own type. settingsPrivate rejects a string
            // written to a NUMBER pref, and the rejection is silent -- the
            // control would spring back with nothing said.
            setPref(pref.key,
                    pref.type === PrefType.NUMBER ? Number(next) : next);
          }}
        >
          <SelectTrigger label={labelFor(pref.key)}>
            <SelectValue placeholder={selected?.label ?? current} />
          </SelectTrigger>
          <SelectContent>
            {choices.map(choice => (
              <SelectItem key={String(choice.value)} value={String(choice.value)}
                          label={choice.label}>
                <SelectItemText>{choice.label}</SelectItemText>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      }
    />
  );
}

/**
 * A free-form pref: edited in place, committed on blur or Enter.
 *
 * Not committed per keystroke. Every write echoes back through
 * onPrefsChanged, so a per-keystroke write would fight the field for the
 * caret -- and would write a partial URL to a pref the browser acts on.
 */
function TextRow({pref}: {pref: Pref}) {
  const enforced = pref.enforcement !== undefined;
  const committed = pref.value === undefined || pref.value === null
      ? '' : String(pref.value);
  const [draft, setDraft] = useState<string | null>(null);
  const numeric = pref.type === PrefType.NUMBER;

  const commit = () => {
    if (draft === null || draft === committed) {
      setDraft(null);
      return;
    }
    if (numeric) {
      const parsed = Number(draft);
      // A pref the browser acts on is not the place to send NaN. Refusing and
      // reverting is honest; writing it would take effect as 0.
      if (!Number.isFinite(parsed)) {
        setDraft(null);
        return;
      }
      setPref(pref.key, parsed);
    } else {
      setPref(pref.key, draft);
    }
    setDraft(null);
  };

  return (
    <SettingsListItem
      title={labelFor(pref.key)}
      description={managedNote(pref)}
      disabled={enforced}
      showChevron={false}
      rightElement={
        <View className="min-w-40">
          <TextInput
            className="rounded-radius-12 border border-border bg-card px-3 py-2 text-foreground"
            value={draft ?? committed}
            editable={!enforced}
            inputMode={numeric ? 'numeric' : 'text'}
            onChangeText={setDraft}
            onBlur={commit}
            onSubmitEditing={commit}
          />
        </View>
      }
    />
  );
}

/**
 * A list or dictionary pref.
 *
 * Shown with its size and opened by the section that owns it -- a list of
 * startup URLs and a list of spellcheck dictionaries are the same TYPE and
 * completely different screens, so there is no generic editor to write. Shown
 * rather than hidden: a pref the page cannot yet edit is still one the person
 * is entitled to see.
 */
function CollectionRow({pref, onOpen}: {pref: Pref, onOpen?: () => void}) {
  const count = Array.isArray(pref.value)
      ? pref.value.length
      : Object.keys((pref.value ?? {}) as object).length;
  return (
    <SettingsListItem
      title={labelFor(pref.key)}
      value={`${count} item${count === 1 ? '' : 's'}`}
      description={managedNote(pref)}
      disabled={pref.enforcement !== undefined}
      onPress={onOpen}
      showChevron={onOpen !== undefined}
    />
  );
}

export function PrefControl({pref}: {pref: Pref}) {
  const enforced = pref.enforcement !== undefined;

  if (pref.type === PrefType.BOOLEAN) {
    return (
      <SettingsListItem
        title={labelFor(pref.key)}
        description={managedNote(pref)}
        disabled={enforced}
        showChevron={false}
        rightElement={
          <Switch
            value={pref.value === true}
            disabled={enforced}
            onValueChange={(next: boolean) => setPref(pref.key, next)}
          />
        }
      />
    );
  }

  const choices = choicesFor(pref.key);
  if (choices) {
    return <ChoiceRow pref={pref} choices={choices} />;
  }

  if (pref.type === PrefType.LIST || pref.type === PrefType.DICTIONARY) {
    return <CollectionRow pref={pref} />;
  }

  return <TextRow pref={pref} />;
}
