(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) root.MuseumLightData = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    const wavelengths = Object.freeze(Array.from({ length: 81 }, function (_, index) {
        return 380 + index * 5;
    }));
    const DATA_QUALIFICATION = '工程反射率模型，用于算法验证，不代表真实文物实测数据。';
    const STRENGTH_SCALE = Object.freeze({ soft: 0.72, recommended: 1, strong: 1.24 });

    function clamp(value, min, max) {
        return Math.max(min, Math.min(max, Number(value)));
    }

    function deepFreeze(value) {
        if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
        Object.keys(value).forEach(function (key) { deepFreeze(value[key]); });
        return Object.freeze(value);
    }

    function interpolateAnchors(anchors) {
        const sorted = anchors.slice().sort(function (left, right) { return left[0] - right[0]; });
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

    function sample(definition) {
        const sourceName = definition.sourceName || '博物馆展品工程反射率模型';
        return deepFreeze({
            id: definition.id,
            name: definition.name,
            nameCN: definition.nameCN,
            category: definition.category || 'museum',
            targetHueZone: definition.targetHueZone,
            colourRoleCN: definition.colourRoleCN,
            weight: definition.weight,
            allowedDeltaE00: definition.allowedDeltaE00,
            allowedDeltaH: definition.allowedDeltaH,
            targetDeltaC: definition.targetDeltaC,
            dataQualification: DATA_QUALIFICATION,
            sourceType: 'engineering',
            sourceName,
            spectralSource: {
                type: 'engineering',
                label: sourceName,
                dataQualification: DATA_QUALIFICATION
            },
            anchors: definition.anchors.map(function (pair) { return pair.slice(); }),
            reflectance: interpolateAnchors(definition.anchors)
        });
    }

    const samples = deepFreeze([
        sample({
            id: 'glaze_white', name: 'Glaze white', nameCN: '釉面白', category: 'museum-ceramic', targetHueZone: 'neutral-white',
            colourRoleCN: '控制瓷胎与透明釉面的洁净度，监测偏黄、偏绿、偏红和白度变化。',
            weight: 1.7, allowedDeltaE00: 2.2, allowedDeltaH: 3, targetDeltaC: 0,
            sourceName: '青花瓷工程反射率模型',
            anchors: [[380,0.66],[420,0.76],[460,0.83],[500,0.87],[540,0.89],[580,0.90],[620,0.90],[660,0.89],[700,0.88],[780,0.84]]
        }),
        sample({
            id: 'cobalt_light', name: 'Light cobalt blue', nameCN: '钴蓝浅色', category: 'museum-ceramic', targetHueZone: 'blue',
            colourRoleCN: '观察浅蓝纹样的纯净度、色相稳定和细节辨识。',
            weight: 1.45, allowedDeltaE00: 4.2, allowedDeltaH: 3, targetDeltaC: 1.2,
            sourceName: '青花瓷工程反射率模型',
            anchors: [[380,0.24],[420,0.42],[460,0.54],[485,0.47],[520,0.28],[560,0.18],[600,0.12],[650,0.10],[700,0.11],[780,0.13]]
        }),
        sample({
            id: 'cobalt_deep', name: 'Deep cobalt blue', nameCN: '钴蓝深色', category: 'museum-ceramic', targetHueZone: 'deep-blue',
            colourRoleCN: '观察深蓝纹样、积料区域和暗部纹样的层次。',
            weight: 1.5, allowedDeltaE00: 4.5, allowedDeltaH: 3, targetDeltaC: 1,
            sourceName: '青花瓷工程反射率模型',
            anchors: [[380,0.08],[420,0.20],[460,0.31],[485,0.25],[520,0.12],[560,0.065],[600,0.04],[650,0.032],[700,0.035],[780,0.045]]
        }),
        sample({
            id: 'blue_white_transition', name: 'Blue-white transition', nameCN: '蓝白过渡区域', category: 'museum-ceramic', targetHueZone: 'blue-white',
            colourRoleCN: '观察青花晕散、浓淡变化与白瓷之间的过渡层次。',
            weight: 1.55, allowedDeltaE00: 3.5, allowedDeltaH: 3.2, targetDeltaC: 0.7,
            sourceName: '青花瓷工程反射率模型',
            anchors: [[380,0.45],[420,0.59],[460,0.67],[500,0.61],[540,0.51],[580,0.45],[620,0.42],[660,0.41],[700,0.42],[780,0.43]]
        }),
        sample({
            id: 'glaze_shadow', name: 'Glaze shadow', nameCN: '釉面阴影', category: 'museum-ceramic', targetHueZone: 'cool-neutral',
            colourRoleCN: '检查白瓷曲面阴影、釉面厚薄和低亮区域是否保留层次。',
            weight: 1.25, allowedDeltaE00: 3, allowedDeltaH: 3.5, targetDeltaC: 0,
            sourceName: '青花瓷工程反射率模型',
            anchors: [[380,0.27],[420,0.34],[460,0.39],[500,0.40],[540,0.39],[580,0.38],[620,0.37],[660,0.36],[700,0.35],[780,0.33]]
        }),
        sample({
            id: 'neutral_control', name: 'Neutral control', nameCN: '中性控制样本', category: 'museum-ceramic', targetHueZone: 'neutral',
            colourRoleCN: '控制综合色谱偏移，防止通过单一窄波段制造异常色彩表现。',
            weight: 1.15, allowedDeltaE00: 2.8, allowedDeltaH: 4, targetDeltaC: 0,
            sourceName: '青花瓷工程反射率模型',
            anchors: [[380,0.43],[420,0.45],[460,0.46],[500,0.47],[540,0.48],[580,0.48],[620,0.48],[660,0.47],[700,0.46],[780,0.44]]
        }),
        sample({
            id: 'paper_warm', name: 'Warm paper', nameCN: '暖色纸张底色', category: 'museum-ink-painting', targetHueZone: 'warm-neutral',
            colourRoleCN: '控制纸本底色、旧化暖调和整体白点，避免纸张偏绿、偏灰或过度增黄。',
            weight: 1.7, allowedDeltaE00: 2, allowedDeltaH: 3.5, targetDeltaC: 0,
            sourceName: '纸本水墨工程反射率模型',
            anchors: [[380,0.58],[420,0.68],[460,0.74],[500,0.78],[540,0.81],[580,0.84],[620,0.86],[660,0.87],[700,0.87],[780,0.84]]
        }),
        sample({
            id: 'ink_light', name: 'Light ink', nameCN: '淡墨', category: 'museum-ink-painting', targetHueZone: 'light-neutral',
            colourRoleCN: '观察淡墨、细线和水分晕染区域在低照度下是否仍能从纸张底色中分离。',
            weight: 1.45, allowedDeltaE00: 3.2, allowedDeltaH: 4, targetDeltaC: 0,
            sourceName: '纸本水墨工程反射率模型',
            anchors: [[380,0.34],[420,0.36],[460,0.38],[500,0.40],[540,0.41],[580,0.42],[620,0.43],[660,0.44],[700,0.44],[780,0.42]]
        }),
        sample({
            id: 'ink_mid', name: 'Mid ink', nameCN: '中墨', category: 'museum-ink-painting', targetHueZone: 'mid-neutral',
            colourRoleCN: '观察中等墨色、叶片和枝干笔触的灰阶层次，避免浓淡关系被压平。',
            weight: 1.5, allowedDeltaE00: 3.4, allowedDeltaH: 4, targetDeltaC: 0,
            sourceName: '纸本水墨工程反射率模型',
            anchors: [[380,0.16],[420,0.18],[460,0.19],[500,0.20],[540,0.21],[580,0.22],[620,0.23],[660,0.24],[700,0.24],[780,0.23]]
        }),
        sample({
            id: 'ink_deep', name: 'Deep ink', nameCN: '浓墨', category: 'museum-ink-painting', targetHueZone: 'deep-neutral',
            colourRoleCN: '观察浓墨、暗线和重墨积染区域的细节，避免低照度下暗部合并。',
            weight: 1.5, allowedDeltaE00: 3.8, allowedDeltaH: 4.2, targetDeltaC: 0,
            sourceName: '纸本水墨工程反射率模型',
            anchors: [[380,0.035],[420,0.040],[460,0.045],[500,0.050],[540,0.055],[580,0.060],[620,0.065],[660,0.070],[700,0.070],[780,0.065]]
        }),
        sample({
            id: 'seal_red', name: 'Seal red', nameCN: '印章红', category: 'museum-ink-painting', targetHueZone: 'red',
            colourRoleCN: '控制印章朱红的色相和辨识度，避免提高灰阶层次时出现偏橙、偏紫或过饱和。',
            weight: 1.35, allowedDeltaE00: 4, allowedDeltaH: 3, targetDeltaC: 0.8,
            sourceName: '纸本水墨工程反射率模型',
            anchors: [[380,0.08],[420,0.07],[460,0.06],[500,0.055],[540,0.07],[580,0.18],[620,0.46],[660,0.58],[700,0.50],[780,0.28]]
        }),
        sample({
            id: 'paper_shadow', name: 'Paper shadow', nameCN: '纸张阴影与折痕', category: 'museum-ink-painting', targetHueZone: 'warm-shadow',
            colourRoleCN: '观察纸张折痕、起伏和旧化阴影，控制低亮区域的暖调与明度层次。',
            weight: 1.2, allowedDeltaE00: 3, allowedDeltaH: 4, targetDeltaC: 0,
            sourceName: '纸本水墨工程反射率模型',
            anchors: [[380,0.27],[420,0.30],[460,0.33],[500,0.35],[540,0.37],[580,0.39],[620,0.41],[660,0.42],[700,0.42],[780,0.40]]
        }),
        sample({
            id: 'bronze_base', name: 'Bronze base', nameCN: '青铜金属本色', category: 'museum-bronze', targetHueZone: 'warm-brown',
            colourRoleCN: '控制青铜器主体的棕褐金属色，观察铜色是否偏红、偏黄或失去沉稳感。',
            weight: 1.6, allowedDeltaE00: 3.2, allowedDeltaH: 3.8, targetDeltaC: 0.3,
            sourceName: '青铜器工程反射率模型',
            anchors: [[380,0.07],[420,0.075],[460,0.08],[500,0.09],[540,0.11],[580,0.15],[620,0.20],[660,0.24],[700,0.25],[780,0.23]]
        }),
        sample({
            id: 'patina_green', name: 'Green patina', nameCN: '铜绿', category: 'museum-bronze', targetHueZone: 'green-cyan',
            colourRoleCN: '观察铜绿覆盖区域与金属本色的分离，并控制绿色向蓝色或黄色方向的偏移。',
            weight: 1.55, allowedDeltaE00: 4.2, allowedDeltaH: 3.5, targetDeltaC: 0.8,
            sourceName: '青铜器工程反射率模型',
            anchors: [[380,0.08],[420,0.11],[460,0.16],[500,0.24],[520,0.29],[550,0.27],[580,0.20],[620,0.13],[680,0.09],[780,0.08]]
        }),
        sample({
            id: 'patina_light', name: 'Light patina', nameCN: '浅色铜绿', category: 'museum-bronze', targetHueZone: 'light-cyan-green',
            colourRoleCN: '观察浅色铜绿、粉化区域和表面沉积物的层次，避免与深铜绿合并。',
            weight: 1.4, allowedDeltaE00: 4.4, allowedDeltaH: 3.8, targetDeltaC: 0.9,
            sourceName: '青铜器工程反射率模型',
            anchors: [[380,0.15],[420,0.20],[460,0.29],[500,0.39],[520,0.44],[550,0.41],[580,0.32],[620,0.22],[680,0.16],[780,0.14]]
        }),
        sample({
            id: 'bronze_highlight', name: 'Bronze highlight', nameCN: '青铜高光', category: 'museum-bronze', targetHueZone: 'warm-metal-highlight',
            colourRoleCN: '观察磨蚀凸起、金属高光和局部暖色反射，控制高光区域的综合色相。',
            weight: 1.35, allowedDeltaE00: 3.8, allowedDeltaH: 3.5, targetDeltaC: 0.6,
            sourceName: '青铜器工程反射率模型',
            anchors: [[380,0.12],[420,0.13],[460,0.14],[500,0.16],[540,0.20],[580,0.28],[620,0.38],[660,0.46],[700,0.48],[780,0.44]]
        }),
        sample({
            id: 'relief_recess', name: 'Relief recess', nameCN: '纹饰凹槽暗部', category: 'museum-bronze', targetHueZone: 'deep-neutral-brown',
            colourRoleCN: '观察兽面纹、雷纹与铭文凹槽的暗部细节，避免低照度下纹饰结构合并。',
            weight: 1.5, allowedDeltaE00: 3.8, allowedDeltaH: 4.2, targetDeltaC: 0,
            sourceName: '青铜器工程反射率模型',
            anchors: [[380,0.025],[420,0.028],[460,0.030],[500,0.034],[540,0.039],[580,0.045],[620,0.052],[660,0.058],[700,0.060],[780,0.055]]
        }),
        sample({
            id: 'bronze_shadow', name: 'Bronze shadow', nameCN: '青铜阴影', category: 'museum-bronze', targetHueZone: 'neutral-shadow',
            colourRoleCN: '控制器物曲面、内壁和底部阴影的明度与综合色调，保持主体体积和轮廓。',
            weight: 1.2, allowedDeltaE00: 3.2, allowedDeltaH: 4.2, targetDeltaC: 0,
            sourceName: '青铜器工程反射率模型',
            anchors: [[380,0.055],[420,0.060],[460,0.066],[500,0.073],[540,0.082],[580,0.094],[620,0.108],[660,0.118],[700,0.120],[780,0.112]]
        }),
        sample({
            id: 'jade_body', name: 'Qingbai jade body', nameCN: '青白玉主体', category: 'museum-jade', targetHueZone: 'pale-green-white',
            colourRoleCN: '控制玉器主体的青白综合色调、温润感和整体明度，避免偏黄、偏灰或偏绿。',
            weight: 1.7, allowedDeltaE00: 2.4, allowedDeltaH: 3.2, targetDeltaC: 0,
            sourceName: '青白玉工程反射率模型',
            anchors: [[380,0.57],[420,0.66],[460,0.72],[500,0.77],[530,0.80],[560,0.79],[600,0.76],[640,0.73],[700,0.70],[780,0.66]]
        }),
        sample({
            id: 'jade_milky_light', name: 'Milky jade light', nameCN: '乳白浅色区', category: 'museum-jade', targetHueZone: 'milky-white',
            colourRoleCN: '观察乳白浅色区域与青白玉主体之间的细微层次，并控制高明度区域的综合色相。',
            weight: 1.45, allowedDeltaE00: 3.2, allowedDeltaH: 3.5, targetDeltaC: 0.2,
            sourceName: '青白玉工程反射率模型',
            anchors: [[380,0.69],[420,0.76],[460,0.81],[500,0.84],[540,0.86],[580,0.85],[620,0.83],[660,0.81],[700,0.79],[780,0.75]]
        }),
        sample({
            id: 'jade_green_transition', name: 'Green jade transition', nameCN: '青绿色过渡区', category: 'museum-jade', targetHueZone: 'soft-green-cyan',
            colourRoleCN: '观察青绿色过渡、天然色带和局部青调，控制绿色向蓝色或黄色方向偏移。',
            weight: 1.55, allowedDeltaE00: 4, allowedDeltaH: 3.4, targetDeltaC: 0.7,
            sourceName: '青白玉工程反射率模型',
            anchors: [[380,0.37],[420,0.48],[460,0.59],[500,0.70],[520,0.75],[550,0.73],[580,0.64],[620,0.53],[660,0.47],[700,0.44],[780,0.40]]
        }),
        sample({
            id: 'jade_translucent_edge', name: 'Translucent jade edge', nameCN: '半透明薄边', category: 'museum-jade', targetHueZone: 'cool-translucent',
            colourRoleCN: '观察薄边、镂空和较薄部位的通透层次，避免边缘与主体合并或出现明显偏色。',
            weight: 1.5, allowedDeltaE00: 3.6, allowedDeltaH: 3.6, targetDeltaC: 0.5,
            sourceName: '青白玉工程反射率模型',
            anchors: [[380,0.62],[420,0.73],[460,0.80],[500,0.84],[530,0.86],[560,0.84],[600,0.79],[640,0.74],[700,0.69],[780,0.64]]
        }),
        sample({
            id: 'jade_polished_highlight', name: 'Polished jade highlight', nameCN: '抛光高光', category: 'museum-jade', targetHueZone: 'neutral-highlight',
            colourRoleCN: '控制抛光面和凸起高光的中性表现，保留玉器光泽而不造成局部过曝或偏色。',
            weight: 1.3, allowedDeltaE00: 3, allowedDeltaH: 4, targetDeltaC: 0,
            sourceName: '青白玉工程反射率模型',
            anchors: [[380,0.79],[420,0.84],[460,0.88],[500,0.90],[540,0.91],[580,0.91],[620,0.90],[660,0.89],[700,0.88],[780,0.85]]
        }),
        sample({
            id: 'jade_carved_recess', name: 'Carved jade recess', nameCN: '雕纹凹槽暗部', category: 'museum-jade', targetHueZone: 'green-grey-shadow',
            colourRoleCN: '观察衣纹、浅浮雕和凹槽暗部的结构，避免低照度下雕纹层次被压平。',
            weight: 1.5, allowedDeltaE00: 3.8, allowedDeltaH: 4, targetDeltaC: 0.2,
            sourceName: '青白玉工程反射率模型',
            anchors: [[380,0.16],[420,0.20],[460,0.24],[500,0.28],[530,0.30],[560,0.29],[600,0.26],[640,0.23],[700,0.21],[780,0.19]]
        }),
        sample({
            id: 'lacquer_black_body', name: 'Black lacquer body', nameCN: '黑漆主体', category: 'museum-lacquerware', targetHueZone: 'neutral-black',
            colourRoleCN: '控制黑漆主体的综合色调与低亮度表现，避免优化后黑色发灰、偏蓝或整体抬高。',
            weight: 1.75, allowedDeltaE00: 2.4, allowedDeltaH: 4, targetDeltaC: 0,
            sourceName: '黑漆描金器物工程反射率模型',
            anchors: [[380,0.025],[420,0.028],[460,0.031],[500,0.034],[540,0.038],[580,0.043],[620,0.050],[660,0.056],[700,0.058],[780,0.055]]
        }),
        sample({
            id: 'lacquer_deep_black', name: 'Deep black lacquer', nameCN: '漆面深黑区', category: 'museum-lacquerware', targetHueZone: 'deep-neutral-black',
            colourRoleCN: '观察漆面暗部、纹饰间隙和凹槽结构，避免低照度下深黑区域合并成一片。',
            weight: 1.55, allowedDeltaE00: 3.2, allowedDeltaH: 4.5, targetDeltaC: 0,
            sourceName: '黑漆描金器物工程反射率模型',
            anchors: [[380,0.008],[420,0.009],[460,0.010],[500,0.011],[540,0.012],[580,0.014],[620,0.016],[660,0.018],[700,0.019],[780,0.018]]
        }),
        sample({
            id: 'maki_gold_bright', name: 'Bright maki-e gold', nameCN: '亮金描纹', category: 'museum-lacquerware', targetHueZone: 'gold-yellow',
            colourRoleCN: '观察亮金描纹的金黄色相、明暗和与黑漆底面的分离，控制偏绿或偏橙。',
            weight: 1.65, allowedDeltaE00: 4.2, allowedDeltaH: 3.2, targetDeltaC: 0.8,
            sourceName: '黑漆描金器物工程反射率模型',
            anchors: [[380,0.070],[420,0.075],[460,0.085],[500,0.120],[540,0.220],[580,0.390],[620,0.580],[660,0.690],[700,0.720],[780,0.650]]
        }),
        sample({
            id: 'maki_gold_aged', name: 'Aged maki-e gold', nameCN: '暗金旧化区', category: 'museum-lacquerware', targetHueZone: 'aged-gold-brown',
            colourRoleCN: '观察暗金、磨损和旧化金粉与亮金之间的层次，避免暗金被压成黑色或偏红褐。',
            weight: 1.45, allowedDeltaE00: 4.4, allowedDeltaH: 3.8, targetDeltaC: 0.5,
            sourceName: '黑漆描金器物工程反射率模型',
            anchors: [[380,0.050],[420,0.055],[460,0.065],[500,0.090],[540,0.150],[580,0.250],[620,0.360],[660,0.430],[700,0.450],[780,0.400]]
        }),
        sample({
            id: 'lacquer_vermilion', name: 'Vermilion lacquer detail', nameCN: '朱红装饰', category: 'museum-lacquerware', targetHueZone: 'vermilion-red',
            colourRoleCN: '控制朱红花卉和装饰区域的色相与饱和度，避免提高金纹表现时朱红偏橙或偏紫。',
            weight: 1.4, allowedDeltaE00: 4.2, allowedDeltaH: 3.2, targetDeltaC: 0.7,
            sourceName: '黑漆描金器物工程反射率模型',
            anchors: [[380,0.030],[420,0.028],[460,0.026],[500,0.028],[540,0.045],[580,0.145],[620,0.430],[660,0.600],[700,0.560],[780,0.330]]
        }),
        sample({
            id: 'lacquer_surface_detail', name: 'Lacquer surface highlight', nameCN: '漆面高光与纹饰边缘', category: 'museum-lacquerware', targetHueZone: 'neutral-gloss-highlight',
            colourRoleCN: '观察漆面反光、器物边缘和纹饰凸起的层次，保持漆器光泽并控制局部过亮。',
            weight: 1.35, allowedDeltaE00: 3.4, allowedDeltaH: 4.2, targetDeltaC: 0,
            sourceName: '黑漆描金器物工程反射率模型',
            anchors: [[380,0.105],[420,0.115],[460,0.125],[500,0.140],[540,0.158],[580,0.178],[620,0.198],[660,0.212],[700,0.214],[780,0.195]]
        }),
        sample({
            id: 'textile_ground_warm', name: 'Warm silk ground', nameCN: '暖色织物底色', category: 'museum-textile', targetHueZone: 'warm-beige',
            colourRoleCN: '控制丝织物底色、综合色调和整体明度，避免低照度优化后底布偏黄、偏灰或明显抬亮。',
            weight: 1.7, allowedDeltaE00: 2.4, allowedDeltaH: 3.4, targetDeltaC: 0,
            sourceName: '彩色丝织刺绣工程反射率模型',
            anchors: [[380,0.50],[420,0.505],[460,0.51],[500,0.515],[540,0.52],[580,0.53],[620,0.54],[660,0.545],[700,0.545],[780,0.535]]
        }),
        sample({
            id: 'textile_red_pink', name: 'Red and pink silk thread', nameCN: '红粉丝线', category: 'museum-textile', targetHueZone: 'red-pink',
            colourRoleCN: '观察红、粉和橙红花瓣丝线的综合色相与明暗层次，控制偏橙、偏紫和过度增艳。',
            weight: 1.55, allowedDeltaE00: 4.2, allowedDeltaH: 3.2, targetDeltaC: 0.9,
            sourceName: '彩色丝织刺绣工程反射率模型',
            anchors: [[380,0.045],[420,0.042],[460,0.040],[500,0.044],[540,0.075],[580,0.20],[620,0.49],[660,0.68],[700,0.66],[780,0.43]]
        }),
        sample({
            id: 'textile_blue_green', name: 'Blue-green silk thread', nameCN: '蓝绿丝线', category: 'museum-textile', targetHueZone: 'blue-green',
            colourRoleCN: '观察鸟羽、叶片和岩石中的蓝绿丝线，控制蓝、青、绿之间的分离与综合色相稳定。',
            weight: 1.6, allowedDeltaE00: 4.2, allowedDeltaH: 3.4, targetDeltaC: 0.9,
            sourceName: '彩色丝织刺绣工程反射率模型',
            anchors: [[380,0.08],[420,0.15],[460,0.29],[500,0.40],[530,0.43],[560,0.36],[600,0.23],[640,0.15],[700,0.11],[780,0.09]]
        }),
        sample({
            id: 'textile_golden_thread', name: 'Golden-yellow silk thread', nameCN: '金黄丝线', category: 'museum-textile', targetHueZone: 'golden-yellow',
            colourRoleCN: '观察金黄、赭黄和暖棕丝线的亮暗层次，并保持其与暖色底布和红粉丝线的分离。',
            weight: 1.5, allowedDeltaE00: 4.2, allowedDeltaH: 3.4, targetDeltaC: 0.8,
            sourceName: '彩色丝织刺绣工程反射率模型',
            anchors: [[380,0.06],[420,0.065],[460,0.075],[500,0.11],[540,0.22],[580,0.43],[620,0.61],[660,0.70],[700,0.70],[780,0.61]]
        }),
        sample({
            id: 'textile_dark_thread', name: 'Dark silk thread', nameCN: '深色丝线', category: 'museum-textile', targetHueZone: 'dark-neutral',
            colourRoleCN: '观察鸟羽暗线、枝干、轮廓线和针脚阴影，避免低照度下深色丝线与底布或相邻纹样合并。',
            weight: 1.55, allowedDeltaE00: 3.6, allowedDeltaH: 4.2, targetDeltaC: 0,
            sourceName: '彩色丝织刺绣工程反射率模型',
            anchors: [[380,0.018],[420,0.020],[460,0.023],[500,0.026],[540,0.030],[580,0.035],[620,0.041],[660,0.046],[700,0.047],[780,0.043]]
        }),
        sample({
            id: 'textile_stitch_highlight', name: 'Silk stitch highlight', nameCN: '针脚高光', category: 'museum-textile', targetHueZone: 'warm-highlight',
            colourRoleCN: '观察丝线方向性反射、针脚凸起和细密纹理高光，保持织物光泽并控制局部过亮。',
            weight: 1.35, allowedDeltaE00: 3.4, allowedDeltaH: 4, targetDeltaC: 0.2,
            sourceName: '彩色丝织刺绣工程反射率模型',
            anchors: [[380,0.45],[420,0.50],[460,0.55],[500,0.60],[540,0.65],[580,0.70],[620,0.74],[660,0.76],[700,0.75],[780,0.69]]
        }),
        sample({
            id: 'cloisonne_ground_light', name: 'Light cloisonne enamel ground', nameCN: '浅色珐琅地', category: 'museum-cloisonne', targetHueZone: 'warm-neutral-enamel',
            colourRoleCN: '控制浅色珐琅地的综合色调和亮度，保持釉面温润与中性，避免高饱和配方造成偏黄、偏青或发灰。',
            weight: 1.75, allowedDeltaE00: 2.4, allowedDeltaH: 3.2, targetDeltaC: 0,
            sourceName: '掐丝珐琅器工程反射率模型',
            anchors: [[380,0.48],[420,0.51],[460,0.54],[500,0.56],[540,0.57],[580,0.58],[620,0.59],[660,0.59],[700,0.58],[780,0.55]]
        }),
        sample({
            id: 'cloisonne_cobalt_blue', name: 'Cobalt-blue cloisonne enamel', nameCN: '钴蓝珐琅', category: 'museum-cloisonne', targetHueZone: 'cobalt-blue',
            colourRoleCN: '观察深蓝花纹和钴蓝釉面的综合色相、明暗与饱和度，控制蓝色偏紫、偏青及暗部合并。',
            weight: 1.65, allowedDeltaE00: 4.2, allowedDeltaH: 3.2, targetDeltaC: 0.9,
            sourceName: '掐丝珐琅器工程反射率模型',
            anchors: [[380,0.08],[420,0.16],[450,0.34],[470,0.39],[500,0.30],[530,0.19],[560,0.12],[600,0.08],[660,0.06],[780,0.05]]
        }),
        sample({
            id: 'cloisonne_blue_green', name: 'Blue-green cloisonne enamel', nameCN: '蓝绿珐琅', category: 'museum-cloisonne', targetHueZone: 'cyan-green',
            colourRoleCN: '观察湖蓝、青绿和绿色釉面之间的连续层次，保持蓝绿方向稳定并避免与钴蓝或浅色底面混合。',
            weight: 1.65, allowedDeltaE00: 4.2, allowedDeltaH: 3.2, targetDeltaC: 0.9,
            sourceName: '掐丝珐琅器工程反射率模型',
            anchors: [[380,0.06],[420,0.10],[460,0.22],[490,0.40],[520,0.48],[550,0.42],[580,0.28],[620,0.16],[680,0.10],[780,0.07]]
        }),
        sample({
            id: 'cloisonne_red', name: 'Red cloisonne enamel', nameCN: '红色珐琅', category: 'museum-cloisonne', targetHueZone: 'enamel-red',
            colourRoleCN: '控制红色和橙红花纹的综合色相及饱和度，避免提升蓝绿色时红色偏橙、偏紫或出现过度艳丽。',
            weight: 1.55, allowedDeltaE00: 4.2, allowedDeltaH: 3.2, targetDeltaC: 0.9,
            sourceName: '掐丝珐琅器工程反射率模型',
            anchors: [[380,0.035],[420,0.032],[460,0.030],[500,0.034],[540,0.055],[580,0.16],[620,0.45],[660,0.66],[700,0.64],[780,0.40]]
        }),
        sample({
            id: 'cloisonne_yellow', name: 'Yellow cloisonne enamel', nameCN: '黄色珐琅', category: 'museum-cloisonne', targetHueZone: 'enamel-yellow',
            colourRoleCN: '观察黄色花瓣和暖色釉面的综合色相，保持其与浅色珐琅地、红色釉面及金属掐丝之间的分离。',
            weight: 1.5, allowedDeltaE00: 4.2, allowedDeltaH: 3.4, targetDeltaC: 0.8,
            sourceName: '掐丝珐琅器工程反射率模型',
            anchors: [[380,0.05],[420,0.055],[460,0.065],[500,0.10],[540,0.24],[580,0.48],[620,0.63],[660,0.68],[700,0.67],[780,0.58]]
        }),
        sample({
            id: 'cloisonne_gilt_wire', name: 'Gilt cloisonne wire', nameCN: '鎏金掐丝与金属高光', category: 'museum-cloisonne', targetHueZone: 'gilt-metal',
            colourRoleCN: '观察鎏金掐丝、口沿、底足和金属高光的暖金色与亮度，避免金线与黄色珐琅合并或出现偏绿色。',
            weight: 1.6, allowedDeltaE00: 3.8, allowedDeltaH: 3.4, targetDeltaC: 0.5,
            sourceName: '掐丝珐琅器工程反射率模型',
            anchors: [[380,0.16],[420,0.18],[460,0.21],[500,0.28],[540,0.42],[580,0.62],[620,0.76],[660,0.84],[700,0.85],[780,0.78]]
        }),
        sample({
            id: 'guanyin_skin', name: 'Guanyin skin tone', nameCN: '面部与手部肤色', category: 'museum-painted-wood', targetHueZone: 'aged-warm-skin',
            colourRoleCN: '控制面部与双手的综合色调、明度和低饱和暖色关系，避免高饱和配方造成偏黄、偏红或发灰。',
            weight: 1.8, allowedDeltaE00: 2.4, allowedDeltaH: 3.2, targetDeltaC: 0,
            sourceName: '北宋彩绘木雕观音工程反射率模型',
            anchors: [[380,0.18],[420,0.20],[460,0.22],[500,0.25],[540,0.29],[580,0.35],[620,0.43],[660,0.49],[700,0.50],[780,0.46]]
        }),
        sample({
            id: 'guanyin_warm_red', name: 'Guanyin warm red pigment', nameCN: '唇色与暖红装饰', category: 'museum-painted-wood', targetHueZone: 'aged-warm-red',
            colourRoleCN: '观察唇色、红玉髓和残存暖红彩绘的综合色相，保持其与肤色、鎏金和木质区域的分离。',
            weight: 1.5, allowedDeltaE00: 4.2, allowedDeltaH: 3.4, targetDeltaC: 0.7,
            sourceName: '北宋彩绘木雕观音工程反射率模型',
            anchors: [[380,0.035],[420,0.034],[460,0.036],[500,0.043],[540,0.070],[580,0.17],[620,0.42],[660,0.60],[700,0.58],[780,0.36]]
        }),
        sample({
            id: 'guanyin_gilt', name: 'Guanyin gilt ornament', nameCN: '鎏金饰物', category: 'museum-painted-wood', targetHueZone: 'aged-gilt',
            colourRoleCN: '观察冠饰、璎珞和衣饰残存鎏金的暖金色、明暗与磨损层次，控制偏绿、偏橙和过度增艳。',
            weight: 1.65, allowedDeltaE00: 3.8, allowedDeltaH: 3.6, targetDeltaC: 0.5,
            sourceName: '北宋彩绘木雕观音工程反射率模型',
            anchors: [[380,0.12],[420,0.14],[460,0.17],[500,0.23],[540,0.35],[580,0.53],[620,0.68],[660,0.76],[700,0.77],[780,0.70]]
        }),
        sample({
            id: 'guanyin_blue_green_pigment', name: 'Guanyin blue-green pigment', nameCN: '蓝绿色残存彩绘', category: 'museum-painted-wood', targetHueZone: 'aged-blue-green',
            colourRoleCN: '观察冠饰、衣带和服饰上少量蓝绿残彩，控制其与暖色木质、肤色和鎏金区域的分离。',
            weight: 1.55, allowedDeltaE00: 4.4, allowedDeltaH: 3.8, targetDeltaC: 0.7,
            sourceName: '北宋彩绘木雕观音工程反射率模型',
            anchors: [[380,0.055],[420,0.085],[460,0.17],[490,0.30],[520,0.36],[550,0.33],[580,0.23],[620,0.14],[680,0.09],[780,0.065]]
        }),
        sample({
            id: 'guanyin_dark_wood_recess', name: 'Guanyin dark wood recess', nameCN: '深色木质与衣纹凹槽', category: 'museum-painted-wood', targetHueZone: 'dark-warm-wood',
            colourRoleCN: '观察发髻、眼窝、鼻翼、衣纹凹槽和木质暗部，保持五官、衣纹和体积结构在低照度下可辨。',
            weight: 1.65, allowedDeltaE00: 3.8, allowedDeltaH: 4.2, targetDeltaC: 0,
            sourceName: '北宋彩绘木雕观音工程反射率模型',
            anchors: [[380,0.020],[420,0.022],[460,0.025],[500,0.029],[540,0.034],[580,0.041],[620,0.050],[660,0.058],[700,0.060],[780,0.055]]
        }),
        sample({
            id: 'guanyin_quartz_highlight', name: 'Guanyin quartz and jewel highlight', nameCN: '石英眼与宝石高光', category: 'museum-painted-wood', targetHueZone: 'neutral-cool-highlight',
            colourRoleCN: '观察石英眼、宝石和磨损表面的局部高光，保持透明或半透明质感并控制局部过亮。',
            weight: 1.4, allowedDeltaE00: 3.4, allowedDeltaH: 4, targetDeltaC: 0.1,
            sourceName: '北宋彩绘木雕观音工程反射率模型',
            anchors: [[380,0.58],[420,0.64],[460,0.69],[500,0.72],[540,0.74],[580,0.75],[620,0.75],[660,0.74],[700,0.72],[780,0.68]]
        }),
        sample({
            id: 'oil_light_petals', name: 'Light petals and highlights', nameCN: '白色与浅色花瓣', category: 'museum-oil-painting', targetHueZone: 'warm-light-neutral',
            colourRoleCN: '控制白色与浅色花瓣、浅色高光的综合色调和亮度，作为油画画面综合色调与亮度锚点。',
            weight: 1.75, allowedDeltaE00: 2.4, allowedDeltaH: 3.2, targetDeltaC: 0,
            sourceName: 'Roesen 静物油画工程反射率模型',
            anchors: [[380,0.48],[420,0.51],[460,0.54],[500,0.57],[540,0.60],[580,0.64],[620,0.66],[660,0.66],[700,0.64],[780,0.58]]
        }),
        sample({
            id: 'oil_red_orange', name: 'Red-orange fruit and petals', nameCN: '红橙水果与红色花瓣', category: 'museum-oil-painting', targetHueZone: 'red-orange',
            colourRoleCN: '观察红橙水果、红色花瓣与暖红区域的综合色相和饱和度，保持与黄色、绿色和浅色区域的分离。',
            weight: 1.6, allowedDeltaE00: 4.2, allowedDeltaH: 3.2, targetDeltaC: 0.9,
            sourceName: 'Roesen 静物油画工程反射率模型',
            anchors: [[380,0.04],[420,0.035],[460,0.035],[500,0.05],[540,0.10],[580,0.26],[620,0.55],[660,0.70],[700,0.68],[780,0.45]]
        }),
        sample({
            id: 'oil_yellow_gold', name: 'Yellow fruit and golden petals', nameCN: '黄色水果与金黄花瓣', category: 'museum-oil-painting', targetHueZone: 'yellow-gold',
            colourRoleCN: '观察黄色水果、菠萝和金黄花瓣的综合色相及明暗，保持与红橙、绿色和浅色花瓣的综合色彩层次。',
            weight: 1.55, allowedDeltaE00: 4.2, allowedDeltaH: 3.4, targetDeltaC: 0.8,
            sourceName: 'Roesen 静物油画工程反射率模型',
            anchors: [[380,0.05],[420,0.055],[460,0.065],[500,0.10],[540,0.25],[580,0.50],[620,0.65],[660,0.70],[700,0.68],[780,0.58]]
        }),
        sample({
            id: 'oil_green_foliage', name: 'Green foliage and fruit', nameCN: '绿色叶片与青绿水果', category: 'museum-oil-painting', targetHueZone: 'green',
            colourRoleCN: '观察深绿、黄绿和青绿色叶片与水果的综合色彩层次，控制绿色区域与黄色、蓝紫和暗背景之间的分离。',
            weight: 1.65, allowedDeltaE00: 4.2, allowedDeltaH: 3.4, targetDeltaC: 0.9,
            sourceName: 'Roesen 静物油画工程反射率模型',
            anchors: [[380,0.04],[420,0.055],[460,0.08],[500,0.18],[530,0.32],[550,0.40],[580,0.34],[620,0.21],[660,0.12],[700,0.07],[780,0.05]]
        }),
        sample({
            id: 'oil_blue_violet', name: 'Blue-violet flowers and grapes', nameCN: '蓝紫色花朵与葡萄', category: 'museum-oil-painting', targetHueZone: 'blue-violet',
            colourRoleCN: '观察蓝紫花朵、葡萄和冷色细节的综合色相稳定，避免高饱和配方造成偏蓝、偏红或暗部合并。',
            weight: 1.6, allowedDeltaE00: 4.2, allowedDeltaH: 3.2, targetDeltaC: 0.9,
            sourceName: 'Roesen 静物油画工程反射率模型',
            anchors: [[380,0.09],[420,0.20],[450,0.35],[480,0.32],[520,0.18],[560,0.10],[600,0.10],[640,0.12],[700,0.16],[780,0.18]]
        }),
        sample({
            id: 'oil_dark_background', name: 'Dark background and recess', nameCN: '深色背景与暗部', category: 'museum-oil-painting', targetHueZone: 'dark-neutral',
            colourRoleCN: '观察深色背景、花叶阴影、器皿暗部和综合色彩交界，保持低照度下的轮廓、笔触和暗部细节辨识。',
            weight: 1.6, allowedDeltaE00: 3.6, allowedDeltaH: 4.2, targetDeltaC: 0,
            sourceName: 'Roesen 静物油画工程反射率模型',
            anchors: [[380,0.018],[420,0.020],[460,0.022],[500,0.025],[540,0.030],[580,0.037],[620,0.045],[660,0.052],[700,0.055],[780,0.050]]
        })
    ]);

    const sampleById = Object.freeze(Object.fromEntries(samples.map(function (item) { return [item.id, item]; })));

    function createExhibit(definition) {
        const sampleIds = definition.sampleIds.slice();
        sampleIds.forEach(function (id) {
            if (!sampleById[id]) throw new Error('Unknown museum sample in exhibit ' + definition.id + ': ' + id);
        });
        if (!sampleIds.includes(definition.defaultSampleId)) {
            throw new Error('Default museum sample must belong to exhibit ' + definition.id);
        }
        const distinctionGroups = definition.evaluationProfile.distinctionGroups;
        Object.keys(distinctionGroups).forEach(function (key) {
            distinctionGroups[key].pairs.forEach(function (pair) {
                pair.forEach(function (id) {
                    if (!sampleIds.includes(id)) throw new Error('Unknown distinction sample in exhibit ' + definition.id + ': ' + id);
                });
            });
        });
        return deepFreeze(Object.assign({}, definition, {
            sampleIds,
            distinctionPairs: Object.fromEntries(Object.keys(distinctionGroups).map(function (key) {
                return [key, distinctionGroups[key].pairs.map(function (pair) { return pair.slice(); })];
            }))
        }));
    }

    const exhibits = deepFreeze([
        createExhibit({
            id: 'qinghua_porcelain_single',
            nameCN: '青花瓷单展品',
            category: 'ceramic',
            descriptionCN: '以釉面白、钴蓝浓淡和蓝白过渡区域验证青花瓷在不同光谱下的颜色表现。',
            defaultSampleId: 'glaze_white',
            appearanceSource: {
                type: 'local-transparent-cutout',
                file: 'assets/appearance/museum/qinghua-porcelain-cutout.png',
                label: '青花瓷展品透明底图',
                notes: '透明底图仅保留展品主体，用于视觉展示和色样区域映射，不参与反射率计算。'
            },
            sampleIds: ['glaze_white', 'cobalt_light', 'cobalt_deep', 'blue_white_transition', 'glaze_shadow', 'neutral_control'],
            evaluationProfile: {
                anchorSampleId: 'glaze_white',
                hueControlSampleIds: ['cobalt_light', 'cobalt_deep'],
                chromaSampleIds: ['cobalt_light', 'blue_white_transition', 'cobalt_deep'],
                distinctionGroups: {
                    blueWhite: {
                        labelCN: '蓝白分离',
                        aggregation: 'average',
                        pairs: [
                            ['glaze_white', 'cobalt_light'],
                            ['glaze_white', 'cobalt_deep'],
                            ['glaze_white', 'blue_white_transition']
                        ]
                    },
                    lightDeepBlue: {
                        labelCN: '浅蓝/深蓝',
                        aggregation: 'average',
                        pairs: [['cobalt_light', 'cobalt_deep']]
                    },
                    blueHierarchy: {
                        labelCN: '钴蓝纹样层次',
                        aggregation: 'minimum',
                        pairs: [
                            ['cobalt_light', 'blue_white_transition'],
                            ['blue_white_transition', 'cobalt_deep']
                        ]
                    }
                }
            },
            previewProfile: {
                classifier: 'blue-white-ceramic',
                luminanceLock: 'anchor',
                fallbackSampleId: 'neutral_control',
                recognitionSampleIds: ['cobalt_light', 'cobalt_deep', 'blue_white_transition'],
                localRecognition: {
                    cobalt_light: { contrast: 0.08, saturation: 0.035, lightness: 2.5 },
                    cobalt_deep: { contrast: 0.12, saturation: 0.05, lightness: -3 },
                    blue_white_transition: { contrast: 0.08, saturation: 0.035, lightness: 1.5 }
                }
            },
            findings: [
                { id: 'white', labelCN: '白釉表现', type: 'anchor-stability' },
                { id: 'blueWhite', labelCN: '蓝白分离', type: 'distinction', distinctionKey: 'blueWhite' },
                { id: 'lightDeepBlue', labelCN: '浅蓝/深蓝', type: 'distinction', distinctionKey: 'lightDeepBlue' },
                { id: 'blueHierarchy', labelCN: '钴蓝纹样层次', type: 'distinction', distinctionKey: 'blueHierarchy' }
            ],
            previewNoteCN: '颜色保真保持白釉与钴蓝色相；低照度模式增强蓝白分离和钴蓝纹样层次；色彩增强适度提高饱和度。',
            lightingDefaults: { targetIlluminance: 50, targetCct: 3500 },
            modeOverrides: {
                'low-light-recognition': {
                    minRf: 83, minRg: 110, targetRg: 110.5, maxRg: 115,
                    maxCobaltAbsDeltaH: 4.5
                }
            }
        }),
        createExhibit({
            id: 'ink_bird_bamboo',
            nameCN: '纸本水墨花鸟',
            category: 'ink-painting',
            descriptionCN: '以暖色纸张、浓淡墨、折痕阴影和印章红验证纸本水墨在不同光谱下的灰阶与颜色表现。',
            defaultSampleId: 'paper_warm',
            appearanceSource: {
                type: 'local-artwork-image',
                file: 'assets/appearance/museum/ink-bird-bamboo.jpg',
                sourcePage: 'https://commons.wikimedia.org/wiki/File:Zhu_Cheng_-_A_Chinese_ink_painting_on_paper_by_Zhu_Cheng_of_a_bird_on_bamboo_with_flowers.jpg',
                label: '朱偁纸本水墨花鸟作品图',
                licenseCN: '公共领域标记，作品及图像无已知版权限制。',
                notes: '作品图用于视觉展示和区域映射；纸张、墨色与印章红的工程反射率模型负责计算。'
            },
            sampleIds: ['paper_warm', 'ink_light', 'ink_mid', 'ink_deep', 'seal_red', 'paper_shadow'],
            evaluationProfile: {
                anchorSampleId: 'paper_warm',
                hueControlSampleIds: ['seal_red'],
                chromaSampleIds: ['seal_red'],
                distinctionGroups: {
                    paperInk: {
                        labelCN: '纸墨分离',
                        aggregation: 'average',
                        pairs: [
                            ['paper_warm', 'ink_light'],
                            ['paper_warm', 'ink_mid'],
                            ['paper_warm', 'ink_deep']
                        ]
                    },
                    inkHierarchy: {
                        labelCN: '浓淡墨层次',
                        aggregation: 'minimum',
                        pairs: [
                            ['ink_light', 'ink_mid'],
                            ['ink_mid', 'ink_deep']
                        ]
                    },
                    sealContrast: {
                        labelCN: '印章红表现',
                        aggregation: 'average',
                        pairs: [
                            ['paper_warm', 'seal_red'],
                            ['ink_mid', 'seal_red']
                        ]
                    }
                }
            },
            previewProfile: {
                classifier: 'ink-on-paper',
                luminanceLock: 'anchor',
                regionMask: {
                    type: 'rle-json',
                    file: 'assets/appearance/museum/ink-bird-bamboo-regions.json',
                    sampleIds: ['paper_warm', 'ink_light', 'ink_mid', 'ink_deep', 'seal_red', 'paper_shadow'],
                    legendSampleIds: ['paper_warm', 'paper_shadow', 'ink_light', 'ink_mid', 'ink_deep', 'seal_red'],
                    minimumCoverage: 0.95,
                    maximumUnclassified: 0.05,
                    minimumPixelsBySample: { seal_red: 4 }
                },
                fallbackSampleId: 'paper_warm',
                recognitionSampleIds: ['paper_shadow', 'ink_light', 'ink_mid', 'ink_deep', 'seal_red'],
                localRecognition: {
                    paper_shadow: { contrast: 0.1, saturation: 0, lightness: -1 },
                    ink_light: { contrast: 0.2, saturation: 0, lightness: -1.5 },
                    ink_mid: { contrast: 0.3, saturation: 0, lightness: -4 },
                    ink_deep: { contrast: 0.42, saturation: 0, lightness: -8 },
                    seal_red: { contrast: 0.12, saturation: 0.1, lightness: 0 }
                },
                displayAdjustments: {
                    fidelity: { saturationOffset: -0.01, spectralGainScale: 0.7 },
                    'low-light-recognition': {
                        current: { saturation: 0.99, contrast: 0.99, blurPx: 0.08, spectralGain: 0.06, recognitionBoost: 0 },
                        optimized: { saturation: 1.005, contrast: 1, blurPx: 0.02, spectralGain: 0.28, recognitionBoost: 1 }
                    },
                    'colour-enhancement': { saturationOffset: -0.05, contrastOffset: 0.01, spectralGainScale: 0.65, recognitionBoostScale: 0.7 }
                }
            },
            findings: [
                { id: 'paper', labelCN: '纸张底色', type: 'anchor-stability' },
                { id: 'paperInk', labelCN: '纸墨分离', type: 'distinction', distinctionKey: 'paperInk' },
                { id: 'inkHierarchy', labelCN: '浓淡墨层次', type: 'distinction', distinctionKey: 'inkHierarchy' },
                { id: 'sealContrast', labelCN: '印章红表现', type: 'distinction', distinctionKey: 'sealContrast' }
            ],
            previewNoteCN: '颜色保真保持纸张底色与印章红；低照度模式增强浓淡墨、线条和纸墨分离；色彩增强仅适度提升印章红表现。',
            lightingDefaults: { targetIlluminance: 50, targetCct: 3500 },
            modeOverrides: {
                fidelity: {
                    descriptionCN: '控制纸张底色、墨色中性和印章红色相，降低综合色差。',
                    minRf: 92, minRg: 95, targetRg: 100, maxRg: 107,
                    maxWhiteDeltaE00: 1.8, maxCobaltAbsDeltaH: 3.2,
                    maxMeanDeltaE00: 2.8, maxDeltaE00: 4.8,
                    distinctionGain: 0, chromaGain: 0,
                    weights: { mean: 1.1, worst: 0.5, white: 1.1, hue: 0.8, distinction: 0.15, chroma: 0.05, rg: 0.05 }
                },
                'low-light-recognition': {
                    descriptionCN: '在 Rg 110 以上保持纸张底色和墨色中性，提高淡墨、中墨、浓墨与线条灰阶的分辨力。',
                    minRf: 83, minRg: 110, targetRg: 110.5, maxRg: 115,
                    maxWhiteDeltaE00: 2.2, maxCobaltAbsDeltaH: 3.5,
                    maxMeanDeltaE00: 3.8, maxDeltaE00: 6,
                    distinctionGain: 0.1, chromaGain: 0.2,
                    weights: { mean: 0.35, worst: 0.3, white: 1.2, hue: 0.8, distinction: 1.8, chroma: 0.15, rg: 1.8 }
                },
                'colour-enhancement': {
                    descriptionCN: '适度提升印章红与纸墨对比，同时保持墨色灰阶和纸张暖调。',
                    minRf: 88, minRg: 100, targetRg: 105, maxRg: 110,
                    maxWhiteDeltaE00: 2.4, maxCobaltAbsDeltaH: 3.5,
                    maxMeanDeltaE00: 4, maxDeltaE00: 6.5,
                    distinctionGain: 0.06, chromaGain: 0.8,
                    weights: { mean: 0.35, worst: 0.3, white: 1, hue: 0.9, distinction: 1, chroma: 0.8, rg: 0.4 }
                }
            }
        }),
        createExhibit({
            id: 'bronze_food_vessel',
            nameCN: '青铜纹饰食器',
            category: 'bronze',
            descriptionCN: '以青铜金属本色、浅深铜绿、磨蚀高光和纹饰凹槽验证青铜器在不同光谱下的材质与细节表现。',
            defaultSampleId: 'bronze_base',
            appearanceSource: {
                type: 'local-transparent-cutout',
                file: 'assets/appearance/museum/bronze-vessel-cutout.png',
                sourcePage: 'https://commons.wikimedia.org/wiki/File:Chinese_bronze_vessel_-_British_Museum_(2).jpg',
                label: '商代青铜食器透明底图',
                licenseCN: 'CC0 1.0 公共领域贡献，可复制、修改和再发布。',
                notes: '本地透明底图仅保留器物主体，用于视觉展示和区域映射；青铜本色、铜绿、高光与纹饰暗部的工程反射率模型负责计算。'
            },
            sampleIds: ['bronze_base', 'patina_green', 'patina_light', 'bronze_highlight', 'relief_recess', 'bronze_shadow'],
            evaluationProfile: {
                anchorSampleId: 'bronze_base',
                hueControlSampleIds: ['patina_green', 'patina_light', 'bronze_highlight'],
                chromaSampleIds: ['patina_green', 'patina_light', 'bronze_highlight'],
                distinctionGroups: {
                    patinaMetal: {
                        labelCN: '铜绿与金属分离',
                        aggregation: 'average',
                        pairs: [
                            ['bronze_base', 'patina_green'],
                            ['bronze_base', 'patina_light'],
                            ['bronze_highlight', 'patina_green']
                        ]
                    },
                    patinaHierarchy: {
                        labelCN: '铜绿层次',
                        aggregation: 'minimum',
                        pairs: [
                            ['patina_light', 'patina_green'],
                            ['patina_green', 'relief_recess']
                        ]
                    },
                    reliefDetail: {
                        labelCN: '纹饰暗部',
                        aggregation: 'minimum',
                        pairs: [
                            ['bronze_highlight', 'relief_recess'],
                            ['bronze_base', 'relief_recess'],
                            ['bronze_shadow', 'relief_recess']
                        ]
                    }
                }
            },
            previewProfile: {
                classifier: 'bronze-patina',
                luminanceLock: 'anchor',
                fallbackSampleId: 'bronze_base',
                recognitionSampleIds: ['patina_green', 'patina_light', 'bronze_highlight', 'relief_recess'],
                localRecognition: {
                    patina_green: { contrast: 0.08, saturation: 0.04, lightness: 1 },
                    patina_light: { contrast: 0.07, saturation: 0.035, lightness: 1.5 },
                    bronze_highlight: { contrast: 0.07, saturation: 0.02, lightness: 1 },
                    relief_recess: { contrast: 0.15, saturation: 0.01, lightness: -3 }
                },
                displayAdjustments: {
                    fidelity: { saturationOffset: -0.01, spectralGainScale: 0.65 },
                    'low-light-recognition': {
                        current: { saturation: 0.97, contrast: 0.97, blurPx: 0.08, spectralGain: 0.06, recognitionBoost: 0 },
                        optimized: { saturation: 1.02, contrast: 1.055, blurPx: 0.02, spectralGain: 0.2, recognitionBoost: 0.72 }
                    },
                    'colour-enhancement': { saturationOffset: -0.02, contrastOffset: 0.015, spectralGainScale: 0.72, recognitionBoostScale: 0.8 }
                }
            },
            findings: [
                { id: 'bronzeTone', labelCN: '铜色稳定', type: 'anchor-stability' },
                { id: 'patinaMetal', labelCN: '铜绿与金属分离', type: 'distinction', distinctionKey: 'patinaMetal' },
                { id: 'patinaHierarchy', labelCN: '铜绿层次', type: 'distinction', distinctionKey: 'patinaHierarchy' },
                { id: 'reliefDetail', labelCN: '纹饰暗部', type: 'distinction', distinctionKey: 'reliefDetail' }
            ],
            previewNoteCN: '颜色保真保持青铜本色和铜绿色相；低照度模式以轻微局部对比呈现铜绿与金属本色的分离、纹饰凹槽和暗部层次；透明底素材仅保留器物主体；色彩增强适度提升铜绿表现。',
            lightingDefaults: { targetIlluminance: 80, targetCct: 3200 },
            modeOverrides: {
                fidelity: {
                    descriptionCN: '控制青铜金属本色、铜绿色相与高光暖调，降低综合色差。',
                    minRf: 91, minRg: 96, targetRg: 100, maxRg: 108,
                    maxWhiteDeltaE00: 2.5, maxCobaltAbsDeltaH: 3.8,
                    maxMeanDeltaE00: 3.2, maxDeltaE00: 5.2,
                    distinctionGain: 0, chromaGain: 0.2,
                    weights: { mean: 1, worst: 0.5, white: 0.9, hue: 0.9, distinction: 0.15, chroma: 0.1, rg: 0.08 }
                },
                'low-light-recognition': {
                    descriptionCN: '在 Rg 110 以上保持铜绿色相和金属本色，提高铜绿分离、纹饰凹槽与暗部细节的辨识度。',
                    minRf: 82, minRg: 110, targetRg: 110.5, maxRg: 115,
                    maxWhiteDeltaE00: 2.8, maxCobaltAbsDeltaH: 5.5,
                    maxMeanDeltaE00: 3.8, maxDeltaE00: 6,
                    distinctionGain: 0.06, chromaGain: 0.35,
                    weights: { mean: 0.4, worst: 0.35, white: 0.95, hue: 0.95, distinction: 1.4, chroma: 0.3, rg: 1.8 }
                },
                'colour-enhancement': {
                    descriptionCN: '适度提高铜绿与暖色金属高光的表现，同时保持纹饰暗部和综合色相。',
                    minRf: 86, minRg: 104, targetRg: 109, maxRg: 113,
                    maxWhiteDeltaE00: 3.2, maxCobaltAbsDeltaH: 4.2,
                    maxMeanDeltaE00: 4.6, maxDeltaE00: 7,
                    distinctionGain: 0.07, chromaGain: 1,
                    weights: { mean: 0.3, worst: 0.28, white: 0.8, hue: 0.85, distinction: 1.1, chroma: 0.9, rg: 0.7 }
                }
            }
        }),
        createExhibit({
            id: 'qingbai_jade_carving',
            nameCN: '青白玉雕件',
            category: 'jade',
            descriptionCN: '以青白玉主体、乳白浅色、青绿色过渡、半透明薄边、抛光高光和雕纹凹槽验证玉器在不同光谱下的温润感、通透层次与雕刻细节。',
            defaultSampleId: 'jade_body',
            appearanceSource: {
                type: 'local-transparent-cutout',
                file: 'assets/appearance/museum/qingbai-jade-carving-cutout.png',
                sourcePage: 'https://www.metmuseum.org/art/collection/search/43829',
                label: '清代青白玉雕文士透明底图',
                licenseCN: '大都会艺术博物馆公共领域图像，可用于商业和非商业用途。',
                notes: '18世纪清代软玉雕文士，本地透明底图仅保留展品主体；工程反射率模型负责玉色、通透层次和雕纹计算。'
            },
            sampleIds: ['jade_body', 'jade_milky_light', 'jade_green_transition', 'jade_translucent_edge', 'jade_polished_highlight', 'jade_carved_recess'],
            evaluationProfile: {
                anchorSampleId: 'jade_body',
                hueControlSampleIds: ['jade_green_transition', 'jade_translucent_edge'],
                chromaSampleIds: ['jade_green_transition', 'jade_translucent_edge'],
                distinctionGroups: {
                    jadeLayers: {
                        labelCN: '青白层次',
                        aggregation: 'average',
                        pairs: [
                            ['jade_body', 'jade_milky_light'],
                            ['jade_body', 'jade_green_transition'],
                            ['jade_milky_light', 'jade_green_transition']
                        ]
                    },
                    jadeTranslucency: {
                        labelCN: '通透感',
                        aggregation: 'minimum',
                        pairs: [
                            ['jade_translucent_edge', 'jade_body'],
                            ['jade_translucent_edge', 'jade_carved_recess'],
                            ['jade_polished_highlight', 'jade_translucent_edge']
                        ]
                    },
                    jadeCarving: {
                        labelCN: '雕纹细节',
                        aggregation: 'minimum',
                        pairs: [
                            ['jade_body', 'jade_carved_recess'],
                            ['jade_milky_light', 'jade_carved_recess'],
                            ['jade_polished_highlight', 'jade_carved_recess']
                        ]
                    }
                }
            },
            previewProfile: {
                classifier: 'qingbai-jade',
                luminanceLock: 'anchor',
                fallbackSampleId: 'jade_body',
                recognitionSampleIds: ['jade_milky_light', 'jade_green_transition', 'jade_translucent_edge', 'jade_polished_highlight', 'jade_carved_recess'],
                localRecognition: {
                    jade_milky_light: { contrast: 0.075, saturation: 0.012, lightness: 1.2 },
                    jade_green_transition: { contrast: 0.12, saturation: 0.07, lightness: 0.4 },
                    jade_translucent_edge: { contrast: 0.12, saturation: 0.04, lightness: 2.1 },
                    jade_polished_highlight: { contrast: 0.09, saturation: 0, lightness: 1.8 },
                    jade_carved_recess: { contrast: 0.22, saturation: 0.02, lightness: -4 }
                },
                displayAdjustments: {
                    fidelity: { saturationOffset: -0.01, spectralGainScale: 0.7 },
                    'low-light-recognition': {
                        current: { saturation: 0.97, contrast: 0.97, blurPx: 0.12, spectralGain: 0.07, recognitionBoost: 0 },
                        optimized: { saturation: 1.025, contrast: 1.065, blurPx: 0.02, spectralGain: 0.3, recognitionBoost: 1 }
                    },
                    'colour-enhancement': { saturationOffset: -0.02, contrastOffset: 0.01, spectralGainScale: 0.78, recognitionBoostScale: 0.78 }
                }
            },
            findings: [
                { id: 'jadeTone', labelCN: '玉色稳定', type: 'anchor-stability' },
                { id: 'jadeLayers', labelCN: '青白层次', type: 'distinction', distinctionKey: 'jadeLayers' },
                { id: 'jadeTranslucency', labelCN: '通透感', type: 'distinction', distinctionKey: 'jadeTranslucency' },
                { id: 'jadeCarving', labelCN: '雕纹细节', type: 'distinction', distinctionKey: 'jadeCarving' }
            ],
            previewNoteCN: '颜色保真保持青白玉主体与乳白浅色；低照度模式增强青绿色过渡、半透明薄边和雕纹凹槽；色彩增强控制在低饱和范围内，保留玉器温润感。',
            lightingDefaults: { targetIlluminance: 60, targetCct: 3500 },
            modeOverrides: {
                fidelity: {
                    descriptionCN: '控制青白玉主体、乳白区和青绿色过渡的综合色差，保持玉色温润和高光中性。',
                    minRf: 92, minRg: 95, targetRg: 100, maxRg: 107,
                    maxWhiteDeltaE00: 2.2, maxCobaltAbsDeltaH: 3.2,
                    maxMeanDeltaE00: 3, maxDeltaE00: 5,
                    distinctionGain: 0, chromaGain: 0.15,
                    weights: { mean: 1.05, worst: 0.5, white: 1.1, hue: 0.85, distinction: 0.2, chroma: 0.08, rg: 0.08 }
                },
                'low-light-recognition': {
                    descriptionCN: '在 Rg 110 以上保持青白玉主体稳定，提高青白层次、薄边通透感和雕纹凹槽辨识度。',
                    minRf: 83, minRg: 110, targetRg: 112, maxRg: 115,
                    maxWhiteDeltaE00: 2.6, maxCobaltAbsDeltaH: 3.6,
                    maxMeanDeltaE00: 3.8, maxDeltaE00: 6,
                    distinctionGain: 0.08, chromaGain: 0.35,
                    weights: { mean: 0.38, worst: 0.32, white: 1.1, hue: 0.95, distinction: 1.55, chroma: 0.28, rg: 1.9 }
                },
                'colour-enhancement': {
                    descriptionCN: '适度提高青绿色过渡和乳白玉色的分离，同时保持低饱和、温润和通透的材质表现。',
                    minRf: 87, minRg: 103, targetRg: 108, maxRg: 112,
                    maxWhiteDeltaE00: 2.8, maxCobaltAbsDeltaH: 3.8,
                    maxMeanDeltaE00: 4.2, maxDeltaE00: 6.5,
                    distinctionGain: 0.06, chromaGain: 0.75,
                    weights: { mean: 0.34, worst: 0.3, white: 0.95, hue: 0.95, distinction: 1.05, chroma: 0.72, rg: 0.65 }
                }
            }
        }),
        createExhibit({
            id: 'black_lacquer_gold_writing_box',
            nameCN: '黑漆金银莳绘砚箱',
            category: 'lacquerware',
            descriptionCN: '以黑漆主体、深黑暗部、亮金描纹、暗金旧化、朱红装饰和漆面高光验证低照度下的金黑分离、金色层次与纹饰细节。',
            defaultSampleId: 'lacquer_black_body',
            appearanceSource: {
                type: 'local-transparent-cutout',
                file: 'assets/appearance/museum/black-lacquer-gold-writing-box-cutout.png',
                sourcePage: 'https://www.metmuseum.org/art/collection/search/58274',
                label: '黑漆金银莳绘鸟笼纹砚箱透明底图',
                licenseCN: '大都会艺术博物馆公共领域图像，可用于商业和非商业用途。',
                notes: '日本明治时期黑漆金银莳绘砚箱透明底图，仅保留器物主体；工程反射率模型负责黑漆、金纹、朱红与漆面细节计算。'
            },
            sampleIds: ['lacquer_black_body', 'lacquer_deep_black', 'maki_gold_bright', 'maki_gold_aged', 'lacquer_vermilion', 'lacquer_surface_detail'],
            evaluationProfile: {
                anchorSampleId: 'lacquer_black_body',
                hueControlSampleIds: ['maki_gold_bright', 'maki_gold_aged', 'lacquer_vermilion'],
                chromaSampleIds: ['maki_gold_bright', 'maki_gold_aged', 'lacquer_vermilion'],
                distinctionGroups: {
                    goldBlack: {
                        labelCN: '金黑分离',
                        aggregation: 'average',
                        pairs: [
                            ['lacquer_black_body', 'maki_gold_bright'],
                            ['lacquer_black_body', 'maki_gold_aged'],
                            ['lacquer_deep_black', 'maki_gold_bright']
                        ]
                    },
                    goldHierarchy: {
                        labelCN: '金色层次',
                        aggregation: 'minimum',
                        pairs: [
                            ['maki_gold_bright', 'maki_gold_aged'],
                            ['maki_gold_aged', 'lacquer_black_body']
                        ]
                    },
                    lacquerDetail: {
                        labelCN: '纹饰细节',
                        aggregation: 'minimum',
                        pairs: [
                            ['lacquer_surface_detail', 'lacquer_black_body'],
                            ['lacquer_black_body', 'lacquer_deep_black'],
                            ['maki_gold_bright', 'lacquer_deep_black']
                        ]
                    }
                }
            },
            previewProfile: {
                classifier: 'black-lacquer-gold',
                luminanceLock: 'anchor',
                fallbackSampleId: 'lacquer_black_body',
                recognitionSampleIds: ['lacquer_deep_black', 'maki_gold_bright', 'maki_gold_aged', 'lacquer_vermilion', 'lacquer_surface_detail'],
                localRecognition: {
                    lacquer_deep_black: { contrast: 0.14, saturation: 0, lightness: -1.8 },
                    maki_gold_bright: { contrast: 0.09, saturation: 0.04, lightness: 0.8 },
                    maki_gold_aged: { contrast: 0.08, saturation: 0.03, lightness: 0.2 },
                    lacquer_vermilion: { contrast: 0.08, saturation: 0.045, lightness: 0 },
                    lacquer_surface_detail: { contrast: 0.12, saturation: 0.008, lightness: 1.1 }
                },
                displayAdjustments: {
                    fidelity: { saturationOffset: -0.01, spectralGainScale: 0.68 },
                    'low-light-recognition': {
                        current: { saturation: 0.98, contrast: 0.99, blurPx: 0.08, spectralGain: 0.06, recognitionBoost: 0 },
                        optimized: { saturation: 1.008, contrast: 1.02, blurPx: 0.02, spectralGain: 0.18, recognitionBoost: 0.62 }
                    },
                    'colour-enhancement': { saturationOffset: -0.015, contrastOffset: 0.015, spectralGainScale: 0.78, recognitionBoostScale: 0.82 }
                }
            },
            findings: [
                { id: 'lacquerTone', labelCN: '漆色稳定', type: 'anchor-stability' },
                { id: 'goldBlack', labelCN: '金黑分离', type: 'distinction', distinctionKey: 'goldBlack' },
                { id: 'goldHierarchy', labelCN: '金色层次', type: 'distinction', distinctionKey: 'goldHierarchy' },
                { id: 'lacquerDetail', labelCN: '纹饰细节', type: 'distinction', distinctionKey: 'lacquerDetail' }
            ],
            previewNoteCN: '颜色保真保持黑漆中性、金色色相和朱红装饰；低照度模式提高金黑分离、亮暗金层次和深黑纹饰细节；色彩增强控制在漆器沉稳、低亮和局部高光的材质特征内。',
            lightingDefaults: { targetIlluminance: 50, targetCct: 3000 },
            modeOverrides: {
                fidelity: {
                    descriptionCN: '控制黑漆主体、金色描纹和朱红装饰的综合色差，保持黑色中性与漆面光泽。',
                    minRf: 91, minRg: 95, targetRg: 100, maxRg: 108,
                    maxWhiteDeltaE00: 2.2, maxCobaltAbsDeltaH: 3.4,
                    maxMeanDeltaE00: 3.2, maxDeltaE00: 5.2,
                    distinctionGain: 0, chromaGain: 0.2,
                    weights: { mean: 1, worst: 0.5, white: 1.1, hue: 0.95, distinction: 0.2, chroma: 0.1, rg: 0.08 }
                },
                'low-light-recognition': {
                    descriptionCN: '在 Rg 110 以上保持黑漆主体稳定，提高金纹与黑漆分离、暗金层次和深黑暗部细节。',
                    minRf: 80, minRg: 110, targetRg: 110.5, maxRg: 113,
                    maxWhiteDeltaE00: 2.6, maxCobaltAbsDeltaH: 6,
                    maxMeanDeltaE00: 4.2, maxDeltaE00: 6.5,
                    distinctionGain: 0.09, chromaGain: 0.45,
                    weights: { mean: 0.36, worst: 0.32, white: 1.1, hue: 1, distinction: 1.7, chroma: 0.35, rg: 1.7 }
                },
                'colour-enhancement': {
                    descriptionCN: '适度提高亮金、暗金和朱红装饰的表现，同时保持黑漆低亮、沉稳和局部高光。',
                    minRf: 85, minRg: 104, targetRg: 109, maxRg: 113,
                    maxWhiteDeltaE00: 3, maxCobaltAbsDeltaH: 4,
                    maxMeanDeltaE00: 4.6, maxDeltaE00: 7,
                    distinctionGain: 0.07, chromaGain: 0.9,
                    weights: { mean: 0.32, worst: 0.28, white: 0.9, hue: 0.95, distinction: 1.15, chroma: 0.85, rg: 0.7 }
                }
            }
        }),
        createExhibit({
            id: 'embroidered_birds_flowers_panel',
            nameCN: '花鸟刺绣挂屏',
            category: 'textile',
            descriptionCN: '以暖色织物底色、红粉丝线、蓝绿丝线、金黄丝线、深色轮廓和针脚高光验证低照度下的综合色彩、丝线层次与针脚细节。',
            defaultSampleId: 'textile_ground_warm',
            appearanceSource: {
                type: 'local-transparent-cutout',
                file: 'assets/appearance/museum/embroidered-birds-flowers-panel-cutout.png',
                sourcePage: 'https://www.metmuseum.org/art/collection/search/918072',
                label: '朝鲜王朝花鸟刺绣挂屏透明底图',
                licenseCN: '大都会艺术博物馆公共领域图像，可用于商业和非商业用途。',
                notes: '19世纪晚期朝鲜王朝花鸟刺绣屏风局部，本地透明底图保留织物画芯和纹样；工程反射率模型负责底布、彩色丝线和针脚细节计算。'
            },
            sampleIds: ['textile_ground_warm', 'textile_red_pink', 'textile_blue_green', 'textile_golden_thread', 'textile_dark_thread', 'textile_stitch_highlight'],
            evaluationProfile: {
                anchorSampleId: 'textile_ground_warm',
                hueControlSampleIds: ['textile_red_pink', 'textile_blue_green', 'textile_golden_thread'],
                chromaSampleIds: ['textile_red_pink', 'textile_blue_green', 'textile_golden_thread'],
                distinctionGroups: {
                    textileColourSeparation: {
                        labelCN: '综合色彩分离',
                        aggregation: 'average',
                        pairs: [
                            ['textile_ground_warm', 'textile_red_pink'],
                            ['textile_ground_warm', 'textile_blue_green'],
                            ['textile_red_pink', 'textile_blue_green'],
                            ['textile_golden_thread', 'textile_blue_green']
                        ]
                    },
                    threadHierarchy: {
                        labelCN: '丝线层次',
                        aggregation: 'minimum',
                        pairs: [
                            ['textile_red_pink', 'textile_dark_thread'],
                            ['textile_blue_green', 'textile_dark_thread'],
                            ['textile_golden_thread', 'textile_dark_thread']
                        ]
                    },
                    stitchDetail: {
                        labelCN: '针脚细节',
                        aggregation: 'minimum',
                        pairs: [
                            ['textile_stitch_highlight', 'textile_ground_warm'],
                            ['textile_stitch_highlight', 'textile_dark_thread'],
                            ['textile_ground_warm', 'textile_dark_thread']
                        ]
                    }
                }
            },
            previewProfile: {
                classifier: 'silk-embroidery',
                luminanceLock: 'anchor',
                fallbackSampleId: 'textile_ground_warm',
                recognitionSampleIds: ['textile_red_pink', 'textile_blue_green', 'textile_golden_thread', 'textile_dark_thread', 'textile_stitch_highlight'],
                localRecognition: {
                    textile_red_pink: { contrast: 0.08, saturation: 0.045, lightness: 0.2 },
                    textile_blue_green: { contrast: 0.10, saturation: 0.055, lightness: 0.2 },
                    textile_golden_thread: { contrast: 0.08, saturation: 0.035, lightness: 0.4 },
                    textile_dark_thread: { contrast: 0.18, saturation: 0.01, lightness: -2.4 },
                    textile_stitch_highlight: { contrast: 0.11, saturation: 0.01, lightness: 1.6 }
                },
                displayAdjustments: {
                    fidelity: { saturationOffset: -0.01, spectralGainScale: 0.68 },
                    'low-light-recognition': {
                        current: { saturation: 0.98, contrast: 0.985, blurPx: 0.10, spectralGain: 0.06, recognitionBoost: 0 },
                        optimized: { saturation: 1.015, contrast: 1.025, blurPx: 0.02, spectralGain: 0.20, recognitionBoost: 0.72 }
                    },
                    'colour-enhancement': { saturationOffset: -0.015, contrastOffset: 0.01, spectralGainScale: 0.76, recognitionBoostScale: 0.82 }
                }
            },
            findings: [
                { id: 'textileTone', labelCN: '织物底色', type: 'anchor-stability' },
                { id: 'textileColourSeparation', labelCN: '综合色彩分离', type: 'distinction', distinctionKey: 'textileColourSeparation' },
                { id: 'threadHierarchy', labelCN: '丝线层次', type: 'distinction', distinctionKey: 'threadHierarchy' },
                { id: 'stitchDetail', labelCN: '针脚细节', type: 'distinction', distinctionKey: 'stitchDetail' }
            ],
            previewNoteCN: '颜色保真保持织物底色和主要染色色相；低照度模式提高红粉、蓝绿、金黄丝线的分离以及深色轮廓和针脚细节；色彩增强控制在丝织物柔和、细密和局部光泽的材质特征内。',
            lightingDefaults: { targetIlluminance: 50, targetCct: 3500 },
            modeOverrides: {
                fidelity: {
                    descriptionCN: '控制织物底色、红粉丝线、蓝绿丝线和金黄丝线的综合色差，保持丝织物综合色调与光泽。',
                    minRf: 91, minRg: 95, targetRg: 100, maxRg: 108,
                    maxWhiteDeltaE00: 2.2, maxCobaltAbsDeltaH: 3.4,
                    maxMeanDeltaE00: 3.2, maxDeltaE00: 5.2,
                    distinctionGain: 0, chromaGain: 0.2,
                    weights: { mean: 1, worst: 0.5, white: 1.1, hue: 1, distinction: 0.2, chroma: 0.1, rg: 0.08 }
                },
                'low-light-recognition': {
                    descriptionCN: '在 Rg 110 以上保持织物底色稳定，提高彩色丝线分离、深色轮廓和针脚细节辨识度。',
                    minRf: 80, minRg: 110, targetRg: 110.5, maxRg: 113,
                    maxWhiteDeltaE00: 2.6, maxCobaltAbsDeltaH: 6.2,
                    maxMeanDeltaE00: 4.2, maxDeltaE00: 6.5,
                    distinctionGain: 0.09, chromaGain: 0.45,
                    weights: { mean: 0.36, worst: 0.32, white: 1.1, hue: 1, distinction: 1.7, chroma: 0.35, rg: 1.7 }
                },
                'colour-enhancement': {
                    descriptionCN: '适度提高红粉、蓝绿和金黄丝线的综合色彩，同时保持织物底色、深色轮廓和针脚光泽。',
                    minRf: 84, minRg: 104, targetRg: 109, maxRg: 113,
                    maxWhiteDeltaE00: 3, maxCobaltAbsDeltaH: 4,
                    maxMeanDeltaE00: 4.6, maxDeltaE00: 7,
                    distinctionGain: 0.07, chromaGain: 0.9,
                    weights: { mean: 0.32, worst: 0.28, white: 0.9, hue: 1, distinction: 1.15, chroma: 0.85, rg: 0.7 }
                }
            }
        }),
        createExhibit({
            id: 'qing_qianlong_cloisonne_floral_vase',
            nameCN: '清乾隆掐丝珐琅花卉纹瓶',
            category: 'cloisonne',
            descriptionCN: '以浅色珐琅地、钴蓝、蓝绿、红色、黄色釉面和鎏金掐丝验证综合色彩分离、蓝绿层次及细金属纹样在低照度下的表现。',
            defaultSampleId: 'cloisonne_ground_light',
            appearanceSource: {
                type: 'local-transparent-cutout',
                file: 'assets/appearance/museum/qing-qianlong-cloisonne-floral-vase-cutout.png',
                sourcePage: 'https://www.metmuseum.org/art/collection/search/40732',
                label: '清乾隆掐丝珐琅花卉纹瓶透明底图',
                licenseCN: '大都会艺术博物馆公共领域图像，可用于商业和非商业用途。',
                notes: '清乾隆时期铜胎掐丝珐琅花卉纹瓶，本地透明底图仅保留器物主体；工程反射率模型负责珐琅颜色和金属掐丝计算。'
            },
            sampleIds: ['cloisonne_ground_light', 'cloisonne_cobalt_blue', 'cloisonne_blue_green', 'cloisonne_red', 'cloisonne_yellow', 'cloisonne_gilt_wire'],
            evaluationProfile: {
                anchorSampleId: 'cloisonne_ground_light',
                hueControlSampleIds: ['cloisonne_cobalt_blue', 'cloisonne_blue_green', 'cloisonne_red', 'cloisonne_yellow', 'cloisonne_gilt_wire'],
                chromaSampleIds: ['cloisonne_cobalt_blue', 'cloisonne_blue_green', 'cloisonne_red', 'cloisonne_yellow'],
                distinctionGroups: {
                    cloisonneColourSeparation: {
                        labelCN: '综合色彩分离',
                        aggregation: 'average',
                        pairs: [
                            ['cloisonne_ground_light', 'cloisonne_cobalt_blue'],
                            ['cloisonne_ground_light', 'cloisonne_red'],
                            ['cloisonne_ground_light', 'cloisonne_yellow'],
                            ['cloisonne_cobalt_blue', 'cloisonne_red']
                        ]
                    },
                    cloisonneBlueGreen: {
                        labelCN: '蓝绿层次',
                        aggregation: 'minimum',
                        pairs: [
                            ['cloisonne_cobalt_blue', 'cloisonne_blue_green'],
                            ['cloisonne_blue_green', 'cloisonne_ground_light']
                        ]
                    },
                    cloisonneWireDetail: {
                        labelCN: '掐丝纹样细节',
                        aggregation: 'minimum',
                        pairs: [
                            ['cloisonne_gilt_wire', 'cloisonne_yellow'],
                            ['cloisonne_gilt_wire', 'cloisonne_ground_light'],
                            ['cloisonne_gilt_wire', 'cloisonne_cobalt_blue']
                        ]
                    }
                }
            },
            previewProfile: {
                classifier: 'cloisonne-enamel',
                luminanceLock: 'anchor',
                fallbackSampleId: 'cloisonne_ground_light',
                recognitionSampleIds: ['cloisonne_cobalt_blue', 'cloisonne_blue_green', 'cloisonne_red', 'cloisonne_yellow', 'cloisonne_gilt_wire'],
                localRecognition: {
                    cloisonne_cobalt_blue: { contrast: 0.10, saturation: 0.055, lightness: -0.5 },
                    cloisonne_blue_green: { contrast: 0.10, saturation: 0.055, lightness: 0.2 },
                    cloisonne_red: { contrast: 0.08, saturation: 0.045, lightness: 0 },
                    cloisonne_yellow: { contrast: 0.08, saturation: 0.035, lightness: 0.3 },
                    cloisonne_gilt_wire: { contrast: 0.13, saturation: 0.025, lightness: 1.2 }
                },
                displayAdjustments: {
                    fidelity: { saturationOffset: -0.01, spectralGainScale: 0.68 },
                    'low-light-recognition': {
                        current: { saturation: 0.98, contrast: 0.985, blurPx: 0.08, spectralGain: 0.06, recognitionBoost: 0 },
                        optimized: { saturation: 1.015, contrast: 1.03, blurPx: 0.02, spectralGain: 0.20, recognitionBoost: 0.72 }
                    },
                    'colour-enhancement': { saturationOffset: -0.01, contrastOffset: 0.01, spectralGainScale: 0.78, recognitionBoostScale: 0.82 }
                }
            },
            findings: [
                { id: 'cloisonneTone', labelCN: '珐琅底色稳定', type: 'anchor-stability' },
                { id: 'cloisonneColourSeparation', labelCN: '综合色彩分离', type: 'distinction', distinctionKey: 'cloisonneColourSeparation' },
                { id: 'cloisonneBlueGreen', labelCN: '蓝绿层次', type: 'distinction', distinctionKey: 'cloisonneBlueGreen' },
                { id: 'cloisonneWireDetail', labelCN: '掐丝纹样细节', type: 'distinction', distinctionKey: 'cloisonneWireDetail' }
            ],
            previewNoteCN: '颜色保真保持浅色珐琅地和各釉色综合色相；低照度模式提高钴蓝、蓝绿、红黄釉面的分离以及细金属掐丝辨识；色彩增强控制釉面饱和度并保留鎏金质感。',
            lightingDefaults: { targetIlluminance: 80, targetCct: 3500 },
            modeOverrides: {
                fidelity: {
                    descriptionCN: '控制浅色珐琅地、蓝绿、红黄釉面和鎏金掐丝的综合色差，保持釉色与金属色相稳定。',
                    minRf: 91, minRg: 95, targetRg: 100, maxRg: 108,
                    maxWhiteDeltaE00: 2.2, maxCobaltAbsDeltaH: 3.4,
                    maxMeanDeltaE00: 3.2, maxDeltaE00: 5.2,
                    distinctionGain: 0, chromaGain: 0.2,
                    weights: { mean: 1, worst: 0.5, white: 1.1, hue: 1, distinction: 0.2, chroma: 0.1, rg: 0.08 }
                },
                'low-light-recognition': {
                    descriptionCN: '在 Rg 110 以上保持浅色珐琅地稳定，提高综合色彩分离、蓝绿层次和细金属掐丝辨识度。',
                    minRf: 80, minRg: 110, targetRg: 110.5, maxRg: 113,
                    maxWhiteDeltaE00: 2.6, maxCobaltAbsDeltaH: 7,
                    maxMeanDeltaE00: 4.2, maxDeltaE00: 6.5,
                    distinctionGain: 0.09, chromaGain: 0.45,
                    weights: { mean: 0.36, worst: 0.32, white: 1.1, hue: 1, distinction: 1.7, chroma: 0.35, rg: 1.7 }
                },
                'colour-enhancement': {
                    descriptionCN: '适度提高蓝绿、红黄珐琅的综合色彩表现，同时保持浅色底面、鎏金掐丝和釉面高光。',
                    minRf: 84, minRg: 104, targetRg: 109, maxRg: 113,
                    maxWhiteDeltaE00: 3, maxCobaltAbsDeltaH: 4,
                    maxMeanDeltaE00: 4.6, maxDeltaE00: 7,
                    distinctionGain: 0.07, chromaGain: 0.9,
                    weights: { mean: 0.32, worst: 0.28, white: 0.9, hue: 1, distinction: 1.15, chroma: 0.85, rg: 0.7 }
                }
            }
        }),
        createExhibit({
            id: 'northern_song_guanyin',
            nameCN: '北宋彩绘木雕观音菩萨像',
            category: 'painted-wood-sculpture',
            descriptionCN: '以人物肤色、暖红残彩、鎏金饰物、蓝绿彩绘、深色木质凹槽和石英宝石高光验证低照度下的肤色、复合材质与雕刻细节表现。',
            defaultSampleId: 'guanyin_skin',
            appearanceSource: {
                type: 'local-transparent-cutout',
                file: 'assets/appearance/museum/northern-song-guanyin-cutout.png',
                sourcePage: 'https://www.metmuseum.org/art/collection/search/42725',
                label: '北宋彩绘木雕观音菩萨像透明底图',
                licenseCN: '大都会艺术博物馆公共领域图像，可用于商业和非商业用途。',
                notes: '10世纪晚期至11世纪初彩绘木雕观音菩萨像，材质含地黄木、彩绘、鎏金、石英和红玉髓；本地透明底图仅用于视觉展示与区域映射。'
            },
            sampleIds: ['guanyin_skin', 'guanyin_warm_red', 'guanyin_gilt', 'guanyin_blue_green_pigment', 'guanyin_dark_wood_recess', 'guanyin_quartz_highlight'],
            evaluationProfile: {
                anchorSampleId: 'guanyin_skin',
                hueControlSampleIds: ['guanyin_warm_red', 'guanyin_gilt', 'guanyin_blue_green_pigment'],
                chromaSampleIds: ['guanyin_warm_red', 'guanyin_gilt', 'guanyin_blue_green_pigment'],
                distinctionGroups: {
                    guanyinSkinGilt: {
                        labelCN: '肤色与金饰分离',
                        aggregation: 'average',
                        pairs: [
                            ['guanyin_skin', 'guanyin_gilt'],
                            ['guanyin_skin', 'guanyin_warm_red'],
                            ['guanyin_gilt', 'guanyin_blue_green_pigment']
                        ]
                    },
                    guanyinPaintGilt: {
                        labelCN: '彩绘与金色层次',
                        aggregation: 'average',
                        pairs: [
                            ['guanyin_gilt', 'guanyin_warm_red'],
                            ['guanyin_gilt', 'guanyin_blue_green_pigment'],
                            ['guanyin_warm_red', 'guanyin_blue_green_pigment']
                        ]
                    },
                    guanyinFacialDrapery: {
                        labelCN: '五官与衣纹细节',
                        aggregation: 'minimum',
                        pairs: [
                            ['guanyin_skin', 'guanyin_dark_wood_recess'],
                            ['guanyin_quartz_highlight', 'guanyin_dark_wood_recess'],
                            ['guanyin_gilt', 'guanyin_dark_wood_recess']
                        ]
                    }
                }
            },
            previewProfile: {
                classifier: 'painted-wood-guanyin',
                luminanceLock: 'anchor',
                fallbackSampleId: 'guanyin_skin',
                recognitionSampleIds: ['guanyin_warm_red', 'guanyin_gilt', 'guanyin_blue_green_pigment', 'guanyin_dark_wood_recess', 'guanyin_quartz_highlight'],
                localRecognition: {
                    guanyin_warm_red: { contrast: 0.08, saturation: 0.04, lightness: 0 },
                    guanyin_gilt: { contrast: 0.09, saturation: 0.03, lightness: 0.6 },
                    guanyin_blue_green_pigment: { contrast: 0.12, saturation: 0.06, lightness: 0.2 },
                    guanyin_dark_wood_recess: { contrast: 0.20, saturation: 0.01, lightness: -2.8 },
                    guanyin_quartz_highlight: { contrast: 0.11, saturation: 0.005, lightness: 1.5 }
                },
                displayAdjustments: {
                    fidelity: { saturationOffset: -0.01, spectralGainScale: 0.68 },
                    'low-light-recognition': {
                        current: { saturation: 0.98, contrast: 0.985, blurPx: 0.08, spectralGain: 0.06, recognitionBoost: 0 },
                        optimized: { saturation: 1.012, contrast: 1.03, blurPx: 0.02, spectralGain: 0.20, recognitionBoost: 0.75 }
                    },
                    'colour-enhancement': { saturationOffset: -0.015, contrastOffset: 0.01, spectralGainScale: 0.76, recognitionBoostScale: 0.82 }
                }
            },
            findings: [
                { id: 'guanyinSkinTone', labelCN: '肤色稳定', type: 'anchor-stability' },
                { id: 'guanyinSkinGilt', labelCN: '肤色与金饰分离', type: 'distinction', distinctionKey: 'guanyinSkinGilt' },
                { id: 'guanyinPaintGilt', labelCN: '彩绘与金色层次', type: 'distinction', distinctionKey: 'guanyinPaintGilt' },
                { id: 'guanyinFacialDrapery', labelCN: '五官与衣纹细节', type: 'distinction', distinctionKey: 'guanyinFacialDrapery' }
            ],
            previewNoteCN: '颜色保真保持面部与双手肤色、暖红残彩和鎏金综合色相；低照度模式提高肤色与金饰分离、蓝绿残彩及五官衣纹细节；色彩增强控制在旧化彩绘和木质材质的自然范围内。',
            lightingDefaults: { targetIlluminance: 50, targetCct: 3500 },
            modeOverrides: {
                fidelity: {
                    descriptionCN: '控制人物肤色、暖红残彩、鎏金和蓝绿彩绘的综合色差，保持肤色自然与旧化材质关系。',
                    minRf: 91, minRg: 95, targetRg: 100, maxRg: 108,
                    maxWhiteDeltaE00: 2.0, maxCobaltAbsDeltaH: 3.6,
                    maxMeanDeltaE00: 3.2, maxDeltaE00: 5.2,
                    distinctionGain: 0, chromaGain: 0.15,
                    weights: { mean: 1, worst: 0.5, white: 1.25, hue: 1.05, distinction: 0.2, chroma: 0.08, rg: 0.08 }
                },
                'low-light-recognition': {
                    descriptionCN: '在 Rg 110 以上保持肤色稳定，提高肤色与金饰分离、残存彩绘、五官和衣纹细节辨识度。',
                    minRf: 80, minRg: 110, targetRg: 110.5, maxRg: 113,
                    maxWhiteDeltaE00: 2.4, maxCobaltAbsDeltaH: 7,
                    maxMeanDeltaE00: 4.2, maxDeltaE00: 6.5,
                    distinctionGain: 0.09, chromaGain: 0.40,
                    weights: { mean: 0.36, worst: 0.32, white: 1.3, hue: 1.05, distinction: 1.75, chroma: 0.3, rg: 1.7 }
                },
                'colour-enhancement': {
                    descriptionCN: '适度提高暖红、蓝绿残彩和鎏金表现，同时保持人物肤色、深色木质和宝石高光。',
                    minRf: 84, minRg: 104, targetRg: 109, maxRg: 113,
                    maxWhiteDeltaE00: 2.8, maxCobaltAbsDeltaH: 5,
                    maxMeanDeltaE00: 4.6, maxDeltaE00: 7,
                    distinctionGain: 0.07, chromaGain: 0.8,
                    weights: { mean: 0.32, worst: 0.28, white: 1.15, hue: 1, distinction: 1.2, chroma: 0.75, rg: 0.7 }
                }
            }
        }),
        createExhibit({
            id: 'roesen_still_life_flowers_fruit',
            nameCN: '花卉与水果静物油画',
            category: 'oil-painting',
            descriptionCN: '以浅色花瓣、红橙水果、黄色果实、绿色叶片、蓝紫花朵和深色背景验证综合色彩密集型油画在低照度下的综合色彩分离与暗部细节。',
            defaultSampleId: 'oil_light_petals',
            appearanceSource: {
                type: 'local-artwork-image',
                file: 'assets/appearance/museum/roesen-still-life-flowers-fruit.svg',
                sourcePage: 'https://www.metmuseum.org/art/collection/search/11938',
                label: 'Severin Roesen《Still Life: Flowers and Fruit》完整画面',
                licenseCN: '大都会艺术博物馆公共领域图像，可用于商业和非商业用途。',
                notes: '1850–55 年油彩画布作品，藏品编号 67.111；本地画面保留完整深色背景与画布构图，仅用于视觉展示和区域映射，工程反射率模型负责计算。'
            },
            sampleIds: ['oil_light_petals', 'oil_red_orange', 'oil_yellow_gold', 'oil_green_foliage', 'oil_blue_violet', 'oil_dark_background'],
            evaluationProfile: {
                anchorSampleId: 'oil_light_petals',
                hueControlSampleIds: ['oil_red_orange', 'oil_yellow_gold', 'oil_green_foliage', 'oil_blue_violet'],
                chromaSampleIds: ['oil_red_orange', 'oil_yellow_gold', 'oil_green_foliage', 'oil_blue_violet'],
                distinctionGroups: {
                    oilFruitSeparation: {
                        labelCN: '红黄水果分离',
                        aggregation: 'average',
                        pairs: [
                            ['oil_red_orange', 'oil_yellow_gold'],
                            ['oil_red_orange', 'oil_light_petals'],
                            ['oil_yellow_gold', 'oil_green_foliage']
                        ]
                    },
                    oilColourHierarchy: {
                        labelCN: '花叶综合色彩层次',
                        aggregation: 'average',
                        pairs: [
                            ['oil_red_orange', 'oil_yellow_gold'],
                            ['oil_yellow_gold', 'oil_green_foliage'],
                            ['oil_green_foliage', 'oil_blue_violet'],
                            ['oil_blue_violet', 'oil_red_orange']
                        ]
                    },
                    oilDarkDetail: {
                        labelCN: '暗部与细节辨识',
                        aggregation: 'minimum',
                        pairs: [
                            ['oil_dark_background', 'oil_green_foliage'],
                            ['oil_dark_background', 'oil_blue_violet'],
                            ['oil_dark_background', 'oil_light_petals']
                        ]
                    }
                }
            },
            previewProfile: {
                classifier: 'oil-still-life-roesen',
                luminanceLock: 'anchor',
                fallbackSampleId: 'oil_light_petals',
                recognitionSampleIds: ['oil_red_orange', 'oil_yellow_gold', 'oil_green_foliage', 'oil_blue_violet', 'oil_dark_background'],
                localRecognition: {
                    oil_red_orange: { contrast: 0, saturation: 0.29, lightness: 0 },
                    oil_yellow_gold: { contrast: 0, saturation: 0.24, lightness: 0 },
                    oil_green_foliage: { contrast: 0, saturation: 0.34, lightness: 0 },
                    oil_blue_violet: { contrast: 0, saturation: 0.36, lightness: 0 },
                    oil_dark_background: { contrast: 0, saturation: 0, lightness: 0 }
                },
                displayAdjustments: {
                    fidelity: { saturationOffset: -0.01, spectralGainScale: 0.68 },
                    'low-light-recognition': {
                        current: { saturation: 0.98, contrast: 0.985, blurPx: 0.08, spectralGain: 0.06, recognitionBoost: 0 },
                        optimized: { saturation: 1.015, contrast: 0.985, blurPx: 0.02, spectralGain: 0.21, recognitionBoost: 0.76 }
                    },
                    'colour-enhancement': { saturationOffset: -0.01, contrastOffset: 0.01, spectralGainScale: 0.78, recognitionBoostScale: 0.84 }
                }
            },
            findings: [
                { id: 'oilTone', labelCN: '浅色综合色调稳定', type: 'anchor-stability', stabilityBasis: 'absolute' },
                { id: 'oilFruitSeparation', labelCN: '红黄水果分离', type: 'distinction', distinctionKey: 'oilFruitSeparation' },
                { id: 'oilColourHierarchy', labelCN: '花叶综合色彩层次', type: 'distinction', distinctionKey: 'oilColourHierarchy' },
                { id: 'oilDarkDetail', labelCN: '暗部与细节辨识', type: 'distinction', distinctionKey: 'oilDarkDetail' }
            ],
            previewNoteCN: '颜色保真保持浅色花瓣和主要颜料综合色相；低照度模式提高红黄水果、绿色叶片、蓝紫花朵和深色背景之间的分离；色彩增强控制油画综合色彩密度并保留暗部和笔触层次。',
            lightingDefaults: { targetIlluminance: 50, targetCct: 3500 },
            modeOverrides: {
                fidelity: {
                    descriptionCN: '控制浅色花瓣、红橙、黄、绿和蓝紫颜料的综合色差，保持油画综合色彩关系和深色背景。',
                    minRf: 91, minRg: 95, targetRg: 100, maxRg: 108,
                    maxWhiteDeltaE00: 2.2, maxCobaltAbsDeltaH: 3.6,
                    maxMeanDeltaE00: 3.2, maxDeltaE00: 5.2,
                    distinctionGain: 0, chromaGain: 0.2,
                    weights: { mean: 1, worst: 0.5, white: 1.1, hue: 1, distinction: 0.2, chroma: 0.1, rg: 0.08 }
                },
                'low-light-recognition': {
                    descriptionCN: '在 Rg 110 以上保持油画浅色综合色调稳定，提高花果综合色彩分离和深色暗部细节辨识度。',
                    minRf: 80, minRg: 110, targetRg: 110.5, maxRg: 113,
                    maxWhiteDeltaE00: 2.6, maxCobaltAbsDeltaH: 7,
                    maxMeanDeltaE00: 4.2, maxDeltaE00: 6.5,
                    distinctionGain: 0.09, chromaGain: 0.45,
                    weights: { mean: 0.36, worst: 0.32, white: 3, hue: 1, distinction: 1.75, chroma: 0.35, rg: 1.7 }
                },
                'colour-enhancement': {
                    descriptionCN: '适度提高红橙、黄色、绿色和蓝紫颜料的综合色彩表现，同时保持浅色花瓣、暗背景和局部细节。',
                    minRf: 84, minRg: 104, targetRg: 109, maxRg: 113,
                    maxWhiteDeltaE00: 3, maxCobaltAbsDeltaH: 4.5,
                    maxMeanDeltaE00: 4.6, maxDeltaE00: 7,
                    distinctionGain: 0.07, chromaGain: 0.9,
                    weights: { mean: 0.32, worst: 0.28, white: 0.9, hue: 1, distinction: 1.2, chroma: 0.85, rg: 0.7 }
                }
            }
        })
    ]);

    const exhibitById = Object.freeze(Object.fromEntries(exhibits.map(function (item) { return [item.id, item]; })));
    const defaultExhibitId = exhibits[0].id;

    const modes = deepFreeze([
        {
            id: 'fidelity', nameCN: '颜色保真', descriptionCN: '降低综合色差并保持关键颜色和中性色稳定。',
            minRf: 90, minRg: 95, targetRg: 100, maxRg: 108, maxWhiteDeltaE00: 2.2, maxCobaltAbsDeltaH: 3,
            maxMeanDeltaE00: 3, maxDeltaE00: 5, distinctionGain: 0, chromaGain: 0,
            weights: { mean: 1, worst: 0.45, white: 0.8, hue: 0.7, distinction: 0.1, chroma: 0.05, rg: 0.1 }
        },
        {
            id: 'low-light-recognition', nameCN: '低照度颜色辨识', descriptionCN: '按展品的关键区域提高低照度下的颜色与细节分辨力。',
            minRf: 84, minRg: 110, targetRg: 112, maxRg: 116, maxWhiteDeltaE00: 2.8, maxCobaltAbsDeltaH: 3.5,
            maxMeanDeltaE00: 4.5, maxDeltaE00: 6.5, distinctionGain: 0.08, chromaGain: 0.8,
            weights: { mean: 0.25, worst: 0.25, white: 0.8, hue: 0.75, distinction: 1.35, chroma: 0.35, rg: 2.4 }
        },
        {
            id: 'colour-enhancement', nameCN: '色彩表现增强', descriptionCN: '适度提高展品重点颜色的彩度与层次，同时控制中性色和色相偏移。',
            minRf: 83, minRg: 108, targetRg: 113, maxRg: 115, maxWhiteDeltaE00: 2.8, maxCobaltAbsDeltaH: 3.8,
            maxMeanDeltaE00: 4.8, maxDeltaE00: 7, distinctionGain: 0.06, chromaGain: 1.35,
            weights: { mean: 0.25, worst: 0.22, white: 0.8, hue: 0.7, distinction: 0.8, chroma: 1.1, rg: 1.2 }
        }
    ]);
    const modeById = Object.freeze(Object.fromEntries(modes.map(function (mode) { return [mode.id, mode]; })));

    function listSamples() { return samples.slice(); }
    function getSample(id) { return sampleById[id] || null; }
    function listExhibits() { return exhibits.slice(); }
    function getExhibit(id) { return exhibitById[id] || null; }
    function getDefaultExhibit() { return exhibitById[defaultExhibitId]; }
    function getExhibitSamples(id) {
        const exhibit = getExhibit(id);
        return exhibit ? exhibit.sampleIds.map(function (sampleId) { return getSample(sampleId); }).filter(Boolean) : [];
    }
    function listModes() { return modes.slice(); }
    function getMode(id) { return modeById[id] || null; }

    function resolveModeSettings(modeId, strength, exhibitId) {
        const mode = getMode(modeId);
        if (!mode) throw new Error('Unknown museum mode: ' + modeId);
        const normalizedStrength = Object.prototype.hasOwnProperty.call(STRENGTH_SCALE, strength)
            ? strength : 'recommended';
        const scale = STRENGTH_SCALE[normalizedStrength];
        const exhibit = exhibitId ? getExhibit(exhibitId) : null;
        const override = exhibit && exhibit.modeOverrides && exhibit.modeOverrides[modeId]
            ? exhibit.modeOverrides[modeId] : {};
        const merged = Object.assign({}, mode, override);
        return deepFreeze(Object.assign({}, merged, {
            modeId: mode.id,
            strength: normalizedStrength,
            distinctionGain: Number(merged.distinctionGain || 0) * scale,
            chromaGain: Number(merged.chromaGain || 0) * scale,
            weights: Object.assign({}, mode.weights, override.weights || {})
        }));
    }

    return Object.freeze({
        wavelengths,
        dataQualification: DATA_QUALIFICATION,
        strengthScale: STRENGTH_SCALE,
        samples,
        exhibits,
        exhibit: getDefaultExhibit(),
        listSamples,
        getSample,
        listExhibits,
        getExhibit,
        getDefaultExhibit,
        getExhibitSamples,
        listModes,
        getMode,
        resolveModeSettings
    });
});
