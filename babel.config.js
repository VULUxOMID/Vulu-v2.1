module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // React Native Reanimated plugin temporarily disabled due to worklets dependency issue
      // 'react-native-reanimated/plugin',
    ],
  };
};
