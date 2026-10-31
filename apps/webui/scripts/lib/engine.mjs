import { spawn } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { createServer as createNetServer } from "node:net";
import { join } from "node:path";
import { inflateSync } from "node:zlib";

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export const freePort = () =>
  new Promise((done) => {
    const probe = createNetServer();
    probe.listen(0, "127.0.0.1", () => {
      const { port } = probe.address();
      probe.close(() => done(port));
    });
  });

const UNREACHABLE = ["api.oxy.so", "api.nilo.so", "api.alia.onl", "kaana.ai"].map((host) => `MAP ${host} 0.0.0.0:9`);

export async function startEngine({ chrome, repo, scratch, extraArgs = [] }) {
  rmSync(scratch, { recursive: true, force: true });
  mkdirSync(join(scratch, "profile/Default"), { recursive: true });
  writeFileSync(join(scratch, "profile/Default/Preferences"), JSON.stringify({ net: { network_prediction_options: 0 } }));
  const debugPort = await freePort();
  const child = spawn(
    chrome,
    [
      `--user-data-dir=${join(scratch, "profile")}`,
      `--remote-debugging-port=${debugPort}`,
      `--astro-ui-dir=${join(repo, "apps/webui/dist")}`,
      `--host-resolver-rules=${[...UNREACHABLE, "MAP *.test 127.0.0.1"].join(", ")}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--password-store=basic",
      "--disable-features=HttpsUpgrades",
      ...extraArgs,
      "about:blank",
    ],
    { env: { ...process.env, ASTRO_BACKGROUND: "1" }, stdio: ["ignore", "ignore", "pipe"] },
  );
  let log = "";
  let exited = false;
  child.stderr.on("data", (chunk) => {
    log = (log + chunk).slice(-20000);
  });
  child.on("exit", () => {
    exited = true;
  });
  const waitFor = async (what, test, ms) => {
    for (const end = Date.now() + ms; Date.now() < end; await sleep(50)) {
      if (exited) throw new Error(`the engine exited while waiting for ${what}\n${log}`);
      const value = await test().catch(() => null);
      if (value) return value;
    }
    throw new Error(`timed out waiting for ${what}`);
  };
  const stop = async () => {
    if (!exited) child.kill("SIGTERM");
    for (const end = Date.now() + 8000; !exited && Date.now() < end; await sleep(100));
    if (!exited) child.kill("SIGKILL");
    rmSync(scratch, { recursive: true, force: true });
  };
  return { debugPort, waitFor, stop, log: () => log };
}

export const connect = (url) =>
  new Promise((done, fail) => {
    const socket = new WebSocket(url);
    const pending = new Map();
    const listeners = new Set();
    let id = 0;
    socket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.method) {
        for (const listener of listeners) listener(message);
        return;
      }
      const answer = pending.get(message.id);
      if (!answer) return;
      pending.delete(message.id);
      if (message.error) answer.fail(new Error(JSON.stringify(message.error)));
      else answer.done(message.result);
    };
    socket.onerror = () => fail(new Error(`cannot connect to ${url}`));
    socket.onopen = () =>
      done({
        send: (method, params = {}, sessionId) =>
          new Promise((ok, no) => {
            pending.set(++id, { done: ok, fail: no });
            socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
          }),
        listen: (listener) => {
          listeners.add(listener);
          return () => listeners.delete(listener);
        },
        close: () => socket.close(),
      });
  });

export async function windowPage(engine, { except = [] } = {}) {
  const base = `http://127.0.0.1:${engine.debugPort}`;
  const ui = await engine.waitFor(
    "the window page",
    async () =>
      (await (await fetch(`${base}/json/list`)).json()).find((target) => target.url.startsWith("chrome://webui-browser") && !except.includes(target.id)),
    60000,
  );
  const cdp = await connect(ui.webSocketDebuggerUrl);
  const run = async (expression) => {
    const { result, exceptionDetails } = await cdp.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (exceptionDetails) throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text);
    return result.value;
  };
  await engine.waitFor("the window page's modules", () => run("document.readyState === 'complete'"), 30000);
  await run(`(async () => {
    const cr = await import("chrome://resources/js/cr.js");
    const api = await import("/tab_strip_api/tab_strip_api.mojom-webui.js");
    const events = [];
    cr.addWebUiListener("astro-tab-event", (ref, kind, payload) => {
      if (kind === "pageScript") events.push({ ref, kind: payload.kind, json: payload.json, main: payload.main, frame: payload.frame, at: Date.now() });
    });
    globalThis.__astroTest = {
      events,
      service: api.TabStripService.getRemote(),
      open: async (url) => {
        const { tab } = await globalThis.__astroTest.service.createTabAt(null, url).then((t) => ({ tab: t.tab ?? t }));
        await cr.sendWithPromise("astroTabWatch", tab.id);
        return tab.id;
      },
      call: (ref, method, args) => cr.sendWithPromise("astroTabCall", ref, method, args),
    };
    return true;
  })()`);
  const call = (ref, method, args) => run(`__astroTest.call(${JSON.stringify(ref)}, ${JSON.stringify(method)}, ${JSON.stringify(args)})`);
  const evaluate = (ref, code) => call(ref, "evaluate", { code });
  return {
    id: ui.id,
    cdp,
    run,
    call,
    evaluate,
    open: (url) => run(`__astroTest.open(${JSON.stringify(url)})`),
    close: (ref) => run(`__astroTest.service.closeNodes([${JSON.stringify(ref)}])`).catch(() => {}),
    messages: (ref) => run(`__astroTest.events.filter((e) => e.ref === ${JSON.stringify(ref)})`),
    settle: (ref, url, ms = 15000) =>
      engine.waitFor(`${url} to load`, async () => (await evaluate(ref, "post('result', document.readyState === 'complete' ? location.href : '')")) === url, ms),
    browser: async () => connect((await (await fetch(`${base}/json/version`)).json()).webSocketDebuggerUrl),
  };
}

export function decodePng(base64) {
  const data = Buffer.from(base64, "base64");
  let offset = 8;
  let width = 0;
  let height = 0;
  let channels = 0;
  const chunks = [];
  while (offset < data.length) {
    const length = data.readUInt32BE(offset);
    const type = data.toString("latin1", offset + 4, offset + 8);
    const body = data.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      if (body[8] !== 8 || body[12] !== 0) throw new Error("decodePng: only 8-bit, non-interlaced PNGs");
      channels = { 2: 3, 6: 4 }[body[9]];
      if (!channels) throw new Error(`decodePng: colour type ${body[9]}`);
    } else if (type === "IDAT") chunks.push(body);
    offset += 12 + length;
  }
  const raw = inflateSync(Buffer.concat(chunks));
  const stride = width * channels;
  const pixels = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const left = x >= channels ? pixels[y * stride + x - channels] : 0;
      const up = y > 0 ? pixels[(y - 1) * stride + x] : 0;
      const corner = y > 0 && x >= channels ? pixels[(y - 1) * stride + x - channels] : 0;
      const paeth = () => {
        const p = left + up - corner;
        const [a, b, c] = [Math.abs(p - left), Math.abs(p - up), Math.abs(p - corner)];
        return a <= b && a <= c ? left : b <= c ? up : corner;
      };
      const predictor = [0, left, up, (left + up) >> 1, filter === 4 ? paeth() : 0][filter];
      pixels[y * stride + x] = (line[x] + predictor) & 0xff;
    }
  }
  return { width, height, channels, pixels };
}

export function colorShare(base64, hex, tolerance = 6) {
  const { width, height, channels, pixels } = decodePng(base64);
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  let matching = 0;
  for (let i = 0; i < width * height; i++) {
    const at = i * channels;
    if (Math.abs(pixels[at] - r) <= tolerance && Math.abs(pixels[at + 1] - g) <= tolerance && Math.abs(pixels[at + 2] - b) <= tolerance) matching++;
  }
  return matching / (width * height);
}
