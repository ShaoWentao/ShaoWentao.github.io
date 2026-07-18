const assert = require('node:assert/strict');
const {
    optimizeMetamer,
    resolveComparisonBaseline,
    getBaselineTargetXy,
    deltaUvBetween,
    formatRoundedMetricDelta,
    isBetterColourCandidate
} = require('./metamer-optimizer.js');

const targetXy = { x: 0.3127, y: 0.3290 };
const channels = [
    { id: 'red', spd: [1, 0, 0] },
    { id: 'green', spd: [0, 1, 0] },
    { id: 'blue', spd: [0, 0, 1] }
];
const baselineValues = [50, 50, 50];

function evaluateSpd(spd) {
    const redMinusBlue = spd[0] - spd[2];
    return {
        x: targetXy.x + redMinusBlue * 0.001,
        y: targetXy.y,
        rg: 100 + redMinusBlue * 20,
        rf: 95 - Math.abs(redMinusBlue) * 20
    };
}

function xyToUv(x, y) {
    const denominator = -2 * x + 12 * y + 3;
    return { u: (4 * x) / denominator, v: (6 * y) / denominator };
}

function optimize(targetRg) {
    return optimizeMetamer({
        channels,
        baselineValues,
        targetXy,
        targetRg,
        evaluateSpd,
        xyToUv
    });
}

const first = optimize(110);
const second = optimize(110);
assert.deepEqual(first, second, 'identical inputs produce identical outputs');
assert.ok(first.deltaUv <= 0.002, `accepted delta u\'v\' was ${first.deltaUv}`);
assert.ok(first.achievedRf >= 80, `Rf floor was violated: ${first.achievedRf}`);
assert.equal(first.exact, true, 'reachable target is marked exact');
assert.equal(first.achievedRg, 110, 'reachable target Rg is achieved');

const fidelityLimited = optimize(120);
assert.ok(fidelityLimited.achievedRf >= 80,
    `Rf floor was violated while pursuing target: ${fidelityLimited.achievedRf}`);

const unreachable = optimize(130);
assert.equal(unreachable.exact, false, 'unreachable target is marked inexact');
assert.ok(unreachable.deltaUv <= 0.002,
    `unreachable target exceeded chromaticity tolerance: ${unreachable.deltaUv}`);
assert.ok(unreachable.achievedRf >= 80,
    `unreachable target violated Rf floor: ${unreachable.achievedRf}`);
assert.equal(unreachable.achievedRg, 115,
    `unreachable target did not return the nearest feasible Rg: ${unreachable.achievedRg}`);

assert.throws(() => optimize(79), RangeError, 'targets below 80 are rejected');
assert.throws(() => optimize(131), RangeError, 'targets above 130 are rejected');
assert.throws(() => optimizeMetamer({
    channels,
    baselineValues,
    targetXy: { x: NaN, y: targetXy.y },
    targetRg: 100,
    evaluateSpd,
    xyToUv() {
        throw new Error('xyToUv should not be called for an invalid target');
    }
}), TypeError, 'non-finite target chromaticity is rejected before xyToUv');

const noFeasibleResult = optimizeMetamer({
    channels,
    baselineValues,
    targetXy,
    targetRg: 100,
    evaluateSpd(spd) {
        return { x: targetXy.x, y: targetXy.y, rg: 100, rf: 79 };
    },
    xyToUv
});
assert.equal(noFeasibleResult.feasible, false, 'no Rf-valid candidate is reported as infeasible');
assert.equal(noFeasibleResult.values, null, 'infeasible result has no channel values to apply');
assert.equal(noFeasibleResult.achievedRf, null, 'infeasible result never reports low Rf as achieved');
assert.equal(noFeasibleResult.exact, false, 'infeasible result is never exact');

const separatedChannels = [
    { id: 'first', spd: [1, 0] },
    { id: 'second', spd: [0, 1] }
];
const separatedResult = optimizeMetamer({
    channels: separatedChannels,
    baselineValues: [50, 50],
    targetXy,
    targetRg: 110,
    evaluateSpd(spd) {
        const combined = spd[0] === 0.25 && spd[1] === 0.75;
        return {
            x: targetXy.x,
            y: targetXy.y,
            rg: combined ? 110 : 100,
            rf: combined ? 85 : 70
        };
    },
    xyToUv
});
assert.equal(separatedResult.feasible, true,
    'an interior feasible seed is found without requiring valid intermediate moves');
assert.deepEqual(separatedResult.values, [25, 75],
    'the separated interior channel combination is selected');
assert.equal(separatedResult.achievedRf, 85,
    'the separated interior channel combination preserves the Rf floor');
assert.equal(separatedResult.exact, true,
    'the separated interior channel combination reaches the target');

