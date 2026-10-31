import type { CliControlStatus } from "@astro-browser-real/astrocore";
import type { CliInstallResult } from "@astro-browser-real/shell";
import { useBrowser } from "../../../browser/src/store/browser";
import { requireNativeModule } from "../../../demo/src/shims/expo-modules-core";
import { refForBrowser } from "../shims/WebView";
import { call, DEFAULT_ENGINE_PROFILE } from "./engine";
import { callTab } from "./tabBridge";
import { pageWindowId } from "./windows";

type CliStatus = { available?: boolean; installed?: boolean; current?: boolean; version?: string; binPath?: string };

const ELSEWHERE = "elsewhere";

let status: CliStatus = {};
const lineListeners = new Set<(line: string) => void>();

const appVersion = () => requireNativeModule<{ systemInfo(): { appVersion: string } }>("AstroApp").systemInfo().appVersion;

export async function loadCliStatus() {
  const reply = await call("ac_cli_install", DEFAULT_ENGINE_PROFILE, { method: "status" });
  if (typeof reply.error !== "string") status = reply as CliStatus;
}

void loadCliStatus();

export function installedCliVersion(): string | null {
  if (!status.installed) return null;
  return status.current ? appVersion() : ELSEWHERE;
}

export async function installCli(): Promise<CliInstallResult> {
  for (const notify of lineListeners) notify("step link");
  const reply = await call("ac_cli_install", DEFAULT_ENGINE_PROFILE, { method: "install" });
  await loadCliStatus().catch(() => {});
  const lines = Array.isArray(reply.lines) ? reply.lines.filter((line): line is string => typeof line === "string") : [];
  for (const line of lines) for (const notify of lineListeners) notify(line);
  return {
    ok: reply.ok === true,
    appVersion: appVersion(),
    binPath: typeof reply.binPath === "string" ? reply.binPath : undefined,
    version: typeof reply.version === "string" ? reply.version : undefined,
    rcFile: typeof reply.rcFile === "string" ? reply.rcFile : undefined,
    error: typeof reply.error === "string" ? reply.error : undefined,
    installedVersion: installedCliVersion(),
    lines,
  };
}

export function onCliInstallLine(listener: (line: string) => void) {
  lineListeners.add(listener);
  return { remove: () => void lineListeners.delete(listener) };
}

const controlCall = async (args?: object) => (await call("ac_cli_control", DEFAULT_ENGINE_PROFILE, args)) as unknown as CliControlStatus;

let latestActive = 0;

export async function setCliActiveTab(browserId: number): Promise<CliControlStatus> {
  const request = ++latestActive;
  if (useBrowser.getState().ui.focusedWindowId !== pageWindowId()) return controlCall();
  const ref = browserId > 0 ? refForBrowser(browserId) : null;
  const sessionId = ref ? await callTab<number>(ref, "sessionId").catch(() => null) : null;
  if (request !== latestActive) return controlCall();
  return controlCall({ active: typeof sessionId === "number" && sessionId > 0 ? sessionId : -1 });
}
