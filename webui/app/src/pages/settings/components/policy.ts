// What a policy has done to a control, read once and shared by every row.
//
// A `PrefObject` carries more than a value: which authority overrode the user,
// how hard that override is, and — when a policy narrows the choices rather
// than fixing one — which values are still selectable. Every row in this
// directory renders from that metadata rather than from the value alone, so a
// managed browser looks managed instead of looking broken.
//
// It lives in its own module because the four rendering decisions below are
// identical for a switch, a select, a radio group and a slider, and a copy per
// control is how one of them comes to accept a tap that the browser then
// silently refuses.

import {t, usePref, type Pref} from '@astro/platform';

/** A pref and the three things a control needs to decide from it. */
export interface PrefControl {
  /**
   * Undefined until the browser has reported the pref — which is also the
   * honest answer for a pref this profile does not have. A control renders
   * itself unavailable rather than inventing a default.
   */
  readonly pref: Pref | undefined;
  /** The control must refuse input: a policy fixed this value. */
  readonly enforced: boolean;
  /** The sentence that explains the state the control is in. */
  readonly note: string | undefined;
}

/**
 * The values a user may still choose.
 *
 * `undefined` means "no narrowing" — every value the control offers is
 * allowed. A policy that narrows rather than fixes reports the survivors here,
 * and a control that ignored it would offer an option the browser refuses.
 */
export function selectableValues(pref: Pref | undefined): readonly unknown[] | undefined {
  return pref?.userSelectableValues;
}

/**
 * The description that explains why the control is in the state it is in.
 *
 * `formatValue` renders a recommended value in the control's own vocabulary —
 * a select says "Ask first", not "2". Without one the recommendation is
 * reported as the raw stored value, which is still true and still better than
 * silence.
 */
function policyNote(pref: Pref, formatValue?: (value: unknown) => string): string | undefined {
  if (pref.enforcement === 'ENFORCED') {
    return pref.controlledByName
      ? t('pref.enforcedBy', {controller: pref.controlledByName})
      : t('pref.enforced');
  }
  if (pref.enforcement === 'RECOMMENDED') {
    if (pref.type === 'BOOLEAN') {
      return pref.recommendedValue === true ? t('pref.recommendedOn') : t('pref.recommendedOff');
    }
    const shown = formatValue
      ? formatValue(pref.recommendedValue)
      : String(pref.recommendedValue ?? '');
    return t('pref.recommendedValue', {value: shown});
  }
  return undefined;
}

/** One pref, live, with the policy state a control renders from. */
export function usePrefControl(
  prefKey: string,
  formatValue?: (value: unknown) => string,
): PrefControl {
  const pref = usePref(prefKey);
  if (!pref) {
    return {pref: undefined, enforced: false, note: t('pref.unavailable')};
  }
  return {
    pref,
    enforced: pref.enforcement === 'ENFORCED',
    note: policyNote(pref, formatValue),
  };
}
