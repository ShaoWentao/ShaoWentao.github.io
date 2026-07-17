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

const cieWavelengths = Float64Array.from(
    { length: cieData.xBar.length },
    (_, index) => cieData.lambdaMin + index * cieData.step
);

// Full 360-830 nm integrations use the CIE 1931 2 degree observer
// (DOI 10.25039/CIE.DS.xvudnb9b) and CODATA 2022 c2 = hc/k.
const blackbodyReferences = [
    { temperature: 1000, x: 0.652725233, y: 0.344486434 },
    { temperature: 1600, x: 0.573225692, y: 0.399268627 },
    { temperature: 6500, x: 0.313526940, y: 0.323629970 },
    { temperature: 12000, x: 0.271784176, y: 0.277564091 },
    { temperature: 20000, x: 0.256457314, y: 0.257631320 }
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
        cieData.xBar,
        cieData.yBar,
        cieData.zBar
    );
    close(xy.x, reference.x, 1.5e-4, `${reference.temperature} K x`);
    close(xy.y, reference.y, 1.5e-4, `${reference.temperature} K y`);
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
