import type { CrashReport, SystemInfo } from "@astro-browser-real/shell";
import { loadCr } from "./engine";

const systemCall = async <T,>(method: string, args: Record<string, unknown> = {}): Promise<T | null> =>
  (await loadCr()).sendWithPromise<T | null>("astroSystem", method, args);

const existing = new Map<string, boolean>();

export const startDictation = () => void systemCall<boolean>("startDictation");

export const systemServices = {
  fileExists: (path: string) => {
    if (!existing.has(path)) {
      existing.set(path, true);
      void systemCall<boolean>("fileExists", { path }).then((exists) => existing.set(path, exists ?? false));
    }
    return existing.get(path) ?? true;
  },
  openFile: async (path: string) => (await systemCall<boolean>("openFile", { path })) ?? false,
  revealFile: async (path: string) => (await systemCall<boolean>("revealFile", { path })) ?? false,
  moveToTrash: async (path: string) => {
    const moved = (await systemCall<boolean>("moveToTrash", { path })) ?? false;
    if (moved) existing.set(path, false);
    return moved;
  },
  fileIcon: async (path: string, size: number) => await systemCall<string>("fileIcon", { path, size }),
  isDefaultBrowser: async () => (await systemCall<boolean>("isDefaultBrowser")) ?? false,
  setAsDefaultBrowser: async () => (await systemCall<boolean>("setAsDefaultBrowser")) ?? false,
  launchAtLoginStatus: async () => (await systemCall<string>("launchAtLoginStatus")) ?? "notFound",
  setLaunchAtLogin: async (enabled: boolean) => void (await systemCall("setLaunchAtLogin", { enabled })),
};

type NotificationOptions = { id?: string; title: string; tabId?: string; windowId?: string; data?: Record<string, unknown> } & Record<string, unknown>;

const notifications = new Map<string, Pick<NotificationOptions, "tabId" | "windowId" | "data">>();
let nextNotification = 1;

export function notificationResponse(payload: Record<string, unknown>) {
  const id = String(payload.id ?? "");
  const known = notifications.get(id);
  if (payload.action === "close" || payload.action === "click") notifications.delete(id);
  return { id, action: payload.action, tabId: known?.tabId ?? null, windowId: known?.windowId ?? null, data: known?.data ?? null };
}

export const engineServices = {
  engineInfo: async () => await systemCall<Record<string, unknown>>("engineInfo"),
  setAutoPictureInPicture: async (enabled: boolean) => void (await systemCall("setAutoPictureInPicture", { enabled })),
  setVideoUpscaling: async (_enabled: boolean) => {},
  setSearchEngineName: async (_name: string) => {},
  claimLaunchTab: (_key: string, _url: string, _profile: string) => {},
  routeLinkTabs: async (_urls: string[]) => ({}),
  beginTracing: async () => (await systemCall<boolean>("beginTracing")) ?? false,
  endTracing: async (keep: boolean) => await systemCall<string>("endTracing", { keep }),
  isTracing: async () => (await systemCall<boolean>("isTracing")) ?? false,
};

declare const __ASTRO_VERSION__: string;
declare const __ASTRO_BUILD__: string;
declare const __ASTRO_FEEDBACK_URL__: string;
declare const __ASTRO_FEEDBACK_EMAIL__: string;

const platform = /Win/.test(navigator.platform) ? "Windows" : /Linux/.test(navigator.platform) ? "Linux" : navigator.platform;

export const systemInfo: SystemInfo = {
  appName: "Astro",
  appVersion: __ASTRO_VERSION__,
  appBuild: __ASTRO_BUILD__,
  bundleId: "so.oxy.astro",
  configuration: "Release",
  osVersion: "",
  osBuild: platform,
  arch: /arm|aarch64/i.test(navigator.userAgent) ? "arm64" : "x64",
  model: platform,
  memoryGB: (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8,
  locale: navigator.language,
  updates: false,
  feedbackURL: __ASTRO_FEEDBACK_URL__ || null,
  feedbackEmail: __ASTRO_FEEDBACK_EMAIL__ || null,
  inApplicationsFolder: true,
};

type TelemetrySetup = { isolated?: boolean; osVersion?: string; arch?: string; url?: string };

let telemetrySetup: Promise<void> | null = null;

export const loadTelemetrySetup = () =>
  (telemetrySetup ??= systemCall<TelemetrySetup>("telemetrySetup")
    .then((setup) => {
      if (!setup) return;
      systemInfo.isolatedInstance = setup.isolated === true;
      if (setup.osVersion) systemInfo.osVersion = setup.osVersion;
      if (setup.arch) systemInfo.arch = setup.arch;
      systemInfo.telemetryURL = setup.url ?? null;
    })
    .catch(() => {}));

export const appServices = {
  systemInfo: () => systemInfo,
  killSwitchEnvironment: (_name: string): string | null => null,
  appIcons: async (_size: number) => [],
  appIcon: async () => "default",
  crashReports: async (since: number) => (await systemCall<CrashReport[]>("crashReports", { since })) ?? [],
  openExternalURL: async (url: string) => (await systemCall<boolean>("openExternal", { url })) ?? false,
  notificationPermission: async () => "granted",
  requestNotificationPermission: async () => true,
  openNotificationSettings: async () => {},
  postNotification: async (options: NotificationOptions) => {
    const id = options.id ?? `astro-${nextNotification++}`;
    notifications.set(id, { tabId: options.tabId, windowId: options.windowId, data: options.data });
    return await systemCall<string>("notify", { ...options, id });
  },
  removeNotifications: async (ids: string[]) => {
    for (const id of ids) notifications.delete(id);
    await systemCall("removeNotifications", { ids });
  },
};
