/*
 * Material colour delta calculation for the spectral optimizer.
 *
 * The module compares a material rendered by a candidate SPD against the same
 * material rendered by a reference illuminant. Candidate and reference spectra
 * are normalised to the same photopic Y before material XYZ / Lab / LCh and
 * colour-difference metrics are calculated.
 */
(function (root, factory) {
    const api = factory(
        root.CIE_COLOUR_QUALITY_DATA,
        root.SpectralMath,
        root.MATERIAL_REFLECTANCE_DATA
    );
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) root.MaterialColor = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (DATA, SpectralMath, MATERIAL_DATA) {
    'use strict';

    const D65 = [95.047, 100.000, 108.883];
    const BRADFORD = [[0.8951, 0.2664, -0.1614], [-0.7502, 1.7135, 0.0367], [0.0389, -0.0685, 1.0296]];
    const BRADFORD_INV = [[0.9869929, -0.1470543, 0.1599627], [0.4323053, 0.5183603, 0.0492912], [-0.0085287, 0.0400428, 0.9684867]];

    function assertReady() {
        if (!DATA || !Array.isArray(DATA.wavelengths) || !Array.isArray(DATA.cmf2)) {
            throw new Error('CIE_COLOUR_QUALITY_DATA is required before material-color.js');
        }
        if (!SpectralMath || typeof SpectralMath.blackbodySpd !== 'function') {
            throw new Error('SpectralMath.blackbodySpd is required before material-color.js');
        }
        if (!MATERIAL_DATA || typeof MATERIAL_DATA.getMaterial !== 'function') {
            throw new Error('MATERIAL_REFLECTANCE_DATA is required before material-color.js');
        }
    }

    function clamp(value, min, max) {
        return Math.max(min, Math.min(max, Number.isFinite(value) ? value : min));
    }

    function dot(matrix, vector) {
        return matrix.map(row => row[0] * vector[0] + row[1] * vector[1] + row[2] * vector[2]);
    }

    function multiply3x3(left, right) {
        const result = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
        for (let row = 0; row < 3; row++) {
            for (let col = 0; col < 3; col++) {
                for (let index = 0; index < 3; index++) result[row][col] += left[row][index] * right[index][col];
            }
        }
        return result;
    }

    function createBradfordMatrix(sourceWhite, destinationWhite) {
        const sourceCone = dot(BRADFORD, sourceWhite);
        const destinationCone = dot(BRADFORD, destinationWhite);
        const scale = [
            [destinationCone[0] / sourceCone[0], 0, 0],
            [0, destinationCone[1] / sourceCone[1], 0],
            [0, 0, destinationCone[2] / sourceCone[2]]
        ];
        return multiply3x3(BRADFORD_INV, multiply3x3(scale, BRADFORD));
    }

    function applyMatrix(matrix, vector) {
        return dot(matrix, vector);
    }

    function resampleSpd(inputSpd, options) {
        assertReady();
        if (!inputSpd) throw new TypeError('inputSpd is required');
        const targetWavelengths = DATA.wavelengths;
        const sourceWavelengths = options && Array.isArray(options.sourceWavelengths)
            ? options.sourceWavelengths
            : null;

        if (Array.isArray(inputSpd) && inputSpd.length > 0 && Array.isArray(inputSpd[0])) {
            return interpolatePairs(inputSpd, targetWavelengths);
        }
        const values = Array.from(inputSpd);
        if (values.length === targetWavelengths.length) return values.map(value => Number(value) || 0);
        if (sourceWavelengths && sourceWavelengths.length === values.length) {
            return interpolatePairs(sourceWavelengths.map((wavelength, index) => [wavelength, values[index]]), targetWavelengths);
        }
        if (values.length === 401) {
            return targetWavelengths.map(wavelength => values[Math.round(wavelength - 380)] || 0);
        }
        throw new RangeError('Unsupported SPD length. Use 81 samples, 401 samples, [wavelength,value] pairs, or pass sourceWavelengths.');
    }

    function interpolatePairs(pairs, targetWavelengths) {
        const sorted = pairs
            .map(pair => [Number(pair[0]), Number(pair[1])])
            .filter(pair => Number.isFinite(pair[0]) && Number.isFinite(pair[1]))
            .sort((a, b) => a[0] - b[0]);
        if (sorted.length === 0) return targetWavelengths.map(() => 0);
        return targetWavelengths.map(function (wavelength) {
            if (wavelength <= sorted[0][0]) return sorted[0][1];
            if (wavelength >= sorted[sorted.length - 1][0]) return sorted[sorted.length - 1][1];
            for (let index = 1; index < sorted.length; index++) {
                const right = sorted[index];
                if (wavelength <= right[0]) {
                    const left = sorted[index - 1];
                    const ratio = (wavelength - left[0]) / (right[0] - left[0]);
                    return left[1] + (right[1] - left[1]) * ratio;
                }
            }
            return sorted[sorted.length - 1][1];
        });
    }

    function xyzFromSpd(spd, reflectance) {
        assertReady();
        const [xBar, yBar, zBar] = DATA.cmf2;
        let X = 0, Y = 0, Z = 0;
        for (let index = 0; index < DATA.wavelengths.length; index++) {
            const power = Math.max(0, Number(spd[index]) || 0) * (reflectance ? clamp(Number(reflectance[index]), 0, 1) : 1);
            X += power * xBar[index];
            Y += power * yBar[index];
            Z += power * zBar[index];
        }
        return [X, Y, Z];
    }

    function normalizeToY(spd, targetY) {
        const white = xyzFromSpd(spd, null);
        const scale = white[1] > 0 ? targetY / white[1] : 0;
        return spd.map(value => value * scale);
    }

    function daylightSpd(cct) {
        if (!DATA.daylightBasis || !Array.isArray(DATA.daylightBasis.s0)) {
            throw new Error('CIE daylight basis data is required for daylight references');
        }
        const temperature = clamp(Number(cct) || 6504, 4000, 25000);
        const x = temperature <= 7000
            ? -4.6070e9 / temperature ** 3 + 2.9678e6 / temperature ** 2 + 0.09911e3 / temperature + 0.244063
            : -2.0064e9 / temperature ** 3 + 1.9018e6 / temperature ** 2 + 0.24748e3 / temperature + 0.237040;
        const y = -3 * x * x + 2.87 * x - 0.275;
        const denominator = 0.0241 + 0.2562 * x - 0.7341 * y;
        const m1 = (-1.3515 - 1.7703 * x + 5.9114 * y) / denominator;
        const m2 = (0.0300 - 31.4424 * x + 30.0717 * y) / denominator;
        const { s0, s1, s2 } = DATA.daylightBasis;
        return s0.map((value, index) => Math.max(0, value + m1 * s1[index] + m2 * s2[index]));
    }

    function referenceSpd(cct, options) {
        assertReady();
        const mode = options && options.referenceMode ? options.referenceMode : 'auto';
        if (mode === 'd65' && Array.isArray(DATA.d65) && DATA.d65.length === DATA.wavelengths.length) return DATA.d65.slice();
        if (Array.isArray(options && options.referenceSpd)) return resampleSpd(options.referenceSpd, options.referenceSpdOptions || {});
        if (mode === 'daylight' || (mode === 'auto' && Number(cct) >= 5000)) return daylightSpd(cct);
        return SpectralMath.blackbodySpd(cct || 3000, DATA.wavelengths);
    }

    function adaptToD65(XYZ, sourceWhite) {
        const matrix = createBradfordMatrix(sourceWhite, D65);
        return applyMatrix(matrix, XYZ);
    }

    function labFromXyz(XYZ) {
        const epsilon = 216 / 24389;
        const kappa = 24389 / 27;
        const normalized = [XYZ[0] / D65[0], XYZ[1] / D65[1], XYZ[2] / D65[2]];
        const f = normalized.map(value => value > epsilon ? Math.cbrt(value) : (kappa * value + 16) / 116);
        return [116 * f[1] - 16, 500 * (f[0] - f[1]), 200 * (f[1] - f[2])];
    }

    function lchFromLab(lab) {
        const C = Math.hypot(lab[1], lab[2]);
        let h = Math.atan2(lab[2], lab[1]) * 180 / Math.PI;
        if (h < 0) h += 360;
        return [lab[0], C, h];
    }

    function deltaHue(candidateHue, referenceHue) {
        let delta = candidateHue - referenceHue;
        while (delta > 180) delta -= 360;
        while (delta < -180) delta += 360;
        return delta;
    }

    function deltaE76(firstLab, secondLab) {
        return Math.hypot(firstLab[0] - secondLab[0], firstLab[1] - secondLab[1], firstLab[2] - secondLab[2]);
    }

    function deltaE2000(lab1, lab2) {
        const [L1, a1, b1] = lab1;
        const [L2, a2, b2] = lab2;
        const avgLp = (L1 + L2) / 2;
        const C1 = Math.hypot(a1, b1);
        const C2 = Math.hypot(a2, b2);
        const avgC = (C1 + C2) / 2;
        const G = 0.5 * (1 - Math.sqrt((avgC ** 7) / (avgC ** 7 + 25 ** 7)));
        const a1p = (1 + G) * a1;
        const a2p = (1 + G) * a2;
        const C1p = Math.hypot(a1p, b1);
        const C2p = Math.hypot(a2p, b2);
        const avgCp = (C1p + C2p) / 2;
        const h1p = hueAngle(b1, a1p);
        const h2p = hueAngle(b2, a2p);
        const dLp = L2 - L1;
        const dCp = C2p - C1p;
        const dhp = hueDifference(h2p, h1p, C1p, C2p);
        const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin(degToRad(dhp / 2));
        const avgHp = averageHue(h1p, h2p, C1p, C2p);
        const T = 1 - 0.17 * Math.cos(degToRad(avgHp - 30)) + 0.24 * Math.cos(degToRad(2 * avgHp)) + 0.32 * Math.cos(degToRad(3 * avgHp + 6)) - 0.20 * Math.cos(degToRad(4 * avgHp - 63));
        const deltaTheta = 30 * Math.exp(-(((avgHp - 275) / 25) ** 2));
        const Rc = 2 * Math.sqrt((avgCp ** 7) / (avgCp ** 7 + 25 ** 7));
        const Sl = 1 + (0.015 * ((avgLp - 50) ** 2)) / Math.sqrt(20 + ((avgLp - 50) ** 2));
        const Sc = 1 + 0.045 * avgCp;
        const Sh = 1 + 0.015 * avgCp * T;
        const Rt = -Math.sin(degToRad(2 * deltaTheta)) * Rc;
        return Math.sqrt((dLp / Sl) ** 2 + (dCp / Sc) ** 2 + (dHp / Sh) ** 2 + Rt * (dCp / Sc) * (dHp / Sh));
    }

    function hueAngle(b, a) {
        if (Math.abs(a) < 1e-12 && Math.abs(b) < 1e-12) return 0;
        const angle = Math.atan2(b, a) * 180 / Math.PI;
        return angle >= 0 ? angle : angle + 360;
    }

    function hueDifference(h2, h1, c1, c2) {
        if (c1 * c2 === 0) return 0;
        const difference = h2 - h1;
        if (Math.abs(difference) <= 180) return difference;
        return difference > 180 ? difference - 360 : difference + 360;
    }

    function averageHue(h1, h2, c1, c2) {
        if (c1 * c2 === 0) return h1 + h2;
        if (Math.abs(h1 - h2) <= 180) return (h1 + h2) / 2;
        return (h1 + h2 < 360) ? (h1 + h2 + 360) / 2 : (h1 + h2 - 360) / 2;
    }

    function degToRad(degrees) {
        return degrees * Math.PI / 180;
    }

    function materialAppearance(spd, material) {
        const white = xyzFromSpd(spd, null).map(value => value * 100);
        const materialXyz = xyzFromSpd(spd, material.reflectance).map(value => value * 100);
        const adapted = adaptToD65(materialXyz, white);
        const lab = labFromXyz(adapted);
        const lch = lchFromLab(lab);
        return { xyz: materialXyz, adaptedXyz: adapted, lab, lch };
    }

    function calculateMaterialDelta(candidateSpd, options) {
        assertReady();
        const settings = options || {};
        const material = typeof settings.material === 'string'
            ? MATERIAL_DATA.getMaterial(settings.material)
            : settings.material || MATERIAL_DATA.getMaterial(settings.materialId || 'wood_warm_oak');
        if (!material || !Array.isArray(material.reflectance)) throw new Error('A valid material reflectance model is required');

        const cct = Number.isFinite(settings.cct) ? settings.cct : 3000;
        const candidate = normalizeToY(resampleSpd(candidateSpd, settings.spdOptions || {}), 1);
        const reference = normalizeToY(referenceSpd(cct, settings), 1);
        const candidateAppearance = materialAppearance(candidate, material);
        const referenceAppearance = materialAppearance(reference, material);
        const candidateLch = candidateAppearance.lch;
        const referenceLch = referenceAppearance.lch;
        const deltaC = candidateLch[1] - referenceLch[1];
        const deltaCPercent = referenceLch[1] === 0 ? 0 : 100 * deltaC / referenceLch[1];
        const deltaH = deltaHue(candidateLch[2], referenceLch[2]);
        const dE76 = deltaE76(candidateAppearance.lab, referenceAppearance.lab);
        const dE00 = deltaE2000(referenceAppearance.lab, candidateAppearance.lab);
        return {
            materialId: material.id,
            materialName: material.name,
            materialNameCN: material.nameCN,
            materialCategory: material.category,
            targetHueZone: material.targetHueZone,
            cct,
            deltaL: candidateLch[0] - referenceLch[0],
            deltaC,
            deltaCPercent,
            deltaH,
            deltaE76: dE76,
            deltaE00: dE00,
            candidate: candidateAppearance,
            reference: referenceAppearance,
            dataQualification: material.dataQualification
        };
    }

    function calculateAllMaterials(candidateSpd, options) {
        assertReady();
        return MATERIAL_DATA.listMaterials().map(material => calculateMaterialDelta(candidateSpd, Object.assign({}, options, { material })));
    }

    function scoreMaterialDelta(result, constraints) {
        const limits = Object.assign({
            minDeltaCPercent: 2,
            maxDeltaCPercent: 8,
            maxAbsDeltaH: 2,
            maxDeltaE00: 3
        }, constraints || {});
        const inC = result.deltaCPercent >= limits.minDeltaCPercent && result.deltaCPercent <= limits.maxDeltaCPercent;
        const hPenalty = Math.max(0, Math.abs(result.deltaH) - limits.maxAbsDeltaH);
        const ePenalty = Math.max(0, result.deltaE00 - limits.maxDeltaE00);
        const cPenalty = inC ? 0 : Math.min(Math.abs(result.deltaCPercent - limits.minDeltaCPercent), Math.abs(result.deltaCPercent - limits.maxDeltaCPercent));
        return {
            score: Math.max(0, 100 - cPenalty * 6 - hPenalty * 12 - ePenalty * 10),
            inTargetC: inC,
            passesHue: Math.abs(result.deltaH) <= limits.maxAbsDeltaH,
            passesDeltaE: result.deltaE00 <= limits.maxDeltaE00,
            passes: inC && Math.abs(result.deltaH) <= limits.maxAbsDeltaH && result.deltaE00 <= limits.maxDeltaE00
        };
    }

    return Object.freeze({
        resampleSpd,
        normalizeToY,
        xyzFromSpd,
        daylightSpd,
        referenceSpd,
        labFromXyz,
        lchFromLab,
        deltaE76,
        deltaE2000,
        calculateMaterialDelta,
        calculateAllMaterials,
        scoreMaterialDelta
    });
});
