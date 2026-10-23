import { fileURLToPath } from "node:url";

export const HERE = fileURLToPath(new URL(".", import.meta.url));
export const REPO = fileURLToPath(new URL("../../../../", import.meta.url));
export const SYMBOLS_DIR = `${REPO}apps/demo/src/shims/web/symbols/`;
export const SCRATCH = process.env.ASTRO_ICONS_SCRATCH ?? "/tmp/astro-icons";
export const NATIVE = `${SCRATCH}/native`;
