import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { type Alias, defineConfig } from "vite";
import demo from "../demo/vite.config";

const shims = fileURLToPath(new URL("./src/shims/", import.meta.url));
const project = readFileSync(new URL("../browser/macos/Astro.xcodeproj/project.pbxproj", import.meta.url), "utf8");
const appVersion = /MARKETING_VERSION = ([^;]+);/.exec(project)?.[1] ?? "0.0.0";
const infoPlist = readFileSync(new URL("../browser/macos/Astro-macOS/Info.plist", import.meta.url), "utf8");
const plistValue = (key: string) => new RegExp(`<key>${key}</key>\\s*<(?:string|integer)>([^<]*)</`).exec(infoPlist)?.[1]?.trim() ?? "";
const updateKey = plistValue("SUPublicEDKey");
const updateInterval = Number(plistValue("SUScheduledCheckInterval")) || 86400;
const updateFeed = process.env.ASTRO_WINDOWS_UPDATE_FEED ?? "https://github.com/OxyHQ/Astro/releases/latest/download/appcast-windows.xml";
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
  define: {
    ...demo.define,
    __ASTRO_VERSION__: JSON.stringify(appVersion),
    __ASTRO_BUILD__: JSON.stringify(appBuild),
    __ASTRO_UPDATE_KEY__: JSON.stringify(updateKey),
    __ASTRO_UPDATE_FEED__: JSON.stringify(updateFeed),
    __ASTRO_UPDATE_INTERVAL__: JSON.stringify(updateInterval),
    __ASTRO_FEEDBACK_URL__: JSON.stringify(plistValue("ACFeedbackURL")),
    __ASTRO_FEEDBACK_EMAIL__: JSON.stringify(plistValue("ACFeedbackEmail")),
  },
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
