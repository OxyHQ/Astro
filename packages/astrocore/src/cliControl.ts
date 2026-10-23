import { engineCall, onEngineEvent } from "./engine";

export type CliControlStatus = {
  state: "off" | "starting" | "on" | "external";
  port?: number;
  connections?: number;
  generation?: number;
  file?: string;
  reason?: string;
};

export const setCliControl = (on: boolean) => engineCall<CliControlStatus>("ac_cli_control", "", { on });

export const setCliActiveTab = (chromeTabId: number) => engineCall<CliControlStatus>("ac_cli_control", "", { active: chromeTabId });

export const cliControlStatus = () => engineCall<CliControlStatus>("ac_cli_control", "");

export const onCliControlChanged = (listener: (status: CliControlStatus) => void) =>
  onEngineEvent("cliControl", (payload) => listener(payload as unknown as CliControlStatus));
