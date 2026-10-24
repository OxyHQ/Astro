import { lazy, Suspense, useEffect, useSyncExternalStore } from "react";
import type { MenuItem } from "@astro-browser-real/shell";

export type OpenMenu = { items: MenuItem[]; x: number; y: number; resolve: (id: string | null) => void };

let open: OpenMenu | null = null;
const watchers = new Set<() => void>();
const publish = (next: OpenMenu | null) => {
  open = next;
  for (const watcher of watchers) watcher();
};

const pointer = { x: 0, y: 0 };
if (typeof window !== "undefined")
  window.addEventListener(
    "pointerdown",
    (e) => {
      pointer.x = e.clientX;
      pointer.y = e.clientY;
    },
    true,
  );

export function showMenu(items: MenuItem[]): Promise<string | null> {
  open?.resolve(null);
  return new Promise((resolve) => publish({ items, x: pointer.x, y: pointer.y, resolve }));
}

export const closeMenu = (id: string | null) => {
  const menu = open;
  if (!menu) return;
  publish(null);
  menu.resolve(id);
};

const loadBloomMenu = () => import("./BloomMenu");
const BloomMenu = lazy(loadBloomMenu);

export function MenuHost() {
  const menu = useSyncExternalStore(
    (watch) => (watchers.add(watch), () => void watchers.delete(watch)),
    () => open,
  );
  useEffect(() => {
    const idle = requestIdleCallback(() => void loadBloomMenu(), { timeout: 5000 });
    return () => cancelIdleCallback(idle);
  }, []);
  return menu ? (
    <Suspense fallback={null}>
      <BloomMenu menu={menu} />
    </Suspense>
  ) : null;
}
