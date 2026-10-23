import { useEffect, useState, useSyncExternalStore } from "react";
import type { MenuItem } from "@astro-browser-real/shell";
import { useBrowser } from "../../../../browser/src/store/browser";
import { Symbol } from "./Symbol";

type OpenMenu = { items: MenuItem[]; x: number; y: number; resolve: (id: string | null) => void };

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

const close = (id: string | null) => {
  const menu = open;
  publish(null);
  menu?.resolve(id);
};

const isMac = typeof navigator !== "undefined" && /Mac/.test(navigator.platform);
const KEYS: Record<string, string> = isMac
  ? { command: "⌘", shift: "⇧", option: "⌥", control: "⌃" }
  : { command: "Ctrl+", shift: "Shift+", option: "Alt+", control: "Ctrl+" };
const ORDER = isMac ? ["control", "option", "shift", "command"] : ["command", "control", "option", "shift"];
const shortcutLabel = (key: string, modifiers: string[]) =>
  `${[...new Set(ORDER.filter((m) => modifiers.includes(m)).map((m) => KEYS[m]))].join("")}${key.length === 1 ? key.toUpperCase() : key}`;

function MenuList({ items, x, y }: { items: MenuItem[]; x: number; y: number }) {
  const [sub, setSub] = useState<{ index: number; top: number } | null>(null);
  const dark = useBrowser((s) => s.ui.appDark);
  const width = 270;
  const left = Math.min(x, window.innerWidth - width - 8);
  return (
    <div className={`astro-menu${dark ? " dark" : ""}`} style={{ left, top: Math.min(y, window.innerHeight - 40), width }} onPointerDown={(e) => e.stopPropagation()}>
      {items.map((item, i) => {
        if ("separator" in item) return <div key={i} className="astro-menu-separator" />;
        const enabled = item.enabled !== false;
        return (
          <div
            key={item.id + i}
            className={`astro-menu-item${enabled ? "" : " disabled"}`}
            onPointerEnter={(e) => setSub(item.children ? { index: i, top: (e.currentTarget as HTMLElement).getBoundingClientRect().top } : null)}
            onClick={() => enabled && !item.children && close(item.id)}
          >
            <span className="astro-menu-check">{item.checked ? "✓" : ""}</span>
            {item.symbol ? <Symbol name={item.symbol} size={12} color="currentColor" style={{ width: 16, height: 16, marginRight: 6 }} /> : null}
            {item.swatch ? <span className="astro-menu-swatch" style={{ background: item.swatch }} /> : null}
            <span className="astro-menu-title">{item.title}</span>
            <span className="astro-menu-key">{item.children ? "›" : item.key ? shortcutLabel(item.key, item.modifiers ?? []) : ""}</span>
            {sub?.index === i && item.children ? <MenuList items={item.children} x={left + width - 4} y={sub.top - 5} /> : null}
          </div>
        );
      })}
    </div>
  );
}

export function MenuHost() {
  const menu = useSyncExternalStore(
    (watch) => (watchers.add(watch), () => void watchers.delete(watch)),
    () => open,
  );
  useEffect(() => {
    if (!menu) return;
    const outside = () => close(null);
    const key = (e: KeyboardEvent) => e.key === "Escape" && close(null);
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", key);
    };
  }, [menu]);
  return menu ? <MenuList items={menu.items} x={menu.x} y={menu.y} /> : null;
}
