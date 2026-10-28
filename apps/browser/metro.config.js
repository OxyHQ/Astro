const path = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");
const { withNativewind } = require("nativewind/metro");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");
const escape = (dir) => dir.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.server = { ...config.server, unstable_serverRoot: projectRoot };
config.resolver.nodeModulesPaths = [path.resolve(projectRoot, "node_modules"), path.resolve(workspaceRoot, "node_modules")];
config.resolver.platforms = [...new Set([...config.resolver.platforms, "macos"])];
config.resolver.unstable_enablePackageExports = true;
config.resolver.unstable_conditionsByPlatform = { ...config.resolver.unstable_conditionsByPlatform, macos: ["react-native"] };
config.resolver.blockList = [
  ...[].concat(config.resolver.blockList ?? []),
  new RegExp(`^${escape(path.join(workspaceRoot, ".worktrees"))}/.*`),
];
const macosModules = {
  "expo-blur": path.join(projectRoot, "src/oxy/expoBlur.tsx"),
  "expo-secure-store": path.join(projectRoot, "src/oxy/secureStore.ts"),
};

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === "macos" && macosModules[moduleName]) return { type: "sourceFile", filePath: macosModules[moduleName] };
  if (platform === "macos" && (moduleName === "react-native" || moduleName.startsWith("react-native/"))) {
    moduleName = moduleName.replace(/^react-native/, "react-native-macos");
  }
  if (process.env.AC_REACT_PROFILING === "1" && /\/ReactFabric-prod$/.test(moduleName)) {
    moduleName = moduleName.replace(/-prod$/, "-profiling");
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = withNativewind(config, { input: "./src/oxy/bloom.css", inlineRem: 16, disableTypeScriptGeneration: true });
