/*
 * Representative material reflectance models for the spectral optimizer.
 *
 * Data qualification:
 * - These are engineering reference curves for algorithm development and patent
 *   disclosure support.
 * - They are not raw spectrophotometer measurements and should not be used as
 *   product, certification, inspection, or contract data.
 * - Replace or extend these materials with measured 380-780 nm reflectance data
 *   when project-specific material evidence is required.
 */
(function (root, factory) {
    const data = factory();
    if (typeof module === 'object' && module.exports) module.exports = data;
    if (root) root.MATERIAL_REFLECTANCE_DATA = data;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    const wavelengths = Object.freeze(Array.from({ length: 81 }, (_, index) => 380 + index * 5));
    const DATA_QUALIFICATION = 'representative engineering reflectance model; not raw measured data';

    function clampReflectance(value) {
        return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
    }

    function interpolateAnchors(anchors) {
        const sorted = anchors.slice().sort((a, b) => a[0] - b[0]);
        return Object.freeze(wavelengths.map(function (wavelength) {
            if (wavelength <= sorted[0][0]) return clampReflectance(sorted[0][1]);
            if (wavelength >= sorted[sorted.length - 1][0]) return clampReflectance(sorted[sorted.length - 1][1]);
            for (let index = 1; index < sorted.length; index++) {
                const right = sorted[index];
                if (wavelength <= right[0]) {
                    const left = sorted[index - 1];
                    const ratio = (wavelength - left[0]) / (right[0] - left[0]);
                    return clampReflectance(left[1] + (right[1] - left[1]) * ratio);
                }
            }
            return clampReflectance(sorted[sorted.length - 1][1]);
        }));
    }

    function material(definition) {
        return Object.freeze({
            id: definition.id,
            name: definition.name,
            nameCN: definition.nameCN,
            category: definition.category,
            targetHueZone: definition.targetHueZone,
            intendedUse: definition.intendedUse,
            intendedUseCN: definition.intendedUseCN,
            dataQualification: DATA_QUALIFICATION,
            reflectance: interpolateAnchors(definition.anchors),
            anchors: Object.freeze(definition.anchors.map(pair => Object.freeze(pair.slice())))
        });
    }

    const materials = Object.freeze([
        material({
            id: 'wood_warm_oak',
            name: 'Warm oak wood',
            nameCN: '暖橡木饰面',
            category: 'wood',
            targetHueZone: 'red-orange-yellow',
            intendedUse: 'wood, veneer, warm interior finish optimisation',
            intendedUseCN: '用于木材、木饰面与暖色室内饰面的光谱比较。',
            anchors: [[380, 0.075], [400, 0.10], [450, 0.16], [500, 0.22], [550, 0.31], [600, 0.43], [650, 0.52], [700, 0.56], [780, 0.58]]
        }),
        material({
            id: 'wood_dark_walnut',
            name: 'Dark walnut wood',
            nameCN: '深胡桃木饰面',
            category: 'wood',
            targetHueZone: 'red-orange-brown',
            intendedUse: 'dark wood and warm brown material optimisation',
            intendedUseCN: '用于深色木材与暖棕色材料的光谱比较。',
            anchors: [[380, 0.035], [400, 0.045], [450, 0.075], [500, 0.11], [550, 0.17], [600, 0.27], [650, 0.34], [700, 0.37], [780, 0.39]]
        }),
        material({
            id: 'leather_cognac',
            name: 'Cognac leather',
            nameCN: '干邑色皮革',
            category: 'leather',
            targetHueZone: 'red-orange-brown',
            intendedUse: 'leather, warm upholstery, hospitality material optimisation',
            intendedUseCN: '用于皮革、暖色软包与酒店材料的光谱比较。',
            anchors: [[380, 0.035], [400, 0.05], [450, 0.085], [500, 0.14], [550, 0.23], [600, 0.36], [650, 0.46], [700, 0.50], [780, 0.52]]
        }),
        material({
            id: 'fabric_warm_beige',
            name: 'Warm beige fabric',
            nameCN: '暖米色织物',
            category: 'fabric',
            targetHueZone: 'yellow-orange-neutral',
            intendedUse: 'fabric, curtain, upholstery and soft furnishing optimisation',
            intendedUseCN: '用于织物、窗帘、软包与软装材料的光谱比较。',
            anchors: [[380, 0.30], [400, 0.35], [450, 0.42], [500, 0.48], [550, 0.55], [600, 0.62], [650, 0.65], [700, 0.66], [780, 0.68]]
        }),
        material({
            id: 'leaf_green',
            name: 'Green leaf',
            nameCN: '绿植叶片',
            category: 'plant',
            targetHueZone: 'green',
            intendedUse: 'plant and biophilic interior lighting optimisation',
            intendedUseCN: '用于绿植与亲自然室内照明的光谱比较。',
            anchors: [[380, 0.035], [400, 0.04], [450, 0.055], [500, 0.12], [540, 0.28], [560, 0.34], [600, 0.18], [650, 0.08], [680, 0.06], [700, 0.09], [780, 0.12]]
        }),
        material({
            id: 'skin_tone_sample',
            name: 'Skin-tone reference sample',
            nameCN: '肤色参考样本',
            category: 'skin-tone-sample',
            targetHueZone: 'orange-red',
            intendedUse: 'human-centred scene rendering simulation; use measured datasets for medical or product claims',
            intendedUseCN: '用于以人为本场景的肤色呈现模拟；涉及医疗或产品声明时须采用实测数据。',
            anchors: [[380, 0.18], [400, 0.22], [450, 0.30], [500, 0.38], [550, 0.45], [600, 0.55], [650, 0.62], [700, 0.66], [780, 0.68]]
        }),
        material({
            id: 'neutral_wall_matte',
            name: 'Neutral matte wall',
            nameCN: '中性哑光墙面',
            category: 'neutral',
            targetHueZone: 'neutral',
            intendedUse: 'whitepoint stability and neutral surface check',
            intendedUseCN: '用于检查白点稳定性与中性表面呈现。',
            anchors: [[380, 0.72], [400, 0.75], [450, 0.78], [500, 0.80], [550, 0.81], [600, 0.81], [650, 0.80], [700, 0.79], [780, 0.77]]
        })
    ]);

    const byId = Object.freeze(materials.reduce(function (map, item) {
        map[item.id] = item;
        return map;
    }, {}));

    function getMaterial(id) {
        return byId[id] || null;
    }

    function listMaterials() {
        return materials.slice();
    }

    return Object.freeze({
        wavelengths,
        materials,
        byId,
        getMaterial,
        listMaterials,
        dataQualification: DATA_QUALIFICATION
    });
});
