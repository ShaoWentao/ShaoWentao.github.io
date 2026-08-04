(function (root, factory) {
    'use strict';
    var api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    root.MaterialPreviewColor = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    var D65 = [95.047, 100, 108.883];

    function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    function labToXyz(lab) {
        var fy = (lab[0] + 16) / 116;
        var fx = fy + lab[1] / 500;
        var fz = fy - lab[2] / 200;
        var epsilon = 216 / 24389;
        var kappa = 24389 / 27;
        function inverse(value) {
            var cube = value * value * value;
            return cube > epsilon ? cube : (116 * value - 16) / kappa;
        }
        return [
            D65[0] * inverse(fx),
            D65[1] * inverse(fy),
            D65[2] * inverse(fz)
        ];
    }

    function encode(value) {
        return value <= 0.0031308 ? 12.92 * value : 1.055 * Math.pow(value, 1 / 2.4) - 0.055;
    }

    function toSrgb(lab) {
        if (!Array.isArray(lab) || lab.length < 3 || !lab.every(Number.isFinite)) return [218, 218, 218];
        var xyz = labToXyz(lab).map(function (value) { return value / 100; });
        var linear = [
            3.2404542 * xyz[0] - 1.5371385 * xyz[1] - 0.4985314 * xyz[2],
            -0.969266 * xyz[0] + 1.8760108 * xyz[1] + 0.041556 * xyz[2],
            0.0556434 * xyz[0] - 0.2040259 * xyz[1] + 1.0572252 * xyz[2]
        ];
        return linear.map(function (value) {
            return Math.round(255 * clamp(encode(value), 0, 1));
        });
    }

    function toCss(lab) {
        var rgb = toSrgb(lab);
        return 'rgb(' + rgb.join(', ') + ')';
    }

    function decode(value) {
        value /= 255;
        return value <= 0.04045 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
    }

    function xyzToLab(xyz) {
        var epsilon = 216 / 24389;
        var kappa = 24389 / 27;
        function forward(value) {
            return value > epsilon ? Math.cbrt(value) : (kappa * value + 16) / 116;
        }
        var fx = forward(xyz[0] / D65[0]);
        var fy = forward(xyz[1] / D65[1]);
        var fz = forward(xyz[2] / D65[2]);
        return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
    }

    function rgbToLab(rgb) {
        var linear = rgb.map(decode);
        return xyzToLab([
            100 * (0.4124564 * linear[0] + 0.3575761 * linear[1] + 0.1804375 * linear[2]),
            100 * (0.2126729 * linear[0] + 0.7151522 * linear[1] + 0.072175 * linear[2]),
            100 * (0.0193339 * linear[0] + 0.119192 * linear[1] + 0.9503041 * linear[2])
        ]);
    }

    function mapRgb(rgb, deltaLab) {
        var lab = rgbToLab(rgb);
        return toSrgb([
            clamp(lab[0] + (Number(deltaLab && deltaLab[0]) || 0), 0, 100),
            lab[1] + (Number(deltaLab && deltaLab[1]) || 0),
            lab[2] + (Number(deltaLab && deltaLab[2]) || 0)
        ]);
    }

    function backgroundWeight(rgb, backgroundRgb) {
        if (!Array.isArray(rgb) || !Array.isArray(backgroundRgb)) return 1;
        var distance = Math.sqrt([0, 1, 2].reduce(function (sum, index) {
            var difference = Number(rgb[index]) - Number(backgroundRgb[index]);
            return sum + difference * difference;
        }, 0));
        var start = 22;
        var end = 58;
        if (distance <= start) return 0;
        if (distance >= end) return 1;
        var normalized = (distance - start) / (end - start);
        return normalized * normalized * (3 - 2 * normalized);
    }

    function mapRgbWithBackground(rgb, deltaLab, backgroundRgb) {
        var weight = backgroundWeight(rgb, backgroundRgb);
        if (weight <= 0) return rgb.slice(0, 3).map(function (value) { return Math.round(value); });
        var mapped = mapRgb(rgb, deltaLab);
        if (weight >= 1) return mapped;
        return mapped.map(function (value, index) {
            return Math.round(Number(rgb[index]) + (value - Number(rgb[index])) * weight);
        });
    }

    function deltaBetween(fromLab, toLab) {
        if (!Array.isArray(fromLab) || !Array.isArray(toLab)) return [0, 0, 0];
        return [0, 1, 2].map(function (index) { return toLab[index] - fromLab[index]; });
    }

    return {
        toSrgb: toSrgb,
        toCss: toCss,
        mapRgb: mapRgb,
        mapRgbWithBackground: mapRgbWithBackground,
        backgroundWeight: backgroundWeight,
        deltaBetween: deltaBetween
    };
});
