module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      [
        'module-resolver',
        {
          root: ['./'],
          extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
          alias: {
            components: './components',
            screens: './screens',
            navigation: './navigation',
            utils: './utils',
            hooks: './hooks',
            assets: './assets',
            types: './types'
          }
        }
      ]
    ]
  };
};
