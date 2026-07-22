const assert = require('assert');
const palette = require('./pastel-palette.js');

assert.strictEqual(palette.samples.length, 32);
assert.deepStrictEqual(palette.samples.map(sample => sample.id),
    Array.from({ length: 32 }, (_, index) => `P${String(index + 1).padStart(2, '0')}`));
for (const sample of palette.samples) {
    assert.strictEqual(sample.rgb.length, 3);
    assert(sample.rgb.every(value => Number.isInteger(value) && value >= 0 && value <= 255));
    assert(sample.xy.x > 0 && sample.xy.x < 0.8);
    assert(sample.xy.y > 0 && sample.xy.y < 0.9);
    assert(sample.xy.x + sample.xy.y < 1);
}
assert.notDeepStrictEqual(palette.samples[0].rgb, palette.samples[31].rgb);
console.log('pastel-palette tests passed');
