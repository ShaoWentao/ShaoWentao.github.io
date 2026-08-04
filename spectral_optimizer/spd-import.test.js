'use strict';

const assert = require('node:assert/strict');
const { parseSpdText, interpolateZeroOutside } = require('./spd-import.js');

function validCsv() {
    const rows = ['nm,R,G,B'];
    for (let wavelength = 380; wavelength <= 780; wavelength += 10) {
        rows.push(`${wavelength},${(wavelength - 300) / 500},0.5,25%`);
    }
    return rows.join('\n');
}

const parsed = parseSpdText(validCsv(), { minChannels: 3, maxChannels: 6 });
assert.equal(parsed.channelCount, 3);
assert.deepEqual(parsed.headers, ['nm', 'R', 'G', 'B']);
assert.equal(parsed.channelSamples.length, 3);
assert.equal(parsed.channelSamples[0][0][0], 380);
assert.equal(parsed.channelSamples[0].at(-1)[0], 780);
assert.equal(parsed.channelSamples[2][0][1], 25);

assert.throws(() => parseSpdText(validCsv().replace('380,0.16,0.5,25%', '380,0.16,,25%')),
    /第 2 行.*第 3 列.*空值/);
assert.throws(() => parseSpdText(validCsv().replace('390,0.18,0.5,25%', '390,word,0.5,25%')),
    /第 3 行.*第 2 列.*有效数字/);
assert.throws(() => parseSpdText(validCsv().replace('400,0.2,0.5,25%', '400,-0.2,0.5,25%')),
    /第 4 行.*负值/);
assert.throws(() => parseSpdText(validCsv() + '\n780,0.9,0.5,25%'),
    /重复波长.*780/);
assert.throws(() => parseSpdText(validCsv().replace('410,0.22,0.5,25%', '410,0.22,0.5')),
    /第 5 行.*列数/);
assert.throws(() => parseSpdText(validCsv().split('\n').filter(line => {
    const wavelength = Number(line.split(',')[0]);
    return !Number.isFinite(wavelength) || (wavelength >= 400 && wavelength <= 760);
}).join('\n')), /覆盖.*380.*780/);

assert.equal(interpolateZeroOutside([[400, 1], [500, 2]], 380), 0);
assert.equal(interpolateZeroOutside([[400, 1], [500, 2]], 520), 0);
assert.equal(interpolateZeroOutside([[400, 1], [500, 2]], 450), 1.5);

console.log('SPD import tests passed');
