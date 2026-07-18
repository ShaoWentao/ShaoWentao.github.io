'use strict';

const assert = require('node:assert/strict');
const originalArraySlice = Array.prototype.slice;
const channels = require('./default-rgbcla-data.js');

assert.equal(channels.length, 6, 'RGBCLA data must contain six channels');
assert.deepEqual(channels.map(channel => channel.id),
    ['red', 'green', 'blue', 'cyan', 'lime', 'amber']);

function peakIndex(channel) {
    let bestIndex = 0;
    for (let index = 1; index < channel.spd.length; index++) {
        if (channel.spd[index] > channel.spd[bestIndex]) bestIndex = index;
    }
    return bestIndex;
}

function halfMaximumWidth(channel) {
    const indices = channel.spd
        .map((value, index) => value >= 0.5 ? index : -1)
        .filter(index => index >= 0);
    return indices.at(-1) - indices[0];
}

for (const channel of channels) {
    assert.equal(channel.spd.length, 401, `${channel.id} must use 1 nm direct-index SPD data`);
    assert.equal(Math.max(...channel.spd), 1);
    assert.equal(channel.spdSamples, undefined,
        `${channel.id} must avoid linear-search spdSamples in the realtime optimizer`);
}

const byId = Object.fromEntries(channels.map(channel => [channel.id, channel]));
assert.ok(peakIndex(byId.blue) + 380 >= 449 && peakIndex(byId.blue) + 380 <= 453);
assert.ok(peakIndex(byId.cyan) + 380 >= 495 && peakIndex(byId.cyan) + 380 <= 502);
assert.ok(peakIndex(byId.green) + 380 >= 519 && peakIndex(byId.green) + 380 <= 525);
assert.ok(peakIndex(byId.red) + 380 >= 620 && peakIndex(byId.red) + 380 <= 628);
assert.ok(halfMaximumWidth(byId.lime) > halfMaximumWidth(byId.green) * 2,
    'PC Lime must remain a broad phosphor-converted spectrum');
assert.ok(halfMaximumWidth(byId.amber) > halfMaximumWidth(byId.red) * 2,
    'PC Amber must remain a broad phosphor-converted spectrum');
assert.ok(byId.lime.spd[451 - 380] > 0.05,
    'PC Lime must retain the blue-pump shoulder');

const legacySixChannelLiteral = [
    { id: 'red' }, { id: 'green' }, { id: 'blue' },
    { id: 'cyan' }, { id: 'lime' }, { id: 'amber' }
];
legacySixChannelLiteral.slice(0, 3);
assert.ok(Array.isArray(legacySixChannelLiteral[4].spd),
    'legacy app channel literals must receive direct-index SPD arrays before use');
assert.equal(legacySixChannelLiteral[4].name, 'PC Lime');
assert.strictEqual(Array.prototype.slice, originalArraySlice,
    'compatibility injection must restore Array.prototype.slice immediately');

console.log('default RGBCLA data tests: PASS');