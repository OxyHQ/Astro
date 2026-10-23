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
- `src/shims/shell.tsx`: documents persist in `localStorage` for now (they belong in profile preferences), and
  `WindowDragRegion` sets `app-region: drag`. `src/WindowControls.tsx` makes the traffic lights close, minimise and
  maximise the window.

Run it: `pnpm -C apps/webui build` (or `dev`, which rebuilds on change), then
`out/Release_GN_x64_dev/chrome --enable-features=Webium --astro-ui-dir=$PWD/apps/webui/dist`.

Still missing: `ac_*` calls (step 4's Mojo interface; history, bookmarks, passwords and the rest answer nothing),
search suggestions (the WebUI's CSP rightly blocks the page's own fetches), favicons for history, a theme colour per
page, and one JS context per window.

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
