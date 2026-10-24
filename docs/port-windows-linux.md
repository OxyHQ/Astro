# Windows and Linux

Astro runs on macOS only. This is what blocks the other two platforms and the smallest path past it.

## What blocks them

Almost nothing in the React code. `apps/browser/src` (332 files, 51k lines) uses plain React Native primitives;
the macOS-only props (`keyDownEvents`, `enableFocusRing`, `mouseDownCanMoveWindow`, `draggedTypes`) are ignored
elsewhere, and every native call goes through the wrappers in `packages/*/src`. `packages/core` is pure TypeScript.

The blockers are two:

1. **React Native has no Linux target**, and every Expo module here is Apple-only (`"platforms": ["apple"]`).
2. **Windows and tabs reach the screen through AppKit.** `WindowHost` (`engine/astrocore`, `ac_browser.mm`) makes a
   `views::Widget` with no `BrowserView`; the React Native root view is added to it (`AstroCoreChromeWindow.mm`) and
   each tab's WebContents `NSView` is reparented under `AstroCoreWebView` (`AstroCoreWebView.mm`). The public API,
   `AstroCore.h`, is 163 Objective-C methods on `NSView`, `NSWindow`, `NSEvent` and `NSImage`.

The services layer is already portable: the `ac_*` C API (`engine/chromium/src/chrome/browser/astro/public/ac_engine.h`,
JSON in and out, 66 calls in 27 `.cc` files) covers history, bookmarks, passwords, downloads and the rest. Its mac-only
parts are `ac_reauth.cc`, three `.mm` files, `assert(is_mac)` in `BUILD.gn` and a Mach-O export list. Windows, tabs and
navigation are not in it.

Engine: 42 of the 51 patches in `engine/patches` are cross-platform. Mac-only: `video-super-resolution`,
`begin-frame-warm-up`, `devtools-redock-display`, `safe-storage-name`, `angle-metal-shader-cache`. Mixed:
`cef-carryover`, `window-hosted`, `helium-branding`. `chromium-astro-layer` hooks the mac framework target. The build
pins `target_os=['mac']` (`01-sync.sh`), `target_cpu="arm64"`, the `chrome_framework` target and Helium's macOS series
(`03-helium.py`); Helium also publishes Linux and Windows series (`imputnet/helium-linux`, `imputnet/helium-windows`).

## The path: the same React UI as a WebUI window

Chromium already has a cross-platform browser window whose whole interface is a WebUI page: Webium
(`chrome/browser/ui/webui_browser/`, behind `kWebium`), with tabs embedded as real WebContents through
`components/guest_contents`. Astro's mac layer already borrows from it (`docs/astrocore-parity.md`). On Windows and
Linux, Astro runs `apps/browser` through react-native-web inside a privileged `chrome://astro` page built on that
window, and the native modules become a Mojo interface. macOS stays on react-native-macos until the web path is as good.

Overlays such as the omnibox dropdown draw over pages in plain DOM order, which a native child-window design on
Windows cannot do. `react-native-windows` was ruled out: it gives no Linux, needs every Expo module rewritten, and
would still need a native port of `engine/astrocore`.

Risks: `components/guest_contents` says it is not for production use yet; Webium's state in Chromium 155 is
unverified; each window becomes its own JS context, where macOS shares one runtime.

## Status

