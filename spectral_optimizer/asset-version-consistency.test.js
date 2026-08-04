'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const localAssets = Array.from(html.matchAll(/<(?:script|link)\b[^>]*(?:src|href)="([^"#]+\.(?:js|css)(?:\?[^"#]*)?)"/g),
    match => match[1]);

assert.ok(localAssets.length >= 20, 'index must expose the expected local CSS and JavaScript assets');

const versions = localAssets.map(asset => {
    const query = asset.split('?')[1] || '';
    const version = new URLSearchParams(query).get('v');
    return { asset, version };
});

assert.ok(versions.every(item => item.version),
    `every local asset must have a cache version: ${versions.filter(item => !item.version).map(item => item.asset).join(', ')}`);

const uniqueVersions = new Set(versions.map(item => item.version));
assert.equal(uniqueVersions.size, 1,
    `all local assets must use one release version, found: ${Array.from(uniqueVersions).join(', ')}`);

console.log(`asset version consistency tests passed: ${versions[0].version}`);
