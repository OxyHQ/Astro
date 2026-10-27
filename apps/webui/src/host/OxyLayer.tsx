import "../../../demo/src/shims/web/bloom.css";
import { BloomThemeProvider } from "@oxy.so/bloom/theme";
import { AUTH_STATE_STORAGE_KEY } from "@oxy.so/core/session";
import { useEffect, useState } from "react";
import { OxyRoot, type OxyEndpoints } from "../../../browser/src/oxy/OxyRoot";
import { useOxyGenerations } from "../../../browser/src/oxy/session";
import { useBrowser } from "../../../browser/src/store/browser";
import { PageChat } from "./chat";
import { usePageWindowId } from "./windows";

const SETTLE_MS = 250;

function useSessionFromOtherPages(): number {
  const [generation, setGeneration] = useState(0);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const changed = (event: StorageEvent) => {
      if (event.key !== AUTH_STATE_STORAGE_KEY && event.key !== null) return;
      clearTimeout(timer);
      timer = setTimeout(() => setGeneration((g) => g + 1), SETTLE_MS);
    };
    window.addEventListener("storage", changed);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("storage", changed);
    };
  }, []);
  return generation;
}

export default function OxyLayer(endpoints: OxyEndpoints & { aliaURL: string }) {
  const dark = useBrowser((s) => s.ui.appDark);
  const generation = useSessionFromOtherPages();
  const windowId = usePageWindowId();
  const own = useOxyGenerations((g) => (windowId ? (g[windowId] ?? 0) : 0));
  if (!windowId) return null;
  return (
    <BloomThemeProvider mode={dark ? "dark" : "light"}>
      <OxyRoot key={`${generation}:${own}`} windowId={windowId} {...endpoints}>
        <PageChat aliaURL={endpoints.aliaURL} />
      </OxyRoot>
    </BloomThemeProvider>
  );
}
