import type { UpdateChannel, UpdaterState } from "@astro-browser-real/shell";
import { hideKeyedToast, showToast } from "../../../browser/src/components/layout/splitActions";
import { openUrls } from "../../../browser/src/lib/actions";
import { provideNativeModule } from "../../../demo/src/shims/expo-modules-core";
import { readDocument, writeDocument } from "../shims/shell";
import { channelOfVersion, compareVersions, displayVersion, newestOffer, parseAppcast, type UpdateOffer } from "./appcast";
import { loadCr } from "./engine";
import { isLeaderPage, pageWindowId } from "./windows";

declare const __ASTRO_VERSION__: string;
declare const __ASTRO_UPDATE_KEY__: string;
declare const __ASTRO_UPDATE_FEED__: string;
declare const __ASTRO_UPDATE_INTERVAL__: number;

type Settings = {
  automaticChecks: boolean;
  automaticDownloads: boolean;
  channel: UpdateChannel | null;
  lastCheck: number | null;
  ready: UpdateOffer | null;
};

type EngineInfo = { supported: boolean; installed: boolean; isolated: boolean; feed?: string };
type EngineReply = { ok?: boolean; error?: string };
type Announcement = { kind: "ready" | "available"; offer: UpdateOffer };

const DOCUMENT = "updater.json";
const RELEASE_NOTES = "https://astro.oxy.so/release-notes";
const VERSION = __ASTRO_VERSION__;
const BUILD_CHANNEL = channelOfVersion(VERSION);
const WINDOWS = /Win/.test(navigator.platform);
const FIRST_CHECK_DELAY_MS = 30_000;
const TICK_MS = 10 * 60_000;
const INTERVAL_MS = Math.max(3600, __ASTRO_UPDATE_INTERVAL__ || 86_400) * 1000;
const PROGRESS_TOAST = "astro-update-progress";
const OFFER_TOAST = "astro-update";

const announcements = new BroadcastChannel("astro-updater");
let engineInfo: Promise<EngineInfo | null> | null = null;
let session: Promise<void> | null = null;
let progressShown: string | null = null;
let started = false;
let listening = false;

const updaterCall = async <T>(method: string, args: Record<string, unknown> = {}): Promise<T | null> =>
  (await loadCr()).sendWithPromise<T | null>("astroUpdater", method, args);

function settings(): Settings {
  let stored: Partial<Settings> = {};
  try {
    stored = JSON.parse(readDocument(DOCUMENT) ?? "{}") as Partial<Settings>;
  } catch {}
  return {
    automaticChecks: stored.automaticChecks ?? true,
    automaticDownloads: stored.automaticDownloads ?? true,
    channel: stored.channel === "stable" || stored.channel === "nightly" ? stored.channel : null,
    lastCheck: typeof stored.lastCheck === "number" ? stored.lastCheck : null,
    ready: stored.ready ?? null,
  };
}

const save = (patch: Partial<Settings>) => writeDocument(DOCUMENT, JSON.stringify({ ...settings(), ...patch }));
const channel = (s = settings()): UpdateChannel => s.channel ?? BUILD_CHANNEL;
const info = () => (engineInfo ??= WINDOWS ? updaterCall<EngineInfo>("info").catch(() => null) : Promise.resolve(null));
const feedURL = (engine: EngineInfo | null) => engine?.feed || __ASTRO_UPDATE_FEED__;
const signed = (offer: UpdateOffer) => ({ version: offer.version, length: offer.length, signature: offer.signature, publicKey: __ASTRO_UPDATE_KEY__ });
const notesFor = (version: string) => `${RELEASE_NOTES}#${version}`;

async function isConfigured(): Promise<boolean> {
  const engine = await info();
  if (!engine?.supported || !engine.installed || !__ASTRO_UPDATE_KEY__.trim()) return false;
  if (engine.isolated && !engine.feed) return false;
  return /^https?:\/\//i.test(feedURL(engine));
}

function toast(title: string, message?: string, options?: Parameters<typeof showToast>[3]) {
  const windowId = pageWindowId();
  if (windowId) showToast(windowId, title, message, options);
}

function present({ kind, offer }: Announcement) {
  const name = `Astro ${displayVersion(offer.version)}`;
  if (kind === "ready") {
    toast(`${name} is ready`, "Restart Astro to update.", { icon: "arrow.down.circle", key: OFFER_TOAST, action: { title: "Restart", run: () => void installUpdate() } });
  } else {
    toast(`${name} is available`, `You have ${displayVersion(VERSION)}.`, {
      icon: "arrow.down.circle",
      key: OFFER_TOAST,
      action: { title: "Update", run: () => void downloadOffer(offer, true) },
    });
  }
}

function announce(announcement: Announcement) {
  announcements.postMessage(announcement);
  present(announcement);
}

function listen() {
  if (listening) return;
  listening = true;
  announcements.onmessage = ({ data }: MessageEvent<Announcement>) => present(data);
  void loadCr().then((cr) => {
    const add = (cr as unknown as { addWebUiListener(event: string, listener: (kind: string, payload: Record<string, unknown>) => void): unknown }).addWebUiListener;
    add("astro-host-event", (kind, payload) => {
      if (kind !== "updaterProgress" || payload.version !== progressShown) return;
      const total = Number(payload.total) || 0;
      const received = Number(payload.received) || 0;
      const amount = total > 0 ? `${Math.min(99, Math.floor((received / total) * 100))}%` : `${(received / 1_048_576).toFixed(0)} MB`;
      toast(`Downloading Astro ${displayVersion(String(payload.version))}…`, amount, { icon: "arrow.down.circle", key: PROGRESS_TOAST, sticky: true });
    });
  });
}

