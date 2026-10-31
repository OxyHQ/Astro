import { beginTracing, endTracing, isTracing } from "@astro-browser/astrocore";
import { confirm, revealFile } from "@astro-browser/shell";

export async function recordPerformanceIssue() {
  if (await isTracing()) return;
  const start = await confirm({
    title: "Record a performance issue?",
    message: "Astro records what the engine does while you reproduce the problem. The recording is saved to your Downloads folder.",
    confirmTitle: "Start Recording",
  });
  if (!start.confirmed || !(await beginTracing())) return;
  const stop = await confirm({ title: "Recording…", message: "Reproduce the problem now, then click Stop.", confirmTitle: "Stop", cancelTitle: "Discard" });
  const path = await endTracing(stop.confirmed);
  if (path) void revealFile(path);
}
