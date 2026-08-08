// chrome.autofillPrivate, over the dev fixtures. DEV ONLY -- see ./state.ts.
//
// The removals really remove, and the observer really fires. A mock whose
// delete resolved and changed nothing would let a broken remove button look
// identical to a working one -- the row would still be there after the click
// either way, and only a real browser would ever say which it was.

import type {
  AutofillPrivateApi,
  PersonalData,
  SavedAddress,
  SavedCard,
  SavedIban,
} from '../autofill-private.ts';
import {fixtureAutofill} from './sections.ts';

const fixtures = fixtureAutofill();

let addresses: readonly SavedAddress[] = fixtures.addresses ?? [];
let cards: readonly SavedCard[] = fixtures.cards ?? [];
let ibans: readonly SavedIban[] = fixtures.ibans ?? [];

const listeners = new Set<(data: PersonalData) => void>();

function current(): PersonalData {
  return {addresses, cards, ibans};
}

function publish(): void {
  const data = current();
  for (const listener of listeners) {
    listener(data);
  }
}

export function createAutofillPrivateMock(): AutofillPrivateApi {
  return {
    getPersonalData: () => Promise.resolve(current()),
    removeAddress: guid => {
      addresses = addresses.filter(entry => entry.guid !== guid);
      publish();
    },
    // One call for both, exactly as the browser exposes it: the screens do not
    // know which of the two lists a guid came from, and neither does the API.
    removePaymentsEntity: guid => {
      cards = cards.filter(entry => entry.guid !== guid);
      ibans = ibans.filter(entry => entry.guid !== guid);
      publish();
    },
    onPersonalDataChanged: listener => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
