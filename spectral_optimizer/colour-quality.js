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
            if (!Number.isFinite(angle)) return { rf: 0, rg: 0, vector: null };
            if (angle < 0) angle += 360;
            const bin = Math.min(15, Math.floor(angle / 22.5));
            bins[bin].test.push([testPoints[i][1], testPoints[i][2]]);
            bins[bin].ref.push([refPoints[i][1], refPoints[i][2]]);
        }
        const average = points => [
            points.reduce((sum, point) => sum + point[0], 0) / points.length,
            points.reduce((sum, point) => sum + point[1], 0) / points.length
        ];
        if (bins.some(bin => bin.test.length === 0 || bin.ref.length === 0)) return { rf: 0, rg: 0, vector: null };
        const testPolygon = bins.map(bin => average(bin.test));
        const refPolygon = bins.map(bin => average(bin.ref));
        const meanDelta = deltas.reduce((sum, value) => sum + value, 0) / deltas.length;
        const vector = testPolygon.map((testPoint, index) => {
            const refPoint = refPolygon[index];
            const refRadius = Math.hypot(refPoint[0], refPoint[1]) || 1;
            const testRadius = Math.hypot(testPoint[0], testPoint[1]);
            const refAngle = Math.atan2(refPoint[1], refPoint[0]);
            const testAngle = Math.atan2(testPoint[1], testPoint[0]);
            const binAngle = (index + 0.5) * Math.PI / 8;
            const angle = binAngle + testAngle - refAngle;
            return {
                x: 100 * testRadius / refRadius * Math.cos(angle),
                y: 100 * testRadius / refRadius * Math.sin(angle)
            };
        });
        return {
            rf: fidelityFromDelta(meanDelta),
            rg: 100 * polygonArea(testPolygon) / polygonArea(refPolygon),
            vector
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

    const D65_XYZ = [0.95047, 1.00000, 1.08883];
    const BRADFORD_MA = [
        [ 0.8951,  0.2664, -0.1614],
        [-0.7502,  1.7135,  0.0367],
        [ 0.0389, -0.0685,  1.0296]
    ];
    const BRADFORD_MA_INV = [
        [ 0.9869929, -0.1470543, 0.1599627],
        [ 0.4323121,  0.5183603, 0.0492912],
        [-0.0085287,  0.0400428, 0.9684867]
    ];

    function applyMatrix(matrix, vector) {
        return matrix.map(row => row[0] * vector[0] + row[1] * vector[1] + row[2] * vector[2]);
    }

    function createBradfordMatrix(sourceWhite, destWhite) {
        const srcCone = applyMatrix(BRADFORD_MA, sourceWhite);
        const destCone = applyMatrix(BRADFORD_MA, destWhite);
        const diag = [
            [destCone[0] / srcCone[0], 0, 0],
            [0, destCone[1] / srcCone[1], 0],
            [0, 0, destCone[2] / srcCone[2]]
        ];
        const result = [[0,0,0],[0,0,0],[0,0,0]];
        for (let r = 0; r < 3; r++) {
            for (let c = 0; c < 3; c++) {
                for (let i = 0; i < 3; i++) {
                    result[r][c] += BRADFORD_MA_INV[r][i] * diag[i][i] * BRADFORD_MA[i][c];
                }
            }
        }
        return result;
    }

    function xyzToSrgb(XYZ) {
        const rLinear =  3.2404542 * XYZ[0] - 1.5371385 * XYZ[1] - 0.4985314 * XYZ[2];
        const gLinear = -0.9692660 * XYZ[0] + 1.8760108 * XYZ[1] + 0.0415560 * XYZ[2];
        const bLinear =  0.0556434 * XYZ[0] - 0.2040259 * XYZ[1] + 1.0572252 * XYZ[2];

        let r = rLinear, g = gLinear, b = bLinear;
        const maxC = Math.max(r, g, b);
        if (maxC > 1) {
            r /= maxC;
            g /= maxC;
            b /= maxC;
        }
        r = Math.max(0, r);
        g = Math.max(0, g);
        b = Math.max(0, b);

        const gamma = c => c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;

        return [
            Math.round(gamma(r) * 255),
            Math.round(gamma(g) * 255),
            Math.round(gamma(b) * 255)
        ];
    }

    function getAdaptedColor(sampleXYZ, sourceWhite) {
        const d65Scale = [D65_XYZ[0]*100, D65_XYZ[1]*100, D65_XYZ[2]*100];
        const transform = createBradfordMatrix(sourceWhite, d65Scale);
        const adapted = applyMatrix(transform, sampleXYZ);
        return xyzToSrgb([adapted[0]/100, adapted[1]/100, adapted[2]/100]);
    }

    function calculateSampleColors(spd) {
        if (!DATA) return { tcs14: [], cesSubset: [] };
        const suppliedSpd = spd && spd.length === 81 ? spd : null;
        const suppliedCct = suppliedSpd ? cctFromSpd(suppliedSpd) : NaN;
        const hasTestSpectrum = Number.isFinite(suppliedCct) && suppliedCct > 0;
        const cct = hasTestSpectrum ? suppliedCct : 6504;
        const testSpectrum = hasTestSpectrum ? suppliedSpd : DATA.d65;

        const reference = referenceSpd(cct, DATA.cmf2, false);

        const testWhite = xyz(testSpectrum, DATA.cmf2);
        const refWhite = xyz(reference, DATA.cmf2);

        const scaleTest = 100 / testWhite[1];
        const scaledTestWhite = [testWhite[0]*scaleTest, testWhite[1]*scaleTest, testWhite[2]*scaleTest];

        const scaleRef = 100 / refWhite[1];
        const scaledRefWhite = [refWhite[0]*scaleRef, refWhite[1]*scaleRef, refWhite[2]*scaleRef];

        const getColors = (samples, ids) => {
            return samples.map((sample, index) => {
                const sampleTestXYZ = xyz(testSpectrum, DATA.cmf2, sample);
                const sampleRefXYZ = xyz(reference, DATA.cmf2, sample);

                const scaledSampleTestXYZ = [sampleTestXYZ[0]*scaleTest, sampleTestXYZ[1]*scaleTest, sampleTestXYZ[2]*scaleTest];
                const scaledSampleRefXYZ = [sampleRefXYZ[0]*scaleRef, sampleRefXYZ[1]*scaleRef, sampleRefXYZ[2]*scaleRef];

                return {
                    id: ids[index],
                    testRGB: hasTestSpectrum ? getAdaptedColor(scaledSampleTestXYZ, scaledTestWhite) : null,
                    refRGB: getAdaptedColor(scaledSampleRefXYZ, scaledRefWhite),
                    testAvailable: hasTestSpectrum
                };
            });
        };

        const cesIndices = [3, 9, 15, 21, 27, 34, 40, 46, 52, 58, 64, 71, 77, 83, 89, 95]; // 16 samples for 16 hue bins
        const cesSubset = cesIndices.map(i => DATA.ces99[i]);

        return {
            tcs14: getColors(DATA.tcs14, DATA.tcs14.map((sample, index) => `TCS${String(index + 1).padStart(2, '0')}`)),
            cesSubset: getColors(cesSubset, cesIndices.map(index => `CES${String(index + 1).padStart(2, '0')}`))
        };
    }

    return { calculateColourQuality, calculateSampleColors };
});