async function downloadOffer(offer: UpdateOffer, user: boolean) {
  if (user) {
    progressShown = offer.version;
    toast(`Downloading Astro ${displayVersion(offer.version)}…`, undefined, { icon: "arrow.down.circle", key: PROGRESS_TOAST, sticky: true });
  }
  const downloaded = await updaterCall<EngineReply>("download", { ...signed(offer), url: offer.url }).catch((error: unknown): EngineReply => ({ error: String(error) }));
  if (user) {
    progressShown = null;
    const windowId = pageWindowId();
    if (windowId) hideKeyedToast(windowId, PROGRESS_TOAST);
  }
  if (!downloaded?.ok) {
    console.warn("[updater] download failed:", downloaded?.error);
    if (user) toast("Couldn't download the update", downloaded?.error ?? undefined, { icon: "exclamationmark.triangle" });
    return;
  }
  const armed = await updaterCall<EngineReply>("installOnQuit", signed(offer)).catch(() => null);
  if (!armed?.ok) {
    console.warn("[updater] couldn't verify the update:", armed?.error);
    if (user) toast("Couldn't verify the update", armed?.error ?? undefined, { icon: "exclamationmark.triangle" });
    return;
  }
  save({ ready: offer });
  announce({ kind: "ready", offer });
}

async function run(user: boolean) {
  const engine = await info();
  let offers: UpdateOffer[];
  try {
    const response = await fetch(feedURL(engine), { cache: "no-store" });
    if (!response.ok) throw new Error(`the update feed answered ${response.status}`);
    offers = parseAppcast(new DOMParser().parseFromString(await response.text(), "application/xml"));
  } catch (error) {
    console.warn("[updater] check failed:", error);
    if (user) toast("Couldn't check for updates", error instanceof Error ? error.message : undefined, { icon: "exclamationmark.triangle" });
    return;
  }
  save({ lastCheck: Date.now() });
  const s = settings();
  const offer = newestOffer(offers, channel(s), VERSION);
  if (!offer) {
    if (user)
      toast("You're up to date", `Astro ${displayVersion(VERSION)} is the newest version available.`, {
        icon: "checkmark.circle",
        action: { title: "Release Notes", run: () => openUrls([notesFor(VERSION)], pageWindowId()) },
      });
    return;
  }
  if (s.ready?.version === offer.version) return announce({ kind: "ready", offer: s.ready });
  if (user || s.automaticDownloads) return downloadOffer(offer, user);
  announce({ kind: "available", offer });
}

async function check(user: boolean) {
  if (!(await isConfigured())) {
    if (user) toast("Updates aren't set up for this build", "This copy of Astro doesn't have an update feed, so it can't check for new versions.");
    return;
  }
  if (session && user) toast("Already checking for updates", undefined, { icon: "arrow.triangle.2.circlepath" });
  session ??= run(user).finally(() => {
    session = null;
  });
  return session;
}

async function installUpdate() {
  const ready = settings().ready;
  if (!ready) return;
  const installed = await updaterCall<EngineReply>("install", signed(ready)).catch((error: unknown): EngineReply => ({ error: String(error) }));
  if (installed?.ok) return;
  console.warn("[updater] install failed:", installed?.error);
  save({ ready: null });
  void updaterCall("clean");
  toast("Couldn't install the update", installed?.error ?? undefined, { icon: "exclamationmark.triangle" });
}

async function updaterState(): Promise<UpdaterState> {
  if (!WINDOWS) return { available: false };
  const s = settings();
  const configured = await isConfigured();
  const busy = session !== null;
  return {
    available: true,
    configured,
    automaticChecks: s.automaticChecks,
    automaticDownloads: s.automaticDownloads,
    canCheck: !busy,
    sessionInProgress: busy,
    feedURL: configured ? feedURL(await info()) : null,
    lastCheck: s.lastCheck,
    version: VERSION,
    displayVersion: displayVersion(VERSION),
    channel: channel(s),
    buildChannel: BUILD_CHANNEL,
  };
}

function tick() {
  const s = settings();
  if (!s.automaticChecks || !isLeaderPage()) return;
  if (s.lastCheck !== null && Date.now() - s.lastCheck < INTERVAL_MS && Date.now() >= s.lastCheck) return;
  void check(false);
}

export function startUpdater() {
  if (!WINDOWS || started) return;
  started = true;
  if (!settings().channel) save({ channel: BUILD_CHANNEL });
  void (async () => {
    if (!(await isConfigured())) return;
    const ready = settings().ready;
    if (ready && compareVersions(ready.version, VERSION) > 0) {
      const armed = await updaterCall<EngineReply>("installOnQuit", signed(ready)).catch(() => null);
      if (!armed?.ok) {
        save({ ready: null });
        void updaterCall("clean");
      }
    } else {
      if (ready) save({ ready: null });
      void updaterCall("clean");
    }
    setTimeout(tick, FIRST_CHECK_DELAY_MS);
    setInterval(tick, TICK_MS);
  })();
}

export const updateMenuState = () => (WINDOWS ? { ready: settings().ready?.version ?? null } : null);
export const checkForUpdatesNow = () => check(true);
export const installReadyUpdate = installUpdate;
export const releaseNotesFor = notesFor;

if (WINDOWS) listen();

provideNativeModule("AstroApp", {
  updaterState,
  checkForUpdates: async () => {
    await check(true);
  },
  setAutomaticUpdateChecks: async (on: boolean) => save({ automaticChecks: on }),
  setAutomaticUpdateDownloads: async (on: boolean) => save({ automaticDownloads: on }),
  setUpdateChannel: async (next: UpdateChannel) => {
    if (next === "stable" || next === "nightly") save({ channel: next });
  },
});
