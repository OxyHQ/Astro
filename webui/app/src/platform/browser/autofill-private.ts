// chrome.autofillPrivate -- the browser's own store of saved addresses and
// payment methods.
//
// This is lane 1 of the transport contract, the same sanctioned class as
// settings-private.ts, and NOT the generic pref bridge this project removed.
// The distinction is the one that matters and is worth stating rather than
// assuming: the removed bridge was `getPref`/`setPref` over chrome.send, an
// untyped, unallowlisted channel through which a page could read or write any
// pref it could spell. This is a purpose-built Chromium API with a fixed set of
// typed operations over one kind of data, granted per host by the browser
// itself. Adding it takes nothing back that was deliberately given up.
//
// The grant is a URL pattern in `chrome/common/extensions/api/
// _api_features.json` -- `chrome://settings/*`, `contexts: ["webui"]`, on
// chromeos/linux/mac/win. It reaches Astro's page because layer 8 of the WebUI
// scheme composition rewrites those patterns to the composed scheme (see
// AGENTS.md); a page served under any other host gets no bindings at all.
//
// Only what the screens need is exposed. There is no passthrough of the API
// object, and that is deliberate twice over: the real surface is 30-odd methods
// including virtual-card enrolment, IBAN validation and an AI opt-in, and a
// facade that handed the whole thing over would make every one of them
// reachable from a page that has no business calling them. Saving and editing
// are absent for a second reason -- they need a form this page does not have,
// and a facade method with no caller is a claim that something works.

import {MissingBrowserApiError} from './env.ts';

/** How the browser is holding a record, and what to call it in a list. */
export interface AutofillMetadata {
  /** The one-line label the browser itself composes for a list row. */
  readonly summaryLabel: string;
  readonly summarySublabel?: string;
  /** False for a record that lives in the account rather than on the device. */
  readonly isLocal?: boolean;
}

export interface SavedAddress {
  readonly guid?: string;
  readonly metadata?: AutofillMetadata;
}

export interface SavedCard {
  readonly guid?: string;
  readonly nickname?: string;
  readonly network?: string;
  readonly expirationMonth?: string;
  readonly expirationYear?: string;
  readonly metadata?: AutofillMetadata;
}

export interface SavedIban {
  readonly guid?: string;
  readonly nickname?: string;
  readonly metadata?: AutofillMetadata;
}

/**
 * Everything the saved-info screens render, as one value.
 *
 * One shape rather than three, because the browser reports them together: a
 * single `onPersonalDataChanged` carries all three lists, so three separate
 * snapshots would be three chances for two screens to disagree about a change
 * that arrived at once.
 */
export interface PersonalData {
  readonly addresses: readonly SavedAddress[];
  readonly cards: readonly SavedCard[];
  readonly ibans: readonly SavedIban[];
}

/** The promise-shaped surface the rest of the app uses. */
export interface AutofillPrivateApi {
  getPersonalData(): Promise<PersonalData>;
  /** Deletes a saved address. The change comes back through the observer. */
  removeAddress(guid: string): void;
  /** Deletes a saved card or IBAN -- the browser takes both by the same call. */
  removePaymentsEntity(guid: string): void;
  /** Returns the unsubscribe. */
  onPersonalDataChanged(listener: (data: PersonalData) => void): () => void;
}

/** The callback-shaped API as the browser actually installs it. */
interface ChromeAutofillPrivate {
  getAddressList(callback: (entries: SavedAddress[]) => void): void;
  getCreditCardList(callback: (entries: SavedCard[]) => void): void;
  getIbanList(callback: (entries: SavedIban[]) => void): void;
  removeAddress(guid: string): void;
  removePaymentsEntity(guid: string): void;
  onPersonalDataChanged: {
    addListener(
      callback: (
        addresses: SavedAddress[],
        cards: SavedCard[],
        ibans: SavedIban[],
      ) => void,
    ): void;
    removeListener(
      callback: (
        addresses: SavedAddress[],
        cards: SavedCard[],
        ibans: SavedIban[],
      ) => void,
    ): void;
  };
}

function wrap(api: ChromeAutofillPrivate): AutofillPrivateApi {
  return {
    // Three calls, one value. The browser has no combined getter, and three
    // separate awaits in the screen would render a half-loaded page twice.
    getPersonalData: async () => {
      const [addresses, cards, ibans] = await Promise.all([
        new Promise<SavedAddress[]>(resolve => api.getAddressList(resolve)),
        new Promise<SavedCard[]>(resolve => api.getCreditCardList(resolve)),
        new Promise<SavedIban[]>(resolve => api.getIbanList(resolve)),
      ]);
      return {addresses, cards, ibans};
    },
    removeAddress: guid => api.removeAddress(guid),
    removePaymentsEntity: guid => api.removePaymentsEntity(guid),
    onPersonalDataChanged: listener => {
      // The event carries five arguments; the two this app does not render --
      // pay-over-time issuers and the signed-in account -- are dropped here
      // rather than in the screens, so nothing downstream can start depending
      // on data no control shows.
      const forward = (
        addresses: SavedAddress[],
        cards: SavedCard[],
        ibans: SavedIban[],
      ): void => listener({addresses, cards, ibans});
      api.onPersonalDataChanged.addListener(forward);
      return () => api.onPersonalDataChanged.removeListener(forward);
    },
  };
}

let resolved: Promise<AutofillPrivateApi> | undefined;

/** The saved-info API for this page, resolved once. */
export function autofillPrivate(): Promise<AutofillPrivateApi> {
  resolved ??= (async () => {
    const real = (globalThis as {chrome?: {autofillPrivate?: ChromeAutofillPrivate}})
      .chrome?.autofillPrivate;
    if (real) {
      return wrap(real);
    }
    if (import.meta.env.DEV) {
      const {createAutofillPrivateMock} = await import('./mock/autofill-private.ts');
      return createAutofillPrivateMock();
    }
    throw new MissingBrowserApiError(
      'chrome.autofillPrivate',
      'The API is granted by a matches pattern in _api_features.json; this ' +
        'page is served from a host that pattern does not cover.',
    );
  })();
  return resolved;
}
