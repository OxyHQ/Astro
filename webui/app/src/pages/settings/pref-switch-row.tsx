// One boolean pref, as a row.
//
// The row renders from the pref the browser reported, including its policy
// metadata -- so an enforced pref locks its switch and names what locked it,
// and a merely recommended one stays usable and says what is recommended. A
// row rendered from a hand-kept table instead would accept the tap and quietly
// do nothing, which is how a managed browser comes to look broken.

import {SettingsListItem, Switch} from '@oxyhq/bloom';
import {setPref, t, usePref, type MessageId, type Pref} from '@astro/platform';

/** The description that explains why the control is in the state it is in. */
function policyNote(pref: Pref): string | undefined {
  if (pref.enforcement === 'ENFORCED') {
    return pref.controlledByName
      ? t('pref.enforcedBy', {controller: pref.controlledByName})
      : t('pref.enforced');
  }
  if (pref.enforcement === 'RECOMMENDED') {
    return pref.recommendedValue === true ? t('pref.recommendedOn') : t('pref.recommendedOff');
  }
  return undefined;
}

export function PrefSwitchRow({prefKey, label}: {prefKey: string; label: MessageId}) {
  const pref = usePref(prefKey);

  if (!pref) {
    // Either the browser has not answered yet or this profile has no such
    // pref. Both are "no value to show", and inventing a default here is how a
    // page comes to display a setting the user does not have.
    return (
      <SettingsListItem
        title={t(label)}
        description={t('pref.unavailable')}
        disabled
        showChevron={false}
      />
    );
  }

  const enforced = pref.enforcement === 'ENFORCED';
  return (
    <SettingsListItem
      title={t(label)}
      description={policyNote(pref)}
      disabled={enforced}
      showChevron={false}
      rightElement={
        <Switch
          value={pref.value === true}
          disabled={enforced}
          onValueChange={(next: boolean) => setPref(prefKey, next)}
        />
      }
    />
  );
}
