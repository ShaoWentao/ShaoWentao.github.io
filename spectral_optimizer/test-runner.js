'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const EXCLUDED_TESTS = new Set(['electron-integration.test.js']);

function discoverTests(directory) {
    return fs.readdirSync(directory, { withFileTypes: true })
        .filter(entry => entry.isFile() && entry.name.endsWith('.test.js') && !EXCLUDED_TESTS.has(entry.name))
        .map(entry => entry.name)
        .sort();
}

function runTests(directory = __dirname) {
    const files = discoverTests(directory);
    let passed = 0;
    for (const file of files) {
        console.log(`\n[TEST] ${file}`);
        const result = spawnSync(process.execPath, [path.join(directory, file)], {
            cwd: directory,
            env: process.env,
            stdio: 'inherit'
        });
        if (result.status !== 0) {
            console.error(`\nTest failed: ${file}`);
            return { passed, failed: file, total: files.length };
        }
        passed += 1;
    }
    return { passed, failed: null, total: files.length };
}

if (require.main === module) {
    const result = runTests();
    if (result.failed) process.exit(1);
    console.log(`\nAll ${result.total} test files passed.`);
}

module.exports = { discoverTests, runTests };
