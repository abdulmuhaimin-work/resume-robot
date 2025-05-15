const path = require('path');

module.exports = {
  entry: {
    popup: './popup.js',
    background: './background.js',
    content: './content.js'
  },
  output: {
    filename: '[name].bundle.js',
    path: path.resolve(__dirname, 'dist')
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env']
          }
        }
      }
    ]
  },
  resolve: {
    fallback: {
      "fs": false,
      "path": false,
      "crypto": false
    }
  },
  optimization: {
    splitChunks: {
      chunks: 'all',
      name: 'vendor'
    }
  }
}; 