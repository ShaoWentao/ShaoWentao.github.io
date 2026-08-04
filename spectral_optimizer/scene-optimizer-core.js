(function (root, factory) {
    const api = factory(
        root.CIE_SPECTRAL_DATA,
        root.SpectralMath,
        root.ColourQuality,
        root.CandidateShortlist,
        root.METAMER_OPTIMIZER
    );
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) root.SceneOptimizerCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (
    CIE_DATA,
    SpectralMath,
    ColourQuality,
    CandidateShortlist,
    MetamerOptimizer
) {
    'use strict';

    const WAVELENGTHS = Object.freeze(Array.from({ length: 401 }, function (_, index) {
        return 380 + index;
    }));
    const DEFAULT_TOLERANCE = 0.0005;
    const PRIMES = [2, 3, 5, 7, 11, 13];

    function validateChannels(channels) {
        if (!Array.isArray(channels) || channels.length < 2 || channels.length > 6) {
            throw new RangeError('scene optimizer requires 2 to 6 channels');
        }
        const length = channels[0] && channels[0].spd ? channels[0].spd.length : 0;
        if (length !== 401) throw new RangeError('channel SPD must contain 401 points');
        channels.forEach(function (channel) {
            if (!channel || !channel.spd || channel.spd.length !== length) {
                throw new RangeError('all channel SPDs must share the 401-point grid');
            }
            for (let index = 0; index < length; index++) {
                if (!Number.isFinite(channel.spd[index]) || channel.spd[index] < 0) {
                    throw new TypeError('channel SPD values must be finite and non-negative');
                }
            }
        });
    }

    function combineSpd(channels, values) {
        validateChannels(channels);
        if (!Array.isArray(values) || values.length !== channels.length) {
            throw new RangeError('channel values must match channel count');
        }
        const combined = new Array(401).fill(0);
        channels.forEach(function (channel, channelIndex) {
            const scale = Math.max(0, Math.min(100, Number(values[channelIndex]) || 0)) / 100;
            for (let index = 0; index < combined.length; index++) {
                combined[index] += channel.spd[index] * scale;
            }
        });
        return combined;
    }

    function xyzFromSpd(spd) {
        if (!CIE_DATA || !CIE_DATA.xBar || !CIE_DATA.yBar || !CIE_DATA.zBar) {
            throw new Error('CIE spectral data unavailable');
        }
        let X = 0;
        let Y = 0;
        let Z = 0;
        for (let index = 0; index < spd.length; index++) {
            const value = Number.isFinite(spd[index]) ? spd[index] : 0;
            X += value * CIE_DATA.xBar[index];
            Y += value * CIE_DATA.yBar[index];
            Z += value * CIE_DATA.zBar[index];
        }
        return { X, Y, Z };
    }

    function xyFromSpd(spd) {
        const xyz = xyzFromSpd(spd);
        const sum = xyz.X + xyz.Y + xyz.Z;
        return sum > 1e-12 ? { x: xyz.X / sum, y: xyz.Y / sum } : { x: 0, y: 0 };
    }

    function cctFromSpd(spd) {
        const xy = xyFromSpd(spd);
        if (!SpectralMath || typeof SpectralMath.estimateCctAndDuvFromXy !== 'function') return 0;
        const estimate = SpectralMath.estimateCctAndDuvFromXy(xy.x, xy.y);
        return estimate && Number.isFinite(estimate.cct) ? estimate.cct : 0;
    }

    function normalize(values) {
        const max = Math.max.apply(Math, values);
        if (!(max > 0)) return values.map(function () { return 0; });
        return values.map(function (value) { return value / max; });
    }

    function refineChromaticity(channels, initialValues, targetXy) {
        const targetUv = xyToUv(targetXy);
        const values = initialValues.map(function (value) {
            return Math.max(0, Math.min(100, Number(value) || 0));
        });
        function error(candidateValues) {
            const uv = xyToUv(xyFromSpd(combineSpd(channels, candidateValues)));
            return Math.hypot(uv.u - targetUv.u, uv.v - targetUv.v);
        }
        let currentError = error(values);
        const steps = [4, 2, 1, 0.5, 0.25, 0.1, 0.05, 0.02, 0.01, 0.005, 0.002, 0.001];
        for (const step of steps) {
            let improved = true;
            let sweep = 0;
            while (improved && sweep < 6) {
                improved = false;
                sweep += 1;
                for (let channelIndex = 0; channelIndex < values.length; channelIndex++) {
                    const original = values[channelIndex];
                    let bestValue = original;
                    let bestError = currentError;
                    for (const direction of [-1, 1]) {
                        const candidate = Math.max(0, Math.min(100, original + direction * step));
                        values[channelIndex] = candidate;
                        const candidateError = error(values);
                        if (candidateError + 1e-12 < bestError) {
                            bestError = candidateError;
                            bestValue = candidate;
                        }
                    }
                    values[channelIndex] = bestValue;
                    if (bestError + 1e-12 < currentError) improved = true;
                    currentError = bestError;
                }
            }
        }
        return values.map(function (value) { return Number(value.toFixed(4)); });
    }

    function fitChannelsToReference(channels, referenceSpd) {
        const target = normalize(Array.from(referenceSpd));
        const targetXy = xyFromSpd(referenceSpd);
        const count = channels.length;
        function loss(values) {
            const raw = combineSpd(channels, values);
            const combined = normalize(raw);
            const xy = xyFromSpd(raw);
            let sum = 0;
            let weightSum = 0;
            for (let index = 0; index < combined.length; index += 2) {
                const wavelength = 380 + index;
                const weight = wavelength >= 420 && wavelength <= 700 ? 1 : 0.45;
                const difference = combined[index] - target[index];
                sum += difference * difference * weight;
                weightSum += weight;
            }
            const spectralLoss = sum / Math.max(1, weightSum);
            const xyLoss = (xy.x - targetXy.x) ** 2 + (xy.y - targetXy.y) ** 2;
            return spectralLoss + xyLoss * 650;
        }
        const seeds = [
            Array(count).fill(50),
            Array(count).fill(100),
            Array(count).fill(25),
            channels.map(function (channel) {
                const peak = channel.peak || 560;
                if (peak < 480) return 72;
                if (peak < 545) return 58;
                if (peak < 600) return 42;
                return 30;
            }),
            channels.map(function (channel) {
                const peak = channel.peak || 560;
                if (peak < 480) return 35;
                if (peak < 545) return 46;
                if (peak < 600) return 60;
                return 52;
            })
        ];
        let bestValues = seeds[0].slice();
        let bestLoss = Infinity;
        seeds.forEach(function (seed) {
            const values = seed.slice(0, count);
            let currentLoss = loss(values);
            let step = 34;
            for (let round = 0; round < 12; round++) {
                let improved = false;
                for (let channelIndex = 0; channelIndex < count; channelIndex++) {
                    const original = values[channelIndex];
                    let localValue = original;
                    let localLoss = currentLoss;
                    const candidates = [
                        Math.max(0, original - step),
                        Math.min(100, original + step),
                        Math.max(0, original - step * 0.5),
                        Math.min(100, original + step * 0.5),
                        Math.max(0, original - step * 0.25),
                        Math.min(100, original + step * 0.25)
                    ];
                    candidates.forEach(function (candidate) {
                        values[channelIndex] = candidate;
                        const candidateLoss = loss(values);
                        if (candidateLoss + 1e-10 < localLoss) {
                            localLoss = candidateLoss;
                            localValue = candidate;
                            improved = true;
                        }
                    });
                    values[channelIndex] = localValue;
                    currentLoss = localLoss;
                }
                if (!improved) step *= 0.5;
                if (step < 0.35) break;
            }
            if (currentLoss < bestLoss) {
                bestLoss = currentLoss;
                bestValues = values.slice();
            }
        });
        const maxValue = Math.max.apply(Math, bestValues);
        if (maxValue > 0 && maxValue < 98) {
            const scale = 98 / maxValue;
            bestValues = bestValues.map(function (value) { return Math.min(100, value * scale); });
        }
        return refineChromaticity(channels, bestValues, targetXy);
    }

    function seedForTarget(channels, targetCct) {
        return channels.map(function (channel) {
            const peak = channel.peak || 560;
            if (targetCct >= 4800) {
                if (peak < 485) return 62;
                if (peak < 545) return 58;
                if (peak < 585) return 46;
                return 28;
            }
            if (targetCct >= 3800) {
                if (peak < 485) return 44;
                if (peak < 545) return 52;
                if (peak < 585) return 54;
                return 42;
            }
            if (targetCct >= 3000) {
                if (peak < 485) return 22;
                if (peak < 545) return 34;
                if (peak < 600) return 58;
                return 68;
            }
            if (peak < 485) return 6;
            if (peak < 545) return 12;
            if (peak < 600) return 44;
            return 88;
        });
    }

    function fitChannelsToTarget(channels, targetCct, targetXy, initialValues) {
        const count = channels.length;
        const seeds = [
            Array.isArray(initialValues) && initialValues.length === count ? initialValues.slice() : seedForTarget(channels, targetCct),
            seedForTarget(channels, targetCct + 1000),
            seedForTarget(channels, targetCct - 1000),
            Array(count).fill(50),
            channels.map(function (channel) { return (channel.peak || 560) < 500 ? 60 : 35; }),
            channels.map(function (channel) { return (channel.peak || 560) < 500 ? 20 : 80; })
        ];
        function loss(values) {
            const spd = combineSpd(channels, values);
            const xy = xyFromSpd(spd);
            const cct = cctFromSpd(spd);
            const cctError = Number.isFinite(cct) && cct > 0 ? Math.log(cct / targetCct) : 2;
            const xyError = (xy.x - targetXy.x) ** 2 + (xy.y - targetXy.y) ** 2;
            const average = values.reduce(function (sum, value) { return sum + value; }, 0) / count;
            return cctError * cctError * 1.5 + xyError * 980 + (100 - average) * 0.000005;
        }
        let bestValues = seeds[0].slice();
        let bestLoss = Infinity;
        seeds.forEach(function (seed) {
            const values = seed.slice(0, count).map(function (value) {
                return Math.max(0, Math.min(100, value));
            });
            let currentLoss = loss(values);
            let step = 36;
            for (let round = 0; round < 12; round++) {
                let improved = false;
                for (let channelIndex = 0; channelIndex < count; channelIndex++) {
                    const original = values[channelIndex];
                    let localValue = original;
                    let localLoss = currentLoss;
                    const candidates = [
                        Math.max(0, original - step),
                        Math.min(100, original + step),
                        Math.max(0, original - step * 0.5),
                        Math.min(100, original + step * 0.5),
                        Math.max(0, original - step * 0.25),
                        Math.min(100, original + step * 0.25)
                    ];
                    candidates.forEach(function (candidate) {
                        values[channelIndex] = candidate;
                        const candidateLoss = loss(values);
                        if (candidateLoss + 1e-10 < localLoss) {
                            localLoss = candidateLoss;
                            localValue = candidate;
                            improved = true;
                        }
                    });
                    values[channelIndex] = localValue;
                    currentLoss = localLoss;
                }
                if (!improved) step *= 0.5;
                if (step < 0.35) break;
            }
            if (currentLoss < bestLoss) {
                bestLoss = currentLoss;
                bestValues = values.slice();
            }
        });
        return refineChromaticity(channels, bestValues, targetXy);
    }

    function radicalInverse(index, base) {
        let fraction = 1;
        let value = 0;
        while (index > 0) {
            fraction /= base;
            value += fraction * (index % base);
            index = Math.floor(index / base);
        }
        return value;
    }

    function xyToUv(xy) {
        if (SpectralMath && typeof SpectralMath.xyToUv === 'function') {
            return SpectralMath.xyToUv(xy.x, xy.y);
        }
        const denominator = -2 * xy.x + 12 * xy.y + 3;
        return denominator ? { u: 4 * xy.x / denominator, v: 6 * xy.y / denominator } : { u: 0, v: 0 };
    }

    function qualityForSpd(spd) {
        if (!ColourQuality || typeof ColourQuality.calculateColourQualityFromSpectrum !== 'function') {
            return { ra: 0, r9: 0, rf: 0, rg: 0 };
        }
        return ColourQuality.calculateColourQualityFromSpectrum({ wavelengths: WAVELENGTHS, values: spd });
    }

    function buildChromaticityNullspace(channels, targetXy) {
        const columns = channels.map(function (channel) {
            const xyz = xyzFromSpd(channel.spd);
            const total = xyz.X + xyz.Y + xyz.Z;
            return {
                a: xyz.X - targetXy.x * total,
                b: xyz.Y - targetXy.y * total
            };
        });
        let firstPivot = -1;
        let secondPivot = -1;
        let bestDeterminant = 0;
        for (let first = 0; first < columns.length - 1; first++) {
            for (let second = first + 1; second < columns.length; second++) {
                const determinant = columns[first].a * columns[second].b -
                    columns[second].a * columns[first].b;
                if (Math.abs(determinant) > Math.abs(bestDeterminant)) {
                    bestDeterminant = determinant;
                    firstPivot = first;
                    secondPivot = second;
                }
            }
        }
        if (firstPivot < 0 || secondPivot < 0 || Math.abs(bestDeterminant) < 1e-12) return [];

        const basis = [];
        for (let free = 0; free < columns.length; free++) {
            if (free === firstPivot || free === secondPivot) continue;
            const direction = new Array(columns.length).fill(0);
            direction[free] = 1;
            direction[firstPivot] = (-columns[free].a * columns[secondPivot].b +
                columns[secondPivot].a * columns[free].b) / bestDeterminant;
            direction[secondPivot] = (-columns[firstPivot].a * columns[free].b +
                columns[free].a * columns[firstPivot].b) / bestDeterminant;
            const scale = Math.max.apply(Math, direction.map(Math.abs));
            if (!(scale > 1e-12)) continue;
            basis.push(direction.map(function (value) { return value / scale; }));
        }
        return basis;
    }

    function withinChannelBounds(values) {
        return values.every(function (value) {
            return Number.isFinite(value) && value >= -1e-9 && value <= 100 + 1e-9;
        });
    }

    function prioritizeQuality(channels, solution, payload, mode) {
        if (channels.length <= 3) return Object.assign({}, solution, { qualityEvaluations: 0 });
        const maxGlobalSamples = Number.isInteger(payload.maxGlobalSamples) ? payload.maxGlobalSamples : 8192;
        const maxCandidates = Number.isInteger(payload.maxCandidates) ? payload.maxCandidates : 512;
        const tolerance = Number.isFinite(payload.chromaticityTolerance)
            ? payload.chromaticityTolerance : DEFAULT_TOLERANCE;
        const targetXy = mode === 'vitality' ? xyFromSpd(combineSpd(channels, solution.values)) : payload.targetXy;
        const targetUv = xyToUv(targetXy);
        const comparisonOptions = mode === 'vitality'
            ? { mode: 'vitality', r9Floor: 40 }
            : { mode: 'fidelity', r9Floor: 50 };
        const evaluated = new Set();
        let best = null;
        let qualityEvaluations = 0;

        function evaluateValues(values) {
            if (qualityEvaluations >= maxCandidates) return null;
            const bounded = values.map(function (value) {
                return Math.max(0, Math.min(100, Number(value) || 0));
            });
            const key = bounded.map(function (value) { return value.toFixed(4); }).join(',');
            if (evaluated.has(key)) return null;
            evaluated.add(key);
            const spd = combineSpd(channels, bounded);
            const xy = xyFromSpd(spd);
            const uv = xyToUv(xy);
            const deltaUv = Math.hypot(uv.u - targetUv.u, uv.v - targetUv.v);
            if (!Number.isFinite(deltaUv) || deltaUv > tolerance) return null;
            const metrics = qualityForSpd(spd);
            qualityEvaluations += 1;
            if (!Number.isFinite(metrics.rf) || !Number.isFinite(metrics.ra) || !Number.isFinite(metrics.r9)) return null;
            if (mode === 'vitality' && metrics.rf < 80) return null;
            const ranked = mode === 'vitality' ? {
                values: bounded,
                rgError: Math.abs(metrics.rg - 110),
                ra: metrics.ra,
                r9: metrics.r9,
                rf: metrics.rf,
                deltaUv,
                xy
            } : {
                values: bounded,
                ra: metrics.ra,
                r9: metrics.r9,
                rf: metrics.rf,
                deltaUv,
                xy
            };
            if (MetamerOptimizer.isBetterColourCandidate(ranked, best, comparisonOptions)) best = ranked;
            return ranked;
        }

        let currentValues = solution.values.slice();
        let current = evaluateValues(currentValues);
        const basis = buildChromaticityNullspace(channels, targetXy);
        const steps = [32, 16, 8, 4, 2, 1, 0.5, 0.25, 0.1];
        for (const step of steps) {
            if (qualityEvaluations >= maxCandidates) break;
            for (const direction of basis) {
                if (qualityEvaluations >= maxCandidates) break;
                let bestMove = current;
                let bestValues = currentValues;
                for (const sign of [-1, 1]) {
                    const candidateValues = currentValues.map(function (value, index) {
                        return value + sign * step * direction[index];
                    });
                    if (!withinChannelBounds(candidateValues)) continue;
                    const candidate = evaluateValues(candidateValues);
                    if (candidate && (!bestMove ||
                        MetamerOptimizer.isBetterColourCandidate(candidate, bestMove, comparisonOptions))) {
                        bestMove = candidate;
                        bestValues = candidateValues;
                    }
                }
                if (bestMove && bestMove !== current) {
                    current = bestMove;
                    currentValues = bestValues.slice();
                }
            }
        }

        if (qualityEvaluations < maxCandidates) {
            const candidates = [];
            let sequence = 0;
            function collect(values) {
                const spd = combineSpd(channels, values);
                const xy = xyFromSpd(spd);
                const uv = xyToUv(xy);
                const deltaUv = Math.hypot(uv.u - targetUv.u, uv.v - targetUv.v);
                if (!Number.isFinite(deltaUv) || deltaUv > tolerance) return;
                candidates.push({ values: values.slice(), xy, deltaUv, sequence: sequence++ });
            }
            for (let sample = 1; sample <= maxGlobalSamples; sample++) {
                collect(channels.map(function (_, index) {
                    return radicalInverse(sample, PRIMES[index]) * 100;
                }));
                if (mode === 'fidelity') {
                    collect(channels.map(function (_, index) {
                        return Math.max(0, Math.min(100,
                            solution.values[index] + (radicalInverse(sample, PRIMES[index]) - 0.5) * 120));
                    }));
                }
            }
            const remaining = Math.max(0, maxCandidates - qualityEvaluations);
            if (remaining > 0 && candidates.length) {
                const shortlist = CandidateShortlist.selectCandidateShortlist(candidates, {
                    maxCandidates: remaining,
                    precisionFraction: 0.5
                });
                shortlist.forEach(function (candidate) { evaluateValues(candidate.values); });
            }
        }

        if (!best) return Object.assign({}, solution, { qualityEvaluations });
        return {
            values: best.values,
            cct: cctFromSpd(combineSpd(channels, best.values)),
            error: Math.hypot(best.xy.x - targetXy.x, best.xy.y - targetXy.y),
            deltaUv: best.deltaUv,
            qualityEvaluations
        };
    }

    function optimizeScene(payload) {
        const request = payload || {};
        const channels = request.channels;
        validateChannels(channels);
        if (!request.targetXy || !Number.isFinite(request.targetXy.x) || !Number.isFinite(request.targetXy.y)) {
            throw new TypeError('targetXy is required');
        }
        const neutral = Math.abs(Number(request.targetDuv) || 0) < 1e-9;
        let values;
        if (neutral) {
            if (!request.referenceSpd || request.referenceSpd.length !== 401) {
                throw new RangeError('neutral optimisation requires a 401-point reference SPD');
            }
            values = fitChannelsToReference(channels, request.referenceSpd);
        } else {
            values = fitChannelsToTarget(
                channels,
                Number(request.targetCct) || 4000,
                request.targetXy,
                request.initialValues
            );
        }
        const spd = combineSpd(channels, values);
        const xy = xyFromSpd(spd);
        const targetUv = xyToUv(request.targetXy);
        const actualUv = xyToUv(xy);
        const solution = {
            values,
            cct: cctFromSpd(spd),
            error: Math.hypot(xy.x - request.targetXy.x, xy.y - request.targetXy.y),
            deltaUv: Math.hypot(actualUv.u - targetUv.u, actualUv.v - targetUv.v),
            qualityEvaluations: 0
        };
        if (request.skipColourQuality === true) return solution;
        const mode = request.emphasis === 'high-fidelity-and-rg-105-115' ? 'vitality' : 'fidelity';
        return prioritizeQuality(channels, solution, request, mode);
    }

    return {
        optimizeScene,
        combineSpd,
        xyFromSpd,
        fitChannelsToReference,
        fitChannelsToTarget
    };
});
