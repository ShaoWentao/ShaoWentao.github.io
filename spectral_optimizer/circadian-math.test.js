const assert = require('node:assert/strict');
const { CLA2_DATA } = require('./circadian-data.js');

const keys = ['photopic', 'scotopic', 'melanopsin', 'sConeMacular', 'photopicMacular'];
assert.ok(CLA2_DATA.wavelengths.length > 300);
for (const key of keys) {
  assert.equal(CLA2_DATA[key].length, CLA2_DATA.wavelengths.length);
  assert.ok(CLA2_DATA[key].every(Number.isFinite));
}
assert.equal(CLA2_DATA.wavelengths[0], 380);
assert.equal(CLA2_DATA.wavelengths.at(-1), 730);
