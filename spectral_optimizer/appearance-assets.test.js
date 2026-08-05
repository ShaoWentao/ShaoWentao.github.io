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

const dishes = DINING.listMaterials();
assert.equal(dishes.length, 12);
assert.equal(new Set(dishes.map(dish => dish.appearanceSource.file)).size, 12,
    'each dish visual type must use a distinct concrete dish photograph');
const expectedSourcePages = {
    dish_red_braised_meat: /pexels.*8256988/i,
    dish_red_chili_oil: /ifeng/i,
    dish_golden_fried: /pexels.*11502306/i,
    dish_dark_roasted_meat: /commons\.wikimedia.*Roasted_goose/i,
    dish_orange_pink_seafood: /pexels.*17584591/i,
    dish_silver_steamed_seafood: /sohu.*613719948/i,
    dish_pale_poultry: /pexels.*30120279/i,
    dish_green_vegetable: /pexels.*36108993/i,
    dish_pale_tofu_mushroom: /pexels.*5182122/i,
    dish_dark_sauce_mushroom: /wokandkin/i,
    dish_multicolor_plating: /pexels.*34664681/i,
    dish_soup_hotpot: /rotei-shinsaibashi|roteigi-osaka/i
};
dishes.forEach(dish => {
    const source = dish.appearanceSource;
    assert.equal(source.type, 'photo-reference');
    assert.match(source.file, /^https:\/\/images\.weserv\.nl\/\?url=/,
        dish.id + ' must use the CORS-safe macro-image endpoint');
    assert.match(source.file, /&precrop(?:&|$)/,
        dish.id + ' must crop before resize');
    assert.match(source.file, /&cw=\d+%25&ch=\d+%25/,
        dish.id + ' must use a close-up crop smaller than the full dish');
    assert.match(source.sourcePage, expectedSourcePages[dish.id]);
    assert.match(source.label, /局部特写/);
    assert.match(source.fallbackFile, /^assets\/appearance\/foods\/[a-z-]+\.webp$/);
    const fallbackPath = path.join(__dirname, source.fallbackFile);
    assert.ok(fs.existsSync(fallbackPath), dish.id + ' local fallback must be stored in the project');
    assert.ok(fs.statSync(fallbackPath).size > 40000, dish.id + ' fallback must retain useful image detail');
});
assert.match(DINING.getMaterial('dish_silver_steamed_seafood').appearanceSource.file,
    /p8\.itc\.cn.*051814e508e146cdacfb81f05af2acaa\.jpeg/,
    'silver steamed seafood must use the exact third image confirmed by the user');
assert.match(DINING.getMaterial('dish_multicolor_plating').representativeDishesCN, /水果/,
    'the multicolour category must recommend a multicolour fruit platter');

const manifest = fs.readFileSync(path.join(__dirname, 'assets', 'appearance', 'SOURCES.md'), 'utf8');
[
    '红烧肉局部特写', '水煮肉片鲜红辣油局部特写', '炸鸡脆皮局部特写',
    '烧鹅烤制表皮局部特写', '三文鱼橙粉鱼肉局部特写', '清蒸鱼银灰鱼皮与白色鱼肉局部特写',
    '白切鸡浅色熟肉局部特写', '炒青菜翠绿叶片局部特写', '豆腐菌菇浅色表面局部特写',
    '熟黑椒牛肉酱汁局部特写', '多色水果拼盘局部特写', '沸腾红油火锅局部特写'
].forEach(label => assert.match(manifest, new RegExp(label)));
assert.match(manifest, /images\.weserv\.nl/);
assert.match(manifest, /本地备用图/);

console.log('appearance asset tests passed', {
    materials: materials.length,
    dishes: dishes.length,
    concreteDishPhotos: dishes.length,
    localFallbacks: dishes.length
});
