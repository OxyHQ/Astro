import "./bloom.css";
import { SurfaceHost } from "@oxy.so/bloom/surfaces";
import { BloomThemeProvider } from "@oxy.so/bloom/theme";
import {
  ContextMenu,
  ContextMenuCheckboxItem,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
} from "@oxy.so/bloom/context-menu";
import { Fragment, useMemo } from "react";
import { View } from "react-native";
import type { MenuItem } from "@astro-browser-real/shell";
import { closeMenu, type OpenMenu } from "./overlays";
import { useBrowser } from "../../../../browser/src/store/browser";
import { Symbol } from "./Symbol";

const isMac = typeof navigator !== "undefined" && /Mac/.test(navigator.platform);
const KEYS: Record<string, string> = isMac
  ? { command: "⌘", shift: "⇧", option: "⌥", control: "⌃" }
  : { command: "Ctrl+", shift: "Shift+", option: "Alt+", control: "Ctrl+" };
const ORDER = isMac ? ["control", "option", "shift", "command"] : ["command", "control", "option", "shift"];
const shortcutLabel = (key: string, modifiers: string[]) =>
  `${[...new Set(ORDER.filter((m) => modifiers.includes(m)).map((m) => KEYS[m]))].join("")}${key.length === 1 ? key.toUpperCase() : key}`;

function leadingOf(item: Extract<MenuItem, { id: string }>, dark: boolean) {
  if (item.symbol) return <Symbol name={item.symbol} size={14} color="currentColor" style={{ width: 16, height: 16 }} />;
  const swatch = dark ? (item.swatchDark ?? item.swatch) : item.swatch;
  if (swatch) return <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: swatch }} />;
  return undefined;
}

function MenuRows({ items, dark }: { items: MenuItem[]; dark: boolean }) {
  return items.map((item, i) => {
    if ("separator" in item)
      return (
        <Fragment key={`separator${i}`}>
          <ContextMenuSeparator />
        </Fragment>
      );
    const key = `${item.id}${i}`;
    const disabled = item.enabled === false;
    if (item.children)
      return (
        <ContextMenuSub key={key}>
          <ContextMenuSubTrigger disabled={disabled} leading={leadingOf(item, dark)}>
            {item.title}
          </ContextMenuSubTrigger>
          <ContextMenuSubContent>
            <MenuRows items={item.children} dark={dark} />
          </ContextMenuSubContent>
        </ContextMenuSub>
      );
    const trailing = item.key ? <ContextMenuShortcut>{shortcutLabel(item.key, item.modifiers ?? [])}</ContextMenuShortcut> : undefined;
    if (item.checked)
      return (
        <ContextMenuCheckboxItem key={key} checked disabled={disabled} trailing={trailing} onCheckedChange={() => closeMenu(item.id)}>
          {item.title}
        </ContextMenuCheckboxItem>
      );
    return (
      <ContextMenuItem key={key} disabled={disabled} leading={leadingOf(item, dark)} trailing={trailing} onPress={() => closeMenu(item.id)}>
        {item.title}
      </ContextMenuItem>
    );
  });
}

export * as surfaces from "@oxy.so/bloom/surfaces";

function Menu({ menu, dark }: { menu: OpenMenu | null; dark: boolean }) {
  const anchor = useMemo(() => (menu ? { x: menu.x, y: menu.y } : null), [menu]);
  return (
    <ContextMenu anchor={anchor} onAnchorChange={(next) => next || closeMenu(null)}>
      <ContextMenuContent alignRows sideOffset={0}>
        {menu ? <MenuRows items={menu.items} dark={dark} /> : null}
      </ContextMenuContent>
    </ContextMenu>
  );
}

export default function BloomLayer({ menu }: { menu: OpenMenu | null }) {
  const dark = useBrowser((s) => s.ui.appDark);
  return (
    <BloomThemeProvider mode={dark ? "dark" : "light"}>
      <SurfaceHost />
      <Menu menu={menu} dark={dark} />
    </BloomThemeProvider>
  );
}
