import { installErrorReporting, startTelemetry } from "../../../browser/src/telemetry";
import { acceptQueued, adoptChoice, persistNow, type Queued, relayQueued, shareChoice } from "../../../browser/src/telemetry/client";
import { captureException } from "../../../browser/src/telemetry/errors";
import { resumeUsage, startPageUsage } from "../../../browser/src/telemetry/usage";
import { loadTelemetrySetup } from "./system";
import { isLeaderPage } from "./windows";

type Message = { type: "choice"; json: string } | { type: "queued"; item: Queued };

const CHANNEL = "astro-telemetry";
const MAX_EXCEPTIONS = 25;
const MAX_LOGS = 40;

const exceptions = new Set<string>();
const logs = new Set<string>();

function once(seen: Set<string>, key: string, max: number) {
  if (seen.has(key) || seen.size >= max) return false;
  seen.add(key);
  return true;
}

type ExceptionEntry = { type?: string; value?: string; stacktrace?: { frames?: { function?: string }[] } };

function firstSighting(item: Queued) {
  if ("log" in item) return once(logs, `${item.log.severityText}|${item.log.body.stringValue}`, MAX_LOGS);
  const { event, properties } = item.event;
  if (event !== "$exception" || properties.source === "native_crash") return true;
  const list = (properties.$exception_list ?? []) as ExceptionEntry[];
  const key = list.map((e) => `${e.type}|${e.value}|${e.stacktrace?.frames?.at(-1)?.function ?? ""}`).join("\n");
  return once(exceptions, `${properties.error_code ?? ""}|${key}`, MAX_EXCEPTIONS);
}

let installed: Promise<void> | null = null;

function install() {
  return (installed ??= loadTelemetrySetup().then(() => {
    const channel = new BroadcastChannel(CHANNEL);
    installErrorReporting();
    shareChoice((json) => channel.postMessage({ type: "choice", json } satisfies Message));
    relayQueued((item) => {
      if (isLeaderPage()) return !firstSighting(item);
      channel.postMessage({ type: "queued", item } satisfies Message);
      return true;
    });
    channel.onmessage = ({ data }: MessageEvent<Message>) => {
      if (data.type === "choice") adoptChoice(data.json);
      else if (isLeaderPage() && firstSighting(data.item)) acceptQueued(data.item);
    };
    addEventListener("error", (e) => captureException(e.error ?? e.message, "onerror"));
    addEventListener("unhandledrejection", (e) => captureException(e.reason, "onunhandledrejection"));
  }));
}

export function leadTelemetry(hydrate: boolean) {
  void install().then(() => (hydrate ? startTelemetry() : resumeUsage()));
}

export function startPageTelemetry() {
  void install().then(() => {
    if (!isLeaderPage()) startPageUsage();
  });
}

export const reportUncaught = (error: unknown) => captureException(error, "react", { fatal: true });

export const endTelemetry = persistNow;
