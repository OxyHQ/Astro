import type { BrowserCommand, MenuShortcut, ShortcutModifier } from "@astro-browser-real/shell";
import { emitAppEvent, emitCommand } from "@astro-browser/shell";
import { menuState } from "../../../../../browser/src/lib/native";
import { useBrowser } from "../../../../../browser/src/store/browser";
import { provideNativeModule } from "../../expo-modules-core";

type Mod = ShortcutModifier;
type Entry = {
  title: string;
  path: string[];
  command: BrowserCommand;
  arg?: string;
  key: string;
  mods: Mod[];
  hidden?: boolean;
  reserved?: boolean;
};
type Binding = { entry: Entry; key: string; mods: Mod[] };
type SystemEntry = { title: string; path: string[]; key: string; mods: Mod[] };

const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

const F = (n: number) => String.fromCharCode(0xf703 + n);
const UP = "";
const DOWN = "";
const LEFT = "";
const RIGHT = "";
const PAGE_UP = "";
const PAGE_DOWN = "";
const C: Mod[] = ["command"];

function menu(path: string[], items: [title: string, command: BrowserCommand, key?: string, mods?: Mod[], extra?: Partial<Entry>][]): Entry[] {
  return items.map(([title, command, key = "", mods = C, extra]) => ({ title, path, command, key, mods: key ? mods : [], ...extra }));
}

const hidden = { hidden: true };
const reserved = { reserved: true };
const hiddenReserved = { hidden: true, reserved: true };
const arg = (value: string, extra: Partial<Entry> = {}) => ({ arg: value, ...extra });

