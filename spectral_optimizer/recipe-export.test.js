'use strict';

const assert = require('node:assert/strict');
const api = require('./recipe-export.js');

const input = {
    exportedAt: '2026-07-31T08:00:00.000Z',
    source: 'test-source',
    buildInfo: {
        applicationVersion: '1.0.0',
        algorithmVersion: '2026.07-p2.1',
        recipeSchemaVersion: 2,
        dataVersions: { alphaOpic: 'CIE S 026:2018 1 nm' }
    },
    targets: { cctK: 4000, duv: 0 },
    result: { cctK: 4001, duv: 0.0001, ra: 95, r9: 80, rf: 92, rg: 103 },
    circadian: { cla2: 200, cs: 0.3 },
    melanopic: { der: 0.7, ediLux: 210 },
    channels: [{ id: 'red', drivePercent: 20 }],
    wavelengths: [380, 381],
    normalizedSpd: [0.2, 1]
};

const document = api.buildRecipeDocument(input);
assert.equal(document.format, 'spectral-optimizer-recipe');
assert.equal(document.version, 2);
assert.equal(document.exportedAt, input.exportedAt);
assert.deepEqual(document.build, input.buildInfo);
assert.deepEqual(document.spd.samples, [[380, 0.2], [381, 1]]);
assert.notEqual(document.channels, input.channels, 'channel data is copied');
assert.notEqual(document.build, input.buildInfo, 'build metadata is copied');
input.channels[0].drivePercent = 99;
assert.equal(document.channels[0].drivePercent, 20, 'later input mutation does not alter recipe');
assert.throws(() => api.buildRecipeDocument({ ...input, wavelengths: [380] }),
    /same length/, 'mismatched SPD arrays are rejected');

console.log('recipe export tests passed');
