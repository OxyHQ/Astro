export type Delivery = (event: string, run: () => void) => void;
export type RawEvents = {
  addListener(channel: "*", listener: (event: { eventName: string }) => void): { remove(): void };
};
type Options = {
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

export function createHold({ schedule, report, transaction = (run) => run() }: Options) {
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
        while (next < held.length) {
          try {
            transaction(() => drain(errors));
          } catch (error) {
            errors.push(error);
          }
        }
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
  return { hold, flush };
}

export function holdPageReports(deliverEvents: (delivery: Delivery) => void, { hold }: Hold) {
  deliverEvents((event, run) => (HELD_EVENTS.has(`top${event.slice(2)}`) ? hold(run) : run()));
}

export function flushBeforeOtherEvents(events: RawEvents, { flush }: Hold) {
  return events.addListener("*", ({ eventName }) => {
    if (!HELD_EVENTS.has(eventName)) flush();
  });
}

const g = globalThis as unknown as {
  RN$Bridgeless?: boolean;
  __acHeldReports?: { remove(): void };
  ErrorUtils?: { reportFatalError(error: unknown): void };
};
if (g.RN$Bridgeless === true) {
  g.__acHeldReports?.remove();
  const { deliverWebViewEvents } = require("@astro-browser/astrocore") as typeof import("@astro-browser/astrocore");
  const rawEvents = (require("react-native/Libraries/Core/RawEventEmitter") as { default: RawEvents }).default;
  const transaction = (run: () => void) => (require("../store/browser") as typeof import("../store/browser")).storeTransaction(run);
  const held = createHold({ transaction, schedule: (callback) => queueMicrotask(callback), report: (error) => g.ErrorUtils?.reportFatalError(error) });
  holdPageReports(deliverWebViewEvents, held);
  g.__acHeldReports = flushBeforeOtherEvents(rawEvents, held);
}
