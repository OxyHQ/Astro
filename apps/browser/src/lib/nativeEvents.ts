export type Bridge = {
  __callFunction(module: string, method: string, args: unknown[]): void;
  __invokeCallback(id: number, args: unknown[]): void;
};
export type Emitter = {
  addListener(this: unknown, name: string, listener: (...args: unknown[]) => unknown): unknown;
  removeListener(this: unknown, name: string, listener: unknown): unknown;
};
type Options = {
  batch: (update: () => void) => void;
  schedule: (callback: () => void) => void;
  report: (error: unknown) => void;
  transaction?: (run: () => void) => void;
};
export type Hold = ReturnType<typeof createHold>;

export const HELD_EVENTS: ReadonlySet<string> = new Set([
  "topNavigationChange",
  "topProgress",
  "topFavicon",
  "topMedia",
  "topNowPlaying",
  "topStatus",
  "topSecurity",
  "topContentBlocked",
  "topMediaAccess",
  "topLoadError",
]);
export function createHold({ batch, schedule, report, transaction = (run) => run() }: Options) {
  let held: (() => void)[] = [];
  let next = 0;
  let flushing = false;

  const drain = (errors: unknown[]) => {
    while (next < held.length) {
      try {
        held[next++]!();
      } catch (error) {
        errors.push(error);
      }
    }
  };
  const flush = () => {
    if (next >= held.length) return;
    const errors: unknown[] = [];
    if (flushing) drain(errors);
    else {
      flushing = true;
      try {
        batch(() => {
          while (next < held.length) {
            try {
              transaction(() => drain(errors));
            } catch (error) {
              errors.push(error);
            }
          }
        });
      } finally {
        held = [];
        next = 0;
        flushing = false;
      }
    }
    for (const error of errors) schedule(() => report(error));
  };
  const hold = (run: () => void) => {
    if (!held.length) schedule(flush);
    held.push(run);
  };
  return { hold, flush, batch };
}

export function holdPageReports(bridge: Bridge, { hold, flush }: Hold) {
  const call = bridge.__callFunction.bind(bridge);
  const invoke = bridge.__invokeCallback.bind(bridge);
  bridge.__callFunction = (module, method, args) => {
    if (module === "RCTEventEmitter" && method === "receiveEvent" && HELD_EVENTS.has(args[1] as string)) {
      hold(() => call(module, method, args));
      return;
    }
    flush();
    call(module, method, args);
  };
  bridge.__invokeCallback = (id, args) => {
    flush();
    invoke(id, args);
  };
}

export function afterHeldReports(emitter: Emitter, { flush, batch }: Hold) {
  const add = emitter.addListener;
  const remove = emitter.removeListener;
  const wrapped = new WeakMap<object, Map<string, (...args: unknown[]) => unknown>>();
  emitter.addListener = function (name, listener) {
    if (typeof listener !== "function") return add.call(this, name, listener);
    let byName = wrapped.get(listener);
    if (!byName) wrapped.set(listener, (byName = new Map()));
    let wrapper = byName.get(name);
    if (!wrapper) {
      wrapper = function (this: unknown, ...args: unknown[]) {
        let result: unknown;
        batch(() => {
          flush();
          result = listener.apply(this, args);
        });
        return result;
      };
      byName.set(name, wrapper);
    }
    return add.call(this, name, wrapper);
  };
  emitter.removeListener = function (name, listener) {
    return remove.call(this, name, (typeof listener === "function" && wrapped.get(listener)?.get(name)) || listener);
  };
}

const g = globalThis as unknown as {
  __acApplyHeldReports?: () => void;
  __fbBatchedBridge?: Bridge;
  expo?: { EventEmitter?: { prototype: Emitter } };
  ErrorUtils?: { reportFatalError(error: unknown): void };
};
const bridge = g.__fbBatchedBridge;
const emitter = g.expo?.EventEmitter?.prototype;
if (!g.__acApplyHeldReports && bridge && emitter && typeof bridge.__callFunction === "function" && typeof bridge.__invokeCallback === "function") {
  const batch = (update: () => void) => (require("react-native") as typeof import("react-native")).unstable_batchedUpdates(update);
  const transaction = (run: () => void) => (require("../store/browser") as typeof import("../store/browser")).storeTransaction(run);
  const held = createHold({ batch, transaction, schedule: (callback) => setTimeout(callback, 0), report: (error) => g.ErrorUtils?.reportFatalError(error) });
  holdPageReports(bridge, held);
  afterHeldReports(emitter, held);
  g.__acApplyHeldReports = held.flush;
}

export const applyHeldReports = () => g.__acApplyHeldReports?.();
