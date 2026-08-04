const assert = require('node:assert/strict');

globalThis.CIE_COLOUR_QUALITY_DATA = require('./colour-quality-data.js');
globalThis.SpectralMath = require('./spectral-math.js');
globalThis.MATERIAL_REFLECTANCE_DATA = require('./material-reflectance-data.js');
const MaterialColor = require('./material-color.js');

function nearZero(value, tolerance, label) {
    assert.ok(Math.abs(value) <= tolerance, `${label}: expected near zero, got ${value}`);
}

function assertReferenceMatch(spd, cct, options, label) {
    const results = MaterialColor.calculateAllMaterials(spd, { cct, ...options });
    assert.equal(
        results.length,
        globalThis.MATERIAL_REFLECTANCE_DATA.listMaterials().length,
        `${label}: all material models must be evaluated`
    );
    for (const result of results) {
        nearZero(result.deltaL, 1e-8, `${label} ${result.materialId} deltaL`);
        nearZero(result.deltaC, 1e-8, `${label} ${result.materialId} deltaC`);
        nearZero(result.deltaH, 1e-8, `${label} ${result.materialId} deltaH`);
        nearZero(result.deltaE00, 1e-8, `${label} ${result.materialId} deltaE00`);
    }
}

const wavelengths = globalThis.CIE_COLOUR_QUALITY_DATA.wavelengths;
const blackbody3000 = globalThis.SpectralMath.blackbodySpd(3000, wavelengths);
assertReferenceMatch(blackbody3000, 3000, { referenceMode: 'auto' }, '3000 K blackbody');

const daylight6500 = MaterialColor.referenceSpd(6500, { referenceMode: 'auto' });
assertReferenceMatch(daylight6500, 6500, { referenceMode: 'auto' }, '6500 K daylight');

const d65 = globalThis.CIE_COLOUR_QUALITY_DATA.d65;
assertReferenceMatch(d65, 6504, { referenceMode: 'd65' }, 'D65');

const scaled = blackbody3000.map(value => value * 37);
const baseResult = MaterialColor.calculateMaterialDelta(blackbody3000, {
    materialId: 'wood_warm_oak',
    cct: 3000
});
const scaledResult = MaterialColor.calculateMaterialDelta(scaled, {
    materialId: 'wood_warm_oak',
    cct: 3000
});
nearZero(baseResult.deltaE00 - scaledResult.deltaE00, 1e-10, 'photometric normalization');

const narrowPeak = new Array(401).fill(0);
narrowPeak[454 - 380] = 1;
const resampledPeak = MaterialColor.resampleSpd(narrowPeak);
assert.ok(resampledPeak[wavelengths.indexOf(455)] > 0.15,
    'a 454 nm narrow peak must contribute to the 455 nm material band');
assert.ok(resampledPeak[wavelengths.indexOf(455)] < 0.25,
    'the 5 nm band value must represent averaged energy rather than the raw peak height');

assert.throws(
    () => MaterialColor.calculateMaterialDelta(new Array(81).fill(0), { materialId: 'wood_warm_oak', cct: 3000 }),
    /positive photopic power/,
    'zero-power SPDs must not produce silent zero/NaN material results'
);

const reference4999 = MaterialColor.normalizeToY(MaterialColor.referenceSpd(4999, { referenceMode: 'auto' }), 1);
const reference5000 = MaterialColor.normalizeToY(MaterialColor.referenceSpd(5000, { referenceMode: 'auto' }), 1);
const transitionDistance = reference4999.reduce((sum, value, index) => sum + Math.abs(value - reference5000[index]), 0);
assert.ok(transitionDistance < 2, 'blackbody/daylight reference transition must remain continuous');

console.log('material-color tests passed');
