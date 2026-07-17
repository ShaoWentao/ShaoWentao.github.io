const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { CLA2_DATA } = require('./circadian-data.js');
const { calculateCLA2, claToCS } = require('./circadian-math.js');

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

function illuminantAValue(wavelength) {
  const c2 = 1.435e7;
  const temperature = 2848;
  return 100 * Math.pow(560 / wavelength, 5)
    * (Math.exp(c2 / (temperature * 560)) - 1)
    / (Math.exp(c2 / (temperature * wavelength)) - 1);
}

const referenceA = { wavelengths: [], values: [] };
for (let wavelength = 380; wavelength <= 730; wavelength += 5) {
  referenceA.wavelengths.push(wavelength);
  referenceA.values.push(illuminantAValue(wavelength));
}

assert.ok(Math.abs(claToCS(355.7, 1, 1) - 0.35) < 1e-12);

const a1000 = calculateCLA2({
  wavelengths: referenceA.wavelengths,
  values: referenceA.values,
  illuminanceLux: 1000,
  durationHours: 1,
  fieldFactor: 1
});
assert.ok(Math.abs(a1000.cla - 813) <= 2, `Illuminant A CLA was ${a1000.cla}`);
assert.equal(a1000.blueYellowState, 'inactive');

const typedA1000 = calculateCLA2({
  wavelengths: Float64Array.from(referenceA.wavelengths),
  values: Float64Array.from(referenceA.values),
  illuminanceLux: 1000,
  durationHours: 1,
  fieldFactor: 1
});
assert.deepEqual(typedA1000, a1000);

const equivalentCondition = calculateCLA2({
  wavelengths: referenceA.wavelengths,
  values: referenceA.values,
  illuminanceLux: 1000,
  durationHours: 2,
  fieldFactor: 0.5
});
assert.equal(equivalentCondition.cla, a1000.cla);
assert.equal(equivalentCondition.cs, a1000.cs);

const strongerCondition = calculateCLA2({
  wavelengths: referenceA.wavelengths,
  values: referenceA.values,
  illuminanceLux: 1000,
  durationHours: 2,
  fieldFactor: 2
});
assert.equal(strongerCondition.cla, a1000.cla);
assert.ok(strongerCondition.cs > a1000.cs);

const warm = calculateCLA2({
  wavelengths: [380, 500, 600, 730],
  values: [0, 0, 1, 0],
  illuminanceLux: 500
});
const cool = calculateCLA2({
  wavelengths: [380, 430, 460, 500, 730],
  values: [0, 0.2, 1, 0.2, 0],
  illuminanceLux: 500
});
assert.equal(warm.blueYellowState, 'inactive');
assert.equal(cool.blueYellowState, 'active');
assert.ok(cool.cla > warm.cla);

// Independent reference: corrected Rea et al. Equation 3 was evaluated in a
// separate one-off calculation using the official Calculator 2.0 literals
// A2=1.60 and g2=0.16. The fixture's integrated inputs were Vc=1.0510124554023887,
// Sc=1.3955638716236969, V'=1.419552758996979, and Mc=1.6402267936371542.
assert.ok(
  Math.abs(cool.cla - 1959.5505837269009) < 1e-9,
  `Blue-active reference CLA was ${cool.cla}`
);

const isolatedContext = {
  window: {
    CLA2_DATA: {
      wavelengths: [400, 500],
      photopic: [1, 0],
      scotopic: [0, 0],
      melanopsin: [1, 0],
      sConeMacular: [0.2616, 0],
      photopicMacular: [1, 0]
    }
  }
};
vm.runInNewContext(
  fs.readFileSync(require.resolve('./circadian-math.js'), 'utf8'),
  isolatedContext
);
const exactBoundary = isolatedContext.window.calculateCLA2({
  wavelengths: [400, 500],
  values: [1, 0],
  illuminanceLux: 683
});
assert.equal(exactBoundary.blueYellowState, 'active');

const clippedFarRed = calculateCLA2({
  wavelengths: [380, 709, 710, 711, 730],
  values: [0, 0, 1, 0, 0],
  illuminanceLux: 500
});
assert.equal(clippedFarRed.cla, 0);
assert.equal(clippedFarRed.cs, 0);

const zero = calculateCLA2({
  wavelengths: [380, 555, 730],
  values: [0, 0, 0],
  illuminanceLux: 1000
});
assert.deepEqual(zero, {
  cla: 0,
  cs: 0,
  blueYellowState: 'inactive',
  durationHours: 1,
  fieldFactor: 1
});

for (const malformed of [
  {},
  { wavelengths: [380, 730], values: [1], illuminanceLux: 1000 },
  { wavelengths: [380, 500, 730], values: [1, NaN, 1], illuminanceLux: 1000 },
  { wavelengths: [380, 500, 500], values: [1, 1, 1], illuminanceLux: 1000 },
  { wavelengths: [380, 500, 730], values: [1, -1, 1], illuminanceLux: 1000 },
  { wavelengths: [380, 500, 730], values: [1, 1, 1], illuminanceLux: 0 }
]) {
  const result = calculateCLA2(malformed);
  assert.equal(result.cla, 0);
  assert.equal(result.cs, 0);
  assert.ok(Number.isFinite(result.cla));
  assert.ok(Number.isFinite(result.cs));
}

const scaledA = calculateCLA2({
  wavelengths: referenceA.wavelengths,
  values: referenceA.values.map((value) => value * 1e-9),
  illuminanceLux: 1000
});
assert.ok(Math.abs(scaledA.cla - a1000.cla) < 1e-9);

const clampedConditions = calculateCLA2({
  wavelengths: referenceA.wavelengths,
  values: referenceA.values,
  illuminanceLux: 1000,
  durationHours: 99,
  fieldFactor: 3
});
assert.equal(clampedConditions.durationHours, 3);
assert.equal(clampedConditions.fieldFactor, 1);
assert.equal(claToCS(100, -10, 3), claToCS(100, 0.5, 1));
assert.equal(claToCS(-100, 1, 1), 0);
assert.equal(claToCS(Number.NaN, 1, 1), 0);
assert.equal(claToCS(Number.POSITIVE_INFINITY, 1, 1), 0.7);

const repeatedA = calculateCLA2({
  wavelengths: referenceA.wavelengths,
  values: referenceA.values,
  illuminanceLux: 1000,
  durationHours: 1.5,
  fieldFactor: 2
});
assert.deepEqual(repeatedA, calculateCLA2({
  wavelengths: referenceA.wavelengths,
  values: referenceA.values,
  illuminanceLux: 1000,
  durationHours: 1.5,
  fieldFactor: 2
}));

console.log('circadian data and calculation tests passed');