Steps 1 to 3 are done (2026-10-23): the Linux engine builds from the same series (`docs/engine-build.md` › "On
Linux"), runs, and opens Webium's window with `--enable-features=Webium`; `//chrome/browser/astro` links into it.

Steps 5 and 6 have a first cut that browses, built on Webium's own window instead of a fork of it: `apps/webui` is
`apps/browser` on react-native-web inside `chrome://webui-browser`. It reuses `apps/demo`'s web shims, and replaces two:

- `src/shims/WebView.tsx` and `src/host/tabs.ts`: each tab is a real Chromium tab. `TabStripService` creates, closes,
  activates and observes it, `PageHandler.getGuestIdForTabId` and `chrome.browser.attachIframeGuest` put it in the
  tab's iframe, and its `GuestHandler` navigates. Tabs a page opens become `onOpenWindow` with an `adoptId`. The last
  tab is parked on about:blank instead of closed, since Webium's window closes with its last tab.
- `src/shims/shell.tsx`: documents are files in the profile's `Astro Documents/`, written by the engine
  (`ac_documents.cc`, on a sequence that finishes before shutdown). They are all read once before the interface starts,
  so reads stay synchronous, and a write reaches the other windows over the `astro-documents` channel.
  `localStorage` was not an option: Chromium commits it lazily and lost the session on quit. `WindowDragRegion` sets `app-region: drag`. `src/WindowControls.tsx` makes the traffic lights close, minimise and
  maximise the window.

Engine calls go through `chrome.send` (`ac_engine_webui.cc`: the 18 calls macOS allows, for the default profile), and
the page's `fetch` to http(s) goes through the engine (`astroFetch`: no cookies, safe headers, 8 MB), so history,
bookmarks, favicons and search suggestions work. Ctrl+L opens the command bar, Ctrl+T opens Astro's new tab instead of
Chromium's, and a tab Chromium activates (Ctrl+Tab) becomes the shown one.

The interface ships inside the engine, as Chromium's own WebUIs do: `pnpm -C apps/webui build`, then the engine build
(step 5, `05-build.sh`) stages `apps/webui/dist` into the tree (`ui-resource.sh`), `//chrome/browser/astro:ui_resources`
packs it (a grd generated from the staged file list, then grit) and `chromium-astro-ui.patch` repacks that pak into
`resources.pak`. On Linux and Windows the engine turns on `Webium` and `AttachUnownedInnerWebContents` by default
(`chromium-astro-webium-default.patch`) and serves the interface from `resources.pak` at `chrome://webui-browser/`, so
`chrome` alone is the browser. Rebuild the engine to ship a new interface. Run it from the repository with `pnpm linux`
(it builds `apps/webui` and starts the `dev` engine on it through `scripts/linux-run.sh`), which passes
`--astro-ui-dir=$PWD/apps/webui/dist`: with that switch the engine serves the folder instead of its pak, so while
developing `pnpm -C apps/webui dev` rebuilds on change and a restart picks it up without an engine build. Without `AttachUnownedInnerWebContents`,
removing a tab's iframe hits a CHECK. Restart the browser to pick up a new build; reloading `chrome://webui-browser`
itself crashes Webium (it reopens the page as a tab, outside its window). Chromium calls
`AttachUnownedInnerWebContents` a prototype not meant for production, and GuestContents says the same: both are the
risk this design takes on.

Package it: `scripts/linux-package.sh` (`AC_ENGINE_PROFILE=dev` for the dev engine) builds `apps/webui` and writes
`~/chromium-build/release/astro-browser-<version>-x86_64.tar.xz`: the engine (rebuilt with the interface in
`resources.pak`) stripped, the `astro-browser`
launcher, `astro-browser.desktop`, its icon and an AppArmor profile (`engine/linux/`). Install it with `sudo tar -xJf
astro-browser-*.tar.xz -C /opt && sudo mv /opt/astro-browser-*-x86_64 /opt/astro-browser`, link
`/opt/astro-browser/astro-browser` into your PATH, and copy the desktop file and icon to `~/.local/share/applications/`
and `~/.local/share/icons/hicolor/256x256/apps/`. Revealing saved passwords needs the polkit action: `sudo cp
/opt/astro-browser/so.oxy.astro.policy /usr/share/polkit-1/actions/`. On Ubuntu 24.04 and later the sandbox needs the
AppArmor profile: `sudo cp /opt/astro-browser/apparmor.cfg /etc/apparmor.d/astro-browser && sudo apparmor_parser -r
/etc/apparmor.d/astro-browser`. The dev engine's package is 116 MB.

The Windows installer is Chromium's `mini_installer`: `AC_TARGET_PLATFORM=windows scripts/windows-installer.sh` (with
the Windows build's environment from `docs/engine-build.md`) builds `chrome` (the interface in `resources.pak`) and
`mini_installer` with uBlock Origin and the CLI staged beside `chrome.dll`, and writes `release/Astro-<version>-windows-x64-setup.exe`. It
installs per user into `%LOCALAPPDATA%\Oxy\Astro\Application`, keeps the profile in `%LOCALAPPDATA%\Oxy\Astro\User
Data`, creates the shortcuts and registers Astro with Windows, so it can be the default browser. Helium's Windows
patches find 7-Zip through the registry; `engine/astrocore/apply.sh` points a Linux host at Chromium's own `7za`. The
engine looks for `extensions/ublock` beside `chrome.exe` (the zip) or beside `chrome.dll` (installed).
An installed copy updates itself from `appcast-windows.xml` (`host/updater.ts`, `ac_updater.cc`; `docs/releasing.md` ›
Windows): it downloads and verifies the newer installer and runs it when Astro quits, or at once from the toast's
Restart.

On Windows, `AC_TARGET_PLATFORM=windows scripts/windows-package.sh` (`AC_CHROMIUM_BUILD` for the Windows tree,
`AC_ENGINE_PROFILE=dev` for the dev engine) rebuilds `chrome` with the interface and writes
`release/astro-browser-<version>-windows-x64.zip`: the files Chromium's `FILES.cfg` lists for the build (plus
`snapshot_blob.bin` when the build has no context snapshot) and `extensions/ublock`. Unzip it anywhere and run `chrome.exe`. The dev engine's zip is 188 MB.

Private windows: their tabs are profile tabs of the original profile's primary off-the-record profile
(`incognito:<session>@<profile>`), hosted by a hidden browser of that profile, which closes when its last tab does and
takes the private session with it.

Profiles: the `Default` Chromium profile is the window's, and each other Astro profile is a Chromium profile
(`Profile <name>`, as on macOS) whose tabs live in a hidden Webium browser of that profile and show in the window as
guests (GuestContents attaches across profiles); its engine calls and events carry its name. Deleting an Astro profile
deletes its Chromium profile through `DeleteProfileHelper` (`ac_profiles.cc`, `astroProfile`), which closes its hidden
browser and removes `Profile <name>` from disk and from Local State; a directory Chromium never registered is removed
directly. Releasing a private profile closes its unused hidden browser and destroys the off-the-record profile when no
browser uses it, as AstroCore does on macOS.

