'use strict';

const assert = require('assert');
const {
    buildCctJourney,
    HUMAN_CENTRED_SCENES,
    sceneById
} = require('./cct-journey');

const expectedAscending = [
    1600, 2000, 2500, 3000, 3500, 4000, 4500, 5000, 5500, 6000, 6500,
    7000, 7500, 8000, 8500, 9000, 9500, 10000, 10500, 11000, 11500, 12000
];
const expectedJourney = expectedAscending.concat(expectedAscending.slice(0, -1).reverse());

assert.deepStrictEqual(buildCctJourney(), expectedJourney, 'journey must use the exact round-trip sequence');
assert.strictEqual(buildCctJourney()[0], 1600, 'journey must begin at 1600 K');
assert.strictEqual(buildCctJourney().at(-1), 1600, 'journey must finish at 1600 K');
assert.strictEqual(buildCctJourney().filter((cctK) => cctK === 12000).length, 1, 'apex must not be duplicated');

const journey = buildCctJourney();
assert.strictEqual(journey[1] - journey[0], 400, 'first ascending step must be 400 K');
for (let index = 2; index < expectedAscending.length; index++) {
    assert.strictEqual(journey[index] - journey[index - 1], 500, 'internal ascending steps must be 500 K');
}
for (let index = expectedAscending.length; index < journey.length - 1; index++) {
    assert.strictEqual(Math.abs(journey[index] - journey[index - 1]), 500, 'internal return steps must be 500 K');
}
assert.strictEqual(journey.at(-2) - journey.at(-1), 400, 'final return step must be 400 K');

const expectedScenes = [
    ['morning-transition', '\u6668\u95f4\u8fc7\u6e21', 'Morning Transition', 3500, 0, 250, 'moderate-daytime-circadian-support'],
    ['daytime-focus', '\u65e5\u95f4\u4e13\u6ce8', 'Daytime Focus', 5000, 0, 400, 'higher-daytime-melanopic-and-cla2-response'],
    ['collaboration', '\u534f\u4f5c\u4ea4\u6d41', 'Collaboration', 4000, 0, 300, 'balanced-facial-appearance-colour-fidelity-and-circadian-support'],
    ['colour-vitality', '\u8272\u5f69\u6d3b\u529b', 'Colour Vitality', 3500, 0, 300, 'high-fidelity-and-rg-105-115'],
    ['evening-wind-down', '\u591c\u95f4\u653e\u677e', 'Evening Wind-down', 2700, 0, 75, 'lower-melanopic-and-cla2-stimulus'],
    ['night-low-disturbance', '\u591c\u95f4\u4f4e\u5e72\u6270', 'Night Low Disturbance', 2000, 0, 10, 'minimize-melanopic-and-cla2-stimulus']
];

assert.deepStrictEqual(HUMAN_CENTRED_SCENES.map((scene) => [
    scene.id, scene.labelZh, scene.labelEn, scene.cctK, scene.duv, scene.illuminanceLux, scene.emphasis
]), expectedScenes, 'scenes must match the confirmed bilingual presets');
assert.ok(HUMAN_CENTRED_SCENES.every((scene) => scene.duv === 0), 'all scenes must have neutral Duv');

assert.ok(Object.isFrozen(HUMAN_CENTRED_SCENES), 'scene collection must be immutable');
assert.ok(HUMAN_CENTRED_SCENES.every(Object.isFrozen), 'each scene definition must be immutable');
assert.throws(() => { HUMAN_CENTRED_SCENES[0].cctK = 6500; }, TypeError);
assert.throws(() => { HUMAN_CENTRED_SCENES.push({}); }, TypeError);

assert.strictEqual(sceneById('colour-vitality'), HUMAN_CENTRED_SCENES[3], 'lookup must return the immutable preset');
assert.strictEqual(sceneById('missing-scene'), null, 'unknown scene lookup must be safe');
assert.strictEqual(sceneById(null), null, 'non-string scene lookup must be safe');
assert.strictEqual(sceneById({ id: 'daytime-focus' }), null, 'object scene lookup must be safe');

console.log('cct-journey tests: PASS');
