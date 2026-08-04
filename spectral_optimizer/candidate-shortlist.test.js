'use strict';

const assert = require('node:assert/strict');
const { selectCandidateShortlist } = require('./candidate-shortlist.js');

const candidates = Array.from({ length: 100 }, (_, sequence) => ({
    sequence,
    deltaUv: sequence === 73 ? 0.000001 : 0.0002 + sequence * 0.000001,
    values: [sequence]
}));
const original = candidates.map(candidate => ({ ...candidate, values: candidate.values.slice() }));

const shortlist = selectCandidateShortlist(candidates, {
    maxCandidates: 20,
    precisionFraction: 0.5
});

assert.equal(shortlist.length, 20, 'shortlist must respect the configured maximum');
assert.ok(shortlist.some(candidate => candidate.sequence === 73),
    'the lowest chromaticity-error candidate must always be retained');
assert.ok(shortlist.some(candidate => candidate.sequence < 20),
    'the coverage portion must retain an early candidate');
assert.ok(shortlist.some(candidate => candidate.sequence >= 40 && candidate.sequence < 60),
    'the coverage portion must retain a middle candidate');
assert.ok(shortlist.some(candidate => candidate.sequence >= 80),
    'the coverage portion must retain a late candidate');
assert.deepEqual(candidates, original, 'shortlisting must not mutate source candidates');
assert.deepEqual(
    selectCandidateShortlist(candidates, { maxCandidates: 20, precisionFraction: 0.5 }),
    shortlist,
    'identical candidates and options must produce deterministic output'
);

const small = candidates.slice(0, 4);
assert.deepEqual(selectCandidateShortlist(small, { maxCandidates: 10 }), small,
    'a candidate set below the limit must be returned unchanged');

assert.throws(() => selectCandidateShortlist(null), TypeError,
    'candidate input must be an array');
assert.throws(() => selectCandidateShortlist(candidates, { maxCandidates: 0 }), RangeError,
    'maximum candidate count must be positive');

console.log('candidate-shortlist tests: PASS');