const STATIC_ENTRIES: Entry[] = [
  ...menu(["Astro"], [
    ["Settings…", "openSettings", ","],
    ["Import from Another Browser…", "importBrowserData"],
  ]),
  ...menu(["File"], [
    ["New Tab", "newTab", "t", C, reserved],
    ["New Tab in Group", "newTabInGroup", "t", ["command", "option"]],
    ["New Window", "newWindow", "n", C, reserved],
    ["New Incognito Window", "newIncognitoWindow", "n", ["command", "shift"], reserved],
    ["New Little Astro Window", "newLittleAstro", "n", ["command", "option"]],
    ["Open Links from Other Apps in Main Window", "toggleOpenLinksInLittleAstro"],
    ["Reopen Closed Tab", "reopenClosedTab", "t", ["command", "shift"], reserved],
    ["Reopen Closed Window", "reopenClosedWindow"],
    ["Open File…", "openFile", "o"],
    ["Open Command Bar", "focusCommandBar", "l"],
    ["Open Command Bar", "focusCommandBar", F(5), ["control"], hidden],
    ["Close Tab", "closeTab", "w", C, reserved],
    ["Close All Tabs", "closeAllTabs", "k", ["command", "shift"]],
    ["Clean Up Tabs", "cleanUpTabs", "k", ["command", "option"]],
    ["Save Page As…", "savePage"],
    ["Email Page Location", "emailPageLocation", "i", ["command", "shift"]],
    ["Print…", "print", "p"],
    ["Print Using System Dialog…", "printWithSystemDialog", "p", ["command", "option"]],
  ]),
  ...menu(["Edit"], [
    ["Copy URL", "copyUrl", "c", ["command", "shift"]],
    ["Copy URL as Markdown", "copyUrlAsMarkdown", "c", ["command", "option", "shift"]],
  ]),
  ...menu(["Edit", "Find"], [
    ["Find…", "findInPage", "f"],
    ["Find and Replace…", "findAndReplace", "f", ["command", "option"]],
    ["Find Next", "findNext", "g"],
    ["Find Previous", "findPrevious", "g", ["command", "shift"]],
    ["Use Selection for Find", "useSelectionForFind", "e"],
    ["Jump to Selection", "jumpToSelection", "j"],
  ]),
  ...menu(["Edit", "AutoFill"], [
    ["Contact…", "autofill", "", C, arg("contact")],
    ["Passwords…", "autofill", "", C, arg("passwords")],
    ["Credit Card…", "autofill", "", C, arg("creditCard")],
  ]),
  ...menu(["View", "Appearance"], [
    ["Automatic", "setAppearance", "", C, arg("auto")],
    ["Light", "setAppearance", "", C, arg("light")],
    ["Dark", "setAppearance", "", C, arg("dark")],
  ]),
  ...menu(["View"], [
    ["Stop", "stop", "."],
    ["Refresh", "reload", "r"],
    ["Force Refresh the Page", "forceReload", "r", ["command", "shift"]],
    ["Show Tabs in Sidebar", "toggleTabLayout", "s", ["command", "shift"]],
    ["Auto-Hide Tabs", "toggleSidebar", "s"],
    ["Auto-Hide Tabs", "toggleSidebar", "l", ["command", "shift"], hidden],
    ["Auto-Hide Tabs", "toggleSidebar", "f", ["command", "shift"], hidden],
    ["Open Split Pane", "openSplitPane", "=", ["control", "shift"]],
    ["Focus Next Split Pane", "focusNextPane", "]", ["control", "shift"]],
    ["Focus Previous Split Pane", "focusPreviousPane", "[", ["control", "shift"]],
  ]),
  ...menu(["View", "Show Bookmarks Bar"], [
    ["Always", "setBookmarksBar", "", C, arg("always")],
    ["On New Tab Only", "setBookmarksBar", "", C, arg("newTab")],
    ["Never", "setBookmarksBar", "", C, arg("never")],
    ["Toggle Bookmarks Bar", "toggleBookmarksBar", "b", ["command", "shift"]],
  ]),
  ...menu(["View"], [
    ["Show Full URL", "toggleFullUrl"],
    ["Show Address Bar in Sidebar", "toggleAddressBar"],
    ["Cast…", "cast"],
    ["Zoom to Actual Size", "zoomReset", "0"],
    ["Zoom In", "zoomIn", "+"],
    ["Zoom In", "zoomIn", "=", C, hidden],
    ["Zoom Out", "zoomOut", "-"],
  ]),
  ...menu(["View", "Developer"], [
    ["View Source", "viewSource", "u", ["command", "option"]],
    ["Developer Tools", "devTools", "i", ["command", "option"]],
    ["Inspect Elements", "inspectElements", "c", ["command", "option"]],
    ["JavaScript Console", "javaScriptConsole", "j", ["command", "option"]],
    ["Toggle Developer Tools", "toggleDevTools", F(12), [], hidden],
    ["Caret Browsing", "caretBrowsing", F(7), [], hidden],
  ]),
  ...menu(["Tabs"], [
    ["Go Back", "back", "["],
    ["Go Forward", "forward", "]"],
    ["Go Back", "back", LEFT, C, hidden],
    ["Go Forward", "forward", RIGHT, C, hidden],
    ["Next Tab", "nextTab", "]", ["command", "shift"], reserved],
    ["Previous Tab", "previousTab", "[", ["command", "shift"], reserved],
    ["Next Tab", "nextTab", RIGHT, ["command", "option"], hiddenReserved],
    ["Previous Tab", "previousTab", LEFT, ["command", "option"], hiddenReserved],
    ["Next Tab", "nextTab", PAGE_DOWN, ["control"], hiddenReserved],
    ["Previous Tab", "previousTab", PAGE_UP, ["control"], hiddenReserved],
    ["Next Tab", "nextTab", DOWN, ["command", "option"], hidden],
    ["Previous Tab", "previousTab", UP, ["command", "option"], hidden],
    ["Move Tab Down", "moveTabDown", PAGE_DOWN, ["control", "shift"], hidden],
    ["Move Tab Up", "moveTabUp", PAGE_UP, ["control", "shift"], hidden],
    ["Search Tabs…", "searchTabs", "a", ["command", "shift"]],
    ["Tab Switcher (forward)", "tabSwitcher", "\t", ["control"], arg("forward", hiddenReserved)],
    ["Tab Switcher (backward)", "tabSwitcher", "\t", ["control", "shift"], arg("backward", hiddenReserved)],
    ["Back to Pinned URL", "returnToPinnedUrl", "\r", C, hidden],
    ...Array.from({ length: 8 }, (_, i): [string, BrowserCommand, string, Mod[], Partial<Entry>] => [`Select Tab ${i + 1}`, "selectTab", `${i + 1}`, C, arg(`${i + 1}`, hidden)]),
    ["Select Last Tab", "selectLastTab", "9", C, hidden],
    ["Pin", "togglePin"],
    ["Move to Pinned", "togglePinnedRow", "d", ["command", "option", "shift"]],
    ["Duplicate", "duplicateTab"],
    ["New Group with Tab", "newGroupWithTabs", "n", ["command", "control"]],
    ["New Group with Tab", "newGroupWithTabs", "p", ["command", "control"], hidden],
    ["New Tab in Group", "newTabInGroup", "c", ["command", "control"], hidden],
    ["Close Group", "closeTabGroup", "w", ["command", "control"], hidden],
    ["Add to Bookmarks…", "bookmarkPage", "d"],
    ["Rename…", "renameTab"],
    ["Change Icon…", "changeTabIcon"],
    ["Mute Site", "toggleMute"],
  ]),
  ...menu(["Bookmarks"], [
    ["Bookmark This Page", "bookmarkPage", "d"],
    ["Bookmark All Tabs…", "bookmarkAllTabs", "d", ["command", "shift"]],
    ["Manage Bookmarks", "manageBookmarks", "b", ["command", "option"]],
  ]),
  ...menu(["History"], [
    ["Show History…", "showHistory", "y"],
    ["Clear Browsing Data…", "clearBrowsingData", "\u0008", ["command", "shift"]],
  ]),
  ...menu(["Window"], [
    ["Downloads", "downloads", "j", ["command", "shift"]],
    ["Downloads", "downloads", "l", ["command", "option"], hidden],
    ["Task Manager", "taskManager"],
    ["Merge All Windows", "mergeAllWindows"],
    ["Show Profiles Menu", "openProfileMenu", "m", ["command", "shift"], hidden],
  ]),
  ...menu(["Help"], [
    ["Send Feedback…", "sendFeedback", "i", ["command", "option", "shift"]],
    ["Keyboard Shortcuts", "keyboardShortcuts"],
    ["Tool Tour", "toolTour"],
    ["Video Tour", "videoTour"],
    ["Release Notes", "releaseNotes"],
    ["Copy Diagnostics", "copyDiagnostics"],
    ["Record Performance Issue…", "recordPerformanceIssue"],
  ]),
];

