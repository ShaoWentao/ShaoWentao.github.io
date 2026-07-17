const assert = require('node:assert/strict');
const { optimizeMetamer } = require('./metamer-optimizer.js');

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
        const combined = spd[0] === 1 && spd[1] === 1;
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
    'a valid combined seed is found without requiring valid intermediate moves');
assert.deepEqual(separatedResult.values, [100, 100],
    'the separated feasible channel combination is selected');
assert.equal(separatedResult.achievedRf, 85,
    'the separated feasible channel combination preserves the Rf floor');
assert.equal(separatedResult.exact, true,
    'the separated feasible channel combination reaches the target');

console.log('metamer-optimizer tests passed');
