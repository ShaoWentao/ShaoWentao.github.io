'use strict';

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
    return Array.from({ length: 401 }, (_, index) => channels.reduce((sum, channel, channelIndex) => {
        const sample = channel.spdSamples[index];
        return sum + (sample ? sample[1] : 0) * values[channelIndex] / 100;
    }, 0));
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

const recipes = [
    ['warm-white-only', [0, 0, 0, 100]],
    ['balanced-rgbw', [20, 35, 15, 100]],
    ['vivid-rgbw', [65, 40, 30, 50]]
];

for (const [id, values] of recipes) {
    const rawSpd = combine(values);
    const peak = Math.max(...rawSpd);
    const spd = rawSpd.map(value => peak > 0 ? value / peak : 0);
    const xy = xyFromSpd(spd);
    const qualitySpd = spd.filter((_, index) => index % 5 === 0);
    const quality = ColourQuality.calculateColourQuality(qualitySpd);
    const cctDuv = globalThis.SpectralMath.estimateCctAndDuvFromXy(xy.x, xy.y);
    console.log(JSON.stringify({
        id,
        values,
        expected: {
            x: xy.x,
            y: xy.y,
            cct: cctDuv.cct,
            duv: cctDuv.duv,
            ra: quality.ra,
            r9: quality.r9,
            rf: quality.rf,
            rg: quality.rg
        }
    }));
}

const standardWavelengths = Array.from({ length: 401 }, (_, index) => 380 + index);
for (const temperatureK of [2855.54, 2856]) {
    const spd = globalThis.SpectralMath.blackbodySpd(temperatureK, standardWavelengths);
    const quality = ColourQuality.calculateColourQuality(spd.filter((_, index) => index % 5 === 0));
    console.log(JSON.stringify({ id: `planckian-${temperatureK}`, quality }));
}