const SYSTEM_ENTRIES: SystemEntry[] = [
  { title: isMac ? "Quit Astro" : "Exit", path: ["Astro"], key: "q", mods: isMac ? C : ["command", "shift"] },
  { title: "Close Window", path: ["File"], key: "w", mods: ["command", "shift"] },
  { title: "Undo", path: ["Edit"], key: "z", mods: C },
  { title: "Redo", path: ["Edit"], key: "z", mods: ["command", "shift"] },
  { title: "Cut", path: ["Edit"], key: "x", mods: C },
  { title: "Copy", path: ["Edit"], key: "c", mods: C },
  { title: "Paste", path: ["Edit"], key: "v", mods: C },
  { title: "Paste and Match Style", path: ["Edit"], key: "v", mods: ["command", "shift"] },
  { title: "Select All", path: ["Edit"], key: "a", mods: C },
  { title: isMac ? "Enter Full Screen" : "Full Screen", path: ["View"], key: isMac ? "f" : F(11), mods: isMac ? ["function"] : [] },
];

function dynamicEntries(): Entry[] {
  const state = menuState(useBrowser.getState());
  return [
    ...state.profiles.map((profile, i): Entry => ({
      title: profile.title,
      path: ["Window", "Profiles"],
      command: "switchProfile",
      arg: profile.id,
      key: i < 9 ? `${i + 1}` : "",
      mods: i < 9 ? ["control"] : [],
    })),
    ...menu(["Window", "Profiles"], [
      ["Next Profile", "nextProfile"],
      ["Previous Profile", "previousProfile"],
      ["New Profile…", "newProfile"],
    ]),
    ...(state.extensions ?? []).map((extension): Entry => ({ title: extension.title, path: ["Extensions"], command: "openExtension", arg: extension.id, key: "", mods: [] })),
    ...menu(["Extensions"], [
      ["Add Extension…", "addExtension"],
      ["Manage Extensions…", "manageExtensions"],
      ["Pin Extensions…", "pinExtensions"],
    ]),
  ];
}

const entries = () => [...STATIC_ENTRIES, ...dynamicEntries()];

const SHIFTED: Record<string, string> = {
  "+": "=", "{": "[", "}": "]", ":": ";", _: "-", '"': "'", "<": ",", ">": ".", "?": "/", "|": "\\", "~": "`",
  "!": "1", "@": "2", "#": "3", $: "4", "%": "5", "^": "6", "&": "7", "*": "8", "(": "9", ")": "0",
};
const MOD_ORDER: Mod[] = ["control", "option", "shift", "command", "function"];

