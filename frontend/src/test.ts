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
    filter?: RegExp
  ): {
    keys(): string[];
    <T>(id: string): T;
  };
};

// First, initialize the Angular testing environment.
const testBed = getTestBed();

// Initialize the Angular testing environment
function initializeTestEnvironment() {
  try {
    testBed.initTestEnvironment(
      BrowserDynamicTestingModule,
      platformBrowserDynamicTesting(),
      {
        teardown: { destroyAfterEach: true },
        errorOnUnknownElements: true,
        errorOnUnknownProperties: true
      }
    );
    console.log('Test environment initialized successfully');
    return true;
  } catch (error) {
    console.error('Error initializing test environment:', error);
    return false;
  }
}

// Load all test files
function loadTestFiles() {
  try {
    // Find all test files using Webpack's require.context
    const context = require.context(
      './',           // Start from the src directory
      true,           // Look in all subdirectories
      /\.spec\.ts$/  // Find all .spec.ts files
    );
    
    // Load each test file
    context.keys().map(context);
    console.log('Test files loaded successfully');
    return true;
  } catch (error) {
    console.error('Error loading test files:', error);
    return false;
  }
}

// Initialize the test environment and load test files
const initSuccess = initializeTestEnvironment();
if (initSuccess) {
  loadTestFiles();
} else {
  console.error('Test setup failed');
  // Use window.alert for better error visibility in browser
  if (typeof window !== 'undefined') {
    window.alert('Test setup failed. Check console for details.');
  }
}
