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

Run it from the repository with `pnpm linux` (it builds `apps/webui` and starts the `dev` engine on it through
`scripts/linux-run.sh`). For a standalone build: `pnpm -C apps/webui build`, copy `apps/webui/dist` to `astro-ui/` beside the engine's `chrome`, and start
`chrome`: on Linux and Windows the engine turns on `Webium` and `AttachUnownedInnerWebContents` by default
(`chromium-astro-webium-default.patch`) and serves `astro-ui/`. While developing, `pnpm -C apps/webui dev` rebuilds on
change and `--astro-ui-dir=$PWD/apps/webui/dist` serves the build in place. Without `AttachUnownedInnerWebContents`,
removing a tab's iframe hits a CHECK. Restart the browser to pick up a new build; reloading `chrome://webui-browser`
itself crashes Webium (it reopens the page as a tab, outside its window). Chromium calls
`AttachUnownedInnerWebContents` a prototype not meant for production, and GuestContents says the same: both are the
risk this design takes on.

Package it: `scripts/linux-package.sh` (`AC_ENGINE_PROFILE=dev` for the dev engine) builds `apps/webui` and writes
`~/chromium-build/release/astro-browser-<version>-x86_64.tar.xz`: the engine stripped, `astro-ui/`, the `astro-browser`
launcher, `astro-browser.desktop`, its icon and an AppArmor profile (`engine/linux/`). Install it with `sudo tar -xJf
astro-browser-*.tar.xz -C /opt && sudo mv /opt/astro-browser-*-x86_64 /opt/astro-browser`, link
`/opt/astro-browser/astro-browser` into your PATH, and copy the desktop file and icon to `~/.local/share/applications/`
and `~/.local/share/icons/hicolor/256x256/apps/`. Revealing saved passwords needs the polkit action: `sudo cp
/opt/astro-browser/so.oxy.astro.policy /usr/share/polkit-1/actions/`. On Ubuntu 24.04 and later the sandbox needs the
AppArmor profile: `sudo cp /opt/astro-browser/apparmor.cfg /etc/apparmor.d/astro-browser && sudo apparmor_parser -r
/etc/apparmor.d/astro-browser`. The dev engine's package is 116 MB.

The Windows installer is Chromium's `mini_installer`: `AC_TARGET_PLATFORM=windows scripts/windows-installer.sh` (with
the Windows build's environment from `docs/engine-build.md`) builds `chrome` and `mini_installer` with `astro-ui/` and
uBlock Origin staged beside `chrome.dll`, and writes `release/Astro-<version>-windows-x64-setup.exe`. It
installs per user into `%LOCALAPPDATA%\Oxy\Astro\Application`, keeps the profile in `%LOCALAPPDATA%\Oxy\Astro\User
Data`, creates the shortcuts and registers Astro with Windows, so it can be the default browser. Helium's Windows
patches find 7-Zip through the registry; `engine/astrocore/apply.sh` points a Linux host at Chromium's own `7za`. The
engine looks for `astro-ui/` and `extensions/ublock` beside `chrome.exe` (the zip) or beside `chrome.dll` (installed).
An installed copy updates itself from `appcast-windows.xml` (`host/updater.ts`, `ac_updater.cc`; `docs/releasing.md` ›
Windows): it downloads and verifies the newer installer and runs it when Astro quits, or at once from the toast's
Restart.

On Windows, `AC_TARGET_PLATFORM=windows scripts/windows-package.sh` (`AC_CHROMIUM_BUILD` for the Windows tree,
`AC_ENGINE_PROFILE=dev` for the dev engine) writes `release/astro-browser-<version>-windows-x64.zip`: the files
Chromium's `FILES.cfg` lists for the build (plus `snapshot_blob.bin` when the build has no context snapshot),
`astro-ui/` and `extensions/ublock`. Unzip it anywhere and run `chrome.exe`. The dev engine's zip is 188 MB.

Private windows: their tabs are profile tabs of the original profile's primary off-the-record profile
(`incognito:<session>@<profile>`), hosted by a hidden browser of that profile, which closes when its last tab does and
takes the private session with it.

Profiles: the `Default` Chromium profile is the window's, and each other Astro profile is a Chromium profile
(`Profile <name>`, as on macOS) whose tabs live in a hidden Webium browser of that profile and show in the window as
guests (GuestContents attaches across profiles); its engine calls and events carry its name.

Windows: every Webium window runs its own copy of the interface, and the copies share one store
(`apps/webui/src/host/windows.ts`). One page holds the `astro-window-leader` Web Lock: it hydrates and saves the
session, runs the global effects (history, favicons, bookmarks) and opens and closes windows (`astroNewWindow` is
`chrome::NewEmptyWindow`). A new page says hello on the `astro-windows` BroadcastChannel and is welcomed with a
snapshot and the window it shows; after that each page sends what changed in the store, entry by entry, and applies
what the others send. When the leader's page closes, the next page in the lock's queue takes over, asks the others
which windows they show and closes the rest in the store. Each page holds a Web Lock named after it, and the leader
waits on it: when the page goes away however it goes, its window closes in the store, unless the leader goes too
(quitting keeps the session). Tabs live in the tab strip of the page that shows them, so a
tab moved to another window reloads there.

