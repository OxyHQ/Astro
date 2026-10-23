import { requireOptionalNativeModule, type EventSubscription } from "expo-modules-core";

export type CliInstallResult = {
  ok: boolean;
  appVersion: string;
  binPath?: string;
  version?: string;
  rcFile?: string;
  error?: string;
  installedVersion?: string | null;
  lines: string[];
};

const Cli = requireOptionalNativeModule<{
  installedVersion(): string | null;
  install(): Promise<CliInstallResult>;
  addListener(name: "onInstallLine", listener: (e: { line: string }) => void): EventSubscription;
}>("AstroCli");

export const installedCliVersion = () => Cli?.installedVersion() ?? null;

export const installCli = (): Promise<CliInstallResult> =>
  Cli ? Cli.install() : Promise.resolve({ ok: false, appVersion: "", error: "This build of Astro can't install the astro command.", lines: [] });

export const onCliInstallLine = (listener: (line: string) => void) =>
  Cli?.addListener("onInstallLine", (e) => listener(e.line)) ?? { remove() {} };
