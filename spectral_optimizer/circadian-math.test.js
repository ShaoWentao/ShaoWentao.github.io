const assert = require('node:assert/strict');
const { CLA2_DATA } = require('./circadian-data.js');

const keys = ['photopic', 'scotopic', 'melanopsin', 'sConeMacular', 'photopicMacular'];
const goldenSamples = Object.freeze({
  380: [0, 0, 0.00121, 0, 0],
  420: [0.004000572924912521, 0.0966, 0.202, 0.5085175967110088, 0.008082939383710235],
  460: [0.06000859887341653, 0.567, 0.81, 0.9468450097608583, 0.18606325623989323],
  480: [0.13903992455465375, 0.793, 0.994, 0.4799570598792023, 0.37289508056963044],
  555: [0.9999457419440964, 0.4017, 0.139, 0.0014790932307481696, 0.9998240194492761],
  650: [0.10701533524089449, 0.000677, 0.000128, 0, 0.10492842325302519]
});

assert.ok(CLA2_DATA.wavelengths.length > 300);
assert.ok(Object.isFrozen(CLA2_DATA));
for (const key of keys) {
  assert.equal(CLA2_DATA[key].length, CLA2_DATA.wavelengths.length);
  assert.ok(CLA2_DATA[key].every(Number.isFinite));
  assert.ok(Object.isFrozen(CLA2_DATA[key]));
}
assert.equal(CLA2_DATA.wavelengths[0], 380);
assert.equal(CLA2_DATA.wavelengths.at(-1), 730);
for (let index = 1; index < CLA2_DATA.wavelengths.length; index += 1) {
  assert.equal(CLA2_DATA.wavelengths[index] - CLA2_DATA.wavelengths[index - 1], 1);
}

for (const [wavelength, expected] of Object.entries(goldenSamples)) {
  const index = CLA2_DATA.wavelengths.indexOf(Number(wavelength));
  assert.notEqual(index, -1, `${wavelength} nm must be present`);
  assert.deepEqual(keys.map((key) => CLA2_DATA[key][index]), expected, `${wavelength} nm spectral functions`);
}

assert.throws(() => {
  'use strict';
  CLA2_DATA.melanopsin[0] = 1;
}, TypeError);
assert.throws(() => {
  'use strict';
  CLA2_DATA.melanopsin = [];
}, TypeError);

console.log('circadian data integrity tests passed');