Windows: every Webium window runs its own copy of the interface, and the copies share one store
(`apps/webui/src/host/windows.ts`). One page holds the `astro-window-leader` Web Lock: it hydrates and saves the
session, runs the global effects (history, favicons, bookmarks) and opens and closes windows (`astroNewWindow` is
`chrome::OpenEmptyWindow`). A new page says hello on the `astro-windows` BroadcastChannel and is welcomed with a
snapshot and the window it shows; after that each page sends what changed in the store, entry by entry, and applies
what the others send. When the leader's page closes, the next page in the lock's queue takes over, asks the others
which windows they show and closes the rest in the store, except the windows the old leader had asked the engine for
whose pages haven't been welcomed yet: the leader announces each one it opens, so every page knows them, and a page
still waiting for its welcome says hello again at the roll call (moving the leader's only tab to a new window closes
the leader's window while the new one is opening). Each page holds a Web Lock named after it, and the leader
waits on it: when the page goes away however it goes, its window closes in the store, unless the leader goes too
(quitting keeps the session).

Moving a tab to another window (Move to Window, Merge All Windows, anything that changes a tab's window in the store)
keeps its live page, as AstroCore's `prepareTransfer`/`releaseTransfer` do on macOS (`host/tabTransfer.ts`,
`ac_tab_transfer.cc`). Each tab lives in the tab strip of the window that shows it. `prepareTransfer` in the page it
leaves parks it in the engine at once, keyed by the Astro tab id, and the engine moves it into the destination window's
strip with Chromium's own detach and insert (`DetachTabAtForInsertion`, `InsertDetachedTabAt`, as tab dragging does)
when that window's page is open; the destination's WebView takes it by its key, the engine detaches its guest from the
old page's iframe and the new page attaches it, so the same WebContents carries over (its document keeps running, with
its history and form text) and nothing reloads. A WebView that opens before the other page has let go waits up to 1.5 s for it. A tab
of another profile stays in its profile's hidden browser and only changes page (`MoveProfileTab`). The page a tab
leaves keeps a blank spare in its strip when that tab was its last, so Chromium doesn't close the window, and ignores
the activation Chromium makes of a neighbour for a second; a tab whose window is closing and whose destination has no
page yet goes to another window's strip or the next window the engine opens (the page waits for its parks to finish
before it closes its window, since a closing strip gives up no tabs), and no page adopts a parked tab as its
own. `releaseTransfer`, and the leader page when a tab leaves the store, close a parked tab nobody took. Private and
normal windows don't exchange tabs (the store refuses, as on macOS).

Pages: each tab has a bridge in the engine (`ac_tab_bridge.cc`, the portable counterpart of AstroCore's `TabBridge`).
`astroTabCall` runs find, zoom, mute, back/forward by offset, the history list, hard reload, print, save page, caret
browsing, devtools, JavaScript (in an isolated world) and security info; `astroTabWatch` sends a first snapshot and
`astro-tab-event` the changes: find results, audio, zoom, security, crashes, load errors, full screen and the theme
colour (`<meta name="theme-color">`). Print uses the system dialog, since Chromium's preview needs a modal host that
Webium's guest tabs don't have; devtools dock inside the window (`ac_devtools_dock.cc` gives Webium browsers the `DevtoolsUIController` Chromium docks with, and the page lays the DevTools guest out beside the page). A tab's first navigation away
from a blank or Chromium new tab page replaces that entry, so Back never lands on Chromium's page. The bridge also
reports what AstroCore's `TabBridge` reports on macOS: camera, microphone and screen capture from Chromium's
`MediaStreamCaptureIndicator` (`mediaAccess`: the red badge, the toolbar icon, the share bar), a pointer press in the page
(`pageFocus`, which activates a split pane), a navigation that turned into a download (`downloadNavigation`, which closes
the blank tab a link opened for it) and the requests an extension blocked (`contentBlocked`, from declarativeNetRequest's
rule matches and `ERR_BLOCKED_BY_CLIENT` loads, reset when a load starts). `capturePicture` is a JPEG of the tab from
`CopyFromSurface`, for the tab drag preview and the pin handoff. A hung page shows Astro's overlay: a hook in
`BrowserWebContentsDelegate::RendererUnresponsive` hands it to the bridge (`unresponsive`, `responsive`), and Exit Page
shuts the renderer down or Wait restarts the hang monitor (`resolveUnresponsive`). Chromium ignores a hung renderer while
a DevTools client is attached, and the bridge keeps one on every tab, so a second hook makes only DevTools itself count
(`g_astro_debugger_attached` in `WebContentsImpl::ShouldIgnoreUnresponsiveRenderer`).

The page script (`packages/astrocore/ios/page_script.js`, which the renderer runs in every frame on macOS) is injected by
the bridge's internal DevTools client: `Page.addScriptToEvaluateOnNewDocument` installs it in every document, and it
answers through `Runtime.addBinding` under a random name that the installer catches with a non-enumerable accessor first,
so the page never holds the binding. `Runtime.enable` would carry bindings into new documents by itself, but it made a
page logging 20,000 objects take 690 ms instead of 82; the bridge re-adds the binding on frame events instead and the
page queues its messages until then. `host/pageChannel.ts` is the macOS dispatcher (`AstroCoreWebView`'s
`didReceivePageMessage`) ported: selection (the Search popover), scroll (hiding the toolbar while scrolling), the page's
theme colour (the toolbar tint), Now Playing and its controls (`mediaCommand` to the frame that plays), Picture in
Picture, pinch zoom, dropped links, autoplay blocking from the site setting, and notifications.

Prompts: AstroCore's Chromium hooks are in the Linux and Windows trees too (`engine/astrocore/apply.sh` applies on every
platform), so the layer plugs Astro's own prompts into them, delivered to the window page that shows the tab
(`ac_host.h`: the page whose bridge holds that WebContents). Permission requests (`ac_permission_prompts.cc`, the
portable AstroCore prompt), "save password?" (`ac_password_prompt.cc`), links to other apps
(`ac_external_app_prompts.cc`; on Linux the app's name comes from `xdg-mime` and its `.desktop` file, since Chromium
only knows `xdg-open`), "save this address or card?" (`ac_autofill_prompt.cc`: AstroCore's `AutofillBubbleHandler`
registered on each browser that holds a shown tab, and Webium's `GetAutofillBubbleHandler` returns it) and blocked popups (opened as a tab of the same browser: replaying the blocked navigation made a
window). Chromium skips its external-protocol dialog when the outermost WebContents has no modal host, which in Webium
is the window page, so a second hook asks Astro before that check, with the tab itself.

