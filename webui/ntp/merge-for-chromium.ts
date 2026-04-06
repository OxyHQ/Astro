/**
 * Merges the built Astro NTP (single-file inlined HTML) with the Chromium
 * third-party NTP template, preserving Mojo bindings while replacing the UI.
 *
 * The output file is written directly to:
 *   chromium/src/chrome/browser/resources/new_tab_page_third_party/new_tab_page_third_party.html
 *
 * Usage: bun run merge-for-chromium.ts
 */

import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

const DIST_HTML = resolve(import.meta.dirname, "dist/index.html");
const CHROMIUM_HTML = resolve(
  import.meta.dirname,
  "../../chromium/src/chrome/browser/resources/new_tab_page_third_party/new_tab_page_third_party.html"
);

const distContent = readFileSync(DIST_HTML, "utf-8");

// Extract the inlined <style> block from the built HTML.
// vite-plugin-singlefile puts it inside <head> as a <style> tag.
const styleMatch = distContent.match(/<style[^>]*>([\s\S]*?)<\/style>/);
const inlinedCSS = styleMatch ? styleMatch[1] : "";

// Extract the inlined <script type="module"> block.
const scriptMatch = distContent.match(
  /<script type="module"[^>]*>([\s\S]*?)<\/script>/
);
const inlinedJS = scriptMatch ? scriptMatch[1] : "";

// Extract the <body> inner content (our visual UI markup).
const bodyMatch = distContent.match(/<body[^>]*>([\s\S]*?)<\/body>/);
let bodyContent = bodyMatch ? bodyMatch[1] : "";

// Remove any <script> tags from the body content - the JS is already captured above.
bodyContent = bodyContent.replace(/<script[\s\S]*?<\/script>/g, "");

// Produce the merged HTML.
// Chromium's WebUI data source processor replaces $i18n{key} tokens at serve time.
// We preserve the ones the third-party NTP controller expects.
//
// IMPORTANT: No external <link> or <script src="https://..."> tags are allowed
// in chrome:// WebUI pages. The WebUI URL loader factory rejects any request
// whose scheme does not match chrome://. External fonts, images loaded via
// fetch(), and <a href> navigations are fine -- only sub-resource loads from
// markup tags trigger the scheme check.
const mergedHTML = `<!doctype html>
<html dir="$i18n{textdirection}" lang="$i18n{language}">
  <head>
    <meta charset="utf-8">
    <title>$i18n{title}</title>
    <link rel="stylesheet" href="chrome://theme/colors.css?sets=ui,chrome">
    <style>
${inlinedCSS}

      /* Hide the Chromium cr-most-visited element - we use our own UI */
      cr-most-visited {
        display: none !important;
        position: absolute !important;
        width: 0 !important;
        height: 0 !important;
        overflow: hidden !important;
        pointer-events: none !important;
      }
    </style>
  </head>
  <body class="bg-base" data-modality="mouse">
    <!-- Astro NTP UI -->
${bodyContent}
    <script type="module">
${inlinedJS}
    </script>
  </body>
</html>
`;

writeFileSync(CHROMIUM_HTML, mergedHTML, "utf-8");

const sizeKB = (Buffer.byteLength(mergedHTML, "utf-8") / 1024).toFixed(1);
process.stdout.write(
  `Merged NTP written to:\n  ${CHROMIUM_HTML}\n  Size: ${sizeKB} KB\n`
);
