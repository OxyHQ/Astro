import { lazy, Suspense, useEffect, useState, useSyncExternalStore } from "react";
import type { ConfirmOptions, MenuItem, PromptOptions } from "@astro-browser-real/shell";

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

export type ShareService = { id: string; title: string; symbol?: string };
let shareServices: ShareService[] = [];
export const setShareServices = (services: ShareService[]) => void (shareServices = services);

const withShareServices = (items: MenuItem[]): MenuItem[] =>
  items.map((item) => {
    if ("separator" in item) return item;
    if (item.children) return { ...item, children: withShareServices(item.children) };
    if (!item.share || !shareServices.length) return item;
    return { ...item, children: shareServices.map((service) => ({ id: `${item.id}:via:${service.id}`, title: service.title, symbol: service.symbol })) };
  });

export function showMenu(items: MenuItem[]): Promise<string | null> {
  open?.resolve(null);
  return new Promise((resolve) => publish({ items: withShareServices(items), x: pointer.x, y: pointer.y, resolve }));
}

export const menuIsOpen = () => open !== null;

export const closeMenu = (id: string | null) => {
  const menu = open;
  if (!menu) return;
  publish(null);
  menu.resolve(id);
};

const loadBloomLayer = () => import("./BloomLayer");
const BloomLayer = lazy(loadBloomLayer);

let layerWanted = false;
const layerWatchers = new Set<() => void>();
const wantLayer = () => {
  if (layerWanted) return;
  layerWanted = true;
  for (const watcher of layerWatchers) watcher();
};

async function surfaces() {
  wantLayer();
  return (await loadBloomLayer()).surfaces;
}

export async function confirm(options: ConfirmOptions) {
  const { confirm: ask, confirmWithSuppression } = await surfaces();
  const asked = {
    title: options.title,
    description: options.message,
    confirmLabel: options.confirmTitle ?? "OK",
    cancelLabel: options.cancelTitle,
    destructive: options.destructive,
  };
  if (options.suppression) return confirmWithSuppression({ ...asked, suppressionLabel: options.suppression });
  return { confirmed: await ask(asked), suppressed: false };
}

export async function prompt(options: PromptOptions) {
  const { prompt: ask } = await surfaces();
  return ask({
    title: options.title,
    description: options.message,
    defaultValue: options.value,
    placeholder: options.placeholder,
    confirmLabel: options.confirmTitle,
  });
}

export function OverlayHost() {
  const menu = useSyncExternalStore(
    (watch) => (watchers.add(watch), () => void watchers.delete(watch)),
    () => open,
  );
  const [wanted, setWanted] = useState(layerWanted);
  useEffect(() => {
    const watch = () => setWanted(true);
    layerWatchers.add(watch);
    const idle = requestIdleCallback(() => void loadBloomLayer(), { timeout: 5000 });
    return () => {
      layerWatchers.delete(watch);
      cancelIdleCallback(idle);
    };
  }, []);
  if (menu) wantLayer();
  return wanted || menu ? (
    <Suspense fallback={null}>
      <BloomLayer menu={menu} />
    </Suspense>
  ) : null;
}
