const { join } = require('node:path');
const { spawnSync } = require('node:child_process');

const puppeteer = require('puppeteer');
// The Angular CLI adapter defines __karma__.start so the runner can bootstrap.
const angularCliKarmaPlugin = require('@angular-devkit/build-angular/plugins/karma');

const FALLBACK_CHROME_BINARIES = [
  process.env.CHROME_BIN,
  '/usr/bin/google-chrome-stable',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
];

const canLaunch = (binaryPath) => {
  if (!binaryPath) {
    return false;
  }

  const result = spawnSync(binaryPath, ['--version'], {
    stdio: 'ignore',
  });

  if (result.error) {
    return false;
  }

  return result.status === 0;
};

const resolveChromeBin = () => {
  const bundledChrome = puppeteer.executablePath();
  if (canLaunch(bundledChrome)) {
    return bundledChrome;
  }

  for (const fallback of FALLBACK_CHROME_BINARIES) {
    if (canLaunch(fallback)) {
      return fallback;
    }
  }

  return bundledChrome;
};

process.env.CHROME_BIN = resolveChromeBin();

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
      reporters: [
        { type: 'html' },
        { type: 'text-summary' },
      ],
    },
    reporters: ['progress', 'kjhtml'],
    browsers: ['ChromeHeadlessNoSandbox'],
    customLaunchers: {
      ChromeHeadlessNoSandbox: {
        base: 'ChromeHeadless',
        flags: ['--no-sandbox', '--disable-dev-shm-usage'],
      },
    },
    singleRun: true,
    restartOnFileChange: false,
  });
};
