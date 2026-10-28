#!/usr/bin/env node
// Runs a built Astro.app hidden on a scratch profile, with the in-app harness, and checks the shared interface works
// on macOS: a browser window renders, the Oxy session resolves, Sign in with Oxy opens its dialog, and the Chat panel
// opens in the window's sidebar, the window layout hides, peeks and splits (two panes, three with a stack), and the
// neighbour profile's page waits painted behind the shown one for the profile swipe. Saves a picture of the window after each step, the harness answers and the app's
// log in <out dir>. Exits 1 when a check fails.
//
//   scripts/ci/macos-ui-smoke.mjs <Astro.app> <out dir>
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { launch } from "../lib/instance.mjs";

const [app, outArg] = process.argv.slice(2);
if (!app || !outArg || app === "-h" || app === "--help") {
  console.log("usage: scripts/ci/macos-ui-smoke.mjs <Astro.app> <out dir>");
  process.exit(app ? 0 : 64);
}
const out = resolve(outArg);
mkdirSync(out, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
let failed = false;

function check(name, ok, detail) {
  results.push({ name, ok, detail });
  if (!ok) failed = true;
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail === undefined ? "" : ` ${JSON.stringify(detail)}`}`);
}

async function until(instance, body, { timeout = 30000, every = 250 } = {}) {
  const deadline = Date.now() + timeout;
  let last;
  while (Date.now() < deadline) {
    last = await instance.eval(body, { timeout: 5000 }).catch((e) => ({ error: e.message }));
    if (last && !last.error && last.ok) return last;
    await sleep(every);
  }
  return last;
}

function picture(instance, name) {
  const file = join(out, `${name}.png`);
  try {
    const [window] = instance.windows();
    execFileSync("screencapture", window ? ["-x", "-o", "-l", String(window), file] : ["-x", file], { timeout: 20000 });
    return file;
  } catch (e) {
    console.log(`picture ${name}: ${e.message}`);
    return null;
  }
}

const instance = await launch(app, { data: join(out, "data"), js: "none", probe: true, onboarded: true, startTimeout: 180000, ready: { timeout: 180000 } });
try {
  const window = await until(
    instance,
    `const s = ac.store.getState(); const id = s.ui.focusedWindowId ?? s.windowOrder[0]; return { ok: !!id && !!s.windows[id], id, windows: s.windowOrder.length };`,
  );
  check("browser window", !!window?.ok, window);
  await sleep(2000);
  picture(instance, "1-window");
  const windowId = window?.id;

  const session = await until(instance, `const o = ac.oxy.useOxySession.getState(); return { ok: o.wanted && o.resolved && !!o.openSignIn, signedIn: !!o.account };`, { timeout: 60000 });
  check("Oxy session resolved", !!session?.ok, session);

  const signIn = await instance
    .eval(
      `return ac.oxy.signInWithOxy().then((signedIn) => new Promise((r) => setTimeout(() => {
         const dialog = ac.oxy.useOxySession.getState().accountDialogOpen;
         r({ ok: signedIn === false && dialog, signedIn, dialog });
       }, 2500)));`,
      { timeout: 30000 },
    )
    .catch((e) => ({ error: e.message }));
  check("Sign in with Oxy opened", !!signIn?.ok, signIn);
  picture(instance, "2-sign-in");

  const chat = await instance
    .eval(
      `ac.chat.openChatPanel(${JSON.stringify(windowId)}); return new Promise((r) => setTimeout(() => {
         const open = !!ac.chat.useChat.getState().windows[${JSON.stringify(windowId)}]?.open;
         const slot = !!ac.chat.useChatSlots.getState().slots[ac.chat.windowSlotKey(${JSON.stringify(windowId)})];
         r({ ok: open && slot, open, slot });
       }, 2500));`,
      { timeout: 20000 },
    )
    .catch((e) => ({ error: e.message }));
  check("Chat panel opened", !!chat?.ok, chat);
  picture(instance, "3-chat");
  const id = JSON.stringify(windowId);
  const step = (body, timeout = 20000) => instance.eval(body, { timeout }).catch((e) => ({ error: e.message }));
  const wait = (ms) => `new Promise((r) => setTimeout(r, ${ms}))`;
  await step(`ac.chat.closeChat?.(${id}); return true;`);
  const hidden = await step(`const s = ac.store.getState(); if (s.windows[${id}].sidebarOpen !== false) s.toggleSidebar(${id}); return ${wait(900)}.then(() => ({ ok: ac.store.getState().windows[${id}].sidebarOpen === false }));`);
  check("sidebar hidden", !!hidden?.ok, hidden);
  picture(instance, "4-sidebar-hidden");
  const peek = await step(`const p = globalThis.acLayout?.peek?.[${id}]; p?.show(); return ${wait(700)}.then(() => ({ ok: true, driven: !!p }));`);
  check("sidebar peek", !!peek?.ok, peek);
  picture(instance, "5-sidebar-peek");
  await step(`globalThis.acLayout?.peek?.[${id}]?.hide(); const s = ac.store.getState(); s.toggleSidebar(${id}); return ${wait(900)}.then(() => true);`);
  const split = await step(`const s = ac.store.getState(); const w = s.windows[${id}]; const first = w.activeTabIds[w.profileId]; const r = s.openSplitPane(${id}, { url: "about:blank", anchorTabId: first, side: "right" }); return ${wait(1500)}.then(() => ({ ok: r.ok && (ac.paneLayout.getState()[${id}]?.visible.length ?? 0) === 2, layout: ac.paneLayout.getState()[${id}] }));`);
  check("two panes", !!split?.ok, split);
  picture(instance, "6-split-2");
  const stacked = await step(`const s = ac.store.getState(); const sp = Object.values(s.splits).find((v) => v.windowId === ${id}); const r = s.openSplitPane(${id}, { url: "about:blank", anchorTabId: sp.tabIds.at(-1), side: "bottom" }); return ${wait(1500)}.then(() => { const v = Object.values(ac.store.getState().splits).find((x) => x.windowId === ${id}); return { ok: r.ok && !!v?.stack && (ac.paneLayout.getState()[${id}]?.visible.length ?? 0) === 3, split: v }; });`);
  check("three panes, two stacked", !!stacked?.ok, stacked);
  picture(instance, "7-split-stacked");
  const warm = await step(
    `const s = ac.store.getState(); for (const v of Object.values(s.splits)) if (v.windowId === ${id}) s.separateSplit(v.id);
     const home = s.windows[${id}].profileId; const other = s.createProfile({ name: "Smoke" });
     s.switchProfile(${id}, other); s.newTab(${id}, { url: "about:blank", profileId: other });
     return ${wait(1500)}.then(() => { ac.store.getState().switchProfile(${id}, home); return ${wait(2000)}; }).then(() => {
       const st = ac.store.getState(); const neighbour = st.windows[${id}].activeTabIds[other];
       const layout = ac.paneLayout.getState()[${id}];
       return { ok: !!neighbour && !!layout?.behind.includes(neighbour), neighbour, layout };
     });`,
    30000,
  );
  check("the neighbour profile's page waits painted behind (profile swipe)", !!warm?.ok, warm);
  picture(instance, "8-profile-neighbour");
} finally {
  writeFileSync(join(out, "results.json"), JSON.stringify(results, null, 2));
  writeFileSync(join(out, "app.log"), instance.output());
  await instance.quit().catch(() => instance.kill());
}
process.exit(failed ? 1 : 0);
