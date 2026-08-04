(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) root.MaterialPreferenceProfiles = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    const STORAGE_KEY = 'spectral_optimizer_material_preferences_v1';
    const LEVELS = Object.freeze(['soft', 'recommended', 'vivid']);
    const RANGES = deepFreeze({
        targetDeltaC: [-5, 12],
        targetDeltaH: [-10, 10],
        targetDeltaL: [-8, 8],
        maxAbsDeltaH: [0.5, 15],
        maxAbsDeltaL: [0.5, 12],
        maxDeltaE00: [1, 15],
        importance: [0.1, 5],
        weight: [0, 5]
    });
    const WEIGHT_KEYS = Object.freeze(['chroma', 'hue', 'lightness', 'deltaE']);
    const LEVEL_KEYS = Object.freeze([
        'targetDeltaC', 'targetDeltaH', 'targetDeltaL',
        'maxAbsDeltaH', 'maxAbsDeltaL', 'maxDeltaE00'
    ]);

    const GLOBAL_DEFAULTS = deepFreeze({
        importance: 1,
        weights: { chroma: 1, hue: 1.4, lightness: 0.6, deltaE: 0.12 },
        levels: {
            soft: {
                targetDeltaC: 2,
                targetDeltaH: 0,
                targetDeltaL: 0,
                maxAbsDeltaH: 4,
                maxAbsDeltaL: 3,
                maxDeltaE00: 4.5
            },
            recommended: {
                targetDeltaC: 4,
                targetDeltaH: 0,
                targetDeltaL: 0.3,
                maxAbsDeltaH: 5,
                maxAbsDeltaL: 4,
                maxDeltaE00: 6
            },
            vivid: {
                targetDeltaC: 6,
                targetDeltaH: 0,
                targetDeltaL: 0.5,
                maxAbsDeltaH: 6,
                maxAbsDeltaL: 5,
                maxDeltaE00: 8
            }
        }
    });

    const CATEGORY_DEFAULTS = deepFreeze({
        wood: profile({ importance: 1.2, weights: { hue: 1.7 }, levels: levelTargets([2, 4, 6], [0.2, 0.4, 0.6], [4.5, 6.5, 8]) }),
        stone: profile({ importance: 1, weights: { hue: 1.6, deltaE: 0.16 }, levels: levelTargets([0.8, 2, 3.5], [0, 0.1, 0.2], [4, 5.5, 7]) }),
        fabric: profile({ importance: 1.1, weights: { chroma: 1.2, hue: 1.5 }, levels: levelTargets([3, 5.2, 7], [0, 0.2, 0.4], [5, 7, 9]) }),
        leather: profile({ importance: 1.15, weights: { chroma: 1.15, hue: 1.7 }, levels: levelTargets([2.5, 4.6, 6.5], [0, 0.2, 0.3], [5, 7, 9]) }),
        metal: profile({ importance: 0.9, weights: { hue: 1.8, lightness: 0.8, deltaE: 0.16 }, levels: levelTargets([0.8, 2.2, 3.8], [0, 0.1, 0.2], [4, 5.5, 7]) }),
        paint: profile({ importance: 1, weights: { hue: 1.8, lightness: 0.8, deltaE: 0.16 }, levels: levelTargets([0.8, 2, 3.5], [0, 0.1, 0.2], [4, 5.5, 7]) }),
        plant: profile({ importance: 1.15, weights: { chroma: 1.2, hue: 1.5 }, levels: levelTargets([3, 5.5, 7.5], [0, 0.2, 0.4], [5, 7, 9]) }),
        'skin-tone-sample': profile({ importance: 1.35, weights: { chroma: 1.35, hue: 2.4, lightness: 1, deltaE: 0.22 }, levels: levelTargets([0.4, 1, 1.5], [0, 0.1, 0.2], [3.2, 4.2, 5.2]) }),
        food: profile({ importance: 1.2, weights: { chroma: 1.25, hue: 1.8, lightness: 0.75, deltaE: 0.14 }, levels: levelTargets([2.5, 4.5, 6.5], [0.1, 0.3, 0.5], [5, 7, 9]) }),
        neutral: profile({
            importance: 1.3,
            weights: { chroma: 1.5, hue: 2.2, lightness: 1.1, deltaE: 0.25 },
            levels: {
                soft: neutralLevel(0, 2, 2, 2.5),
                recommended: neutralLevel(0, 2, 2, 3),
                vivid: neutralLevel(0.4, 2.5, 2.5, 3.5)
            }
        }),
        user: profile({ importance: 1, levels: levelTargets([2, 4, 6], [0, 0.2, 0.4], [4.5, 6, 8]) })
    });

    const MATERIAL_PROFILES = deepFreeze({
        wood_warm_oak: materialProfile(1.25, [2.2, 4, 5.8], [0.2, 0.5, 0.7]),
        wood_dark_walnut: materialProfile(1.2, [1.5, 3.2, 4.8], [-0.2, 0, 0.1], { hue: 1.9 }),
        wood_white_oak: materialProfile(1.2, [1.8, 3.3, 4.8], [0.2, 0.4, 0.6], { hue: 1.9 }),
        stone_white_marble: materialProfile(1.25, [0.2, 0.7, 1.2], [0, 0.1, 0.2], { hue: 2.1, lightness: 1 }, { maxAbsDeltaH: [2, 2.5, 3], maxDeltaE00: [3.5, 4.5, 5.5] }),
        stone_grey_concrete: materialProfile(1.1, [0, 0.3, 0.7], [0, 0, 0.1], { hue: 2, lightness: 0.9 }, { maxAbsDeltaH: [2, 2.5, 3], maxDeltaE00: [3.5, 4.5, 5.5] }),
        stone_warm_sandstone: materialProfile(1, [1.5, 3, 4.5], [0.1, 0.3, 0.5], { hue: 1.7 }),
        fabric_warm_beige: materialProfile(1.05, [2, 4, 5.5], [0.1, 0.3, 0.5], { hue: 1.8 }),
        fabric_dark_blue: materialProfile(1.15, [3, 5, 7], [0, 0.1, 0.2], { chroma: 1.3, hue: 1.8 }),
        fabric_wine_velvet: materialProfile(1.25, [4, 6, 8], [0, 0.2, 0.4], { chroma: 1.35, hue: 1.9 }, { maxDeltaE00: [6, 8, 10] }),
        fabric_grey_wool: materialProfile(1, [0.5, 1.2, 2], [0, 0.1, 0.2], { hue: 2, deltaE: 0.2 }, { maxAbsDeltaH: [2.5, 3, 3.5], maxDeltaE00: [4, 5, 6] }),
        leather_cognac: materialProfile(1.2, [3, 5, 7], [0, 0.2, 0.4], { hue: 1.9 }),
        leather_black: materialProfile(1.05, [0.4, 1.1, 2], [-0.1, 0, 0.1], { hue: 2, lightness: 1 }, { maxAbsDeltaH: [3, 3.5, 4], maxDeltaE00: [4, 5, 6] }),
        leather_tan: materialProfile(1.1, [2.5, 4.5, 6], [0.1, 0.3, 0.5], { hue: 1.8 }),
        metal_stainless_steel: materialProfile(1.15, [0, 0.4, 0.8], [0, 0, 0.1], { hue: 2.2, lightness: 1 }, { maxAbsDeltaH: [2, 2.5, 3], maxDeltaE00: [3, 4, 5] }),
        metal_brass: materialProfile(1.1, [2, 3.5, 5], [0, 0.1, 0.2], { hue: 2 }),
        metal_antique_bronze: materialProfile(1, [1.5, 3, 4.5], [-0.1, 0, 0.1], { hue: 2 }),
        paint_warm_white: materialProfile(1.3, [0, 0.2, 0.5], [0, 0, 0.1], { chroma: 1.5, hue: 2.3, lightness: 1.1 }, { maxAbsDeltaH: [2, 2, 2.5], maxDeltaE00: [2.5, 3, 4] }),
        paint_morandi_grey: materialProfile(1.2, [0.2, 0.5, 1], [0, 0, 0.1], { chroma: 1.4, hue: 2.1, lightness: 1 }, { maxAbsDeltaH: [2, 2.5, 3], maxDeltaE00: [3, 4, 5] }),
        paint_mint_green: materialProfile(1.05, [2.5, 4, 5.5], [0.1, 0.2, 0.4], { chroma: 1.2, hue: 1.8 }),
        leaf_green: materialProfile(1.2, [3, 5.5, 7.5], [0, 0.2, 0.4], { chroma: 1.3, hue: 1.7 }),
        skin_tone_sample: materialProfile(1.4, [0.4, 1, 1.5], [0, 0.1, 0.2], { chroma: 1.4, hue: 2.5, lightness: 1, deltaE: 0.22 }, { maxAbsDeltaH: [2, 2.5, 3], maxAbsDeltaL: [2.5, 3, 3.5], maxDeltaE00: [3.2, 4.2, 5.2] }),
        food_grilled_beef: materialProfile(1.4, [3.5, 5, 6.5], [0, 0.2, 0.4], { chroma: 1.35, hue: 2 }, { maxAbsDeltaH: [3, 3.5, 4], maxDeltaE00: [6, 8, 10] }),
        food_red_broth: materialProfile(1.45, [4.5, 6.5, 8.5], [0, 0.2, 0.4], { chroma: 1.4, hue: 2 }, { maxAbsDeltaH: [3, 3.5, 4], maxDeltaE00: [7, 9, 11] }),
        food_tomato_red: materialProfile(1.4, [4, 6, 8], [0, 0.2, 0.4], { chroma: 1.4, hue: 2 }, { maxAbsDeltaH: [3, 3.5, 4], maxDeltaE00: [6.5, 8.5, 10.5] }),
        food_salmon: materialProfile(1.35, [3.2, 4.8, 6.2], [0.1, 0.3, 0.5], { chroma: 1.35, hue: 2 }, { maxAbsDeltaH: [3, 3.5, 4], maxDeltaE00: [6, 8, 9.5] }),
        food_shrimp: materialProfile(1.2, [2.5, 3.8, 5.2], [0.1, 0.3, 0.5], { chroma: 1.25, hue: 1.9 }, { maxAbsDeltaH: [3, 3.5, 4], maxDeltaE00: [5.5, 7, 8.5] }),
        food_leafy_green: materialProfile(1.25, [3, 4.5, 6], [0, 0.2, 0.4], { chroma: 1.3, hue: 1.8 }, { maxAbsDeltaH: [3, 3.5, 4], maxDeltaE00: [5.5, 7.5, 9] }),
        food_white_rice: materialProfile(1.35, [0, 0.2, 0.5], [0, 0.1, 0.2], { chroma: 1.6, hue: 2.4, lightness: 1.1, deltaE: 0.24 }, { maxAbsDeltaH: [1.8, 2, 2.5], maxAbsDeltaL: [2, 2.5, 3], maxDeltaE00: [2.8, 3.5, 4.2] }),
        food_golden_bread: materialProfile(1.3, [3.5, 5, 6.5], [0.1, 0.3, 0.5], { chroma: 1.3, hue: 1.9 }, { maxAbsDeltaH: [3, 3.5, 4], maxDeltaE00: [5.5, 7.5, 9] }),
        food_cream_white: materialProfile(1.35, [0, 0.2, 0.5], [0, 0.1, 0.2], { chroma: 1.6, hue: 2.4, lightness: 1.1, deltaE: 0.24 }, { maxAbsDeltaH: [1.8, 2, 2.5], maxAbsDeltaL: [2, 2.5, 3], maxDeltaE00: [2.8, 3.5, 4.2] }),
        food_coffee_dark: materialProfile(1.1, [1.2, 2.3, 3.5], [0, 0.1, 0.2], { chroma: 1.1, hue: 2, lightness: 0.9 }, { maxAbsDeltaH: [3, 3.5, 4], maxDeltaE00: [4.5, 6, 7.5] }),
        food_red_wine: materialProfile(1.2, [2.5, 4, 5.5], [0, 0.1, 0.2], { chroma: 1.25, hue: 2.1 }, { maxAbsDeltaH: [3, 3.5, 4], maxDeltaE00: [5.5, 7.5, 9] }),
        food_skin_warm: materialProfile(1.4, [0.4, 1, 1.5], [0, 0.1, 0.2], { chroma: 1.4, hue: 2.5, lightness: 1, deltaE: 0.22 }, { maxAbsDeltaH: [2, 2.5, 3], maxAbsDeltaL: [2.5, 3, 3.5], maxDeltaE00: [3.2, 4.2, 5.2] }),
        food_white_porcelain: materialProfile(1.5, [0, 0, 0.3], [0, 0, 0.1], { chroma: 1.7, hue: 2.6, lightness: 1.2, deltaE: 0.28 }, { maxAbsDeltaH: [1.5, 2, 2.5], maxAbsDeltaL: [1.8, 2.2, 2.8], maxDeltaE00: [2.5, 3.2, 4] }),
        neutral_wall_matte: materialProfile(1.35, [0, 0, 0.4], [0, 0, 0.1], { chroma: 1.6, hue: 2.4, lightness: 1.2, deltaE: 0.25 }, { maxAbsDeltaH: [2, 2, 2.5], maxAbsDeltaL: [2, 2, 2.5], maxDeltaE00: [2.5, 3, 3.5] })
    });

    function levelTargets(chroma, lightness, deltaE) {
        return {
            soft: level(chroma[0], lightness[0], deltaE[0]),
            recommended: level(chroma[1], lightness[1], deltaE[1]),
            vivid: level(chroma[2], lightness[2], deltaE[2])
        };
    }

    function level(targetDeltaC, targetDeltaL, maxDeltaE00) {
        return {
            targetDeltaC,
            targetDeltaH: 0,
            targetDeltaL,
            maxAbsDeltaH: 4,
            maxAbsDeltaL: 4,
            maxDeltaE00
        };
    }

    function neutralLevel(targetDeltaC, maxAbsDeltaH, maxAbsDeltaL, maxDeltaE00) {
        return {
            targetDeltaC,
            targetDeltaH: 0,
            targetDeltaL: 0,
            maxAbsDeltaH,
            maxAbsDeltaL,
            maxDeltaE00
        };
    }

    function profile(definition) {
        return definition;
    }

    function materialProfile(importance, chroma, lightness, weights, limitOverrides) {
        const baseLevels = levelTargets(chroma, lightness, [4.5, 6.5, 8.5]);
        const limits = limitOverrides || {};
        LEVELS.forEach(function (name, index) {
            Object.keys(limits).forEach(function (key) {
                baseLevels[name][key] = limits[key][index];
            });
        });
        return { importance, weights: weights || {}, levels: baseLevels };
    }

    function isPlainObject(value) {
        return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
    }

    function mergeProfile(base, addition) {
        const result = {
            importance: base.importance,
            weights: Object.assign({}, base.weights),
            levels: {}
        };
        LEVELS.forEach(function (name) {
            result.levels[name] = Object.assign({}, base.levels[name]);
        });
        if (!isPlainObject(addition)) return result;
        if (Number.isFinite(addition.importance)) result.importance = Number(addition.importance);
        if (isPlainObject(addition.weights)) Object.assign(result.weights, addition.weights);
        if (isPlainObject(addition.levels)) {
            LEVELS.forEach(function (name) {
                if (isPlainObject(addition.levels[name])) Object.assign(result.levels[name], addition.levels[name]);
            });
        }
        return result;
    }

    function resolveMaterialPreference(material, requestedLevel, userOverrides) {
        if (!material || typeof material.id !== 'string') throw new TypeError('material with id is required');
        const selectedLevel = LEVELS.includes(requestedLevel) ? requestedLevel : 'recommended';
        const category = CATEGORY_DEFAULTS[material.category] ? material.category : 'user';
        let merged = mergeProfile(GLOBAL_DEFAULTS, CATEGORY_DEFAULTS[category]);
        const materialLayer = MATERIAL_PROFILES[material.id];
        if (materialLayer) merged = mergeProfile(merged, materialLayer);
        const override = isPlainObject(userOverrides) ? userOverrides[material.id] : null;
        if (override) merged = mergeProfile(merged, override);
        const selected = merged.levels[selectedLevel];
        return deepFreeze({
            materialId: material.id,
            category,
            level: selectedLevel,
            source: override ? 'user' : materialLayer ? 'material' : 'category',
            importance: merged.importance,
            targetDeltaC: selected.targetDeltaC,
            targetDeltaH: selected.targetDeltaH,
            targetDeltaL: selected.targetDeltaL,
            maxAbsDeltaH: selected.maxAbsDeltaH,
            maxAbsDeltaL: selected.maxAbsDeltaL,
            maxDeltaE00: selected.maxDeltaE00,
            weights: Object.assign({}, merged.weights)
        });
    }

    function validateNumber(path, value, range, errors) {
        if (!Number.isFinite(Number(value))) {
            errors.push(path + ' must be a finite number');
            return;
        }
        const number = Number(value);
        if (number < range[0] || number > range[1]) {
            errors.push(path + ' must be between ' + range[0] + ' and ' + range[1]);
        }
    }

    function validatePreferenceOverride(override) {
        const errors = [];
        if (!isPlainObject(override)) return { ok: false, errors: ['override must be an object'] };
        const allowedTop = new Set(['importance', 'weights', 'levels']);
        Object.keys(override).forEach(function (key) {
            if (!allowedTop.has(key)) errors.push('unsupported field ' + key);
        });
        if (override.importance !== undefined) validateNumber('importance', override.importance, RANGES.importance, errors);
        if (override.weights !== undefined) {
            if (!isPlainObject(override.weights)) errors.push('weights must be an object');
            else Object.keys(override.weights).forEach(function (key) {
                if (!WEIGHT_KEYS.includes(key)) errors.push('unsupported weight ' + key);
                else validateNumber('weights.' + key, override.weights[key], RANGES.weight, errors);
            });
        }
        if (override.levels !== undefined) {
            if (!isPlainObject(override.levels)) errors.push('levels must be an object');
            else Object.keys(override.levels).forEach(function (levelName) {
                if (!LEVELS.includes(levelName)) {
                    errors.push('unsupported level ' + levelName);
                    return;
                }
                const values = override.levels[levelName];
                if (!isPlainObject(values)) {
                    errors.push('levels.' + levelName + ' must be an object');
                    return;
                }
                Object.keys(values).forEach(function (key) {
                    if (!LEVEL_KEYS.includes(key)) errors.push('unsupported level field ' + key);
                    else validateNumber('levels.' + levelName + '.' + key, values[key], RANGES[key], errors);
                });
            });
        }
        return { ok: errors.length === 0, errors };
    }

    function storageOrDefault(storage) {
        if (storage && typeof storage.getItem === 'function') return storage;
        try {
            if (typeof globalThis !== 'undefined' && globalThis.localStorage) return globalThis.localStorage;
        } catch (error) { /* storage blocked */ }
        return null;
    }

    function loadOverrides(storage) {
        const target = storageOrDefault(storage);
        if (!target) return {};
        try {
            const parsed = JSON.parse(target.getItem(STORAGE_KEY) || '{}');
            if (!isPlainObject(parsed)) return {};
            const cleaned = {};
            Object.keys(parsed).forEach(function (materialId) {
                const validation = validatePreferenceOverride(parsed[materialId]);
                if (validation.ok) cleaned[materialId] = parsed[materialId];
            });
            return cleaned;
        } catch (error) {
            return {};
        }
    }

    function saveOverride(materialId, override, storage) {
        if (typeof materialId !== 'string' || !materialId.trim()) {
            return { ok: false, errors: ['materialId is required'] };
        }
        const validation = validatePreferenceOverride(override);
        if (!validation.ok) return validation;
        const target = storageOrDefault(storage);
        if (!target || typeof target.setItem !== 'function') return { ok: false, errors: ['storage unavailable'] };
        try {
            const all = loadOverrides(target);
            all[materialId] = JSON.parse(JSON.stringify(override));
            target.setItem(STORAGE_KEY, JSON.stringify(all));
            return { ok: true, errors: [], overrides: all };
        } catch (error) {
            return { ok: false, errors: [error && error.message ? error.message : 'storage unavailable'] };
        }
    }

    function removeOverride(materialId, storage) {
        const target = storageOrDefault(storage);
        if (!target || typeof target.setItem !== 'function') return { ok: false, errors: ['storage unavailable'] };
        try {
            const all = loadOverrides(target);
            delete all[materialId];
            if (Object.keys(all).length === 0 && typeof target.removeItem === 'function') target.removeItem(STORAGE_KEY);
            else target.setItem(STORAGE_KEY, JSON.stringify(all));
            return { ok: true, errors: [], overrides: all };
        } catch (error) {
            return { ok: false, errors: [error && error.message ? error.message : 'storage unavailable'] };
        }
    }

    function deepFreeze(value) {
        if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
        Object.keys(value).forEach(function (key) { deepFreeze(value[key]); });
        return Object.freeze(value);
    }

    return Object.freeze({
        STORAGE_KEY,
        LEVELS,
        RANGES,
        resolveMaterialPreference,
        validatePreferenceOverride,
        loadOverrides,
        saveOverride,
        removeOverride,
        categoryDefaults: CATEGORY_DEFAULTS,
        materialProfiles: MATERIAL_PROFILES
    });
});
