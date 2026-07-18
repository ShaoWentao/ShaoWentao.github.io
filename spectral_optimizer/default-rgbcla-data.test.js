'use strict';

const assert = require('node:assert/strict');
const originalArraySlice = Array.prototype.slice;
const channels = require('./default-rgbcla-data.js');

assert.equal(channels.length, 6, 'RGBCLA data must contain six channels');
assert.deepEqual(channels.map(channel => channel.id),
    ['red', 'green', 'blue', 'cyan', 'lime', 'amber']);

function peakSample(channel) {
    return channel.spdSamples.reduce((best, sample) => sample[1] > best[1] ? sample : best);
}

function halfMaximumWidth(channel) {
    const points = channel.spdSamples.filter(sample => sample[1] >= 0.5);
    return points.at(-1)[0] - points[0][0];
}

for (const channel of channels) {
    assert.equal(channel.spdSamples.length, 401, `${channel.id} must use 1 nm samples`);
    assert.equal(channel.spdSamples[0][0], 380);
    assert.equal(channel.spdSamples.at(-1)[0], 780);
    assert.equal(Math.max(...channel.spdSamples.map(sample => sample[1])), 1);
}

const byId = Object.fromEntries(channels.map(channel => [channel.id, channel]));
assert.ok(peakSample(byId.blue)[0] >= 449 && peakSample(byId.blue)[0] <= 453);
assert.ok(peakSample(byId.cyan)[0] >= 495 && peakSample(byId.cyan)[0] <= 502);
assert.ok(peakSample(byId.green)[0] >= 519 && peakSample(byId.green)[0] <= 525);
assert.ok(peakSample(byId.red)[0] >= 620 && peakSample(byId.red)[0] <= 628);
assert.ok(halfMaximumWidth(byId.lime) > halfMaximumWidth(byId.green) * 2,
    'PC Lime must remain a broad phosphor-converted spectrum');
assert.ok(halfMaximumWidth(byId.amber) > halfMaximumWidth(byId.red) * 2,
    'PC Amber must remain a broad phosphor-converted spectrum');
assert.ok(byId.lime.spdSamples.find(sample => sample[0] === 451)[1] > 0.05,
    'PC Lime must retain the blue-pump shoulder');
assert.match(byId.lime.sourceName, /LZ7-04M2PD/i);
assert.match(byId.lime.dataQualification, /datasheet-derived/i);

const legacySixChannelLiteral = [
    { id: 'red' }, { id: 'green' }, { id: 'blue' },
    { id: 'cyan' }, { id: 'lime' }, { id: 'amber' }
];
legacySixChannelLiteral.slice(0, 3);
assert.ok(Array.isArray(legacySixChannelLiteral[4].spdSamples),
    'legacy app channel literals must receive sampled spectra before use');
assert.equal(legacySixChannelLiteral[4].name, 'PC Lime');
assert.strictEqual(Array.prototype.slice, originalArraySlice,
    'compatibility injection must restore Array.prototype.slice immediately');

console.log('default RGBCLA data tests: PASS');