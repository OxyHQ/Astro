import {readFileSync, writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import viteReact from '@vitejs/plugin-react';
import {defineConfig, type Plugin} from 'vite';
import reactNativeWeb from 'vite-plugin-react-native-web';

// Astro's internal pages, as ONE Vite + Tailwind + Bloom app.
//
// The wiring below is INHERITED, not derived. Every alias, plugin option and
// `define` in it answers a failure someone already paid for -- in Oxy's
// `packages/test-app-vite` and `packages/console`, and in the settings
// prototype this app supersedes. Re-deriving it from first principles was
// tried there and produced an hour of one-error-at-a-time shimming (Flow
// types, Fabric internals, react-native-svg's native asset path, the
// gesture-handler Android components). The reason each line exists is written
// next to it; change one only with a measurement, not a theory.

const packageDir = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const reactNativeCssBabel = require('react-native-css/babel');
const emptyModule = resolve(packageDir, 'src/platform/empty-module.js');

/** Build modes. `app` emits the per-host page bundle, `platform` the shared facade. */
type BuildName = 'app' | 'platform';

/**
 * Records the emitted file set into `manifest.json`.
 *
 * This file is the SINGLE authority on what a build produces: the GN action
 * that packs these bytes into the browser (`generate_grd` -> grit -> `.pak`)
 * reads it rather than carrying its own hand-written list, which is how a
 * bundle comes to be built and then not shipped. It is committed for the same
 * reason the baseline documents are -- the emitted set changing is a reviewable
 * event, and with unhashed output names it changes only when a file is added
 * or removed, not on every build.
 *
 * Each mode owns its own key and leaves the other alone, so building one does
 * not erase the record of the other.
 */
function astroManifest(build: BuildName, outDir: string): Plugin {
  const manifestPath = resolve(packageDir, 'manifest.json');
  return {
    name: 'astro-manifest',
    writeBundle(_options, bundle) {
      let manifest: Record<string, unknown> = {};
      try {
        manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as Record<string, unknown>;
      } catch {
        // No manifest yet: the first build of a fresh checkout writes it.
        // Any other read failure is re-surfaced by the write below.
        manifest = {};
      }
      const builds = (manifest['builds'] ?? {}) as Record<string, unknown>;
      builds[build] = {
        out_dir: outDir,
        entry: build === 'app' ? 'index.html' : 'platform.js',
        files: Object.keys(bundle).sort(),
      };
      writeFileSync(manifestPath, `${JSON.stringify({
        generated_by: 'webui/app/vite.config.ts (astro-manifest plugin)',
        regenerate: 'cd webui/app && bun run build && bun run build:platform',
        builds,
      }, null, 2)}\n`);
    },
  };
}

export default defineConfig(({command, mode}) => {
  // Deliberately NOT `mode !== 'production'`, the form both reference configs
  // use. `--mode platform` is a named RELEASE mode, and that test would hand it
  // a development React plus every `import.meta.env.DEV` branch -- including the
  // dynamic imports of the dev mocks in src/platform/browser.
  const dev = command === 'serve';
  const build: BuildName = mode === 'platform' ? 'platform' : 'app';
  // Siblings, never nested. Each build empties its own directory, so an app
  // build whose outDir contained the platform one would delete an output the
  // manifest still claimed existed -- and the manifest is the thing GN trusts.
  const outDir = build === 'platform' ? 'dist/platform' : 'dist/app';

  return {
    base: './',
    server: {
      // Not 5173: ~/Oxy/website's dev server sits on that port on this
      // machine, and sharing it already sent one person to the wrong app.
      port: 5178,
      // Refuse a busy port instead of quietly taking the next one. Vite's
      // default is to increment, and the result is a dev server on :5179 while
      // every instruction, bookmark and verification command still says :5178
      // -- which in this repository already produced a session that curled
      // another project's app and read its HTML as this one's.
      strictPort: true,
    },
    plugins: [
      reactNativeWeb(),
      tailwindcss(),
      viteReact({
        // node_modules is EXCLUDED by default (`defaultExcludeRE` in
        // @vitejs/plugin-react), and Bloom is installed here rather than
        // linked. That one default decides whether Bloom renders at all:
        // Bloom styles with `className`, which only becomes real CSS once the
        // react-native-css preset below has run over Bloom's own files. From
        // an installed copy it never runs, every className is dropped, and the
        // components come out unstyled -- while Switch and Search, which style
        // with StyleSheet, look perfect. That asymmetry is what makes it read
        // as "some Bloom components are broken".
        exclude: [/[\\/]node_modules[\\/](?!@oxyhq[\\/]bloom[\\/])/],
        babel: {presets: [reactNativeCssBabel]},
      }),
      astroManifest(build, outDir),
    ],
    resolve: {
      alias: [
        {find: '@astro/platform', replacement: resolve(packageDir, 'src/platform/index.ts')},
        // Deep native-only internals that hoisting pulls in transitively and
        // that have no web implementation.
        {find: /^react-native\/Libraries\/.*/, replacement: emptyModule},
        // Native-only navigation primitives used by Bloom's FullWindowOverlay,
        // which renders straight through on web. An empty module is not
        // enough -- consumers use NAMED imports, a link-time error in dev's raw
        // ESM serving.
        {
          find: 'react-native-screens',
          replacement: resolve(packageDir, 'src/platform/shims/react-native-screens.js'),
        },
        // react-native-svg reaches for RN's Flow-typed CJS asset registry; on
        // web the one true registry is react-native-web's, with the same API.
        {
          find: '@react-native/assets-registry/registry',
          replacement: 'react-native-web/dist/modules/AssetRegistry',
        },
      ],
    },
    define: {
      // vite-plugin-react-native-web pins __DEV__=false and NODE_ENV=production
      // unconditionally; re-assert the command-aware values (user config wins
      // in Vite's merge).
      __DEV__: JSON.stringify(dev),
      'process.env.NODE_ENV': JSON.stringify(dev ? 'development' : 'production'),
    },
    build: {
      outDir,
      emptyOutDir: true,
      // Every byte here is packed into the browser binary and served from a
      // WebUI data source, so the emitted set is the product, not a deploy
      // detail.
      //
      // No module preload: the polyfill injects a <link rel=modulepreload> per
      // chunk, and the pages are served from a scheme whose CSP the browser
      // itself sets.
      modulePreload: false,
      // Stated rather than inherited, because both outputs end up as bytes
      // inside the browser binary. It is honoured for the app build and NOT
      // for the library build: measured on rolldown-vite 7.3.1, platform.js
      // comes out at 20,760 lines with this set either way, while the app
      // entry beside it is 31. Naming a minifier explicitly is not the fix --
      // `'esbuild'` fails outright, since rolldown-vite minifies with oxc and
      // does not ship esbuild. The shared bundle is not served by anything
      // yet; whoever packs it has to settle this first.
      minify: true,
      // One stylesheet. Tailwind emits a single utility sheet anyway, and a
      // per-chunk sheet would be one more resource path to declare in GN, one
      // more chance to forget one.
      cssCodeSplit: false,
      // Fonts inline into the bundle as data URIs. Bloom's four families are
      // 48-78 KB each as woff2, and the alternative is four binary blobs that
      // each need a resource path, a C++ symbol and a `font-src` allowance for
      // a URL. Data URIs need only `font-src data:`.
      assetsInlineLimit: 1024 * 1024,
      ...(build === 'platform'
        ? {
            // The shared facade as its own bundle (design phase P3): the pages
            // externalise `@astro/platform` and load it from the shared
            // resources host, so React + Bloom are parsed and code-cached ONCE
            // for every astro:// page instead of once per host. Nothing
            // consumes this output yet -- the GN target that packs it lands
            // with the shared-resources hook.
            //
            // It has to be a LIBRARY build, not an app build aimed at a .ts
            // entry. An app build sets preserveEntrySignatures to false, so
            // rollup drops every export as unreachable and emits a bundle that
            // still weighs something -- side-effectful modules -- while
            // exporting nothing at all. Measured: 88 kB containing neither
            // BloomThemeProvider nor PageShell nor a single `export`.
            lib: {
              entry: resolve(packageDir, 'src/platform/index.ts'),
              formats: ['es' as const],
              fileName: () => 'platform.js',
              cssFileName: 'platform',
            },
          }
        : {
            rollupOptions: {
              input: resolve(packageDir, 'index.html'),
              output: {
                // Stable and unhashed: a GN action packs these by name, and a
                // content hash would rename every resource on every build.
                entryFileNames: 'astro_webui.js',
                chunkFileNames: 'astro-webui-[name].js',
                assetFileNames: 'astro-webui-[name][extname]',
              },
            },
          }),
    },
  };
});
