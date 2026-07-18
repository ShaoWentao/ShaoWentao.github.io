(function (root, factory) {
    const api = factory(root.CIE_COLOUR_QUALITY_DATA, root.SpectralMath);
    if (typeof module === 'object' && module.exports) module.exports = api;
    root.ColourQuality = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (DATA, SpectralMath) {
    'use strict';

    const CAT02 = [[0.7328, 0.4296, -0.1624], [-0.7036, 1.6975, 0.0061], [0.0030, 0.0136, 0.9834]];
    const CAT02_TO_HPE = [[0.7409792, 0.2180250, 0.0410058], [0.2853532, 0.6242014, 0.0904454], [-0.0096280, -0.0056980, 1.0153260]];

    function dot(matrix, vector) {
        return matrix.map(row => row[0] * vector[0] + row[1] * vector[1] + row[2] * vector[2]);
    }

    function xyz(spd, cmf, reflectance) {
        const result = [0, 0, 0];
        for (let i = 0; i < spd.length; i++) {
            const power = spd[i] * (reflectance ? reflectance[i] : 1);
            result[0] += power * cmf[0][i];
            result[1] += power * cmf[1][i];
            result[2] += power * cmf[2][i];
        }
        return result;
    }

    function chromaticity(XYZ) {
        const sum = XYZ[0] + XYZ[1] + XYZ[2];
        return { x: XYZ[0] / sum, y: XYZ[1] / sum };
    }

    function uv(XYZ) {
        const denominator = XYZ[0] + 15 * XYZ[1] + 3 * XYZ[2];
        return { u: 4 * XYZ[0] / denominator, v: 6 * XYZ[1] / denominator };
    }

    function blackbody(cct) {
        const c2 = 1.4387752e7;
        return DATA.wavelengths.map(wavelength =>
            1 / (wavelength ** 5 * (Math.exp(c2 / (wavelength * cct)) - 1)));
    }

    function daylight(cct) {
        let x;
        if (cct <= 7000) {
            x = -4.6070e9 / cct ** 3 + 2.9678e6 / cct ** 2 + 0.09911e3 / cct + 0.244063;
        } else {
            x = -2.0064e9 / cct ** 3 + 1.9018e6 / cct ** 2 + 0.24748e3 / cct + 0.237040;
        }
        const y = -3 * x * x + 2.87 * x - 0.275;
        const denominator = 0.0241 + 0.2562 * x - 0.7341 * y;
        const m1 = (-1.3515 - 1.7703 * x + 5.9114 * y) / denominator;
        const m2 = (0.0300 - 31.4424 * x + 30.0717 * y) / denominator;
        const { s0, s1, s2 } = DATA.daylightBasis;
        return s0.map((value, index) => value + m1 * s1[index] + m2 * s2[index]);
    }

    function normalizeY(spd, cmf) {
        const Y = xyz(spd, cmf)[1];
        return spd.map(value => value / Y);
    }

    function referenceSpd(cct, cmf, blend) {
        if (!blend) return cct < 5000 ? blackbody(cct) : daylight(cct);
        if (cct < 4000) return blackbody(cct);
        if (cct > 5000) return daylight(cct);
        const planck = normalizeY(blackbody(cct), cmf);
        const day = normalizeY(daylight(cct), cmf);
        const amount = (cct - 4000) / 1000;
        return planck.map((value, index) => value * (1 - amount) + day[index] * amount);
    }

    function cctFromSpd(spd) {
        const xy = chromaticity(xyz(spd, DATA.cmf2));
        return SpectralMath.estimateCctAndDuvFromXy(xy.x, xy.y).cct;
    }

    function criSampleData(illuminant, reference, reflectance, adapt) {
        const whiteTest = xyz(illuminant, DATA.cmf2);
        const whiteReference = xyz(reference, DATA.cmf2);
        const uvTest = uv(whiteTest);
        const uvReference = uv(whiteReference);
        const sampleXYZ = xyz(illuminant, DATA.cmf2, reflectance);
        const sampleUv = uv(sampleXYZ);
        let u = sampleUv.u;
        let v = sampleUv.v;
        if (adapt) {
            const c = (x, y) => (4 - x - 10 * y) / y;
            const d = (x, y) => (1.708 * y + 0.404 - 1.481 * x) / y;
            const crct = c(uvReference.u, uvReference.v) / c(uvTest.u, uvTest.v);
            const drdt = d(uvReference.u, uvReference.v) / d(uvTest.u, uvTest.v);
            const sampleC = c(u, v);
            const sampleD = d(u, v);
            const denominator = 16.518 + 1.481 * crct * sampleC - drdt * sampleD;
            u = (10.872 + 0.404 * crct * sampleC - 4 * drdt * sampleD) / denominator;
            v = 5.52 / denominator;
        }
        const Y = sampleXYZ[1] / whiteTest[1] * 100;
        const W = 25 * Math.cbrt(Y) - 17;
        return [13 * W * (u - uvReference.u), 13 * W * (v - uvReference.v), W];
    }

    function calculateCri(spd, cct) {
        const reference = referenceSpd(cct, DATA.cmf2, false);
        const indexes = DATA.tcs14.map(sample => {
            const test = criSampleData(spd, reference, sample, true);
            const ref = criSampleData(reference, reference, sample, false);
            return 100 - 4.6 * Math.hypot(test[0] - ref[0], test[1] - ref[1], test[2] - ref[2]);
        });
        return {
            ra: indexes.slice(0, 8).reduce((sum, value) => sum + value, 0) / 8,
            r9: indexes[8],
            ri: indexes
        };
    }

    function cam02ucs(XYZ, whiteXYZ) {
        const scale = 100 / whiteXYZ[1];
        const stimulus = XYZ.map(value => value * scale);
        const white = whiteXYZ.map(value => value * scale);
        const n = 0.2;
        const z = 1.48 + Math.sqrt(n);
        const nbb = 0.725 * (1 / n) ** 0.2;
        const la = 100;
        const k = 1 / (5 * la + 1);
        const fl = 0.2 * k ** 4 * 5 * la + 0.1 * (1 - k ** 4) ** 2 * Math.cbrt(5 * la);
        const rgb = dot(CAT02, stimulus);
        const rgbw = dot(CAT02, white);
        const adapted = rgb.map((value, i) => value * 100 / rgbw[i]);
        const adaptedWhite = rgbw.map((value, i) => value * 100 / rgbw[i]);
        const hpe = dot(CAT02_TO_HPE, adapted);
        const hpeWhite = dot(CAT02_TO_HPE, adaptedWhite);
        const compress = value => {
            const p = (fl * Math.abs(value) / 100) ** 0.42;
            return Math.sign(value) * 400 * p / (27.13 + p) + 0.1;
        };
        const response = hpe.map(compress);
        const responseWhite = hpeWhite.map(compress);
        const a = response[0] - 12 * response[1] / 11 + response[2] / 11;
        const b = (response[0] + response[1] - 2 * response[2]) / 9;
        let hue = Math.atan2(b, a);
        if (hue < 0) hue += 2 * Math.PI;
        const et = (Math.cos(hue + 2) + 3.8) / 4;
        const achromatic = values => (2 * values[0] + values[1] + 0.05 * values[2] - 0.305) * nbb;
        const J = 100 * (achromatic(response) / achromatic(responseWhite)) ** (0.69 * z);
        const t = (50000 / 13) * nbb * et * Math.hypot(a, b) /
            (response[0] + response[1] + 21 * response[2] / 20);
        const C = t ** 0.9 * Math.sqrt(J / 100) * (1.64 - 0.29 ** n) ** 0.73;
        const M = C * fl ** 0.25;
        const Jp = 1.7 * J / (1 + 0.007 * J);
        const Mp = Math.log(1 + 0.0228 * M) / 0.0228;
        return [Jp, Mp * Math.cos(hue), Mp * Math.sin(hue)];
    }

    function polygonArea(points) {
        let area = 0;
        for (let i = 0; i < points.length; i++) {
            const next = points[(i + 1) % points.length];
            area += points[i][0] * next[1] - next[0] * points[i][1];
        }
        return Math.abs(area) / 2;
    }

    function fidelityFromDelta(delta) {
        return 10 * Math.log1p(Math.exp((100 - 6.73 * delta) / 10));
    }

    function calculateTm30(spd, cct) {
        const reference = referenceSpd(cct, DATA.cmf10, true);
        const testWhite = xyz(spd, DATA.cmf10);
        const refWhite = xyz(reference, DATA.cmf10);
        const testPoints = [];
        const refPoints = [];
        const deltas = [];
        for (const sample of DATA.ces99) {
            const test = cam02ucs(xyz(spd, DATA.cmf10, sample), testWhite);
            const ref = cam02ucs(xyz(reference, DATA.cmf10, sample), refWhite);
            testPoints.push(test);
            refPoints.push(ref);
            deltas.push(Math.hypot(test[0] - ref[0], test[1] - ref[1], test[2] - ref[2]));
        }
        const bins = Array.from({ length: 16 }, () => ({ test: [], ref: [] }));
        for (let i = 0; i < refPoints.length; i++) {
            let angle = Math.atan2(refPoints[i][2], refPoints[i][1]) * 180 / Math.PI;
            if (!Number.isFinite(angle)) return { rf: 0, rg: 0 };
            if (angle < 0) angle += 360;
            const bin = Math.min(15, Math.floor(angle / 22.5));
            bins[bin].test.push([testPoints[i][1], testPoints[i][2]]);
            bins[bin].ref.push([refPoints[i][1], refPoints[i][2]]);
        }
        const average = points => [
            points.reduce((sum, point) => sum + point[0], 0) / points.length,
            points.reduce((sum, point) => sum + point[1], 0) / points.length
        ];
        if (bins.some(bin => bin.test.length === 0 || bin.ref.length === 0)) return { rf: 0, rg: 0 };
        const testPolygon = bins.map(bin => average(bin.test));
        const refPolygon = bins.map(bin => average(bin.ref));
        const meanDelta = deltas.reduce((sum, value) => sum + value, 0) / deltas.length;
        return {
            rf: fidelityFromDelta(meanDelta),
            rg: 100 * polygonArea(testPolygon) / polygonArea(refPolygon)
        };
    }

    function calculateColourQuality(spd) {
        if (!DATA || !SpectralMath || !spd || spd.length !== 81) return { ra: 0, r9: 0, rf: 0, rg: 0 };
        if (!spd.some(value => Number.isFinite(value) && value > 1e-12)) {
            return { ra: 0, r9: 0, rf: 0, rg: 0, cct: 0 };
        }
        const cct = cctFromSpd(spd);
        if (!Number.isFinite(cct) || cct <= 0) return { ra: 0, r9: 0, rf: 0, rg: 0, cct: 0 };
        const cri = calculateCri(spd, cct);
        const tm30 = calculateTm30(spd, cct);
        return { ...cri, ...tm30, cct };
    }

    return { calculateColourQuality };
});
