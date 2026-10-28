#!/usr/bin/env node
// Clicks the window buttons (close, minimize, zoom) with real X input and checks the window does what they say, with the
// sidebar docked, peeking and as a top strip, and that the empty sidebar header is still the window's drag region
// (Xvfb has no window manager to move it; the region is what the window manager is handed). The peek opens and is
// clicked through the browser's own input pipeline: Xvfb sends no hover to an unfocused frame. Runs the Linux
// engine hidden on its own Xvfb display with a small window manager that records maximize, restore and minimize
// requests, and a throwaway profile; needs a built interface (pnpm -C apps/webui build).
//
//   node apps/webui/scripts/window-buttons-test.mjs [--display :81] [--port 9381] [--ui <dist dir>] [--engine <chrome>]
import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
if (args.includes("-h") || args.includes("--help")) {
  console.log("usage: node apps/webui/scripts/window-buttons-test.mjs [--display :81] [--port 9381] [--ui <dist dir>] [--engine <chrome>]");
  process.exit(0);
}
const option = (name, fallback) => {
  const at = args.indexOf(name);
  return at >= 0 ? args[at + 1] : fallback;
};
const here = dirname(fileURLToPath(import.meta.url));
const display = option("--display", ":81");
const port = Number(option("--port", "9381"));
const ui = resolve(option("--ui", join(here, "..", "dist")));
const engine = option("--engine", join(process.env.HOME, "chromium-build/chromium_git/chromium/src/out/Release_GN_x64_dev/chrome"));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const XTEST = `
import ctypes, sys, time
x11 = ctypes.CDLL("libX11.so.6"); xt = ctypes.CDLL("libXtst.so.6")
x11.XOpenDisplay.restype = ctypes.c_void_p
d = ctypes.c_void_p(x11.XOpenDisplay(sys.argv[1].encode()))
for cmd in sys.argv[2:]:
    op, _, arg = cmd.partition(":")
    if op == "move":
        x, y = map(int, arg.split(",")); xt.XTestFakeMotionEvent(d, -1, x, y, 0)
    elif op == "down": xt.XTestFakeButtonEvent(d, 1, 1, 0)
    elif op == "up": xt.XTestFakeButtonEvent(d, 1, 0, 0)
    elif op == "wait": x11.XFlush(d); time.sleep(float(arg))
    x11.XFlush(d)
x11.XCloseDisplay(d)
`;
const WINDOW_MANAGER = `import ctypes, sys, json
x11 = ctypes.CDLL("libX11.so.6")
x11.XOpenDisplay.restype = ctypes.c_void_p
x11.XDefaultRootWindow.restype = ctypes.c_ulong
x11.XInternAtom.restype = ctypes.c_ulong
x11.XGetAtomName.restype = ctypes.c_char_p
d = ctypes.c_void_p(x11.XOpenDisplay(sys.argv[1].encode()))
root = x11.XDefaultRootWindow(d)
SubstructureRedirect, SubstructureNotify = 1 << 20, 1 << 19
x11.XSelectInput(d, ctypes.c_ulong(root), ctypes.c_long(SubstructureRedirect | SubstructureNotify))
x11.XSync(d, 0)
atom = lambda n: x11.XInternAtom(d, n.encode(), 0)
NET_STATE, MAX_V, MAX_H, HIDDEN = atom("_NET_WM_STATE"), atom("_NET_WM_STATE_MAXIMIZED_VERT"), atom("_NET_WM_STATE_MAXIMIZED_HORZ"), atom("_NET_WM_STATE_HIDDEN")
CHANGE_STATE, XA_ATOM = atom("WM_CHANGE_STATE"), 4
ACTIVE, MOVERESIZE = atom("_NET_ACTIVE_WINDOW"), atom("_NET_WM_MOVERESIZE")
ev = (ctypes.c_char * 192)()
L = lambda o: ctypes.c_long.from_buffer(ev, o).value
U = lambda o: ctypes.c_ulong.from_buffer(ev, o).value
I = lambda o: ctypes.c_int.from_buffer(ev, o).value
states = {}
def set_state(w, atoms):
    states[w] = atoms
    arr = (ctypes.c_ulong * max(1, len(atoms)))(*atoms)
    x11.XChangeProperty(d, ctypes.c_ulong(w), ctypes.c_ulong(NET_STATE), ctypes.c_ulong(XA_ATOM), 32, 0, arr, len(atoms))
def say(o):
    print(json.dumps(o), flush=True)
say({"ready": True})
while True:
    x11.XNextEvent(d, ev)
    t = I(0)
    if t == 20:
        w = U(40)
        x11.XMapWindow(d, ctypes.c_ulong(w))
        x11.XSetInputFocus(d, ctypes.c_ulong(w), 1, 0)
        arr = (ctypes.c_ulong * 1)(w)
        x11.XChangeProperty(d, ctypes.c_ulong(root), ctypes.c_ulong(ACTIVE), ctypes.c_ulong(33), 32, 0, arr, 1)
    elif t == 23:
        w = U(40)
        if MAX_V in states.get(w, []):
            x11.XMoveResizeWindow(d, ctypes.c_ulong(w), 0, 0, 1600, 1000)
        else:
            x11.XMoveResizeWindow(d, ctypes.c_ulong(w), I(48), I(52), max(1, I(56)), max(1, I(60)))
    elif t == 33:
        w, kind = U(32), U(40)
        if kind == NET_STATE:
            action, a, b = L(56), U(64), U(72)
            if MAX_V in (a, b) or MAX_H in (a, b):
                on = action == 1 or (action == 2 and MAX_V not in states.get(w, []))
                if on:
                    set_state(w, [MAX_V, MAX_H]); x11.XMoveResizeWindow(d, ctypes.c_ulong(w), 0, 0, 1600, 1000)
                else:
                    set_state(w, [])
                say({"request": "maximize" if on else "restore"})
        elif kind == CHANGE_STATE and L(56) == 3:
            set_state(w, [HIDDEN]); say({"request": "minimize"})
        elif kind == ACTIVE and HIDDEN in states.get(w, []):
            set_state(w, []); say({"request": "activate"})
        elif kind == MOVERESIZE and L(72) == 8:
            say({"request": "move"})
    x11.XFlush(d)
`;
const x = (...steps) => execFileSync("python3", ["-I", "-c", XTEST, display, ...steps], { timeout: 20000 });

