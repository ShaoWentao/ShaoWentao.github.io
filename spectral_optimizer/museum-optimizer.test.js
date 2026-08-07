'use strict';

const assert = require('node:assert/strict');

globalThis.CIE_COLOUR_QUALITY_DATA = require('./colour-quality-data.js');
globalThis.SpectralMath = require('./spectral-math.js');
globalThis.MATERIAL_REFLECTANCE_DATA = require('./material-reflectance-data.js');
const MaterialColor = require('./material-color.js');
const MuseumData = require('./museum-light-data.js');
globalThis.MaterialColor = MaterialColor;
globalThis.MuseumLightData = MuseumData;
const OPTIMIZER = require('./museum-optimizer.js');

const wavelengths = globalThis.CIE_COLOUR_QUALITY_DATA.wavelengths;
const reference = MaterialColor.referenceSpd(3500, { referenceMode: 'auto' });
const neutral = OPTIMIZER.evaluateExhibit(reference, {
    cct: 3500,
    exhibitId: 'qinghua_porcelain_single',
    quality: { ra: 95, r9: 90, rf: 94, rg: 100 },
    duv: 0
});

assert.equal(neutral.perSample.length, 6);
assert.ok(neutral.perSample.every(result => Math.abs(result.deltaE00) < 1e-7));
assert.ok(Math.abs(neutral.weightedMeanDeltaE00) < 1e-7);
assert.ok(Math.abs(neutral.maxDeltaE00) < 1e-7);
assert.ok(neutral.distinction.blueWhite.candidate > 0);
assert.ok(Math.abs(neutral.distinction.blueWhite.gainRatio) < 1e-7);
assert.ok(Math.abs(neutral.distinction.lightDeepBlue.gainRatio) < 1e-7);
assert.ok(Math.abs(neutral.distinction.blueHierarchy.gainRatio) < 1e-7);
assert.equal(neutral.anchor.sampleId, 'glaze_white');
assert.equal(neutral.colourGroup.maxAbsDeltaH, 0);
assert.deepEqual(neutral.distinctionKeys, ['blueWhite', 'lightDeepBlue', 'blueHierarchy']);
assert.equal(neutral.white, neutral.anchor);
assert.equal(neutral.cobalt, neutral.colourGroup);

const blueBoost = reference.map((value, index) => {
    const wavelength = wavelengths[index];
    if (wavelength >= 420 && wavelength <= 490) return value * 1.45;
    if (wavelength >= 560) return value * 0.92;
    return value;
});
const shifted = OPTIMIZER.evaluateExhibit(blueBoost, {
    cct: 3500,
    exhibitId: 'qinghua_porcelain_single',
    quality: { ra: 88, r9: 70, rf: 86, rg: 109 },
    duv: -0.0004
});
assert.ok(shifted.weightedMeanDeltaE00 > 0.1);
assert.ok(Number.isFinite(shifted.distinction.blueWhite.candidate));
assert.ok(Number.isFinite(shifted.distinction.lightDeepBlue.candidate));
assert.ok(Number.isFinite(shifted.distinction.blueHierarchy.candidate));
assert.ok(Number.isFinite(shifted.colourGroup.meanDeltaC));
assert.ok(Number.isFinite(shifted.anchor.deltaA));
assert.ok(Number.isFinite(shifted.anchor.deltaB));

const inkNeutral = OPTIMIZER.evaluateExhibit(reference, {
    cct: 3500,
    exhibitId: 'ink_bird_bamboo',
    quality: { ra: 95, r9: 90, rf: 94, rg: 100 },
    duv: 0
});
assert.equal(inkNeutral.perSample.length, 6);
assert.equal(inkNeutral.anchor.sampleId, 'paper_warm');
assert.deepEqual(inkNeutral.distinctionKeys, ['paperInk', 'inkHierarchy', 'sealContrast']);
assert.ok(inkNeutral.distinction.paperInk.candidate > 0);
assert.ok(inkNeutral.distinction.inkHierarchy.candidate > 0);
assert.ok(inkNeutral.distinction.sealContrast.candidate > 0);
assert.ok(inkNeutral.perSample.every(result => Math.abs(result.deltaE00) < 1e-7));
assert.equal(inkNeutral.colourGroup.maxAbsDeltaH, 0);

