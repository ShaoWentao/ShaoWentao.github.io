'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');

const index = fs.readFileSync('index.html', 'utf8');
const app = fs.readFileSync('app.js', 'utf8');
const exporter = fs.readFileSync('recipe-batch-export.js', 'utf8');
const css = fs.readFileSync('layout-final.css', 'utf8');

assert.match(index, /xlsx-workbook\.js/);
assert.match(index, /batch-recipe-export\.js/);
assert.match(index, /recipe-batch-export\.js/);
assert.ok(index.indexOf('xlsx-workbook.js') < index.indexOf('recipe-batch-export.js'));
assert.ok(index.indexOf('batch-recipe-export.js') < index.indexOf('recipe-batch-export.js'));
assert.ok(index.indexOf('recipe-batch-export.js') < index.indexOf('app.js'));

[
    'recipe-export-dialog',
    'recipe-export-single',
    'recipe-export-batch',
    'recipe-export-start',
    'recipe-export-cancel',
    'recipe-export-close',
    'recipe-export-progress',
    'recipe-export-progress-text'
].forEach(id => assert.match(exporter, new RegExp(id), `missing export dialog contract ${id}`));

assert.match(exporter, /buildBatchWorkbookSpec/);
assert.match(exporter, /buildSingleWorkbookSpec/);
assert.match(exporter, /downloadWorkbook/);
assert.match(exporter, /1600/);
assert.match(exporter, /12000/);
assert.match(exporter, /100/);
assert.match(exporter, /cancel/i);
assert.match(app, /RECIPE_BATCH_EXPORT\.initialize/);
assert.match(app, /buildRegularRecipe/);
assert.match(app, /buildMetamerRecipe/);
assert.match(app, /buildPastelRecipe/);
assert.match(app, /buildSceneRecipe/);
assert.match(app, /buildBrightnessRecipe/);
assert.match(app, /spectralReferenceId:\s*brightnessRecipeId/);
assert.match(app, /brightnessSpd/);
assert.match(app, /spectralScaleBasis/);
assert.match(exporter, /亮度配方/);
assert.match(exporter, /亮度光谱/);
assert.match(exporter, /100%、75%、50%、25%、10%、5%、1%/);
assert.match(css, /\.recipe-export-dialog/);
assert.match(css, /\.recipe-export-progress/);

assert.doesNotMatch(app, /exportRecipeBtn\.addEventListener\('click',\s*exportCurrentRecipe\)/,
    'button must no longer trigger legacy JSON export directly');

console.log('recipe export dialog contract tests passed');