Extensions (`ac_extension_views.cc`, AstroCore's extension view host ported): a popup or side panel is a `WebView` with
`extensionHost`, which opens Chromium's `ExtensionViewHost` in the tab's browser and attaches its WebContents as a guest
(`x:<id>` on the bridge, so evaluation, size and close work as for tabs). The bridge runs actions
(`executeExtensionAction`), reads each action's icon, badge and title (`actionStates`) and the side panel URL;
`g_astro_open_action_popup` and `g_astro_extension_side_panel` reach the page that shows the active tab. Web Store
installs ask through Astro's prompt (`ac_extension_prompts.cc`); Chromium's installed bubble, which needs a views anchor,
is not shown. An action's keyboard shortcut (`_execute_action`) opened Webium's own popup, which Astro doesn't show: a
hook in `ExtensionActionViewModel::ExecuteUserAction` hands it to the page (`actionShortcut`), which opens the popup in
Astro's panel. Named commands reach `chrome.commands` through Chromium's own registry; a key Astro uses wins over an
extension's, as on macOS (`g_astro_reserved_accelerator` answers from the page's active shortcuts,
`ac_extension_shortcuts.cc`). Evaluation keeps AstroCore's contract: the code is the body of `function(post){…}`, runs in the page's main world and
answers with `post("result", json)`, whenever that comes. The bridge sends it as `Runtime.evaluate` (awaiting the
promise) through an internal DevTools client attached to the tab, since content has no public API that runs main-world
code and waits for a promise.

