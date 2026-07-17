(function(root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) root.METAMER_OPTIMIZER = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
    const CHROMATICITY_TOLERANCE = 0.002;
    const RF_FLOOR = 80;
    const STEP_SIZES = [24, 12, 6, 3, 1, 0.5];
    const EPSILON = 1e-10;

    function clampPercentage(value) {
        return Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
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

    function meetsRfFloor(candidate) {
        return candidate && candidate.achievedRf >= RF_FLOOR;
    }

    function optimizeMetamer(options) {
        const {
            channels,
            targetXy,
            targetRg,
            evaluateSpd,
            xyToUv
        } = options;
        const suppliedBaseline = options.baselineValues || options.baselinePercentages;

        if (!Array.isArray(channels) || channels.length === 0 ||
            !Array.isArray(suppliedBaseline) || suppliedBaseline.length !== channels.length ||
            !targetXy || !Number.isFinite(targetRg) ||
            typeof evaluateSpd !== 'function' || typeof xyToUv !== 'function') {
            throw new Error('Invalid metamer optimizer options');
        }

        const baselineValues = suppliedBaseline.map(clampPercentage);
        const targetUv = xyToUv(targetXy.x, targetXy.y);
        const candidates = new Map();

        function addCandidate(values) {
            const boundedValues = values.map(clampPercentage);
            const key = boundedValues.join(',');
            if (candidates.has(key)) return;

            const metrics = evaluateSpd(combineSpd(channels, boundedValues));
            const xy = readXy(metrics || {});
            const uv = xyToUv(xy.x, xy.y);
            const deltaUv = Math.hypot(uv.u - targetUv.u, uv.v - targetUv.v);
            if (!Number.isFinite(deltaUv) || !Number.isFinite(metrics.rg) || !Number.isFinite(metrics.rf) ||
                deltaUv > CHROMATICITY_TOLERANCE) return;

            candidates.set(key, {
                values: boundedValues,
                achievedRg: metrics.rg,
                achievedRf: metrics.rf,
                deltaUv,
                rgError: Math.abs(metrics.rg - targetRg),
                rfPenalty: Math.max(0, RF_FLOOR - metrics.rf),
                distance: distanceFromBaseline(boundedValues, baselineValues)
            });
        }

        const seeds = [baselineValues];
        for (let index = 0; index < channels.length; index++) {
            const zeroSeed = baselineValues.slice();
            zeroSeed[index] = 0;
            seeds.push(zeroSeed);
            const fullSeed = baselineValues.slice();
            fullSeed[index] = 100;
            seeds.push(fullSeed);
        }

        for (const seed of seeds) {
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
                    let bestMove = meetsRfFloor(currentCandidate) ? currentCandidate : null;
                    if (meetsRfFloor(lowerCandidate) && isBetter(lowerCandidate, bestMove)) bestMove = lowerCandidate;
                    if (meetsRfFloor(upperCandidate) && isBetter(upperCandidate, bestMove)) bestMove = upperCandidate;
                    if (bestMove) current = bestMove.values.slice();
                }
            }
        }

        let best = null;
        for (const candidate of candidates.values()) {
            if (candidate.achievedRf >= RF_FLOOR && isBetter(candidate, best)) best = candidate;
        }

        if (!best) {
            for (const candidate of candidates.values()) {
                if (isBetter(candidate, best)) best = candidate;
            }
        }

        if (!best) {
            return {
                values: baselineValues,
                achievedRg: NaN,
                achievedRf: NaN,
                deltaUv: Infinity,
                exact: false
            };
        }

        return {
            values: best.values,
            achievedRg: best.achievedRg,
            achievedRf: best.achievedRf,
            deltaUv: best.deltaUv,
            exact: best.rgError <= EPSILON && best.achievedRf >= RF_FLOOR
        };
    }

    return { optimizeMetamer };
});
