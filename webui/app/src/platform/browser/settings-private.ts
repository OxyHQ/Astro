// chrome.settingsPrivate -- the browser's own preference API.
//
// This is the sanctioned transport for CHROMIUM prefs, and the reason is the
// metadata rather than the value: a PrefObject reports its type, whether a
// policy or an extension controls it, whether that control is enforced or
// merely recommended, and which values the user may still choose. A control
// rendered from that says "managed by your organisation" and refuses the tap,
// where a control rendered from a hand-maintained table would accept the tap
// and quietly do nothing.
//
// It is granted per HOST, by a URL pattern in the extension feature files
// (`chrome://settings/*` in chrome/common/extensions/api/_api_features.json).
// A page served under any other host gets no bindings at all -- see env.ts.
//
// Astro's OWN prefs do not travel this way: they are not in the API's
// allowlist, and adding them there would make every one of them writable by
// the generic path this project deliberately removed. They use typed Mojo.

import {MissingBrowserApiError} from './env.ts';

export type PrefType = 'BOOLEAN' | 'NUMBER' | 'STRING' | 'URL' | 'LIST' | 'DICTIONARY';

/** What is overriding the user's own choice, when something is. */
export type ControlledBy =
  | 'DEVICE_POLICY'
  | 'USER_POLICY'
  | 'OWNER'
  | 'PRIMARY_USER'
  | 'EXTENSION'
  | 'PARENT'
  | 'CHILD_RESTRICTION';

/** How hard that override is. `RECOMMENDED` still leaves the control usable. */
export type Enforcement = 'ENFORCED' | 'RECOMMENDED' | 'PARENT_SUPERVISED';

export interface Pref {
  readonly key: string;
  readonly type: PrefType;
  readonly value: unknown;
  /** Present only when something other than the user controls the value. */
  readonly controlledBy?: ControlledBy;
  readonly enforcement?: Enforcement;
  /** The value a RECOMMENDED policy suggests; the user may still change it. */
  readonly recommendedValue?: unknown;
  /** When a policy narrows the choices rather than fixing one. */
  readonly userSelectableValues?: readonly unknown[];
  /** The controlling extension, when `controlledBy` is `EXTENSION`. */
  readonly extensionId?: string;
  /** Display name of the controller, when the browser supplies one. */
  readonly controlledByName?: string;
}

/** The promise-shaped surface the rest of the app uses. */
export interface SettingsPrivateApi {
  getAllPrefs(): Promise<readonly Pref[]>;
  getPref(key: string): Promise<Pref>;
  /** Resolves false when the browser refused the write (a policy, a bad type). */
  setPref(key: string, value: unknown): Promise<boolean>;
  /** Returns the unsubscribe. */
  onPrefsChanged(listener: (prefs: readonly Pref[]) => void): () => void;
}

/** The callback-shaped API as the browser actually installs it. */
interface ChromeSettingsPrivate {
  getAllPrefs(callback: (prefs: Pref[]) => void): void;
  getPref(key: string, callback: (pref: Pref) => void): void;
  setPref(key: string, value: unknown, pageId: string, callback: (success: boolean) => void): void;
  onPrefsChanged: {
    addListener(callback: (prefs: Pref[]) => void): void;
    removeListener(callback: (prefs: Pref[]) => void): void;
  };
}

function wrap(api: ChromeSettingsPrivate): SettingsPrivateApi {
  return {
    getAllPrefs: () => new Promise(resolve => api.getAllPrefs(resolve)),
    getPref: key => new Promise(resolve => api.getPref(key, resolve)),
    // The page id is the browser's own de-duplication of change notifications
    // between two settings tabs. This app renders from the echo rather than
    // from a local guess, so it wants every notification.
    setPref: (key, value) => new Promise(resolve => api.setPref(key, value, '', resolve)),
    onPrefsChanged: listener => {
      api.onPrefsChanged.addListener(listener);
      return () => api.onPrefsChanged.removeListener(listener);
    },
  };
}

let resolved: Promise<SettingsPrivateApi> | undefined;

/** The prefs API for this page, resolved once. */
export function settingsPrivate(): Promise<SettingsPrivateApi> {
  resolved ??= (async () => {
    const real = (globalThis as {chrome?: {settingsPrivate?: ChromeSettingsPrivate}})
      .chrome?.settingsPrivate;
    if (real) {
      return wrap(real);
    }
    if (import.meta.env.DEV) {
      const {createSettingsPrivateMock} = await import('./mock/settings-private.ts');
      return createSettingsPrivateMock();
    }
    throw new MissingBrowserApiError(
      'chrome.settingsPrivate',
      'The API is granted by a matches pattern in _api_features.json; this ' +
        'page is served from a host that pattern does not cover.',
    );
  })();
  return resolved;
}
