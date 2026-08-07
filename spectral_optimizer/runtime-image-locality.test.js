'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const DINING = require('./dining-light-data.js');
const MUSEUM = require('./museum-light-data.js');

function assertLocalRuntimeImage(owner, source) {
    assert.ok(source && typeof source.file === 'string', owner + ' must provide an image file');
    assert.doesNotMatch(source.file, /^https?:\/\//i, owner + ' must not load its runtime image from the network');
    const absolutePath = path.join(__dirname, source.file);
    assert.ok(fs.existsSync(absolutePath), owner + ' local image must exist: ' + source.file);
    assert.ok(fs.statSync(absolutePath).size > 1000, owner + ' local image must contain useful image data');
}

DINING.listMaterials().forEach(item => assertLocalRuntimeImage(item.id, item.appearanceSource));
MUSEUM.listExhibits().forEach(item => assertLocalRuntimeImage(item.id, item.appearanceSource));

console.log('runtime image locality tests passed', {
    diningImages: DINING.listMaterials().length,
    museumImages: MUSEUM.listExhibits().length
});
