// babel.config.js
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    // IMPORTANT: Reanimated plugin MUST be last.
    plugins: ["react-native-reanimated/plugin"],
  };
};
