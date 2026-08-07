'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const MUSEUM = require('./museum-light-data.js');

const qualification = '工程反射率模型，用于算法验证，不代表真实文物实测数据。';
const ceramicIds = [
    'glaze_white',
    'cobalt_light',
    'cobalt_deep',
    'blue_white_transition',
    'glaze_shadow',
    'neutral_control'
];
const inkIds = [
    'paper_warm',
    'ink_light',
    'ink_mid',
    'ink_deep',
    'seal_red',
    'paper_shadow'
];
const bronzeIds = [
    'bronze_base',
    'patina_green',
    'patina_light',
    'bronze_highlight',
    'relief_recess',
    'bronze_shadow'
];
const jadeIds = [
    'jade_body',
    'jade_milky_light',
    'jade_green_transition',
    'jade_translucent_edge',
    'jade_polished_highlight',
    'jade_carved_recess'
];
const lacquerIds = [
    'lacquer_black_body',
    'lacquer_deep_black',
    'maki_gold_bright',
    'maki_gold_aged',
    'lacquer_vermilion',
    'lacquer_surface_detail'
];
const textileIds = [
    'textile_ground_warm',
    'textile_red_pink',
    'textile_blue_green',
    'textile_golden_thread',
    'textile_dark_thread',
    'textile_stitch_highlight'
];
const cloisonneIds = [
    'cloisonne_ground_light',
    'cloisonne_cobalt_blue',
    'cloisonne_blue_green',
    'cloisonne_red',
    'cloisonne_yellow',
    'cloisonne_gilt_wire'
];
const guanyinIds = [
    'guanyin_skin',
    'guanyin_warm_red',
    'guanyin_gilt',
    'guanyin_blue_green_pigment',
    'guanyin_dark_wood_recess',
    'guanyin_quartz_highlight'
];
const oilIds = [
    'oil_light_petals',
    'oil_red_orange',
    'oil_yellow_gold',
    'oil_green_foliage',
    'oil_blue_violet',
    'oil_dark_background'
];
const expectedIds = ceramicIds.concat(inkIds, bronzeIds, jadeIds, lacquerIds, textileIds, cloisonneIds, guanyinIds, oilIds);

assert.deepEqual(MUSEUM.wavelengths, Array.from({ length: 81 }, (_, index) => 380 + index * 5));
assert.equal(MUSEUM.dataQualification, qualification);

const samples = MUSEUM.listSamples();
assert.deepEqual(samples.map(sample => sample.id), expectedIds);
assert.equal(samples.length, 54);
assert.equal(new Set(samples.map(sample => sample.nameCN)).size, 54);

samples.forEach(sample => {
    assert.equal(sample.reflectance.length, 81, sample.id + ' must contain 81 reflectance values');
    assert.ok(sample.reflectance.every(value => Number.isFinite(value) && value >= 0 && value <= 1));
    assert.ok(Number.isFinite(sample.weight) && sample.weight > 0);
    assert.ok(sample.colourRoleCN.length > 8);
    assert.ok(Number.isFinite(sample.allowedDeltaE00) && sample.allowedDeltaE00 > 0);
    assert.ok(Number.isFinite(sample.allowedDeltaH) && sample.allowedDeltaH > 0);
    assert.ok(Number.isFinite(sample.targetDeltaC));
    assert.equal(sample.dataQualification, qualification);
    assert.ok(Object.isFrozen(sample));
    assert.ok(Object.isFrozen(sample.reflectance));
});

assert.ok(MUSEUM.getSample('glaze_white').reflectance[40] > MUSEUM.getSample('glaze_shadow').reflectance[40]);
assert.ok(MUSEUM.getSample('cobalt_light').reflectance[16] > MUSEUM.getSample('cobalt_deep').reflectance[16]);
assert.ok(MUSEUM.getSample('cobalt_deep').reflectance[16] > MUSEUM.getSample('cobalt_deep').reflectance[48]);

const exhibits = MUSEUM.listExhibits();
assert.deepEqual(exhibits.map(item => item.id), [
    'qinghua_porcelain_single',
    'ink_bird_bamboo',
    'bronze_food_vessel',
    'qingbai_jade_carving',
    'black_lacquer_gold_writing_box',
    'embroidered_birds_flowers_panel',
    'qing_qianlong_cloisonne_floral_vase',
    'northern_song_guanyin',
    'roesen_still_life_flowers_fruit'
]);
assert.equal(MUSEUM.getDefaultExhibit().id, 'qinghua_porcelain_single');

