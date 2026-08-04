'use strict';

const assert = require('node:assert/strict');
const references = require('./validation-reference-data.js');

globalThis.window = {};
require('./spectral-data.js');
const spectralData = globalThis.window.CIE_SPECTRAL_DATA;
delete globalThis.window;

globalThis.CIE_COLOUR_QUALITY_DATA = require('./colour-quality-data.js');
globalThis.SpectralMath = require('./spectral-math.js');
const ColourQuality = require('./colour-quality.js');

function xyFromSpd(spd) {
    let X = 0;
    let Y = 0;
    let Z = 0;
    for (let index = 0; index < spd.length; index++) {
        X += spd[index] * spectralData.xBar[index];
        Y += spd[index] * spectralData.yBar[index];
        Z += spd[index] * spectralData.zBar[index];
    }
    const total = X + Y + Z;
    return { x: X / total, y: Y / total };
}

function close(actual, expected, tolerance, label) {
    assert.ok(Number.isFinite(actual), `${label} must be finite`);
    assert.ok(Math.abs(actual - expected) <= tolerance,
        `${label}: expected ${expected} ± ${tolerance}, got ${actual}`);
}

const d65 = Array.from(spectralData.d65);
const d65Xy = xyFromSpd(d65);
const d65Quality = ColourQuality.calculateColourQuality(d65.filter(function(value, index) { return index % 5 === 0; }));
close(d65Xy.x, references.standards.d65.x, references.standards.d65.xyTolerance, 'D65 x');
close(d65Xy.y, references.standards.d65.y, references.standards.d65.xyTolerance, 'D65 y');
close(d65Quality.ra, 100, references.standards.d65.qualityTolerance, 'D65 Ra');
close(d65Quality.r9, 100, references.standards.d65.qualityTolerance, 'D65 R9');
close(d65Quality.rf, 100, references.standards.d65.qualityTolerance, 'D65 Rf');
close(d65Quality.rg, 100, references.standards.d65.qualityTolerance, 'D65 Rg');

const wavelengths = Array.from({ length: 401 }, (_, index) => 380 + index);
const illuminantA = globalThis.SpectralMath.blackbodySpd(
    references.standards.illuminantA.temperatureK,
    wavelengths
);
const illuminantAXy = xyFromSpd(illuminantA);
const illuminantAQuality = ColourQuality.calculateColourQuality(Array.from({ length: 81 }, function(_, index) { return illuminantA[index * 5]; }));
close(illuminantAXy.x, references.standards.illuminantA.x,
    references.standards.illuminantA.xyTolerance, 'Illuminant A x');
close(illuminantAXy.y, references.standards.illuminantA.y,
    references.standards.illuminantA.xyTolerance, 'Illuminant A y');
close(illuminantAQuality.cct, references.standards.illuminantA.temperatureK,
    references.standards.illuminantA.estimatedCctTolerance, 'Illuminant A estimated CCT');
close(illuminantAQuality.ra, 100,
    references.standards.illuminantA.qualityTolerance, 'Illuminant A Ra');
close(illuminantAQuality.r9, 100,
    references.standards.illuminantA.r9Tolerance, 'Illuminant A R9');
close(illuminantAQuality.rf, 100,
    references.standards.illuminantA.qualityTolerance, 'Illuminant A Rf');
close(illuminantAQuality.rg, 100,
    references.standards.illuminantA.qualityTolerance, 'Illuminant A Rg');

console.log('standards validation tests passed');
