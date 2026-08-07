'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const DINING = require('./dining-light-data.js');

const expectedDishIds = [
    'dish_red_braised_meat',
    'dish_red_chili_oil',
    'dish_golden_fried',
    'dish_dark_roasted_meat',
    'dish_orange_pink_seafood',
    'dish_silver_steamed_seafood',
    'dish_pale_poultry',
    'dish_green_vegetable',
    'dish_pale_tofu_mushroom',
    'dish_dark_sauce_mushroom',
    'dish_multicolor_plating',
    'dish_soup_hotpot'
];
const paleControlIds = new Set([
    'dish_silver_steamed_seafood',
    'dish_pale_poultry',
    'dish_pale_tofu_mushroom'
]);
const expectedCuisineIds = [
    'comprehensive', 'sichuan_hunan', 'cantonese', 'jiangzhe_huaiyang',
    'shandong', 'fujian', 'anhui', 'beijing', 'northeast', 'northwest',
    'yunnan_guizhou', 'japanese', 'korean', 'southeast_asian', 'western',
    'barbecue', 'hotpot'
];

const materials = DINING.listMaterials();
const cuisines = DINING.listCuisineProfiles();

assert.equal(materials.length, 12, 'dining library must expose twelve dish visual types');
assert.deepEqual(materials.map(item => item.id), expectedDishIds);
assert.equal(cuisines.length, 17, 'dining library must expose seventeen cuisine or dining-type profiles');
assert.deepEqual(cuisines.map(item => item.id), expectedCuisineIds);
assert.equal(typeof DINING.listProfiles, 'undefined', 'application-scene API must no longer be public');
assert.equal(typeof DINING.getProfile, 'undefined', 'application-scene lookup must no longer be public');
assert.equal(new Set(materials.map(item => item.id)).size, materials.length);
assert.equal(new Set(cuisines.map(item => item.id)).size, cuisines.length);

const materialIds = new Set(expectedDishIds);
const localFiles = new Set();
materials.forEach(material => {
    assert.equal(material.category, 'food');
    assert.equal(material.reflectance.length, 81, material.id + ' must have 81 reflectance samples');
    assert.ok(material.reflectance.every(value => Number.isFinite(value) && value >= 0 && value <= 1));
    assert.equal(material.spectralSource.type, 'engineering');
    assert.match(material.spectralSource.dataQualification, /工程/);
    assert.ok(material.representativeDishesCN, material.id + ' must identify representative finished dishes');
    assert.doesNotMatch(material.nameCN + material.intendedUseCN, /主食|咖啡豆|单片|原材料/);

    const appearance = material.appearanceSource;
    assert.equal(appearance.type, 'photo-reference');
    assert.equal(appearance.file, 'assets/appearance/dining/' + material.id + '.jpg');
    assert.doesNotMatch(appearance.file, /^https?:\/\//);
    assert.match(appearance.sourcePage, /^https:\/\//);
    assert.match(appearance.label, /局部特写/);
    assert.equal(appearance.fallbackFile, '');
    assert.equal(fs.existsSync(path.join(__dirname, appearance.file)), true,
        material.id + ' local photograph must exist');
    localFiles.add(appearance.file);
});
assert.equal(localFiles.size, 12, 'each dish type must use a distinct local dish photograph');

const standardCctSet = new Set([2700, 3000, 3500, 4000]);
cuisines.forEach(cuisine => {
    assert.ok(cuisine.dishTypeIds.length >= 5, cuisine.id + ' must include a useful dish set');
    assert.ok(cuisine.dishTypeIds.every(id => materialIds.has(id)), cuisine.id + ' references an unknown dish');
    assert.ok(cuisine.dishTypeIds.some(id => paleControlIds.has(id)), cuisine.id + ' must include a pale control dish');
    assert.ok(cuisine.dishTypeIds.every(id => Number.isFinite(cuisine.importanceByDishTypeId[id])));
    assert.ok(standardCctSet.has(cuisine.recommendedCct));
    assert.equal(cuisine.cctRange.length, 2);
    assert.ok(cuisine.recommendedCct >= cuisine.cctRange[0] && cuisine.recommendedCct <= cuisine.cctRange[1]);
    assert.ok(Number.isFinite(cuisine.recommendedDuv));
});

assert.deepEqual(DINING.resolveMaterialIds('japanese'), [
    'dish_orange_pink_seafood', 'dish_silver_steamed_seafood', 'dish_green_vegetable',
    'dish_pale_tofu_mushroom', 'dish_multicolor_plating'
]);
assert.deepEqual(DINING.resolveMaterialIds('comprehensive'), expectedDishIds);
assert.deepEqual(DINING.resolveMaterialIds('missing'), []);

const sichuanOverrides = DINING.profileOverrides('sichuan_hunan', 'recommended');
assert.deepEqual(Object.keys(sichuanOverrides), DINING.resolveMaterialIds('sichuan_hunan'));
assert.ok(sichuanOverrides.dish_red_chili_oil.importance > sichuanOverrides.dish_pale_tofu_mushroom.importance);
assert.ok(sichuanOverrides.dish_red_chili_oil.levels.recommended.targetDeltaC > 5);
assert.ok(sichuanOverrides.dish_pale_tofu_mushroom.levels.recommended.maxDeltaE00 <= 4.5);

const soft = DINING.profileOverrides('comprehensive', 'soft');
const vivid = DINING.profileOverrides('comprehensive', 'vivid');
assert.ok(soft.dish_red_braised_meat.levels.soft.targetDeltaC < vivid.dish_red_braised_meat.levels.vivid.targetDeltaC);

assert.equal(DINING.getCuisineProfile('sichuan_hunan').recommendedCct, 3000);
assert.equal(DINING.getCuisineProfile('sichuan_hunan').recommendedDuv, -0.0005);
assert.equal(DINING.getCuisineProfile('japanese').recommendedCct, 4000);
assert.equal(DINING.getCuisineProfile('western').recommendedCct, 2700);

assert.equal(DINING.migrateTemplateId('food_grilled_beef'), 'dish_red_braised_meat');
assert.equal(DINING.migrateTemplateId('food_white_rice'), 'dish_pale_tofu_mushroom');
assert.equal(DINING.migrateTemplateId('dish_green_vegetable'), 'dish_green_vegetable');
assert.equal(DINING.getMaterial('food_salmon').id, 'dish_orange_pink_seafood');
assert.equal(DINING.getMaterial('missing'), null);
assert.equal(DINING.getCuisineProfile('missing'), null);
assert.deepEqual(DINING.profileOverrides('missing', 'recommended'), {});

console.log('dining light data tests passed', {
    materials: materials.length,
    cuisines: cuisines.length,
    applicationSceneApiRemoved: true
});
