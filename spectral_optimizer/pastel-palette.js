(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    root.PASTEL_PALETTE = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    const groups = [
        ['绯', 2], ['橙', 28], ['金', 48], ['芽', 82],
        ['翠', 138], ['湖', 178], ['蓝', 218], ['紫', 278]
    ];
    const suffixes = ['纱', '露', '霞', '光'];
    const levels = [
        { saturation: 52, lightness: 90 },
        { saturation: 62, lightness: 82 },
        { saturation: 72, lightness: 74 },
        { saturation: 82, lightness: 66 }
    ];

    function hslToRgb(hue, saturation, lightness) {
        const s = saturation / 100;
        const l = lightness / 100;
        const c = (1 - Math.abs(2 * l - 1)) * s;
        const x = c * (1 - Math.abs((hue / 60) % 2 - 1));
        const m = l - c / 2;
        let rgb;
        if (hue < 60) rgb = [c, x, 0];
        else if (hue < 120) rgb = [x, c, 0];
        else if (hue < 180) rgb = [0, c, x];
        else if (hue < 240) rgb = [0, x, c];
        else if (hue < 300) rgb = [x, 0, c];
        else rgb = [c, 0, x];
        return rgb.map(value => Math.round((value + m) * 255));
    }

    function rgbToXy(rgb) {
        const linear = rgb.map(value => {
            const encoded = value / 255;
            return encoded <= 0.04045 ? encoded / 12.92 : ((encoded + 0.055) / 1.055) ** 2.4;
        });
        const [r, g, b] = linear;
        const X = 0.4124564 * r + 0.3575761 * g + 0.1804375 * b;
        const Y = 0.2126729 * r + 0.7151522 * g + 0.0721750 * b;
        const Z = 0.0193339 * r + 0.1191920 * g + 0.9503041 * b;
        const sum = X + Y + Z;
        return { x: X / sum, y: Y / sum };
    }

    const samples = [];
    groups.forEach(([prefix, hue]) => levels.forEach((level, levelIndex) => {
        const rgb = hslToRgb(hue, level.saturation, level.lightness);
        samples.push(Object.freeze({
            id: `P${String(samples.length + 1).padStart(2, '0')}`,
            name: `${prefix}${suffixes[levelIndex]}`,
            rgb: Object.freeze(rgb),
            xy: Object.freeze(rgbToXy(rgb))
        }));
    }));

    return Object.freeze({ samples: Object.freeze(samples), hslToRgb, rgbToXy });
});
