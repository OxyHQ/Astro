import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const DEV_ENV_FILES = ["telemetry.env", "dashboard.env"];

let devFileValues: Record<string, string> | null = null;

function readDevFiles(): Record<string, string> {
  if (devFileValues) return devFileValues;
  const values: Record<string, string> = {};
  for (const name of DEV_ENV_FILES) {
    const file = join(homedir(), ".config/astro", name);
    if (!existsSync(file)) continue;
    for (const line of readFileSync(file, "utf8").split("\n")) {
      const match = /^\s*([A-Z0-9_]+)=(.*)$/.exec(line);
      if (match?.[1] && match[2] !== undefined) values[match[1]] = match[2].trim();
    }
  }
  devFileValues = values;
  return values;
}

export const isDev = import.meta.env.DEV;

export function serverEnv(name: string): string | undefined {
  const value = process.env[name];
  if (value) return value;
  if (!isDev) return undefined;
  return readDevFiles()[name] || undefined;
}

export function devAuthBypass(): boolean {
  if (!import.meta.env.DEV) return false;
  return process.env.DASHBOARD_DEV_BYPASS_AUTH === "1";
}
