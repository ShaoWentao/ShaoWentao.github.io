(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) root.DiningLightData = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    const wavelengths = Object.freeze(Array.from({ length: 81 }, function (_, index) {
        return 380 + index * 5;
    }));
    const DATA_QUALIFICATION = '餐饮食材代表性工程反射率模型；用于光谱配方比较，实测样本待导入';
    const LEVEL_SCALE = Object.freeze({ soft: 0.72, recommended: 1, vivid: 1.22 });
    const DINING_APPEARANCE = Object.freeze({
        food_grilled_beef: {
            file: 'assets/appearance/foods/red-brown-cooked-meat.webp',
            label: '本地照片参考'
        },
        food_tomato_red: {
            file: 'assets/appearance/foods/vivid-red-produce.webp',
            label: '本地照片参考'
        },
        food_salmon: {
            file: 'assets/appearance/foods/orange-pink-fish.webp',
            label: '本地照片参考'
        },
        food_leafy_green: {
            file: 'assets/appearance/foods/deep-green-leaves.webp',
            label: '本地照片参考'
        },
        food_white_rice: {
            file: 'assets/appearance/foods/neutral-light-staple.webp',
            label: '本地照片参考'
        },
        food_golden_bread: {
            file: 'assets/appearance/foods/golden-baked-crust.webp',
            label: '本地照片参考'
        },
        food_coffee_dark: {
            file: 'assets/appearance/foods/dark-brown-roasted.webp',
            label: '本地照片参考'
        }
    });

    function deepFreeze(value) {
        if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
        Object.keys(value).forEach(function (key) { deepFreeze(value[key]); });
        return Object.freeze(value);
    }

    function clamp(value, min, max) {
        return Math.max(min, Math.min(max, Number(value)));
    }

    function interpolateAnchors(anchors) {
        const sorted = anchors.slice().sort(function (a, b) { return a[0] - b[0]; });
        return Object.freeze(wavelengths.map(function (wavelength) {
            if (wavelength <= sorted[0][0]) return clamp(sorted[0][1], 0, 1);
            if (wavelength >= sorted[sorted.length - 1][0]) return clamp(sorted[sorted.length - 1][1], 0, 1);
            for (let index = 1; index < sorted.length; index++) {
                const right = sorted[index];
                if (wavelength <= right[0]) {
                    const left = sorted[index - 1];
                    const ratio = (wavelength - left[0]) / (right[0] - left[0]);
                    return clamp(left[1] + (right[1] - left[1]) * ratio, 0, 1);
                }
            }
            return 0;
        }));
    }

    function diningAppearance(id) {
        const visual = DINING_APPEARANCE[id];
        return deepFreeze({
            type: visual ? 'photo-reference' : 'placeholder',
            label: visual ? visual.label : '暂无可靠实拍图',
            origin: visual ? 'local photo reference' : 'awaiting uploaded food photograph',
            file: visual ? visual.file : '',
            baseFilter: 'none',
            notes: visual
                ? '参考、优化前和优化后使用同一张本地照片图块；差异仅由光谱计算结果驱动。'
                : '当前没有可靠的本地实拍纹理；请上传食材照片后再进行视觉对比。'
        });
    }

    function diningMaterial(definition) {
        return deepFreeze({
            id: definition.id,
            name: definition.name,
            nameCN: definition.nameCN,
            category: 'food',
            targetHueZone: definition.targetHueZone,
            intendedUse: definition.intendedUse,
            intendedUseCN: definition.intendedUseCN,
            appearanceSource: diningAppearance(definition.id),
            spectralSource: {
                type: 'engineering',
                label: '餐饮食材工程参考曲线',
                notes: definition.notesCN,
                dataQualification: DATA_QUALIFICATION
            },
            dataQualification: DATA_QUALIFICATION,
            sourceType: 'engineering',
            sourceName: '餐饮食材工程参考曲线',
            sourceUrl: '',
            sourceSample: '',
            reflectance: interpolateAnchors(definition.anchors),
            anchors: definition.anchors.map(function (pair) { return pair.slice(); })
        });
    }

    const materials = deepFreeze([
        diningMaterial({
            id: 'food_grilled_beef', name: 'Red-brown cooked meat', nameCN: '红棕熟肉',
            targetHueZone: 'red-orange-brown',
            intendedUse: 'grilled beef and browned protein rendering',
            intendedUseCN: '用于牛排、烤肉等红棕色熟肉表面的光色比较。',
            notesCN: '按熟肉短波低反射、红棕波段逐渐升高的典型特征构建。',
            anchors: [[380,0.035],[420,0.04],[460,0.05],[500,0.065],[540,0.09],[580,0.16],[620,0.29],[660,0.39],[700,0.43],[780,0.40]]
        }),
        diningMaterial({
            id: 'food_tomato_red', name: 'Vivid red produce', nameCN: '鲜红蔬果',
            targetHueZone: 'red-orange',
            intendedUse: 'tomato, red pepper and vivid red food rendering',
            intendedUseCN: '用于番茄、红椒和鲜红色食材表面的光色比较。',
            notesCN: '按短波低反射、600 nm后快速升高的鲜红食材特征构建。',
            anchors: [[380,0.025],[430,0.03],[480,0.035],[520,0.045],[560,0.075],[590,0.16],[620,0.39],[650,0.61],[700,0.68],[780,0.63]]
        }),
        diningMaterial({
            id: 'food_salmon', name: 'Orange-pink fish flesh', nameCN: '橙粉鱼肉',
            targetHueZone: 'orange-red',
            intendedUse: 'salmon and orange-pink seafood rendering',
            intendedUseCN: '用于三文鱼和橙粉色鱼肉表面的光色比较。',
            notesCN: '按橙粉色鱼肉在黄红波段较高反射的典型特征构建。',
            anchors: [[380,0.045],[420,0.05],[460,0.065],[500,0.095],[540,0.18],[580,0.39],[620,0.58],[660,0.66],[700,0.64],[780,0.58]]
        }),
        diningMaterial({
            id: 'food_leafy_green', name: 'Deep-green leafy surface', nameCN: '深绿叶菜',
            targetHueZone: 'green',
            intendedUse: 'leafy vegetables and herbs',
            intendedUseCN: '用于青菜、香草和沙拉绿叶表面的光色比较。',
            notesCN: '按叶绿素在蓝红波段吸收、绿色波段反射较高的典型特征构建。',
            anchors: [[380,0.035],[430,0.045],[470,0.06],[510,0.20],[545,0.37],[570,0.30],[600,0.12],[650,0.065],[690,0.10],[720,0.27],[780,0.34]]
        }),
        diningMaterial({
            id: 'food_white_rice', name: 'Neutral light staple', nameCN: '中性浅色主食',
            targetHueZone: 'neutral-warm',
            intendedUse: 'rice, noodles and pale starch foods',
            intendedUseCN: '用于米饭、面条和浅色主食的白度与洁净感比较。',
            notesCN: '按高反射、轻微暖色倾向的米粒表面构建。',
            anchors: [[380,0.52],[420,0.60],[460,0.68],[500,0.73],[540,0.76],[580,0.78],[620,0.79],[660,0.80],[700,0.80],[780,0.77]]
        }),
        diningMaterial({
            id: 'food_golden_bread', name: 'Golden baked crust', nameCN: '金黄烘焙表皮',
            targetHueZone: 'yellow-orange-brown',
            intendedUse: 'bread crust and baked golden surfaces',
            intendedUseCN: '用于面包外皮、酥点和烘焙金黄色表面的光色比较。',
            notesCN: '按烘焙褐变后短波较低、黄橙红波段逐渐升高的特征构建。',
            anchors: [[380,0.055],[420,0.07],[460,0.10],[500,0.17],[540,0.29],[580,0.46],[620,0.59],[660,0.64],[700,0.63],[780,0.58]]
        }),
        diningMaterial({
            id: 'food_coffee_dark', name: 'Dark-brown roasted surface', nameCN: '深棕烘焙表面',
            targetHueZone: 'red-brown',
            intendedUse: 'coffee beans, chocolate and dark roasted foods',
            intendedUseCN: '用于咖啡豆、巧克力和深度烘焙食品的暖棕色比较。',
            notesCN: '按低反射深棕色烘焙表面构建。',
            anchors: [[380,0.012],[430,0.015],[480,0.020],[520,0.027],[560,0.039],[600,0.060],[640,0.088],[680,0.112],[720,0.126],[780,0.128]]
        })
    ]);

    function scene(definition) {
        return deepFreeze(Object.assign({}, definition, {
            materialIds: definition.materialIds.slice(),
            cctRange: definition.cctRange.slice(),
            importanceByMaterialId: Object.assign({}, definition.importanceByMaterialId),
            targetsByMaterialId: Object.assign({}, definition.targetsByMaterialId || {})
        }));
    }

    function targets(entries) {
        return entries.reduce(function (map, entry) {
            map[entry[0]] = entry[1];
            return map;
        }, {});
    }

    const profiles = deepFreeze([
        scene({
            id: 'balanced_dining', nameCN: '综合餐饮',
            descriptionCN: '兼顾肉类、红色食材、鱼肉、绿叶菜、主食和烘焙食物。',
            recommendedCct: 3500, cctRange: [3000,4000], recommendedDuv: 0, cameraProxy: false,
            noteCN: '以自然白点为基础，适度提高红橙与绿色食材彩度。',
            materialIds: materials.map(function (item) { return item.id; }),
            importanceByMaterialId: { food_grilled_beef:1.45, food_tomato_red:1.35, food_salmon:1.25, food_leafy_green:1.25, food_white_rice:1.35, food_golden_bread:1.2, food_coffee_dark:1.0 },
            targetsByMaterialId: targets([
                ['food_grilled_beef',{targetDeltaC:4.8}], ['food_tomato_red',{targetDeltaC:5.0}],
                ['food_salmon',{targetDeltaC:4.2}], ['food_leafy_green',{targetDeltaC:3.8}],
                ['food_white_rice',{targetDeltaC:0.2,maxDeltaE00:3.8,maxAbsDeltaH:2}],
                ['food_golden_bread',{targetDeltaC:3.8}], ['food_coffee_dark',{targetDeltaC:2.2}]
            ])
        }),
        scene({
            id: 'hotpot_barbecue', nameCN: '火锅烧烤',
            descriptionCN: '提高烤肉、鲜红食材和暖色表面的食欲感，控制白米偏红。',
            recommendedCct: 3000, cctRange: [2700,3500], recommendedDuv: -0.0005, cameraProxy: false,
            noteCN: '红橙区域权重较高，白米承担中性限制。',
            materialIds: ['food_tomato_red','food_grilled_beef','food_leafy_green','food_white_rice','food_golden_bread'],
            importanceByMaterialId: { food_tomato_red:1.8, food_grilled_beef:1.65, food_leafy_green:1.05, food_white_rice:1.25, food_golden_bread:1.2 },
            targetsByMaterialId: targets([
                ['food_tomato_red',{targetDeltaC:6.5,maxDeltaE00:9}], ['food_grilled_beef',{targetDeltaC:5.5,maxDeltaE00:8.5}],
                ['food_leafy_green',{targetDeltaC:3.2}], ['food_white_rice',{targetDeltaC:0.2,maxDeltaE00:3.8,maxAbsDeltaH:2}],
                ['food_golden_bread',{targetDeltaC:4.2}]
            ])
        }),
        scene({
            id: 'japanese_seafood', nameCN: '日料海鲜',
            descriptionCN: '强调鱼肉和绿叶配菜的新鲜感，保持白米干净。',
            recommendedCct: 4000, cctRange: [3500,4000], recommendedDuv: 0, cameraProxy: false,
            noteCN: '控制黄红泛化，保持浅色主食洁净。',
            materialIds: ['food_salmon','food_leafy_green','food_white_rice','food_tomato_red'],
            importanceByMaterialId: { food_salmon:1.7, food_leafy_green:1.2, food_white_rice:1.55, food_tomato_red:0.9 },
            targetsByMaterialId: targets([
                ['food_salmon',{targetDeltaC:4.6}], ['food_leafy_green',{targetDeltaC:2.8}],
                ['food_white_rice',{targetDeltaC:0,maxDeltaE00:3.2,maxAbsDeltaH:1.8}], ['food_tomato_red',{targetDeltaC:3.2}]
            ])
        }),
        scene({
            id: 'bakery_coffee', nameCN: '烘焙咖啡',
            descriptionCN: '突出面包焦糖色和咖啡豆层次，保持白米类浅色参照稳定。',
            recommendedCct: 3000, cctRange: [2700,3500], recommendedDuv: 0, cameraProxy: false,
            noteCN: '黄橙棕区域适度增强。',
            materialIds: ['food_golden_bread','food_coffee_dark','food_white_rice','food_tomato_red'],
            importanceByMaterialId: { food_golden_bread:1.8, food_coffee_dark:1.45, food_white_rice:1.3, food_tomato_red:0.8 },
            targetsByMaterialId: targets([
                ['food_golden_bread',{targetDeltaC:5.5}], ['food_coffee_dark',{targetDeltaC:2.8}],
                ['food_white_rice',{targetDeltaC:0.2,maxDeltaE00:3.8}], ['food_tomato_red',{targetDeltaC:3.0}]
            ])
        }),
        scene({
            id: 'fine_dining', nameCN: '高端晚餐',
            descriptionCN: '在较低照度氛围下兼顾肉类、鱼肉、烘焙和深色食物层次。',
            recommendedCct: 2700, cctRange: [2700,3000], recommendedDuv: 0, cameraProxy: false,
            noteCN: '彩度目标较克制，白米稳定权重较高。',
            materialIds: ['food_grilled_beef','food_salmon','food_golden_bread','food_coffee_dark','food_white_rice'],
            importanceByMaterialId: { food_grilled_beef:1.4, food_salmon:1.25, food_golden_bread:1.1, food_coffee_dark:1.2, food_white_rice:1.45 },
            targetsByMaterialId: targets([
                ['food_grilled_beef',{targetDeltaC:4}], ['food_salmon',{targetDeltaC:3.5}],
                ['food_golden_bread',{targetDeltaC:3}], ['food_coffee_dark',{targetDeltaC:2.5}],
                ['food_white_rice',{targetDeltaC:0,maxAbsDeltaH:1.8,maxDeltaE00:3}]
            ])
        }),
        scene({
            id: 'bar_atmosphere', nameCN: '酒吧氛围',
            descriptionCN: '突出咖啡、烤肉和深暖色食物质感，保留浅色食物识别。',
            recommendedCct: 2700, cctRange: [2700,3000], recommendedDuv: 0, cameraProxy: false,
            noteCN: '适合暖色低照度氛围。',
            materialIds: ['food_coffee_dark','food_grilled_beef','food_tomato_red','food_golden_bread','food_white_rice'],
            importanceByMaterialId: { food_coffee_dark:1.55, food_grilled_beef:1.3, food_tomato_red:1.25, food_golden_bread:1.0, food_white_rice:1.25 },
            targetsByMaterialId: targets([
                ['food_coffee_dark',{targetDeltaC:3}], ['food_grilled_beef',{targetDeltaC:3.8}],
                ['food_tomato_red',{targetDeltaC:4.5}], ['food_golden_bread',{targetDeltaC:3}],
                ['food_white_rice',{targetDeltaC:0,maxAbsDeltaH:2.2,maxDeltaE00:3.8}]
            ])
        }),
        scene({
            id: 'camera_friendly', nameCN: '拍照友好',
            descriptionCN: '平衡食材彩度与白米中性表现，降低手机自动白平衡下常见的偏红偏黄风险。',
            recommendedCct: 4000, cctRange: [3500,4000], recommendedDuv: 0, cameraProxy: true,
            noteCN: '这是面向手机拍照的工程代理模型，不模拟具体相机传感器、色彩矩阵或自动白平衡算法。',
            materialIds: materials.map(function (item) { return item.id; }),
            importanceByMaterialId: { food_grilled_beef:1.25, food_tomato_red:1.2, food_salmon:1.2, food_leafy_green:1.15, food_white_rice:1.7, food_golden_bread:1.1, food_coffee_dark:1.0 },
            targetsByMaterialId: targets([
                ['food_grilled_beef',{targetDeltaC:3.8}], ['food_tomato_red',{targetDeltaC:4}],
                ['food_salmon',{targetDeltaC:3.5}], ['food_leafy_green',{targetDeltaC:3}],
                ['food_white_rice',{targetDeltaC:0,maxAbsDeltaH:1.5,maxDeltaE00:2.8}],
                ['food_golden_bread',{targetDeltaC:3.2}], ['food_coffee_dark',{targetDeltaC:2.2}]
            ])
        })
    ]);

    const materialsById = Object.freeze(Object.fromEntries(materials.map(function (item) { return [item.id, item]; })));
    const profilesById = Object.freeze(Object.fromEntries(profiles.map(function (item) { return [item.id, item]; })));

    function listMaterials() { return materials.slice(); }
    function getMaterial(id) { return materialsById[id] || null; }
    function listProfiles() { return profiles.slice(); }
    function getProfile(id) { return profilesById[id] || null; }

    function profileOverrides(profileId, requestedLevel) {
        const selectedLevel = Object.prototype.hasOwnProperty.call(LEVEL_SCALE, requestedLevel) ? requestedLevel : 'recommended';
        const profile = getProfile(profileId);
        if (!profile) return {};
        const scale = LEVEL_SCALE[selectedLevel];
        const result = {};
        profile.materialIds.forEach(function (materialId) {
            const target = profile.targetsByMaterialId[materialId] || {};
            const levelValues = {};
            if (Number.isFinite(target.targetDeltaC)) levelValues.targetDeltaC = clamp(target.targetDeltaC * scale, -5, 12);
            ['targetDeltaH','targetDeltaL','maxAbsDeltaH','maxAbsDeltaL','maxDeltaE00'].forEach(function (field) {
                if (Number.isFinite(target[field])) levelValues[field] = target[field];
            });
            result[materialId] = {
                importance: profile.importanceByMaterialId[materialId],
                levels: { [selectedLevel]: levelValues }
            };
        });
        return result;
    }

    return Object.freeze({
        wavelengths: wavelengths,
        dataQualification: DATA_QUALIFICATION,
        materials: materials,
        materialsById: materialsById,
        profiles: profiles,
        profilesById: profilesById,
        listMaterials: listMaterials,
        getMaterial: getMaterial,
        listProfiles: listProfiles,
        getProfile: getProfile,
        profileOverrides: profileOverrides
    });
});
