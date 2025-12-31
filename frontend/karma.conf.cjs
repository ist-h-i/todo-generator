const { join } = require('node:path');
const puppeteer = require('puppeteer');
const angularCliKarmaPlugin = require('@angular-devkit/build-angular/plugins/karma');

const karmaPathFixPlugin = (() => {
  /**
   * @angular-devkit/build-angular's fallback middleware rewrites non-webpack requests by prefixing
   * `/_karma_webpack_` so webpack-dev-middleware can attempt to serve them.
   *
   * On Windows, Karma can generate served file URLs like `/absoluteC:\\...` or `/base\\...`.
   * If the fallback middleware runs before Karma's static file handler, those requests get rewritten
   * to `/_karma_webpack_/absolute...` and end up as 404s, preventing Jasmine from loading.
   *
   * This plugin runs after the Angular framework plugin and undoes that prefix for Karma's own
   * `/base` and `/absolute` routes, while leaving real webpack bundle requests untouched.
   */
  const KARMA_WEBPACK_PREFIX = '/_karma_webpack_';

  function initKarmaPathFix(config) {
    config.middleware = config.middleware || [];
    // Ensure our middleware runs after the Angular fallback middleware.
    config.middleware = config.middleware.filter((name) => name !== 'karma-path-fix');
    config.middleware.push('karma-path-fix');

    // Normalize Windows paths to use forward slashes so Karma generates valid URL paths
    // (otherwise URLs like `/absoluteC:\\...` get requested as `/absoluteC:/...` and 404).
    if (Array.isArray(config.files)) {
      for (let index = 0; index < config.files.length; index += 1) {
        const file = config.files[index];
        if (!file) {
          continue;
        }
        if (typeof file === 'string') {
          config.files[index] = file.replace(/\\/g, '/');
          continue;
        }
        if (typeof file.pattern === 'string') {
          file.pattern = file.pattern.replace(/\\/g, '/');
        }
      }
    }
  }
  initKarmaPathFix.$inject = ['config'];

  function karmaPathFixMiddleware() {
    return function karmaPathFixMiddlewareImpl(request, _response, next) {
      const url = request.url;
      if (typeof url === 'string' && url.startsWith(`${KARMA_WEBPACK_PREFIX}/`)) {
        const stripped = url.slice(KARMA_WEBPACK_PREFIX.length);
        if (stripped.startsWith('/base') || stripped.startsWith('/absolute')) {
          request.url = stripped;
        }
      }
      next();
    };
  }
  karmaPathFixMiddleware.$inject = [];

  return {
    'framework:karma-path-fix': ['factory', initKarmaPathFix],
    'middleware:karma-path-fix': ['factory', karmaPathFixMiddleware],
  };
})();

// Puppeteer 経由でインストールされた Chrome のパスを環境変数に設定
process.env.CHROME_BIN = puppeteer.executablePath();

module.exports = function (config) {
  config.set({
    basePath: '',
    frameworks: ['jasmine', '@angular-devkit/build-angular', 'karma-path-fix'],
    plugins: [
      require('karma-jasmine'),
      require('karma-chrome-launcher'),
      require('karma-jasmine-html-reporter'),
      require('karma-coverage'),
      angularCliKarmaPlugin,
      karmaPathFixPlugin,
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
