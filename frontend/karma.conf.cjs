const { join } = require('path');

// The Angular CLI adapter defines __karma__.start so the runner can bootstrap.
const angularCliKarmaPlugin = require('@angular-devkit/build-angular/plugins/karma');

// Use Chrome from the system path
process.env.CHROME_BIN = require('puppeteer').executablePath();

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
      jasmine: {
        random: false
      }
    },
    jasmineHtmlReporter: {
      suppressAll: true,
    },
    coverageReporter: {
      dir: join(__dirname, './coverage'),
      subdir: '.',
      reporters: [
        { type: 'html' },
        { type: 'text-summary' },
      ],
    },
    reporters: ['progress', 'kjhtml'],
    browsers: ['ChromeHeadlessCustom'],
    customLaunchers: {
      ChromeHeadlessCustom: {
        base: 'ChromeHeadless',
        flags: [
          '--no-sandbox',
          '--disable-gpu',
          '--disable-dev-shm-usage',
          '--disable-software-rasterizer',
          '--disable-setuid-sandbox',
          '--no-zygote',
          '--remote-debugging-port=9222',
          '--disable-web-security',
          '--disable-features=IsolateOrigins,site-per-process'
        ]
      }
    },
    singleRun: true,
    autoWatch: false,
    restartOnFileChange: false,
    browserNoActivityTimeout: 60000,
    browserDisconnectTimeout: 10000,
    browserDisconnectTolerance: 3,
    captureTimeout: 60000,
    logLevel: config.LOG_INFO
  });
};
