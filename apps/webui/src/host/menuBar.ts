import type { BrowserCommand, MenuBookmark, MenuState, ShortcutModifier } from "@astro-browser-real/shell";
import { menuState } from "../../../browser/src/lib/native";
import { useBrowser } from "../../../browser/src/store/browser";
import { menuBarCommands, type MenuBarCommand } from "../../../demo/src/shims/web/motion/shortcuts";
import { emitCommand } from "../shims/shell";
import { loadCr } from "./engine";
import { pageWindowId } from "./windows";

declare const chrome: { send(method: string, args?: unknown[]): void };

export const MENU_BAR_MENUS = ["File", "Edit", "View", "Tabs", "History", "Bookmarks", "Extensions", "Window", "Help"] as const;

export type PlatformMenuEntry = { parent: number; kind: 1 | 2 | 3 | 4; label?: string; shortcut?: string; disabled?: boolean; checked?: boolean };
export type MenuBarAction = { command: BrowserCommand; arg: string | null } | { edit: string } | { closeWindow: true } | null;

type Node =
  | { label: string; children: Node[]; disabled?: boolean }
  | { label: string; action: MenuBarAction; shortcut?: string; disabled?: boolean; checked?: boolean }
  | { separator: true };

const MOST_ENTRIES = 256;
const MENU_BAR_SETTLE_MS = 200;

const EDIT_COMMANDS: Record<string, string> = {
  Undo: "undo",
  Redo: "redo",
  Cut: "cut",
  Copy: "copy",
  Paste: "paste",
  "Paste and Match Style": "pasteAndMatchStyle",
  "Select All": "selectAll",
};

const KEY_NAMES: Record<string, string> = {
  "\t": "Tab",
  "\r": "Enter",
  "\u0008": "Backspace",
  "\u001b": "Esc",
  " ": "Space",
  "+": "Plus",
  [String.fromCharCode(0xf700)]: "Up",
  [String.fromCharCode(0xf701)]: "Down",
  [String.fromCharCode(0xf702)]: "Left",
  [String.fromCharCode(0xf703)]: "Right",
  [String.fromCharCode(0xf72c)]: "PageUp",
  [String.fromCharCode(0xf72d)]: "PageDown",
};

const MODIFIER_NAMES: [ShortcutModifier, string][] = [
  ["command", "Mod"],
  ["control", "Super"],
  ["option", "Alt"],
  ["shift", "Shift"],
];

export function chordOf(key: string, mods: ShortcutModifier[]): string | undefined {
  if (!key) return undefined;
  const code = key.charCodeAt(0);
  const name = code >= 0xf704 && code <= 0xf726 ? `F${code - 0xf703}` : (KEY_NAMES[key] ?? key.toUpperCase());
  return [...MODIFIER_NAMES.filter(([mod]) => mods.includes(mod)).map(([, label]) => label), name].join("+");
}

const CHECKABLE: ReadonlySet<BrowserCommand> = new Set<BrowserCommand>([
  "setAppearance",
  "setBookmarksBar",
  "toggleFullUrl",
  "toggleJavaScriptFromAppleEvents",
  "toggleAddressBar",
  "toggleTabLayout",
  "toggleSidebar",
]);

function stateOf(state: MenuState, command: BrowserCommand, arg: string | undefined) {
  const checkedId = arg === undefined ? command : `${command}:${arg}`;
  const disabled = state.disabled.includes(command) || state.disabled.includes(checkedId);
  if (command === "switchProfile") return { disabled, checked: state.profiles.some((profile) => profile.id === arg && profile.current) };
  return { disabled, ...(CHECKABLE.has(command) ? { checked: state.checked.includes(checkedId) } : {}) };
}

function commandNode(state: MenuState, entry: MenuBarCommand): Node | null {
  if (entry.system) {
    const edit = EDIT_COMMANDS[entry.system];
    if (edit) return { label: entry.system, action: { edit }, shortcut: chordOf(entry.key, entry.mods) };
    if (entry.system === "Close Window") return { label: entry.system, action: { closeWindow: true }, shortcut: chordOf(entry.key, entry.mods) };
    return null;
  }
  if (!entry.command) return null;
  return {
    label: state.titles[entry.command] ?? entry.title,
    action: { command: entry.command, arg: entry.arg ?? null },
    shortcut: chordOf(entry.key, entry.mods),
    ...stateOf(state, entry.command, entry.arg),
  };
}

function bookmarkNodes(nodes: MenuBookmark[]): Node[] {
  return nodes.map((node) =>
    node.children
      ? { label: node.title || "Folder", children: bookmarkNodes(node.children) }
      : { label: node.title || node.url || "Bookmark", action: { command: "openBookmark", arg: node.id } },
  );
}

const separated = (...groups: Node[][]): Node[] =>
  groups.filter((group) => group.length).flatMap((group, i) => (i ? [{ separator: true } as Node, ...group] : group));

