import { emitNativeEvent } from "../../../demo/src/shims/expo-modules-core";
import { refForBrowser } from "../shims/WebView";
import { loadCr } from "./engine";

const chromeUI = async <T = null,>(method: string, params: Record<string, unknown> = {}): Promise<T> =>
  (await loadCr()).sendWithPromise<T>("astroChromeUI", method, params);

const onTab = async <T,>(browserId: number, method: string, params: Record<string, unknown>, fallback: T): Promise<T> => {
  const tab = refForBrowser(browserId);
  return tab ? ((await chromeUI<T | null>(method, { ...params, tab })) ?? fallback) : fallback;
};

export const devicesCastServices = {
  selectDevice: (id: number, index: number) => chromeUI("selectDevice", { id, index }),
  cancelDeviceChooser: (id: number) => chromeUI("cancelDeviceChooser", { id }),
  refreshDeviceChooser: (id: number) => chromeUI("refreshDeviceChooser", { id }),
  openBluetoothSettings: (id: number) => chromeUI("openBluetoothSettings", { id }),
  devShowBluetoothChooser: (browserId: number, unauthorized: boolean) => onTab(browserId, "devShowBluetoothChooser", { unauthorized }, false),
  devChooserEvents: async () => (await chromeUI<unknown[] | null>("devChooserEvents")) ?? [],
  showCastDialog: (browserId: number) => onTab(browserId, "showCastDialog", {}, false),
  startCasting: (id: number, sink: string, mode: number) => chromeUI("startCasting", { id, sink, mode }),
  stopCasting: (id: number, route: string) => chromeUI("stopCasting", { id, route }),
  closeCastDialog: (id: number) => chromeUI("closeCastDialog", { id }),
  watchCastRoutes: (profile: string) => chromeUI("watchCastRoutes", { profile }),
  terminateCastRoute: (route: string) => chromeUI("terminateCastRoute", { route }),
};

let listening = false;
export function startCastRoutes() {
  if (listening) return;
  listening = true;
  void loadCr().then((cr) => {
    const add = cr.addWebUiListener as unknown as (event: string, listener: (kind: string, payload: Record<string, unknown>) => void) => void;
    add("astro-host-event", (kind, payload) => {
      if (kind === "castRoutes") emitNativeEvent("AstroChromeUI", "onCastRoutes", payload);
    });
  });
}
