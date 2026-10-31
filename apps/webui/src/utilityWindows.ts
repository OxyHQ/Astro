import { useSyncExternalStore } from "react";
import { isUtilityWindowId } from "../../browser/src/components/settings/windows";

let open: string[] = [];
const watchers = new Set<() => void>();

const publish = (next: string[]) => {
  open = next;
  for (const watch of watchers) watch();
};

export const openUtilityWindow = (id: string) => {
  if (!isUtilityWindowId(id)) return false;
  publish([...open.filter((other) => other !== id), id]);
  return true;
};

export const closeUtilityWindow = (id: string) => {
  if (open.includes(id)) publish(open.filter((other) => other !== id));
};

export const openUtilityWindows = () => open;

export const useUtilityWindows = () =>
  useSyncExternalStore(
    (watch) => (watchers.add(watch), () => void watchers.delete(watch)),
    () => open,
  );
