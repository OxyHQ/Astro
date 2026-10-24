import { fileURLToPath } from "node:url";
import { type Alias, defineConfig } from "vite";
import demo from "../demo/vite.config";

const shims = fileURLToPath(new URL("./src/shims/", import.meta.url));

export default defineConfig({
  ...demo,
  root: fileURLToPath(new URL(".", import.meta.url)),
  base: "./",
  resolve: {
    ...demo.resolve,
    alias: [{ find: /^@astro-browser\/(shell|astrocore|sync)$/, replacement: `${shims}$1.tsx` }, ...(demo.resolve?.alias as Alias[])],
  },
  build: {
    ...demo.build,
    outDir: "dist",
    emptyOutDir: true,
    modulePreload: { polyfill: false },
  },
});
