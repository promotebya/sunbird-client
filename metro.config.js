// metro.config.js
/* eslint-env node */
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Ensure the array exists and add support for Firebase .cjs files once.
config.resolver.sourceExts = config.resolver.sourceExts || [];
if (!config.resolver.sourceExts.includes('cjs')) {
  config.resolver.sourceExts.push('cjs');
}

// Some libraries still break with package exports; keep this off.
config.resolver.unstable_enablePackageExports = false;

module.exports = config;