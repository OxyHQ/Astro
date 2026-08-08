// Chromium's WebUIMessageHandlers, over the dev fixtures. DEV ONLY -- see
// ./state.ts.
//
// This mock stands in for the C++ side of `chrome.send`, and it stands in for
// the TRANSPORT as well as the answers: a reply is delivered by calling
// `cr.webUIResponse` by name on the global object, exactly as the browser
// delivers one, so `send.ts` runs its real code path in dev. A mock that
// resolved the promise directly would leave the half of that file which parses
// the browser's replies unexercised until the first real build.
//
// An unknown message FAILS. In the browser, calling a message no installed
// handler registered is a `CHECK` failure that takes the renderer down; here it
// is a rejected promise naming the message. Either way it is loud, which is the
// point -- a mock that quietly resolved undefined would let a section ship
// calling a handler that does not exist.

import {fixtureActions, fixtureReplies} from './sections.ts';

/** The narrow shape `send.ts` needs of `chrome`. */
export interface SendBridge {
  send(message: string, args?: unknown[]): void;
}

interface CrGlobal {
  webUIResponse?: (id: string, ok: boolean, data: unknown) => void;
}

export function createSendMock(): SendBridge {
  const replies = fixtureReplies();
  const actions = fixtureActions();

  // A message declared as both would be answered as a reply and silently never
  // run as an action, which reads as a handler that ignores half its calls.
  for (const message of Object.keys(replies)) {
    if (message in actions) {
      throw new Error(
        `dev fixtures: handler message "${message}" is declared both as a reply ` +
          'and as an action. It is one or the other.',
      );
    }
  }

  return {
    send(message: string, args: unknown[] = []): void {
      const action = actions[message];
      if (action) {
        action(...args);
        return;
      }

      // The promise-shaped protocol: `sendWithPromise` puts the callback id
      // first, and the browser answers by name on the global.
      const [id, ...rest] = args;
      const reply = replies[message];
      const cr = (globalThis as {cr?: CrGlobal}).cr;
      if (typeof id !== 'string' || !cr?.webUIResponse) {
        throw new Error(
          `dev fixtures: no handler answers "${message}", and the call carried no ` +
            'callback id, so nothing can be told about it.',
        );
      }

      // Asynchronous, like the real one. A synchronous answer resolves before
      // `sendWithPromise` has registered the pending call, and every reply is
      // dropped.
      queueMicrotask(() => {
        if (reply) {
          cr.webUIResponse?.(id, true, reply(...rest));
        } else {
          cr.webUIResponse?.(
            id,
            false,
            `no dev fixture answers "${message}". Add it to the section's ` +
              'own *.fixtures.ts, under `replies`.',
          );
        }
      });
    },
  };
}
