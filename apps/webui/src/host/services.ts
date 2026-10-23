import { emitNativeEvent } from "../../../demo/src/shims/expo-modules-core";
import { boolPref, call, DEFAULT_ENGINE_PROFILE, type EngineResult, onHostEngineEvent } from "./engine";

type Dict = Record<string, unknown>;

const hex = (text: string) => [...new TextEncoder().encode(text)].map((byte) => byte.toString(16).padStart(2, "0")).join("");

const withSecrets = (args: Dict, secrets: Record<string, string | null | undefined>) => {
  const sealed: Dict = { ...args };
  for (const [key, value] of Object.entries(secrets)) if (value != null) sealed[`${key}Hex`] = hex(value);
  return sealed;
};

function originOf(url: string) {
  try {
    const parsed = new URL(url);
    return parsed.host ? `${parsed.protocol}//${parsed.host}` : url;
  } catch {
    return url;
  }
}

const login = (origin: string, username: string) => ({ origin: originOf(origin), username: username ?? "" });

const list = <T = Dict>(result: EngineResult, key: string): T[] => (Array.isArray(result[key]) ? (result[key] as T[]) : []);

const dated = (key: string) => (result: EngineResult) =>
  Array.isArray(result[key]) ? { [key]: list(result, key).filter((entry) => entry && typeof entry === "object").map((entry) => ({ ...entry, created: 0, modified: 0 })) } : result;

const downloadProfiles = new Map<string, string>();

function emitDownload(download: Dict, profile: string) {
  const entry: Dict = { ...download, profile };
  if (typeof entry.id === "string") downloadProfiles.set(entry.id, profile);
  emitNativeEvent("AstroCEF", "onDownload", entry);
}

export function startDownloads() {
  onHostEngineEvent("downloads.changed", (payload) => {
    if (payload.download && typeof payload.download === "object") emitDownload(payload.download as Dict, String(payload.profile ?? ""));
  });
  void call("ac_downloads_list", DEFAULT_ENGINE_PROFILE).then((result) => {
    for (const download of list(result, "downloads")) emitDownload(download, DEFAULT_ENGINE_PROFILE);
  });
}

const downloadCommand = (command: string) => (id: string) =>
  void call(`ac_downloads_${command}`, downloadProfiles.get(id) ?? DEFAULT_ENGINE_PROFILE, { id });

