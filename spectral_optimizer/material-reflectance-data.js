/*
 * Material reflectance models for the spectral optimizer.
 *
 * Each material now separates two independently-sourced pieces of evidence:
 *   - appearanceSource  — where the visual texture / photo comes from
 *   - spectralSource    — where the 380–780 nm reflectance curve comes from
 *
 * This avoids the misleading practice of binding a photo of one sample to the
 * reflectance curve of a different sample.  When the two sources are genuinely
 * from the same physical specimen the source metadata will make that clear;
 * otherwise the UI shows both sources honestly.
 *
 * Data qualification:
 * - USGS / ECOSTRESS entries are laboratory measured reflectance.
 * - "engineering" entries use anchor-point interpolation and are clearly labelled
 *   as representative engineering models — not raw measured data.
 * - User-uploaded materials carry their own provenance metadata.
 */
(function (root, factory) {
    const data = factory();
    if (typeof module === 'object' && module.exports) module.exports = data;
    if (root) root.MATERIAL_REFLECTANCE_DATA = data;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    const wavelengths = Object.freeze(Array.from({ length: 81 }, function (_, index) { return 380 + index * 5; }));
    var DATA_QUALIFICATION = 'representative engineering reflectance model; not raw measured data';

    function clampReflectance(value) {
        return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
    }

    function interpolateAnchors(anchors) {
        var sorted = anchors.slice().sort(function (a, b) { return a[0] - b[0]; });
        return Object.freeze(wavelengths.map(function (wavelength) {
            if (wavelength <= sorted[0][0]) return clampReflectance(sorted[0][1]);
            if (wavelength >= sorted[sorted.length - 1][0]) return clampReflectance(sorted[sorted.length - 1][1]);
            for (var index = 1; index < sorted.length; index++) {
                var right = sorted[index];
                if (wavelength <= right[0]) {
                    var left = sorted[index - 1];
                    var ratio = (wavelength - left[0]) / (right[0] - left[0]);
                    return clampReflectance(left[1] + (right[1] - left[1]) * ratio);
                }
            }
            return clampReflectance(sorted[sorted.length - 1][1]);
        }));
    }

    function measuredSeries(values) {
        var samples = String(values).trim().split(/\s+/).map(Number);
        if (samples.length !== wavelengths.length || samples.some(function (value) { return !Number.isFinite(value); })) {
            throw new Error('Measured reflectance series must contain ' + wavelengths.length + ' values.');
        }
        return Object.freeze(samples.map(clampReflectance));
    }

    /*
     * Material factory.
     *
     * appearanceSource  { type, label, origin, file?, dataUrl? }
     *   type:  'texture' (procedural SVG) | 'photo' (real photograph) | 'none'
     *
     * spectralSource    { type, label, url?, sampleId?, notes?, dataQualification? }
     *   type:  'measured' | 'engineering' | 'user_csv'
     */
    function material(definition) {
        // Build appearanceSource with defaults
        var appSrc = Object.assign({
            type: 'texture',
            label: '程序生成纹理',
            origin: 'procedural SVG (feTurbulence)',
            file: definition.id + '.svg'
        }, definition.appearanceSource || {});

        // Build spectralSource with defaults
        var specSrc = Object.assign({
            type: definition.sourceType || 'engineering',
            label: definition.sourceType === 'measured'
                ? (definition.sourceName || '实测光谱数据库')
                : '工程近似曲线',
            dataQualification: definition.dataQualification || DATA_QUALIFICATION
        }, definition.spectralSource || {});

        // Ensure url / sampleId carry over from legacy fields if not explicitly set
        if (!specSrc.url && definition.sourceUrl) specSrc.url = definition.sourceUrl;
        if (!specSrc.sampleId && definition.sourceSample) specSrc.sampleId = definition.sourceSample;

        return Object.freeze({
            id: definition.id,
            name: definition.name,
            nameCN: definition.nameCN,
            category: definition.category,
            targetHueZone: definition.targetHueZone,
            intendedUse: definition.intendedUse,
            intendedUseCN: definition.intendedUseCN,

            // New dual-source tracking
            appearanceSource: Object.freeze(appSrc),
            spectralSource: Object.freeze(specSrc),

            // Legacy fields — kept for material-color.js backward compatibility
            dataQualification: specSrc.dataQualification,
            sourceType: specSrc.type,
            sourceName: specSrc.label,
            sourceUrl: specSrc.url || '',
            sourceSample: specSrc.sampleId || '',

            // Reflectance
            reflectance: definition.samples || interpolateAnchors(definition.anchors),
            anchors: Object.freeze((definition.anchors || []).map(function (pair) { return Object.freeze(pair.slice()); }))
        });
    }

    /* =========================================================================
     * Material definitions
     * ========================================================================= */

    var materials = Object.freeze([

        /* ---- WOOD 木材 (3) ---- */

        material({
            id: 'wood_warm_oak',
            name: 'Light wood / fresh pine plywood spectrum',
            nameCN: '浅色木材',
            category: 'wood',
            targetHueZone: 'red-orange-yellow',
            intendedUse: 'wood, veneer, warm interior finish optimisation',
            intendedUseCN: '用于浅色木材与木饰面的光谱比较；外观纹理为代表性示意。',
            appearanceSource: {
                type: 'texture',
                label: '本地代表性纹理',
                origin: 'curated local appearance atlas',
                file: 'assets/material-texture-atlas.png'
            },
            spectralSource: {
                type: 'measured',
                label: 'USGS Spectral Library Version 7',
                url: 'https://doi.org/10.5066/F7RR1WDJ',
                sampleId: 'Plywood GDS365 Fresh Pine ASDFRa AREF',
                notes: 'CC0 1.0 — laboratory measured reflectance',
                dataQualification: 'USGS laboratory measured reflectance; CC0 1.0'
            },
            sourceType: 'measured',
            sourceName: 'USGS Spectral Library Version 7',
            sourceUrl: 'https://doi.org/10.5066/F7RR1WDJ',
            sourceSample: 'Plywood GDS365 Fresh Pine ASDFRa AREF',
            dataQualification: 'USGS laboratory measured reflectance; CC0 1.0',
            samples: measuredSeries('0.074889 0.079505 0.084968 0.091822 0.100394 0.110941 0.123211 0.13672 0.150203 0.162582 0.173407 0.182414 0.189905 0.196377 0.202122 0.207429 0.212414 0.217134 0.221604 0.225973 0.230208 0.234486 0.238951 0.243634 0.248601 0.253771 0.259236 0.265093 0.271406 0.27829 0.285831 0.29399 0.302721 0.311997 0.321761 0.33197 0.342538 0.353455 0.36466 0.376211 0.388144 0.400338 0.412747 0.425141 0.437627 0.450342 0.46301 0.475742 0.48858 0.501279 0.513726 0.52597 0.537869 0.549365 0.560472 0.571078 0.58117 0.590834 0.600113 0.609041 0.617683 0.626059 0.634274 0.642328 0.650159 0.65786 0.665413 0.672685 0.679675 0.686294 0.692549 0.698355 0.703601 0.70842 0.712559 0.716504 0.720175 0.723618 0.726987 0.730329 0.733636')
        }),
        material({
            id: 'wood_dark_walnut',
            name: 'Dark walnut wood',
            nameCN: '深胡桃木饰面',
            category: 'wood',
            targetHueZone: 'red-orange-brown',
            intendedUse: 'dark wood and warm brown material optimisation',
            intendedUseCN: '用于深色木材与暖棕色材料的光谱比较；外观纹理为代表性示意。',
            appearanceSource: {
                type: 'texture',
                label: '本地代表性纹理',
                origin: 'curated local appearance atlas',
                file: 'assets/material-texture-atlas.png'
            },
            spectralSource: {
                type: 'engineering',
                label: '工程近似曲线',
                notes: '基于典型深色木材反射特征构建的 9 锚点插值模型',
                anchorCount: 9,
                dataQualification: '工程近似模型；实测光谱待补充'
            },
            anchors: [[380, 0.035], [400, 0.045], [450, 0.075], [500, 0.11], [550, 0.17], [600, 0.27], [650, 0.34], [700, 0.37], [780, 0.39]]
        }),
        material({
            id: 'wood_white_oak',
            name: 'White oak',
            nameCN: '白橡木饰面',
            category: 'wood',
            targetHueZone: 'yellow-orange',
            intendedUse: 'light and cool wood finish optimization',
            intendedUseCN: '用于浅色和冷色木饰面的光谱比较；外观纹理为代表性示意。',
            appearanceSource: {
                type: 'texture',
                label: '程序化浅色木纹纹理',
                origin: 'procedural SVG — light anisotropic noise grain',
                file: 'wood_white_oak.svg'
            },
            spectralSource: {
                type: 'engineering',
                label: '工程近似曲线',
                notes: '基于典型白橡木反射特征构建的 9 锚点插值模型',
                anchorCount: 9,
                dataQualification: '工程近似模型；实测光谱待补充'
            },
            anchors: [[380,0.12],[400,0.16],[450,0.24],[500,0.32],[550,0.42],[600,0.52],[650,0.58],[700,0.61],[780,0.63]]
        }),

        /* ---- STONE 石材 (3) ---- */

        material({
            id: 'stone_white_marble',
            name: 'White marble',
            nameCN: '白色大理石',
            category: 'stone',
            targetHueZone: 'neutral',
            intendedUse: 'white stone and high reflectance surface optimization',
            intendedUseCN: '用于白色石材与高反射率表面的光谱比较；外观纹理为代表性示意。',
            appearanceSource: {
                type: 'texture',
                label: '程序化大理石纹理',
                origin: 'procedural SVG — fractal noise vein pattern',
                file: 'stone_white_marble.svg'
            },
            spectralSource: {
                type: 'engineering',
                label: '工程近似曲线',
                notes: '基于典型白色大理石（高反射、中性色调）反射特征构建',
                anchorCount: 9,
                dataQualification: '工程近似模型；USGS 大理石实测光谱待导入'
            },
            anchors: [[380,0.62],[400,0.68],[450,0.74],[500,0.78],[550,0.80],[600,0.82],[650,0.83],[700,0.83],[780,0.82]]
        }),
        material({
            id: 'stone_grey_concrete',
            name: 'Grey concrete',
            nameCN: '灰色混凝土',
            category: 'stone',
            targetHueZone: 'neutral',
            intendedUse: 'grey stone and concrete surface optimization',
            intendedUseCN: '用于灰色石材与混凝土表面的光谱比较；外观纹理为代表性示意。',
            appearanceSource: {
                type: 'texture',
                label: '程序化混凝土纹理',
                origin: 'procedural SVG — fine noise grain',
                file: 'stone_grey_concrete.svg'
            },
            spectralSource: {
                type: 'engineering',
                label: '工程近似曲线',
                notes: '基于典型灰色混凝土（平坦中性反射）反射特征构建',
                anchorCount: 9,
                dataQualification: '工程近似模型；实测光谱待补充'
            },
            anchors: [[380,0.22],[400,0.25],[450,0.28],[500,0.30],[550,0.31],[600,0.32],[650,0.32],[700,0.32],[780,0.31]]
        }),
        material({
            id: 'stone_warm_sandstone',
            name: 'Warm sandstone',
            nameCN: '暖色砂岩',
            category: 'stone',
            targetHueZone: 'red-orange-yellow',
            intendedUse: 'warm stone and sandstone finish optimization',
            intendedUseCN: '用于暖色石材与砂岩的光谱比较；外观纹理为代表性示意。',
            appearanceSource: {
                type: 'texture',
                label: '程序化砂岩纹理',
                origin: 'procedural SVG — layered grain noise',
                file: 'stone_warm_sandstone.svg'
            },
            spectralSource: {
                type: 'engineering',
                label: '工程近似曲线',
                notes: '基于典型暖色砂岩（红-橙-黄渐变反射）反射特征构建',
                anchorCount: 9,
                dataQualification: '工程近似模型；实测光谱待补充'
            },
            anchors: [[380,0.12],[400,0.16],[450,0.22],[500,0.30],[550,0.40],[600,0.52],[650,0.58],[700,0.60],[780,0.61]]
        }),

        /* ---- FABRIC 织物 (4) ---- */

        material({
            id: 'fabric_warm_beige',
            name: 'Warm beige fabric',
            nameCN: '暖米色织物',
            category: 'fabric',
            targetHueZone: 'yellow-orange-neutral',
            intendedUse: 'fabric, curtain, upholstery and soft furnishing optimisation',
            intendedUseCN: '用于织物、窗帘、软包与软装材料的光谱比较；外观纹理为代表性示意。',
            appearanceSource: {
                type: 'texture',
                label: '本地代表性纹理',
                origin: 'curated local appearance atlas',
                file: 'assets/material-texture-atlas.png'
            },
            spectralSource: {
                type: 'engineering',
                label: '工程近似曲线',
                notes: '基于典型暖米色棉麻织物反射特征构建',
                anchorCount: 9,
                dataQualification: '工程近似模型；实测光谱待补充'
            },
            anchors: [[380,0.30],[400,0.35],[450,0.42],[500,0.48],[550,0.55],[600,0.62],[650,0.65],[700,0.66],[780,0.68]]
        }),
        material({
            id: 'fabric_dark_blue',
            name: 'Dark blue cotton-linen',
            nameCN: '深蓝棉麻',
            category: 'fabric',
            targetHueZone: 'blue',
            intendedUse: 'dark blue fabric and upholstery optimization',
            intendedUseCN: '用于深蓝色织物与软包的光谱比较；外观纹理为代表性示意。',
            appearanceSource: {
                type: 'texture',
                label: '程序化深色织物纹理',
                origin: 'procedural SVG — fine weave noise',
                file: 'fabric_dark_blue.svg'
            },
            spectralSource: {
                type: 'engineering',
                label: '工程近似曲线',
                notes: '基于典型深蓝色棉麻织物（蓝光区高反射、长波低反射）反射特征构建',
                anchorCount: 10,
                dataQualification: '工程近似模型；实测光谱待补充'
            },
            anchors: [[380,0.06],[420,0.12],[450,0.18],[480,0.16],[500,0.10],[550,0.06],[600,0.04],[650,0.035],[700,0.03],[780,0.03]]
        }),
        material({
            id: 'fabric_wine_velvet',
            name: 'Wine red velvet',
            nameCN: '酒红丝绒',
            category: 'fabric',
            targetHueZone: 'red',
            intendedUse: 'deep red fabric and velvet optimization',
            intendedUseCN: '用于深红色织物与丝绒的光谱比较；外观纹理为代表性示意。',
            appearanceSource: {
                type: 'texture',
                label: '程序化丝绒纹理',
                origin: 'procedural SVG — soft diffuse noise',
                file: 'fabric_wine_velvet.svg'
            },
            spectralSource: {
                type: 'engineering',
                label: '工程近似曲线',
                notes: '基于典型酒红色丝绒（长波红区陡升反射）反射特征构建',
                anchorCount: 10,
                dataQualification: '工程近似模型；实测光谱待补充'
            },
            anchors: [[380,0.04],[400,0.05],[450,0.04],[500,0.035],[550,0.04],[600,0.10],[640,0.28],[680,0.38],[700,0.40],[780,0.42]]
        }),
        material({
            id: 'fabric_grey_wool',
            name: 'Grey wool',
            nameCN: '灰色羊毛',
            category: 'fabric',
            targetHueZone: 'neutral',
            intendedUse: 'grey fabric and wool optimization',
            intendedUseCN: '用于灰色织物与羊毛的光谱比较；外观纹理为代表性示意。',
            appearanceSource: {
                type: 'texture',
                label: '程序化羊毛纹理',
                origin: 'procedural SVG — soft textured noise',
                file: 'fabric_grey_wool.svg'
            },
            spectralSource: {
                type: 'engineering',
                label: '工程近似曲线',
                notes: '基于典型灰色羊毛（平坦低反射）反射特征构建',
                anchorCount: 9,
                dataQualification: '工程近似模型；实测光谱待补充'
            },
            anchors: [[380,0.18],[400,0.20],[450,0.23],[500,0.25],[550,0.27],[600,0.28],[650,0.29],[700,0.29],[780,0.28]]
        }),

        /* ---- LEATHER 皮革 (3) ---- */

        material({
            id: 'leather_cognac',
            name: 'Cognac leather',
            nameCN: '干邑色皮革',
            category: 'leather',
            targetHueZone: 'red-orange-brown',
            intendedUse: 'leather, warm upholstery, hospitality material optimisation',
            intendedUseCN: '用于皮革、暖色软包与酒店材料的光谱比较；外观纹理为代表性示意。',
            appearanceSource: {
                type: 'texture',
                label: '本地代表性纹理',
                origin: 'curated local appearance atlas',
                file: 'assets/material-texture-atlas.png'
            },
            spectralSource: {
                type: 'engineering',
                label: '工程近似曲线',
                notes: '基于典型干邑色皮革（红-橙-棕渐变反射）反射特征构建',
                anchorCount: 9,
                dataQualification: '工程近似模型；实测光谱待补充'
            },
            anchors: [[380,0.035],[400,0.05],[450,0.085],[500,0.14],[550,0.23],[600,0.36],[650,0.46],[700,0.50],[780,0.52]]
        }),
        material({
            id: 'leather_black',
            name: 'Black leather',
            nameCN: '黑色皮革',
            category: 'leather',
            targetHueZone: 'neutral',
            intendedUse: 'black leather and low reflectance optimization',
            intendedUseCN: '用于黑色皮革与低反射率表面的光谱比较；外观纹理为代表性示意。',
            appearanceSource: {
                type: 'texture',
                label: '程序化黑色皮革纹理',
                origin: 'procedural SVG — dark diffuse grain',
                file: 'leather_black.svg'
            },
            spectralSource: {
                type: 'engineering',
                label: '工程近似曲线',
                notes: '基于典型黑色皮革（极低全波段反射）反射特征构建',
                anchorCount: 9,
                dataQualification: '工程近似模型；实测光谱待补充'
            },
            anchors: [[380,0.02],[400,0.025],[450,0.03],[500,0.035],[550,0.04],[600,0.045],[650,0.05],[700,0.055],[780,0.06]]
        }),
        material({
            id: 'leather_tan',
            name: 'Tan leather',
            nameCN: '棕褐色皮革',
            category: 'leather',
            targetHueZone: 'red-orange-yellow',
            intendedUse: 'tan leather and warm upholstery optimization',
            intendedUseCN: '用于棕褐色皮革与暖色软包的光谱比较；外观纹理为代表性示意。',
            appearanceSource: {
                type: 'texture',
                label: '程序化棕褐皮革纹理',
                origin: 'procedural SVG — warm diffuse grain',
                file: 'leather_tan.svg'
            },
            spectralSource: {
                type: 'engineering',
                label: '工程近似曲线',
                notes: '基于典型棕褐色皮革反射特征构建',
                anchorCount: 9,
                dataQualification: '工程近似模型；实测光谱待补充'
            },
            anchors: [[380,0.06],[400,0.085],[450,0.13],[500,0.19],[550,0.28],[600,0.40],[650,0.48],[700,0.52],[780,0.54]]
        }),

        /* ---- METAL 金属 (3) ---- */

        material({
            id: 'metal_stainless_steel',
            name: 'Brushed stainless steel',
            nameCN: '拉丝不锈钢',
            category: 'metal',
            targetHueZone: 'neutral',
            intendedUse: 'stainless steel and cool metal finish optimization',
            intendedUseCN: '用于不锈钢与冷色金属饰面的光谱比较；外观纹理为代表性示意。',
            appearanceSource: {
                type: 'texture',
                label: '程序化拉丝金属纹理',
                origin: 'procedural SVG — anisotropic brushed lines',
                file: 'metal_stainless_steel.svg'
            },
            spectralSource: {
                type: 'engineering',
                label: '工程近似曲线',
                notes: '基于典型不锈钢（平坦高反射）反射特征构建',
                anchorCount: 9,
                dataQualification: '工程近似模型；实测光谱待补充'
            },
            anchors: [[380,0.52],[400,0.54],[450,0.56],[500,0.57],[550,0.58],[600,0.58],[650,0.59],[700,0.59],[780,0.58]]
        }),
        material({
            id: 'metal_brass',
            name: 'Brass',
            nameCN: '黄铜饰面',
            category: 'metal',
            targetHueZone: 'yellow-orange',
            intendedUse: 'brass and warm golden metal finish optimization',
            intendedUseCN: '用于黄铜与暖金金属饰面的光谱比较；外观纹理为代表性示意。',
            appearanceSource: {
                type: 'texture',
                label: '程序化黄铜纹理',
                origin: 'procedural SVG — warm metallic noise',
                file: 'metal_brass.svg'
            },
            spectralSource: {
                type: 'engineering',
                label: '工程近似曲线',
                notes: '基于典型黄铜（短波截止、长波高反射的金属反射特征）构建',
                anchorCount: 9,
                dataQualification: '工程近似模型；实测光谱待补充'
            },
            anchors: [[380,0.28],[400,0.32],[450,0.38],[500,0.50],[550,0.62],[600,0.72],[650,0.76],[700,0.78],[780,0.79]]
        }),
        material({
            id: 'metal_antique_bronze',
            name: 'Antique bronze',
            nameCN: '古铜饰面',
            category: 'metal',
            targetHueZone: 'red-orange-brown',
            intendedUse: 'bronze and warm dark metal finish optimization',
            intendedUseCN: '用于古铜与暖深色金属饰面的光谱比较；外观纹理为代表性示意。',
            appearanceSource: {
                type: 'texture',
                label: '程序化古铜纹理',
                origin: 'procedural SVG — dark metallic noise',
                file: 'metal_antique_bronze.svg'
            },
            spectralSource: {
                type: 'engineering',
                label: '工程近似曲线',
                notes: '基于典型古铜（低反射金属、红-棕暖色调）反射特征构建',
                anchorCount: 9,
                dataQualification: '工程近似模型；实测光谱待补充'
            },
            anchors: [[380,0.06],[400,0.08],[450,0.11],[500,0.16],[550,0.24],[600,0.34],[650,0.40],[700,0.42],[780,0.43]]
        }),

        /* ---- PAINT 涂料 (3) ---- */

        material({
            id: 'paint_warm_white',
            name: 'Warm white wall paint',
            nameCN: '暖白墙漆',
            category: 'paint',
            targetHueZone: 'yellow-orange-neutral',
            intendedUse: 'warm white paint and wall finish optimization',
            intendedUseCN: '用于暖白漆与墙面饰面的光谱比较；外观纹理为代表性示意。',
            appearanceSource: {
                type: 'texture',
                label: '程序化哑光纹理',
                origin: 'procedural SVG — fine matte noise',
                file: 'paint_warm_white.svg'
            },
            spectralSource: {
                type: 'engineering',
                label: '工程近似曲线',
                notes: '基于典型暖白内墙涂料（平坦高反射、短波略低）反射特征构建',
                anchorCount: 9,
                dataQualification: '工程近似模型；实测光谱待补充'
            },
            anchors: [[380,0.76],[400,0.80],[450,0.84],[500,0.87],[550,0.89],[600,0.90],[650,0.90],[700,0.89],[780,0.88]]
        }),
        material({
            id: 'paint_morandi_grey',
            name: 'Morandi grey',
            nameCN: '莫兰迪灰',
            category: 'paint',
            targetHueZone: 'red-neutral',
            intendedUse: 'warm grey and morandi color paint optimization',
            intendedUseCN: '用于暖灰色与莫兰迪色涂料的光谱比较；外观纹理为代表性示意。',
            appearanceSource: {
                type: 'texture',
                label: '程序化哑光纹理',
                origin: 'procedural SVG — fine matte noise',
                file: 'paint_morandi_grey.svg'
            },
            spectralSource: {
                type: 'engineering',
                label: '工程近似曲线',
                notes: '基于典型莫兰迪灰（暖灰调、中等反射率）反射特征构建',
                anchorCount: 9,
                dataQualification: '工程近似模型；实测光谱待补充'
            },
            anchors: [[380,0.32],[400,0.35],[450,0.38],[500,0.40],[550,0.42],[600,0.44],[650,0.45],[700,0.44],[780,0.43]]
        }),
        material({
            id: 'paint_mint_green',
            name: 'Mint green',
            nameCN: '薄荷绿涂料',
            category: 'paint',
            targetHueZone: 'green',
            intendedUse: 'mint green paint and pastel cool finish optimization',
            intendedUseCN: '用于薄荷绿涂料与粉彩冷色饰面的光谱比较；外观纹理为代表性示意。',
            appearanceSource: {
                type: 'texture',
                label: '程序化哑光纹理',
                origin: 'procedural SVG — fine matte noise',
                file: 'paint_mint_green.svg'
            },
            spectralSource: {
                type: 'engineering',
                label: '工程近似曲线',
                notes: '基于典型薄荷绿涂料（绿区峰、蓝红区较低的色彩反射）构建',
                anchorCount: 10,
                dataQualification: '工程近似模型；实测光谱待补充'
            },
            anchors: [[380,0.22],[400,0.28],[450,0.38],[500,0.52],[540,0.60],[560,0.62],[600,0.48],[650,0.38],[700,0.34],[780,0.32]]
        }),

        /* ---- PLANT 绿植 (1 measured) ---- */

        material({
            id: 'leaf_green',
            name: 'Green leaf',
            nameCN: '绿植叶片',
            category: 'plant',
            targetHueZone: 'green',
            intendedUse: 'plant and biophilic interior lighting optimisation',
            intendedUseCN: '用于绿植与亲自然室内照明的光谱比较；外观纹理为代表性示意。',
            appearanceSource: {
                type: 'texture',
                label: '本地代表性纹理',
                origin: 'curated local appearance atlas',
                file: 'assets/material-texture-atlas.png'
            },
            spectralSource: {
                type: 'measured',
                label: 'USGS Spectral Library Version 7',
                url: 'https://doi.org/10.5066/F7RR1WDJ',
                sampleId: 'Hyacinth DWO-3-DEL-2 leaf.a ASDFRa AREF',
                notes: 'CC0 1.0 — laboratory measured reflectance',
                dataQualification: 'USGS laboratory measured reflectance; CC0 1.0'
            },
            sourceType: 'measured',
            sourceName: 'USGS Spectral Library Version 7',
            sourceUrl: 'https://doi.org/10.5066/F7RR1WDJ',
            sourceSample: 'Hyacinth DWO-3-DEL-2 leaf.a ASDFRa AREF',
            dataQualification: 'USGS laboratory measured reflectance; CC0 1.0',
            samples: measuredSeries('0.097322 0.098239 0.09821 0.097692 0.096314 0.095403 0.09418 0.093445 0.092696 0.092185 0.09171 0.091293 0.09117 0.091279 0.091796 0.09237 0.092505 0.092555 0.092489 0.092515 0.092662 0.092896 0.093694 0.095441 0.098611 0.104017 0.11306 0.126679 0.14462 0.164469 0.181532 0.193396 0.200706 0.205458 0.208971 0.209256 0.204551 0.19572 0.184313 0.172699 0.163241 0.156047 0.150902 0.147745 0.145549 0.142181 0.136717 0.13052 0.125438 0.12243 0.121201 0.120058 0.116474 0.110772 0.104966 0.101267 0.096866 0.09194 0.089042 0.088353 0.089355 0.093064 0.104419 0.133328 0.182744 0.245952 0.313885 0.384361 0.456339 0.526914 0.59142 0.64588 0.689267 0.721905 0.745015 0.760346 0.769847 0.775866 0.779867 0.782374 0.784155')
        }),

        /* ---- NEUTRAL 中性 (1) ---- */

        material({
            id: 'neutral_wall_matte',
            name: 'Neutral matte wall',
            nameCN: '中性哑光墙面',
            category: 'neutral',
            targetHueZone: 'neutral',
            intendedUse: 'whitepoint stability and neutral surface check',
            intendedUseCN: '用于检查白点稳定性与中性表面呈现；外观纹理为代表性示意。',
            appearanceSource: {
                type: 'texture',
                label: '本地代表性纹理',
                origin: 'curated local appearance atlas',
                file: 'assets/material-texture-atlas.png'
            },
            spectralSource: {
                type: 'engineering',
                label: '工程近似曲线',
                notes: '基于理想中性漫反射面（全波段平坦高反射）构建',
                anchorCount: 9,
                dataQualification: '工程近似模型；用于白点稳定性检查'
            },
            anchors: [[380,0.72],[400,0.75],[450,0.78],[500,0.80],[550,0.81],[600,0.81],[650,0.80],[700,0.79],[780,0.77]]
        })
    ]);

    /* =========================================================================
     * Public API (unchanged — material-color.js depends on these)
     * ========================================================================= */

    var byId = Object.freeze(materials.reduce(function (map, item) {
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
        wavelengths: wavelengths,
        materials: materials,
        byId: byId,
        getMaterial: getMaterial,
        listMaterials: listMaterials,
        dataQualification: DATA_QUALIFICATION
    });
});
