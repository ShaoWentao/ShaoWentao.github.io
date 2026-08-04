(function (root, factory) {
    const api = factory(root.CIE_SPECTRAL_DATA || (root.window && root.window.CIE_SPECTRAL_DATA));
    if (typeof module === 'object' && module.exports) module.exports = api;
    root.SpectralMath = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (CIE_DATA) {
    'use strict';

    function xyToUv(x, y) {
        const denominator = -2 * x + 12 * y + 3;
        return {
            u: 4 * x / denominator,
            v: 6 * y / denominator
        };
    }

    function uvToXy(u, v) {
        const denominator = u - 4 * v + 2;
        return {
            x: 1.5 * u / denominator,
            y: v / denominator
        };
    }

    const PLANCKIAN_MIN_K = 1000;
    const PLANCKIAN_MAX_K = 25000;
    const PLANCKIAN_MIN_MIRED = 1e6 / PLANCKIAN_MAX_K;
    const PLANCKIAN_MAX_MIRED = 1e6 / PLANCKIAN_MIN_K;
    const PLANCKIAN_MIRED_STEP = 2;
    const planckianXyCache = new Map();
    let planckianObserverCache = null;
    let planckianLocusCache = null;

    function polynomialPlanckianXy(temperature) {
        const t = Math.max(1667, Math.min(25000, temperature));
        let x;
        if (t <= 4000) {
            x = -0.2661239e9 / t ** 3 - 0.2343589e6 / t ** 2 + 0.8776956e3 / t + 0.179910;
        } else {
            x = -3.0258469e9 / t ** 3 + 2.1070379e6 / t ** 2 + 0.2226347e3 / t + 0.240390;
        }
        let y;
        if (t <= 2222) {
            y = -1.1063814 * x ** 3 - 1.34811020 * x ** 2 + 2.18555832 * x - 0.20219683;
        } else if (t <= 4000) {
            y = -0.9549476 * x ** 3 - 1.37418593 * x ** 2 + 2.09137015 * x - 0.16748867;
        } else {
            y = 3.0817580 * x ** 3 - 5.87338670 * x ** 2 + 3.75112997 * x - 0.37001483;
        }
        return { x, y };
    }

    function planckianObserverData() {
        if (planckianObserverCache) return planckianObserverCache;
        if (!CIE_DATA || !CIE_DATA.xBar || !CIE_DATA.yBar || !CIE_DATA.zBar) return null;
        const length = Math.min(CIE_DATA.xBar.length, CIE_DATA.yBar.length, CIE_DATA.zBar.length);
        if (length < 2) return null;
        const lambdaMin = Number.isFinite(CIE_DATA.lambdaMin) ? CIE_DATA.lambdaMin : 380;
        const step = Number.isFinite(CIE_DATA.step) && CIE_DATA.step > 0 ? CIE_DATA.step : 1;
        planckianObserverCache = Object.freeze({
            wavelengths: Object.freeze(Array.from({ length }, (_, index) => lambdaMin + index * step)),
            xBar: CIE_DATA.xBar,
            yBar: CIE_DATA.yBar,
            zBar: CIE_DATA.zBar
        });
        return planckianObserverCache;
    }

    function planckianXy(temperature) {
        const numeric = Number(temperature);
        if (!Number.isFinite(numeric) || numeric <= 0) return { x: 0, y: 0 };
        const t = Math.max(PLANCKIAN_MIN_K, Math.min(PLANCKIAN_MAX_K, numeric));
        const key = t.toFixed(6);
        if (planckianXyCache.has(key)) return planckianXyCache.get(key);
        const observer = planckianObserverData();
        const xy = observer
            ? blackbodyXy(t, observer.wavelengths, observer.xBar, observer.yBar, observer.zBar)
            : polynomialPlanckianXy(t);
        const frozen = Object.freeze({ x: xy.x, y: xy.y });
        planckianXyCache.set(key, frozen);
        return frozen;
    }

    const SECOND_RADIATION_CONSTANT_NM_K = 1.438776877e7;
    // Covers 0.1 nm samples across a 1,000 nm spectrum while bounding work and allocation.
    const MAX_SPECTRAL_SAMPLE_COUNT = 10_000;

    function isSpectralArray(values) {
        const isTypedArray = ArrayBuffer.isView(values)
            && Number.isSafeInteger(values.BYTES_PER_ELEMENT)
            && values.BYTES_PER_ELEMENT > 0;
        return (Array.isArray(values) || isTypedArray)
            && Number.isSafeInteger(values.length)
            && values.length >= 0
            && values.length <= MAX_SPECTRAL_SAMPLE_COUNT;
    }

    function safeZeroArray(values) {
        if (!isSpectralArray(values)) return [];
        return new Array(values.length).fill(0);
    }

    function blackbodySpd(temperature, wavelengths) {
        const safeResult = safeZeroArray(wavelengths);
        if (safeResult.length === 0
            || typeof temperature !== 'number'
            || !Number.isFinite(temperature)
            || temperature <= 0) {
            return safeResult;
        }

        const logRadiance = new Array(wavelengths.length);
        let maximum = -Infinity;
        for (let index = 0; index < wavelengths.length; index++) {
            const wavelength = wavelengths[index];
            if (typeof wavelength !== 'number' || !Number.isFinite(wavelength) || wavelength <= 0) {
                return safeResult;
            }

            const exponent = SECOND_RADIATION_CONSTANT_NM_K / (wavelength * temperature);
            const logDenominator = exponent > 50
                ? exponent + Math.log1p(-Math.exp(-exponent))
                : Math.log(Math.expm1(exponent));
            const value = -5 * Math.log(wavelength) - logDenominator;
            logRadiance[index] = value;
            maximum = Math.max(maximum, value);
        }

        if (!Number.isFinite(maximum)) return safeResult;
        return logRadiance.map(value => {
            const normalized = Math.exp(value - maximum);
            return Number.isFinite(normalized) ? normalized : 0;
        });
    }

    function blackbodyXy(temperature, wavelengths, xBar, yBar, zBar) {
        const arrays = [wavelengths, xBar, yBar, zBar];
        if (arrays.some(values => !isSpectralArray(values))
            || wavelengths.length < 2
            || arrays.some(values => values.length !== wavelengths.length)) {
            return { x: 0, y: 0 };
        }

        for (let index = 0; index < wavelengths.length; index++) {
            if (typeof wavelengths[index] !== 'number'
                || !Number.isFinite(wavelengths[index])
                || wavelengths[index] <= 0
                || (index > 0 && wavelengths[index] <= wavelengths[index - 1])
                || !Number.isFinite(xBar[index])
                || !Number.isFinite(yBar[index])
                || !Number.isFinite(zBar[index])) {
                return { x: 0, y: 0 };
            }
        }

        const spd = blackbodySpd(temperature, wavelengths);
        let X = 0;
        let Y = 0;
        let Z = 0;
        for (let index = 1; index < wavelengths.length; index++) {
            const interval = wavelengths[index] - wavelengths[index - 1];
            X += interval * (spd[index - 1] * xBar[index - 1] + spd[index] * xBar[index]) / 2;
            Y += interval * (spd[index - 1] * yBar[index - 1] + spd[index] * yBar[index]) / 2;
            Z += interval * (spd[index - 1] * zBar[index - 1] + spd[index] * zBar[index]) / 2;
        }

        const total = X + Y + Z;
        if (!(total > 0) || !Number.isFinite(total)) return { x: 0, y: 0 };
        return { x: X / total, y: Y / total };
    }

    function interpolateSpectrum(wavelengths, values, wavelength) {
        if (wavelength < wavelengths[0] || wavelength > wavelengths[wavelengths.length - 1]) return 0;
        let low = 0;
        let high = wavelengths.length - 1;
        while (high - low > 1) {
            const middle = (low + high) >> 1;
            if (wavelengths[middle] <= wavelength) low = middle;
            else high = middle;
        }
        if (wavelength === wavelengths[low] || low === high) return values[low];
        const span = wavelengths[high] - wavelengths[low];
        if (!(span > 0)) return values[low];
        const amount = (wavelength - wavelengths[low]) / span;
        return values[low] + (values[high] - values[low]) * amount;
    }

    function resampleSpectrumTo5nm(wavelengths, values) {
        if (!isSpectralArray(wavelengths) || !isSpectralArray(values) ||
            wavelengths.length !== values.length || wavelengths.length < 2) return [];
        let standardOneNanometreGrid = wavelengths.length === 401;
        for (let index = 0; index < wavelengths.length; index++) {
            if (!Number.isFinite(wavelengths[index]) || !Number.isFinite(values[index])) return [];
            if (index > 0 && wavelengths[index] <= wavelengths[index - 1]) return [];
            if (standardOneNanometreGrid && Math.abs(wavelengths[index] - (380 + index)) > 1e-9) {
                standardOneNanometreGrid = false;
            }
        }

        if (standardOneNanometreGrid) {
            const resampled = new Array(81);
            resampled[0] = values[0];
            resampled[80] = values[400];
            for (let targetIndex = 1; targetIndex < 80; targetIndex++) {
                const center = targetIndex * 5;
                const leftBoundary = (values[center - 3] + values[center - 2]) * 0.5;
                const rightBoundary = (values[center + 2] + values[center + 3]) * 0.5;
                const area =
                    (leftBoundary + values[center - 2]) * 0.25 +
                    (values[center - 2] + values[center - 1]) * 0.5 +
                    (values[center - 1] + values[center]) * 0.5 +
                    (values[center] + values[center + 1]) * 0.5 +
                    (values[center + 1] + values[center + 2]) * 0.5 +
                    (values[center + 2] + rightBoundary) * 0.25;
                resampled[targetIndex] = area / 5;
            }
            return resampled;
        }

        const targets = Array.from({ length: 81 }, (_, index) => 380 + index * 5);
        return targets.map(function (target, targetIndex) {
            if (targetIndex === 0 || targetIndex === targets.length - 1) {
                return interpolateSpectrum(wavelengths, values, target);
            }
            const start = Math.max(target - 2.5, wavelengths[0]);
            const end = Math.min(target + 2.5, wavelengths[wavelengths.length - 1]);
            if (!(end > start)) return 0;
            const points = [start];
            for (let index = 0; index < wavelengths.length; index++) {
                const wavelength = wavelengths[index];
                if (wavelength > start && wavelength < end) points.push(wavelength);
            }
            points.push(end);
            let area = 0;
            for (let index = 0; index < points.length - 1; index++) {
                const left = points[index];
                const right = points[index + 1];
                area += (interpolateSpectrum(wavelengths, values, left) +
                    interpolateSpectrum(wavelengths, values, right)) * 0.5 * (right - left);
            }
            return area / (end - start);
        });
    }

    function planckianLocus() {
        if (planckianLocusCache) return planckianLocusCache;
        const points = [];
        for (let mired = PLANCKIAN_MIN_MIRED; mired <= PLANCKIAN_MAX_MIRED + 1e-9; mired += PLANCKIAN_MIRED_STEP) {
            const temperature = 1e6 / mired;
            const xy = planckianXy(temperature);
            const uv = xyToUv(xy.x, xy.y);
            points.push(Object.freeze({ mired, u: uv.u, v: uv.v }));
        }
        const last = points[points.length - 1];
        if (!last || last.mired < PLANCKIAN_MAX_MIRED - 1e-9) {
            const xy = planckianXy(PLANCKIAN_MIN_K);
            const uv = xyToUv(xy.x, xy.y);
            points.push(Object.freeze({ mired: PLANCKIAN_MAX_MIRED, u: uv.u, v: uv.v }));
        }
        planckianLocusCache = Object.freeze(points);
        return planckianLocusCache;
    }

    function nearestPlanckianPoint(targetUv) {
        const locus = planckianLocus();
        let best = null;
        for (let index = 0; index < locus.length - 1; index++) {
            const start = locus[index];
            const end = locus[index + 1];
            const tangentU = end.u - start.u;
            const tangentV = end.v - start.v;
            const lengthSquared = tangentU * tangentU + tangentV * tangentV;
            let amount = lengthSquared > 0
                ? ((targetUv.u - start.u) * tangentU + (targetUv.v - start.v) * tangentV) / lengthSquared
                : 0;
            amount = Math.max(0, Math.min(1, amount));
            const u = start.u + amount * tangentU;
            const v = start.v + amount * tangentV;
            const offsetU = targetUv.u - u;
            const offsetV = targetUv.v - v;
            const distanceSquared = offsetU * offsetU + offsetV * offsetV;
            if (!best || distanceSquared < best.distanceSquared) {
                best = {
                    mired: start.mired + amount * (end.mired - start.mired),
                    u,
                    v,
                    tangentU,
                    tangentV,
                    offsetU,
                    offsetV,
                    distanceSquared
                };
            }
        }
        return best;
    }

    function estimateCctAndDuvFromXy(x, y) {
        if (!(x > 0) || !(y > 0) || x + y >= 1) return { cct: 0, duv: 0 };
        const targetUv = xyToUv(x, y);
        const nearest = nearestPlanckianPoint(targetUv);
        if (!nearest || !(nearest.mired > 0)) return { cct: 0, duv: 0 };
        const cct = 1e6 / nearest.mired;
        const cross = nearest.tangentU * nearest.offsetV - nearest.tangentV * nearest.offsetU;
        const duv = Math.sign(cross || 1) * Math.sqrt(nearest.distanceSquared);
        return { cct, duv };
    }

    function targetXyFromCctDuv(cct, duv) {
        const temperature = Math.max(PLANCKIAN_MIN_K, Math.min(PLANCKIAN_MAX_K, Number(cct) || 4000));
        const offset = Number.isFinite(Number(duv)) ? Number(duv) : 0;
        const locusXy = planckianXy(temperature);
        const locusUv = xyToUv(locusXy.x, locusXy.y);
        const delta = Math.max(0.5, temperature * 0.001);
        const lowerXy = planckianXy(Math.max(PLANCKIAN_MIN_K, temperature - delta));
        const upperXy = planckianXy(Math.min(PLANCKIAN_MAX_K, temperature + delta));
        const lowerUv = xyToUv(lowerXy.x, lowerXy.y);
        const upperUv = xyToUv(upperXy.x, upperXy.y);
        const tangentU = upperUv.u - lowerUv.u;
        const tangentV = upperUv.v - lowerUv.v;
        const length = Math.hypot(tangentU, tangentV) || 1;
        return uvToXy(
            locusUv.u + offset * tangentV / length,
            locusUv.v - offset * tangentU / length
        );
    }

    function normalizeImportedChannels(channels, preserveRelativePower) {
        const peaks = channels.map(samples => samples.reduce((max, sample) => Math.max(max, sample[1]), 0));
        const denominator = preserveRelativePower ? Math.max(...peaks) : null;
        return channels.map((samples, index) => {
            const scale = preserveRelativePower ? denominator : peaks[index];
            return samples.map(sample => [sample[0], scale > 0 ? sample[1] / scale : 0]);
        });
    }

    function xyzToDisplaySrgb(X, Y, Z) {
        if (!(Y > 0) || !Number.isFinite(X) || !Number.isFinite(Y) || !Number.isFinite(Z)) {
            return { r: 0, g: 0, b: 0, css: 'rgb(0, 0, 0)' };
        }

        const x = X / Y;
        const y = 1;
        const z = Z / Y;
        const linear = [
            3.2404542 * x - 1.5371385 * y - 0.4985314 * z,
            -0.9692660 * x + 1.8760108 * y + 0.0415560 * z,
            0.0556434 * x - 0.2040259 * y + 1.0572252 * z
        ];
        const encode = value => {
            const clipped = Math.max(0, value);
            const encoded = clipped <= 0.0031308
                ? 12.92 * clipped
                : 1.055 * Math.pow(clipped, 1 / 2.4) - 0.055;
            return Math.round(Math.max(0, Math.min(1, encoded)) * 255);
        };
        const [r, g, b] = linear.map(encode);
        return { r, g, b, css: `rgb(${r}, ${g}, ${b})` };
    }

    return {
        xyToUv,
        planckianXy,
        blackbodySpd,
        blackbodyXy,
        resampleSpectrumTo5nm,
        estimateCctAndDuvFromXy,
        targetXyFromCctDuv,
        normalizeImportedChannels,
        xyzToDisplaySrgb
    };
});
