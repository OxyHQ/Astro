import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  root: "src",
  base: "./",
  plugins: [tailwindcss()],
  build: {
    outDir: "../dist",
    emptyOutDir: true,
    minify: true,
      modulePreload: { polyfill: false },
    rollupOptions: {
      input: "src/index.html",
    },
  },
});
