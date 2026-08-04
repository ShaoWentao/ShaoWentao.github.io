'use strict';

const assert = require('node:assert/strict');
const PreviewColor = require('./material-preview-color.js');

const white = PreviewColor.toSrgb([100, 0, 0]);
assert.ok(white.every(channel => channel >= 254 && channel <= 255));

const black = PreviewColor.toSrgb([0, 0, 0]);
assert.deepEqual(black, [0, 0, 0]);

const saturated = PreviewColor.toSrgb([55, 120, -140]);
assert.equal(saturated.length, 3);
assert.ok(saturated.every(channel => Number.isFinite(channel) && channel >= 0 && channel <= 255));

assert.equal(PreviewColor.toCss([0, 0, 0]), 'rgb(0, 0, 0)');
assert.equal(PreviewColor.toCss(null), 'rgb(218, 218, 218)');

const lighter = PreviewColor.mapRgb([100, 100, 100], [12, 0, 0]);
assert.ok(lighter.every((channel, index) => channel > [100, 100, 100][index]));

const redder = PreviewColor.mapRgb([130, 120, 115], [0, 14, 0]);
assert.ok(redder[0] > redder[1], 'positive a* shift should move a neutral pixel toward red');

assert.deepEqual(PreviewColor.deltaBetween([52, 3, -2], [55, 7, 1]), [3, 4, 3]);

assert.deepEqual(
    PreviewColor.mapRgbWithBackground([198, 198, 198], [0, 20, 0], [198, 198, 198]),
    [198, 198, 198],
    'pixels matching the estimated background must not be colour-mapped'
);
const mappedLeaf = PreviewColor.mapRgbWithBackground([55, 105, 65], [0, 20, 0], [198, 198, 198]);
assert.ok(mappedLeaf[1] !== 105 || mappedLeaf[0] !== 55,
    'food pixels must still receive the calculated Lab mapping');

console.log('material preview colour tests passed');
