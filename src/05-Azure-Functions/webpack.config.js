module.exports = (config, webpack) => {
  if (!config.module) {
    config.module = {};
  }
  if (!config.module.rules) {
    config.module.rules = [];
  }
  config.module.rules.push(
    {
      test: /rx\.lite\.aggregates\.js/,
      use: 'imports-loader?define=>false'
    }
  );
  return config;
};
