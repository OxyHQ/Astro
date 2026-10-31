import assert from "node:assert/strict";
import { test } from "node:test";
const { createHold, flushBeforeOtherEvents, holdPageReports } = await import("./nativeEvents.ts");

function setup({ transaction } = {}) {
  const log = [];
  const scheduled = [];
  const errors = [];
  const held = createHold({ transaction, schedule: (callback) => scheduled.push(callback), report: (e) => errors.push(e.message) });
  let delivery;
  holdPageReports((next) => (delivery = next), held);
  const raw = [];
  flushBeforeOtherEvents({ addListener: (_channel, listener) => (raw.push(listener), { remove() {} }) }, held);
  const dispatch = (handler, body = {}) => {
    const eventName = `top${handler.slice(2)}`;
    for (const listener of raw) listener({ eventName });
    delivery(handler, () => {
      if (body.throws) throw new Error(body.throws);
      log.push(handler);
      if (body.reenter) {
        held.flush();
        log.push("listener");
      }
    });
  };
  const other = (eventName) => {
    for (const listener of raw) listener({ eventName });
    log.push(eventName);
  };
  return { log, scheduled, errors, held, dispatch, other };
}

test("page reports wait for the end of the task, then apply in order", () => {
  const { log, scheduled, dispatch } = setup();
  dispatch("onNavigationChange");
  dispatch("onProgress");
  dispatch("onFavicon");
  assert.deepEqual(log, [], "held");
  assert.equal(scheduled.length, 1, "one flush scheduled for the run");
  scheduled[0]();
  assert.deepEqual(log, ["onNavigationChange", "onProgress", "onFavicon"]);
  scheduled[0]();
  assert.equal(log.length, 3, "a second flush has nothing left");
});

test("any other event applies the held reports before it runs", () => {
  const { log, scheduled, dispatch, other } = setup();
  dispatch("onNavigationChange");
  dispatch("onOpenWindow");
  assert.deepEqual(log, ["onNavigationChange", "onOpenWindow"], "a page opening a window isn't held, and comes after");
  dispatch("onProgress");
  other("topTouchStart");
  dispatch("onStatus");
  other("topLayout");
  assert.deepEqual(log.slice(2), ["onProgress", "topTouchStart", "onStatus", "topLayout"]);
  assert.equal(scheduled.length, 3, "a new run after each flush schedules its own");
});

test("a report that throws doesn't drop the ones after it, and is reported from a task of its own", () => {
  const { log, errors, scheduled, dispatch } = setup();
  dispatch("onNavigationChange", { throws: "boom" });
  dispatch("onProgress");
  scheduled[0]();
  assert.deepEqual(log, ["onProgress"]);
  assert.deepEqual(errors, []);
  scheduled[1]();
  assert.deepEqual(errors, ["boom"]);
});

test("a flush set off while one runs applies the rest first", () => {
  const { log, scheduled, dispatch } = setup();
  dispatch("onNavigationChange", { reenter: true });
  dispatch("onProgress");
  dispatch("onFavicon");
  scheduled[0]();
  assert.deepEqual(log, ["onNavigationChange", "onProgress", "onFavicon", "listener"]);
});

test("a reporter that throws can't drop reports", () => {
  const log = [];
  const scheduled = [];
  const held = createHold({ schedule: (c) => scheduled.push(c), report: () => { throw new Error("reporter"); } });
  const run = (name, throws) => held.hold(() => {
    if (throws) throw new Error("boom");
    log.push(name);
  });
  run("onNavigationChange", true);
  run("onProgress");
  scheduled[0]();
  assert.deepEqual(log, ["onProgress"]);
  assert.throws(() => scheduled[1](), /reporter/, "the reporter's own error surfaces in its task");
  run("onMedia", true);
  run("onStatus", true);
  scheduled[2]();
  assert.equal(scheduled.length, 5, "two errors, two tasks: one throwing reporter can't swallow the other");
  run("onStatus");
  scheduled[5]();
  assert.deepEqual(log, ["onProgress", "onStatus"], "and the queue starts afresh");
});

test("a flush's reports run in one store transaction; a listener's error at its end is reported like a report's", () => {
  let ends = 0;
  const marks = [];
  const transaction = (run) => {
    marks.push("{");
    run();
    marks.push("}");
    if (++ends === 2) throw new Error("listener");
  };
  const { log, scheduled, errors, dispatch } = setup({ transaction });
  dispatch("onNavigationChange");
  dispatch("onProgress");
  scheduled[0]();
  assert.deepEqual(log, ["onNavigationChange", "onProgress"]);
  assert.deepEqual(marks, ["{", "}"]);
  dispatch("onFavicon");
  scheduled[1]();
  assert.deepEqual(marks, ["{", "}", "{", "}"]);
  assert.deepEqual(errors, []);
  scheduled[2]();
  assert.deepEqual(errors, ["listener"]);
  dispatch("onStatus");
  scheduled[3]();
  assert.deepEqual(marks.slice(4), ["{", "}"], "and the next flush starts afresh");
});