if (existsSync(`/tmp/.X${display.slice(1)}-lock`)) {
  console.log(`display ${display} is in use: pick a free one with --display`);
  process.exit(64);
}
const data = mkdtempSync(join(tmpdir(), "astro-window-buttons-"));
const xvfb = spawn("Xvfb", [display, "-screen", "0", "1600x1000x24", "-nolisten", "tcp"], { stdio: "ignore" });
const requests = [];
let wm;
let browser;
let failed = false;
const check = (name, ok, detail) => {
  if (!ok) failed = true;
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail === undefined ? "" : ` ${JSON.stringify(detail)}`}`);
};

async function connect() {
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    try {
      const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
      const ui = targets.find((t) => t.type === "browser_ui");
      if (ui) {
        const version = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
        return { page: await socket(ui.webSocketDebuggerUrl), browser: await socket(version.webSocketDebuggerUrl), target: ui.id };
      }
    } catch {}
    await sleep(500);
  }
  throw new Error("the engine never opened its window");
}

async function socket(url) {
  const ws = new WebSocket(url);
  await new Promise((r, j) => ((ws.onopen = r), (ws.onerror = j)));
  let id = 0;
  const pending = new Map();
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data);
    if (d.id && pending.has(d.id)) pending.get(d.id)(d), pending.delete(d.id);
  };
  const send = (method, params = {}) => new Promise((r) => {
    const i = ++id;
    pending.set(i, r);
    ws.send(JSON.stringify({ id: i, method, params }));
  });
  return { send, close: () => ws.close() };
}

async function main() {
  await sleep(800);
  const startWindowManager = async () => {
    wm = spawn("python3", ["-I", "-c", WINDOW_MANAGER, display], { stdio: ["ignore", "pipe", "inherit"] });
    wm.stdout.setEncoding("utf8");
    wm.stdout.on("data", (chunk) => {
      for (const line of chunk.split("\n").filter(Boolean)) {
        const message = JSON.parse(line);
        if (message.request) requests.push(message.request);
      }
    });
    await sleep(500);
  };

  await startWindowManager();
  browser = spawn(engine, [
    `--user-data-dir=${data}`, `--astro-ui-dir=${ui}`, `--remote-debugging-port=${port}`, "--no-first-run", "--no-default-browser-check",
    "--password-store=basic", "--window-position=0,0", "--window-size=1440,900",
    "--host-resolver-rules=MAP api.oxy.so ~NOTFOUND, MAP api.nilo.so ~NOTFOUND, MAP api.alia.onl ~NOTFOUND, MAP kaana.ai ~NOTFOUND",
  ], { env: { ...process.env, DISPLAY: display }, stdio: "ignore" });
  const { page, browser: cdp, target } = await connect();
  const evaluate = async (expression) => (await page.send("Runtime.evaluate", { expression: `(async () => { ${expression} })()`, awaitPromise: true, returnByValue: true })).result?.result?.value;
  const tab = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((t) => t.type === "page");
  const { windowId } = (await cdp.send("Browser.getWindowForTarget", { targetId: tab?.id ?? target })).result;
  const state = async () => (await cdp.send("Browser.getWindowBounds", { windowId })).result.bounds;
  const normal = async () => {
    requests.length = 0;
    await cdp.send("Browser.setWindowBounds", { windowId, bounds: { windowState: "normal" } });
    await cdp.send("Browser.setWindowBounds", { windowId, bounds: { left: 0, top: 0, width: 1440, height: 900 } });
    await sleep(800);
  };
  await sleep(3000);
  const origin = () => evaluate(`const side = (outerWidth - innerWidth) / 2; return [screenX + side, screenY + outerHeight - innerHeight - side];`);
  let [dx, dy] = await origin();
  const buttons = () => evaluate(`return [...document.querySelectorAll(".astro-window-control")].map((b) => { const r = b.getBoundingClientRect(); return { name: b.getAttribute("aria-label"), x: r.left + r.width / 2, y: r.top + r.height / 2, hit: document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) === b }; }).filter((b) => b.x > 0);`);
  const asked = async (request) => {
    const deadline = Date.now() + 3000;
    while (Date.now() < deadline) {
      const at = requests.indexOf(request);
      if (at >= 0) return requests.splice(at, 1).length === 1;
      await sleep(100);
    }
    return false;
  };
  const click = async (b) => {
    [dx, dy] = await origin();
    clickAt(b);
  };
  const clickAt = (b) => x(`move:${Math.round(b.x + dx)},${Math.round(b.y + dy)}`, "wait:0.15", "down", "wait:0.05", "up", "wait:0.8");
  const store = (code) => evaluate(`const s = astro.store.getState(); const w = s.windowOrder[0]; ${code}`);


  await store(`s.updateSettings({ tabLayout: "sidebar" }); if (!s.windows[w].sidebarOpen) s.toggleSidebar(w); return true;`);
  await sleep(1200);
  const header = await evaluate(`const region = (x, y) => getComputedStyle(document.elementFromPoint(x, y)).getPropertyValue("app-region");
    const lights = [...document.querySelectorAll(".astro-window-control")].map((b) => { const r = b.getBoundingClientRect(); return region(r.left + r.width / 2, r.top + r.height / 2); });
    return { empty: [region(120, 12), region(150, 40), region(180, 12)], lights };`);
  check("the empty sidebar header is the window's drag region, the buttons are not", header.empty.every((r) => r === "drag") && header.lights.length === 3 && header.lights.every((r) => r === "no-drag"), header);

  await store(`s.updateSettings({ tabLayout: "sidebar" }); if (s.windows[w].sidebarOpen) s.toggleSidebar(w); return true;`);
  await sleep(1200);
  await page.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: 700, y: 400 });
  await page.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: 2, y: 400 });
  await sleep(1200);
  const peeked = await buttons();
  check("peeking: three buttons, each on top where it is drawn", peeked?.length === 3 && peeked.every((b) => b.hit), peeked);
  const peekZoom = peeked?.find((b) => b.name === "zoom");
  if (peekZoom) {
    requests.length = 0;
    const at = { x: Math.round(peekZoom.x), y: Math.round(peekZoom.y) };
    await page.send("Input.dispatchMouseEvent", { type: "mouseMoved", ...at });
    await sleep(200);
    await page.send("Input.dispatchMouseEvent", { type: "mousePressed", ...at, button: "left", buttons: 1, clickCount: 1 });
    await page.send("Input.dispatchMouseEvent", { type: "mouseReleased", ...at, button: "left", buttons: 0, clickCount: 1 });
    check("peeking: zoom maximizes", await asked("maximize"));
  }

  const layouts = [
    ["docked", `if (!s.windows[w].sidebarOpen) s.toggleSidebar(w); s.updateSettings({ tabLayout: "sidebar" }); return true;`, null],
    ["top strip", `s.updateSettings({ tabLayout: "top" }); if (!s.windows[w].sidebarOpen) s.toggleSidebar(w); return true;`, null],
  ];
  for (const [name, setup, peek] of layouts) {
    await normal();
    await store(setup);
    await sleep(1200);
    if (peek) x(`move:${2 + dx},${400 + dy}`, "wait:1.2");
    const found = await buttons();
    check(`${name}: three buttons, each on top where it is drawn`, found?.length === 3 && found.every((b) => b.hit), found);
    const zoom = found?.find((b) => b.name === "zoom");
    const minimize = found?.find((b) => b.name === "minimize");
    if (zoom) {
      requests.length = 0;
      await click(zoom);
      const maximized = await asked("maximize");
      const state1 = (await state()).windowState;
      await evaluate(`const deadline = Date.now() + 3000; while (Date.now() < deadline && !(outerWidth >= screen.availWidth && outerHeight >= screen.availHeight)) await new Promise((r) => setTimeout(r, 50)); await new Promise((r) => setTimeout(r, 300)); return true;`);
      if (peek) x(`move:${2 + dx},${400 + dy}`, "wait:1.2");
      const again = (await buttons())?.find((b) => b.name === "zoom");
      const size = await evaluate(`return [outerWidth, outerHeight, screen.availWidth, screen.availHeight];`);
      if (again) await click(again);
      const restored = await asked("restore");
      check(`${name}: zoom maximizes, then restores`, maximized && restored && state1 === "maximized", { maximized, state: state1, restored, size });
    }
    await normal();
    if (peek) x(`move:${2 + dx},${400 + dy}`, "wait:1.2");
    if (minimize) {
      requests.length = 0;
      const current = (await buttons())?.find((b) => b.name === "minimize") ?? minimize;
      await click(current);
      check(`${name}: minimize asks the window manager to minimize`, await asked("minimize"));
    }
  }

  await normal();
  const close = (await buttons())?.find((b) => b.name === "close");
  if (close) await click(close);
  await sleep(1500);
  const open = await fetch(`http://127.0.0.1:${port}/json`).then((r) => r.json()).then((t) => t.some((x) => x.type === "browser_ui")).catch(() => false);
  check("close closes the window", !open);
  page.close();
  cdp.close();
}

try {
  await main();
} catch (error) {
  check("run", false, String(error));
} finally {
  browser?.kill();
  wm?.kill();
  xvfb.kill();
  await sleep(500);
  rmSync(data, { recursive: true, force: true });
}
process.exit(failed ? 1 : 0);
