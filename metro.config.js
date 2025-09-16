// metro.config.js
const { getDefaultConfig } = require("@expo/metro-config");
const config = getDefaultConfig(__dirname);

// Enable resolving Firebase .cjs modules and disable strict packageExports
config.resolver.sourceExts.push("cjs");
config.resolver.unstable_enablePackageExports = false;

module.exports = config;
