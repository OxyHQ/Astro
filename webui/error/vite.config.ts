import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import { viteSingleFile } from "vite-plugin-singlefile";

export default defineConfig({
  root: "src",
  base: "./",
  plugins: [tailwindcss(), viteSingleFile()],
  build: {
    outDir: "../dist",
    emptyOutDir: true,
    minify: true,
    modulePreload: { polyfill: false },
    cssCodeSplit: false,
    assetsInlineLimit: 1_000_000,
    rollupOptions: {
      input: "src/index.html",
    },
  },
});
