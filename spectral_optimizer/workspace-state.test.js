'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { createWorkspaceState } = require('./workspace-state.js');

const store = createWorkspaceState();
assert.deepEqual(store.getSnapshot(), {
    chromaticityView: 'cie1931',
    analysisTab: 'colour',
    details: {
        chromaticity: false,
        health: false,
        contribution: false
    },
    currentResult: null
});

store.setChromaticityView('cie1976');
assert.equal(store.getSnapshot().chromaticityView, 'cie1976');
store.setChromaticityView('invalid');
assert.equal(store.getSnapshot().chromaticityView, 'cie1976');

store.setAnalysisTab('material');
assert.equal(store.getSnapshot().analysisTab, 'material');
store.setAnalysisTab('dining');
assert.equal(store.getSnapshot().analysisTab, 'dining');
store.setAnalysisTab('health');
assert.equal(store.getSnapshot().analysisTab, 'dining');
store.setAnalysisTab('invalid');
assert.equal(store.getSnapshot().analysisTab, 'dining');

store.setDetails({ health: true, contribution: true });
assert.deepEqual(store.getSnapshot().details, {
    chromaticity: false,
    health: true,
    contribution: true
});
store.setDetails({ health: 'invalid', chromaticity: true });
assert.deepEqual(store.getSnapshot().details, {
    chromaticity: true,
    health: true,
    contribution: true
});

const result = {
    metrics: { cct: 4000, duv: 0.0003 },
    spectrum: { values: new Float64Array([0.1, 0.2]) },
    channels: [{ spd: [0.3, 0.4] }]
};
store.setCurrentResult(result);
result.metrics.cct = 9000;
result.spectrum.values[0] = 9;
result.channels[0].spd[0] = 9;

let snapshot = store.getSnapshot();
assert.equal(snapshot.currentResult.metrics.cct, 4000);
assert.equal(snapshot.currentResult.spectrum.values[0], 0.1);
assert.equal(snapshot.currentResult.channels[0].spd[0], 0.3);
snapshot.currentResult.metrics.duv = 1;
assert.equal(store.getSnapshot().currentResult.metrics.duv, 0.0003);

const notifications = [];
const unsubscribe = store.subscribe(next => {
    notifications.push(next.details.health);
    next.details.health = false;
});
assert.deepEqual(notifications, [true]);
store.setDetails({ health: false });
assert.deepEqual(notifications, [true, false]);
assert.equal(store.getSnapshot().details.health, false);
store.setDetails({ health: false });
assert.equal(notifications.length, 2);
unsubscribe();
store.setDetails({ health: true });
assert.equal(notifications.length, 2);

const source = fs.readFileSync('workspace-state.js', 'utf8');
assert.doesNotMatch(source, /localStorage|sessionStorage/);
assert.doesNotMatch(source, /document\.|querySelector|getElementById/);
assert.doesNotMatch(source, /setView|advancedAnalysis|VALID_VIEWS|VALID_ADVANCED_TABS/);

console.log('workspace state tests passed');
