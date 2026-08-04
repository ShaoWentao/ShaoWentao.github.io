'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const DINING = require('./dining-light-data.js');

const materials = DINING.listMaterials();
const profiles = DINING.listProfiles();

assert.equal(materials.length, 7, 'dining library must expose seven focused food materials');
assert.deepEqual(materials.map(item => item.id), [
    'food_grilled_beef', 'food_tomato_red', 'food_salmon', 'food_leafy_green',
    'food_white_rice', 'food_golden_bread', 'food_coffee_dark'
]);
assert.equal(profiles.length, 7, 'dining library must expose seven scene profiles');
assert.equal(new Set(materials.map(item => item.id)).size, materials.length, 'material IDs must be unique');
assert.equal(new Set(profiles.map(item => item.id)).size, profiles.length, 'profile IDs must be unique');

const appearanceFiles = materials.map(material => material.appearanceSource.file);
assert.equal(new Set(appearanceFiles).size, 7, 'each food category must use its own photograph');
materials.forEach(material => {
    assert.equal(material.category, 'food');
    assert.equal(material.reflectance.length, 81, material.id + ' must have 81 reflectance samples');
    assert.ok(material.reflectance.every(value => Number.isFinite(value) && value >= 0 && value <= 1),
        material.id + ' reflectance must remain within 0–1');
    assert.equal(material.spectralSource.type, 'engineering');
    assert.match(material.spectralSource.dataQualification, /工程/);
    assert.equal(material.appearanceSource.type, 'photo-reference');
    assert.match(material.appearanceSource.file, /^assets\/appearance\/foods\/[a-z-]+\.webp$/);
    assert.equal(Object.hasOwn(material.appearanceSource, 'atlasGrid'), false);
    assert.equal(Object.hasOwn(material.appearanceSource, 'atlasPosition'), false);
    assert.equal(fs.existsSync(path.join(__dirname, material.appearanceSource.file)), true,
        material.id + ' photograph must exist');
});

const materialIds = new Set(materials.map(item => item.id));
const standardCctByProfile = {
    balanced_dining: 3500,
    hotpot_barbecue: 3000,
    japanese_seafood: 4000,
    bakery_coffee: 3000,
    fine_dining: 2700,
    bar_atmosphere: 2700,
    camera_friendly: 4000
};
const standardCctSet = new Set([2700, 3000, 3500, 4000]);

profiles.forEach(profile => {
    assert.ok(profile.materialIds.length >= 4, profile.id + ' must include a useful material set');
    assert.ok(profile.materialIds.every(id => materialIds.has(id)), profile.id + ' references unknown materials');
    assert.equal(profile.recommendedCct, standardCctByProfile[profile.id]);
    assert.ok(standardCctSet.has(profile.recommendedCct), profile.id + ' must use a common fixed-CCT luminaire value');
    assert.equal(profile.cctRange.length, 2);
    assert.ok(profile.recommendedCct >= profile.cctRange[0] && profile.recommendedCct <= profile.cctRange[1]);
    assert.ok(Number.isFinite(profile.recommendedDuv));
    assert.ok(profile.materialIds.every(id => Number.isFinite(profile.importanceByMaterialId[id])));
});

const camera = DINING.getProfile('camera_friendly');
assert.equal(camera.cameraProxy, true);
assert.ok(camera.materialIds.includes('food_white_rice'));
assert.ok(camera.materialIds.includes('food_leafy_green'));
assert.ok(camera.materialIds.every(id => materialIds.has(id)));
assert.match(camera.noteCN, /相机|手机|代理模型/);

const hotpotOverrides = DINING.profileOverrides('hotpot_barbecue', 'recommended');
assert.ok(hotpotOverrides.food_tomato_red.importance > hotpotOverrides.food_white_rice.importance);
assert.ok(hotpotOverrides.food_tomato_red.levels.recommended.targetDeltaC > 5);
assert.ok(hotpotOverrides.food_white_rice.levels.recommended.maxDeltaE00 <= 4);

const soft = DINING.profileOverrides('balanced_dining', 'soft');
const vivid = DINING.profileOverrides('balanced_dining', 'vivid');
assert.ok(soft.food_grilled_beef.levels.soft.targetDeltaC < vivid.food_grilled_beef.levels.vivid.targetDeltaC);

assert.equal(DINING.getMaterial('missing'), null);
assert.equal(DINING.getProfile('missing'), null);
assert.deepEqual(DINING.profileOverrides('missing', 'recommended'), {});

console.log('dining light data tests passed', {
    materials: materials.length,
    profiles: profiles.map(profile => profile.id)
});
