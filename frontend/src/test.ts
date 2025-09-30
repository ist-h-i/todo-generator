// This file is required by karma.conf.js and loads recursively all the .spec and framework files

import 'zone.js/testing';
import { getTestBed } from '@angular/core/testing';
import {
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting,
} from '@angular/platform-browser-dynamic/testing';

declare const require: {
  context(
    path: string,
    deep?: boolean,
    filter?: RegExp,
  ): {
    keys(): string[];
    <T>(id: string): T;
  };
};

// First, initialize the Angular testing environment.
const testBed = getTestBed();

type KarmaReporter = {
  info?: (message: string) => void;
  error?: (message: string) => void;
};

const karmaReporter: KarmaReporter | undefined = (globalThis as { __karma__?: KarmaReporter })
  .__karma__;

function reportTestIssue(message: string, error?: unknown) {
  if (karmaReporter?.error) {
    const detailedMessage =
      error instanceof Error
        ? `${message}: ${error.message}`
        : error
          ? `${message}: ${String(error)}`
          : message;
    karmaReporter.error(detailedMessage);
  }
}

// Initialize the Angular testing environment
function initializeTestEnvironment() {
  try {
    testBed.initTestEnvironment(BrowserDynamicTestingModule, platformBrowserDynamicTesting(), {
      teardown: { destroyAfterEach: true },
      errorOnUnknownElements: true,
      errorOnUnknownProperties: true,
    });
    return true;
  } catch (error) {
    reportTestIssue('Error initializing test environment', error);
    return false;
  }
}

// Load all test files
function loadTestFiles() {
  try {
    // Find all test files using Webpack's require.context
    const context = require.context(
      './', // Start from the src directory
      true, // Look in all subdirectories
      /\.spec\.ts$/, // Find all .spec.ts files
    );

    // Load each test file
    context.keys().map(context);
    return true;
  } catch (error) {
    reportTestIssue('Error loading test files', error);
    return false;
  }
}

// Initialize the test environment and load test files
const initSuccess = initializeTestEnvironment();
if (initSuccess) {
  loadTestFiles();
} else {
  reportTestIssue('Test setup failed');
  // Use window.alert for better error visibility in browser
  if (typeof window !== 'undefined') {
    window.alert('Test setup failed. Check Karma logs for details.');
  }
}
