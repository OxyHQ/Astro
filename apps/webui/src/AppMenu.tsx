import type { BrowserCommand, MenuBookmark, MenuItem, MenuState } from "@astro-browser-real/shell";
import { openUrls } from "../../browser/src/lib/actions";
import { menuState } from "../../browser/src/lib/native";
import { useBrowser } from "../../browser/src/store/browser";
import { showMenu } from "../../demo/src/shims/web/overlays";
import { TRAFFIC_LIGHT_DIAMETER, TRAFFIC_LIGHT_SPACING, useTrafficLightsCenter } from "../../demo/src/shims/web/windowChrome";
import { displayVersion } from "./host/appcast";
import { checkForUpdatesNow, installReadyUpdate, releaseNotesFor, updateMenuState } from "./host/updater";
import { pageWindowId } from "./host/windows";
import { APP_MENU_BUTTON_GAP, APP_MENU_BUTTON_SIZE, emitCommand, requestQuit } from "./shims/shell";

type Mod = "command" | "shift" | "option" | "control";
type Spec = [title: string, command: BrowserCommand, key?: string, mods?: Mod[], arg?: string];

const SEPARATOR = "\u0000";
const QUIT = "astro:quit";
const CHECK_FOR_UPDATES = "astro:checkForUpdates";
const INSTALL_UPDATE = "astro:installUpdate";
const UPDATE_NOTES = "astro:updateNotes";

const separator: MenuItem = { separator: true };

function command(state: MenuState, [title, name, key, modifiers = ["command"], arg]: Spec): MenuItem {
  const id = arg === undefined ? name : `${name}${SEPARATOR}${arg}`;
  const checkedId = arg === undefined ? name : `${name}:${arg}`;
  const disabled = state.disabled.includes(name) || state.disabled.includes(checkedId);
  return {
    id,
    title: state.titles[name] ?? title,
    ...(key ? { key, modifiers } : {}),
    enabled: !disabled,
    checked: state.checked.includes(checkedId),
  };
}

const submenu = (title: string, children: MenuItem[]): MenuItem => ({ id: `menu:${title}`, title, children, enabled: children.length > 0 });

function bookmarkItems(nodes: MenuBookmark[]): MenuItem[] {
  return nodes.map((node) =>
    node.children
      ? submenu(node.title || "Folder", bookmarkItems(node.children))
      : { id: `openBookmark${SEPARATOR}${node.id}`, title: node.title || node.url || "Bookmark" },
  );
}

function updateItems(): { help: MenuItem[]; ready: MenuItem[] } {
  const updates = updateMenuState();
  if (!updates) return { help: [], ready: [] };
  return {
    help: [
      separator,
      { id: CHECK_FOR_UPDATES, title: "Check for Updates…" },
      ...(updates.ready ? [{ id: `${UPDATE_NOTES}${SEPARATOR}${updates.ready}`, title: `What's New in Astro ${displayVersion(updates.ready)}` }] : []),
    ],
    ready: updates.ready ? [{ id: INSTALL_UPDATE, title: `Restart and Update to Astro ${displayVersion(updates.ready)}` }] : [],
  };
}

