import { engineCall } from "./engine";
import { Cef } from "./native";

export type BatterySaverMode = "on" | "off" | "default";

export type BatterySaverState = { state: number; active: boolean };

export const openTaskManager = () => engineCall<{ ok: boolean }>("ac_task_manager_open", "");

export const setBatterySaver = (mode: BatterySaverMode) => engineCall<BatterySaverState>("ac_battery_saver", "", { mode });

export const trimEngineMemory = () => engineCall<{ ok: boolean }>("ac_memory_trim", "");

export const inputIdleSeconds = () => Cef.inputIdleSeconds?.() ?? null;
