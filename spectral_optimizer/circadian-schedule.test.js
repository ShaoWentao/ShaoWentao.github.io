const assert = require('assert');
const schedule = require('./circadian-schedule.js');

assert.equal(schedule.DEFAULT_STAGES.length, 5);
assert.equal(schedule.timeToMinutes('21:30'), 1290);
assert(Number.isNaN(schedule.timeToMinutes('25:00')));
let state = schedule.stateAt(schedule.DEFAULT_STAGES, 8 * 60, 30);
assert.equal(state.active.id, 'morning');
assert.equal(state.progress, 1);
state = schedule.stateAt(schedule.DEFAULT_STAGES, 7 * 60 + 15, 30);
assert.equal(state.active.id, 'morning');
assert.equal(state.previous.id, 'night');
assert.equal(state.progress, 0.5);
state = schedule.stateAt(schedule.DEFAULT_STAGES, 2 * 60, 30);
assert.equal(state.active.id, 'night');
const blended = schedule.blendScenes(
    { cctK: 2000, duv: 0, illuminanceLux: 10 },
    { cctK: 3500, duv: 0.002, illuminanceLux: 250, emphasis: 'morning' },
    0.5
);
assert.deepEqual(blended, { cctK: 2750, duv: 0.001, illuminanceLux: 130, emphasis: 'morning' });
assert.equal(schedule.advanceSimulationMinute(0, 15), 15);
assert.equal(schedule.advanceSimulationMinute(1430, 15), 1440);
assert.equal(schedule.formatMinuteOfDay(0), '00:00');
assert.equal(schedule.formatMinuteOfDay(75), '01:15');
console.log('circadian-schedule tests passed');
