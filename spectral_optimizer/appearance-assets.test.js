'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const MATERIALS = require('./material-reflectance-data.js');
const DINING = require('./dining-light-data.js');

const materialAtlas = path.join(__dirname, 'assets', 'material-texture-atlas.png');
assert.ok(fs.existsSync(materialAtlas), 'the original seven-cell material renderer atlas must remain local');
assert.ok(fs.statSync(materialAtlas).size > 500000, 'material renderer atlas must retain detailed image data');

const materialIds = [
    'wood_warm_oak', 'wood_dark_walnut', 'leather_cognac', 'fabric_warm_beige',
    'leaf_green', 'skin_tone_sample', 'neutral_wall_matte'
];
const materials = MATERIALS.listMaterials();
assert.deepEqual(materials.map(item => item.id), materialIds);
materials.forEach((material, index) => {
    assert.equal(material.appearanceSource.file, 'assets/material-texture-atlas.png');
    assert.deepEqual(material.appearanceSource.atlasGrid, [7, 1]);
    assert.deepEqual(material.appearanceSource.atlasPosition, [index, 0]);
    assert.doesNotMatch(material.appearanceSource.file, /https?:\/\//);
});

const foods = DINING.listMaterials();
assert.equal(foods.length, 7);
const reliableFoodAssets = {
    food_grilled_beef: 'assets/appearance/foods/red-brown-cooked-meat.webp',
    food_tomato_red: 'assets/appearance/foods/vivid-red-produce.webp',
    food_salmon: 'assets/appearance/foods/orange-pink-fish.webp',
    food_leafy_green: 'assets/appearance/foods/deep-green-leaves.webp',
    food_white_rice: 'assets/appearance/foods/neutral-light-staple.webp',
    food_golden_bread: 'assets/appearance/foods/golden-baked-crust.webp',
    food_coffee_dark: 'assets/appearance/foods/dark-brown-roasted.webp'
};
assert.equal(new Set(Object.values(reliableFoodAssets)).size, foods.length);
foods.forEach(material => {
    assert.equal(material.appearanceSource.type, 'photo-reference');
    assert.equal(material.appearanceSource.file, reliableFoodAssets[material.id]);
    assert.equal(Object.hasOwn(material.appearanceSource, 'atlasGrid'), false);
    assert.equal(Object.hasOwn(material.appearanceSource, 'atlasPosition'), false);
    const filePath = path.join(__dirname, material.appearanceSource.file);
    assert.ok(fs.existsSync(filePath), material.id + ' photo reference must be stored locally');
    assert.ok(fs.statSync(filePath).size > 40000, material.id + ' photograph must retain useful detail');
});

const manifest = fs.readFileSync(path.join(__dirname, 'assets', 'appearance', 'SOURCES.md'), 'utf8');
assert.match(manifest, /red-brown-cooked-meat\.webp/);
assert.match(manifest, /vivid-red-produce\.webp/);
assert.match(manifest, /dark-brown-roasted\.webp/);

console.log('appearance asset tests passed', { materials: materials.length, foods: foods.length });
