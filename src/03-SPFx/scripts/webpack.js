//@ts-check

const configureWebpack = ({ build }) => {
  build.configureWebpack.mergeConfig({
    additionalConfiguration: config => {
      config.module.rules.push({
        test: /\.scss$/,
        use: [
          'style-loader',
          {
            loader: "css-loader",
            options: {
              minimize: true,
              sourceMap: true
            }
          },
          {
            loader: "sass-loader",
            options: {
              sourceMap: true
            }
          }
        ]
      });
      return config;
    }
  });
};

module.exports = { configureWebpack };
