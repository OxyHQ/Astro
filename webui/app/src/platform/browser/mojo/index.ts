// The typed Mojo transports, as an Astro page actually binds them.
//
// Astro's own browser controls -- theme, identity, sync, ad blocking, updates,
// the whole new tab data plane -- are narrow per-domain interfaces
// (`astro_theme.mojom`, `astro_settings.mojom`, ...), never one god interface
// and never a generic `SetPref(string, value)`. Each page binds only the ones
// its controller registered a binder for, so a page cannot reach a control it
// was not given.
//
// Nothing here is vendored and nothing is fetched from a URL at runtime. The
// bindings are generated from the committed `.mojom` files into a Chromium
// build's gen/ directory and compiled into this chunk by the `astro-mojom`
// plugin in vite.config.ts, which is also where the reasoning about Mojo's own
// runtime staying a `chrome://resources` URL is written down.

import {
  PageHandlerFactory,
  PageHandlerRemote,
} from 'astro-mojom/chrome/browser/oxy/webui/astro_settings.mojom-webui.js';
import {
  ThemeMode as MojoThemeMode,
  ThemeObserverCallbackRouter,
  ThemeProvider,
  type Theme as MojoTheme,
} from 'astro-mojom/chrome/browser/oxy/webui/astro_theme.mojom-webui.js';

import type {RawTheme, ThemeMode, ThemeSource} from '../theme-store.ts';

function toMode(mode: MojoThemeMode): ThemeMode {
  switch (mode) {
    case MojoThemeMode.kLight:
      return 'light';
    case MojoThemeMode.kDark:
      return 'dark';
    case MojoThemeMode.kSystem:
      return 'system';
  }
}

function toMojoMode(mode: ThemeMode): MojoThemeMode {
  switch (mode) {
    case 'light':
      return MojoThemeMode.kLight;
    case 'dark':
      return MojoThemeMode.kDark;
    case 'system':
      return MojoThemeMode.kSystem;
  }
}

function toRawTheme(theme: MojoTheme): RawTheme {
  return {mode: toMode(theme.mode), preset: theme.preset};
}

/**
 * The settings PageHandler, bound on FIRST WRITE rather than at startup.
 *
 * Reading the theme is granted to every Astro page; writing it is granted only
 * to the surface that owns the control, and `astro.settings.mojom` is bound by
 * AstroSettingsUI alone. Binding it eagerly would have the new tab page and
 * every side panel ask their broker for an interface their controller does not
 * register -- which the browser answers by logging the failure and closing the
 * pipe, once per page load, for a handler they were never going to call.
 */
let settingsHandler: PageHandlerRemote | undefined;

function settings(): PageHandlerRemote {
  if (!settingsHandler) {
    settingsHandler = new PageHandlerRemote();
    PageHandlerFactory.getRemote().createPageHandler(
      settingsHandler.$.bindNewPipeAndPassReceiver(),
    );
  }
  return settingsHandler;
}

/**
 * The theme, over the two interfaces that carry it.
 *
 * The read/write split is the interfaces', not this file's: `GetTheme` and the
 * observer come from `astro.mojom.ThemeProvider`, which every Astro page
 * controller holds, and the two setters from
 * `astro.settings.mojom.PageHandler`, which only the settings page has.
 * Putting both halves behind one {@link ThemeSource} is what lets a page that
 * can only read use the identical store -- it simply never calls a setter.
 */
export function createThemeSource(): ThemeSource {
  const provider = ThemeProvider.getRemote();
  const observer = new ThemeObserverCallbackRouter();
  provider.addObserver(observer.$.bindNewPipeAndPassRemote());

  return {
    getTheme: () => provider.getTheme().then(({theme}) => toRawTheme(theme)),

    // Fire-and-forget on the wire, so this resolves before the browser has
    // done anything. Nothing waits on it: the store renders from the echo,
    // which is also what makes a change an enterprise policy refuses show up
    // as the control returning to the value the policy holds.
    setMode: mode => {
      settings().setThemeMode(toMojoMode(mode));
      return Promise.resolve();
    },

    setPreset: async preset => {
      const {accepted} = await settings().setColorPreset(preset);
      if (!accepted) {
        // The browser stored nothing, so no echo is coming and the control
        // returns to the colour that is actually set. Rejecting is what names
        // the refused preset; the interface deliberately does not fall back to
        // a default, which would look to the page like a colour it never asked
        // for.
        throw new Error(
          `The browser refused the colour preset '${preset}': it is not one this ` +
            'build ships. This page was bundled from a different Bloom release ' +
            'than the browser serving it.',
        );
      }
    },

    onThemeChanged: listener => {
      const id = observer.onThemeChanged.addListener((theme: MojoTheme) => {
        listener(toRawTheme(theme));
      });
      return () => {
        observer.removeListener(id);
      };
    },
  };
}
