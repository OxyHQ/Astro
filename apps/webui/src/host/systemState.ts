import type { SystemState } from "@astro-browser-real/astrocore";
import { emitNativeEvent } from "../../../demo/src/shims/expo-modules-core";
import { loadCr } from "./engine";

const UNKNOWN: SystemState = { onBattery: false, batteryLevel: null, lowPowerMode: false, memoryPressure: "normal", physicalMemory: 0 };

const stateOf = (payload: Record<string, unknown> | null): SystemState => ({
  onBattery: payload?.onBattery === true,
  batteryLevel: typeof payload?.batteryLevel === "number" ? payload.batteryLevel : null,
  lowPowerMode: payload?.lowPowerMode === true,
  memoryPressure: payload?.memoryPressure === "warning" || payload?.memoryPressure === "critical" ? payload.memoryPressure : "normal",
  physicalMemory: typeof payload?.physicalMemory === "number" ? payload.physicalMemory : UNKNOWN.physicalMemory,
});

export const systemStateServices = {
  systemState: async () => stateOf(await (await loadCr()).sendWithPromise<Record<string, unknown> | null>("astroSystem", "systemState", {})),
};

export function startSystemStateEvents() {
  void loadCr().then((cr) => {
    const add = cr.addWebUiListener as unknown as (event: string, listener: (kind: string, payload: Record<string, unknown>) => void) => void;
    add("astro-host-event", (kind, payload) => {
      if (kind === "systemState") emitNativeEvent("AstroCEF", "onSystemState", stateOf(payload));
    });
  });
}
