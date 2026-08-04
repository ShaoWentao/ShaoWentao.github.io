'use strict';

const assert = require('node:assert/strict');
const {
    optimizeMaterialFidelity,
    optimizeMaterialPreference,
    summarizeMaterialResults,
    summarizeMaterialPreference,
    preferredChromaTarget
} = require('./material-optimizer.js');

const channels = [
    { id: 'base', spd: [1, 1, 0] },
    { id: 'fill', spd: [1, 1, 1] }
];

function xyFromSpd(spd) {
    const total = spd[0] + spd[1];
    return { x: spd[0] / total, y: spd[1] / total };
}

function xyToUpVp(x, y) {
    return { up: x, vp: y };
}

function evaluateSpd(spd) {
    const neutral = Math.max(spd[0], 1e-9);
    const fillRatio = spd[2] / neutral;
    const first = Math.abs(fillRatio - 0.5) * 10;
    const second = Math.abs(fillRatio - 0.45) * 12;
    return summarizeMaterialResults([
        { materialId: 'first', deltaE00: first },
        { materialId: 'second', deltaE00: second }
    ]);
}

const result = optimizeMaterialFidelity({
    channels,
    initialValues: [80, 20],
    targetXy: { x: 0.5, y: 0.5 },
    maxDeltaUpVp: 0.00001,
    xyFromSpd,
    xyToUpVp,
    evaluateSpd,
    stepSizes: [20, 10, 5, 1],
    valueQuantum: 1,
    worstWeight: 0.35
});

assert.equal(result.feasible, true);
assert.equal(result.improved, true);
assert.ok(result.after.meanDeltaE00 < result.before.meanDeltaE00,
    `${result.after.meanDeltaE00} must improve ${result.before.meanDeltaE00}`);
assert.ok(result.after.maxDeltaE00 < result.before.maxDeltaE00,
    `${result.after.maxDeltaE00} must improve ${result.before.maxDeltaE00}`);
assert.ok(result.after.deltaUpVp <= 0.00001);
assert.ok(result.values[1] > 20, 'the fill channel must increase toward the material-fidelity optimum');
assert.ok(result.values.every(value => value >= 0 && value <= 100));
assert.ok(result.values.every(Number.isInteger), 'one-percent controller mode must return integer channel values');

const unchanged = optimizeMaterialFidelity({
    channels,
    initialValues: result.values,
    targetXy: { x: 0.5, y: 0.5 },
    maxDeltaUpVp: 0.00001,
    xyFromSpd,
    xyToUpVp,
    evaluateSpd,
    stepSizes: [5, 1],
    worstWeight: 0.35
});
assert.ok(unchanged.after.objective <= unchanged.before.objective + 1e-9);

assert.deepEqual(summarizeMaterialResults([]), {
    results: [],
    meanDeltaE00: Infinity,
    maxDeltaE00: Infinity,
    rmsDeltaE00: Infinity
});

assert.equal(preferredChromaTarget({ materialCategory: 'neutral', targetHueZone: 'neutral' }, 5), 0);
assert.equal(preferredChromaTarget({ materialCategory: 'metal', targetHueZone: 'yellow-orange' }, 5), 2.5);
assert.equal(preferredChromaTarget({ materialCategory: 'wood', targetHueZone: 'yellow-orange' }, 5), 5);

function evaluatePreferenceSpd(spd) {
    const neutral = Math.max(spd[0], 1e-9);
    const fillRatio = spd[2] / neutral;
    const deltaC = fillRatio * 10;
    return [
        {
            materialId: 'wood',
            materialCategory: 'wood',
            targetHueZone: 'yellow-orange',
            deltaC,
            deltaH: (fillRatio - 0.5) * 4,
            deltaL: (fillRatio - 0.5) * 2,
            deltaE00: Math.abs(deltaC)
        },
        {
            materialId: 'neutral',
            materialCategory: 'neutral',
            targetHueZone: 'neutral',
            deltaC: fillRatio,
            deltaH: 0,
            deltaL: 0,
            deltaE00: Math.abs(fillRatio)
        }
    ];
}

const preferenceBefore = summarizeMaterialPreference(evaluatePreferenceSpd([1, 1, 0.2]), {
    preferenceChroma: 5
});
assert.ok(preferenceBefore.meanPreferenceError > 0);
assert.equal(preferenceBefore.targetChromaMean, 2.5);

const profileAwareResults = [
    { materialId: 'wood', deltaC: 4, deltaH: 0.3, deltaL: 0.2, deltaE00: 4.2 },
    { materialId: 'neutral', deltaC: 0.2, deltaH: 0.1, deltaL: 0.1, deltaE00: 0.4 }
];
const profileAwareProfiles = {
    wood: {
        targetDeltaC: 4, targetDeltaH: 0, targetDeltaL: 0,
        maxAbsDeltaH: 4, maxAbsDeltaL: 3, maxDeltaE00: 6,
        importance: 1.5,
        weights: { chroma: 1, hue: 1.4, lightness: 0.6, deltaE: 0.12 }
    },
    neutral: {
        targetDeltaC: 0, targetDeltaH: 0, targetDeltaL: 0,
        maxAbsDeltaH: 2, maxAbsDeltaL: 2, maxDeltaE00: 3,
        importance: 1,
        weights: { chroma: 1.2, hue: 2, lightness: 1, deltaE: 0.2 }
    }
};
const profileAwareSummary = summarizeMaterialPreference(profileAwareResults, profileAwareProfiles);
assert.ok(profileAwareSummary.weightedMeanPreferenceError < 1);
assert.ok(profileAwareSummary.weightedMeanChromaError < 0.2);
assert.equal(profileAwareSummary.worstMaterialId, 'wood');
assert.equal(profileAwareSummary.maxDeltaE00MaterialId, 'wood');
assert.ok(profileAwareSummary.perMaterial.every(item => Number.isFinite(item.preferenceError)));

