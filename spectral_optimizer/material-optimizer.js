(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) root.MaterialOptimizer = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    function clamp(value, min, max) {
        const number = Number(value);
        return Math.max(min, Math.min(max, Number.isFinite(number) ? number : min));
    }

    function combineSpd(channels, values) {
        if (!Array.isArray(channels) || channels.length === 0) {
            throw new TypeError('channels are required');
        }
        const length = Array.isArray(channels[0].spd) || ArrayBuffer.isView(channels[0].spd)
            ? channels[0].spd.length
            : 0;
        if (!length) throw new TypeError('each channel must provide an SPD array');
        const combined = new Float64Array(length);
        channels.forEach(function (channel, channelIndex) {
            if ((!Array.isArray(channel.spd) && !ArrayBuffer.isView(channel.spd)) || channel.spd.length !== length) {
                throw new RangeError('all channel SPD arrays must have the same length');
            }
            const duty = clamp(values[channelIndex], 0, 100) / 100;
            if (duty <= 0) return;
            for (let index = 0; index < length; index++) {
                combined[index] += duty * Math.max(0, Number(channel.spd[index]) || 0);
            }
        });
        return combined;
    }

    function summarizeMaterialResults(results) {
        const list = Array.isArray(results) ? results.filter(function (result) {
            return result && Number.isFinite(Number(result.deltaE00));
        }) : [];
        if (!list.length) {
            return {
                results: [],
                meanDeltaE00: Infinity,
                maxDeltaE00: Infinity,
                rmsDeltaE00: Infinity
            };
        }
        const values = list.map(function (result) { return Number(result.deltaE00); });
        const mean = values.reduce(function (sum, value) { return sum + value; }, 0) / values.length;
        const rms = Math.sqrt(values.reduce(function (sum, value) { return sum + value * value; }, 0) / values.length);
        return {
            results: list,
            meanDeltaE00: mean,
            maxDeltaE00: Math.max.apply(Math, values),
            rmsDeltaE00: rms
        };
    }

    function preferredChromaTarget(result, preferenceChroma) {
        const target = clamp(preferenceChroma, 0, 10);
        const category = String(result && result.materialCategory || '').toLowerCase();
        const hueZone = String(result && result.targetHueZone || '').toLowerCase();
        if (category === 'neutral' || hueZone === 'neutral') return 0;
        if (category === 'metal') return target * 0.5;
        return target;
    }

    function isProfileMap(value, results) {
        if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
        return (Array.isArray(results) ? results : []).some(function (result) {
            const profile = value[result && result.materialId];
            return profile && Number.isFinite(Number(profile.targetDeltaC));
        });
    }

    function legacyPreferenceProfile(result, settings) {
        const preferenceChroma = Number.isFinite(settings.preferenceChroma)
            ? clamp(settings.preferenceChroma, 0, 10)
            : 5;
        return {
            targetDeltaC: preferredChromaTarget(result, preferenceChroma),
            targetDeltaH: 0,
            targetDeltaL: 0,
            maxAbsDeltaH: Number.isFinite(settings.maxAbsDeltaH) ? Math.max(0, settings.maxAbsDeltaH) : 180,
            maxAbsDeltaL: Number.isFinite(settings.maxAbsDeltaL) ? Math.max(0, settings.maxAbsDeltaL) : 100,
            maxDeltaE00: Number.isFinite(settings.maxDeltaE00) ? Math.max(0, settings.maxDeltaE00) : 8,
            importance: 1,
            weights: {
                chroma: 1,
                hue: Number.isFinite(settings.hueWeight) ? Math.max(0, settings.hueWeight) : 0.12,
                lightness: Number.isFinite(settings.lightnessWeight) ? Math.max(0, settings.lightnessWeight) : 0.08,
                deltaE: Number.isFinite(settings.fidelityWeight) ? Math.max(0, settings.fidelityWeight) : 0.04
            }
        };
    }

    function preferenceError(result, profile) {
        const chromaError = Math.abs(Number(result.deltaC) - Number(profile.targetDeltaC));
        const hueError = Math.abs(Number(result.deltaH) - Number(profile.targetDeltaH));
        const lightnessError = Math.abs(Number(result.deltaL) - Number(profile.targetDeltaL));
        const huePenalty = Math.max(0, Math.abs(Number(result.deltaH)) - Number(profile.maxAbsDeltaH));
        const lightnessPenalty = Math.max(0, Math.abs(Number(result.deltaL)) - Number(profile.maxAbsDeltaL));
        const deltaEPenalty = Math.max(0, Number(result.deltaE00) - Number(profile.maxDeltaE00));
        const weights = profile.weights || {};
        return {
            chromaError,
            hueError,
            lightnessError,
            value: (Number(weights.chroma) || 0) * chromaError
                + (Number(weights.hue) || 0) * hueError
                + (Number(weights.lightness) || 0) * lightnessError
                + (Number(weights.deltaE) || 0) * Number(result.deltaE00)
                + huePenalty * 6
                + lightnessPenalty * 4
                + deltaEPenalty * 8
        };
    }

    function summarizeMaterialPreference(results, optionsOrProfiles) {
        const settings = optionsOrProfiles || {};
        const profiles = isProfileMap(settings, results) ? settings : null;
        const list = Array.isArray(results) ? results.filter(function (result) {
            return result && typeof result.materialId === 'string' &&
                Number.isFinite(Number(result.deltaC)) &&
                Number.isFinite(Number(result.deltaH)) &&
                Number.isFinite(Number(result.deltaL)) &&
                Number.isFinite(Number(result.deltaE00));
        }) : [];
        if (!list.length) {
            return {
                results: [],
                perMaterial: [],
                weightedMeanPreferenceError: Infinity,
                meanPreferenceError: Infinity,
                maxPreferenceError: Infinity,
                weightedMeanChromaError: Infinity,
                meanChromaError: Infinity,
                maxChromaError: Infinity,
                weightedMeanDeltaC: NaN,
                meanDeltaC: NaN,
                weightedTargetDeltaC: NaN,
                targetChromaMean: NaN,
                meanAbsDeltaH: Infinity,
                meanAbsDeltaL: Infinity,
                meanDeltaE00: Infinity,
                maxDeltaE00: Infinity,
                worstMaterialId: '',
                maxDeltaE00MaterialId: ''
            };
        }

        const evaluated = list.map(function (result) {
            const profile = profiles && profiles[result.materialId]
                ? profiles[result.materialId]
                : legacyPreferenceProfile(result, settings);
            const error = preferenceError(result, profile);
            return {
                materialId: result.materialId,
                result,
                profile,
                importance: Number.isFinite(Number(profile.importance)) ? Math.max(0.1, Number(profile.importance)) : 1,
                targetDeltaC: Number(profile.targetDeltaC),
                chromaError: error.chromaError,
                hueError: error.hueError,
                lightnessError: error.lightnessError,
                preferenceError: error.value,
                absHue: Math.abs(Number(result.deltaH)),
                absLightness: Math.abs(Number(result.deltaL))
            };
        });
        const importanceTotal = evaluated.reduce(function (sum, item) { return sum + item.importance; }, 0);
        const weightedAverage = function (selector) {
            return evaluated.reduce(function (sum, item) {
                return sum + selector(item) * item.importance;
            }, 0) / importanceTotal;
        };
        const worst = evaluated.reduce(function (current, item) {
            return !current || item.preferenceError > current.preferenceError ? item : current;
        }, null);
        const maxDeltaE = evaluated.reduce(function (current, item) {
            return !current || Number(item.result.deltaE00) > Number(current.result.deltaE00) ? item : current;
        }, null);
        const weightedMeanPreferenceError = weightedAverage(function (item) { return item.preferenceError; });
        const weightedMeanChromaError = weightedAverage(function (item) { return item.chromaError; });
        const weightedMeanDeltaC = weightedAverage(function (item) { return Number(item.result.deltaC); });
        const weightedTargetDeltaC = weightedAverage(function (item) { return item.targetDeltaC; });
        return {
            results: list,
            perMaterial: evaluated.map(function (item) {
                return {
                    materialId: item.materialId,
                    importance: item.importance,
                    targetDeltaC: item.targetDeltaC,
                    actualDeltaC: Number(item.result.deltaC),
                    chromaError: item.chromaError,
                    preferenceError: item.preferenceError,
                    deltaH: Number(item.result.deltaH),
                    deltaL: Number(item.result.deltaL),
                    deltaE00: Number(item.result.deltaE00)
                };
            }),
            weightedMeanPreferenceError,
            meanPreferenceError: weightedMeanPreferenceError,
            maxPreferenceError: worst.preferenceError,
            weightedMeanChromaError,
            meanChromaError: weightedMeanChromaError,
            maxChromaError: Math.max.apply(Math, evaluated.map(function (item) { return item.chromaError; })),
            weightedMeanDeltaC,
            meanDeltaC: weightedMeanDeltaC,
            weightedTargetDeltaC,
            targetChromaMean: weightedTargetDeltaC,
            meanAbsDeltaH: weightedAverage(function (item) { return item.absHue; }),
            meanAbsDeltaL: weightedAverage(function (item) { return item.absLightness; }),
            meanDeltaE00: weightedAverage(function (item) { return Number(item.result.deltaE00); }),
            maxDeltaE00: Number(maxDeltaE.result.deltaE00),
            worstMaterialId: worst.materialId,
            maxDeltaE00MaterialId: maxDeltaE.materialId
        };
    }

    function normalizeValues(values, targetPeak, quantum, channels, quantityFromSpd, targetQuantity) {
        const clamped = values.map(function (value) { return clamp(value, 0, 100); });
        let scale = 1;
        if (typeof quantityFromSpd === 'function' && Number.isFinite(targetQuantity) && targetQuantity > 0) {
            const quantity = Number(quantityFromSpd(combineSpd(channels, clamped)));
            scale = Number.isFinite(quantity) && quantity > 0 ? targetQuantity / quantity : 1;
        } else {
            const peak = Math.max.apply(Math, clamped);
            scale = peak > 0 && targetPeak > 0 ? targetPeak / peak : 1;
        }
        const step = Number.isFinite(quantum) && quantum > 0 ? quantum : 0;
        return clamped.map(function (value) {
            const scaled = clamp(value * scale, 0, 100);
            return step > 0 ? clamp(Math.round(scaled / step) * step, 0, 100) : scaled;
        });
    }

    function candidateKey(values) {
        return values.map(function (value) { return value.toFixed(4); }).join(',');
    }

    function optimizeMaterialFidelity(options) {
        const settings = options || {};
        const channels = settings.channels;
        const initialValues = Array.isArray(settings.initialValues)
            ? settings.initialValues.map(function (value) { return clamp(value, 0, 100); })
            : null;
        if (!Array.isArray(channels) || !channels.length || !initialValues || initialValues.length !== channels.length) {
            throw new TypeError('channels and matching initialValues are required');
        }
        if (typeof settings.evaluateSpd !== 'function' || typeof settings.xyFromSpd !== 'function' ||
            typeof settings.xyToUpVp !== 'function') {
            throw new TypeError('evaluateSpd, xyFromSpd and xyToUpVp are required');
        }
        if (!settings.targetXy || !Number.isFinite(settings.targetXy.x) || !Number.isFinite(settings.targetXy.y)) {
            throw new TypeError('targetXy is required');
        }

        const targetUpVp = settings.xyToUpVp(settings.targetXy.x, settings.targetXy.y);
        const maxDeltaUpVp = Number.isFinite(settings.maxDeltaUpVp) ? Math.max(0, settings.maxDeltaUpVp) : 0.0015;
        const worstWeight = Number.isFinite(settings.worstWeight) ? Math.max(0, settings.worstWeight) : 0.35;
        const rmsWeight = Number.isFinite(settings.rmsWeight) ? Math.max(0, settings.rmsWeight) : 0.10;
        const stepSizes = Array.isArray(settings.stepSizes) && settings.stepSizes.length
            ? settings.stepSizes.map(function (value) { return Math.max(0.1, Number(value) || 0.1); })
            : [12, 6, 3, 1];
        const maxPasses = Number.isFinite(settings.maxPasses) ? Math.max(1, Math.round(settings.maxPasses)) : 2;
        const targetPeak = Math.max.apply(Math, initialValues);
        const valueQuantum = Number.isFinite(settings.valueQuantum) ? Math.max(0, settings.valueQuantum) : 0;
        const quantityFromSpd = typeof settings.quantityFromSpd === 'function' ? settings.quantityFromSpd : null;
        const targetQuantity = quantityFromSpd ? Number(quantityFromSpd(combineSpd(channels, initialValues))) : NaN;
        const maxRelativeQuantityError = Number.isFinite(settings.maxRelativeQuantityError)
            ? Math.max(0, settings.maxRelativeQuantityError) : 0.005;
        let evaluations = 0;

        function evaluate(values) {
            const normalizedValues = normalizeValues(values, targetPeak, valueQuantum, channels, quantityFromSpd, targetQuantity);
            const spd = combineSpd(channels, normalizedValues);
            const quantity = quantityFromSpd ? Number(quantityFromSpd(spd)) : NaN;
            const relativeQuantityError = quantityFromSpd && targetQuantity > 0
                ? Math.abs(quantity - targetQuantity) / targetQuantity : 0;
            const quantityFeasible = relativeQuantityError <= maxRelativeQuantityError + 1e-12;
            const xy = settings.xyFromSpd(spd);
            const upvp = settings.xyToUpVp(xy.x, xy.y);
            const deltaUpVp = Math.hypot(upvp.up - targetUpVp.up, upvp.vp - targetUpVp.vp);
            const rawSummary = settings.evaluateSpd(spd, normalizedValues);
            const summary = rawSummary && Number.isFinite(rawSummary.meanDeltaE00)
                ? rawSummary
                : summarizeMaterialResults(rawSummary && rawSummary.results ? rawSummary.results : rawSummary);
            const objective = summary.meanDeltaE00 + worstWeight * summary.maxDeltaE00 + rmsWeight * summary.rmsDeltaE00;
            evaluations += 1;
            return {
                values: normalizedValues,
                spd,
                xy,
                deltaUpVp,
                feasible: Number.isFinite(objective) && deltaUpVp <= maxDeltaUpVp + 1e-12 && quantityFeasible,
                quantityFeasible,
                objective,
                quantity,
                relativeQuantityError,
                meanDeltaE00: summary.meanDeltaE00,
                maxDeltaE00: summary.maxDeltaE00,
                rmsDeltaE00: summary.rmsDeltaE00,
                results: summary.results || []
            };
        }

        const before = evaluate(initialValues);
        let best = before;
        const epsilon = 1e-9;

        function consider(values, seen) {
            const normalized = normalizeValues(values, targetPeak, valueQuantum, channels, quantityFromSpd, targetQuantity);
            const key = candidateKey(normalized);
            if (seen.has(key)) return false;
            seen.add(key);
            const candidate = evaluate(normalized);
            if (typeof settings.candidateGuard === 'function' && !settings.candidateGuard(candidate, before)) return false;
            if (!candidate.feasible) {
                if (!best.feasible && candidate.quantityFeasible && candidate.deltaUpVp < best.deltaUpVp - epsilon) {
                    best = candidate;
                    return true;
                }
                return false;
            }
            if (!best.feasible || candidate.objective < best.objective - epsilon) {
                best = candidate;
                return true;
            }
            return false;
        }

        for (const step of stepSizes) {
            for (let pass = 0; pass < maxPasses; pass++) {
                const origin = best.values.slice();
                const seen = new Set([candidateKey(origin)]);
                let improved = false;

                for (let first = 0; first < channels.length; first++) {
                    for (const direction of [-1, 1]) {
                        const candidate = origin.slice();
                        candidate[first] += direction * step;
                        if (consider(candidate, seen)) improved = true;
                    }
                }

                for (let first = 0; first < channels.length; first++) {
                    for (let second = first + 1; second < channels.length; second++) {
                        for (const directions of [[1, -1], [-1, 1], [1, 1], [-1, -1]]) {
                            const candidate = origin.slice();
                            candidate[first] += directions[0] * step;
                            candidate[second] += directions[1] * step;
                            if (consider(candidate, seen)) improved = true;
                        }
                    }
                }

                if (!improved) break;
            }
        }

        const after = best;
        return {
            feasible: after.feasible,
            improved: after.feasible && (!before.feasible || after.objective < before.objective - epsilon),
            values: after.values.slice(),
            evaluations,
            before: {
                objective: before.objective,
                meanDeltaE00: before.meanDeltaE00,
                maxDeltaE00: before.maxDeltaE00,
                rmsDeltaE00: before.rmsDeltaE00,
                deltaUpVp: before.deltaUpVp,
                quantity: before.quantity,
                relativeQuantityError: before.relativeQuantityError
            },
            after: {
                objective: after.objective,
                meanDeltaE00: after.meanDeltaE00,
                maxDeltaE00: after.maxDeltaE00,
                rmsDeltaE00: after.rmsDeltaE00,
                deltaUpVp: after.deltaUpVp,
                quantity: after.quantity,
                relativeQuantityError: after.relativeQuantityError
            },
            results: after.results
        };
    }

    function optimizeMaterialPreference(options) {
        const settings = options || {};
        const channels = settings.channels;
        const initialValues = Array.isArray(settings.initialValues)
            ? settings.initialValues.map(function (value) { return clamp(value, 0, 100); })
            : null;
        if (!Array.isArray(channels) || !channels.length || !initialValues || initialValues.length !== channels.length) {
            throw new TypeError('channels and matching initialValues are required');
        }
        if (typeof settings.evaluateSpd !== 'function' || typeof settings.xyFromSpd !== 'function' ||
            typeof settings.xyToUpVp !== 'function') {
            throw new TypeError('evaluateSpd, xyFromSpd and xyToUpVp are required');
        }
        if (!settings.targetXy || !Number.isFinite(settings.targetXy.x) || !Number.isFinite(settings.targetXy.y)) {
            throw new TypeError('targetXy is required');
        }

        const targetUpVp = settings.xyToUpVp(settings.targetXy.x, settings.targetXy.y);
        const maxDeltaUpVp = Number.isFinite(settings.maxDeltaUpVp) ? Math.max(0, settings.maxDeltaUpVp) : 0.0015;
        const worstWeight = Number.isFinite(settings.worstWeight) ? Math.max(0, settings.worstWeight) : 0.35;
        const fidelityWeight = Number.isFinite(settings.fidelityWeight) ? Math.max(0, settings.fidelityWeight) : 0.04;
        const maxDeltaE00 = Number.isFinite(settings.maxDeltaE00) ? Math.max(0, settings.maxDeltaE00) : 8;
        const preferenceChroma = Number.isFinite(settings.preferenceChroma) ? clamp(settings.preferenceChroma, 0, 10) : 5;
        const profilesByMaterialId = settings.profilesByMaterialId && typeof settings.profilesByMaterialId === 'object'
            ? settings.profilesByMaterialId
            : null;
        const stepSizes = Array.isArray(settings.stepSizes) && settings.stepSizes.length
            ? settings.stepSizes.map(function (value) { return Math.max(0.1, Number(value) || 0.1); })
            : [12, 6, 3, 1];
        const maxPasses = Number.isFinite(settings.maxPasses) ? Math.max(1, Math.round(settings.maxPasses)) : 2;
        const targetPeak = Math.max.apply(Math, initialValues);
        const valueQuantum = Number.isFinite(settings.valueQuantum) ? Math.max(0, settings.valueQuantum) : 0;
        const quantityFromSpd = typeof settings.quantityFromSpd === 'function' ? settings.quantityFromSpd : null;
        const targetQuantity = quantityFromSpd ? Number(quantityFromSpd(combineSpd(channels, initialValues))) : NaN;
        const maxRelativeQuantityError = Number.isFinite(settings.maxRelativeQuantityError)
            ? Math.max(0, settings.maxRelativeQuantityError) : 0.005;
        let evaluations = 0;

        function evaluate(values) {
            const normalizedValues = normalizeValues(values, targetPeak, valueQuantum, channels, quantityFromSpd, targetQuantity);
            const spd = combineSpd(channels, normalizedValues);
            const quantity = quantityFromSpd ? Number(quantityFromSpd(spd)) : NaN;
            const relativeQuantityError = quantityFromSpd && targetQuantity > 0
                ? Math.abs(quantity - targetQuantity) / targetQuantity : 0;
            const quantityFeasible = relativeQuantityError <= maxRelativeQuantityError + 1e-12;
            const xy = settings.xyFromSpd(spd);
            const upvp = settings.xyToUpVp(xy.x, xy.y);
            const deltaUpVp = Math.hypot(upvp.up - targetUpVp.up, upvp.vp - targetUpVp.vp);
            const raw = settings.evaluateSpd(spd, normalizedValues);
            const hasExplicitSummary = raw && typeof raw.weightedMeanPreferenceError === 'number' &&
                !Number.isNaN(raw.weightedMeanPreferenceError);
            const summary = hasExplicitSummary
                ? raw
                : summarizeMaterialPreference(raw && raw.results ? raw.results : raw,
                    profilesByMaterialId || {
                        preferenceChroma,
                        hueWeight: settings.hueWeight,
                        lightnessWeight: settings.lightnessWeight,
                        fidelityWeight,
                        maxDeltaE00
                    });
            const objective = summary.weightedMeanPreferenceError + worstWeight * summary.maxPreferenceError;
            evaluations += 1;
            return {
                values: normalizedValues,
                spd,
                xy,
                deltaUpVp,
                feasible: Number.isFinite(objective) && deltaUpVp <= maxDeltaUpVp + 1e-12 && quantityFeasible,
                quantityFeasible,
                objective,
                quantity,
                relativeQuantityError,
                weightedMeanPreferenceError: summary.weightedMeanPreferenceError,
                meanPreferenceError: summary.weightedMeanPreferenceError,
                maxPreferenceError: summary.maxPreferenceError,
                weightedMeanChromaError: summary.weightedMeanChromaError,
                meanChromaError: summary.weightedMeanChromaError,
                maxChromaError: summary.maxChromaError,
                weightedMeanDeltaC: summary.weightedMeanDeltaC,
                meanDeltaC: summary.weightedMeanDeltaC,
                weightedTargetDeltaC: summary.weightedTargetDeltaC,
                targetChromaMean: summary.weightedTargetDeltaC,
                meanAbsDeltaH: summary.meanAbsDeltaH,
                meanAbsDeltaL: summary.meanAbsDeltaL,
                meanDeltaE00: summary.meanDeltaE00,
                maxDeltaE00: summary.maxDeltaE00,
                worstMaterialId: summary.worstMaterialId,
                maxDeltaE00MaterialId: summary.maxDeltaE00MaterialId,
                perMaterial: summary.perMaterial || [],
                results: summary.results || []
            };
        }

        const before = evaluate(initialValues);
        let best = before;
        const epsilon = 1e-9;

        function consider(values, seen) {
            const normalized = normalizeValues(values, targetPeak, valueQuantum, channels, quantityFromSpd, targetQuantity);
            const key = candidateKey(normalized);
            if (seen.has(key)) return false;
            seen.add(key);
            const candidate = evaluate(normalized);
            if (typeof settings.candidateGuard === 'function' && !settings.candidateGuard(candidate, before)) return false;
            if (!candidate.feasible) {
                if (!best.feasible && candidate.quantityFeasible && candidate.deltaUpVp < best.deltaUpVp - epsilon) {
                    best = candidate;
                    return true;
                }
                return false;
            }
            if (!best.feasible || candidate.objective < best.objective - epsilon) {
                best = candidate;
                return true;
            }
            return false;
        }

        for (const step of stepSizes) {
            for (let pass = 0; pass < maxPasses; pass++) {
                const origin = best.values.slice();
                const seen = new Set([candidateKey(origin)]);
                let improved = false;
                for (let first = 0; first < channels.length; first++) {
                    for (const direction of [-1, 1]) {
                        const candidate = origin.slice();
                        candidate[first] += direction * step;
                        if (consider(candidate, seen)) improved = true;
                    }
                }
                for (let first = 0; first < channels.length; first++) {
                    for (let second = first + 1; second < channels.length; second++) {
                        for (const directions of [[1, -1], [-1, 1], [1, 1], [-1, -1]]) {
                            const candidate = origin.slice();
                            candidate[first] += directions[0] * step;
                            candidate[second] += directions[1] * step;
                            if (consider(candidate, seen)) improved = true;
                        }
                    }
                }
                if (!improved) break;
            }
        }

        function publicSummary(value) {
            return {
                objective: value.objective,
                weightedMeanPreferenceError: value.weightedMeanPreferenceError,
                meanPreferenceError: value.weightedMeanPreferenceError,
                maxPreferenceError: value.maxPreferenceError,
                weightedMeanChromaError: value.weightedMeanChromaError,
                meanChromaError: value.weightedMeanChromaError,
                maxChromaError: value.maxChromaError,
                weightedMeanDeltaC: value.weightedMeanDeltaC,
                meanDeltaC: value.weightedMeanDeltaC,
                weightedTargetDeltaC: value.weightedTargetDeltaC,
                targetChromaMean: value.weightedTargetDeltaC,
                meanAbsDeltaH: value.meanAbsDeltaH,
                meanAbsDeltaL: value.meanAbsDeltaL,
                meanDeltaE00: value.meanDeltaE00,
                maxDeltaE00: value.maxDeltaE00,
                worstMaterialId: value.worstMaterialId,
                maxDeltaE00MaterialId: value.maxDeltaE00MaterialId,
                deltaUpVp: value.deltaUpVp,
                quantity: value.quantity,
                relativeQuantityError: value.relativeQuantityError
            };
        }

        return {
            feasible: best.feasible,
            improved: best.feasible && (!before.feasible || best.objective < before.objective - epsilon),
            values: best.values.slice(),
            evaluations,
            before: publicSummary(before),
            after: publicSummary(best),
            perMaterial: best.perMaterial,
            results: best.results
        };
    }

    return Object.freeze({
        combineSpd,
        summarizeMaterialResults,
        summarizeMaterialPreference,
        preferredChromaTarget,
        optimizeMaterialFidelity,
        optimizeMaterialPreference
    });
});
