import "./bloom.css";
import { SurfaceHost } from "@oxy.so/bloom/surfaces";
import { BloomThemeProvider } from "@oxy.so/bloom/theme";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@oxy.so/bloom/dropdown-menu";
import { Fragment, useEffect } from "react";
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

const LEADING_SPACE = <View style={{ width: 16, height: 16 }} />;

const hasLeading = (item: MenuItem) => "id" in item && !item.checked && !!(item.symbol || item.swatch);

function leadingOf(item: Extract<MenuItem, { id: string }>, dark: boolean, aligned: boolean) {
  if (item.symbol) return <Symbol name={item.symbol} size={14} color="currentColor" style={{ width: 16, height: 16 }} />;
  const swatch = dark ? (item.swatchDark ?? item.swatch) : item.swatch;
  if (swatch) return <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: swatch }} />;
  return aligned ? LEADING_SPACE : undefined;
}

const SUB_PANEL = { width: "auto", minWidth: 266, maxWidth: 420 } as const;

function MenuRows({ items, dark }: { items: MenuItem[]; dark: boolean }) {
  const inset = items.some((item) => "id" in item && item.checked);
  const aligned = items.some(hasLeading);
  return items.map((item, i) => {
    if ("separator" in item) return (
        <Fragment key={`separator${i}`}>
          <DropdownMenuSeparator />
        </Fragment>
      );
    const key = `${item.id}${i}`;
    const disabled = item.enabled === false;
    if (item.children)
      return (
        <DropdownMenuSub key={key}>
          <DropdownMenuSubTrigger disabled={disabled} inset={inset} leading={leadingOf(item, dark, aligned)}>
            {item.title}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent style={SUB_PANEL}>
            <MenuRows items={item.children} dark={dark} />
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      );
    const trailing = item.key ? <DropdownMenuShortcut>{shortcutLabel(item.key, item.modifiers ?? [])}</DropdownMenuShortcut> : undefined;
    if (item.checked)
      return (
        <DropdownMenuCheckboxItem key={key} checked disabled={disabled} trailing={trailing} onCheckedChange={() => closeMenu(item.id)}>
          {item.title}
        </DropdownMenuCheckboxItem>
      );
    return (
      <DropdownMenuItem key={key} disabled={disabled} inset={inset} leading={leadingOf(item, dark, aligned)} trailing={trailing} onPress={() => closeMenu(item.id)}>
        {item.title}
      </DropdownMenuItem>
    );
  });
}

const PANEL_ID = "astro-menu";

function useMenuFocus() {
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    const frame = requestAnimationFrame(() => {
      const panel = document.querySelector<HTMLElement>(`[data-testid="${PANEL_ID}"]`);
      if (!panel) return;
      panel.tabIndex = -1;
      panel.focus({ preventScroll: true });
    });
    return () => {
      cancelAnimationFrame(frame);
      const now = document.activeElement;
      if (before?.isConnected && (!now || now === document.body || now.closest(`[data-testid="${PANEL_ID}"]`))) before.focus({ preventScroll: true });
    };
  }, []);
}

export * as surfaces from "@oxy.so/bloom/surfaces";

function Menu({ menu, dark }: { menu: OpenMenu; dark: boolean }) {
  useMenuFocus();
  return (
    <DropdownMenu open onOpenChange={(next) => next || closeMenu(null)}>
      <DropdownMenuTrigger asChild label="Menu" style={{ position: "fixed" as "absolute", left: menu.x, top: menu.y, width: 0, height: 0 }}>
        <View pointerEvents="none" />
      </DropdownMenuTrigger>
      <DropdownMenuContent sideOffset={0} testID={PANEL_ID}>
        <MenuRows items={menu.items} dark={dark} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default function BloomLayer({ menu }: { menu: OpenMenu | null }) {
  const dark = useBrowser((s) => s.ui.appDark);
  return (
    <BloomThemeProvider mode={dark ? "dark" : "light"}>
      <SurfaceHost />
      {menu ? <Menu menu={menu} dark={dark} /> : null}
    </BloomThemeProvider>
  );
}
