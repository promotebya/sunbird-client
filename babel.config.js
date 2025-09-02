module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    // We switched to relative imports, so this is all you need:
    plugins: ["react-native-reanimated/plugin"],
  };
};
