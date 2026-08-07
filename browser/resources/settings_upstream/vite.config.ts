import {defineConfig} from 'vite';
import tailwindcss from '@tailwindcss/vite';

// Chromium's OWN settings page, bundled by Vite instead of rollup.
//
// The entry is the same file rollup is given: the tsc output Chromium already
// produces. Nothing is rewritten and no component is replaced -- this step
// exists to prove the page survives a change of bundler, before a single style
// is touched. If it does not bundle here, restyling it was never the hard part.
//
// The three aliases are the only thing Vite needs that rollup got from
// Chromium's own plugin: chrome://resources and its scheme-relative form both
// resolve to the shared resource tree the build already generated, and
// /strings.m.js stays EXTERNAL because C++ generates it per page at runtime.
const GEN = '/home/nate/Oxy/Astro/chromium/src/out/PipelineCheck/gen';

export default defineConfig({
  plugins: [tailwindcss()],
  resolve: {
    alias: [
      // Longest patterns first: a bare `//resources/` rule would otherwise
      // swallow polymer, lit and mojo, which the build stages elsewhere.
      {find: /^\/\/resources\/polymer\/v3_0\//,
       replacement: '/home/nate/Oxy/Astro/chromium/src/third_party/polymer/v3_0/components-chromium/'},
      {find: /^\/\/resources\/lit\/v3_0\//,
       replacement: GEN + '/third_party/lit/v3_0/bundled/'},
      {find: /^\/\/resources\/mojo\//, replacement: GEN + '/'},
      {find: /^chrome:\/\/resources\//, replacement: GEN + '/ui/webui/resources/tsc/'},
      {find: /^\/\/resources\//, replacement: GEN + '/ui/webui/resources/tsc/'},
      {find: /^\/shared\/settings\//,
       replacement: GEN + '/chrome/browser/resources/settings_shared/tsc/'},
    ],
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    minify: false,
    modulePreload: false,
    rollupOptions: {
      // BOTH entry points. Upstream builds settings.js and lazy_load.js
      // separately, and lazy_load carries the bulk of the page -- site
      // settings, privacy, the long tail. Bundling only the first produced a
      // 1.1 MB artefact against upstream's 2.9 MB and would have shipped a
      // settings page whose deeper routes simply did not exist.
      input: {
        settings: GEN + '/chrome/browser/resources/settings/tsc/settings.js',
        lazy_load: GEN + '/chrome/browser/resources/settings/tsc/lazy_load.js',
      },
      external: ['/strings.m.js'],
      output: {entryFileNames: '[name].js', chunkFileNames: 'chunk-[name].js'},
    },
  },
});
