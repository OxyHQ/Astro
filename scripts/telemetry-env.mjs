import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const FILE = join(homedir(), ".config/astro/telemetry.env");

export function telemetryEnv() {
  if (!existsSync(FILE)) throw new Error(`${FILE} is missing (docs/growth.md, Telemetry)`);
  const env = {};
  for (const line of readFileSync(FILE, "utf8").split("\n")) {
    const match = /^\s*([A-Z0-9_]+)=(.*)$/.exec(line);
    if (match) env[match[1]] = match[2].trim();
  }
  return env;
}

export const hasTelemetryEnv = () => existsSync(FILE);

export async function clickhouse(query) {
  const env = telemetryEnv();
  const res = await fetch(env.CLICKHOUSE_URL, {
    method: "POST",
    headers: { "X-ClickHouse-User": env.CLICKHOUSE_USER, "X-ClickHouse-Key": env.CLICKHOUSE_PASSWORD },
    body: `${query}\nFORMAT JSONCompact`,
  });
  if (!res.ok) throw new Error(`ClickHouse: ${res.status} ${(await res.text()).slice(0, 500)}`);
  return (await res.json()).data;
}
