'use strict';

self.window = self;
importScripts(
    'spectral-data.js?v=20260804-material-target-lock',
    'spectral-math.js?v=20260804-material-target-lock',
    'colour-quality-data.js?v=20260804-material-target-lock',
    'colour-quality.js?v=20260804-material-target-lock',
    'metamer-optimizer.js?v=20260804-material-target-lock'
);

function xyFromSpd(spd) {
    const data = self.CIE_SPECTRAL_DATA;
    let X = 0;
    let Y = 0;
    let Z = 0;
    for (let index = 0; index < spd.length; index++) {
        const value = Number.isFinite(spd[index]) ? spd[index] : 0;
        X += value * data.xBar[index];
        Y += value * data.yBar[index];
        Z += value * data.zBar[index];
    }
    const sum = X + Y + Z;
    return sum > 1e-12
        ? { x: X / sum, y: Y / sum }
        : { x: 0, y: 0 };
}

const wavelengths = Array.from({ length: 401 }, function (_, index) {
    return 380 + index;
});

function evaluateSpd(spd) {
    return {
        ...self.ColourQuality.calculateColourQualityFromSpectrum({
            wavelengths,
            values: spd
        }),
        xy: xyFromSpd(spd)
    };
}

self.onmessage = function (event) {
    const message = event && event.data ? event.data : {};
    if (message.type !== 'optimize-metamer') return;
    const requestId = message.requestId;
    try {
        const payload = message.payload || {};
        const result = self.METAMER_OPTIMIZER.optimizeMetamer({
            channels: payload.channels,
            baselineValues: payload.baselineValues,
            targetXy: payload.targetXy,
            targetRg: payload.targetRg,
            objective: payload.objective,
            searchProfile: payload.searchProfile,
            seedValues: payload.seedValues,
            evaluateSpd,
            xyToUv: self.SpectralMath.xyToUv
        });
        self.postMessage({ requestId, result });
    } catch (error) {
        self.postMessage({
            requestId,
            error: error && error.message ? error.message : String(error)
        });
    }
};
