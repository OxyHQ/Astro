import { copyText, onCommand } from "@astro-browser/shell";
import { diagnostics, sendFeedback } from "../../../browser/src/lib/appIntegration";

export function startFeedbackCommands() {
  onCommand((e) => {
    if (e.command === "sendFeedback") void sendFeedback(e.windowId);
    else if (e.command === "copyDiagnostics") void diagnostics().then(copyText);
  });
}
