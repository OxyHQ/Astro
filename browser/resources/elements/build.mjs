// Build Bloom's custom-element bundle from a GN action.
//
// Vite's CLI writes wherever the config says; GN needs it written where GN
// asked, so this drives Vite's JS API with the output directory overridden.
// The alternative -- build into dist/ and copy the result into the Chromium
// tree by hand -- is what this replaces. That copy went stale exactly once and
// was undetectable: the page rendered, the build was green, and the element
// added that afternoon simply did not exist at runtime.
//
// Failing is the point. A build step that cannot produce the bundle must stop
// the build, not leave the previous bundle in place.

import {readdir} from 'node:fs/promises';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

import {build} from 'vite';

const here = dirname(fileURLToPath(import.meta.url));

const args = process.argv.slice(2);
const flag = (name) => {
  const at = args.indexOf(name);
  if (at < 0 || at + 1 >= args.length) {
    throw new Error(`missing required argument ${name}`);
  }
  return args[at + 1];
};

const outDir = resolve(flag('--out-dir'));

await build({
  configFile: resolve(here, 'vite.config.ts'),
  root: resolve(here, 'src'),
  logLevel: 'warn',
  build: {outDir, emptyOutDir: true},
});

// GN declares every output by name and fails the build when one is missing, so
// a file APPEARING that GN does not know about is the case it cannot see: the
// bundle would ship without it and the missing asset would surface as a 404 in
// a browser nobody was looking at. Assert the set here instead.
const expected = new Set([
  'astro_elements.js',
  'astro_elements.woff2',
  'astro_elements2.woff2',
  'astro_elements3.woff2',
  'astro_elements4.woff2',
]);
const produced = new Set(await readdir(outDir));
const unexpected = [...produced].filter((name) => !expected.has(name));
if (unexpected.length) {
  throw new Error(
      `vite emitted files GN does not ship: ${unexpected.join(', ')}\n` +
      `Add them to outputs and input_files in the two BUILD.gn files that ` +
      `name this bundle, or stop emitting them.`);
}
