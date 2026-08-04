'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const diagram = require('./chromaticity-diagram.js');

function close(actual, expected, tolerance, label) {
    assert.ok(Math.abs(actual - expected) <= tolerance,
        `${label}: expected ${expected}, received ${actual}`);
}

const xy1931 = diagram.createPlotGeometry(640, 360, {
    xMax: 0.85,
    yMax: 0.85,
    padding: { left: 42, right: 18, top: 16, bottom: 34 }
});
const origin = diagram.projectPoint(0.2, 0.2, xy1931);
const dx = diagram.projectPoint(0.3, 0.2, xy1931);
const dy = diagram.projectPoint(0.2, 0.3, xy1931);
close(Math.abs(dx.x - origin.x), Math.abs(dy.y - origin.y), 1e-9,
    'CIE 1931 must use one physical scale for x and y');

const uv1960 = diagram.xyTo1960Uv(0.3127, 0.3290);
close(uv1960.u, 0.19783, 0.00002, 'D65 CIE 1960 u');
close(uv1960.v, 0.31221, 0.00002, 'D65 CIE 1960 v');
const xyRoundTrip = diagram.uv1960ToXy(uv1960.u, uv1960.v);
close(xyRoundTrip.x, 0.3127, 1e-9, 'CIE 1960 round-trip x');
close(xyRoundTrip.y, 0.3290, 1e-9, 'CIE 1960 round-trip y');

const upvp1976 = diagram.xyTo1976UpVp(0.3127, 0.3290);
close(upvp1976.up, uv1960.u, 1e-12, 'u and u-prime share the same coordinate');
close(upvp1976.vp, uv1960.v * 1.5, 1e-12,
    'CIE 1976 v-prime must remain distinct from CIE 1960 v');

const ucs1976 = diagram.createPlotGeometry(420, 420, {
    xMax: 0.60,
    yMax: 0.60,
    padding: { left: 42, right: 18, top: 16, bottom: 34 }
});
close(ucs1976.plotWidth / ucs1976.plotHeight, 1, 1e-12,
    'CIE 1976 must use a square 0 to 0.60 coordinate range');

const professionalSource = fs.readFileSync('professional-analysis.js', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');
assert.match(professionalSource, /var xMax = 0\.60;/,
    'CIE 1976 renderer must use the 0 to 0.60 horizontal range');
assert.match(professionalSource, /var yMax = 0\.60;/,
    'CIE 1976 renderer must use the 0 to 0.60 vertical range');
assert.match(professionalSource, /professional-cie1976[^\n]*'1976'/,
    'visible UCS rendering must use CIE 1976 u-prime v-prime');
assert.doesNotMatch(html, /professional-cie1960|chromaticity-tab-1960/,
    'CIE 1960 must not be exposed as a visible chart');
assert.match(html, /id="chromaticity-channel-points"/,
    'channel points must be available through an explicit toggle');

console.log('chromaticity diagram tests passed');
