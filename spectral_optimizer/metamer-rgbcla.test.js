const assert = require('node:assert/strict');

global.CIE_COLOUR_QUALITY_DATA = require('./colour-quality-data.js');
global.SpectralMath = require('./spectral-math.js');

const ColourQuality = require('./colour-quality.js');
const channels1nm = require('./default-rgbcla-data.js');
const { optimizeMetamer } = require('./metamer-optimizer.js');

const data = global.CIE_COLOUR_QUALITY_DATA;
const channels = channels1nm.map(channel => ({
    id: channel.id,
    spd: data.wavelengths.map(wavelength => channel.spd[wavelength - 380] || 0)
}));
const baselineValues = [30, 45, 55, 35, 30, 25];

function combine(values) {
    return data.wavelengths.map((_, sampleIndex) => channels.reduce((sum, channel, channelIndex) =>
        sum + channel.spd[sampleIndex] * values[channelIndex] / 100, 0));
}

function xyFromSpd(spd) {
    const xyz = [0, 0, 0];
    for (let index = 0; index < spd.length; index++) {
        xyz[0] += spd[index] * data.cmf2[0][index];
        xyz[1] += spd[index] * data.cmf2[1][index];
        xyz[2] += spd[index] * data.cmf2[2][index];
    }
    const sum = xyz[0] + xyz[1] + xyz[2];
    return { x: xyz[0] / sum, y: xyz[1] / sum };
}

function evaluateSpd(spd) {
    const quality = ColourQuality.calculateColourQuality(Array.from(spd));
    return { ...quality, xy: xyFromSpd(spd) };
}

const baselineSpd = combine(baselineValues);
const baselineMetrics = evaluateSpd(baselineSpd);
const result = optimizeMetamer({
    channels,
    baselineValues,
    targetXy: baselineMetrics.xy,
    targetRg: 120,
    objective: 'saturation',
    evaluateSpd,
    xyToUv: global.SpectralMath.xyToUv
});

assert.equal(result.feasible, true, 'RGBCLA high-saturation search returns a feasible result');
assert.ok(result.deltaUv <= 0.0005, `RGBCLA colour point drifted by ${result.deltaUv}`);
assert.ok(result.achievedRg >= baselineMetrics.rg,
    `RGBCLA high-saturation Rg ${result.achievedRg} fell below baseline ${baselineMetrics.rg}`);
assert.ok(result.achievedRg <= 120, `RGBCLA high-saturation exceeded the Rg 120 cap: ${result.achievedRg}`);

console.log(`RGBCLA metamer test passed: Rg ${baselineMetrics.rg.toFixed(1)} -> ${result.achievedRg.toFixed(1)}, Rf ${result.achievedRf.toFixed(1)}`);
