const FALLBACK_MS = 5000;

let waiting: (() => void)[] | null = [];
let fallback: ReturnType<typeof setTimeout> | undefined;

function run(tasks: (() => void)[]) {
  for (const task of tasks) {
    try {
      task();
    } catch (error) {
      console.warn("[launch] deferred work failed", error);
    }
  }
}

export function afterFirstWindow(task: () => void) {
  if (!waiting) {
    setTimeout(() => run([task]), 0);
    return;
  }
  waiting.push(task);
  fallback ??= setTimeout(firstWindowCommitted, FALLBACK_MS);
}

export function firstWindowCommitted() {
  if (!waiting) return;
  const tasks = waiting;
  waiting = null;
  clearTimeout(fallback);
  if (tasks.length) setTimeout(() => run(tasks), 0);
}