const bronzeReference = MaterialColor.referenceSpd(3200, { referenceMode: 'auto' });
const bronzeNeutral = OPTIMIZER.evaluateExhibit(bronzeReference, {
    cct: 3200,
    exhibitId: 'bronze_food_vessel',
    quality: { ra: 94, r9: 86, rf: 92, rg: 102 },
    duv: 0
});
assert.equal(bronzeNeutral.perSample.length, 6);
assert.equal(bronzeNeutral.anchor.sampleId, 'bronze_base');
assert.deepEqual(bronzeNeutral.distinctionKeys, ['patinaMetal', 'patinaHierarchy', 'reliefDetail']);
assert.ok(bronzeNeutral.distinction.patinaMetal.candidate > 0);
assert.ok(bronzeNeutral.distinction.patinaHierarchy.candidate > 0);
assert.ok(bronzeNeutral.distinction.reliefDetail.candidate > 0);
assert.ok(bronzeNeutral.perSample.every(result => Math.abs(result.deltaE00) < 1e-7));
assert.equal(bronzeNeutral.colourGroup.maxAbsDeltaH, 0);

const fidelitySettings = MuseumData.resolveModeSettings('fidelity', 'recommended');
const recognitionSettings = MuseumData.resolveModeSettings('low-light-recognition', 'recommended');
const enhancementSettings = MuseumData.resolveModeSettings('colour-enhancement', 'recommended');
const inkRecognitionSettings = MuseumData.resolveModeSettings('low-light-recognition', 'recommended', 'ink_bird_bamboo');
const bronzeRecognitionSettings = MuseumData.resolveModeSettings('low-light-recognition', 'recommended', 'bronze_food_vessel');
const fidelitySummary = OPTIMIZER.summarizeForMode(neutral, fidelitySettings, neutral);
const shiftedFidelitySummary = OPTIMIZER.summarizeForMode(shifted, fidelitySettings, neutral);
assert.ok(fidelitySummary.weightedMeanPreferenceError < shiftedFidelitySummary.weightedMeanPreferenceError);

const recognitionCandidate = JSON.parse(JSON.stringify(neutral));
recognitionCandidate.distinction.blueWhite.candidate *= 1.10;
recognitionCandidate.distinction.lightDeepBlue.candidate *= 1.11;
recognitionCandidate.distinction.blueHierarchy.candidate *= 1.09;
recognitionCandidate.weightedMeanDeltaE00 = 1.2;
recognitionCandidate.maxDeltaE00 = 2.2;
recognitionCandidate.anchor.deltaE00 = 1.1;
recognitionCandidate.colourGroup.maxAbsDeltaH = 1.4;
recognitionCandidate.quality.rf = 88;
recognitionCandidate.quality.rg = 112;
const lowRgCandidate = JSON.parse(JSON.stringify(recognitionCandidate));
lowRgCandidate.quality.rg = 106;
const recognitionBase = OPTIMIZER.summarizeForMode(neutral, recognitionSettings, neutral);
const recognitionLowRg = OPTIMIZER.summarizeForMode(lowRgCandidate, recognitionSettings, neutral);
const recognitionImproved = OPTIMIZER.summarizeForMode(recognitionCandidate, recognitionSettings, neutral);
assert.ok(recognitionImproved.weightedMeanPreferenceError < recognitionBase.weightedMeanPreferenceError);
assert.ok(recognitionImproved.weightedMeanPreferenceError < recognitionLowRg.weightedMeanPreferenceError);

const enhancedCandidate = JSON.parse(JSON.stringify(recognitionCandidate));
enhancedCandidate.colourGroup.meanDeltaC = enhancementSettings.chromaGain;
const enhancementBase = OPTIMIZER.summarizeForMode(neutral, enhancementSettings, neutral);
const enhancementImproved = OPTIMIZER.summarizeForMode(enhancedCandidate, enhancementSettings, neutral);
assert.ok(enhancementImproved.weightedMeanPreferenceError < enhancementBase.weightedMeanPreferenceError);