const invalidNeighborResult = optimizeMetamer({
    channels,
    baselineValues,
    targetXy,
    targetRg: 100,
    evaluateSpd(spd) {
        const isBaseline = spd.every(value => Math.abs(value - 0.5) < 1e-12);
        return {
            x: isBaseline ? targetXy.x : 0.45,
            y: isBaseline ? targetXy.y : 0.2,
            rg: 100,
            rf: 90
        };
    },
    xyToUv
});
assert.equal(invalidNeighborResult.feasible, true,
    'a valid seed remains usable when its neighboring candidates are chromatically invalid');
assert.deepEqual(invalidNeighborResult.values, baselineValues,
    'chromatically invalid neighbors are not ranked as search candidates');

const coordinatedResult = optimizeMetamer({
    channels: separatedChannels,
    baselineValues: [50, 50],
    targetXy,
    targetRg: 102.4,
    evaluateSpd(spd) {
        const imbalance = spd[0] - spd[1];
        return {
            x: targetXy.x + imbalance * 0.02,
            y: targetXy.y,
            rg: 100 + (spd[0] + spd[1] - 1) * 10,
            rf: 90
        };
    },
    xyToUv(x, y) { return { u: x, v: y }; }
});
assert.equal(coordinatedResult.exact, true,
    'coordinated channel changes can improve Rg while preserving chromaticity');
assert.deepEqual(coordinatedResult.values, [62, 62],
    'paired channel search reaches the colour-preserving solution');

const lockedBaseline = Object.freeze({
    channelIds: Object.freeze(['red', 'green', 'blue']),
    xy: Object.freeze({ x: targetXy.x, y: targetXy.y }),
    uv: Object.freeze(xyToUv(targetXy.x, targetXy.y))
});
assert.equal(resolveComparisonBaseline({
    metamerModeEnabled: false,
    compareSpectrumEnabled: true,
    baselineSnapshot: lockedBaseline,
    activeChannelIds: ['red', 'green', 'blue']
}), null, 'comparison baseline is unavailable while metamer mode is off');
assert.equal(resolveComparisonBaseline({
    metamerModeEnabled: true,
    compareSpectrumEnabled: true,
    baselineSnapshot: lockedBaseline,
    activeChannelIds: ['red', 'green', 'blue']
}), lockedBaseline, 'comparison baseline resolves while metamer mode and comparison are active');
assert.equal(resolveComparisonBaseline({
    metamerModeEnabled: true,
    compareSpectrumEnabled: true,
    baselineSnapshot: lockedBaseline,
    activeChannelIds: ['red', 'green', 'cyan']
}), null, 'comparison baseline is invalidated by a channel-set change');

const mutableTarget = { x: 0.4, y: 0.4 };
const lockedTarget = getBaselineTargetXy(lockedBaseline);
mutableTarget.x = 0.2;
assert.deepEqual(lockedTarget, targetXy,
    'baseline target remains independent of mutable CCT/Duv-derived target state');
assert.notEqual(lockedTarget, lockedBaseline.xy,
    'baseline target is returned as a defensive copy');

const currentUv = xyToUv(targetXy.x + 0.0005, targetXy.y);
assert.equal(deltaUvBetween(lockedBaseline.uv, currentUv),
    Math.hypot(currentUv.u - lockedBaseline.uv.u, currentUv.v - lockedBaseline.uv.v),
    'displayed chromaticity delta is the pairwise baseline/current distance');

assert.equal(formatRoundedMetricDelta(100.4, 100), '(0)', 'zero delta has no plus sign');
assert.equal(formatRoundedMetricDelta(102, 100), '(+2)', 'positive delta has a plus sign');
assert.equal(formatRoundedMetricDelta(98, 100), '(-2)', 'negative delta has a minus sign');
assert.equal(formatRoundedMetricDelta(NaN, 100), '', 'invalid metric delta is omitted');

assert.equal(isBetterColourCandidate(
    { ra: 93, r9: 55, rf: 88 },
    { ra: 96, r9: 20, rf: 92 },
    { mode: 'fidelity', r9Floor: 50 }
), true, 'standard optimisation prefers an R9-valid candidate over higher Ra');
assert.equal(isBetterColourCandidate(
    { ra: 94, r9: 52, rf: 87 },
    { ra: 93, r9: 70, rf: 90 },
    { mode: 'fidelity', r9Floor: 50 }
), true, 'standard optimisation maximises Ra after both candidates satisfy R9');
assert.equal(isBetterColourCandidate(
    { ra: 90, r9: 42, rf: 87 },
    { ra: 95, r9: 30, rf: 92 },
    { mode: 'fidelity', r9Floor: 50 }
), true, 'standard optimisation maximises reachable R9 when neither candidate reaches the floor');
assert.equal(isBetterColourCandidate(
    { rgError: 2, ra: 88, r9: 45, rf: 84 },
    { rgError: 0, ra: 91, r9: 20, rf: 90 },
    { mode: 'vitality', r9Floor: 40 }
), true, 'colour vitality keeps R9 acceptable before pursuing the exact Rg target');

console.log('metamer-optimizer tests passed');
