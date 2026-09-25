const path = require("path");

// NativeWind, Tailwind and react-native-css-interop all resolve files (tailwind.config, global.css,
// package.json) against process.cwd(). If Expo is started from any other directory, for example
// `expo start mobile` from the repo root, loading this config throws, and Metro's fallback then
// reports a misleading ERR_UNSUPPORTED_ESM_URL_SCHEME on Windows. Pin the working directory to the
// project root before anything else loads.
if (process.cwd() !== __dirname) {
  process.chdir(__dirname);
}

const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

module.exports = withNativeWind(config, {
  input: path.join(__dirname, "global.css"),
  configPath: path.join(__dirname, "tailwind.config.js"),
  typescriptEnvPath: path.join(__dirname, "nativewind-env.d.ts"),
});
