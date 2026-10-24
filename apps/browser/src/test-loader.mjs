import { registerHooks } from "node:module";

const stub = new URL("./test-native-stub.mjs", import.meta.url).href;
const native = new Set(["@astro-browser/shell", "@astro-browser/astrocore", "expo-modules-core", "react-native"]);

registerHooks({
  resolve(specifier, context, next) {
    if (native.has(specifier)) return { url: stub, shortCircuit: true };
    try {
      return next(specifier, context);
    } catch (error) {
      if (specifier.startsWith(".")) {
        for (const ext of [".ts", ".tsx"]) {
          try {
            return next(specifier + ext, context);
          } catch {}
        }
      }
      throw error;
    }
  },
});
