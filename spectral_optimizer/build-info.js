(function(root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) root.SPECTRAL_BUILD_INFO = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
    'use strict';

    const dataVersions = Object.freeze({
        standardObserver: 'CIE 1931 2° 1 nm',
        standardIlluminantD65: 'CIE D65 1 nm',
        alphaOpic: 'CIE S 026:2018 1 nm',
        colourQuality: 'CIE TCS14 + CES99 dataset v1',
        rgbwChannels: 'RGBW.csv measured v1',
        rgbclaChannels: 'LZ7-04M2PD model v1'
    });

    const info = Object.freeze({
        applicationVersion: '1.0.0',
        algorithmVersion: '2026.07-p2.1',
        recipeSchemaVersion: 2,
        dataVersions
    });

    function getBuildInfo() {
        return info;
    }

    function compactLabel() {
        return `v${info.applicationVersion} · ALG ${info.algorithmVersion}`;
    }

    return Object.freeze({ getBuildInfo, compactLabel });
});
