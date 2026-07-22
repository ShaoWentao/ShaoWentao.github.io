const assert = require('node:assert/strict');
globalThis.CIE_COLOUR_QUALITY_DATA = require('./colour-quality-data.js');
globalThis.SpectralMath = require('./spectral-math.js');
const { calculateColourQuality } = require('./colour-quality.js');

function close(actual, expected, tolerance, label) {
    assert.ok(Math.abs(actual - expected) <= tolerance,
        `${label}: expected ${expected} +/- ${tolerance}, got ${actual}`);
}

const wavelengths = Array.from({ length: 81 }, (_, index) => 380 + index * 5);
const synthetic = wavelengths.map(wavelength =>
    0.8 * Math.exp(-0.5 * ((wavelength - 450) / 18) ** 2) +
    0.9 * Math.exp(-0.5 * ((wavelength - 535) / 32) ** 2) +
    0.7 * Math.exp(-0.5 * ((wavelength - 620) / 22) ** 2));

const result = calculateColourQuality(synthetic);
close(result.ra, 88.7416, 0.15, 'CIE Ra');
close(result.rf, 90.4071, 0.15, 'TM-30 Rf');
close(result.rg, 99.1767, 0.2, 'TM-30 Rg');
assert.equal(result.ri.length, 14, 'CRI must expose all R1-R14 values');
assert.equal(result.vector.length, 16, 'TM-30 must expose 16 hue-bin vectors');
assert.ok(result.vector.every(point => Number.isFinite(point.x) && Number.isFinite(point.y)));

const reference = calculateColourQuality(globalThis.CIE_COLOUR_QUALITY_DATA.d65);
close(reference.ra, 100, 0.1, 'D65 Ra');
close(reference.rf, 100, 0.1, 'D65 Rf');
close(reference.rg, 100, 0.1, 'D65 Rg');

assert.deepEqual(calculateColourQuality(Array(81).fill(0)),
    { ra: 0, r9: 0, rf: 0, rg: 0, cct: 0 },
    'zero-output optimizer candidates must be rejected without throwing');

const { calculateSampleColors } = require('./colour-quality.js');
assert.ok(typeof calculateSampleColors === 'function', 'calculateSampleColors must be exported');
const colors = calculateSampleColors(synthetic);
assert.ok(colors.tcs14 && colors.tcs14.length === 14, 'Must return 14 TCS samples');
assert.ok(colors.cesSubset && colors.cesSubset.length >= 15, 'Must return a representative subset of CES samples');
assert.ok(colors.tcs14[0].refRGB.length === 3, 'refRGB must be [r, g, b]');
assert.ok(colors.tcs14[0].testRGB.length === 3, 'testRGB must be [r, g, b]');
assert.deepEqual(colors.cesSubset.map(sample => sample.id),
    ['CES04', 'CES10', 'CES16', 'CES22', 'CES28', 'CES35', 'CES41', 'CES47',
        'CES53', 'CES59', 'CES65', 'CES72', 'CES78', 'CES84', 'CES90', 'CES96'],
    'the selected CES samples retain their real source identifiers');

// Very basic sanity check for values
const r = colors.tcs14[0].refRGB[0];
assert.ok(r >= 0 && r <= 255, 'RGB values must be bounded [0, 255]');

const d65Colors = calculateSampleColors(globalThis.CIE_COLOUR_QUALITY_DATA.d65);
assert.deepEqual(d65Colors.tcs14.map(sample => sample.testRGB),
    d65Colors.tcs14.map(sample => sample.refRGB),
    'a D65 test spectrum renders identically to its matching reference');

const emptyColors = calculateSampleColors(new Array(81).fill(0));
assert.equal(emptyColors.tcs14.length, 14, 'reference TCS samples remain visible without an active spectrum');
assert.equal(emptyColors.cesSubset.length, 16, 'reference CES samples remain visible without an active spectrum');
assert.ok(emptyColors.tcs14.every(sample => sample.testRGB === null && sample.testAvailable === false));
assert.ok(emptyColors.tcs14.every(sample => Array.isArray(sample.refRGB) && sample.refRGB.length === 3));

console.log('colour-quality tests passed');
