'use strict';

const assert = require('node:assert/strict');
const PROFILES = require('./material-preference-profiles.js');
const MATERIALS = require('./material-reflectance-data.js');
const DINING = require('./dining-light-data.js');

const oak = { id: 'wood_warm_oak', category: 'wood' };
const resolved = PROFILES.resolveMaterialPreference(oak, 'recommended', null);
assert.equal(resolved.materialId, 'wood_warm_oak');
assert.equal(resolved.category, 'wood');
assert.equal(resolved.level, 'recommended');
assert.ok(Number.isFinite(resolved.targetDeltaC));
assert.ok(Number.isFinite(resolved.targetDeltaH));
assert.ok(Number.isFinite(resolved.targetDeltaL));
assert.ok(Number.isFinite(resolved.maxDeltaE00));
assert.ok(Object.isFrozen(resolved));
assert.ok(Object.isFrozen(resolved.weights));
assert.equal(resolved.source, 'material');

const overridden = PROFILES.resolveMaterialPreference(oak, 'recommended', {
    wood_warm_oak: {
        importance: 1.6,
        levels: { recommended: { targetDeltaC: 4.8 } }
    }
});
assert.equal(overridden.importance, 1.6);
assert.equal(overridden.targetDeltaC, 4.8);
assert.equal(overridden.source, 'user');

const neutral = PROFILES.resolveMaterialPreference({
    id: 'neutral_wall_matte',
    category: 'neutral'
}, 'vivid', null);
assert.ok(Math.abs(neutral.targetDeltaC) <= 1);
assert.ok(neutral.maxAbsDeltaH <= 3);
assert.ok(neutral.maxAbsDeltaL <= 3);

const userFabric = PROFILES.resolveMaterialPreference({
    id: 'user-velvet',
    category: 'fabric',
    isUserMaterial: true
}, 'recommended', null);
assert.equal(userFabric.category, 'fabric');
assert.equal(userFabric.source, 'category');
assert.equal(userFabric.targetDeltaC, PROFILES.categoryDefaults.fabric.levels.recommended.targetDeltaC);

const foodBeef = PROFILES.resolveMaterialPreference({
    id: 'food_grilled_beef',
    category: 'food'
}, 'recommended', null);
assert.equal(foodBeef.category, 'food');
assert.ok(foodBeef.targetDeltaC >= 4);
assert.ok(foodBeef.importance > 1);

const skinSample = PROFILES.resolveMaterialPreference({
    id: 'skin_tone_sample',
    category: 'skin-tone-sample'
}, 'recommended', null);
assert.equal(skinSample.category, 'skin-tone-sample');
assert.ok(skinSample.targetDeltaC <= 1.5);
assert.ok(skinSample.maxAbsDeltaH <= 3);

const tomato = PROFILES.resolveMaterialPreference({
    id: 'food_tomato_red',
    category: 'food'
}, 'recommended', null);
assert.ok(tomato.targetDeltaC >= 5);
assert.ok(tomato.maxAbsDeltaH <= 4);

const builtInIds = MATERIALS.listMaterials().map(material => material.id)
    .concat(DINING.listMaterials().map(material => material.id)).sort();
builtInIds.forEach(materialId => {
    assert.ok(PROFILES.materialProfiles[materialId],
        materialId + ' must have an explicit preference profile');
});

const memory = new Map();
const storage = {
    getItem: key => memory.has(key) ? memory.get(key) : null,
    setItem: (key, value) => memory.set(key, value),
    removeItem: key => memory.delete(key)
};

assert.deepEqual(PROFILES.loadOverrides(storage), {});
const saved = PROFILES.saveOverride('wood_warm_oak', {
    importance: 1.3,
    levels: { recommended: { targetDeltaC: 4.4 } }
}, storage);
assert.equal(saved.ok, true);
assert.equal(PROFILES.loadOverrides(storage).wood_warm_oak.importance, 1.3);
assert.equal(PROFILES.loadOverrides(storage).wood_warm_oak.levels.recommended.targetDeltaC, 4.4);

const invalid = PROFILES.validatePreferenceOverride({
    levels: { recommended: { targetDeltaC: 99 } }
});
assert.equal(invalid.ok, false);
assert.match(invalid.errors.join(' '), /targetDeltaC/);

const invalidLevel = PROFILES.validatePreferenceOverride({
    levels: { extreme: { targetDeltaC: 4 } }
});
assert.equal(invalidLevel.ok, false);
assert.match(invalidLevel.errors.join(' '), /extreme/);

const removed = PROFILES.removeOverride('wood_warm_oak', storage);
assert.equal(removed.ok, true);
assert.equal(PROFILES.loadOverrides(storage).wood_warm_oak, undefined);

memory.set(PROFILES.STORAGE_KEY, '{broken');
assert.deepEqual(PROFILES.loadOverrides(storage), {}, 'malformed storage must fail closed');

console.log('material preference profile tests passed', {
    materialCount: builtInIds.length,
    oak: resolved,
    neutral,
    foodBeef,
    skinSample,
    tomato
});
