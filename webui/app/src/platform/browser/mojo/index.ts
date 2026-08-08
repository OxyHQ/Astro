// Where the typed Mojo bindings arrive.
//
// Astro's own browser controls -- theme, identity, sync, ad blocking, updates,
// the whole new tab data plane -- are narrow per-domain interfaces
// (`astro_theme.mojom`, `astro_settings.mojom`, ...), never one god interface
// and never a generic `SetPref(string, value)`. Each page binds only the ones
// its controller registered a binder for, so a page cannot reach a control it
// was not given.
//
// Acquisition, once the Vite build is a declared GN action: the action is
// handed the mojom bindings generation directory, `vite.config.ts` aliases a
// virtual prefix (`astro-mojom/*`) onto it, and the generated `-webui.js`
// bindings compile INTO the importing page's chunk alongside Mojo core. No
// bindings are vendored into this repository, and nothing is fetched from a
// URL at runtime -- both of which would leave a page's bindings and its C++
// interface free to drift across a Chromium roll.
//
// This directory is empty until that action exists. The interfaces it will
// carry are already described where they are consumed: `ThemeSource` in
// ../theme-store.ts is the shape `astro_theme.mojom` has to satisfy.

export {};