const preference = optimizeMaterialPreference({
    channels,
    initialValues: [80, 20],
    targetXy: { x: 0.5, y: 0.5 },
    maxDeltaUpVp: 0.00001,
    xyFromSpd,
    xyToUpVp,
    evaluateSpd: evaluatePreferenceSpd,
    preferenceChroma: 5,
    stepSizes: [20, 10, 5, 1],
    valueQuantum: 1
});

assert.equal(preference.feasible, true);
assert.equal(preference.improved, true);
assert.ok(preference.values[1] > 20, 'preference mode must increase chroma instead of minimizing Delta E');
assert.ok(preference.after.meanPreferenceError < preference.before.meanPreferenceError);
assert.ok(preference.after.meanChromaError < preference.before.meanChromaError);
assert.ok(preference.after.meanDeltaC > preference.before.meanDeltaC);
assert.ok(preference.after.deltaUpVp <= 0.00001);
assert.ok(preference.after.meanDeltaE00 > preference.before.meanDeltaE00,
    'preference enhancement may intentionally increase fidelity colour difference');

const guardedPreference = optimizeMaterialPreference({
    channels,
    initialValues: [80, 20],
    targetXy: { x: 0.5, y: 0.5 },
    maxDeltaUpVp: 0.00001,
    xyFromSpd,
    xyToUpVp,
    evaluateSpd: evaluatePreferenceSpd,
    preferenceChroma: 5,
    stepSizes: [20, 10, 5, 1],
    candidateGuard: () => false
});
assert.equal(guardedPreference.improved, false,
    'a dining guard must be able to reject a candidate that makes the selected food worse');
assert.deepEqual(guardedPreference.values, [80, 20]);

const quantityPreserving = optimizeMaterialFidelity({
    channels,
    initialValues: [80, 20],
    targetXy: { x: 0.5, y: 0.5 },
    maxDeltaUpVp: 0.00001,
    xyFromSpd,
    xyToUpVp,
    evaluateSpd,
    stepSizes: [20, 10, 5, 1],
    quantityFromSpd: spd => spd.reduce((sum, value) => sum + value, 0),
    maxRelativeQuantityError: 0.005
});
const initialQuantity = channels.reduce((sum, channel, index) =>
    sum + channel.spd.reduce((channelSum, value) => channelSum + value, 0) * [80, 20][index] / 100, 0);
const optimizedQuantity = channels.reduce((sum, channel, index) =>
    sum + channel.spd.reduce((channelSum, value) => channelSum + value, 0) * quantityPreserving.values[index] / 100, 0);
assert.ok(Math.abs(optimizedQuantity / initialQuantity - 1) <= 0.005,
    'optimizer must preserve the configured photometric quantity');

function hueDominantEvaluation(spd) {
    const ratio = spd[2] / Math.max(spd[0], 1e-9);
    return [{
        materialId: 'food',
        deltaC: (ratio - 0.2) * 10,
        deltaH: (ratio - 0.3) * 100,
        deltaL: 0,
        deltaE00: Math.abs((ratio - 0.3) * 10)
    }];
}
const hueDominant = optimizeMaterialPreference({
    channels,
    initialValues: [80, 20],
    targetXy: { x: 0.5, y: 0.5 },
    maxDeltaUpVp: 0.00001,
    xyFromSpd,
    xyToUpVp,
    evaluateSpd: hueDominantEvaluation,
    profilesByMaterialId: {
        food: {
            targetDeltaC: 0,
            targetDeltaH: 0,
            targetDeltaL: 0,
            maxAbsDeltaH: 20,
            maxAbsDeltaL: 3,
            maxDeltaE00: 10,
            importance: 1,
            weights: { chroma: 1, hue: 5, lightness: 0, deltaE: 0 }
        }
    },
    stepSizes: [10, 5, 1]
});
assert.equal(hueDominant.improved, true,
    'a lower multi-objective preference score must not be rejected solely because chroma error increases');
assert.ok(hueDominant.after.weightedMeanPreferenceError < hueDominant.before.weightedMeanPreferenceError);
assert.ok(hueDominant.after.weightedMeanChromaError > hueDominant.before.weightedMeanChromaError);

const colourSeeking = optimizeMaterialFidelity({
    channels: [
        { id: 'x', spd: [1, 0, 0] },
        { id: 'y', spd: [0, 1, 0] }
    ],
    initialValues: [80, 20],
    targetXy: { x: 0.5, y: 0.5 },
    maxDeltaUpVp: 0.01,
    xyFromSpd,
    xyToUpVp,
    evaluateSpd: () => summarizeMaterialResults([{ materialId: 'sample', deltaE00: 1 }]),
    stepSizes: [20, 10, 5, 1]
});
assert.equal(colourSeeking.feasible, true,
    'optimizer must be able to approach a scene target when the initial colour point is outside tolerance');
assert.ok(colourSeeking.after.deltaUpVp <= 0.01);

console.log('material optimizer tests passed', {
    fidelity: { before: result.before, after: result.after, values: result.values },
    preference: { before: preference.before, after: preference.after, values: preference.values }
});
