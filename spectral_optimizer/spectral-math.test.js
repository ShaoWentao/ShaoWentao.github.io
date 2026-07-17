const assert = require('node:assert/strict');
const {
    estimateCctAndDuvFromXy,
    targetXyFromCctDuv,
    normalizeImportedChannels,
    xyzToDisplaySrgb
} = require('./spectral-math.js');

function close(actual, expected, tolerance, label) {
    assert.ok(Math.abs(actual - expected) <= tolerance,
        `${label}: expected ${expected} +/- ${tolerance}, got ${actual}`);
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