export function menuBarTree(state: MenuState, commands: MenuBarCommand[]): Node[] {
  const at = (path: string[]) =>
    commands.filter((entry) => entry.path.length === path.length && entry.path.every((part, i) => part === path[i]));
  const nodes = (path: string[]) => at(path).map((entry) => commandNode(state, entry)).filter((node): node is Node => !!node);
  const submenu = (label: string, path: string[], extra: Node[] = []): Node[] => {
    const children = [...nodes(path), ...extra];
    return children.length ? [{ label, children }] : [];
  };
  const command = (label: string, name: BrowserCommand, arg?: string): Node => ({ label, action: { command: name, arg: arg ?? null }, ...stateOf(state, name, arg) });
  const edit = nodes(["Edit"]);
  const editing = edit.filter((node) => "action" in node && node.action && "edit" in node.action);
  const urls = edit.filter((node) => !editing.includes(node));
  const closed = state.recentlyClosed.map((entry) => command(entry.title, "restoreClosed", entry.id));
  const history = [command("Show Library…", "showLibrary")];
  const bookmarkPage = commands.find((entry) => entry.command === "bookmarkPage");
  const bookmarkThisPage: Node = { ...command("Bookmark This Page", "bookmarkPage"), shortcut: bookmarkPage ? chordOf(bookmarkPage.key, bookmarkPage.mods) : undefined };
  const profiles = submenu("Profiles", ["Window", "Profiles"]);
  return [
    { label: "File", children: separated(nodes(["File"])) },
    {
      label: "Edit",
      children: separated(
        editing.slice(0, 2),
        [...editing.slice(2), ...urls],
        [...submenu("Find", ["Edit", "Find"]), ...submenu("AutoFill", ["Edit", "AutoFill"])],
        nodes(["Astro"]),
      ),
    },
    {
      label: "View",
      children: separated(
        submenu("Appearance", ["View", "Appearance"]),
        nodes(["View"]),
        submenu("Show Bookmarks Bar", ["View", "Show Bookmarks Bar"]),
        submenu("Developer", ["View", "Developer"]),
      ),
    },
    { label: "Tabs", children: separated(nodes(["Tabs"])) },
    { label: "History", children: separated(nodes(["History"]), history, closed) },
    {
      label: "Bookmarks",
      children: separated(
        [bookmarkThisPage, ...nodes(["Bookmarks"])],
        bookmarkNodes(state.bookmarksBar),
        state.otherBookmarks.length ? [{ label: "Other Bookmarks", children: bookmarkNodes(state.otherBookmarks) }] : [],
      ),
    },
    { label: "Extensions", children: separated(nodes(["Extensions"])) },
    { label: "Window", children: separated(nodes(["Window"]), profiles) },
    { label: "Help", children: separated(nodes(["Help"])) },
  ];
}

export function flattenMenuBar(tree: Node[]): { entries: PlatformMenuEntry[]; actions: MenuBarAction[] } {
  const entries: PlatformMenuEntry[] = [];
  const actions: MenuBarAction[] = [];
  const add = (node: Node, parent: number, depth: number) => {
    if (entries.length >= MOST_ENTRIES) return;
    if ("separator" in node) {
      entries.push({ parent, kind: 4 });
      actions.push(null);
      return;
    }
    if ("children" in node) {
      if (depth >= 4) return;
      const index = entries.length;
      entries.push({ parent, kind: parent < 0 ? 1 : 3, label: node.label, ...(node.disabled || !node.children.length ? { disabled: true } : {}) });
      actions.push(null);
      for (const child of node.children) add(child, index, depth + 1);
      return;
    }
    entries.push({
      parent,
      kind: 2,
      label: node.label,
      ...(node.shortcut ? { shortcut: node.shortcut } : {}),
      ...(node.disabled ? { disabled: true } : {}),
      ...(node.checked === undefined ? {} : { checked: node.checked }),
    });
    actions.push(node.action);
  };
  for (const menu of tree) add(menu, -1, 0);
  return { entries, actions };
}

let shown = false;
const shownListeners = new Set<(shown: boolean) => void>();

export const menuBarShown = () => shown;

export function onMenuBarShown(listener: (shown: boolean) => void) {
  shownListeners.add(listener);
  return () => void shownListeners.delete(listener);
}

function run(action: MenuBarAction) {
  if (!action) return;
  if ("edit" in action) return chrome.send("astroEditCommand", [action.edit]);
  if ("closeWindow" in action) return chrome.send("astroCloseWindow");
  emitCommand({ command: action.command, arg: action.arg, windowId: pageWindowId() });
}

export async function startMenuBar() {
  const cr = await loadCr();
  let actions: MenuBarAction[] = [];
  let sent = "";
  let scheduled = false;
  const push = () => {
    scheduled = false;
    const flat = flattenMenuBar(menuBarTree(menuState(useBrowser.getState()), menuBarCommands()));
    const next = JSON.stringify(flat.entries);
    if (next === sent) {
      actions = flat.actions;
      return;
    }
    sent = next;
    void cr.sendWithPromise<boolean>("astroMenuBar", flat.entries).then((ok) => {
      actions = flat.actions;
      if (ok === shown) return;
      shown = ok;
      for (const listener of shownListeners) listener(ok);
    });
  };
  const schedule = () => {
    if (scheduled) return;
    scheduled = true;
    setTimeout(push, MENU_BAR_SETTLE_MS);
  };
  push();
  useBrowser.subscribe(schedule);
  const add = cr.addWebUiListener as unknown as (event: string, listener: (kind: string, payload: { index?: number }) => void) => void;
  add("astro-host-event", (kind, payload) => {
    if (kind === "menuBarItem" && typeof payload.index === "number") run(actions[payload.index] ?? null);
  });
}
