(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) root.DiningLightData = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    const wavelengths = Object.freeze(Array.from({ length: 81 }, function (_, index) {
        return 380 + index * 5;
    }));
    const DATA_QUALIFICATION = '餐饮菜式代表性工程反射率模型；用于光谱配方比较，实测样本待导入';
    const LEVEL_SCALE = Object.freeze({ soft: 0.72, recommended: 1, vivid: 1.22 });
    const PALE_CONTROL_IDS = Object.freeze([
        'dish_silver_steamed_seafood',
        'dish_pale_poultry',
        'dish_pale_tofu_mushroom'
    ]);
    const LEGACY_TEMPLATE_IDS = Object.freeze({
        food_grilled_beef: 'dish_red_braised_meat',
        food_tomato_red: 'dish_red_chili_oil',
        food_salmon: 'dish_orange_pink_seafood',
        food_leafy_green: 'dish_green_vegetable',
        food_white_rice: 'dish_pale_tofu_mushroom',
        food_golden_bread: 'dish_golden_fried',
        food_coffee_dark: 'dish_dark_sauce_mushroom'
    });
    function macroPhoto(url, crop) {
        return 'https://images.weserv.nl/?url=' + encodeURIComponent(String(url).replace(/^https?:\/\//, '')) +
            '&precrop&cx=' + crop[0] + '%25&cy=' + crop[1] + '%25&cw=' + crop[2] + '%25&ch=' + crop[3] +
            '%25&w=1200&h=900&fit=cover&output=jpg&q=88';
    }

    const DINING_APPEARANCE = Object.freeze({
        dish_red_braised_meat: {
            file: macroPhoto('https://images.pexels.com/photos/8256988/pexels-photo-8256988.jpeg', [31,27,43,43]),
            fallbackFile: 'assets/appearance/foods/red-brown-cooked-meat.webp',
            sourcePage: 'https://www.pexels.com/photo/close-up-shot-of-delicious-braised-pork-on-white-ceramic-plate-8256988/',
            label: '红烧肉局部特写'
        },
        dish_red_chili_oil: {
            file: macroPhoto('https://x0.ifengimg.com/ucms/2022_11/C68B7B980D9A51EA5FD268C58A41A000F3670732_size940_w1080_h658.png', [33,33,38,38]),
            fallbackFile: 'assets/appearance/foods/vivid-red-produce.webp',
            sourcePage: 'https://ishare.ifeng.com/c/s/v002viQCQp1l9xEwP6nNNyP4hm7kxG7lA5WDzgCUASWpn8g__',
            label: '水煮肉片鲜红辣油局部特写'
        },
        dish_golden_fried: {
            file: macroPhoto('https://images.pexels.com/photos/11502306/pexels-photo-11502306.jpeg', [29,27,39,39]),
            fallbackFile: 'assets/appearance/foods/golden-baked-crust.webp',
            sourcePage: 'https://www.pexels.com/photo/fried-chicken-on-white-plate-11502306/',
            label: '炸鸡脆皮局部特写'
        },
        dish_dark_roasted_meat: {
            file: macroPhoto('https://commons.wikimedia.org/wiki/Special:Redirect/file/Roasted%20goose%20made%20in%20north%20China(JiaoXiangMei)%20on%20dish.jpg?width=1800', [33,31,37,37]),
            fallbackFile: 'assets/appearance/foods/dark-brown-roasted.webp',
            sourcePage: 'https://commons.wikimedia.org/wiki/File:Roasted_goose_made_in_north_China(JiaoXiangMei)_on_dish.jpg',
            label: '烧鹅烤制表皮局部特写'
        },
        dish_orange_pink_seafood: {
            file: macroPhoto('https://images.pexels.com/photos/17584591/pexels-photo-17584591.jpeg', [28,30,41,41]),
            fallbackFile: 'assets/appearance/foods/orange-pink-fish.webp',
            sourcePage: 'https://www.pexels.com/photo/salmon-on-plate-17584591/',
            label: '三文鱼橙粉鱼肉局部特写'
        },
        dish_silver_steamed_seafood: {
            file: macroPhoto('https://p8.itc.cn/q_70/images03/20221205/051814e508e146cdacfb81f05af2acaa.jpeg', [12,5,76,90]),
            fallbackFile: 'assets/appearance/foods/neutral-light-staple.webp',
            sourcePage: 'https://www.sohu.com/a/613719948_121608686',
            label: '清蒸鱼银灰鱼皮与白色鱼肉局部特写'
        },
        dish_pale_poultry: {
            file: macroPhoto('https://images.pexels.com/photos/30120279/pexels-photo-30120279.jpeg', [31,31,37,37]),
            fallbackFile: 'assets/appearance/foods/neutral-light-staple.webp',
            sourcePage: 'https://www.pexels.com/photo/hainanese-chicken-rice-with-fresh-vegetables-30120279/',
            label: '白切鸡浅色熟肉局部特写'
        },
        dish_green_vegetable: {
            file: macroPhoto('https://images.pexels.com/photos/36108993/pexels-photo-36108993.jpeg', [30,30,39,39]),
            fallbackFile: 'assets/appearance/foods/deep-green-leaves.webp',
            sourcePage: 'https://www.pexels.com/photo/delicious-stir-fried-chinese-vegetables-on-plate-36108993/',
            label: '炒青菜翠绿叶片局部特写'
        },
        dish_pale_tofu_mushroom: {
            file: macroPhoto('https://images.pexels.com/photos/5182122/pexels-photo-5182122.jpeg', [31,30,37,37]),
            fallbackFile: 'assets/appearance/foods/neutral-light-staple.webp',
            sourcePage: 'https://www.pexels.com/photo/food-on-a-plate-5182122/',
            label: '豆腐菌菇浅色表面局部特写'
        },
        dish_dark_sauce_mushroom: {
            file: macroPhoto('https://www.wokandkin.com/wp-content/uploads/2021/12/Black-Pepper-Beef-Close-Up-saved-for-web-1200px.png', [33,32,35,35]),
            fallbackFile: 'assets/appearance/foods/dark-brown-roasted.webp',
            sourcePage: 'https://www.wokandkin.com/black-pepper-beef-stir-fry/',
            label: '熟黑椒牛肉酱汁局部特写'
        },
        dish_multicolor_plating: {
            file: macroPhoto('https://images.pexels.com/photos/34664681/pexels-photo-34664681.png', [29,26,43,43]),
            fallbackFile: 'assets/appearance/foods/vivid-red-produce.webp',
            sourcePage: 'https://www.pexels.com/photo/colorful-fruit-platter-with-berries-and-kiwis-34664681/',
            label: '多色水果拼盘局部特写'
        },
        dish_soup_hotpot: {
            file: macroPhoto('https://ximg.retty.me/crop/s1440x1440/-/retty/img_ebisu/restaurant/100001734020/archive/3261891-65e6d1fb2111b.jpg', [29,29,43,43]),
            fallbackFile: 'assets/appearance/foods/red-brown-cooked-meat.webp',
            sourcePage: 'https://rotei-shinsaibashi.foodre.jp/',
            label: '沸腾红油火锅局部特写'
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
            label: visual ? visual.label : '完整菜式照片待补齐',
            origin: visual ? 'externally sourced macro food photograph with local fallback' : 'awaiting macro food photograph',
            file: visual ? visual.file : '',
            fallbackFile: visual ? visual.fallbackFile : '',
            sourcePage: visual ? visual.sourcePage : '',
            baseFilter: 'none',
            notes: visual
                ? '参考、优化前和优化后使用同一张食物局部特写；远程图片通过裁切端点统一为近景构图，网络不可用时显示本地参考图。'
                : '当前没有符合局部特写标准的照片；工程反射率模型仍可参与计算。'
        });
    }

    function diningMaterial(definition) {
        return deepFreeze({
            id: definition.id,
            name: definition.name,
            nameCN: definition.nameCN,
            category: 'food',
            targetHueZone: definition.targetHueZone,
            representativeDishesCN: definition.representativeDishesCN,
            intendedUse: definition.intendedUse,
            intendedUseCN: definition.intendedUseCN,
            appearanceSource: diningAppearance(definition.id),
            spectralSource: {
                type: 'engineering',
                label: '餐饮菜式工程参考曲线',
                notes: definition.notesCN,
                dataQualification: DATA_QUALIFICATION
            },
            dataQualification: DATA_QUALIFICATION,
            sourceType: 'engineering',
            sourceName: '餐饮菜式工程参考曲线',
            sourceUrl: '',
            sourceSample: '',
            reflectance: interpolateAnchors(definition.anchors),
            anchors: definition.anchors.map(function (pair) { return pair.slice(); })
        });
    }

    const materials = deepFreeze([
        diningMaterial({
            id: 'dish_red_braised_meat', name: 'Red-brown braised meat dish', nameCN: '红褐酱烧肉菜',
            targetHueZone: 'red-orange-brown', representativeDishesCN: '红烧肉、东坡肉、酱牛肉',
            intendedUse: 'red-brown braised meat, caramelised sauce and fat highlights',
            intendedUseCN: '用于红烧肉、东坡肉和酱牛肉的红褐色、焦糖色、油脂高光与暗部层次比较。',
            notesCN: '按酱烧熟肉短波低反射、黄红波段逐渐升高的典型特征构建。',
            anchors: [[380,0.035],[420,0.04],[460,0.05],[500,0.065],[540,0.09],[580,0.16],[620,0.29],[660,0.39],[700,0.43],[780,0.40]]
        }),
        diningMaterial({
            id: 'dish_red_chili_oil', name: 'Vivid red chili-oil dish', nameCN: '鲜红辣油菜式',
            targetHueZone: 'red-orange', representativeDishesCN: '水煮肉片、毛血旺、辣子鸡',
            intendedUse: 'red chili, red oil and saturated warm-colour dishes',
            intendedUseCN: '用于水煮肉片、毛血旺和辣子鸡的鲜红、橙红、辣椒红与红油透明感比较。',
            notesCN: '按红油菜式短波低反射、600 nm后快速升高并保留少量黄橙反射的特征构建。',
            anchors: [[380,0.025],[430,0.03],[480,0.038],[520,0.05],[560,0.09],[590,0.19],[620,0.43],[650,0.64],[700,0.69],[780,0.63]]
        }),
        diningMaterial({
            id: 'dish_golden_fried', name: 'Golden fried dish', nameCN: '金黄煎炸菜式',
            targetHueZone: 'yellow-orange-brown', representativeDishesCN: '炸鸡、锅包肉、煎猪排',
            intendedUse: 'golden fried crust, caramelisation and crisp texture',
            intendedUseCN: '用于炸鸡、锅包肉和煎猪排的金黄、棕黄、焦化表面与酥脆感比较。',
            notesCN: '按煎炸褐变表面短波较低、黄橙红波段逐步升高的特征构建。',
            anchors: [[380,0.05],[420,0.065],[460,0.095],[500,0.16],[540,0.28],[580,0.47],[620,0.61],[660,0.66],[700,0.64],[780,0.57]]
        }),
        diningMaterial({
            id: 'dish_dark_roasted_meat', name: 'Dark roasted meat dish', nameCN: '深褐烤制肉菜',
            targetHueZone: 'deep-red-brown', representativeDishesCN: '烧鹅、烤鸭、烤排骨',
            intendedUse: 'dark roasted skin, charred edge and specular highlights',
            intendedUseCN: '用于烧鹅、烤鸭和烤排骨的深红褐色、脆皮、焦边与反射高光比较。',
            notesCN: '按深度烤制肉类低反射、红棕波段缓慢上升并保留焦化暗部的特征构建。',
            anchors: [[380,0.018],[430,0.022],[480,0.03],[520,0.042],[560,0.065],[600,0.105],[640,0.18],[680,0.24],[720,0.27],[780,0.26]]
        }),
        diningMaterial({
            id: 'dish_orange_pink_seafood', name: 'Orange-pink seafood dish', nameCN: '橙粉鱼虾海鲜',
            targetHueZone: 'orange-red', representativeDishesCN: '三文鱼、烤虾、蟹肉',
            intendedUse: 'orange, pink and red seafood appearance',
            intendedUseCN: '用于三文鱼、烤虾和蟹肉的橙、粉、红色细微差异与新鲜感比较。',
            notesCN: '按橙粉鱼虾在黄红波段较高反射的典型特征构建。',
            anchors: [[380,0.045],[420,0.05],[460,0.065],[500,0.095],[540,0.18],[580,0.39],[620,0.58],[660,0.66],[700,0.64],[780,0.58]]
        }),
        diningMaterial({
            id: 'dish_silver_steamed_seafood', name: 'Silver-white steamed seafood dish', nameCN: '银白清蒸海鲜',
            targetHueZone: 'neutral-cool', representativeDishesCN: '清蒸鱼、扇贝、白灼虾',
            intendedUse: 'silver-white fish skin, pale flesh and translucent seafood',
            intendedUseCN: '用于清蒸鱼、扇贝和白灼虾的银白、浅灰、半透明感与轻微色偏比较。',
            notesCN: '按较高且平缓的可见光反射，叠加轻微冷灰倾向构建。',
            anchors: [[380,0.44],[420,0.50],[460,0.58],[500,0.63],[540,0.66],[580,0.67],[620,0.66],[660,0.65],[700,0.64],[780,0.61]]
        }),
        diningMaterial({
            id: 'dish_pale_poultry', name: 'Pale poultry dish', nameCN: '浅色肉类菜式',
            targetHueZone: 'neutral-warm-pink', representativeDishesCN: '白切鸡、盐焗鸡、清炖肉',
            intendedUse: 'pale poultry, subtle warm-yellow and pink doneness cues',
            intendedUseCN: '用于白切鸡、盐焗鸡和清炖肉的米白、浅黄、淡粉与熟度辨识比较。',
            notesCN: '按高反射浅暖肉类表面构建，保留黄红波段的轻微上升。',
            anchors: [[380,0.36],[420,0.43],[460,0.50],[500,0.56],[540,0.61],[580,0.66],[620,0.70],[660,0.72],[700,0.72],[780,0.68]]
        }),
        diningMaterial({
            id: 'dish_green_vegetable', name: 'Green vegetable dish', nameCN: '翠绿蔬菜菜式',
            targetHueZone: 'green', representativeDishesCN: '炒青菜、芦笋、西兰花',
            intendedUse: 'cooked green vegetables, leaf texture and freshness',
            intendedUseCN: '用于炒青菜、芦笋和西兰花的黄绿、翠绿、深绿与叶片新鲜感比较。',
            notesCN: '按叶绿素在蓝红波段吸收、绿色波段反射较高并保留熟制油光的特征构建。',
            anchors: [[380,0.035],[430,0.045],[470,0.06],[510,0.20],[545,0.37],[570,0.30],[600,0.12],[650,0.065],[690,0.10],[720,0.27],[780,0.34]]
        }),
        diningMaterial({
            id: 'dish_pale_tofu_mushroom', name: 'Pale tofu and mushroom dish', nameCN: '浅色豆腐菌菇菜',
            targetHueZone: 'neutral-warm', representativeDishesCN: '豆腐、竹荪、白蘑菇',
            intendedUse: 'pale tofu, white mushroom and subtle neutral differences',
            intendedUseCN: '用于豆腐、竹荪和白蘑菇菜式的白、米白、浅灰与细微综合色差比较。',
            notesCN: '按高反射、轻微暖灰倾向的豆腐和浅色菌菇表面构建。',
            anchors: [[380,0.50],[420,0.58],[460,0.65],[500,0.70],[540,0.73],[580,0.75],[620,0.76],[660,0.77],[700,0.77],[780,0.74]]
        }),
        diningMaterial({
            id: 'dish_dark_sauce_mushroom', name: 'Dark sauce and mushroom dish', nameCN: '深色菌菇酱汁菜',
            targetHueZone: 'dark-red-brown', representativeDishesCN: '黑椒牛肉、香菇煲、梅菜扣肉',
            intendedUse: 'dark sauce gloss, mushroom brown and shadow separation',
            intendedUseCN: '用于黑椒牛肉、香菇煲和梅菜扣肉的黑褐、深褐、酱汁光泽与暗部辨识比较。',
            notesCN: '按低反射深褐酱汁表面构建，并在红棕波段保留渐升结构。',
            anchors: [[380,0.012],[430,0.015],[480,0.020],[520,0.027],[560,0.039],[600,0.060],[640,0.088],[680,0.112],[720,0.126],[780,0.128]]
        }),
        diningMaterial({
            id: 'dish_multicolor_plating', name: 'Multicolour plated dish', nameCN: '多色综合摆盘',
            targetHueZone: 'multicolour-balanced', representativeDishesCN: '多色水果拼盘、水果拼盘、精致果盘',
            intendedUse: 'balanced presentation of red, yellow, green, orange and purple fruit components',
            intendedUseCN: '用于多色水果拼盘中红、黄、绿、橙、紫等综合色彩的平衡比较。',
            notesCN: '综合色谱用于水果拼盘整体色彩平衡观察，采用红黄绿橙紫区域的工程加权结果。',
            anchors: [[380,0.12],[420,0.14],[460,0.16],[500,0.22],[540,0.30],[580,0.36],[620,0.42],[660,0.46],[700,0.47],[780,0.44]]
        }),
        diningMaterial({
            id: 'dish_soup_hotpot', name: 'Soup and hotpot dish', nameCN: '汤锅与浓汤菜式',
            targetHueZone: 'warm-multicolour', representativeDishesCN: '火锅、酸菜鱼、番茄锅、奶白鱼汤',
            intendedUse: 'broth colour, oil layer, mixed ingredients and steam atmosphere',
            intendedUseCN: '用于火锅、酸菜鱼、番茄锅和奶白鱼汤的汤色、油层、食材综合色彩与蒸汽氛围比较。',
            notesCN: '按暖色汤底、油层高光与多食材综合色彩的工程平均特征构建。',
            anchors: [[380,0.08],[420,0.09],[460,0.11],[500,0.15],[540,0.21],[580,0.31],[620,0.44],[660,0.51],[700,0.52],[780,0.48]]
        })
    ]);

    const materialIds = Object.freeze(materials.map(function (item) { return item.id; }));
    const baseImportance = deepFreeze({
        dish_red_braised_meat:1.35, dish_red_chili_oil:1.35, dish_golden_fried:1.2,
        dish_dark_roasted_meat:1.25, dish_orange_pink_seafood:1.25,
        dish_silver_steamed_seafood:1.35, dish_pale_poultry:1.3,
        dish_green_vegetable:1.25, dish_pale_tofu_mushroom:1.4,
        dish_dark_sauce_mushroom:1.1, dish_multicolor_plating:1.15, dish_soup_hotpot:1.2
    });
    const baseTargets = deepFreeze({
        dish_red_braised_meat:{targetDeltaC:4.8,maxDeltaE00:8.5},
        dish_red_chili_oil:{targetDeltaC:6.0,maxDeltaE00:9},
        dish_golden_fried:{targetDeltaC:4.5,maxDeltaE00:8},
        dish_dark_roasted_meat:{targetDeltaC:3.5,maxDeltaE00:7},
        dish_orange_pink_seafood:{targetDeltaC:4.2,maxDeltaE00:8},
        dish_silver_steamed_seafood:{targetDeltaC:0.2,maxDeltaE00:3.6,maxAbsDeltaH:2},
        dish_pale_poultry:{targetDeltaC:0.5,maxDeltaE00:4,maxAbsDeltaH:2.2},
        dish_green_vegetable:{targetDeltaC:3.8,maxDeltaE00:7.5},
        dish_pale_tofu_mushroom:{targetDeltaC:0.2,maxDeltaE00:3.5,maxAbsDeltaH:2},
        dish_dark_sauce_mushroom:{targetDeltaC:2.8,maxDeltaE00:6.5},
        dish_multicolor_plating:{targetDeltaC:3.0,maxDeltaE00:7},
        dish_soup_hotpot:{targetDeltaC:3.5,maxDeltaE00:8}
    });

    function targets(entries) {
        return entries.reduce(function (map, entry) {
            map[entry[0]] = entry[1];
            return map;
        }, {});
    }

    function scene(definition) {
        const importance = Object.assign({}, baseImportance, definition.importanceByMaterialId || {});
        const sceneTargets = {};
        materialIds.forEach(function (id) {
            sceneTargets[id] = Object.assign({}, baseTargets[id], definition.targetsByMaterialId && definition.targetsByMaterialId[id]);
        });
        return deepFreeze(Object.assign({}, definition, {
            materialIds: materialIds.slice(),
            cctRange: definition.cctRange.slice(),
            importanceByMaterialId: importance,
            targetsByMaterialId: sceneTargets
        }));
    }

    const profiles = deepFreeze([
        scene({
            id:'balanced_dining', nameCN:'综合餐饮', descriptionCN:'兼顾酱烧、煎炸、海鲜、蔬菜、浅色和深色菜式。',
            recommendedCct:3500, cctRange:[3000,4000], recommendedDuv:0, cameraProxy:false,
            noteCN:'以自然白点为基础，保持综合色彩平衡。'
        }),
        scene({
            id:'hotpot_barbecue', nameCN:'火锅烧烤', descriptionCN:'提高红油、酱烧、烤制与汤锅菜式的食欲感，并用浅色菜式控制偏色。',
            recommendedCct:3000, cctRange:[2700,3500], recommendedDuv:-0.0005, cameraProxy:false,
            noteCN:'红橙区域权重较高。',
            importanceByMaterialId:{dish_red_chili_oil:1.75,dish_red_braised_meat:1.6,dish_dark_roasted_meat:1.5,dish_soup_hotpot:1.55,dish_pale_tofu_mushroom:1.35},
            targetsByMaterialId:targets([
                ['dish_red_chili_oil',{targetDeltaC:6.7}],['dish_red_braised_meat',{targetDeltaC:5.5}],
                ['dish_dark_roasted_meat',{targetDeltaC:4.2}],['dish_soup_hotpot',{targetDeltaC:4.5}]
            ])
        }),
        scene({
            id:'japanese_seafood', nameCN:'日料海鲜', descriptionCN:'强调橙粉海鲜、银白海鲜、绿色配菜和浅色菜式的新鲜感与洁净感。',
            recommendedCct:4000, cctRange:[3500,4000], recommendedDuv:0, cameraProxy:false,
            noteCN:'控制黄红泛化，保持浅色菜式干净。',
            importanceByMaterialId:{dish_orange_pink_seafood:1.75,dish_silver_steamed_seafood:1.65,dish_green_vegetable:1.3,dish_pale_tofu_mushroom:1.55,dish_multicolor_plating:1.25},
            targetsByMaterialId:targets([
                ['dish_orange_pink_seafood',{targetDeltaC:4.6}],['dish_green_vegetable',{targetDeltaC:2.9}],
                ['dish_silver_steamed_seafood',{targetDeltaC:0,maxDeltaE00:3.2,maxAbsDeltaH:1.8}],
                ['dish_pale_tofu_mushroom',{targetDeltaC:0,maxDeltaE00:3.2,maxAbsDeltaH:1.8}]
            ])
        }),
        scene({
            id:'bakery_coffee', nameCN:'金黄烤制与休闲餐饮', descriptionCN:'突出金黄煎炸、深褐烤制和深色酱汁菜式的焦化层次。',
            recommendedCct:3000, cctRange:[2700,3500], recommendedDuv:0, cameraProxy:false,
            noteCN:'黄橙棕区域适度增强。',
            importanceByMaterialId:{dish_golden_fried:1.75,dish_dark_roasted_meat:1.55,dish_dark_sauce_mushroom:1.45,dish_pale_poultry:1.3},
            targetsByMaterialId:targets([
                ['dish_golden_fried',{targetDeltaC:5.4}],['dish_dark_roasted_meat',{targetDeltaC:4.2}],
                ['dish_dark_sauce_mushroom',{targetDeltaC:3.3}]
            ])
        }),
        scene({
            id:'fine_dining', nameCN:'高端晚餐', descriptionCN:'在暖色氛围中兼顾酱烧、海鲜、烤制、浅色和多色综合摆盘。',
            recommendedCct:2700, cctRange:[2700,3000], recommendedDuv:0, cameraProxy:false,
            noteCN:'彩度目标较克制，浅色菜式权重较高。',
            importanceByMaterialId:{dish_red_braised_meat:1.45,dish_dark_roasted_meat:1.35,dish_orange_pink_seafood:1.3,dish_pale_poultry:1.5,dish_pale_tofu_mushroom:1.5,dish_multicolor_plating:1.35},
            targetsByMaterialId:targets([
                ['dish_red_braised_meat',{targetDeltaC:4}],['dish_dark_roasted_meat',{targetDeltaC:3.2}],
                ['dish_orange_pink_seafood',{targetDeltaC:3.5}],['dish_multicolor_plating',{targetDeltaC:2.5}]
            ])
        }),
        scene({
            id:'bar_atmosphere', nameCN:'酒吧氛围', descriptionCN:'突出深色酱汁、烤制和红褐菜式的暖色质感，并保留浅色菜式识别。',
            recommendedCct:2700, cctRange:[2700,3000], recommendedDuv:0, cameraProxy:false,
            noteCN:'适合暖色低照度氛围。',
            importanceByMaterialId:{dish_dark_sauce_mushroom:1.65,dish_dark_roasted_meat:1.5,dish_red_braised_meat:1.4,dish_red_chili_oil:1.25,dish_pale_poultry:1.35},
            targetsByMaterialId:targets([
                ['dish_dark_sauce_mushroom',{targetDeltaC:3.3}],['dish_dark_roasted_meat',{targetDeltaC:3.8}],
                ['dish_red_braised_meat',{targetDeltaC:4}],['dish_red_chili_oil',{targetDeltaC:4.5}]
            ])
        }),
        scene({
            id:'camera_friendly', nameCN:'拍照友好', descriptionCN:'平衡菜式彩度与浅色菜式中性表现，降低手机自动白平衡下的偏红偏黄风险。',
            recommendedCct:4000, cctRange:[3500,4000], recommendedDuv:0, cameraProxy:true,
            noteCN:'这是面向手机拍照的工程代理模型，不模拟具体相机传感器、色彩矩阵或自动白平衡算法。',
            importanceByMaterialId:{dish_silver_steamed_seafood:1.7,dish_pale_poultry:1.6,dish_pale_tofu_mushroom:1.7,dish_multicolor_plating:1.4},
            targetsByMaterialId:targets([
                ['dish_silver_steamed_seafood',{targetDeltaC:0,maxAbsDeltaH:1.5,maxDeltaE00:2.8}],
                ['dish_pale_poultry',{targetDeltaC:0.2,maxAbsDeltaH:1.8,maxDeltaE00:3.2}],
                ['dish_pale_tofu_mushroom',{targetDeltaC:0,maxAbsDeltaH:1.5,maxDeltaE00:2.8}],
                ['dish_multicolor_plating',{targetDeltaC:2.8}]
            ])
        })
    ]);

    function uniqueIds(ids) {
        return ids.filter(function (id, index) { return ids.indexOf(id) === index; });
    }

    function cuisine(definition) {
        const dishTypeIds = uniqueIds(definition.high.concat(definition.controls || []));
        const importance = {};
        const cuisineTargets = {};
        const lighting = profiles.find(function (profile) {
            return profile.id === definition.recommendedSceneProfileId;
        }) || profiles[0];
        definition.high.forEach(function (id) {
            importance[id] = 1.38;
            cuisineTargets[id] = Object.assign({}, baseTargets[id], {
                targetDeltaC: clamp((baseTargets[id].targetDeltaC || 0) + 0.5, 0, 12)
            });
        });
        (definition.controls || []).forEach(function (id) {
            importance[id] = 1.28;
            cuisineTargets[id] = Object.assign({}, baseTargets[id], {
                targetDeltaC: 0,
                maxAbsDeltaH: Math.min(Number(baseTargets[id].maxAbsDeltaH) || 2.2, 2.2),
                maxDeltaE00: Math.min(Number(baseTargets[id].maxDeltaE00) || 4, 4)
            });
        });
        return deepFreeze({
            id: definition.id,
            nameCN: definition.nameCN,
            descriptionCN: definition.descriptionCN,
            dishTypeIds,
            importanceByDishTypeId: importance,
            targetsByDishTypeId: cuisineTargets,
            recommendedCct: lighting.recommendedCct,
            cctRange: lighting.cctRange.slice(),
            recommendedDuv: lighting.recommendedDuv,
            cameraProxy: lighting.cameraProxy,
            noteCN: lighting.noteCN
        });
    }

    const cuisines = deepFreeze([
        cuisine({id:'comprehensive',nameCN:'综合餐饮',descriptionCN:'覆盖全部12类菜式视觉类型。',high:materialIds.slice(),controls:PALE_CONTROL_IDS,recommendedSceneProfileId:'balanced_dining'}),
        cuisine({id:'sichuan_hunan',nameCN:'川湘菜',descriptionCN:'突出红油、酱烧、深色酱汁、绿色菜式和汤锅。',high:['dish_red_chili_oil','dish_red_braised_meat','dish_dark_sauce_mushroom','dish_green_vegetable','dish_soup_hotpot'],controls:['dish_pale_tofu_mushroom'],recommendedSceneProfileId:'hotpot_barbecue'}),
        cuisine({id:'cantonese',nameCN:'粤菜',descriptionCN:'关注烤制、清蒸海鲜、浅色肉类、绿色菜式和豆腐菌菇。',high:['dish_dark_roasted_meat','dish_silver_steamed_seafood','dish_pale_poultry','dish_green_vegetable','dish_pale_tofu_mushroom'],controls:['dish_silver_steamed_seafood','dish_pale_poultry'],recommendedSceneProfileId:'balanced_dining'}),
        cuisine({id:'jiangzhe_huaiyang',nameCN:'江浙淮扬菜',descriptionCN:'关注酱烧、清蒸、浅色肉类、豆腐菌菇和精致摆盘。',high:['dish_red_braised_meat','dish_silver_steamed_seafood','dish_pale_poultry','dish_pale_tofu_mushroom','dish_multicolor_plating'],controls:['dish_silver_steamed_seafood','dish_pale_tofu_mushroom'],recommendedSceneProfileId:'fine_dining'}),
        cuisine({id:'shandong',nameCN:'鲁菜',descriptionCN:'覆盖酱烧、煎炸、烤制、清蒸海鲜和汤锅。',high:['dish_red_braised_meat','dish_golden_fried','dish_dark_roasted_meat','dish_silver_steamed_seafood','dish_soup_hotpot'],controls:['dish_silver_steamed_seafood'],recommendedSceneProfileId:'balanced_dining'}),
        cuisine({id:'fujian',nameCN:'闽菜',descriptionCN:'关注清蒸海鲜、橙粉海鲜、浅色肉类、豆腐菌菇和汤菜。',high:['dish_silver_steamed_seafood','dish_orange_pink_seafood','dish_pale_poultry','dish_pale_tofu_mushroom','dish_soup_hotpot'],controls:['dish_silver_steamed_seafood','dish_pale_tofu_mushroom'],recommendedSceneProfileId:'balanced_dining'}),
        cuisine({id:'anhui',nameCN:'徽菜',descriptionCN:'关注酱烧、深色酱汁、烤制、绿色菜式和汤锅。',high:['dish_red_braised_meat','dish_dark_sauce_mushroom','dish_dark_roasted_meat','dish_green_vegetable','dish_soup_hotpot'],controls:['dish_pale_tofu_mushroom'],recommendedSceneProfileId:'fine_dining'}),
        cuisine({id:'beijing',nameCN:'京菜',descriptionCN:'关注烤制、煎炸、酱烧、浅色肉类和拼盘。',high:['dish_dark_roasted_meat','dish_golden_fried','dish_red_braised_meat','dish_pale_poultry','dish_multicolor_plating'],controls:['dish_pale_poultry'],recommendedSceneProfileId:'balanced_dining'}),
        cuisine({id:'northeast',nameCN:'东北菜',descriptionCN:'覆盖酱烧、煎炸、深色酱汁、汤锅和绿色菜式。',high:['dish_red_braised_meat','dish_golden_fried','dish_dark_sauce_mushroom','dish_soup_hotpot','dish_green_vegetable'],controls:['dish_pale_tofu_mushroom'],recommendedSceneProfileId:'hotpot_barbecue'}),
        cuisine({id:'northwest',nameCN:'西北菜',descriptionCN:'关注煎炸、烤制、酱烧、汤锅和浅色肉类。',high:['dish_golden_fried','dish_dark_roasted_meat','dish_red_braised_meat','dish_soup_hotpot','dish_pale_poultry'],controls:['dish_pale_poultry'],recommendedSceneProfileId:'hotpot_barbecue'}),
        cuisine({id:'yunnan_guizhou',nameCN:'云贵菜',descriptionCN:'关注红油、汤锅、绿色菜式、清蒸海鲜和多色综合摆盘。',high:['dish_red_chili_oil','dish_soup_hotpot','dish_green_vegetable','dish_silver_steamed_seafood','dish_multicolor_plating'],controls:['dish_silver_steamed_seafood','dish_pale_tofu_mushroom'],recommendedSceneProfileId:'hotpot_barbecue'}),
        cuisine({id:'japanese',nameCN:'日料',descriptionCN:'关注橙粉海鲜、银白海鲜、绿色菜式、豆腐菌菇和精致摆盘。',high:['dish_orange_pink_seafood','dish_silver_steamed_seafood','dish_green_vegetable','dish_pale_tofu_mushroom','dish_multicolor_plating'],controls:['dish_silver_steamed_seafood','dish_pale_tofu_mushroom'],recommendedSceneProfileId:'japanese_seafood'}),
        cuisine({id:'korean',nameCN:'韩餐',descriptionCN:'关注红油、烤制、绿色菜式、综合色摆盘和汤锅。',high:['dish_red_chili_oil','dish_dark_roasted_meat','dish_green_vegetable','dish_multicolor_plating','dish_soup_hotpot'],controls:['dish_pale_tofu_mushroom'],recommendedSceneProfileId:'hotpot_barbecue'}),
        cuisine({id:'southeast_asian',nameCN:'东南亚菜',descriptionCN:'关注海鲜、红油、绿色菜式、汤锅、浅色肉类和多彩摆盘。',high:['dish_orange_pink_seafood','dish_red_chili_oil','dish_green_vegetable','dish_soup_hotpot','dish_pale_poultry','dish_multicolor_plating'],controls:['dish_pale_poultry'],recommendedSceneProfileId:'camera_friendly'}),
        cuisine({id:'western',nameCN:'西餐',descriptionCN:'关注烤制、煎炸、海鲜、绿色菜式和多色综合摆盘。',high:['dish_dark_roasted_meat','dish_golden_fried','dish_orange_pink_seafood','dish_green_vegetable','dish_multicolor_plating'],controls:['dish_pale_tofu_mushroom'],recommendedSceneProfileId:'fine_dining'}),
        cuisine({id:'barbecue',nameCN:'烧烤',descriptionCN:'关注烤制、煎炸、酱烧、红油和绿色配菜。',high:['dish_dark_roasted_meat','dish_golden_fried','dish_red_braised_meat','dish_red_chili_oil','dish_green_vegetable'],controls:['dish_pale_poultry'],recommendedSceneProfileId:'hotpot_barbecue'}),
        cuisine({id:'hotpot',nameCN:'火锅',descriptionCN:'关注汤锅、红油、酱烧、海鲜和绿色菜式。',high:['dish_soup_hotpot','dish_red_chili_oil','dish_red_braised_meat','dish_orange_pink_seafood','dish_green_vegetable'],controls:['dish_pale_tofu_mushroom'],recommendedSceneProfileId:'hotpot_barbecue'})
    ]);

    const materialsById = Object.freeze(Object.fromEntries(materials.map(function (item) { return [item.id, item]; })));
    const cuisinesById = Object.freeze(Object.fromEntries(cuisines.map(function (item) { return [item.id, item]; })));

    function migrateTemplateId(id) { return LEGACY_TEMPLATE_IDS[id] || id; }
    function listMaterials() { return materials.slice(); }
    function getMaterial(id) { return materialsById[migrateTemplateId(id)] || null; }
    function listCuisineProfiles() { return cuisines.slice(); }
    function getCuisineProfile(id) { return cuisinesById[id] || null; }

    function resolveMaterialIds(cuisineId) {
        const cuisineProfile = getCuisineProfile(cuisineId || 'comprehensive');
        return cuisineProfile ? cuisineProfile.dishTypeIds.slice() : [];
    }

    function profileOverrides(cuisineId, requestedLevel) {
        const selectedCuisineId = cuisineId || 'comprehensive';
        const selectedLevel = Object.prototype.hasOwnProperty.call(LEVEL_SCALE, requestedLevel)
            ? requestedLevel : 'recommended';
        const cuisineProfile = getCuisineProfile(selectedCuisineId);
        if (!cuisineProfile) return {};
        const scale = LEVEL_SCALE[selectedLevel];
        const result = {};
        resolveMaterialIds(selectedCuisineId).forEach(function (materialId) {
            const target = Object.assign({}, baseTargets[materialId], cuisineProfile.targetsByDishTypeId[materialId] || {});
            const levelValues = {};
            if (Number.isFinite(target.targetDeltaC)) levelValues.targetDeltaC = clamp(target.targetDeltaC * scale, -5, 12);
            ['targetDeltaH','targetDeltaL','maxAbsDeltaH','maxAbsDeltaL','maxDeltaE00'].forEach(function (field) {
                if (Number.isFinite(target[field])) levelValues[field] = target[field];
            });
            result[materialId] = {
                importance: clamp(
                    Number(baseImportance[materialId] || 1) *
                    Number(cuisineProfile.importanceByDishTypeId[materialId] || 1),
                    0.6,
                    3
                ),
                levels: { [selectedLevel]: levelValues }
            };
        });
        return result;
    }

    return Object.freeze({
        wavelengths,
        dataQualification: DATA_QUALIFICATION,
        paleControlIds: PALE_CONTROL_IDS,
        legacyTemplateIds: LEGACY_TEMPLATE_IDS,
        materials,
        materialsById,
        cuisineProfiles: cuisines,
        cuisineProfilesById: cuisinesById,
        listMaterials,
        getMaterial,
        listCuisineProfiles,
        getCuisineProfile,
        resolveMaterialIds,
        profileOverrides,
        migrateTemplateId
    });
});