const exhibit = MUSEUM.getExhibit('qinghua_porcelain_single');
assert.equal(exhibit.nameCN, '青花瓷单展品');
assert.equal(exhibit.defaultSampleId, 'glaze_white');
assert.equal(exhibit.appearanceSource.type, 'local-transparent-cutout');
assert.equal(exhibit.appearanceSource.file, 'assets/appearance/museum/qinghua-porcelain-cutout.png');
assert.equal(fs.existsSync(path.join(__dirname, exhibit.appearanceSource.file)), true);
assert.match(exhibit.appearanceSource.notes, /透明底图.*展品主体/);
assert.deepEqual(exhibit.sampleIds, ceramicIds);
assert.deepEqual(MUSEUM.getExhibitSamples(exhibit.id).map(sample => sample.id), ceramicIds);
assert.equal(exhibit.previewProfile.classifier, 'blue-white-ceramic');
assert.deepEqual(exhibit.previewProfile.recognitionSampleIds, [
    'cobalt_light', 'cobalt_deep', 'blue_white_transition'
]);
assert.deepEqual(exhibit.findings.map(item => item.id), [
    'white', 'blueWhite', 'lightDeepBlue', 'blueHierarchy'
]);
assert.equal(exhibit.evaluationProfile.anchorSampleId, 'glaze_white');
assert.deepEqual(exhibit.evaluationProfile.hueControlSampleIds, ['cobalt_light', 'cobalt_deep']);
assert.deepEqual(exhibit.evaluationProfile.chromaSampleIds, [
    'cobalt_light', 'blue_white_transition', 'cobalt_deep'
]);
assert.deepEqual(exhibit.evaluationProfile.distinctionGroups.blueWhite.pairs, [
    ['glaze_white', 'cobalt_light'],
    ['glaze_white', 'cobalt_deep'],
    ['glaze_white', 'blue_white_transition']
]);
assert.equal(exhibit.evaluationProfile.distinctionGroups.blueHierarchy.aggregation, 'minimum');

