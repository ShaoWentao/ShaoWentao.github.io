(function(root, factory) {
    const data = factory();
    if (typeof module === 'object' && module.exports) module.exports = data;
    if (root) root.SPECTRAL_VALIDATION_REFERENCES = data;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
    'use strict';

    function freezeRecipe(recipe) {
        Object.freeze(recipe.values);
        Object.freeze(recipe.expected);
        Object.freeze(recipe.tolerance);
        return Object.freeze(recipe);
    }

    const standards = Object.freeze({
        d65: Object.freeze({
            x: 0.3127,
            y: 0.3290,
            xyTolerance: 0.0002,
            qualityTolerance: 0.2
        }),
        illuminantA: Object.freeze({
            temperatureK: 2856,
            x: 0.44757,
            y: 0.40745,
            xyTolerance: 0.00025,
            estimatedCctTolerance: 10,
            qualityTolerance: 0.3,
            r9Tolerance: 0.8
        })
    });

    const tolerance = Object.freeze({ xy: 0.00002, cct: 2, duv: 0.00002, quality: 0.08 });
    const measuredRgbwRecipes = Object.freeze([
        freezeRecipe({
            id: 'warm-white-only',
            values: [0, 0, 0, 100],
            expected: {
                x: 0.3470785745897091,
                y: 0.3403506133137218,
                cct: 4872.200573461729,
                duv: -0.00662834725234471,
                ra: 95.20056979680382,
                r9: 84.72195662218591,
                rf: 91.39968238957573,
                rg: 101.61232071951372
            },
            tolerance
        }),
        freezeRecipe({
            id: 'balanced-rgbw',
            values: [20, 35, 15, 100],
            expected: {
                x: 0.3468445947329226,
                y: 0.3606132742513715,
                cct: 4962.822063806455,
                duv: 0.0037452117939161668,
                ra: 94.51951896742494,
                r9: 84.34250568253655,
                rf: 91.14300621385507,
                rg: 98.3383707174215
            },
            tolerance
        }),
        freezeRecipe({
            id: 'vivid-rgbw',
            values: [65, 40, 30, 50],
            expected: {
                x: 0.3550157313089418,
                y: 0.34716882813506456,
                cct: 4600.927906445864,
                duv: -0.006149073260546348,
                ra: 91.17073262254414,
                r9: 59.14069047048364,
                rf: 91.38826891389427,
                rg: 103.02476262062079
            },
            tolerance
        })
    ]);

    return Object.freeze({ standards, measuredRgbwRecipes });
});
