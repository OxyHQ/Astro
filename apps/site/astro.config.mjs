import { defineConfig } from "astro/config";
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { constants, gzipSync } from "node:zlib";

function demo() {
  let base = "/";
  return {
    name: "astro:demo",
    hooks: {
      "astro:config:done": ({ config }) => {
        base = config.base.endsWith("/") ? config.base : `${config.base}/`;
      },
      "astro:build:done": ({ dir, logger }) => {
        const outDir = fileURLToPath(new URL("demo/", dir));
        const demoDir = fileURLToPath(new URL("../demo/", import.meta.url));
        execFileSync("pnpm", ["-C", demoDir, "exec", "vite", "build", "--base", `${base}demo/`, "--outDir", outDir, "--emptyOutDir", "--logLevel", "warn"], { stdio: "inherit" });
        logger.info(`built the demo into ${outDir}`);
      },
    },
  };
}

function dist() {
  const compressible = /\.(html|css|js|mjs|json|svg|xml|txt)$/;
  const walk = (dir) =>
    readdirSync(dir).flatMap((name) => {
      const path = join(dir, name);
      return statSync(path).isDirectory() ? walk(path) : [path];
    });
  return {
    name: "astro:dist",
    hooks: {
      "astro:build:done": ({ dir, logger }) => {
        let files = 0;
        for (const path of walk(fileURLToPath(dir)).filter((p) => compressible.test(p))) {
          const raw = readFileSync(path);
          const gz = gzipSync(raw, { level: constants.Z_BEST_COMPRESSION, memLevel: 9 });
          if (gz.length > raw.length * 0.95) continue;
          writeFileSync(`${path}.gz`, gz);
          files++;
        }
        logger.info(`gzipped ${files} files`);
      },
    },
  };
}

export default defineConfig({
  site: process.env.SITE_URL ?? "https://astro.oxy.so",
  base: process.env.SITE_BASE ?? "/",
  output: "static",
  trailingSlash: "ignore",
  build: { inlineStylesheets: "always", assets: "_assets" },
  image: { responsiveStyles: false },
  devToolbar: { enabled: false },
  integrations: [demo(), dist()],
});
