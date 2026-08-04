(function(root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) root.RECIPE_EXPORT = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
    'use strict';

    function clonePlain(value) {
        return value == null ? value : JSON.parse(JSON.stringify(value));
    }

    function buildRecipeDocument(input) {
        if (!input || !Array.isArray(input.wavelengths) || !Array.isArray(input.normalizedSpd)) {
            throw new TypeError('wavelengths and normalizedSpd are required');
        }
        if (input.wavelengths.length !== input.normalizedSpd.length) {
            throw new RangeError('wavelengths and normalizedSpd must have the same length');
        }
        const buildInfo = clonePlain(input.buildInfo || {});
        const schemaVersion = Number.isInteger(buildInfo.recipeSchemaVersion)
            ? buildInfo.recipeSchemaVersion
            : 1;

        return {
            format: 'spectral-optimizer-recipe',
            version: schemaVersion,
            exportedAt: input.exportedAt,
            build: buildInfo,
            source: input.source,
            targets: clonePlain(input.targets || {}),
            result: clonePlain(input.result || {}),
            circadian: clonePlain(input.circadian || {}),
            melanopic: clonePlain(input.melanopic || {}),
            channels: clonePlain(input.channels || []),
            spd: {
                wavelengthUnit: 'nm',
                powerUnit: 'relative',
                normalization: 'peak=1',
                samples: input.wavelengths.map((wavelength, index) => [
                    wavelength,
                    input.normalizedSpd[index]
                ])
            }
        };
    }

    function downloadJsonFile(fileName, data) {
        if (typeof document === 'undefined' || typeof Blob === 'undefined' ||
            typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
            throw new Error('JSON download requires a browser environment');
        }
        const blob = new Blob([JSON.stringify(data, null, 2)], {
            type: 'application/json;charset=utf-8'
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 0);
    }

    return Object.freeze({ buildRecipeDocument, downloadJsonFile });
});
