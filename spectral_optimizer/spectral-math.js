(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    root.SpectralMath = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
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

    function planckianXy(temperature) {
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

    function distanceSquaredToLocus(mired, targetUv) {
        const temperature = 1e6 / mired;
        const xy = planckianXy(temperature);
        const uv = xyToUv(xy.x, xy.y);
        return (uv.u - targetUv.u) ** 2 + (uv.v - targetUv.v) ** 2;
    }

    function estimateCctAndDuvFromXy(x, y) {
        if (!(x > 0) || !(y > 0) || x + y >= 1) return { cct: 0, duv: 0 };
        const targetUv = xyToUv(x, y);
        let bestMired = 40;
        let bestDistance = Infinity;
        for (let mired = 40; mired <= 600; mired += 1) {
            const distance = distanceSquaredToLocus(mired, targetUv);
            if (distance < bestDistance) {
                bestDistance = distance;
                bestMired = mired;
            }
        }
        let low = Math.max(40, bestMired - 2);
        let high = Math.min(600, bestMired + 2);
        for (let iteration = 0; iteration < 32; iteration++) {
            const oneThird = (high - low) / 3;
            const left = low + oneThird;
            const right = high - oneThird;
            if (distanceSquaredToLocus(left, targetUv) < distanceSquaredToLocus(right, targetUv)) high = right;
            else low = left;
        }
        const mired = (low + high) / 2;
        const cct = 1e6 / mired;
        const locusXy = planckianXy(cct);
        const locusUv = xyToUv(locusXy.x, locusXy.y);
        const lowerUv = xyToUv(...Object.values(planckianXy(Math.max(1667, cct - 5))));
        const upperUv = xyToUv(...Object.values(planckianXy(Math.min(25000, cct + 5))));
        const tangentU = upperUv.u - lowerUv.u;
        const tangentV = upperUv.v - lowerUv.v;
        const offsetU = targetUv.u - locusUv.u;
        const offsetV = targetUv.v - locusUv.v;
        const cross = tangentU * offsetV - tangentV * offsetU;
        const duv = -Math.sign(cross || 1) * Math.hypot(offsetU, offsetV);
        return { cct, duv };
    }

    function targetXyFromCctDuv(cct, duv) {
        const locusXy = planckianXy(cct);
        const locusUv = xyToUv(locusXy.x, locusXy.y);
        const lowerXy = planckianXy(Math.max(1667, cct - 5));
        const upperXy = planckianXy(Math.min(25000, cct + 5));
        const lowerUv = xyToUv(lowerXy.x, lowerXy.y);
        const upperUv = xyToUv(upperXy.x, upperXy.y);
        const tangentU = upperUv.u - lowerUv.u;
        const tangentV = upperUv.v - lowerUv.v;
        const length = Math.hypot(tangentU, tangentV) || 1;
        return uvToXy(
            locusUv.u + duv * tangentV / length,
            locusUv.v - duv * tangentU / length
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
        estimateCctAndDuvFromXy,
        targetXyFromCctDuv,
        normalizeImportedChannels,
        xyzToDisplaySrgb
    };
});
