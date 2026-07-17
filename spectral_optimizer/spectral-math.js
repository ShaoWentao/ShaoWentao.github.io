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

    return { xyToUv, planckianXy, estimateCctAndDuvFromXy, targetXyFromCctDuv, normalizeImportedChannels };
});
