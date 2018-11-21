import * as webpack from 'webpack';
import * as UglifyJSPlugin from 'uglifyjs-webpack-plugin';
import * as path from 'path';

const rules: webpack.Rule[] = [
  {
    test: /\.ts(x?)$/,
    exclude: /(node_modules|dist)/,
    use: [ 'awesome-typescript-loader' ]
  },
  {
    test: /\.css$/,
    use: [
      {
        loader: 'style-loader'
      },
      {
        loader: 'css-loader',
        options: {
          minimize: true,
          sourceMap: true
        }
      }
    ]
  },
  {
    test: /\.scss$/,
    use: [
      {
        loader: 'style-loader'
      },
      {
        loader: 'css-loader',
        options: {
          minimize: true,
          sourceMap: true
        }
      },
      {
        loader: 'sass-loader',
        options: {
          sourceMap: true
        }
      }
    ]
  }
];

const webpackConfig: webpack.Configuration = {
  mode: 'production',
  entry: [ './src/frontend/index.tsx' ],
  output: {
    path: path.join(process.cwd(), './build/frontend'),
    filename: 'app.js',
    sourceMapFilename: `chunks/[name].js.map?v=[chunkhash:8]&e=.js.map`,
    chunkFilename:  `chunks/[name].chunk.js?v=[chunkhash:8]&e=.chunk.js`
  },
  cache: false,
  devtool: 'source-map',
  module: { rules },
  optimization: {
    minimizer: [
      new UglifyJSPlugin({
        cache: true,
        parallel: true,
        uglifyOptions: {
          ecma: 5,
          compress: true,
          mangle: true,
          output: {
            comments: false
          }
        },
        sourceMap: true
      })
    ]
  },
  resolve: {
    extensions: [ '.ts', '.tsx', '.js', '.jsx' ]
  },
  plugins: [
    new webpack.DefinePlugin({
      'process.env': {
        NODE_ENV: JSON.stringify('production')
      }
    })
  ],
  externals: {
    electron: 'electron'
  }
};

module.exports = webpackConfig;