export const cefServices = {
  listPasswords: async (profile: string) => {
    const result = await call("ac_passwords_list", profile);
    if (!Array.isArray(result.passwords)) return result;
    return {
      passwords: list(result, "passwords").map((entry) => ({ origin: entry.origin ?? "", username: entry.username ?? "", created: 0, modified: 0 })),
    };
  },
  unlockPasswords: (profile: string) => call("ac_passwords_unlock", profile),
  getPassword: (profile: string, origin: string, username: string) => call("ac_passwords_reveal", profile, login(origin, username)),
  savePassword: (profile: string, origin: string, username: string, password: string) =>
    call("ac_passwords_add", profile, withSecrets(login(origin, username), { password: password ?? "" })),
  updatePassword: (profile: string, origin: string, username: string, newUsername?: string | null, newPassword?: string | null) =>
    call(
      "ac_passwords_update",
      profile,
      withSecrets({ ...login(origin, username), ...(newUsername != null ? { newUsername } : {}) }, { newPassword }),
    ),
  deletePassword: (profile: string, origin: string, username: string) => call("ac_passwords_remove", profile, login(origin, username)),
  getNeverSavePasswordOrigins: (profile: string) => call("ac_passwords_exceptions", profile),
  allowSavingPasswords: (profile: string, origin: string) => call("ac_passwords_allow", profile, { origin: originOf(origin) }),
  exportPasswords: async (_profile: string) => ({ status: "cancelled" }),
  getPasswordAutofill: (profile: string) => boolPref("credentials_enable_service", profile),
  setPasswordAutofill: (profile: string, enabled: boolean) => void boolPref("credentials_enable_service", profile, enabled),
  getAutofillSettings: async (profile: string) => ({
    addresses: await boolPref("autofill.profile_enabled", profile),
    cards: await boolPref("autofill.credit_card_enabled", profile),
  }),
  setAutofillSettings: (profile: string, addresses?: boolean | null, cards?: boolean | null) => {
    if (addresses != null) void boolPref("autofill.profile_enabled", profile, addresses);
    if (cards != null) void boolPref("autofill.credit_card_enabled", profile, cards);
  },
  listAddresses: async (profile: string) => dated("addresses")(await call("ac_autofill_addresses", profile)),
  saveAddress: (profile: string, address: Dict) => {
    const fields: Record<string, string> = {};
    for (const [key, value] of Object.entries(address)) if (typeof value === "string" || typeof value === "number") fields[key] = String(value);
    return call("ac_autofill_save_address", profile, { address: fields });
  },
  listCards: async (profile: string) => dated("cards")(await call("ac_autofill_cards", profile)),
  saveCard: (profile: string, card: Dict, number?: string | null) => call("ac_autofill_save_card", profile, withSecrets({ card: card ?? {} }, { number })),
  deleteAutofillEntry: (profile: string, id: string) => call("ac_autofill_remove", profile, { id: id ?? "" }),
  revealCardNumber: async (profile: string, id: string) => {
    const result = await call("ac_autofill_card_number", profile, { id: id ?? "" });
    return typeof result.number === "string" ? { number: result.number } : {};
  },
  getZoomLevels: async (profile: string) => {
    const result = await call("ac_zoom_list", profile);
    const hosts = result.levels && typeof result.levels === "object" ? (result.levels as Record<string, number>) : {};
    return Object.fromEntries(Object.entries(hosts).map(([host, level]) => [host, Math.round(1.2 ** level * 100) / 100]));
  },
  setZoom: (profile: string, host: string, zoom: number) => {
    const name = host.toLowerCase();
    if (!name || zoom <= 0) return;
    void call("ac_zoom_set", profile, { host: name, level: Math.abs(zoom - 1) < 1e-6 ? 0 : Math.log(zoom) / Math.log(1.2) });
  },
  getSiteSettings: async (profile: string, origin: string) => {
    const result = await call("ac_site_settings_get", profile, { origin: origin ?? "" });
    return result.settings && typeof result.settings === "object" ? result.settings : {};
  },
  setSiteSetting: (profile: string, origin: string, type: string, value: string) =>
    void call("ac_site_settings_set", profile, { origin: origin ?? "", type: type ?? "", value: value ?? "" }),
  getSiteSettingsOrigins: async (profile: string) => list<string>(await call("ac_site_settings_origins", profile), "origins"),
  resetSiteSettings: (profile: string, origin: string) => void call("ac_site_settings_reset", profile, { origin: origin ?? "" }),
  clearSiteData: async (profile: string, origin: string) => {
    const result = await call("ac_site_data_clear", profile, { origin: origin ?? "" });
    return result.error ? { cookies: false, storage: false } : result;
  },
  getExternalAppAllowances: async (profile: string) => list(await call("ac_external_apps_allowances", profile), "allowances"),
  removeExternalAppAllowance: (profile: string, origin: string, scheme: string) =>
    void call("ac_external_apps_remove", profile, { origin: origin ?? "", scheme: scheme ?? "" }),
  listTasks: async () => list(await call("ac_tasks_list", DEFAULT_ENGINE_PROFILE), "tasks").map((task) => ({ ...task, browserIds: [] })),
  components: async () => list(await call("ac_components_list", DEFAULT_ENGINE_PROFILE), "components"),
  clearBrowsingData: async (profile: string, types: string[], since?: number | null) => {
    await call("ac_browsing_data_clear", profile, { types, since: since ?? 0 });
  },
  pauseDownload: downloadCommand("pause"),
  resumeDownload: downloadCommand("resume"),
  cancelDownload: downloadCommand("cancel"),
};

const changed = (profile: string, id: unknown, event: string) => {
  if (typeof id === "string" && id) emitNativeEvent("AstroExtensions", "onChanged", { profile, id, event });
};

const run = async (name: string, profile: string, args: Dict, event: string) => {
  const result = await call(name, profile, args);
  if (!result.error) changed(profile, args.id, event);
  return result;
};

export const extensionServices = {
  list: async (profile: string) => {
    const result = await call("ac_extensions_list", profile);
    if (result.error) return result;
    if (!Array.isArray(result.extensions)) return { error: "Unexpected extension list" };
    return {
      extensions: list(result, "extensions").map((info) => {
        const fromWebStore = info.location === "FROM_STORE";
        const item: Dict = Object.fromEntries(Object.entries(info).filter(([, value]) => value !== null));
        for (const key of ["siteAccess", "optionsUrl", "path", "homepageUrl"]) item[key] ??= null;
        return {
          ...item,
          incognitoSplit: false,
          fromWebStore,
          webStoreUrl: fromWebStore ? `https://chromewebstore.google.com/detail/${String(info.id)}` : null,
        };
      }),
    };
  },
  setEnabled: (id: string, profile: string, enabled: boolean) =>
    run("ac_extensions_set_enabled", profile, { id, enabled }, enabled ? "enabled" : "disabled"),
  uninstall: (id: string, profile: string) => run("ac_extensions_uninstall", profile, { id }, "uninstalled"),
  reload: (id: string, profile: string) => run("ac_extensions_reload", profile, { id }, "reloaded"),
  configure: (id: string, profile: string, options: Dict) => {
    const args: Dict = { id };
    for (const key of ["pinned", "incognito", "fileAccess", "siteAccess"]) if (options[key] !== undefined) args[key] = options[key];
    return run("ac_extensions_configure", profile, args, "configured");
  },
  searchEngineList: async (profile: string) => {
    const result = await call("ac_search_engines_list", profile);
    return result.error ? result : { list: { engines: result.engines ?? [] } };
  },
};
