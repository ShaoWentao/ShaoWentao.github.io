'use strict';

const assert = require('node:assert/strict');
const MODEL = require('./museum-damage-model.js');

const result = MODEL.calculateExposure({
    currentIlluminance: 50,
    targetIlluminance: 30,
    dailyHours: 8,
    annualDays: 300
});

assert.deepEqual(result.current, {
    illuminance: 50,
    dailyLxHours: 400,
    annualLxHours: 120000
});
assert.deepEqual(result.target, {
    illuminance: 30,
    dailyLxHours: 240,
    annualLxHours: 72000
});
assert.equal(result.changePercent, -40);
assert.equal(result.dailyHours, 8);
assert.equal(result.annualDays, 300);
assert.match(result.disclaimerCN, /不.*绝对损伤结论/);

const zero = MODEL.calculateExposure({
    currentIlluminance: 0,
    targetIlluminance: 0,
    dailyHours: 0,
    annualDays: 0
});
assert.equal(zero.current.annualLxHours, 0);
assert.equal(zero.target.annualLxHours, 0);
assert.equal(zero.changePercent, 0);

assert.throws(() => MODEL.calculateExposure({
    currentIlluminance: -1,
    targetIlluminance: 30,
    dailyHours: 8,
    annualDays: 300
}), /currentIlluminance/);
assert.throws(() => MODEL.calculateExposure({
    currentIlluminance: 50,
    targetIlluminance: 30,
    dailyHours: 25,
    annualDays: 300
}), /dailyHours/);
assert.throws(() => MODEL.calculateExposure({
    currentIlluminance: 50,
    targetIlluminance: 30,
    dailyHours: 8,
    annualDays: 367
}), /annualDays/);

console.log('museum damage model tests passed', result);
