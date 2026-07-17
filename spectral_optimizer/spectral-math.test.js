const assert = require('node:assert/strict');
const {
    estimateCctAndDuvFromXy,
    targetXyFromCctDuv,
    normalizeImportedChannels
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

console.log('spectral-math tests passed');
