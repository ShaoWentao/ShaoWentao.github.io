'use strict';

const assert = require('node:assert/strict');
const references = require('./validation-reference-data.js');

globalThis.window = {};
require('./spectral-data.js');
require('./default-rgbw-data.js');
const spectralData = globalThis.window.CIE_SPECTRAL_DATA;
const channels = globalThis.window.DEFAULT_RGBW_CHANNELS;
delete globalThis.window;

globalThis.CIE_COLOUR_QUALITY_DATA = require('./colour-quality-data.js');
globalThis.SpectralMath = require('./spectral-math.js');
const ColourQuality = require('./colour-quality.js');

function combine(values) {
    return Array.from({ length: 401 }, (_, index) => {
        const wavelength = 380 + index;
        return channels.reduce((sum, channel, channelIndex) => {
            const sample = channel.spdSamples[index];
            const power = sample && sample[0] === wavelength ? sample[1] : 0;
            return sum + power * values[channelIndex] / 100;
        }, 0);
    });
}

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

assert.equal(channels.length, 4, 'RGBW regression requires four channels');
assert.ok(channels.every(channel => channel.sourceName === 'RGBW.csv'),
    'regression channels must remain tied to the RGBW source');

for (const fixture of references.measuredRgbwRecipes) {
    const rawSpd = combine(fixture.values);
    const peak = Math.max(...rawSpd);
    const spd = rawSpd.map(value => peak > 0 ? value / peak : 0);
    const qualitySpd = spd.filter((value, index) => index % 5 === 0);
    const xy = xyFromSpd(spd);
    const quality = ColourQuality.calculateColourQuality(qualitySpd);
    const cctDuv = globalThis.SpectralMath.estimateCctAndDuvFromXy(xy.x, xy.y);

    close(xy.x, fixture.expected.x, fixture.tolerance.xy, `${fixture.id} x`);
    close(xy.y, fixture.expected.y, fixture.tolerance.xy, `${fixture.id} y`);
    close(cctDuv.cct, fixture.expected.cct, fixture.tolerance.cct, `${fixture.id} CCT`);
    close(cctDuv.duv, fixture.expected.duv, fixture.tolerance.duv, `${fixture.id} Duv`);
    close(quality.ra, fixture.expected.ra, fixture.tolerance.quality, `${fixture.id} Ra`);
    close(quality.r9, fixture.expected.r9, fixture.tolerance.quality, `${fixture.id} R9`);
    close(quality.rf, fixture.expected.rf, fixture.tolerance.quality, `${fixture.id} Rf`);
    close(quality.rg, fixture.expected.rg, fixture.tolerance.quality, `${fixture.id} Rg`);
}

console.log('RGBW regression tests passed');