function comboId(key: string, mods: Mod[]) {
  if (!key) return "";
  const base = SHIFTED[key] ?? key.toLowerCase();
  const all = new Set<Mod>(base !== key ? [...mods, "shift"] : mods);
  return `${MOD_ORDER.filter((m) => all.has(m)).join("+")}|${base}`;
}

const idOf = (entry: Entry) => (entry.arg === undefined ? entry.command : `${entry.command}:${entry.arg}`);

type Group = { id: string; primary: Entry; items: Entry[] };

function groupsOf(list: Entry[]): Group[] {
  const groups = new Map<string, Group>();
  for (const entry of list) {
    const id = idOf(entry);
    const group = groups.get(id);
    if (!group) groups.set(id, { id, primary: entry, items: [entry] });
    else {
      group.items.push(entry);
      if (group.primary.hidden && !entry.hidden) group.primary = entry;
    }
  }
  return [...groups.values()];
}

const PC_CONTROL_KEYS = new Set(["\t", PAGE_UP, PAGE_DOWN, F(5)]);
const FALLBACK_SWAP: Partial<Record<Mod, Mod>> = isMac ? { command: "control", control: "option" } : { command: "option", control: "option" };

let reservedFallbacks = true;

function defaultCombos(entry: Entry): Mod[][] {
  const combos = [entry.mods];
  if (!isMac && PC_CONTROL_KEYS.has(entry.key) && entry.mods.includes("control") && !entry.mods.includes("command")) {
    combos.push(entry.mods.map((m) => (m === "control" ? "command" : m)));
  }
  if (entry.reserved && reservedFallbacks) combos.push(entry.mods.map((m) => FALLBACK_SWAP[m] ?? m));
  return combos;
}

function bindings(overrides: Record<string, string[]>): Binding[] {
  const taken = new Set(Object.values(overrides).map((o) => comboId(o[0] ?? "", o.slice(1) as Mod[])));
  const result: Binding[] = [];
  for (const group of groupsOf(entries())) {
    const override = overrides[group.id];
    for (const entry of group.items) {
      const carries = entry === group.primary || !entry.hidden;
      if (override) {
        if (carries && override[0]) result.push({ entry, key: override[0], mods: override.slice(1) as Mod[] });
        continue;
      }
      if (!entry.key || (!carries && taken.has(comboId(entry.key, entry.mods)))) continue;
      for (const mods of defaultCombos(entry)) result.push({ entry, key: entry.key, mods });
    }
  }
  return result;
}

type Table = { overrides: Record<string, string[]>; profiles: unknown; extensions: string; byCombo: Map<string, Binding> };
let cached: Table | null = null;

function table(): Table {
  const state = useBrowser.getState();
  const overrides = state.settings.shortcuts ?? {};
  const extensions = Object.keys(overrides).some((id) => id.startsWith("openExtension:"))
    ? (menuState(state).extensions ?? []).map((x) => x.id).join()
    : "";
  if (!cached || cached.overrides !== overrides || cached.profiles !== state.profileOrder || cached.extensions !== extensions) {
    const byCombo = new Map<string, Binding>();
    for (const binding of bindings(overrides)) {
      const id = comboId(binding.key, binding.mods);
      if (!byCombo.has(id)) byCombo.set(id, binding);
    }
    cached = { overrides, profiles: state.profileOrder, extensions, byCombo };
  }
  return cached;
}

const CODE_KEYS: Record<string, string> = {
  Minus: "-", Equal: "=", BracketLeft: "[", BracketRight: "]", Backslash: "\\", Semicolon: ";", Quote: "'", Comma: ",", Period: ".",
  Slash: "/", Backquote: "`", Space: " ", Tab: "\t", Enter: "\r", NumpadEnter: "\r", Backspace: "\u0008", Escape: "\u001b",
  Delete: "", ArrowUp: UP, ArrowDown: DOWN, ArrowLeft: LEFT, ArrowRight: RIGHT, Home: "", End: "",
  PageUp: PAGE_UP, PageDown: PAGE_DOWN, NumpadAdd: "=", NumpadSubtract: "-",
};

export type KeyInput = { code: string; key: string; ctrlKey: boolean; altKey: boolean; shiftKey: boolean; metaKey: boolean };

