import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { type Alias, defineConfig } from "vite";
import demo from "../demo/vite.config";

const shims = fileURLToPath(new URL("./src/shims/", import.meta.url));
const project = readFileSync(new URL("../browser/macos/Astro.xcodeproj/project.pbxproj", import.meta.url), "utf8");
const appVersion = /MARKETING_VERSION = ([^;]+);/.exec(project)?.[1] ?? "0.0.0";
const appBuild = (() => {
  try {
    return execFileSync("git", ["rev-parse", "--short", "HEAD"], { encoding: "utf8" }).trim();
  } catch {
    return "local";
  }
})();

export default defineConfig({
  ...demo,
  root: fileURLToPath(new URL(".", import.meta.url)),
  define: { ...demo.define, __ASTRO_VERSION__: JSON.stringify(appVersion), __ASTRO_BUILD__: JSON.stringify(appBuild) },
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