const inkExhibit = MUSEUM.getExhibit('ink_bird_bamboo');
assert.equal(inkExhibit.nameCN, '纸本水墨花鸟');
assert.equal(inkExhibit.category, 'ink-painting');
assert.equal(inkExhibit.defaultSampleId, 'paper_warm');
assert.equal(inkExhibit.appearanceSource.type, 'local-artwork-image');
assert.equal(inkExhibit.appearanceSource.file, 'assets/appearance/museum/ink-bird-bamboo.jpg');
assert.equal(fs.existsSync(path.join(__dirname, inkExhibit.appearanceSource.file)), true);
assert.match(inkExhibit.appearanceSource.sourcePage, /^https:\/\/commons\.wikimedia\.org\//);
assert.match(inkExhibit.appearanceSource.licenseCN, /公共领域/);
assert.deepEqual(inkExhibit.sampleIds, inkIds);
assert.deepEqual(MUSEUM.getExhibitSamples(inkExhibit.id).map(sample => sample.id), inkIds);
assert.equal(inkExhibit.previewProfile.classifier, 'ink-on-paper');
assert.equal(inkExhibit.previewProfile.luminanceLock, 'anchor');
assert.equal(inkExhibit.previewProfile.regionMask.type, 'rle-json');
assert.equal(inkExhibit.previewProfile.regionMask.file, 'assets/appearance/museum/ink-bird-bamboo-regions.json');
assert.equal(fs.existsSync(path.join(__dirname, inkExhibit.previewProfile.regionMask.file)), true);
assert.deepEqual(inkExhibit.previewProfile.regionMask.sampleIds, inkIds);
assert.deepEqual(inkExhibit.previewProfile.recognitionSampleIds, [
    'paper_shadow', 'ink_light', 'ink_mid', 'ink_deep', 'seal_red'
]);
assert.deepEqual(inkExhibit.findings.map(item => item.id), [
    'paper', 'paperInk', 'inkHierarchy', 'sealContrast'
]);
assert.equal(inkExhibit.evaluationProfile.anchorSampleId, 'paper_warm');
assert.deepEqual(inkExhibit.evaluationProfile.hueControlSampleIds, ['seal_red']);
assert.deepEqual(inkExhibit.evaluationProfile.chromaSampleIds, ['seal_red']);
assert.equal(inkExhibit.evaluationProfile.distinctionGroups.inkHierarchy.aggregation, 'minimum');
assert.ok(MUSEUM.getSample('paper_warm').reflectance[40] > MUSEUM.getSample('ink_light').reflectance[40]);
assert.ok(MUSEUM.getSample('ink_light').reflectance[40] > MUSEUM.getSample('ink_mid').reflectance[40]);
assert.ok(MUSEUM.getSample('ink_mid').reflectance[40] > MUSEUM.getSample('ink_deep').reflectance[40]);
assert.ok(MUSEUM.getSample('seal_red').reflectance[56] > MUSEUM.getSample('seal_red').reflectance[20]);
assert.ok(inkExhibit.previewProfile.localRecognition.ink_deep.contrast >= 0.2);
const inkLowLightDisplay = inkExhibit.previewProfile.displayAdjustments['low-light-recognition'];
assert.ok(inkLowLightDisplay.optimized.spectralGain >= 0.25 && inkLowLightDisplay.optimized.spectralGain <= 0.32);
assert.ok(inkLowLightDisplay.optimized.recognitionBoost >= 0.85 && inkLowLightDisplay.optimized.recognitionBoost <= 1);
assert.ok(inkLowLightDisplay.optimized.contrast <= 1.02);

const bronzeExhibit = MUSEUM.getExhibit('bronze_food_vessel');
assert.equal(bronzeExhibit.nameCN, '青铜纹饰食器');
assert.equal(bronzeExhibit.category, 'bronze');
assert.equal(bronzeExhibit.defaultSampleId, 'bronze_base');
assert.equal(bronzeExhibit.appearanceSource.type, 'local-transparent-cutout');
assert.equal(bronzeExhibit.appearanceSource.file, 'assets/appearance/museum/bronze-vessel-cutout.png');
assert.equal(fs.existsSync(path.join(__dirname, bronzeExhibit.appearanceSource.file)), true);
assert.match(bronzeExhibit.appearanceSource.sourcePage, /^https:\/\/commons\.wikimedia\.org\//);
assert.match(bronzeExhibit.appearanceSource.licenseCN, /CC0|公共领域/);
assert.deepEqual(bronzeExhibit.sampleIds, bronzeIds);
assert.deepEqual(MUSEUM.getExhibitSamples(bronzeExhibit.id).map(sample => sample.id), bronzeIds);
assert.equal(bronzeExhibit.previewProfile.classifier, 'bronze-patina');
assert.equal(bronzeExhibit.previewProfile.backgroundMode, undefined);
assert.deepEqual(bronzeExhibit.previewProfile.recognitionSampleIds, [
    'patina_green', 'patina_light', 'bronze_highlight', 'relief_recess'
]);
assert.ok(bronzeExhibit.previewProfile.localRecognition.patina_green.contrast >= 0.07);
assert.ok(bronzeExhibit.previewProfile.localRecognition.patina_green.contrast <= 0.12);
assert.ok(bronzeExhibit.previewProfile.localRecognition.patina_green.saturation <= 0.05);
assert.ok(bronzeExhibit.previewProfile.localRecognition.relief_recess.contrast >= 0.12);
assert.ok(bronzeExhibit.previewProfile.localRecognition.relief_recess.contrast <= 0.2);
const bronzeLowLightDisplay = bronzeExhibit.previewProfile.displayAdjustments['low-light-recognition'];
assert.ok(bronzeLowLightDisplay.current.blurPx <= 0.15);
assert.ok(bronzeLowLightDisplay.optimized.blurPx <= 0.05);
assert.ok(bronzeLowLightDisplay.optimized.saturation <= 1.03);
assert.ok(bronzeLowLightDisplay.optimized.contrast <= 1.08);
assert.ok(bronzeLowLightDisplay.optimized.spectralGain >= 0.18 && bronzeLowLightDisplay.optimized.spectralGain <= 0.25);
assert.ok(bronzeLowLightDisplay.optimized.recognitionBoost >= 0.65 && bronzeLowLightDisplay.optimized.recognitionBoost <= 0.85);
assert.deepEqual(bronzeExhibit.findings.map(item => item.id), [
    'bronzeTone', 'patinaMetal', 'patinaHierarchy', 'reliefDetail'
]);
assert.equal(bronzeExhibit.evaluationProfile.anchorSampleId, 'bronze_base');
assert.deepEqual(bronzeExhibit.evaluationProfile.hueControlSampleIds, [
    'patina_green', 'patina_light', 'bronze_highlight'
]);
assert.deepEqual(bronzeExhibit.evaluationProfile.chromaSampleIds, [
    'patina_green', 'patina_light', 'bronze_highlight'
]);
assert.equal(bronzeExhibit.evaluationProfile.distinctionGroups.reliefDetail.aggregation, 'minimum');
assert.ok(MUSEUM.getSample('patina_light').reflectance[28] > MUSEUM.getSample('patina_green').reflectance[28]);
assert.ok(MUSEUM.getSample('bronze_highlight').reflectance[48] > MUSEUM.getSample('bronze_base').reflectance[48]);
assert.ok(MUSEUM.getSample('bronze_base').reflectance[40] > MUSEUM.getSample('relief_recess').reflectance[40]);

const jadeExhibit = MUSEUM.getExhibit('qingbai_jade_carving');
assert.equal(jadeExhibit.nameCN, '青白玉雕件');
assert.equal(jadeExhibit.category, 'jade');
assert.equal(jadeExhibit.defaultSampleId, 'jade_body');
assert.equal(jadeExhibit.appearanceSource.type, 'local-transparent-cutout');
assert.equal(jadeExhibit.appearanceSource.file, 'assets/appearance/museum/qingbai-jade-carving-cutout.png');
assert.equal(fs.existsSync(path.join(__dirname, jadeExhibit.appearanceSource.file)), true);
assert.match(jadeExhibit.appearanceSource.sourcePage, /^https:\/\/www\.metmuseum\.org\//);
assert.match(jadeExhibit.appearanceSource.licenseCN, /公共领域/);
assert.deepEqual(jadeExhibit.sampleIds, jadeIds);
assert.deepEqual(MUSEUM.getExhibitSamples(jadeExhibit.id).map(sample => sample.id), jadeIds);
assert.equal(jadeExhibit.previewProfile.classifier, 'qingbai-jade');
assert.equal(jadeExhibit.previewProfile.luminanceLock, 'anchor');
assert.equal(jadeExhibit.previewProfile.backgroundMode, undefined);
assert.deepEqual(jadeExhibit.previewProfile.recognitionSampleIds, [
    'jade_milky_light', 'jade_green_transition', 'jade_translucent_edge',
    'jade_polished_highlight', 'jade_carved_recess'
]);
assert.deepEqual(jadeExhibit.findings.map(item => item.id), [
    'jadeTone', 'jadeLayers', 'jadeTranslucency', 'jadeCarving'
]);
assert.equal(jadeExhibit.evaluationProfile.anchorSampleId, 'jade_body');
assert.equal(jadeExhibit.evaluationProfile.distinctionGroups.jadeCarving.aggregation, 'minimum');
assert.ok(MUSEUM.getSample('jade_polished_highlight').reflectance[40] > MUSEUM.getSample('jade_body').reflectance[40]);
assert.ok(MUSEUM.getSample('jade_body').reflectance[40] > MUSEUM.getSample('jade_carved_recess').reflectance[40]);
assert.ok(MUSEUM.getSample('jade_green_transition').reflectance[28] > MUSEUM.getSample('jade_green_transition').reflectance[52]);

const lacquerExhibit = MUSEUM.getExhibit('black_lacquer_gold_writing_box');
assert.equal(lacquerExhibit.nameCN, '黑漆金银莳绘砚箱');
assert.equal(lacquerExhibit.category, 'lacquerware');
assert.equal(lacquerExhibit.defaultSampleId, 'lacquer_black_body');
assert.equal(lacquerExhibit.appearanceSource.type, 'local-transparent-cutout');
assert.equal(lacquerExhibit.appearanceSource.file, 'assets/appearance/museum/black-lacquer-gold-writing-box-cutout.png');
assert.equal(fs.existsSync(path.join(__dirname, lacquerExhibit.appearanceSource.file)), true);
assert.match(lacquerExhibit.appearanceSource.sourcePage, /^https:\/\/www\.metmuseum\.org\//);
assert.match(lacquerExhibit.appearanceSource.licenseCN, /公共领域/);
assert.deepEqual(lacquerExhibit.sampleIds, lacquerIds);
assert.deepEqual(MUSEUM.getExhibitSamples(lacquerExhibit.id).map(sample => sample.id), lacquerIds);
assert.equal(lacquerExhibit.previewProfile.classifier, 'black-lacquer-gold');
assert.equal(lacquerExhibit.previewProfile.luminanceLock, 'anchor');
assert.equal(lacquerExhibit.previewProfile.backgroundMode, undefined);
assert.deepEqual(lacquerExhibit.previewProfile.recognitionSampleIds, [
    'lacquer_deep_black', 'maki_gold_bright', 'maki_gold_aged',
    'lacquer_vermilion', 'lacquer_surface_detail'
]);
assert.deepEqual(lacquerExhibit.findings.map(item => item.id), [
    'lacquerTone', 'goldBlack', 'goldHierarchy', 'lacquerDetail'
]);
assert.equal(lacquerExhibit.evaluationProfile.anchorSampleId, 'lacquer_black_body');
assert.equal(lacquerExhibit.evaluationProfile.distinctionGroups.goldHierarchy.aggregation, 'minimum');
assert.equal(lacquerExhibit.evaluationProfile.distinctionGroups.lacquerDetail.aggregation, 'minimum');
assert.ok(MUSEUM.getSample('maki_gold_bright').reflectance[48] > MUSEUM.getSample('maki_gold_aged').reflectance[48]);
assert.ok(MUSEUM.getSample('maki_gold_aged').reflectance[48] > MUSEUM.getSample('lacquer_black_body').reflectance[48]);
assert.ok(MUSEUM.getSample('lacquer_black_body').reflectance[40] > MUSEUM.getSample('lacquer_deep_black').reflectance[40]);
assert.ok(MUSEUM.getSample('lacquer_vermilion').reflectance[56] > MUSEUM.getSample('lacquer_vermilion').reflectance[20]);

const textileExhibit = MUSEUM.getExhibit('embroidered_birds_flowers_panel');
assert.equal(textileExhibit.nameCN, '花鸟刺绣挂屏');
assert.equal(textileExhibit.category, 'textile');
assert.equal(textileExhibit.defaultSampleId, 'textile_ground_warm');
assert.equal(textileExhibit.appearanceSource.type, 'local-transparent-cutout');
assert.equal(textileExhibit.appearanceSource.file, 'assets/appearance/museum/embroidered-birds-flowers-panel-cutout.png');
assert.equal(fs.existsSync(path.join(__dirname, textileExhibit.appearanceSource.file)), true);
assert.match(textileExhibit.appearanceSource.sourcePage, /^https:\/\/www\.metmuseum\.org\//);
assert.match(textileExhibit.appearanceSource.licenseCN, /公共领域/);
assert.deepEqual(textileExhibit.sampleIds, textileIds);
assert.deepEqual(MUSEUM.getExhibitSamples(textileExhibit.id).map(sample => sample.id), textileIds);
assert.equal(textileExhibit.previewProfile.classifier, 'silk-embroidery');
assert.equal(textileExhibit.previewProfile.luminanceLock, 'anchor');
assert.equal(textileExhibit.previewProfile.backgroundMode, undefined);
assert.deepEqual(textileExhibit.previewProfile.recognitionSampleIds, [
    'textile_red_pink', 'textile_blue_green', 'textile_golden_thread',
    'textile_dark_thread', 'textile_stitch_highlight'
]);
assert.deepEqual(textileExhibit.findings.map(item => item.id), [
    'textileTone', 'textileColourSeparation', 'threadHierarchy', 'stitchDetail'
]);
assert.equal(textileExhibit.evaluationProfile.anchorSampleId, 'textile_ground_warm');
assert.equal(textileExhibit.evaluationProfile.distinctionGroups.threadHierarchy.aggregation, 'minimum');
assert.equal(textileExhibit.evaluationProfile.distinctionGroups.stitchDetail.aggregation, 'minimum');
assert.ok(MUSEUM.getSample('textile_stitch_highlight').reflectance[40] > MUSEUM.getSample('textile_ground_warm').reflectance[40]);
assert.ok(MUSEUM.getSample('textile_ground_warm').reflectance[40] > MUSEUM.getSample('textile_dark_thread').reflectance[40]);
assert.ok(MUSEUM.getSample('textile_red_pink').reflectance[56] > MUSEUM.getSample('textile_red_pink').reflectance[20]);
assert.ok(MUSEUM.getSample('textile_blue_green').reflectance[24] > MUSEUM.getSample('textile_blue_green').reflectance[56]);

const cloisonneExhibit = MUSEUM.getExhibit('qing_qianlong_cloisonne_floral_vase');
assert.equal(cloisonneExhibit.nameCN, '清乾隆掐丝珐琅花卉纹瓶');
assert.equal(cloisonneExhibit.category, 'cloisonne');
assert.equal(cloisonneExhibit.defaultSampleId, 'cloisonne_ground_light');
assert.equal(cloisonneExhibit.appearanceSource.type, 'local-transparent-cutout');
assert.equal(cloisonneExhibit.appearanceSource.file, 'assets/appearance/museum/qing-qianlong-cloisonne-floral-vase-cutout.png');
assert.equal(fs.existsSync(path.join(__dirname, cloisonneExhibit.appearanceSource.file)), true);
assert.match(cloisonneExhibit.appearanceSource.sourcePage, /^https:\/\/www\.metmuseum\.org\//);
assert.match(cloisonneExhibit.appearanceSource.licenseCN, /公共领域/);
assert.deepEqual(cloisonneExhibit.sampleIds, cloisonneIds);
assert.deepEqual(MUSEUM.getExhibitSamples(cloisonneExhibit.id).map(sample => sample.id), cloisonneIds);
assert.equal(cloisonneExhibit.previewProfile.classifier, 'cloisonne-enamel');
assert.equal(cloisonneExhibit.previewProfile.luminanceLock, 'anchor');
assert.equal(cloisonneExhibit.previewProfile.backgroundMode, undefined);
assert.deepEqual(cloisonneExhibit.previewProfile.recognitionSampleIds, [
    'cloisonne_cobalt_blue', 'cloisonne_blue_green', 'cloisonne_red',
    'cloisonne_yellow', 'cloisonne_gilt_wire'
]);
assert.deepEqual(cloisonneExhibit.findings.map(item => item.id), [
    'cloisonneTone', 'cloisonneColourSeparation', 'cloisonneBlueGreen', 'cloisonneWireDetail'
]);
assert.equal(cloisonneExhibit.evaluationProfile.anchorSampleId, 'cloisonne_ground_light');
assert.equal(cloisonneExhibit.evaluationProfile.distinctionGroups.cloisonneBlueGreen.aggregation, 'minimum');
assert.equal(cloisonneExhibit.evaluationProfile.distinctionGroups.cloisonneWireDetail.aggregation, 'minimum');
assert.ok(MUSEUM.getSample('cloisonne_ground_light').reflectance[40] > MUSEUM.getSample('cloisonne_cobalt_blue').reflectance[40]);
assert.ok(MUSEUM.getSample('cloisonne_blue_green').reflectance[26] > MUSEUM.getSample('cloisonne_blue_green').reflectance[56]);
assert.ok(MUSEUM.getSample('cloisonne_red').reflectance[58] > MUSEUM.getSample('cloisonne_red').reflectance[20]);
assert.ok(MUSEUM.getSample('cloisonne_gilt_wire').reflectance[50] > MUSEUM.getSample('cloisonne_yellow').reflectance[50]);

const guanyinExhibit = MUSEUM.getExhibit('northern_song_guanyin');
assert.equal(guanyinExhibit.nameCN, '北宋彩绘木雕观音菩萨像');
assert.equal(guanyinExhibit.category, 'painted-wood-sculpture');
assert.equal(guanyinExhibit.defaultSampleId, 'guanyin_skin');
assert.equal(guanyinExhibit.appearanceSource.type, 'local-transparent-cutout');
assert.equal(guanyinExhibit.appearanceSource.file, 'assets/appearance/museum/northern-song-guanyin-cutout.png');
assert.equal(fs.existsSync(path.join(__dirname, guanyinExhibit.appearanceSource.file)), true);
assert.match(guanyinExhibit.appearanceSource.sourcePage, /^https:\/\/www\.metmuseum\.org\//);
assert.match(guanyinExhibit.appearanceSource.licenseCN, /公共领域/);
assert.deepEqual(guanyinExhibit.sampleIds, guanyinIds);
assert.deepEqual(MUSEUM.getExhibitSamples(guanyinExhibit.id).map(sample => sample.id), guanyinIds);
assert.equal(guanyinExhibit.previewProfile.classifier, 'painted-wood-guanyin');
assert.equal(guanyinExhibit.previewProfile.luminanceLock, 'anchor');
assert.equal(guanyinExhibit.previewProfile.backgroundMode, undefined);
assert.deepEqual(guanyinExhibit.previewProfile.recognitionSampleIds, [
    'guanyin_warm_red', 'guanyin_gilt', 'guanyin_blue_green_pigment',
    'guanyin_dark_wood_recess', 'guanyin_quartz_highlight'
]);
assert.deepEqual(guanyinExhibit.findings.map(item => item.id), [
    'guanyinSkinTone', 'guanyinSkinGilt', 'guanyinPaintGilt', 'guanyinFacialDrapery'
]);
assert.equal(guanyinExhibit.evaluationProfile.anchorSampleId, 'guanyin_skin');
assert.equal(guanyinExhibit.evaluationProfile.distinctionGroups.guanyinPaintGilt.aggregation, 'average');
assert.equal(guanyinExhibit.evaluationProfile.distinctionGroups.guanyinFacialDrapery.aggregation, 'minimum');
assert.ok(MUSEUM.getSample('guanyin_quartz_highlight').reflectance[40] > MUSEUM.getSample('guanyin_skin').reflectance[40]);
assert.ok(MUSEUM.getSample('guanyin_skin').reflectance[40] > MUSEUM.getSample('guanyin_dark_wood_recess').reflectance[40]);
assert.ok(MUSEUM.getSample('guanyin_warm_red').reflectance[58] > MUSEUM.getSample('guanyin_warm_red').reflectance[20]);
assert.ok(MUSEUM.getSample('guanyin_blue_green_pigment').reflectance[26] > MUSEUM.getSample('guanyin_blue_green_pigment').reflectance[58]);
assert.ok(MUSEUM.getSample('guanyin_gilt').reflectance[50] > MUSEUM.getSample('guanyin_skin').reflectance[50]);

const oilExhibit = MUSEUM.getExhibit('roesen_still_life_flowers_fruit');
assert.equal(oilExhibit.nameCN, '花卉与水果静物油画');
assert.equal(oilExhibit.category, 'oil-painting');
assert.equal(oilExhibit.defaultSampleId, 'oil_light_petals');
assert.equal(oilExhibit.appearanceSource.type, 'local-artwork-image');
assert.equal(oilExhibit.appearanceSource.file, 'assets/appearance/museum/roesen-still-life-flowers-fruit.svg');
assert.equal(fs.existsSync(path.join(__dirname, oilExhibit.appearanceSource.file)), true);
assert.match(oilExhibit.appearanceSource.sourcePage, /^https:\/\/www\.metmuseum\.org\//);
assert.match(oilExhibit.appearanceSource.licenseCN, /公共领域/);
assert.deepEqual(oilExhibit.sampleIds, oilIds);
assert.deepEqual(MUSEUM.getExhibitSamples(oilExhibit.id).map(sample => sample.id), oilIds);
assert.equal(oilExhibit.previewProfile.classifier, 'oil-still-life-roesen');
assert.equal(oilExhibit.previewProfile.luminanceLock, 'anchor');
assert.equal(oilExhibit.previewProfile.backgroundMode, undefined);
assert.deepEqual(oilExhibit.previewProfile.recognitionSampleIds, [
    'oil_red_orange', 'oil_yellow_gold', 'oil_green_foliage',
    'oil_blue_violet', 'oil_dark_background'
]);
assert.deepEqual(oilExhibit.findings.map(item => item.id), [
    'oilTone', 'oilFruitSeparation', 'oilColourHierarchy', 'oilDarkDetail'
]);
assert.equal(oilExhibit.evaluationProfile.anchorSampleId, 'oil_light_petals');
assert.equal(oilExhibit.evaluationProfile.distinctionGroups.oilColourHierarchy.aggregation, 'average');
assert.equal(oilExhibit.evaluationProfile.distinctionGroups.oilDarkDetail.aggregation, 'minimum');
assert.ok(MUSEUM.getSample('oil_light_petals').reflectance[40] > MUSEUM.getSample('oil_dark_background').reflectance[40]);
assert.ok(MUSEUM.getSample('oil_red_orange').reflectance[58] > MUSEUM.getSample('oil_red_orange').reflectance[20]);
assert.ok(MUSEUM.getSample('oil_green_foliage').reflectance[32] > MUSEUM.getSample('oil_green_foliage').reflectance[58]);
assert.ok(MUSEUM.getSample('oil_blue_violet').reflectance[14] > MUSEUM.getSample('oil_blue_violet').reflectance[48]);
assert.ok(MUSEUM.getSample('oil_yellow_gold').reflectance[48] > MUSEUM.getSample('oil_yellow_gold').reflectance[20]);

assert.deepEqual(MUSEUM.listModes().map(mode => mode.id), [
    'fidelity',
    'low-light-recognition',
    'colour-enhancement'
]);

const fidelity = MUSEUM.resolveModeSettings('fidelity', 'recommended');
const lowLight = MUSEUM.resolveModeSettings('low-light-recognition', 'strong');
const enhancement = MUSEUM.resolveModeSettings('colour-enhancement', 'soft');
assert.equal(fidelity.modeId, 'fidelity');
assert.equal(fidelity.strength, 'recommended');
assert.ok(fidelity.minRf >= 90);
assert.equal(lowLight.modeId, 'low-light-recognition');
assert.ok(lowLight.minRg >= 110);
assert.ok(lowLight.targetRg >= lowLight.minRg);
assert.ok(lowLight.maxRg >= lowLight.targetRg);
assert.ok(lowLight.distinctionGain > MUSEUM.resolveModeSettings('low-light-recognition', 'soft').distinctionGain);
assert.equal(enhancement.modeId, 'colour-enhancement');
assert.ok(enhancement.maxRg >= 110 && enhancement.maxRg <= 115);
const qinghuaLowLight = MUSEUM.resolveModeSettings('low-light-recognition', 'recommended', 'qinghua_porcelain_single');
assert.ok(qinghuaLowLight.minRf >= 83);
assert.ok(qinghuaLowLight.minRg >= 110);
assert.ok(qinghuaLowLight.targetRg > qinghuaLowLight.minRg);
assert.ok(qinghuaLowLight.maxCobaltAbsDeltaH >= 4.3);
const inkLowLight = MUSEUM.resolveModeSettings('low-light-recognition', 'recommended', 'ink_bird_bamboo');
assert.ok(inkLowLight.minRf >= 83);
assert.ok(inkLowLight.minRg >= 110);
assert.ok(inkLowLight.targetRg >= inkLowLight.minRg);
assert.ok(inkLowLight.maxRg >= inkLowLight.targetRg);
assert.ok(inkLowLight.weights.distinction > lowLight.weights.distinction);
assert.match(inkLowLight.descriptionCN, /纸张|墨色|灰阶/);
const bronzeLowLight = MUSEUM.resolveModeSettings('low-light-recognition', 'recommended', 'bronze_food_vessel');
assert.ok(bronzeLowLight.minRf >= 82);
assert.ok(bronzeLowLight.minRg >= 110);
assert.ok(bronzeLowLight.targetRg >= bronzeLowLight.minRg);
assert.ok(bronzeLowLight.maxRg >= bronzeLowLight.targetRg);
assert.ok(bronzeLowLight.weights.distinction > bronzeLowLight.weights.chroma);
assert.match(bronzeLowLight.descriptionCN, /铜绿|纹饰|暗部/);
const jadeLowLight = MUSEUM.resolveModeSettings('low-light-recognition', 'recommended', 'qingbai_jade_carving');
assert.ok(jadeLowLight.minRf >= 83);
assert.ok(jadeLowLight.minRg >= 110);
assert.ok(jadeLowLight.targetRg >= jadeLowLight.minRg);
assert.ok(jadeLowLight.maxRg >= jadeLowLight.targetRg);
assert.ok(jadeLowLight.weights.distinction > jadeLowLight.weights.chroma);
assert.match(jadeLowLight.descriptionCN, /青白|通透|雕纹/);
const lacquerLowLight = MUSEUM.resolveModeSettings('low-light-recognition', 'recommended', 'black_lacquer_gold_writing_box');
assert.ok(lacquerLowLight.minRf >= 80);
assert.ok(lacquerLowLight.minRg >= 110);
assert.ok(lacquerLowLight.targetRg > lacquerLowLight.minRg);
assert.ok(lacquerLowLight.maxCobaltAbsDeltaH >= 6);
assert.ok(lacquerLowLight.maxRg >= lacquerLowLight.targetRg);
assert.ok(lacquerLowLight.weights.distinction > lacquerLowLight.weights.chroma);
assert.match(lacquerLowLight.descriptionCN, /黑漆|金纹|暗部/);
const textileLowLight = MUSEUM.resolveModeSettings('low-light-recognition', 'recommended', 'embroidered_birds_flowers_panel');
assert.ok(textileLowLight.minRf >= 80);
assert.ok(textileLowLight.minRg >= 110);
assert.ok(textileLowLight.targetRg > textileLowLight.minRg);
assert.ok(textileLowLight.maxCobaltAbsDeltaH >= 6);
assert.ok(textileLowLight.maxRg >= textileLowLight.targetRg);
assert.ok(textileLowLight.weights.distinction > textileLowLight.weights.chroma);
assert.match(textileLowLight.descriptionCN, /丝线|针脚|织物/);
const cloisonneLowLight = MUSEUM.resolveModeSettings('low-light-recognition', 'recommended', 'qing_qianlong_cloisonne_floral_vase');
assert.ok(cloisonneLowLight.minRf >= 80);
assert.ok(cloisonneLowLight.minRg >= 110);
assert.ok(cloisonneLowLight.targetRg >= cloisonneLowLight.minRg);
assert.ok(cloisonneLowLight.maxRg >= cloisonneLowLight.targetRg);
assert.ok(cloisonneLowLight.weights.distinction > cloisonneLowLight.weights.chroma);
assert.match(cloisonneLowLight.descriptionCN, /珐琅|掐丝|蓝绿/);
const guanyinLowLight = MUSEUM.resolveModeSettings('low-light-recognition', 'recommended', 'northern_song_guanyin');
assert.ok(guanyinLowLight.minRf >= 80);
assert.ok(guanyinLowLight.minRg >= 110);
assert.ok(guanyinLowLight.targetRg >= guanyinLowLight.minRg);
assert.ok(guanyinLowLight.maxRg >= guanyinLowLight.targetRg);
assert.ok(guanyinLowLight.weights.distinction > guanyinLowLight.weights.chroma);
assert.match(guanyinLowLight.descriptionCN, /肤色|金饰|衣纹|五官/);
const oilLowLight = MUSEUM.resolveModeSettings('low-light-recognition', 'recommended', 'roesen_still_life_flowers_fruit');
assert.ok(oilLowLight.minRf >= 80);
assert.ok(oilLowLight.minRg >= 110);
assert.ok(oilLowLight.targetRg >= oilLowLight.minRg);
assert.ok(oilLowLight.maxRg >= oilLowLight.targetRg);
assert.ok(oilLowLight.weights.distinction > oilLowLight.weights.chroma);
assert.match(oilLowLight.descriptionCN, /油画|花果|暗部/);
assert.throws(() => MUSEUM.resolveModeSettings('unknown', 'recommended'), /Unknown museum mode/);

console.log('museum light data tests passed', {
    samples: samples.length,
    modes: MUSEUM.listModes().length,
    qualification: MUSEUM.dataQualification
});
