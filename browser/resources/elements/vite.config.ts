import {resolve} from 'path';
import {createRequire} from 'node:module';
import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import reactNativeWeb from 'vite-plugin-react-native-web';
import tailwindcss from '@tailwindcss/vite';

// Bloom's components, wrapped as custom elements so Chromium's Polymer WebUI
// can use them directly.
//
// Not an imitation in CSS. A settings toggle IS Bloom's Switch: the same React
// Native component that Mention and the console render, mounted into a React
// root inside the custom element's own shadow root. Copying its geometry into a
// stylesheet was tried first and rejected -- it looks the same until Bloom
// changes, and then two things that claim to be one component quietly differ.
//
// This configuration is deliberately the one from OxyHQServices' IdP
// (packages/auth), not a fresh derivation. Building it from first principles
// was tried and produced an hour of one-error-at-a-time shimming -- Flow types,
// Fabric renderer internals, react-native-svg's native asset path, then
// gesture-handler's Android-only components. Every one of those already has an
// answer in that file, with the reason written next to it. Copying the answers
// is the correct move; re-deriving them is how two consumers of the same
// library end up subtly different.
const emptyModule = resolve(__dirname, 'src/empty-module.js');
const require = createRequire(import.meta.url);
const reactNativeCssBabel = require('react-native-css/babel');

export default defineConfig(({mode}) => ({
  root: 'src',
  base: './',
  plugins: [
    reactNativeWeb(),
    react({babel: {presets: [reactNativeCssBabel]}}),
    tailwindcss(),
  ],
  resolve: {
    alias: [
      // Deep native-only internals that hoisting pulls in transitively and that
      // have no web implementation.
      {find: /^react-native\/Libraries\/.*/, replacement: emptyModule},
      // Native-only navigation primitives used by Bloom's FullWindowOverlay,
      // which renders straight through on web.
      {find: 'react-native-screens',
       replacement: resolve(__dirname, 'src/shims/react-native-screens.js')},
      // react-native-svg reaches for RN's Flow-typed CJS asset registry; on web
      // the one true registry is react-native-web's, with the same API.
      {find: '@react-native/assets-registry/registry',
       replacement: 'react-native-web/dist/modules/AssetRegistry'},
    ],
  },
  define: {
    // vite-plugin-react-native-web pins these unconditionally; re-assert the
    // mode-aware values, since user config wins in Vite's merge.
    __DEV__: JSON.stringify(mode !== 'production'),
    'process.env.NODE_ENV': JSON.stringify(mode),
  },
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    modulePreload: false,
    // Fonts inline into the stylesheet as data URIs. The bundle is embedded
    // into the browser binary file by file, and four separate binary blobs
    // would each need their own resource path, their own C++ symbol and their
    // own chance to be forgotten. Three text files is the whole page.
    // No inlined fonts. Bloom's stylesheet declares @font-face with base64
    // payloads; the settings page's Content Security Policy refuses data: fonts,
    // and a switch has no typography of its own to lose. Keeping them cost four
    // console errors per page load and 300KB for nothing.
    assetsInlineLimit: 0,
    rollupOptions: {
      input: 'src/elements.tsx',
      output: {
        // Stable, unhashed: a GN action embeds these by name into the browser
        // binary, and a content hash would change them on every build.
        entryFileNames: 'astro_elements.js',
        chunkFileNames: 'astro-elements-[name].js',
        assetFileNames: 'astro_elements.[ext]',
      },
    },
  },
}));
