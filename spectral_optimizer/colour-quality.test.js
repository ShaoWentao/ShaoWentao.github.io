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

const reference = calculateColourQuality(globalThis.CIE_COLOUR_QUALITY_DATA.d65);
close(reference.ra, 100, 0.1, 'D65 Ra');
close(reference.rf, 100, 0.1, 'D65 Rf');
close(reference.rg, 100, 0.1, 'D65 Rg');

assert.deepEqual(calculateColourQuality(Array(81).fill(0)),
    { ra: 0, r9: 0, rf: 0, rg: 0, cct: 0 },
    'zero-output optimizer candidates must be rejected without throwing');

console.log('colour-quality tests passed');
