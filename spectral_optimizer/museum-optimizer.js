(function (root, factory) {
    const api = factory(root.MaterialColor, root.MuseumLightData);
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) root.MuseumOptimizer = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (MaterialColor, MuseumData) {
    'use strict';

    function assertReady() {
        if (!MaterialColor || typeof MaterialColor.calculateMaterialDelta !== 'function' ||
            typeof MaterialColor.deltaE2000 !== 'function') {
            throw new Error('MaterialColor is required before museum-optimizer.js');
        }
        if (!MuseumData || typeof MuseumData.getExhibit !== 'function') {
            throw new Error('MuseumLightData is required before museum-optimizer.js');
        }
    }

    function average(values) {
        return values.length ? values.reduce(function (sum, value) { return sum + value; }, 0) / values.length : 0;
    }

    function bySampleId(results) {
        return Object.fromEntries(results.map(function (result) { return [result.materialId, result]; }));
    }

    function pairDelta(resultMap, pair, appearanceKey) {
        const left = resultMap[pair[0]];
        const right = resultMap[pair[1]];
        if (!left || !right) return 0;
        return MaterialColor.deltaE2000(left[appearanceKey].lab, right[appearanceKey].lab);
    }

    function aggregatePairs(resultMap, pairs, aggregation) {
        const candidateValues = pairs.map(function (pair) { return pairDelta(resultMap, pair, 'candidate'); });
        const referenceValues = pairs.map(function (pair) { return pairDelta(resultMap, pair, 'reference'); });
        const reduce = aggregation === 'minimum'
            ? function (values) { return values.length ? Math.min.apply(Math, values) : 0; }
            : average;
        const candidate = reduce(candidateValues);
        const reference = reduce(referenceValues);
        return {
            candidate,
            reference,
            difference: candidate - reference,
            gainRatio: reference > 1e-12 ? candidate / reference - 1 : 0,
            candidatePairs: candidateValues,
            referencePairs: referenceValues
        };
    }

    function evaluateExhibit(spd, options) {
        assertReady();
        const settings = options || {};
        const defaultExhibit = typeof MuseumData.getDefaultExhibit === 'function'
            ? MuseumData.getDefaultExhibit() : MuseumData.exhibit;
        const exhibit = MuseumData.getExhibit(settings.exhibitId || (defaultExhibit && defaultExhibit.id));
        if (!exhibit) throw new Error('Unknown museum exhibit: ' + settings.exhibitId);
        const profile = exhibit.evaluationProfile || {};
        const cct = Number.isFinite(Number(settings.cct)) ? Number(settings.cct) : 3500;
        const samples = typeof MuseumData.getExhibitSamples === 'function'
            ? MuseumData.getExhibitSamples(exhibit.id)
            : exhibit.sampleIds.map(function (id) { return MuseumData.getSample(id); }).filter(Boolean);
        const perSample = samples.map(function (sample) {
            return MaterialColor.calculateMaterialDelta(spd, {
                material: sample,
                cct,
                referenceMode: settings.referenceMode || 'auto'
            });
        });
        const resultMap = bySampleId(perSample);
        const weightTotal = samples.reduce(function (sum, sample) { return sum + sample.weight; }, 0);
        const weightedMeanDeltaE00 = perSample.reduce(function (sum, result) {
            const sample = MuseumData.getSample(result.materialId);
            return sum + result.deltaE00 * sample.weight;
        }, 0) / Math.max(weightTotal, 1e-12);
        const maxResult = perSample.reduce(function (current, result) {
            return !current || result.deltaE00 > current.deltaE00 ? result : current;
        }, null);
        const anchorSampleId = profile.anchorSampleId || exhibit.defaultSampleId || exhibit.sampleIds[0];
        const anchorResult = resultMap[anchorSampleId] || perSample[0];
        const anchorCandidateLab = anchorResult.candidate.lab;
        const anchorReferenceLab = anchorResult.reference.lab;
        const hueResults = (profile.hueControlSampleIds || [])
            .map(function (id) { return resultMap[id]; }).filter(Boolean);
        const chromaResults = (profile.chromaSampleIds || [])
            .map(function (id) { return resultMap[id]; }).filter(Boolean);
        const distinctionGroups = profile.distinctionGroups || {};
        const distinctionKeys = Object.keys(distinctionGroups);
        const distinction = Object.fromEntries(distinctionKeys.map(function (key) {
            const group = distinctionGroups[key];
            return [key, aggregatePairs(resultMap, group.pairs || [], group.aggregation || 'average')];
        }));
        const quality = Object.assign({ ra: 0, r9: 0, rf: 0, rg: 0 }, settings.quality || {});
        const anchor = {
            sampleId: anchorSampleId,
            deltaE00: anchorResult.deltaE00,
            deltaL: anchorResult.deltaL,
            deltaC: anchorResult.deltaC,
            deltaH: anchorResult.deltaH,
            deltaA: anchorCandidateLab[1] - anchorReferenceLab[1],
            deltaB: anchorCandidateLab[2] - anchorReferenceLab[2]
        };
        const colourGroup = {
            maxAbsDeltaH: Math.max.apply(Math, hueResults.map(function (result) { return Math.abs(result.deltaH); }).concat([0])),
            meanDeltaC: average(chromaResults.map(function (result) { return result.deltaC; })),
            meanDeltaE00: average(chromaResults.map(function (result) { return result.deltaE00; }))
        };
        return {
            exhibitId: exhibit.id,
            cct,
            duv: Number.isFinite(Number(settings.duv)) ? Number(settings.duv) : 0,
            quality,
            perSample,
            weightedMeanDeltaE00,
            maxDeltaE00: maxResult ? maxResult.deltaE00 : 0,
            maxDeltaE00SampleId: maxResult ? maxResult.materialId : '',
            anchor,
            colourGroup,
            distinction,
            distinctionKeys,
            white: anchor,
            cobalt: colourGroup,
            channelConcentration: Number.isFinite(Number(settings.channelConcentration)) ? Number(settings.channelConcentration) : 0,
            spectralRoughness: Number.isFinite(Number(settings.spectralRoughness))
                ? Number(settings.spectralRoughness) : spectralRoughness(spd)
        };
    }

    function normalized(value, limit) {
        return Math.max(0, Number(value) || 0) / Math.max(Number(limit) || 1, 1e-12);
    }

    function summarizeForMode(evaluation, modeSettings, baselineEvaluation) {
        const mode = modeSettings || {};
        const baseline = baselineEvaluation || evaluation;
        function improvementFromBaseline(key) {
            const before = Number(baseline.distinction && baseline.distinction[key]
                ? baseline.distinction[key].candidate : 0);
            const after = Number(evaluation.distinction && evaluation.distinction[key]
                ? evaluation.distinction[key].candidate : 0);
            return Math.abs(before) > 1e-12 ? after / before - 1 : 0;
        }
        const distinctionKeys = Array.isArray(evaluation.distinctionKeys) && evaluation.distinctionKeys.length
            ? evaluation.distinctionKeys : Object.keys(evaluation.distinction || {});
        const gains = distinctionKeys.map(improvementFromBaseline);
        const targetGain = Number(mode.distinctionGain) || 0;
        const distinctionError = gains.reduce(function (sum, gain) {
            if (targetGain <= 0) return sum + Math.abs(gain);
            const shortfall = Math.max(0, targetGain - gain) / targetGain;
            const excess = Math.max(0, gain - Math.max(targetGain * 1.8, 0.12)) / Math.max(targetGain, 0.01);
            return sum + shortfall + excess * 0.5;
        }, 0);
        const targetChroma = Number(mode.chromaGain) || 0;
        const colourGroup = evaluation.colourGroup || evaluation.cobalt || { meanDeltaC: 0, maxAbsDeltaH: 0 };
        const anchor = evaluation.anchor || evaluation.white || { deltaE00: 0 };
        const chromaError = targetChroma > 0
            ? Math.abs(colourGroup.meanDeltaC - targetChroma) / targetChroma
            : Math.abs(colourGroup.meanDeltaC);
        const weights = mode.weights || {};
        const meanError = normalized(evaluation.weightedMeanDeltaE00, mode.maxMeanDeltaE00);
        const worstError = normalized(evaluation.maxDeltaE00, mode.maxDeltaE00);
        const whiteError = normalized(anchor.deltaE00, mode.maxWhiteDeltaE00);
        const hueError = normalized(colourGroup.maxAbsDeltaH, mode.maxCobaltAbsDeltaH);
        const actualRg = Number(evaluation.quality && evaluation.quality.rg) || 0;
        const minimumRg = Number(mode.minRg) || 0;
        const targetRg = Number(mode.targetRg) || minimumRg || actualRg;
        const maximumRg = Number(mode.maxRg) || Infinity;
        const rgShortfall = minimumRg > 0
            ? Math.max(0, minimumRg - actualRg) / Math.max(minimumRg - 100, 5) : 0;
        const rgTargetError = targetRg > 0
            ? Math.abs(actualRg - targetRg) / Math.max(targetRg - minimumRg, 5) : 0;
        const rgExcess = Number.isFinite(maximumRg)
            ? Math.max(0, actualRg - maximumRg) / Math.max(maximumRg - targetRg, 3) : 0;
        const rgError = rgShortfall * 3 + rgTargetError * 0.35 + rgExcess * 2;
        let objective = (Number(weights.mean) || 0) * meanError
            + (Number(weights.worst) || 0) * worstError
            + (Number(weights.white) || 0) * whiteError
            + (Number(weights.hue) || 0) * hueError
            + (Number(weights.distinction) || 0) * distinctionError
            + (Number(weights.chroma) || 0) * chromaError
            + (Number(weights.rg) || 0) * rgError
            + Math.max(0, evaluation.channelConcentration - 0.78) * 8
            + Math.max(0, evaluation.spectralRoughness - 0.25) * 4;

        const feasible = evaluation.quality.rf >= Number(mode.minRf || 0)
            && evaluation.quality.rg >= Number(mode.minRg || 0)
            && evaluation.quality.rg <= Number(mode.maxRg || Infinity)
            && anchor.deltaE00 <= Number(mode.maxWhiteDeltaE00 || Infinity)
            && colourGroup.maxAbsDeltaH <= Number(mode.maxCobaltAbsDeltaH || Infinity)
            && evaluation.weightedMeanDeltaE00 <= Number(mode.maxMeanDeltaE00 || Infinity)
            && evaluation.maxDeltaE00 <= Number(mode.maxDeltaE00 || Infinity);
        if (!feasible) objective = Infinity;

        const perMaterial = evaluation.perSample.map(function (result) {
            const sample = MuseumData.getSample(result.materialId);
            return {
                materialId: result.materialId,
                importance: sample ? sample.weight : 1,
                targetDeltaC: sample ? sample.targetDeltaC : 0,
                actualDeltaC: result.deltaC,
                chromaError: Math.abs(result.deltaC - (sample ? sample.targetDeltaC : 0)),
                preferenceError: result.deltaE00,
                deltaH: result.deltaH,
                deltaL: result.deltaL,
                deltaE00: result.deltaE00
            };
        });
        return {
            museumEvaluation: evaluation,
            baselineMuseumEvaluation: baseline,
            weightedMeanPreferenceError: objective,
            meanPreferenceError: objective,
            maxPreferenceError: Math.max(meanError, worstError, whiteError, hueError, distinctionError, chromaError, rgError),
            weightedMeanChromaError: chromaError,
            meanChromaError: chromaError,
            maxChromaError: chromaError,
            weightedMeanDeltaC: colourGroup.meanDeltaC,
            meanDeltaC: colourGroup.meanDeltaC,
            weightedTargetDeltaC: targetChroma,
            targetChromaMean: targetChroma,
            meanAbsDeltaH: average(evaluation.perSample.map(function (result) { return Math.abs(result.deltaH); })),
            meanAbsDeltaL: average(evaluation.perSample.map(function (result) { return Math.abs(result.deltaL); })),
            meanDeltaE00: evaluation.weightedMeanDeltaE00,
            maxDeltaE00: evaluation.maxDeltaE00,
            worstMaterialId: evaluation.maxDeltaE00SampleId,
            maxDeltaE00MaterialId: evaluation.maxDeltaE00SampleId,
            perMaterial,
            results: evaluation.perSample
        };
    }

    function createCandidateGuard(options) {
        const settings = options || {};
        const mode = settings.modeSettings || {};
        const duvRange = Array.isArray(settings.duvRange) ? settings.duvRange.map(Number) : [-Infinity, Infinity];
        const cctRange = Array.isArray(settings.cctRange) ? settings.cctRange.map(Number) : [-Infinity, Infinity];
        const maxChannelConcentration = Number.isFinite(Number(settings.maxChannelConcentration))
            ? Number(settings.maxChannelConcentration) : 0.78;
        const maxSpectralRoughness = Number.isFinite(Number(settings.maxSpectralRoughness))
            ? Number(settings.maxSpectralRoughness) : 0.25;
        return function guard(candidate) {
            const evaluation = candidate && candidate.museumEvaluation;
            if (!evaluation) return false;
            return evaluation.cct >= cctRange[0] && evaluation.cct <= cctRange[1]
                && evaluation.duv >= duvRange[0] && evaluation.duv <= duvRange[1]
                && evaluation.quality.rf >= Number(mode.minRf || 0)
                && evaluation.quality.rg >= Number(mode.minRg || 0)
                && evaluation.quality.rg <= Number(mode.maxRg || Infinity)
                && (evaluation.anchor || evaluation.white).deltaE00 <= Number(mode.maxWhiteDeltaE00 || Infinity)
                && (evaluation.colourGroup || evaluation.cobalt).maxAbsDeltaH <= Number(mode.maxCobaltAbsDeltaH || Infinity)
                && evaluation.weightedMeanDeltaE00 <= Number(mode.maxMeanDeltaE00 || Infinity)
                && evaluation.maxDeltaE00 <= Number(mode.maxDeltaE00 || Infinity)
                && evaluation.channelConcentration <= maxChannelConcentration
                && evaluation.spectralRoughness <= maxSpectralRoughness;
        };
    }

    function spectralRoughness(spd) {
        const values = Array.from(spd || [], function (value) { return Math.max(0, Number(value) || 0); });
        if (values.length < 3) return 0;
        const mean = average(values);
        if (!(mean > 0)) return 0;
        let sum = 0;
        for (let index = 1; index < values.length - 1; index++) {
            const second = values[index - 1] - 2 * values[index] + values[index + 1];
            sum += second * second;
        }
        return Math.sqrt(sum / (values.length - 2)) / mean;
    }

    function channelConcentration(channels, values, quantityFromSpd) {
        if (!Array.isArray(channels) || !Array.isArray(values) || channels.length !== values.length ||
            typeof quantityFromSpd !== 'function') return 1;
        const contributions = channels.map(function (channel, index) {
            const duty = Math.max(0, Math.min(100, Number(values[index]) || 0)) / 100;
            const scaled = Array.from(channel.spd || [], function (value) { return Math.max(0, Number(value) || 0) * duty; });
            return Math.max(0, Number(quantityFromSpd(scaled)) || 0);
        });
        const total = contributions.reduce(function (sum, value) { return sum + value; }, 0);
        return total > 0 ? Math.max.apply(Math, contributions) / total : 1;
    }

    return Object.freeze({
        evaluateExhibit,
        summarizeForMode,
        createCandidateGuard,
        spectralRoughness,
        channelConcentration
    });
});
