import { engineCall } from "@astro-browser/astrocore";
import { useEffect, useState } from "react";
import { switchOn } from "./killSwitches";

let engine: "unknown" | "asking" | "yes" | "no" = "unknown";
const ENGINE_PROBE_DELAY_MS = 1500;
export const engineHasPrewarmFixes = () => engine === "yes";
function askEngine(tries = 5) {
  if (engine !== "unknown") return;
  engine = "asking";
  engineCall<{ prewarm?: number }>("ac_omnibox_opened", "", {}).then(
    (r) => void (engine = (r?.prewarm ?? 0) >= 2 ? "yes" : "no"),
    (e: unknown) => {
      if (/not an engine call|the engine has no/.test(String(e))) engine = "no";
      else {
        engine = "unknown";
        if (tries > 1) setTimeout(() => askEngine(tries - 1), ENGINE_PROBE_DELAY_MS);
      }
    },
  );
}
setTimeout(askEngine, ENGINE_PROBE_DELAY_MS);
export const setEngineForTests = (has: boolean) => void (engine = has ? "yes" : "no");

const PREWARM_DELAY_MS = 120;
let prewarmOn = true;
export const setNewTabPrewarm = (on: boolean) => void (prewarmOn = on);
export const newTabPrewarmOn = () => prewarmOn && engineHasPrewarmFixes() && switchOn("newTabPrewarm");
export function usePrewarm(want: boolean) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!want || !newTabPrewarmOn()) {
      setReady(false);
      return;
    }
    const timer = setTimeout(() => setReady(true), PREWARM_DELAY_MS);
    return () => clearTimeout(timer);
  }, [want]);
  return want && ready;
}
