(function (root, factory) {
    var api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) root.ProfessionalDataLoader = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    function requireText(value) {
        if (typeof value !== 'string' || value.trim() === '') {
            throw new Error('Professional spectral data is empty');
        }
        return value;
    }

    async function loadProfessionalDataText(options) {
        var config = options || {};
        var fetchImpl = config.fetchImpl;
        if (fetchImpl === undefined && typeof fetch === 'function') fetchImpl = fetch;
        if (typeof fetchImpl !== 'function') {
            throw new Error('Professional spectral data loader is unavailable');
        }
        var response = await fetchImpl(config.url || 'cie-alpha-opic-action-spectra.csv');
        if (!response || !response.ok) {
            var status = response && response.status !== undefined ? response.status : 'unknown';
            throw new Error('Professional spectral data request failed with HTTP ' + status);
        }
        return requireText(await response.text());
    }

    return { loadProfessionalDataText: loadProfessionalDataText };
});
