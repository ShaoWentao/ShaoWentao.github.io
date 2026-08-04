'use strict';

const assert = require('node:assert/strict');

const pointCount = 401;
const thirds = [134, 267];
globalThis.CIE_SPECTRAL_DATA = {
    xBar: Array.from({ length: pointCount }, (_, index) => index < thirds[0] ? 1 : 0),
    yBar: Array.from({ length: pointCount }, (_, index) => index >= thirds[0] && index < thirds[1] ? 1 : 0),
    zBar: Array.from({ length: pointCount }, (_, index) => index >= thirds[1] ? 1 : 0)
};
globalThis.SpectralMath = {
    estimateCctAndDuvFromXy(x, y) {
        return { cct: 2000 + x * 4000 + y * 2000, duv: 0 };
    }
};
let qualityCalls = 0;
function syntheticQuality(values) {
    const red = values.slice(0, thirds[0]).reduce((sum, value) => sum + value, 0);
    const green = values.slice(thirds[0], thirds[1]).reduce((sum, value) => sum + value, 0);
    const blue = values.slice(thirds[1]).reduce((sum, value) => sum + value, 0);
    const preferredShape = values.slice(134, 180).reduce((sum, value) => sum + value, 0);
    const total = red + green + blue || 1;
    const shapeRatio = preferredShape / total;
    return {
        ra: 80 + 18 * green / total + 2 * shapeRatio,
        r9: 30 + 65 * red / total + 5 * shapeRatio,
        rf: 82 + 12 * green / total + 18 * shapeRatio,
        rg: 90 + 25 * red / total + 5 * shapeRatio
    };
}
globalThis.ColourQuality = {
    calculateColourQualityFromSpectrum({ values }) {
        qualityCalls += 1;
        return syntheticQuality(values);
    }
};
globalThis.CandidateShortlist = require('./candidate-shortlist.js');
globalThis.METAMER_OPTIMIZER = require('./metamer-optimizer.js');

const { optimizeScene, combineSpd, xyFromSpd } = require('./scene-optimizer-core.js');

function band(start, end) {
    return Array.from({ length: pointCount }, (_, index) => index >= start && index < end ? 1 : 0);
}
const channels3 = [
    { id: 'r', spd: band(0, thirds[0]) },
    { id: 'g', spd: band(thirds[0], thirds[1]) },
    { id: 'b', spd: band(thirds[1], pointCount) }
];
const reference = combineSpd(channels3, [20.4, 50.3, 29.3]);
const targetXy = xyFromSpd(reference);

const neutral = optimizeScene({
    channels: channels3,
    targetCct: 4000,
    targetDuv: 0,
    targetXy,
    referenceSpd: reference,
    skipColourQuality: true
});
assert.equal(neutral.values.length, 3);
assert.ok(neutral.error < 1e-5, `neutral fit error too high: ${neutral.error}`);
assert.ok(neutral.values.some(value => Math.abs(value - Math.round(value)) > 1e-4),
    'neutral fit must preserve fractional channel values');
assert.equal(neutral.qualityEvaluations, 0);

const offsetTarget = { x: 0.24, y: 0.52 };
const offset = optimizeScene({
    channels: channels3,
    targetCct: 4500,
    targetDuv: 0.004,
    targetXy: offsetTarget,
    skipColourQuality: true
});
assert.ok(offset.error < 0.03, `nonzero-Duv fit error too high: ${offset.error}`);

qualityCalls = 0;
const channels4 = channels3.concat([
    { id: 'r2', spd: band(30, 180) }
]);
const baseline4 = optimizeScene({
    channels: channels4,
    targetCct: 4000,
    targetDuv: 0,
    targetXy,
    referenceSpd: reference,
    skipColourQuality: true
});
const fidelity4 = optimizeScene({
    channels: channels4,
    targetCct: 4000,
    targetDuv: 0,
    targetXy,
    referenceSpd: reference,
    emphasis: '',
    maxGlobalSamples: 128,
    maxCandidates: 24
});
assert.ok(fidelity4.qualityEvaluations > 0,
    'four-channel scenes must use colour-quality optimisation');
const baseline4Quality = syntheticQuality(combineSpd(channels4, baseline4.values));
const fidelity4Quality = syntheticQuality(combineSpd(channels4, fidelity4.values));
assert.ok(fidelity4Quality.rf > baseline4Quality.rf + 0.05,
    `four-channel nullspace search must improve Rf: ${baseline4Quality.rf} -> ${fidelity4Quality.rf}`);
assert.ok(Number.isFinite(fidelity4.deltaUv) && fidelity4.deltaUv <= 0.0005,
    `four-channel colour-point tolerance was exceeded: ${fidelity4.deltaUv}`);

qualityCalls = 0;
const channels5 = channels4.concat([
    { id: 'b2', spd: band(220, 390) }
]);
const fidelity = optimizeScene({
    channels: channels5,
    targetCct: 4000,
    targetDuv: 0,
    targetXy,
    referenceSpd: reference,
    emphasis: '',
    maxGlobalSamples: 128,
    maxCandidates: 24
});
assert.ok(fidelity.qualityEvaluations > 0);
assert.ok(fidelity.qualityEvaluations <= 25,
    `quality shortlist exceeded cap: ${fidelity.qualityEvaluations}`);
assert.equal(fidelity.qualityEvaluations, qualityCalls);

console.log('scene optimizer core tests passed', {
    neutralError: neutral.error,
    offsetError: offset.error,
    fourChannelEvaluations: fidelity4.qualityEvaluations,
    qualityEvaluations: fidelity.qualityEvaluations
});