function keyOfCode(code: string): string {
  const letter = /^Key([A-Z])$/.exec(code);
  if (letter) return letter[1]!.toLowerCase();
  const digit = /^(?:Digit|Numpad)(\d)$/.exec(code);
  if (digit) return digit[1]!;
  const fn = /^F(\d{1,2})$/.exec(code);
  if (fn) return F(Number(fn[1]));
  return CODE_KEYS[code] ?? "";
}

const ALL_CODES = [
  ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map((c) => `Key${c}`),
  ...Array.from({ length: 10 }, (_, i) => [`Digit${i}`, `Numpad${i}`]).flat(),
  ...Array.from({ length: 24 }, (_, i) => `F${i + 1}`),
  ...Object.keys(CODE_KEYS),
];
const CODES_FOR_KEY = new Map<string, string[]>();
for (const code of ALL_CODES) CODES_FOR_KEY.set(keyOfCode(code), [...(CODES_FOR_KEY.get(keyOfCode(code)) ?? []), code]);

function modsOf(e: KeyInput): Mod[] {
  const mods: Mod[] = [];
  if (isMac ? e.ctrlKey : e.metaKey) mods.push("control");
  if (e.altKey) mods.push("option");
  if (e.shiftKey) mods.push("shift");
  if (isMac ? e.metaKey : e.ctrlKey) mods.push("command");
  return mods;
}

const PHYSICAL: Record<Mod, number> = { shift: 1, command: isMac ? 8 : 2, option: 4, control: isMac ? 2 : 8, function: 0 };

function physicalCombos(key: string, mods: Mod[]): string[] {
  const base = SHIFTED[key] ?? key.toLowerCase();
  const all = new Set<Mod>(base !== key ? [...mods, "shift"] : mods);
  const mask = [...all].reduce((sum, m) => sum | PHYSICAL[m], 0);
  return (CODES_FOR_KEY.get(base) ?? []).map((code) => `${code}|${mask}`);
}

const isFunctionKey = (key: string) => {
  const code = key.charCodeAt(0);
  return code >= 0xf704 && code <= 0xf726;
};

const TEXT_ENTRY = "input, textarea, [contenteditable=''], [contenteditable='true']";
const inText = () => !!(document.activeElement instanceof Element && document.activeElement.matches(TEXT_ENTRY));

function yieldsToText(binding: Binding) {
  if (binding.key === "\r") return true;
  return (binding.key === LEFT || binding.key === RIGHT) && binding.mods.length === 1 && binding.mods[0] === "command";
}

function isDisabled(entry: Entry) {
  const disabled = menuState(useBrowser.getState()).disabled;
  return disabled.includes(entry.command) || disabled.includes(idOf(entry));
}

function shortcutList(): MenuShortcut[] {
  const overrides = useBrowser.getState().settings.shortcuts ?? {};
  const list: MenuShortcut[] = groupsOf(entries()).map(({ id, primary, items }) => {
    const override = overrides[id];
    const key = override ? (override[0] ?? "") : primary.key;
    const seen = new Set([comboId(primary.key, primary.mods)]);
    const aliases = items
      .filter((other) => other !== primary && other.key && !seen.has(comboId(other.key, other.mods)) && seen.add(comboId(other.key, other.mods)))
      .map((other) => [other.key, ...other.mods]);
    return {
      id,
      title: primary.title,
      path: primary.path,
      key,
      modifiers: key ? (override ? (override.slice(1) as Mod[]) : primary.mods) : [],
      defaultKey: primary.key,
      defaultModifiers: primary.mods,
      remappable: true,
      aliases,
    };
  });
  for (const entry of SYSTEM_ENTRIES) {
    list.push({
      id: `system:${[...entry.path, entry.title].join(" > ")}`,
      title: entry.title,
      path: entry.path,
      key: entry.key,
      modifiers: entry.mods,
      defaultKey: entry.key,
      defaultModifiers: entry.mods,
      remappable: false,
      aliases: [],
    });
  }
  return list;
}

const captureListeners = new Set<(capturing: boolean) => void>();
const recorder = { resolve: null as ((combo: { key: string; modifiers: Mod[] } | null) => void) | null };
const switcher = { capturing: false, holding: null as Mod | null };

export const capturingKeys = () => !!recorder.resolve || switcher.capturing;

function captureChanged() {
  for (const listener of captureListeners) listener(capturingKeys());
}