const inkCandidate = JSON.parse(JSON.stringify(inkNeutral));
inkCandidate.distinction.paperInk.candidate *= 1.08;
inkCandidate.distinction.inkHierarchy.candidate *= 1.12;
inkCandidate.distinction.sealContrast.candidate *= 1.04;
inkCandidate.weightedMeanDeltaE00 = 1.1;
inkCandidate.maxDeltaE00 = 2.1;
inkCandidate.anchor.deltaE00 = 0.9;
inkCandidate.colourGroup.maxAbsDeltaH = 1.2;
inkCandidate.colourGroup.meanDeltaC = inkRecognitionSettings.chromaGain;
inkCandidate.quality.rf = 92;
inkCandidate.quality.rg = 112;
const inkBase = OPTIMIZER.summarizeForMode(inkNeutral, inkRecognitionSettings, inkNeutral);
const inkImproved = OPTIMIZER.summarizeForMode(inkCandidate, inkRecognitionSettings, inkNeutral);
assert.ok(inkImproved.weightedMeanPreferenceError < inkBase.weightedMeanPreferenceError);

const bronzeCandidate = JSON.parse(JSON.stringify(bronzeNeutral));
bronzeCandidate.distinction.patinaMetal.candidate *= 1.08;
bronzeCandidate.distinction.patinaHierarchy.candidate *= 1.10;
bronzeCandidate.distinction.reliefDetail.candidate *= 1.13;
bronzeCandidate.weightedMeanDeltaE00 = 1.4;
bronzeCandidate.maxDeltaE00 = 2.8;
bronzeCandidate.anchor.deltaE00 = 1.2;
bronzeCandidate.colourGroup.maxAbsDeltaH = 1.8;
bronzeCandidate.colourGroup.meanDeltaC = bronzeRecognitionSettings.chromaGain;
bronzeCandidate.quality.rf = 90;
bronzeCandidate.quality.rg = 112;
const bronzeBase = OPTIMIZER.summarizeForMode(bronzeNeutral, bronzeRecognitionSettings, bronzeNeutral);
const bronzeImproved = OPTIMIZER.summarizeForMode(bronzeCandidate, bronzeRecognitionSettings, bronzeNeutral);
assert.ok(bronzeImproved.weightedMeanPreferenceError < bronzeBase.weightedMeanPreferenceError);

const guard = OPTIMIZER.createCandidateGuard({
    modeSettings: fidelitySettings,
    duvRange: [-0.001, 0.001],
    cctRange: [3400, 3600],
    maxChannelConcentration: 0.78,
    maxSpectralRoughness: 0.25
});
assert.equal(guard({ museumEvaluation: Object.assign({}, neutral, {
    cct: 3500,
    duv: 0,
    channelConcentration: 0.6,
    spectralRoughness: 0.05
}) }), true);
assert.equal(guard({ museumEvaluation: Object.assign({}, neutral, {
    cct: 3500,
    duv: 0.002,
    channelConcentration: 0.6,
    spectralRoughness: 0.05
}) }), false);
assert.equal(guard({ museumEvaluation: Object.assign({}, neutral, {
    cct: 3500,
    duv: 0,
    quality: { rf: 80, rg: 100 },
    channelConcentration: 0.6,
    spectralRoughness: 0.05
}) }), false);

const smooth = Array.from({ length: 81 }, (_, index) => 0.4 + index / 800);
const spiky = smooth.slice();
spiky[35] += 2;
assert.ok(OPTIMIZER.spectralRoughness(spiky) > OPTIMIZER.spectralRoughness(smooth) * 5);

const channels = [
    { spd: new Array(81).fill(1) },
    { spd: new Array(81).fill(1) }
];
const quantity = spd => spd.reduce((sum, value) => sum + value, 0);
assert.ok(Math.abs(OPTIMIZER.channelConcentration(channels, [50, 50], quantity) - 0.5) < 1e-9);
assert.ok(Math.abs(OPTIMIZER.channelConcentration(channels, [100, 0], quantity) - 1) < 1e-9);

console.log('museum optimizer tests passed', {
    neutralMeanDeltaE00: neutral.weightedMeanDeltaE00,
    shiftedMeanDeltaE00: shifted.weightedMeanDeltaE00,
    blueWhiteGain: shifted.distinction.blueWhite.gainRatio
});
