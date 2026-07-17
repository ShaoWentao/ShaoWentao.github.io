const assert = require('node:assert/strict');

globalThis.window = {};
require('./spectral-data.js');
const cieData = globalThis.window.CIE_SPECTRAL_DATA;
delete globalThis.window;

const {
    blackbodySpd,
    blackbodyXy,
    estimateCctAndDuvFromXy,
    targetXyFromCctDuv,
    normalizeImportedChannels,
    xyzToDisplaySrgb
} = require('./spectral-math.js');

function close(actual, expected, tolerance, label) {
    assert.ok(Math.abs(actual - expected) <= tolerance,
        `${label}: expected ${expected} +/- ${tolerance}, got ${actual}`);
}

const referenceMinNm = 380;
const referenceMaxNm = 780;
const referenceStart = (referenceMinNm - cieData.lambdaMin) / cieData.step;
const referenceLength = (referenceMaxNm - referenceMinNm) / cieData.step + 1;
const cieWavelengths = Float64Array.from(
    { length: referenceLength },
    (_, index) => referenceMinNm + index * cieData.step
);
const cieXBar = cieData.xBar.slice(referenceStart, referenceStart + referenceLength);
const cieYBar = cieData.yBar.slice(referenceStart, referenceStart + referenceLength);
const cieZBar = cieData.zBar.slice(referenceStart, referenceStart + referenceLength);

// Expected xy values are numerical integration references over exactly
// 380-780 nm (inclusive, 1 nm), using the CIE 1931 2 degree observer data
// (CIE dataset DOI 10.25039/CIE.DS.xvudnb9b) and CODATA 2022 c2 = hc/k.
const blackbodyReferences = [
    { temperature: 1000, x: 0.652722149395, y: 0.344489234044 },
    { temperature: 1600, x: 0.573222467311, y: 0.399270433328 },
    { temperature: 6500, x: 0.313551672187, y: 0.323688856154 },
    { temperature: 12000, x: 0.271819139843, y: 0.277663178319 },
    { temperature: 20000, x: 0.256495769162, y: 0.257750514027 }
];

for (const reference of blackbodyReferences) {
    const spd = blackbodySpd(reference.temperature, cieWavelengths);
    assert.equal(spd.length, cieWavelengths.length, `${reference.temperature} K SPD length`);
    assert.ok(spd.every(value => Number.isFinite(value) && value >= 0),
        `${reference.temperature} K SPD is finite and non-negative`);
    close(Math.max(...spd), 1, 1e-12, `${reference.temperature} K SPD peak`);

    const xy = blackbodyXy(
        reference.temperature,
        cieWavelengths,
        cieXBar,
        cieYBar,
        cieZBar
    );
    close(xy.x, reference.x, 1e-9, `${reference.temperature} K x`);
    close(xy.y, reference.y, 1e-9, `${reference.temperature} K y`);
}

for (const invalidTemperature of [0, -1, NaN, Infinity, '6500']) {
    const spd = blackbodySpd(invalidTemperature, [380, 500, 780]);
    assert.deepEqual(spd, [0, 0, 0], `safe SPD for temperature ${invalidTemperature}`);
    assert.deepEqual(
        blackbodyXy(invalidTemperature, [380, 500, 780], [1, 1, 1], [1, 1, 1], [1, 1, 1]),
        { x: 0, y: 0 },
        `safe xy for temperature ${invalidTemperature}`
    );
}

assert.deepEqual(blackbodySpd(6500, null), [], 'safe SPD for missing wavelengths');
assert.deepEqual(blackbodySpd(6500, [380, NaN, 780]), [0, 0, 0], 'safe SPD for malformed wavelengths');
const fakeArrayLike = { 0: 380, 1: 500, 2: 780, length: 3 };
const fakeHugeArrayLike = { length: Number.MAX_SAFE_INTEGER };
assert.deepEqual(blackbodySpd(6500, fakeArrayLike), [], 'safe SPD for array-like wavelengths');
assert.deepEqual(blackbodySpd(6500, fakeHugeArrayLike), [], 'safe SPD for huge array-like wavelengths');
assert.deepEqual(
    blackbodyXy(6500, fakeHugeArrayLike, fakeHugeArrayLike, fakeHugeArrayLike, fakeHugeArrayLike),
    { x: 0, y: 0 },
    'safe xy for huge array-like inputs'
);

for (const malformed of [
    [[380, 500], [1], [1, 1], [1, 1]],
    [[380, 500], [1, 1], [1, 1], [1]],
    [[380, 500], [1, NaN], [1, 1], [1, 1]],
    [[500, 380], [1, 1], [1, 1], [1, 1]],
    [null, null, null, null]
]) {
    assert.deepEqual(blackbodyXy(6500, ...malformed), { x: 0, y: 0 }, 'safe xy for malformed arrays');
}

const d65 = estimateCctAndDuvFromXy(0.31271, 0.32902);
close(d65.cct, 6504, 20, 'D65 CCT');
close(d65.duv, 0.0032, 0.0007, 'D65 Duv');

const warm = estimateCctAndDuvFromXy(0.5269, 0.4133);
close(warm.cct, 2000, 35, '2000 K CCT');

for (const requestedDuv of [-0.006, 0, 0.006]) {
    const target = targetXyFromCctDuv(4000, requestedDuv);
    const recovered = estimateCctAndDuvFromXy(target.x, target.y);
    close(recovered.cct, 4000, 12, `round-trip CCT at Duv ${requestedDuv}`);
    close(recovered.duv, requestedDuv, 0.00015, `round-trip Duv ${requestedDuv}`);
}

const samples = [
    [[380, 0], [500, 10], [780, 0]],
    [[380, 0], [500, 2], [780, 0]]
];
const preserved = normalizeImportedChannels(samples, true);
close(preserved[0][1][1] / preserved[1][1][1], 5, 1e-12, 'relative channel power');
const shapes = normalizeImportedChannels(samples, false);
close(shapes[0][1][1], 1, 1e-12, 'shape channel 1 peak');
close(shapes[1][1][1], 1, 1e-12, 'shape channel 2 peak');

assert.equal(typeof xyzToDisplaySrgb, 'function', 'XYZ to sRGB converter is exported');
const black = xyzToDisplaySrgb(0, 0, 0);
assert.deepEqual(black, { r: 0, g: 0, b: 0, css: 'rgb(0, 0, 0)' });

const d65White = xyzToDisplaySrgb(0.95047, 1, 1.08883);
close(d65White.r, 255, 1, 'D65 white red');
close(d65White.g, 255, 1, 'D65 white green');
close(d65White.b, 255, 1, 'D65 white blue');

const clipped = xyzToDisplaySrgb(2.5, 0.2, 0.01);
for (const component of ['r', 'g', 'b']) {
    assert.ok(Number.isInteger(clipped[component]), `${component} is an integer`);
    assert.ok(clipped[component] >= 0 && clipped[component] <= 255, `${component} is display-gamut clipped`);
}

console.log('spectral-math tests passed');