export function onKeyCaptureChange(listener: (capturing: boolean) => void) {
  captureListeners.add(listener);
  return () => void captureListeners.delete(listener);
}

function finishRecording(combo: { key: string; modifiers: Mod[] } | null) {
  const resolve = recorder.resolve;
  recorder.resolve = null;
  resolve?.(combo);
  if (resolve) captureChanged();
}

function record(e: KeyInput) {
  const mods = modsOf(e);
  const key = keyOfCode(e.code);
  if (e.code === "Escape" && mods.length === 0) return finishRecording(null);
  if (!key) return;
  if (!mods.includes("command") && !mods.includes("control") && !isFunctionKey(key)) return;
  finishRecording({ key, modifiers: MOD_ORDER.filter((m) => mods.includes(m)) });
}

const holdKey = (mod: Mod) => {
  if (mod === "option") return "Alt";
  if (mod === "shift") return "Shift";
  if (mod === "command") return isMac ? "Meta" : "Control";
  return isMac ? "Control" : "Meta";
};

function run(binding: Binding) {
  if (binding.entry.command === "tabSwitcher") switcher.holding = binding.mods.find((m) => m !== "shift") ?? null;
  emitCommand({ command: binding.entry.command, arg: binding.entry.arg ?? null, windowId: useBrowser.getState().ui.focusedWindowId });
}

export function keyDown(e: KeyInput, fromPage = true): boolean {
  if (recorder.resolve) {
    record(e);
    return true;
  }
  if (switcher.capturing && !(e.code === "Tab" && (e.ctrlKey || e.altKey))) {
    const key = e.key === "Escape" ? "escape" : e.key === "ArrowRight" ? "next" : e.key === "ArrowLeft" ? "previous" : null;
    if (key) emitAppEvent({ type: "switcherKey", key });
    return true;
  }
  const key = keyOfCode(e.code);
  if (!key) return false;
  const binding = table().byCombo.get(comboId(key, modsOf(e)));
  if (!binding) return false;
  if (fromPage && yieldsToText(binding) && inText()) return false;
  if (isDisabled(binding.entry)) return !fromPage;
  run(binding);
  return true;
}

export function keyUp(e: Pick<KeyInput, "key">) {
  if (!switcher.holding || e.key !== holdKey(switcher.holding)) return;
  switcher.holding = null;
  emitAppEvent({ type: "switcherReleased" });
}

export function takeKeysFromEngine() {
  reservedFallbacks = false;
  cached = null;
}

export function shortcutCombos(): { active: string[]; owned: string[] } {
  const active = new Set<string>();
  for (const binding of table().byCombo.values()) {
    if (!yieldsToText(binding)) for (const combo of physicalCombos(binding.key, binding.mods)) active.add(combo);
  }
  const owned = new Set(active);
  for (const entry of entries()) {
    if (entry.key) for (const mods of defaultCombos(entry)) for (const combo of physicalCombos(entry.key, mods)) owned.add(combo);
  }
  return { active: [...active].sort(), owned: [...owned].sort() };
}

function onKeyDown(e: KeyboardEvent) {
  if (!keyDown(e)) return;
  e.preventDefault();
  e.stopPropagation();
}

function onPointerDown() {
  if (recorder.resolve) finishRecording(null);
}

function onPointerUp() {
  if (switcher.capturing) emitAppEvent({ type: "switcherMouseUp" });
}

function onBlur() {
  if (!switcher.holding) return;
  switcher.holding = null;
  emitAppEvent({ type: "switcherReleased" });
}

provideNativeModule("AstroShell", {
  setSwitcherCapture: async (active: boolean) => {
    switcher.capturing = active;
    captureChanged();
  },
});

provideNativeModule("AstroSystem", {
  menuShortcuts: async () => shortcutList(),
  recordShortcut: () =>
    new Promise<{ key: string; modifiers: Mod[] } | null>((resolve) => {
      finishRecording(null);
      recorder.resolve = resolve;
      captureChanged();
    }),
  cancelRecording: async () => finishRecording(null),
});

if (typeof window !== "undefined") {
  window.addEventListener("keydown", onKeyDown, true);
  window.addEventListener("keyup", keyUp, true);
  window.addEventListener("pointerdown", onPointerDown, true);
  window.addEventListener("pointerup", onPointerUp, true);
  window.addEventListener("blur", onBlur);
}
