const { join } = require('node:path');
const puppeteer = require('puppeteer');
const angularCliKarmaPlugin = require('@angular-devkit/build-angular/plugins/karma');

// Puppeteer 経由でインストールされた Chrome のパスを環境変数に設定
process.env.CHROME_BIN = puppeteer.executablePath();

module.exports = function (config) {
  config.set({
    basePath: '',
    frameworks: ['jasmine', '@angular-devkit/build-angular'],
    plugins: [
      require('karma-jasmine'),
      require('karma-chrome-launcher'),
      require('karma-jasmine-html-reporter'),
      require('karma-coverage'),
      angularCliKarmaPlugin,
    ],
    client: {
      clearContext: false,
    },
    coverageReporter: {
      dir: join(__dirname, './coverage'),
      subdir: '.',
      reporters: [{ type: 'html' }, { type: 'text-summary' }],
    },
    reporters: ['progress', 'kjhtml'],
    browsers: ['ChromeHeadlessNoSandbox'],
    customLaunchers: {
      ChromeHeadlessNoSandbox: {
        base: 'ChromeHeadless',
        flags: [
          '--no-sandbox',
          '--disable-gpu',
          '--disable-dev-shm-usage',
          '--disable-setuid-sandbox',
          '--remote-debugging-port=9222',
        ],
      },
    },
    singleRun: true,
    restartOnFileChange: false,
  });
};
