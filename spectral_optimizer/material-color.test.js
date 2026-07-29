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
    assert.equal(results.length, 7, `${label}: all material models must be evaluated`);
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

console.log('material-color tests passed');
