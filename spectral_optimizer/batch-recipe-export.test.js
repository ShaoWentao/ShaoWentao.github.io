'use strict';

const assert = require('node:assert/strict');
const api = require('./batch-recipe-export.js');

assert.deepEqual(api.buildCctRange(1600, 1800, 100), [1600, 1700, 1800]);
const fullRange = api.buildCctRange();
assert.equal(fullRange.length, 105);
assert.equal(fullRange[0], 1600);
assert.equal(fullRange.at(-1), 12000);
assert.throws(() => api.buildCctRange(1800, 1600, 100), /range/i);
assert.throws(() => api.buildCctRange(1600, 1800, 0), /step/i);

assert.equal(api.percentToUint16(-10), 0);
assert.equal(api.percentToUint16(0), 0);
assert.equal(api.percentToUint16(50), 32768);
assert.equal(api.percentToUint16(100), 65535);
assert.equal(api.percentToUint16(120), 65535);
assert.equal(api.percentToUint16(NaN), 0);

const channels = [
    { id: 'red', name: 'R', waveLabel: '630 nm' },
    { id: 'warm white', name: '暖白', waveLabel: '3000 K' }
];
const columns = api.buildRecipeColumns(channels);
const headers = columns.map(column => column.header);
assert.ok(headers.includes('R_%'));
assert.ok(headers.includes('R_16bit'));
assert.ok(headers.includes('暖白_%'));
assert.ok(headers.includes('暖白_16bit'));
assert.equal(columns.filter(column => /_%$/.test(column.header)).length, 2);
assert.equal(columns.filter(column => /_16bit$/.test(column.header)).length, 2);
assert.ok(headers.includes('u_prime_1976'));
assert.ok(headers.includes('v_prime_1976'));

const wavelengths = Array.from({ length: 401 }, (_, index) => 380 + index);
const normalizedSpd = wavelengths.map(wavelength => wavelength === 550 ? 1 : 0.25);
function recipe(id, mode, channelPercents) {
    return {
        id,
        name: id,
        mode,
        targets: {
            cctK: 4000,
            duv: 0,
            illuminanceLux: 300,
            startTime: '09:00',
            transitionMinutes: 30
        },
        result: { cctK: 3989, duv: -0.0002, x: 0.3809, y: 0.3765, up: 0.2255, vp: 0.5016 },
        metrics: {
            ra: 96.2,
            r9: 67.4,
            rf: 92.1,
            rg: 101.3,
            melanopicDer: 0.72,
            melanopicEdiLux: 216,
            cla2: 320,
            cs: 0.305
        },
        channelPercents,
        normalizedSpd,
        fitDeltaUv: 0.0003,
        status: '完成',
        note: ''
    };
}

const row = api.buildRecipeRow(recipe('STD-4000', '常规', { red: 50, 'warm white': 100 }), channels);
assert.equal(row.recipeId, 'STD-4000');
assert.equal(row.targetCctK, 4000);
assert.equal(row.actualCctK, 3989);
assert.equal(row.ch_red_percent, 50);
assert.equal(row.ch_red_uint16, 32768);
assert.equal(row.ch_warm_white_percent, 100);
assert.equal(row.ch_warm_white_uint16, 65535);
assert.equal(row.cctErrorK, -11);
assert.equal(row.duvError, -0.0002);
assert.equal(row.up1976, 0.2255);
assert.equal(row.vp1976, 0.5016);
const blankTargetRow = api.buildRecipeRow({
    id: 'P01',
    name: 'P01',
    mode: '淡彩光',
    targets: { cctK: null, duv: null },
    result: { cctK: 5000, duv: 0.001 },
    channelPercents: { red: 0, 'warm white': 0 }
}, channels);
assert.equal(blankTargetRow.targetCctK, '');
assert.equal(blankTargetRow.targetDuv, '');
assert.equal(blankTargetRow.cctErrorK, '');
assert.equal(blankTargetRow.duvError, '');

const regular = [recipe('STD-1600', '常规', { red: 10, 'warm white': 90 })];
const fidelity = [recipe('FID-1600', '高显色', { red: 20, 'warm white': 80 })];
const saturation = [recipe('SAT-1600', '高饱和', { red: 30, 'warm white': 70 })];
const pastel = [recipe('P01', '淡彩光', { red: 40, 'warm white': 60 })];
const scenes = [recipe('SCENE-MORNING', '情景模式', { red: 50, 'warm white': 50 })];
const allRecipes = [...regular, ...fidelity, ...saturation, ...pastel, ...scenes];

const spectrumRows = api.buildSpectrumRows(allRecipes, wavelengths);
assert.equal(spectrumRows.length, allRecipes.length * 81);
assert.equal(spectrumRows[0].wavelengthNm, 380);
assert.equal(spectrumRows[80].wavelengthNm, 780);
assert.equal(spectrumRows[0].recipeId, 'STD-1600');
assert.equal(spectrumRows[80].relativePower, 0.25);

const batchSpec = api.buildBatchWorkbookSpec({
    channels,
    metadata: {
        exportedAt: '2026-08-01T14:00:00.000Z',
        source: '6-channel built-in model',
        cctRange: '1600–12000 K',
        cctStepK: 100,
        targetRg: 120
    },
    regular,
    fidelity,
    saturation,
    pastel,
    scenes,
    brightness: [],
    wavelengths
});
assert.deepEqual(batchSpec.sheets.map(sheet => sheet.name), [
    '说明', '常规', '高显色', '高饱和', '淡彩光', '情景模式', '亮度配方', '光谱数据', '亮度光谱'
]);
assert.equal(batchSpec.sheets[1].rows.length, 1);
assert.equal(batchSpec.sheets[6].rows.length, 0);
assert.equal(batchSpec.sheets[7].rows.length, allRecipes.length * 81);
assert.equal(batchSpec.sheets[8].rows.length, 0);
assert.equal(batchSpec.sheets[1].freezeRows, 1);
assert.equal(batchSpec.sheets[1].autoFilter, true);

const singleSpec = api.buildSingleWorkbookSpec({
    channels,
    metadata: { exportedAt: '2026-08-01T14:00:00.000Z', source: 'fixture' },
    recipe: regular[0],
    brightness: [],
    wavelengths
});
assert.deepEqual(singleSpec.sheets.map(sheet => sheet.name), ['说明', '单点配方', '亮度配方', '光谱数据', '亮度光谱']);
assert.equal(singleSpec.sheets[1].rows.length, 1);
assert.equal(singleSpec.sheets[2].rows.length, 0);
assert.equal(singleSpec.sheets[3].rows.length, 81);
assert.equal(singleSpec.sheets[4].rows.length, 0);

console.log('batch recipe export model tests passed', {
    cctCount: fullRange.length,
    recipeColumns: columns.length,
    batchSheets: batchSpec.sheets.length,
    spectrumRows: batchSpec.sheets[7].rows.length
});
