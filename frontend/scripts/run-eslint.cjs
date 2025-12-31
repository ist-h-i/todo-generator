#!/usr/bin/env node
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const args = process.argv.slice(2);
const eslintPackagePath = require.resolve('eslint/package.json');
const eslintBin = path.join(path.dirname(eslintPackagePath), 'bin', 'eslint.js');
const result = spawnSync(
  process.execPath,
  [eslintBin, ...args],
  {
    stdio: 'inherit',
    env: { ...process.env, ESLINT_USE_FLAT_CONFIG: 'true' },
  }
);

if (result.error) {
  console.error(result.error);
  process.exit(1);
}

process.exit(result.status ?? 0);
