(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) root.ChromaticityDiagram = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    function finite(value, fallback) {
        return Number.isFinite(value) ? value : fallback;
    }

    function xyTo1960Uv(x, y) {
        const denominator = -2 * x + 12 * y + 3;
        if (Math.abs(denominator) < 1e-12) return { u: NaN, v: NaN };
        return {
            u: 4 * x / denominator,
            v: 6 * y / denominator
        };
    }

    function uv1960ToXy(u, v) {
        const denominator = 2 * u - 8 * v + 4;
        if (Math.abs(denominator) < 1e-12) return { x: NaN, y: NaN };
        return {
            x: 3 * u / denominator,
            y: 2 * v / denominator
        };
    }

    function xyTo1976UpVp(x, y) {
        const uv = xyTo1960Uv(x, y);
        return {
            up: uv.u,
            vp: uv.v * 1.5
        };
    }

    function upvp1976ToXy(up, vp) {
        const denominator = 6 * up - 16 * vp + 12;
        if (Math.abs(denominator) < 1e-12) return { x: NaN, y: NaN };
        return {
            x: 9 * up / denominator,
            y: 4 * vp / denominator
        };
    }

    function createPlotGeometry(width, height, options) {
        const config = options || {};
        const xMax = finite(config.xMax, 1);
        const yMax = finite(config.yMax, 1);
        if (!(xMax > 0) || !(yMax > 0)) {
            throw new RangeError('xMax and yMax must be positive');
        }
        const padding = Object.assign({ left: 0, right: 0, top: 0, bottom: 0 }, config.padding);
        const availableWidth = Math.max(1, width - padding.left - padding.right);
        const availableHeight = Math.max(1, height - padding.top - padding.bottom);
        const scale = Math.min(availableWidth / xMax, availableHeight / yMax);
        const plotWidth = xMax * scale;
        const plotHeight = yMax * scale;
        const left = padding.left + (availableWidth - plotWidth) / 2;
        const top = padding.top + (availableHeight - plotHeight) / 2;
        return Object.freeze({
            width,
            height,
            xMax,
            yMax,
            scale,
            plotWidth,
            plotHeight,
            left,
            top,
            right: left + plotWidth,
            bottom: top + plotHeight
        });
    }

    function projectPoint(x, y, geometry) {
        return {
            x: geometry.left + x * geometry.scale,
            y: geometry.bottom - y * geometry.scale
        };
    }

    return Object.freeze({
        xyTo1960Uv,
        uv1960ToXy,
        xyTo1976UpVp,
        upvp1976ToXy,
        createPlotGeometry,
        projectPoint
    });
});
