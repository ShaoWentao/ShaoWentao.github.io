'use strict';

const assert = require('node:assert/strict');
const api = require('./batch-recipe-export.js');

assert.deepEqual(api.DEFAULT_BRIGHTNESS_LEVELS, [100, 75, 50, 25, 10, 5, 1],
    'brightness nodes must follow the agreed controller ladder');

const channels = [
    { id: 'red', nameCN: '红' },
    { id: 'warmwhite', nameCN: '暖白' }
];
const wavelengths = Array.from({ length: 401 }, (_, index) => 380 + index);
const baseNormalizedSpd = wavelengths.map(wavelength => wavelength === 550 ? 1 : 0.2);

const baseRecipe = {
    id: 'STD-4000',
    name: '常规 4000 K',
    mode: '常规',
    targets: { cctK: 4000, duv: 0, illuminanceLux: 300 },
    result: { cctK: 3992, duv: -0.0001, x: 0.381, y: 0.377 },
    metrics: {
        ra: 96,
        r9: 70,
        rf: 92,
        rg: 102,
        melanopicDer: 0.72,
        melanopicEdiLux: 216,
        cla2: 320,
        cs: 0.305
    },
    channelPercents: { red: 60, warmwhite: 80 },
    normalizedSpd: baseNormalizedSpd,
    fitDeltaUv: 0.0002,
    status: '完成',
    note: '',
    values: [60, 80]
};

const brightnessRecipe = {
    ...baseRecipe,
    id: 'STD-4000-B050',
    name: '常规 4000 K · 50%',
    baseRecipeId: 'STD-4000',
    spectralReferenceId: 'STD-4000-B050',
    brightnessPercent: 50,
    brightnessModel: '固定通道SPD同比例缩放',
    calibrationStatus: '未导入分级实测SPD',
    spectralScaleBasis: '基础配方100%峰值=1',
    brightnessSpd: baseNormalizedSpd.map(value => value * 0.5),
    targets: { ...baseRecipe.targets, illuminanceLux: 150 },
    metrics: { ...baseRecipe.metrics, melanopicEdiLux: 108, cla2: 190, cs: 0.21 },
    channelPercents: { red: 30, warmwhite: 40 },
    values: [30, 40]
};

const columns = api.buildBrightnessColumns(channels);
const headers = columns.map(column => column.header);
[
    '基础配方ID',
    '亮度_%',
    '亮度模型',
    '校准状态',
    '光谱引用ID',
    '红_%',
    '红_16bit',
    '暖白_%',
    '暖白_16bit'
].forEach(header => assert.ok(headers.includes(header), `missing brightness column ${header}`));

const row = api.buildBrightnessRow(brightnessRecipe, channels);
assert.equal(row.recipeId, 'STD-4000-B050');
assert.equal(row.baseRecipeId, 'STD-4000');
assert.equal(row.brightnessPercent, 50);
assert.equal(row.brightnessModel, '固定通道SPD同比例缩放');
assert.equal(row.calibrationStatus, '未导入分级实测SPD');
assert.equal(row.spectralReferenceId, 'STD-4000-B050');
const fallbackReferenceRow = api.buildBrightnessRow({ ...brightnessRecipe, spectralReferenceId: '' }, channels);
assert.equal(fallbackReferenceRow.spectralReferenceId, brightnessRecipe.id,
    'brightness spectrum must default to its own independent recipe ID');
assert.equal(row.targetIlluminanceLux, 150);
assert.equal(row.ch_red_percent, 30);
assert.equal(row.ch_red_uint16, 19661);
assert.equal(row.ch_warmwhite_percent, 40);
assert.equal(row.ch_warmwhite_uint16, 26214);
assert.equal(row.melanopicEdiLux, 108);

const brightnessSpectrumColumns = api.buildBrightnessSpectrumColumns(wavelengths);
assert.equal(brightnessSpectrumColumns.length, 86);
assert.ok(brightnessSpectrumColumns.some(column => column.header === '380nm'));
assert.ok(brightnessSpectrumColumns.some(column => column.header === '780nm'));
const brightnessSpectrumRows = api.buildBrightnessSpectrumRows([brightnessRecipe], wavelengths);
assert.equal(brightnessSpectrumRows.length, 1);
assert.equal(brightnessSpectrumRows[0].wl_550, 0.5);
assert.equal(brightnessSpectrumRows[0].spectralScaleBasis, '基础配方100%峰值=1');

const batch = api.buildBatchWorkbookSpec({
    channels,
    metadata: {
        exportedAt: '2026-08-02T04:00:00.000Z',
        source: 'fixture',
        brightnessLevels: api.DEFAULT_BRIGHTNESS_LEVELS,
        brightnessModel: '固定通道SPD同比例缩放'
    },
    regular: [baseRecipe],
    fidelity: [],
    saturation: [],
    pastel: [],
    scenes: [],
    brightness: [brightnessRecipe],
    wavelengths
});
assert.deepEqual(batch.sheets.map(sheet => sheet.name), [
    '说明', '常规', '高显色', '高饱和', '淡彩光', '情景模式', '亮度配方', '光谱数据', '亮度光谱'
]);
assert.equal(batch.sheets[6].rows.length, 1);
assert.equal(batch.sheets[7].rows.length, 81);
assert.equal(batch.sheets[8].rows.length, 1);
assert.equal(batch.sheets[8].rows[0].brightnessPercent, 50);
assert.equal(batch.sheets[8].rows[0].wl_550, 0.5);
assert.ok(batch.sheets[0].rows.some(item => item.item === '亮度节点_%' && item.value === '100, 75, 50, 25, 10, 5, 1'));
assert.ok(batch.sheets[0].rows.some(item => item.item === '亮度配方依据' && /未导入分级实测SPD/.test(item.value)));

const single = api.buildSingleWorkbookSpec({
    channels,
    metadata: {
        exportedAt: '2026-08-02T04:00:00.000Z',
        source: 'fixture',
        brightnessLevels: api.DEFAULT_BRIGHTNESS_LEVELS,
        brightnessModel: '固定通道SPD同比例缩放'
    },
    recipe: baseRecipe,
    brightness: [brightnessRecipe],
    wavelengths
});
assert.deepEqual(single.sheets.map(sheet => sheet.name), ['说明', '单点配方', '亮度配方', '光谱数据', '亮度光谱']);
assert.equal(single.sheets[2].rows.length, 1);
assert.equal(single.sheets[3].rows.length, 81);
assert.equal(single.sheets[4].rows.length, 1);

console.log('brightness recipe export tests passed', {
    levels: api.DEFAULT_BRIGHTNESS_LEVELS.length,
    batchSheets: batch.sheets.length,
    singleSheets: single.sheets.length
});