Pages: each tab has a bridge in the engine (`ac_tab_bridge.cc`, the portable counterpart of AstroCore's `TabBridge`).
`astroTabCall` runs find, zoom, mute, back/forward by offset, the history list, hard reload, print, save page, caret
browsing, devtools, JavaScript (in an isolated world) and security info; `astroTabWatch` sends a first snapshot and
`astro-tab-event` the changes: find results, audio, zoom, security, crashes, load errors, full screen and the theme
colour (`<meta name="theme-color">`). Print uses the system dialog, since Chromium's preview needs a modal host that
Webium's guest tabs don't have; devtools dock inside the window (`ac_devtools_dock.cc` gives Webium browsers the `DevtoolsUIController` Chromium docks with, and the page lays the DevTools guest out beside the page). A tab's first navigation away
from a blank or Chromium new tab page replaces that entry, so Back never lands on Chromium's page.

Prompts: AstroCore's Chromium hooks are in the Linux and Windows trees too (`engine/astrocore/apply.sh` applies on every
platform), so the layer plugs Astro's own prompts into them, delivered to the window page that shows the tab
(`ac_host.h`: the page whose bridge holds that WebContents). Permission requests (`ac_permission_prompts.cc`, the
portable AstroCore prompt), "save password?" (`ac_password_prompt.cc`), links to other apps
(`ac_external_app_prompts.cc`; on Linux the app's name comes from `xdg-mime` and its `.desktop` file, since Chromium
only knows `xdg-open`) and blocked popups (opened as a tab of the same browser: replaying the blocked navigation made a
window). Chromium skips its external-protocol dialog when the outermost WebContents has no modal host, which in Webium
is the window page, so a second hook asks Astro before that check, with the tab itself.

Extensions (`ac_extension_views.cc`, AstroCore's extension view host ported): a popup or side panel is a `WebView` with
`extensionHost`, which opens Chromium's `ExtensionViewHost` in the tab's browser and attaches its WebContents as a guest
(`x:<id>` on the bridge, so evaluation, size and close work as for tabs). The bridge runs actions
(`executeExtensionAction`), reads each action's icon, badge and title (`actionStates`) and the side panel URL;
`g_astro_open_action_popup` and `g_astro_extension_side_panel` reach the page that shows the active tab. Web Store
installs ask through Astro's prompt (`ac_extension_prompts.cc`); Chromium's installed bubble, which needs a views anchor,
is not shown. Evaluation keeps AstroCore's contract: the code is the body of `function(post){…}`, runs in the page's main world and
answers with `post("result", json)`, whenever that comes. The bridge sends it as `Runtime.evaluate` (awaiting the
promise) through an internal DevTools client attached to the tab, since content has no public API that runs main-world
code and waits for a promise.

Content blocker (`host/contentBlocker.ts`, AstroCore's `AstroCoreContentBlocker.mm` ported): uBlock Origin, fetched
and patched by `packages/astrocore/scripts/ubo.sh`, ships as `extensions/ublock` beside the engine
(`--astro-ublock-dir` in development; `pnpm linux` passes it) and loads as a component extension
(`astroContentBlockerLoad`). Its settings are read and written by the same scripts as on macOS, run in a hidden
`blank.html` extension view.

System (`ac_system.cc`): open a file, show it in its folder, whether a file exists, open an external URL, the default
browser (Chromium's worker), launch at login (a `~/.config/autostart` entry, or the `Run` key on Windows) and the
interface's own notifications (Chromium's notification service; click and close come back as `notificationResponse`).
Pages' notifications already go to the system through Chromium's platform bridge.

Screen sharing (`ac_display_media.cc`): Chromium's views picker can't show for a guest tab, so `getDisplayMedia` hung.
A hook in `DesktopMediaPicker::Create` hands the request to Astro's own share picker when a window page shows the tab:
the engine runs Chromium's screen and window lists, the page lists its tabs, and the answer comes back through the tab
bridge (`resolveDisplayMedia`). On Wayland the system dialog does the choosing. Device choosers (WebUSB, WebHID, Web
Serial, Web Bluetooth; `ac_device_chooser.cc`) and the Cast dialog with its routes (`ac_cast.cc`) use AstroCore's
existing hooks, as on macOS. Web Bluetooth is off in Chromium on Linux; `--astro-test-bluetooth-chooser` and
`--astro-test-media-route-provider` test them without hardware.

Window: Webium keeps the system frame except on ChromeOS; Astro removes it on Windows and Linux too, since it draws its
own title bar and controls. The page's `app-region: drag` areas move the window and its outer 5 px resize it; both keep
the press instead of passing it to the page. The link under the pointer reaches the page as the tab's `status` event
(a hook in `UpdateTargetURL`).

Menu: Linux and Windows have no menu bar, so a button beside the window controls opens the macOS menu bar's commands
(`AppMenu.tsx`, from the same `menuState`), with Ctrl shortcuts; Exit is `astroQuit` (`chrome::AttemptUserExit`).

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
files. Cookies, autofill, Firefox passwords and Arc are not ported.

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

Still missing: a packaged build (the interface in a pak instead of `astro-ui/`) and a way to reauthenticate on Linux.

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
