import { onCommand, readDocument } from "@astro-browser/shell";
import { maybeStartOnboarding, startOnboarding } from "../../../browser/src/components/onboarding";
import { useBrowser } from "../../../browser/src/store/browser";
import { resolveWindowId } from "../../../browser/src/store/model";
import { loadCr } from "./engine";

const isFirstRun = async () => (await (await loadCr()).sendWithPromise<boolean | null>("astroSystem", "firstRun", {})) === true;

export function offerOnboarding() {
  const begun = !!readDocument("onboarding.json");
  const hadSession = !!readDocument("session.json");
  const firstRun = isFirstRun();
  void Promise.all([firstRun, windowReady()]).then(([first]) => {
    if (begun || first) maybeStartOnboarding(hadSession);
  });
}

function windowReady(): Promise<void> {
  return new Promise((resolve) => {
    if (resolveWindowId(useBrowser.getState())) return resolve();
    const stop = useBrowser.subscribe((s) => {
      if (!resolveWindowId(s)) return;
      stop();
      resolve();
    });
  });
}

export function startOnboardingCommand() {
  onCommand((e) => {
    if (e.command === "showOnboarding") startOnboarding(e.windowId);
  });
}
