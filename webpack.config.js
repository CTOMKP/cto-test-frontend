const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const webpack = require('webpack');
const dotenv = require('dotenv');
const fs = require('fs');

// Determine which env file to use
const currentEnv = process.env.NODE_ENV || 'development';
const envFiles = [
  `.env.${currentEnv}.local`,
  `.env.${currentEnv}`,
  '.env.local',
  '.env'
];

// Load environment variables from the first existing env file
let envLoaded = false;
for (const file of envFiles) {
  if (fs.existsSync(file)) {
    console.log(`Loading environment from ${file}`);
    dotenv.config({ path: file });
    envLoaded = true;
    break;
  }
}

if (!envLoaded) {
  console.warn('No environment file found, using default env.local');
  dotenv.config({ path: './env.local' });
}

module.exports = {
  entry: './src/index.tsx',
  mode: process.env.NODE_ENV || 'development',
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
    fallback: {
      // Required for Circle SDK
      "crypto": require.resolve("crypto-browserify"),
      "stream": require.resolve("stream-browserify"),
      "process": require.resolve("process"),
      "buffer": require.resolve("buffer"),
      "util": require.resolve("util"),
      "vm": false,
    }
  },
  module: {
    rules: [
      {
        test: /\.(ts|tsx)$/,
        exclude: /node_modules/,
        use: {
          loader: 'ts-loader',
        },
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader', 'postcss-loader'],
      },
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './public/index.html',
    }),
    new webpack.ProvidePlugin({
      process: 'process',
      Buffer: ['buffer', 'Buffer'],
    }),
    new webpack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
      'process.env.REACT_APP_CIRCLE_API_KEY': JSON.stringify(process.env.REACT_APP_CIRCLE_API_KEY),
      'process.env.REACT_APP_CIRCLE_APP_ID': JSON.stringify(process.env.REACT_APP_CIRCLE_APP_ID),
      'process.env.REACT_APP_CIRCLE_API_BASE': JSON.stringify(process.env.REACT_APP_CIRCLE_API_BASE),
      'process.env.REACT_APP_BACKEND_URL': JSON.stringify(process.env.REACT_APP_BACKEND_URL),
      'process.env.REACT_APP_BACKEND_ENV': JSON.stringify(process.env.REACT_APP_BACKEND_ENV),
      'process.env.REACT_APP_GOOGLE_CLIENT_ID': JSON.stringify(process.env.REACT_APP_GOOGLE_CLIENT_ID),
      'process.env.REACT_APP_PRIVY_APP_ID': JSON.stringify(process.env.REACT_APP_PRIVY_APP_ID),
      'process.browser': true,
      'process.version': JSON.stringify(process.version),
      'process.platform': JSON.stringify(process.platform),
    }),
  ],
  devServer: {
    port: 3000,
    hot: true,
    historyApiFallback: true,
    // https: true, // Temporarily disabled for testing
    static: [
      {
        directory: path.join(__dirname, 'public'),
        publicPath: '/',
      },
      {
        directory: path.join(__dirname, 'dist'),
        publicPath: '/',
      }
    ],
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'bundle.js',
    publicPath: '/',
  },
};
