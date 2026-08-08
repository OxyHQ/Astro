// The browser-control bridge.
//
// Most of what a settings page does is NOT a preference. Search engines, site
// permissions, importing data, secure DNS, resetting the profile, the default
// browser, startup pages -- all of it lives in C++ WebUIMessageHandlers and has
// no other API. Astro's page inherits those handlers by deriving from
// Chromium's settings controller (//astro/browser/webui/astro_settings_page.h),
// so this file is how the app talks to them.
//
// It is the same contract Chromium's own cr.js implements, reimplemented here
// rather than imported because importing it would pull in a chunk of upstream's
// WebUI framework to get two functions. The contract, verified against a
// running browser rather than assumed:
//
//   * chrome.send(message, [callbackId, ...args]) issues a call.
//   * The browser replies by invoking `cr.webUIResponse(id, ok, data)` BY NAME
//     in the page's global scope.
//   * Handlers push updates by invoking `cr.webUIListenerCallback(event, ...)`.
//
// Measured on astro://settings-next against astro://settings as a control:
// `chrome.send('initializeDownloads')` fires `auto-open-downloads-changed` with
// a boolean on both, identically.

interface ChromeSend {
  send(message: string, args?: unknown[]): void;
}

function bridge(): ChromeSend {
  const api = (globalThis as {chrome?: ChromeSend}).chrome;
  if (!api?.send) {
    // Not a soft failure. Without chrome.send every handler-backed screen would
    // render empty, which looks like "the browser has no search engines"
    // rather than "this page was served without its handlers".
    throw new Error(
        'chrome.send is unavailable: this page was not served by a WebUI ' +
        'controller that installs Chromium\'s settings handlers.');
  }
  return api;
}

type ResponseResolver = {
  resolve: (value: unknown) => void,
  reject: (reason: unknown) => void,
};

const pending = new Map<string, ResponseResolver>();
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
export function sendWithPromise<T>(message: string,
                                   ...args: unknown[]): Promise<T> {
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
    event: string, listener: (...args: unknown[]) => void): () => void {
  install();
  let set = listeners.get(event);
  if (!set) {
    set = new Set();
    listeners.set(event, set);
  }
  set.add(listener);
  return () => set.delete(listener);
}
