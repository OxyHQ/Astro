import { loadCr } from "./engine";

const systemCall = async <T,>(method: string, args: Record<string, unknown> = {}): Promise<T | null> =>
  (await loadCr()).sendWithPromise<T | null>("astroSystem", method, args);

const existing = new Map<string, boolean>();

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

export const appServices = {
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
