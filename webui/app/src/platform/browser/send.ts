// The protocol Chromium's own WebUIMessageHandlers speak.
//
// Most of what a settings page does is not a preference. Search engines, site
// permissions, importing data, secure DNS, resetting a profile, the default
// browser -- all of it lives in C++ handlers and has no other API. A page that
// derives from the controller those handlers are installed on inherits them,
// and this is how it calls them.
//
// It reimplements two functions from upstream's cr.js rather than importing
// it, which would pull a chunk of the WebUI framework in to get them. The
// contract, as measured against a running browser rather than assumed:
//
//   * chrome.send(message, [callbackId, ...args]) issues a call.
//   * The browser replies by invoking `cr.webUIResponse(id, ok, data)` BY NAME
//     in the page's global scope.
//   * Handlers push updates by invoking `cr.webUIListenerCallback(event, ...)`.
//
// This is NOT a preference transport, and it must not become one. The generic
// string-keyed pref bridge this project removed -- `getPref`/`setPref` over
// chrome.send -- had no types, no policy metadata and no allowlist, so a page
// could write any pref it could spell. Chromium prefs go through
// settings-private.ts; Astro's own go through typed Mojo.

interface ChromeSend {
  send(message: string, args?: unknown[]): void;
}

function bridge(): ChromeSend {
  const api = (globalThis as {chrome?: ChromeSend}).chrome;
  if (!api?.send) {
    // Not a soft failure. Without chrome.send every handler-backed screen
    // renders empty, which reads as "the browser has no search engines"
    // rather than "this page was served without its handlers".
    throw new Error(
      'chrome.send is unavailable: this page was not served by a WebUI ' +
        'controller that installs the handlers it is calling.',
    );
  }
  return api;
}

interface PendingCall {
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
}

const pending = new Map<string, PendingCall>();
const listeners = new Map<string, Set<(...args: unknown[]) => void>>();

let installed = false;

function install(): void {
  if (installed) {
    return;
  }
  installed = true;
  // The browser calls these by NAME on the global object. They are not
  // imports, and nothing here can be renamed by a bundler -- hence the
  // explicit assignment rather than exported functions.
  const cr = ((globalThis as {cr?: Record<string, unknown>}).cr ??= {});

  cr['webUIResponse'] = (id: string, ok: boolean, data: unknown) => {
    const waiting = pending.get(id);
    if (!waiting) {
      return;
    }
    pending.delete(id);
    if (ok) {
      waiting.resolve(data);
    } else {
      waiting.reject(data);
    }
  };

  cr['webUIListenerCallback'] = (event: string, ...args: unknown[]) => {
    for (const listener of listeners.get(event) ?? []) {
      listener(...args);
    }
  };
}

let nextId = 0;

/** Call a handler and await its reply. */
export function sendWithPromise<T>(message: string, ...args: unknown[]): Promise<T> {
  install();
  const id = `astro-${message}-${nextId++}`;
  const reply = new Promise<T>((resolve, reject) => {
    pending.set(id, {resolve: resolve as (value: unknown) => void, reject});
  });
  bridge().send(message, [id, ...args]);
  return reply;
}

/** Call a handler that does not reply. */
export function send(message: string, ...args: unknown[]): void {
  install();
  bridge().send(message, args);
}

/** Subscribe to a handler's push updates. Returns the unsubscribe. */
export function addWebUIListener(
  event: string,
  listener: (...args: unknown[]) => void,
): () => void {
  install();
  let set = listeners.get(event);
  if (!set) {
    set = new Set();
    listeners.set(event, set);
  }
  set.add(listener);
  return () => {
    set.delete(listener);
  };
}