function appMenu(state: MenuState): MenuItem[] {
  const c = (spec: Spec) => command(state, spec);
  const updates = updateItems();
  const closed = state.recentlyClosed.map((entry) => c([entry.title, "restoreClosed", undefined, undefined, entry.id]));
  return [
    c(["New Tab", "newTab", "t"]),
    c(["New Window", "newWindow", "n"]),
    c(["New Incognito Window", "newIncognitoWindow", "n", ["command", "shift"]]),
    separator,
    submenu("Profiles", [
      ...state.profiles.map((profile, i) => ({ ...c([profile.title, "switchProfile", i < 9 ? `${i + 1}` : undefined, ["control"], profile.id]), checked: profile.current })),
      separator,
      c(["New Profile…", "newProfile"]),
    ]),
    submenu("History", [
      c(["Show History…", "showHistory", "y"]),
      c(["Reopen Closed Tab", "reopenClosedTab", "t", ["command", "shift"]]),
      c(["Reopen Closed Window", "reopenClosedWindow"]),
      c(["Clear Browsing Data…", "clearBrowsingData"]),
      ...(closed.length ? [separator, ...closed] : []),
    ]),
    submenu("Bookmarks", [
      c(["Bookmark This Page", "bookmarkPage", "d"]),
      c(["Bookmark All Tabs…", "bookmarkAllTabs", "d", ["command", "shift"]]),
      c(["Manage Bookmarks", "manageBookmarks", "b", ["command", "option"]]),
      submenu("Show Bookmarks Bar", [
        c(["Always", "setBookmarksBar", undefined, undefined, "always"]),
        c(["On New Tab Only", "setBookmarksBar", undefined, undefined, "newTab"]),
        c(["Never", "setBookmarksBar", undefined, undefined, "never"]),
      ]),
      ...(state.bookmarksBar.length ? [separator, ...bookmarkItems(state.bookmarksBar)] : []),
      ...(state.otherBookmarks.length ? [submenu("Other Bookmarks", bookmarkItems(state.otherBookmarks))] : []),
    ]),
    c(["Downloads", "downloads", "j", ["command", "shift"]]),
    submenu("Extensions", [
      ...(state.extensions ?? []).map((extension) => ({ ...c([extension.title, "openExtension", undefined, undefined, extension.id]), enabled: extension.enabled })),
      ...(state.extensions?.length ? [separator] : []),
      c(["Add Extension…", "addExtension"]),
      c(["Manage Extensions…", "manageExtensions"]),
      c(["Pin Extensions…", "pinExtensions"]),
    ]),
    separator,
    submenu("Zoom", [c(["Zoom In", "zoomIn", "+"]), c(["Zoom Out", "zoomOut", "-"]), c(["Actual Size", "zoomReset", "0"])]),
    c(["Find…", "findInPage", "f"]),
    c(["Print…", "print", "p"]),
    c(["Save Page As…", "savePage"]),
    submenu("Tabs", [
      c(["Pin", "togglePin"]),
      c(["Duplicate", "duplicateTab"]),
      c(["Move to Pinned", "togglePinnedRow", "d", ["command", "option", "shift"]]),
      c(["New Group with Tab", "newGroupWithTabs"]),
      submenu("Move to Window", [...state.windows.map((w) => c([w.title, "moveTabToWindow", undefined, undefined, w.id])), separator, c(["New Window", "moveTabToWindow", undefined, undefined, "new"])]),
      submenu("Move to Profile", [...state.profiles.map((p) => c([p.title, "moveTabToProfile", undefined, undefined, p.id])), separator, c(["New Profile…", "moveTabToProfile", undefined, undefined, "new"])]),
      separator,
      c(["Search Tabs…", "searchTabs", "a", ["command", "shift"]]),
      c(["Clean Up Tabs", "cleanUpTabs", "k", ["command", "option"]]),
      c(["Close All Tabs", "closeAllTabs", "k", ["command", "shift"]]),
      c(["Merge All Windows", "mergeAllWindows"]),
    ]),
    submenu("View", [
      submenu("Appearance", [
        c(["Automatic", "setAppearance", undefined, undefined, "auto"]),
        c(["Light", "setAppearance", undefined, undefined, "light"]),
        c(["Dark", "setAppearance", undefined, undefined, "dark"]),
      ]),
      c(["Show Tabs in Sidebar", "toggleTabLayout", "s", ["command", "shift"]]),
      c(["Auto-Hide Tabs", "toggleSidebar", "s"]),
      c(["Show Full URL", "toggleFullUrl"]),
      c(["Show Address Bar in Sidebar", "toggleAddressBar"]),
      c(["Open Split Pane", "openSplitPane", "=", ["control", "shift"]]),
    ]),
    submenu("More Tools", [
      c(["Developer Tools", "devTools", "i", ["command", "option"]]),
      c(["View Source", "viewSource", "u", ["command", "option"]]),
      c(["JavaScript Console", "javaScriptConsole", "j", ["command", "option"]]),
      c(["Task Manager", "taskManager"]),
      separator,
      c(["Copy URL", "copyUrl", "c", ["command", "shift"]]),
      c(["Copy URL as Markdown", "copyUrlAsMarkdown", "c", ["command", "option", "shift"]]),
    ]),
    separator,
    c(["Settings", "openSettings", ","]),
    submenu("Help", [c(["Keyboard Shortcuts", "keyboardShortcuts"]), c(["Show Onboarding", "showOnboarding"]), ...updates.help]),
    separator,
    ...(updates.ready.length ? [...updates.ready, separator] : []),
    { id: QUIT, title: "Exit", key: "q", modifiers: ["command", "shift"] },
  ];
}

export async function openAppMenu() {
  const chosen = await showMenu(appMenu(menuState(useBrowser.getState())));
  if (!chosen) return;
  if (chosen === QUIT) return void requestQuit();
  if (chosen === CHECK_FOR_UPDATES) return void checkForUpdatesNow();
  if (chosen === INSTALL_UPDATE) return void installReadyUpdate();
  const [name, arg] = chosen.split(SEPARATOR) as [BrowserCommand, string | undefined];
  if ((name as string) === UPDATE_NOTES && arg) return openUrls([releaseNotesFor(arg)], pageWindowId());
  emitCommand({ command: name, arg: arg ?? null, windowId: pageWindowId() });
}

export function AppMenuButton() {
  const at = useTrafficLightsCenter();
  if (!at) return null;
  return (
    <button
      type="button"
      aria-label="Menu"
      title="Menu"
      className="astro-app-menu"
      onClick={() => void openAppMenu()}
      style={{
        left: at[0] + 2 * TRAFFIC_LIGHT_SPACING + TRAFFIC_LIGHT_DIAMETER / 2 + APP_MENU_BUTTON_GAP,
        top: at[1] - APP_MENU_BUTTON_SIZE / 2,
        width: APP_MENU_BUTTON_SIZE,
        height: APP_MENU_BUTTON_SIZE,
      }}
    >
      ⋯
    </button>
  );
}
