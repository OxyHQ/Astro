import { onCommand } from "@astro-browser/shell";
import { recordPerformanceIssue } from "../../../browser/src/lib/performanceRecording";

export function startPerformanceRecordingCommand() {
  onCommand((e) => {
    if (e.command === "recordPerformanceIssue") void recordPerformanceIssue();
  });
}
