(function(root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) root.METAMER_OPTIMIZER = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
    const CHROMATICITY_TOLERANCE = 0.002;
    const SATURATION_CHROMATICITY_TOLERANCE = 0.0005;
    const RF_FLOOR = 80;
    const TARGET_RG_MIN = 80;
    const TARGET_RG_MAX = 130;
    const MAX_CORNER_SEEDS = 64;
    const INTERIOR_LEVELS = [25, 75];
    const MAX_REFINEMENT_SEEDS = 16;
    const STEP_SIZES = [48, 24, 12, 6, 3, 1, 0.5];
    const EPSILON = 1e-10;

    function clampPercentage(value) {
        return Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
    }

    function resolveComparisonBaseline(options) {
        const {
            metamerModeEnabled,
            compareSpectrumEnabled,
            baselineSnapshot,
            activeChannelIds
        } = options || {};
        if (!metamerModeEnabled || !compareSpectrumEnabled || !baselineSnapshot ||
            !Array.isArray(activeChannelIds) || !Array.isArray(baselineSnapshot.channelIds) ||
            baselineSnapshot.channelIds.length !== activeChannelIds.length) return null;

        return baselineSnapshot.channelIds.every((id, index) => id === activeChannelIds[index])
            ? baselineSnapshot
            : null;
    }

    function getBaselineTargetXy(baselineSnapshot) {
        const xy = baselineSnapshot && baselineSnapshot.xy;
        if (!xy || !Number.isFinite(xy.x) || !Number.isFinite(xy.y)) {
            throw new TypeError('baselineSnapshot.xy must be finite');
        }
        return { x: xy.x, y: xy.y };
    }

    function deltaUvBetween(firstUv, secondUv) {
        if (!firstUv || !secondUv ||
            !Number.isFinite(firstUv.u) || !Number.isFinite(firstUv.v) ||
            !Number.isFinite(secondUv.u) || !Number.isFinite(secondUv.v)) return NaN;
        return Math.hypot(secondUv.u - firstUv.u, secondUv.v - firstUv.v);
    }

    function formatRoundedMetricDelta(value, baselineValue) {
        if (!Number.isFinite(value) || !Number.isFinite(baselineValue)) return '';
        const delta = Math.round(value - baselineValue);
        if (delta === 0) return '(0)';
        return `(${delta > 0 ? '+' : ''}${delta})`;
    }

    function combineSpd(channels, values) {
        const length = channels[0].spd.length;
        const combined = new Float64Array(length);
        for (let channelIndex = 0; channelIndex < channels.length; channelIndex++) {
            const spd = channels[channelIndex].spd;
            const duty = values[channelIndex] / 100;
            for (let sampleIndex = 0; sampleIndex < length; sampleIndex++) {
                combined[sampleIndex] += duty * (spd[sampleIndex] || 0);
            }
        }
        return combined;
    }

    function readXy(metrics) {
        if (metrics.xy && Number.isFinite(metrics.xy.x) && Number.isFinite(metrics.xy.y)) {
            return metrics.xy;
        }
        return { x: metrics.x, y: metrics.y };
    }

    function distanceFromBaseline(values, baselineValues) {
        let sum = 0;
        for (let index = 0; index < values.length; index++) {
            const difference = values[index] - baselineValues[index];
            sum += difference * difference;
        }
        return Math.sqrt(sum);
    }

    function compareValues(left, right) {
        for (let index = 0; index < left.length; index++) {
            if (Math.abs(left[index] - right[index]) > EPSILON) {
                return left[index] - right[index];
            }
        }
        return 0;
    }

    function isBetter(candidate, current) {
        if (!current) return true;
        if (Math.abs(candidate.rgError - current.rgError) > EPSILON) {
            return candidate.rgError < current.rgError;
        }
        if (Math.abs(candidate.rfPenalty - current.rfPenalty) > EPSILON) {
            return candidate.rfPenalty < current.rfPenalty;
        }
        if (Math.abs(candidate.distance - current.distance) > EPSILON) {
            return candidate.distance < current.distance;
        }
        return compareValues(candidate.values, current.values) < 0;
    }

    function isBetterColourCandidate(candidate, current, options) {
        if (!current) return true;
        const mode = options && options.mode === 'vitality' ? 'vitality' : 'fidelity';
        const r9Floor = Number.isFinite(options && options.r9Floor) ? options.r9Floor : 50;
        const candidateMeetsR9 = Number.isFinite(candidate.r9) && candidate.r9 >= r9Floor;
        const currentMeetsR9 = Number.isFinite(current.r9) && current.r9 >= r9Floor;
        if (candidateMeetsR9 !== currentMeetsR9) return candidateMeetsR9;

        if (!candidateMeetsR9 && Math.abs(candidate.r9 - current.r9) > EPSILON) {
            return candidate.r9 > current.r9;
        }
        if (mode === 'vitality' && Math.abs(candidate.rgError - current.rgError) > EPSILON) {
            return candidate.rgError < current.rgError;
        }
        if (Math.abs(candidate.ra - current.ra) > EPSILON) return candidate.ra > current.ra;
        if (Math.abs(candidate.r9 - current.r9) > EPSILON) return candidate.r9 > current.r9;
        if (Math.abs(candidate.rf - current.rf) > EPSILON) return candidate.rf > current.rf;
        return false;
    }

    function buildSeeds(baselineValues) {
        const seeds = [baselineValues];
        const variedChannels = Math.min(baselineValues.length, Math.log2(MAX_CORNER_SEEDS));
        const cornerCount = 2 ** variedChannels;
        for (let mask = 0; mask < cornerCount; mask++) {
            const corner = baselineValues.slice();
            for (let channelIndex = 0; channelIndex < variedChannels; channelIndex++) {
                corner[channelIndex] = (mask & (1 << channelIndex)) ? 100 : 0;
            }
            seeds.push(corner);
        }
        for (let mask = 0; mask < cornerCount; mask++) {
            const interior = baselineValues.slice();
            for (let channelIndex = 0; channelIndex < variedChannels; channelIndex++) {
                interior[channelIndex] = INTERIOR_LEVELS[(mask >> channelIndex) & 1];
            }
            seeds.push(interior);
        }
        return seeds;
    }

    function optimizeMetamer(options) {
        const {
            channels,
            targetXy,
            targetRg,
            evaluateSpd,
            xyToUv
        } = options;
        const objective = options.objective === 'fidelity' || options.objective === 'saturation'
            ? options.objective
            : 'target';
        const suppliedBaseline = options.baselineValues || options.baselinePercentages;

        if (!Array.isArray(channels) || channels.length === 0 ||
            !Array.isArray(suppliedBaseline) || suppliedBaseline.length !== channels.length ||
            !Number.isFinite(targetRg) ||
            typeof evaluateSpd !== 'function' || typeof xyToUv !== 'function') {
            throw new Error('Invalid metamer optimizer options');
        }
        if (!targetXy || !Number.isFinite(targetXy.x) || !Number.isFinite(targetXy.y)) {
            throw new TypeError('targetXy.x and targetXy.y must be finite');
        }
        if (targetRg < TARGET_RG_MIN || targetRg > TARGET_RG_MAX) {
            throw new RangeError('targetRg must be between 80 and 130');
        }

        const baselineValues = suppliedBaseline.map(clampPercentage);
        const targetUv = xyToUv(targetXy.x, targetXy.y);
        const candidates = new Map();

        function addCandidate(values) {
            const boundedValues = values.map(clampPercentage);
            const key = boundedValues.join(',');
            if (candidates.has(key)) return candidates.get(key);

            const metrics = evaluateSpd(combineSpd(channels, boundedValues));
            const xy = readXy(metrics || {});
            const uv = xyToUv(xy.x, xy.y);
            const deltaUv = Math.hypot(uv.u - targetUv.u, uv.v - targetUv.v);
            const chromaticityTolerance = objective === 'saturation'
                ? SATURATION_CHROMATICITY_TOLERANCE
                : CHROMATICITY_TOLERANCE;
            if (!Number.isFinite(deltaUv) || !Number.isFinite(metrics.rg) || !Number.isFinite(metrics.rf) ||
                deltaUv > chromaticityTolerance) return null;
            if (objective === 'saturation' && metrics.rg > targetRg + EPSILON) return null;

            const candidate = {
                values: boundedValues,
                achievedRg: metrics.rg,
                achievedRf: metrics.rf,
                achievedRa: Number.isFinite(metrics.ra) ? metrics.ra : 0,
                achievedR9: Number.isFinite(metrics.r9) ? metrics.r9 : 0,
                deltaUv,
                rgError: Math.abs(metrics.rg - targetRg),
                rfPenalty: Math.max(0, RF_FLOOR - metrics.rf),
                distance: distanceFromBaseline(boundedValues, baselineValues)
            };
            candidates.set(key, candidate);
            return candidate;
        }

        function isBetterForObjective(candidate, current) {
            if (!current) return true;
            if (objective === 'fidelity') {
                if (Math.abs(candidate.achievedRf - current.achievedRf) > EPSILON) {
                    return candidate.achievedRf > current.achievedRf;
                }
                if (Math.abs(candidate.achievedRa - current.achievedRa) > EPSILON) {
                    return candidate.achievedRa > current.achievedRa;
                }
                if (Math.abs(candidate.achievedR9 - current.achievedR9) > EPSILON) {
                    return candidate.achievedR9 > current.achievedR9;
                }
            } else if (objective === 'saturation' && Math.abs(candidate.achievedRg - current.achievedRg) > EPSILON) {
                return candidate.achievedRg > current.achievedRg;
            } else if (objective === 'target') {
                return isBetter(candidate, current);
            }
            if (Math.abs(candidate.deltaUv - current.deltaUv) > EPSILON) {
                return candidate.deltaUv < current.deltaUv;
            }
            if (Math.abs(candidate.distance - current.distance) > EPSILON) {
                return candidate.distance < current.distance;
            }
            return compareValues(candidate.values, current.values) < 0;
        }

        function exploreSeed(seed, requireRfFloor) {
            let current = seed.slice();
            addCandidate(current);
            for (const step of STEP_SIZES) {
                for (let channelIndex = 0; channelIndex < current.length; channelIndex++) {
                    const lower = current.slice();
                    lower[channelIndex] -= step;
                    const upper = current.slice();
                    upper[channelIndex] += step;
                    addCandidate(lower);
                    addCandidate(upper);

                    const lowerCandidate = candidates.get(lower.map(clampPercentage).join(','));
                    const upperCandidate = candidates.get(upper.map(clampPercentage).join(','));
                    const currentCandidate = candidates.get(current.map(clampPercentage).join(','));
                    const isAllowed = candidate => candidate &&
                        (objective === 'saturation' || !requireRfFloor || candidate.achievedRf >= RF_FLOOR);
                    let bestMove = isAllowed(currentCandidate) ? currentCandidate : null;
                    if (isAllowed(lowerCandidate) && isBetterForObjective(lowerCandidate, bestMove)) bestMove = lowerCandidate;
                    if (isAllowed(upperCandidate) && isBetterForObjective(upperCandidate, bestMove)) bestMove = upperCandidate;
                    if (bestMove) current = bestMove.values.slice();
                }

                // Fixed-colour solutions often require two channels to move
                // together. Single-channel moves can leave the chromaticity
                // tolerance even when the paired endpoint is valid.
                for (let first = 0; first < current.length - 1; first++) {
                    for (let second = first + 1; second < current.length; second++) {
                        const currentCandidate = candidates.get(current.map(clampPercentage).join(','));
                        const isAllowed = candidate => candidate &&
                            (objective === 'saturation' || !requireRfFloor || candidate.achievedRf >= RF_FLOOR);
                        let bestMove = isAllowed(currentCandidate) ? currentCandidate : null;

                        const compensationRatios = objective === 'saturation'
                            ? [0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4]
                            : [1];
                        for (const firstDirection of [-1, 1]) {
                            for (const secondDirection of [-1, 1]) {
                                for (const compensationRatio of compensationRatios) {
                                const paired = current.slice();
                                paired[first] += firstDirection * step;
                                paired[second] += secondDirection * step * compensationRatio;
                                const candidate = addCandidate(paired);
                                if (isAllowed(candidate) && isBetterForObjective(candidate, bestMove)) bestMove = candidate;
                                }
                            }
                        }
                        if (bestMove) current = bestMove.values.slice();
                    }
                }

                // Fixed chromaticity imposes two constraints, so a useful
                // high-saturation move commonly needs three channels to move
                // together. Solve the two compensating moves from the local
                // u'v' Jacobian instead of relying on equal paired steps.
                if (objective === 'saturation' && current.length >= 3) {
                    const probe = 0.25;
                    const baseMetrics = evaluateSpd(combineSpd(channels, current));
                    const baseXy = readXy(baseMetrics || {});
                    const baseUv = xyToUv(baseXy.x, baseXy.y);
                    const derivatives = current.map((_, channelIndex) => {
                        const sampled = current.slice();
                        sampled[channelIndex] = clampPercentage(sampled[channelIndex] + probe);
                        if (Math.abs(sampled[channelIndex] - current[channelIndex]) <= EPSILON) {
                            sampled[channelIndex] = clampPercentage(current[channelIndex] - probe);
                        }
                        const signedProbe = sampled[channelIndex] - current[channelIndex];
                        if (Math.abs(signedProbe) <= EPSILON) return { u: 0, v: 0 };
                        const metrics = evaluateSpd(combineSpd(channels, sampled));
                        const xy = readXy(metrics || {});
                        const uv = xyToUv(xy.x, xy.y);
                        return { u: (uv.u - baseUv.u) / signedProbe, v: (uv.v - baseUv.v) / signedProbe };
                    });

                    let bestTriple = candidates.get(current.map(clampPercentage).join(',')) || null;
                    for (let primary = 0; primary < current.length; primary++) {
                        for (let second = 0; second < current.length - 1; second++) {
                            if (second === primary) continue;
                            for (let third = second + 1; third < current.length; third++) {
                                if (third === primary) continue;
                                const determinant = derivatives[second].u * derivatives[third].v -
                                    derivatives[third].u * derivatives[second].v;
                                if (Math.abs(determinant) < EPSILON) continue;
                                for (const direction of [-1, 1]) {
                                    const primaryDelta = direction * step;
                                    const targetU = -derivatives[primary].u * primaryDelta;
                                    const targetV = -derivatives[primary].v * primaryDelta;
                                    const secondDelta = (targetU * derivatives[third].v - derivatives[third].u * targetV) / determinant;
                                    const thirdDelta = (derivatives[second].u * targetV - targetU * derivatives[second].v) / determinant;
                                    if (Math.abs(secondDelta) > 100 || Math.abs(thirdDelta) > 100) continue;
                                    const triple = current.slice();
                                    triple[primary] += primaryDelta;
                                    triple[second] += secondDelta;
                                    triple[third] += thirdDelta;
                                    const candidate = addCandidate(triple);
                                    if (candidate && isBetterForObjective(candidate, bestTriple)) bestTriple = candidate;
                                }
                            }
                        }
                    }
                    if (bestTriple) current = bestTriple.values.slice();
                }
            }
        }

        const promisingSeeds = [];
        for (const seed of buildSeeds(baselineValues)) {
            const candidate = addCandidate(seed);
            if (candidate && (objective === 'saturation' || candidate.achievedRf >= RF_FLOOR)) promisingSeeds.push(candidate);
        }
        promisingSeeds.sort((left, right) => {
            if (isBetterForObjective(left, right)) return -1;
            if (isBetterForObjective(right, left)) return 1;
            return 0;
        });
        if (objective === 'saturation') exploreSeed(baselineValues, false);
        const refinementSeedLimit = objective === 'saturation' ? 4 : MAX_REFINEMENT_SEEDS;
        for (const candidate of promisingSeeds.slice(0, refinementSeedLimit)) {
            exploreSeed(candidate.values, false);
            exploreSeed(candidate.values, true);
        }

        let best = null;
        for (const candidate of candidates.values()) {
            if ((objective === 'saturation' || candidate.achievedRf >= RF_FLOOR) &&
                isBetterForObjective(candidate, best)) best = candidate;
        }

        if (!best) {
            return {
                values: null,
                achievedRg: null,
                achievedRf: null,
                deltaUv: null,
                exact: false,
                feasible: false
            };
        }

        return {
            values: best.values,
            achievedRg: best.achievedRg,
            achievedRf: best.achievedRf,
            achievedRa: best.achievedRa,
            achievedR9: best.achievedR9,
            deltaUv: best.deltaUv,
            exact: best.rgError <= EPSILON,
            feasible: true
        };
    }

    return {
        optimizeMetamer,
        resolveComparisonBaseline,
        getBaselineTargetXy,
        deltaUvBetween,
        formatRoundedMetricDelta,
        isBetterColourCandidate
    };
});
