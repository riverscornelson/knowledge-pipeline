const rules = require('./webpack.rules');

module.exports = {
  entry: './src/main/preload.ts',
  module: {
    rules
  },
  resolve: {
    extensions: ['.js', '.ts', '.jsx', '.tsx', '.css', '.json']
  }
};