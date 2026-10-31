const path = require("node:path");

module.exports = {
  reactNativePath: path.dirname(require.resolve("react-native-macos/package.json")),
  project: {
    ios: { sourceDir: "./macos" },
    macos: { sourceDir: "./macos" },
  },
  dependencies: {
    "@oxy.so/services": { platforms: { ios: null, macos: null, android: null } },
  },
};
