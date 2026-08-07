import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";

// Output names are STABLE, with no content hash.
//
// grit packages a fixed list of files into the .pak, and a hashed filename
// changes on every build, so the .grd would name a file that no longer exists
// and the page would 404 on its own script. Chromium's own WebUI resources are
// likewise fixed names resolved through the resource id, not the filename.
export default defineConfig({
  root: "src",
  base: "./",
  plugins: [tailwindcss()],
  build: {
    outDir: "../dist",
    emptyOutDir: true,
    modulePreload: false,
    rollupOptions: {
      input: "src/index.html",
      output: {
        entryFileNames: "settings.js",
        chunkFileNames: "settings-[name].js",
        assetFileNames: "settings.[ext]",
      },
    },
  },
});