Content blocker (`host/contentBlocker.ts`, AstroCore's `AstroCoreContentBlocker.mm` ported): uBlock Origin, fetched
and patched by `packages/astrocore/scripts/ubo.sh`, ships as `extensions/ublock` beside the engine
(`--astro-ublock-dir` in development; `pnpm linux` passes it) and loads as a component extension
(`astroContentBlockerLoad`). Its settings are read and written by the same scripts as on macOS, run in a hidden
`blank.html` extension view.

System (`ac_system.cc`): open a file, show it in its folder, whether a file exists, move it to the Recycle Bin or the
Trash (`ac_trash.cc`: `IFileOperation` with a sink that refuses any delete that wouldn't recycle, or GIO's `g_file_trash`,
which follows the freedesktop.org spec), its icon (Chromium's `IconManager`, a 2x PNG data URL as on macOS), open an
external URL, the default browser (Chromium's worker), launch at login (a `~/.config/autostart` entry, or the `Run` key
on Windows) and the interface's own notifications (Chromium's notification service; click and close come back as `notificationResponse`).
Pages' notifications go through Astro as on macOS: the page script replaces `Notification`, Astro posts it, and its
click or close goes back to the page (`notificationAction`).

Screen sharing (`ac_display_media.cc`): Chromium's views picker can't show for a guest tab, so `getDisplayMedia` hung.
A hook in `DesktopMediaPicker::Create` hands the request to Astro's own share picker when a window page shows the tab:
the engine runs Chromium's screen and window lists, the page lists its tabs, and the answer comes back through the tab
bridge (`resolveDisplayMedia`). On Wayland the system dialog does the choosing. Device choosers (WebUSB, WebHID, Web
Serial, Web Bluetooth; `ac_device_chooser.cc`) and the Cast dialog with its routes (`ac_cast.cc`) use AstroCore's
existing hooks, as on macOS. Web Bluetooth is off in Chromium on Linux; `--astro-test-bluetooth-chooser` and
`--astro-test-media-route-provider` test them without hardware. The share bar's Stop Sharing stops the capture
(`stopCapture`, `MediaStreamCaptureIndicator::StopMediaCapturing`) and Share This Tab Instead uses Chromium's tab sharing
infobar delegate (`shareThisTabInstead`), as AstroCore does.

Window: Webium keeps the system frame except on ChromeOS; Astro removes it on Windows and Linux too, since it draws its
own title bar and controls. A window whose browser is already closing ignores activation, as Chrome's `BrowserView` does: Webium's
`PaintAsActiveChanged` lacked that check, so an activation arriving while windows closed on quit hit a CHECK. The page's `app-region: drag` areas move the window and its outer 5 px resize it; both keep
the press instead of passing it to the page. The link under the pointer reaches the page as the tab's `status` event
(a hook in `UpdateTargetURL`). A close the system asks for (Alt+F4, the taskbar, Ctrl+Shift+W) goes to the window's page
as `closeRequest` (`g_astro_window_close_requested` in `OnWindowCloseRequested`), so "Close N tabs?" asks as the close
button does; the page closes its own window with `astroCloseWindow`, which the hook lets through until that browser has
closed. Whether the app is active comes from Webium's `OnPaintAsActiveChanged`: when no Astro window is active for a
second, every page emits `resignActive` (`host/appActive.ts`).

Tab drag preview (`host/dragPreview.ts`, `ac_drag_preview.cc`): the macOS `DragPreview` ported. The engine shows a
frameless, inactive popup widget that ignores the pointer and draws the image the page sends; the page composes the pill
(the dragged row) and the card (the window and the tab's picture, or a placeholder) on a canvas from `astroCapturePage`,
moves the widget with the pointer, inside the window or outside it, and grows it into the window a drop opens. Page
iframes stop taking the pointer during a drag (`astro-ui-drag`, `astro-tab-drag`), so a drag over the page keeps moving.

Menu: Linux and Windows have no menu bar, so a button beside the window controls opens the macOS menu bar's commands
(`AppMenu.tsx`, from the same `menuState`), with Ctrl shortcuts; Exit is `astroQuit` (`chrome::AttemptUserExit`).
Quitting with a download running asks first, with the macOS wording (`host/quit.ts`); Webium's
`ConfirmBrowserCloseWithPendingDownloads` never answered, so quitting, or closing the last window, hung while a download
ran. It now goes ahead, as AstroCore does. Closing the last window quits on these platforms, so with a download running it
asks the same question and quits through the quit path; cancelling a last-tab close reopens the window. Share is the
Windows share sheet; Linux has none, so it offers Email Link and Copy Link, also as the menus' Share submenu
(`host/share.ts`).

Menus and dialogs are Bloom's (`@oxy.so/bloom`), where macOS uses NSMenu and NSAlert: `showMenu(items)` opens a
`ContextMenu` anchored at the pointer (`anchor`, no trigger; flyout submenus sized to their rows, shortcuts, checks,
`alignRows` lining up icon and check rows, arrow keys, Esc, focus back where it was), and `confirm`/`prompt` are Bloom's
surfaces (`apps/demo/src/shims/web/overlays.tsx`, `BloomLayer.tsx`); a confirmation with `suppression` is
`confirmWithSuppression`, whose "Don't ask again" checkbox comes back as `suppressed`. Webium suppresses `window.confirm` and
`window.prompt` in its own page (they return at once), so they can't be used. Bloom loads lazily, when the page goes
idle or at the first menu or dialog. The window's close button sends `closeRequest`, so closing a window with several
tabs asks first, as on macOS.

Shortcuts: the web shim (`apps/demo/src/shims/web/motion/shortcuts.ts`) holds the macOS menu bar's table, the same
titles, menus, keys and hidden aliases, so Settings › Keyboard Shortcuts lists, records and remaps them as on macOS (⌘ is
Ctrl, ⌃ is Super/Win, ⌥ is Alt; Ctrl+Tab and Ctrl+PageUp/PageDown also work with Ctrl). Webium runs the browser's
accelerators before any page sees the key, so the page sends the engine its table (`astroShortcuts`: the active
combos, and every combo Astro owns by default): `ac_window_keys.cc`, through a hook in
`WebUIBrowserWindow::PreHandleKeyboardEvent`, takes an active combo from any tab and hands it to that window's page
(`astro-window-key`), gives a Chromium accelerator on a combo Astro owns back to the page, and leaves Chromium's others
(F5, Ctrl+F4, F11…) alone. While recording a shortcut or holding the tab switcher, every key goes to the page
(`astroKeyCapture`).

Import (`ac_import.cc`, `host/import.ts`, the macOS importer ported): Chrome (and its channels), Chromium, Edge, Brave,
Vivaldi, Opera, Opera GX, Helium and Firefox. Bookmarks, history, open tabs and passwords from the Chromium family
(passwords: v10/v11 on Linux, the v11 key read with `secret-tool`; DPAPI and AES-GCM on Windows; app-bound v20 can't
be decrypted and is reported as such); bookmarks and history from Firefox; extensions; bookmark HTML and password CSV
files; cookies, addresses and cards from the Chromium family and Firefox, Firefox passwords, and Arc's spaces, pinned tabs and favorites on Windows.

Sync (`host/sync.ts`, `ac_sync_files.cc`): the same encrypted folder format as macOS, byte for byte, so one folder in
Dropbox, OneDrive or Syncthing serves a Mac and a PC. The crypto runs in the page (WebCrypto); the engine only reads and
writes the folder and keeps the recovery key encrypted with the profile's OS key (`Astro Sync Key/`). The default folder
is `%OneDrive%\Astro Sync` (or `Documents\Astro Sync`) on Windows and `~/Astro Sync` on Linux. The recovery kit is a
text file. Passwords sync as on macOS: `readPasswords` is `ac_passwords_sync_read` (`ac_passwords_sync.cc`), which reads
every saved login from the profile's and the account's password stores and hands them, in plaintext, only to the
internal page, in the macOS reader's shape (`origin` is the signon realm, `created` in Unix milliseconds); a store that
can't be read or decrypted answers null, so nothing is synced as deleted. Windows is the exception: Chromium's
`SkipUndecryptablePasswords` is on there, so a login that stops decrypting (DPAPI's key lost) is left out silently.
Incoming logins are written with `ac_passwords_add` and `ac_passwords_remove`, as on macOS.

The `astro` command and userscripts (`docs/cli.md` › Linux and Windows): Settings › Advanced › "Let the astro
command control Astro" starts the same token-guarded DevTools server (`ac_cli_control.cc`, now on every platform) and
writes `AstroControl.json` in the user data dir. The packages carry the CLI in `cli/` (Python, `astro_cli`, esbuild);
installing links it into `~/.local/bin` or writes `astro.cmd` into `%LOCALAPPDATA%\Oxy\Astro\bin` on the user's
Path (`ac_cli_install.cc`). Userscripts load from `<user data>/Scripts/extension` through `ac_user_scripts.cc` and the
unchanged `userScripts.ts`, with `ac_scripts_policy.cc` guarding the extension on Windows too.

Files: `astroPickFiles` opens the platform's file dialog, for a folder (an unpacked extension, which
`ac_extensions_inspect` reads with Chromium's own loader before the install prompt) or for files to open.

Passwords: revealing, copying and exporting them asks the OS first. On Windows that is Windows Hello, through
Chromium's own device authenticator (`ac_reauth.cc`, as on macOS). Chromium has none for Linux, so there Astro asks
polkit (`ac_polkit_authenticator.cc`): `CheckAuthorization` for this process and the action `so.oxy.astro.unlock`
(`auth_self`, from `engine/linux/so.oxy.astro.policy`), whose dialog the desktop's polkit agent shows. Without the
policy file, polkit or an agent it is denied, with the reason logged and sent as `reauth.unavailable`; it never asks
for the login password itself.
Export asks where to save (`astroPickFiles` in save mode) and writes Chromium's CSV.

Translation (`host/translate.ts`, `ac_translate.cc`): the same button, menu and toasts as macOS, on Mozilla's
Bergamot translator instead of Apple's Translation framework, so pages are translated on the device and nothing goes to
Google. `AstroTranslate`'s calls are the macOS module's. The page's language comes from Chromium's CLD3, run by the
engine on the page sample (`detect`), else the page's `lang`. The engine fetches the list of language models from
Mozilla's Remote Settings (`translations-models-v2`, cached a day in the profile's `Astro Translations/`) and, the
first time a pair is used, the Bergamot WebAssembly build and that pair's files: each is checked against its record's
SHA-256, unpacked from zstd, checked again and saved under its hash, which `chrome://webui-browser/astro-translations/`
serves to the page. Bergamot runs in a Worker per language pair (two at most, closed after five idle minutes) with the
loader Firefox ships (`public/bergamot/`); a pair without a model goes through English. The WebAssembly is pinned by
hash, since it must match that loader. A paragraph is one HTML text whose pieces are `<span>`s, so each text node gets
its own part back, as Apple's attributed strings do on macOS. The interface's CSP allows `'wasm-unsafe-eval'` and
same-origin workers for this.

## Native surface (audit, 2026-10-24)

What `apps/browser/src` calls in the native modules, and what it gets on Windows and Linux. A static pass listed every
member of every `requireNativeModule` type, every package export that calls one and every view, and checked which ones
`apps/webui` provides (`provideNativeModule`, its shim exports) and which fall back to `apps/demo`; a missing member is an
inert function that returns `null`. Each gap was then tried in a hidden instance. Ranked by what a user notices:

| | Gap | Native call | Now |
|---|---|---|---|
| 1 | Exit, or closing the last window, hung while a download ran; no warning | Webium's `ConfirmBrowserCloseWithPendingDownloads`; `downloadsInProgress` | Fixed: asks first; Quit exits within 250 ms |
| 2 | The page script didn't run: no selection Search, no toolbar hiding on scroll, no toolbar tint, no Now Playing or media controls, no PiP state, no autoplay blocking | `onPageMessage`, `onNowPlaying`, `onPictureInPicture`, `onNotification`, `mediaCommand`, `requestPictureInPicture`, `notificationAction` | Ported |
| 3 | Pinned tiles and many favicons stayed a globe | `downloadFavicon`, `downloadImage`, `iconTheme` | Fixed, with the tile theme (macOS algorithm) |
| 4 | Camera, microphone and screen indicators never showed; the share bar never appeared | `onMediaAccess` | Fixed |
| 5 | Stop Sharing and Share This Tab Instead did nothing | `stopCapture`, `changeCaptureSource` | Fixed |
| 6 | Alt+F4, the taskbar and Ctrl+Shift+W closed a window without "Close N tabs?" | `windowShouldClose` (macOS) | Fixed |
| 7 | Dragging a tab showed nothing over the page or outside the window, and stopped at the page | `dragPreviewBegin`…`End`, `windowFrame` | Fixed |
| 8 | Share did nothing | `share`, `shareVia` | Windows share sheet; Email Link, Copy Link on Linux |
| 9 | An extension's action shortcut showed nothing | `onActionShortcut` | Fixed |
| 10 | Site Controls never said how many requests were blocked | `onContentBlocked` | Fixed |
| 11 | Clicking into a split pane didn't make it the active one | `onPageFocus` | Fixed |
| 12 | A link that downloads left a blank tab | `onDownloadNavigation` | Fixed |
| 13 | Esc didn't cancel a sidebar drag | `setDragEscapeCapture` | Fixed |
| 14 | Popovers and the switcher didn't react to switching apps | `resignActive` | Fixed |
| 15 | The tab switcher took the row under a pointer that hadn't moved | `switcherPointerMoved` | Fixed |
| 16 | A hung page showed nothing: Chromium's dialog needs a views host, and the bridge's DevTools client hid the hang | `onUnresponsive`, `onResponsive`, `resolveUnresponsive` | Fixed |
| 17 | Chromium never offered to save or update an address or a card: Webium has no `AutofillBubbleHandler` | `onAutofillPrompt`, `resolveAutofillPrompt` | Fixed |
| 18 | Chromium's autofill dropdown opened a tab's offset away from its field: the field's bounds were added to the tab's own container bounds, which already sit inside the interface page | Chromium's `ChromeAutofillClient` | Fixed: the outermost page's bounds are used |
| 19 | Autofill's command and its shortcut opened Settings instead of the focused field's suggestions | `showAutofillSuggestions` | Fixed: `ac_autofill_trigger.cc` (AstroCore's `ac_autofill_trigger.mm` ported) remembers each tab's last focused field and asks its frame's autofill driver for suggestions; Settings opens only when no field of the tab has focus |
| 20 | With tabs on top, the "⋯" app menu button sat over the first tab | `APP_MENU_BUTTON_ROOM` (shell) | Fixed: the strip starts after the button, the gap macOS leaves after the zoom light |
| 21 | The native window title (X11's `_NET_WM_NAME`) showed the Webium browser's active tab, which a tab switch doesn't change, so it went stale | Webium's `GetWindowTitle` | Fixed: the window takes its page's title (`setWindowTitle`, macOS's "Profile — Tab & N Tabs"), from the window's first frame, and updates when it changes |
| 22 | Dragging a tab onto another window showed nothing there and dropped the tab at the end: the drop point was worked out by the dragging window's page, while the target's state lives in another page | `useTabDrag` (`overWindow`, `overPoint`, `insert`; one JS context on macOS) | Fixed: the dragging page sends the pointer's screen point to the target page (`tabDragShare.ts`, a `BroadcastChannel`), which shows the drop highlight and, with tabs on top, the insert gap, and answers with the insert point; the dragged picture turns into the pill and the tab lands at the gap, live. With tabs in the sidebar the target glows and the tab goes to the end, as on macOS |
| 23 | The share picker's windows had no app icons | `runningAppIcon` | Fixed: each window source carries its icon from Chromium's `GetWindowIcon` (`_NET_WM_ICON` on X11, `WM_GETICON` on Windows), as Chrome's own picker does |
| 24 | The page never learnt the power source, battery level or battery saver | `systemState`, `onSystemState` | Provided (`ac_system_state.cc`), but nothing consumes it yet (below): Windows takes the power source and level from Chromium's `PowerMonitor` and `BatteryLevelProvider` and Windows' battery saver from `GetSystemPowerStatus`; Linux reads UPower's display device, since Helium's `disable-battery-status-service` stubs out Chromium's own reader. Memory pressure stays "normal" (below) |
| 25 | Onboarding never started (nothing called `maybeStartOnboarding`, and Help › Show Onboarding did nothing), and its music never played | `playIntroMusic`, `setIntroMusicMuted`, `stopIntroMusic` | Fixed: the leader page starts it on Chromium's first run (`--no-first-run` test instances skip it) or to finish one already begun, and every page handles Show Onboarding; the macOS synthesis runs in a worker and plays through Web Audio with a hall reverb; skipping before it starts cancels it |
| 26 | Connect Calendar did nothing: no calendar was read | `AstroCalendar` (`authorizationStatus`, `requestAccess`, `calendars`, `events`) | Fixed. Linux reads Evolution Data Server over D-Bus (`ac_calendar_linux.cc`: the newest `Sources`/`Calendar` services on the session bus, the registry's sources, `OpenCalendar` and `GetObjectList` with an `occur-in-time-range?` query, `GetTimezone` for zones Intl doesn't know), the store GNOME Calendar, Evolution and Online Accounts (Google, Microsoft 365, CalDAV) sync into; `live/ics.ts` expands repeats (RRULE, RDATE, EXDATE, moved occurrences) and resolves zones (IANA, libical's prefixed names, VTIMEZONE rules for Exchange's). Windows reads WinRT's appointment store read-only (`ac_calendar_win.cc`, `AllCalendarsReadOnly`), which expands repeats itself. As macOS remembers its grant, Astro remembers a successful connect (`calendar-access.json`); no EDS shows "No calendar service found", Windows' privacy switch shows "Allow it in Settings" with a button to that page. Changes arrive with the 5-minute refresh, not as events. Nilo's mappers (`niloCalendar.ts`) stay for an Oxy-account source: Astro has no Oxy sign-in yet and Nilo no public origin |
| 27 | Record Performance Issue wasn't in the app menu, and recording did nothing | `beginTracing`, `endTracing`, `isTracing` | Fixed: Help › Record Performance Issue…, the macOS flow (`lib/performanceRecording.ts`); Chromium's `TracingController` with AstroCore's start watchdog (`ac_diagnostics.cc`), the trace saved as `Astro Trace <date>.json` in Downloads (or deleted on Discard) and shown in the file manager |
| 28 | Native crashes weren't read | `crashReports` | Crashpad already wrote minidumps locally, uploads off (Helium's consent stays off and Astro's upload URL is empty): `<user data dir>\Crashpad\reports` on Windows, `$XDG_CONFIG_HOME/astro-browser/Crash Reports` on Linux. `crashReports(since)` now reads the browser process's dumps (`ptype=browser`), as macOS reads its `DiagnosticReports`: the five newest, each with its exception (`SIGSEGV`, `EXCEPTION_ACCESS_VIOLATION`…) and up to 64 frames as module + offset, walked by frame pointers on Linux and by a stack scan on Windows that keeps a word only if the instruction before it, in the loaded module, is a call. Nothing is sent: telemetry, which posts macOS's crashes when the user opts in, doesn't start on Windows and Linux (below) |
| — | The menu bar's bookmarks | `setMenuBookmarks` | Nothing to do: the app menu reads the store |

Still missing, by what a user would notice:

- Telemetry (`installErrorReporting`, `startTelemetry`) doesn't start in `apps/webui`, so crash reports, errors and usage
  stay local. Starting it would send Windows and Linux crashes to the destination macOS uses (`astro.oxy.so/otel`, after
  the user opts in); that is the owner's call. Other diagnostics in Help (Send Feedback, Copy Diagnostics) wait on the
  same decision.
- Windows' appointment store holds the accounts Windows itself syncs (Settings › Accounts, the old Mail and Calendar
  app); the new Outlook doesn't sync into it, so many Windows users will see no calendars. A Google or Microsoft account
  connection, or Nilo through an Oxy sign-in, would be the next source.
- Tab sleeping, freezing and Battery Saver (`startTabLifecycle`) never start: `apps/webui` doesn't call it, so the
  system state above reaches every page and goes unused. Each page holds only its own window's tabs, so the port needs
  the sweeps per page and the store-wide parts (waking recent tabs at launch, the Battery Saver toast) in one page.
- Memory pressure for tab sleeping (`systemState`'s `memoryPressure`): Chromium's listener needs a
  `MemoryPressureListenerTag` of its own, an enum in a base header nearly every target includes, so adding one rebuilds
  almost everything. No platform reports a thermal state to tab sleeping, macOS included.
- Not needed on the web: `revealTab`, `dropTabReveals` and `revealOffered` show the next tab's page ahead of React on
  macOS, where every tab's iframe is already attached here and switching is an opacity change; `raiseView` orders native
  views, where the dragged tab's `zIndex` does it; `cancelFocusMove` and `claimFocus` hold keys typed while AppKit moves
  focus, which a page's focus does synchronously; `WindowProfile` switches an AppKit window's Chromium browser to the
  profile it shows, where each profile's tabs already live in that profile's hidden browser here.

macOS only, left as no-ops: the Dock (`isInDock`, `addToDock`; onboarding hides it), Handoff (`setWindowActivity`),
AppleScript (`setScriptState`, `replyToScript`, `onScriptCommand`), trackpad haptics (`hapticTick`, `swipeHaptic`),
alternate app icons (`setAppIcon`; `appIcons` is empty, so Settings hides the picker), Liquid Glass, Metal video
upscaling (`setVideoUpscaling`, `videoUpscalingState`), the Safari and Dia importers with their Full Disk Access and
Automation prompts, `reopen` (a Dock click), and the `dev*` test hooks.

## Minimum steps to browse on Linux

1. **Linux engine build.** Chromium 155 with Helium's Linux series, `target_os=linux`, x64, target `chrome`. Drop the
   five mac patches and the mac hunks of the mixed three; re-place the layer dependency. Skip `engine/astrocore`.
2. **Check stock Webium** with `--enable-features=Webium`: tabs and navigation must work before any code is written.
3. **Compile `engine/chromium` on Linux.** Lift `assert(is_mac)`, exclude the `.mm` files and `ac_reauth.cc`.
4. **`chrome://astro`**, forked from Webium's controller, with an `astro.mojom`:
   - tabs: `CreateTab(profile, url)` returning a guest id; `Navigate`, `Back`, `Forward`, `Reload`, `Stop`;
   - tab events: navigation, progress, favicon, `OpenWindow` (from `AddNewContents`), closed;
   - an allowlisted `EngineCall(name, profile, json)` for history, bookmarks, favicons and search engines, never
     `passwords_reveal` or `card_number`; narrow per-domain interfaces follow before shipping;
   - documents preloaded into `loadTimeData`, so the store's synchronous reads keep working, with async writes.
5. **Web build.** Add react-native-web and react-dom, point Metro's web platform at them, `expo export -p web`, and
   serve the bundle as WebUI resources.
6. **`.web.ts(x)` wrappers** beside the native ones (as `bangPlatform.web.ts` already does):
   - `WebView.web.tsx`: an iframe with a guest attached;
   - shell: documents and windows over Mojo; menus, confirm and prompt in the DOM; `Symbol` mapped to SVG icons
     (63 literal names); CSS stand-ins for `Surface`, `FadeLabel`, `VisualEffect` and drag regions;
   - null modules for shaders, sync, import and translate.
7. **One window first.** Sharing state across windows comes after.
8. **Windows** is the same build with `target_os=win` and Helium's Windows series.

The essential native surface is about 45 calls, events and views out of roughly 322 functions; the rest can be
no-ops at first.
