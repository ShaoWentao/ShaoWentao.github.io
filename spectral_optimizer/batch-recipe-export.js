(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) root.BATCH_RECIPE_EXPORT = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    const DEFAULT_MIN_CCT = 1600;
    const DEFAULT_MAX_CCT = 12000;
    const DEFAULT_CCT_STEP = 100;
    const DEFAULT_BRIGHTNESS_LEVELS = Object.freeze([100, 75, 50, 25, 10, 5, 1]);

    function buildCctRange(minK = DEFAULT_MIN_CCT, maxK = DEFAULT_MAX_CCT, stepK = DEFAULT_CCT_STEP) {
        const min = Math.round(Number(minK));
        const max = Math.round(Number(maxK));
        const step = Math.round(Number(stepK));
        if (!Number.isFinite(min) || !Number.isFinite(max) || max < min) {
            throw new RangeError('Invalid CCT range');
        }
        if (!Number.isFinite(step) || step <= 0) throw new RangeError('CCT step must be positive');
        const values = [];
        for (let cct = min; cct <= max; cct += step) values.push(cct);
        if (values.at(-1) !== max && (max - min) % step !== 0) values.push(max);
        return values;
    }

    function clampPercent(value) {
        const number = Number(value);
        return Number.isFinite(number) ? Math.max(0, Math.min(100, number)) : 0;
    }

    function percentToUint16(percent) {
        return Math.round(clampPercent(percent) / 100 * 65535);
    }

    function safeChannelKey(id, index = 0) {
        const source = String(id == null ? '' : id).trim().toLowerCase();
        const key = source
            .normalize('NFKD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/^_+|_+$/g, '');
        return key || `channel_${index + 1}`;
    }

    function channelDescriptors(channels) {
        const used = new Set();
        return (Array.isArray(channels) ? channels : []).map((channel, index) => {
            const base = safeChannelKey(channel && channel.id, index);
            let key = base;
            let suffix = 2;
            while (used.has(key)) key = `${base}_${suffix++}`;
            used.add(key);
            return {
                channel,
                key,
                label: String(channel && (channel.nameCN || channel.name || channel.id) || `CH${index + 1}`)
            };
        });
    }

    function buildRecipeColumns(channels) {
        const columns = [
            { key: 'recipeId', header: '配方ID', width: 22 },
            { key: 'recipeName', header: '配方名称', width: 22 },
            { key: 'mode', header: '模式', width: 14 },
            { key: 'targetCctK', header: '目标CCT_K', width: 12, numberFormat: '0' },
            { key: 'targetDuv', header: '目标Duv', width: 12, numberFormat: '0.0000' },
            { key: 'targetIlluminanceLux', header: '目标照度_lux', width: 13, numberFormat: '0' },
            { key: 'startTime', header: '开始时间', width: 11 },
            { key: 'transitionMinutes', header: '过渡时间_min', width: 13, numberFormat: '0' }
        ];
        for (const descriptor of channelDescriptors(channels)) {
            columns.push(
                { key: `ch_${descriptor.key}_percent`, header: `${descriptor.label}_%`, width: 11, numberFormat: '0.0' },
                { key: `ch_${descriptor.key}_uint16`, header: `${descriptor.label}_16bit`, width: 13, numberFormat: '0' }
            );
        }
        columns.push(
            { key: 'actualCctK', header: '实际CCT_K', width: 12, numberFormat: '0' },
            { key: 'actualDuv', header: '实际Duv', width: 12, numberFormat: '0.0000' },
            { key: 'x', header: 'x', width: 11, numberFormat: '0.0000' },
            { key: 'y', header: 'y', width: 11, numberFormat: '0.0000' },
            { key: 'up1976', header: 'u_prime_1976', width: 14, numberFormat: '0.0000' },
            { key: 'vp1976', header: 'v_prime_1976', width: 14, numberFormat: '0.0000' },
            { key: 'ra', header: 'Ra', width: 10, numberFormat: '0.0' },
            { key: 'r9', header: 'R9', width: 10, numberFormat: '0.0' },
            { key: 'rf', header: 'Rf', width: 10, numberFormat: '0.0' },
            { key: 'rg', header: 'Rg', width: 10, numberFormat: '0.0' },
            { key: 'melanopicDer', header: 'Melanopic_DER', width: 15, numberFormat: '0.000' },
            { key: 'melanopicEdiLux', header: 'Melanopic_EDI_lx', width: 17, numberFormat: '0.0' },
            { key: 'cla2', header: 'CLA2', width: 12, numberFormat: '0.0' },
            { key: 'cs', header: 'CS', width: 10, numberFormat: '0.000' },
            { key: 'cctErrorK', header: 'CCT偏差_K', width: 12, numberFormat: '0' },
            { key: 'duvError', header: 'Duv偏差', width: 12, numberFormat: '0.0000' },
            { key: 'fitDeltaUv', header: '拟合误差_deltaUv', width: 17, numberFormat: '0.0000' },
            { key: 'status', header: '计算状态', width: 14 },
            { key: 'note', header: '备注', width: 34 }
        );
        return columns;
    }

    function hasFiniteValue(value) {
        return value != null && value !== '' && Number.isFinite(Number(value));
    }

    function finiteOrBlank(value) {
        return hasFiniteValue(value) ? Number(value) : '';
    }

    function buildBrightnessColumns(channels) {
        const base = buildRecipeColumns(channels);
        return [
            base[0],
            { key: 'baseRecipeId', header: '基础配方ID', width: 22 },
            base[1],
            base[2],
            { key: 'brightnessPercent', header: '亮度_%', width: 11, numberFormat: '0' },
            { key: 'brightnessModel', header: '亮度模型', width: 24 },
            { key: 'calibrationStatus', header: '校准状态', width: 24 },
            { key: 'spectralReferenceId', header: '光谱引用ID', width: 22 },
            ...base.slice(3)
        ];
    }

    function buildRecipeRow(recipe, channels) {
        const source = recipe || {};
        const targets = source.targets || {};
        const result = source.result || {};
        const metrics = source.metrics || {};
        const channelPercents = source.channelPercents || {};
        const row = {
            recipeId: source.id || '',
            recipeName: source.name || source.id || '',
            mode: source.mode || '',
            targetCctK: finiteOrBlank(targets.cctK),
            targetDuv: finiteOrBlank(targets.duv),
            targetIlluminanceLux: finiteOrBlank(targets.illuminanceLux),
            startTime: targets.startTime || '',
            transitionMinutes: finiteOrBlank(targets.transitionMinutes),
            actualCctK: finiteOrBlank(result.cctK),
            actualDuv: finiteOrBlank(result.duv),
            x: finiteOrBlank(result.x),
            y: finiteOrBlank(result.y),
            up1976: finiteOrBlank(result.up),
            vp1976: finiteOrBlank(result.vp),
            ra: finiteOrBlank(metrics.ra),
            r9: finiteOrBlank(metrics.r9),
            rf: finiteOrBlank(metrics.rf),
            rg: finiteOrBlank(metrics.rg),
            melanopicDer: finiteOrBlank(metrics.melanopicDer),
            melanopicEdiLux: finiteOrBlank(metrics.melanopicEdiLux),
            cla2: finiteOrBlank(metrics.cla2),
            cs: finiteOrBlank(metrics.cs),
            cctErrorK: hasFiniteValue(result.cctK) && hasFiniteValue(targets.cctK)
                ? Number(result.cctK) - Number(targets.cctK)
                : '',
            duvError: hasFiniteValue(result.duv) && hasFiniteValue(targets.duv)
                ? Number(result.duv) - Number(targets.duv)
                : '',
            fitDeltaUv: finiteOrBlank(source.fitDeltaUv),
            status: source.status || '',
            note: source.note || ''
        };
        for (const descriptor of channelDescriptors(channels)) {
            const originalId = descriptor.channel && descriptor.channel.id;
            const percent = clampPercent(channelPercents[originalId]);
            row[`ch_${descriptor.key}_percent`] = percent;
            row[`ch_${descriptor.key}_uint16`] = percentToUint16(percent);
        }
        return row;
    }

    function buildBrightnessRow(recipe, channels) {
        const source = recipe || {};
        return {
            ...buildRecipeRow(source, channels),
            baseRecipeId: source.baseRecipeId || '',
            brightnessPercent: finiteOrBlank(source.brightnessPercent),
            brightnessModel: source.brightnessModel || '',
            calibrationStatus: source.calibrationStatus || '',
            spectralReferenceId: source.spectralReferenceId || source.id || ''
        };
    }

    function selectedSpectrumSamples(wavelengths) {
        const sourceWavelengths = Array.isArray(wavelengths) || ArrayBuffer.isView(wavelengths)
            ? Array.from(wavelengths)
            : [];
        const selected = [];
        sourceWavelengths.forEach((wavelength, index) => {
            const rounded = Math.round(Number(wavelength));
            if (rounded < 380 || rounded > 780 || (rounded - 380) % 5 !== 0) return;
            selected.push({ wavelength: rounded, index });
        });
        return selected;
    }

    function buildBrightnessSpectrumColumns(wavelengths) {
        return [
            { key: 'recipeId', header: '配方ID', width: 22 },
            { key: 'baseRecipeId', header: '基础配方ID', width: 22 },
            { key: 'mode', header: '模式', width: 14 },
            { key: 'brightnessPercent', header: '亮度_%', width: 11, numberFormat: '0' },
            { key: 'spectralScaleBasis', header: '光谱幅值基准', width: 24 },
            ...selectedSpectrumSamples(wavelengths).map(sample => ({
                key: `wl_${sample.wavelength}`,
                header: `${sample.wavelength}nm`,
                width: 11,
                numberFormat: '0.000000'
            }))
        ];
    }

    function buildBrightnessSpectrumRows(recipes, wavelengths) {
        const selected = selectedSpectrumSamples(wavelengths);
        return (Array.isArray(recipes) ? recipes : []).map(recipe => {
            const spectrum = Array.isArray(recipe?.brightnessSpd) || ArrayBuffer.isView(recipe?.brightnessSpd)
                ? recipe.brightnessSpd
                : (Array.isArray(recipe?.normalizedSpd) || ArrayBuffer.isView(recipe?.normalizedSpd))
                    ? Array.from(recipe.normalizedSpd, value => Number(value || 0) * clampPercent(recipe?.brightnessPercent) / 100)
                    : [];
            const row = {
                recipeId: recipe?.id || '',
                baseRecipeId: recipe?.baseRecipeId || '',
                mode: recipe?.mode || '',
                brightnessPercent: finiteOrBlank(recipe?.brightnessPercent),
                spectralScaleBasis: recipe?.spectralScaleBasis || '基础配方100%峰值=1'
            };
            selected.forEach(sample => {
                row[`wl_${sample.wavelength}`] = Number.isFinite(Number(spectrum[sample.index]))
                    ? Number(spectrum[sample.index])
                    : 0;
            });
            return row;
        });
    }

    function buildSpectrumRows(recipes, wavelengths) {
        const sourceRecipes = Array.isArray(recipes) ? recipes : [];
        const selected = selectedSpectrumSamples(wavelengths);
        const rows = [];
        for (const recipe of sourceRecipes) {
            const spd = Array.isArray(recipe && recipe.normalizedSpd) || ArrayBuffer.isView(recipe && recipe.normalizedSpd)
                ? recipe.normalizedSpd
                : [];
            for (const sample of selected) {
                rows.push({
                    recipeId: recipe.id || '',
                    mode: recipe.mode || '',
                    wavelengthNm: sample.wavelength,
                    relativePower: Number.isFinite(Number(spd[sample.index])) ? Number(spd[sample.index]) : 0
                });
            }
        }
        return rows;
    }

    function buildInfoRows(metadata, counts, type) {
        const source = metadata || {};
        const rows = [
            { item: '导出类型', value: type },
            { item: '导出时间', value: source.exportedAt || '' },
            { item: '通道模型', value: source.source || '' },
            { item: '通道数量', value: finiteOrBlank(source.channelCount) },
            { item: 'CCT范围', value: source.cctRange || '' },
            { item: 'CCT步长_K', value: finiteOrBlank(source.cctStepK) },
            { item: '高饱和目标Rg', value: finiteOrBlank(source.targetRg) },
            { item: '亮度节点_%', value: Array.isArray(source.brightnessLevels) ? source.brightnessLevels.join(', ') : '' },
            { item: '亮度配方依据', value: source.brightnessModel
                ? `${source.brightnessModel}；未导入分级实测SPD时，亮度表用于控制器节点和照度/节律计算。`
                : '' },
            { item: '控制值换算', value: 'round(通道百分比 / 100 × 65535)' },
            { item: '光谱范围', value: '380–780 nm，5 nm间隔，峰值归一化为1' },
            { item: '说明', value: '控制器主要读取配方ID、各通道百分比或16位控制值；其余指标用于验证与追溯。' }
        ];
        Object.entries(counts || {}).forEach(([label, value]) => rows.push({ item: `${label}数量`, value }));
        return rows;
    }

    function infoSheet(metadata, counts, type) {
        return {
            name: '说明',
            columns: [
                { key: 'item', header: '项目', width: 22 },
                { key: 'value', header: '内容', width: 52 }
            ],
            rows: buildInfoRows(metadata, counts, type),
            freezeRows: 1,
            autoFilter: true
        };
    }

    function recipeSheet(name, recipes, channels) {
        return {
            name,
            columns: buildRecipeColumns(channels),
            rows: (Array.isArray(recipes) ? recipes : []).map(recipe => buildRecipeRow(recipe, channels)),
            freezeRows: 1,
            autoFilter: true
        };
    }

    function brightnessSheet(recipes, channels) {
        return {
            name: '亮度配方',
            columns: buildBrightnessColumns(channels),
            rows: (Array.isArray(recipes) ? recipes : []).map(recipe => buildBrightnessRow(recipe, channels)),
            freezeRows: 1,
            autoFilter: true
        };
    }

    function brightnessSpectrumSheet(recipes, wavelengths) {
        return {
            name: '亮度光谱',
            columns: buildBrightnessSpectrumColumns(wavelengths),
            rows: buildBrightnessSpectrumRows(recipes, wavelengths),
            freezeRows: 1,
            autoFilter: true
        };
    }

    function spectrumSheet(recipes, wavelengths) {
        return {
            name: '光谱数据',
            columns: [
                { key: 'recipeId', header: '配方ID', width: 22 },
                { key: 'mode', header: '模式', width: 14 },
                { key: 'wavelengthNm', header: '波长_nm', width: 12, numberFormat: '0' },
                { key: 'relativePower', header: '相对功率', width: 14, numberFormat: '0.000000' }
            ],
            rows: buildSpectrumRows(recipes, wavelengths),
            freezeRows: 1,
            autoFilter: true
        };
    }

    function buildBatchWorkbookSpec(context) {
        const source = context || {};
        const groups = {
            regular: Array.isArray(source.regular) ? source.regular : [],
            fidelity: Array.isArray(source.fidelity) ? source.fidelity : [],
            saturation: Array.isArray(source.saturation) ? source.saturation : [],
            pastel: Array.isArray(source.pastel) ? source.pastel : [],
            scenes: Array.isArray(source.scenes) ? source.scenes : [],
            brightness: Array.isArray(source.brightness) ? source.brightness : []
        };
        const allRecipes = [
            ...groups.regular,
            ...groups.fidelity,
            ...groups.saturation,
            ...groups.pastel,
            ...groups.scenes
        ];
        return {
            sheets: [
                infoSheet(source.metadata, {
                    常规: groups.regular.length,
                    高显色: groups.fidelity.length,
                    高饱和: groups.saturation.length,
                    淡彩光: groups.pastel.length,
                    情景模式: groups.scenes.length,
                    亮度配方: groups.brightness.length
                }, '批量导出'),
                recipeSheet('常规', groups.regular, source.channels),
                recipeSheet('高显色', groups.fidelity, source.channels),
                recipeSheet('高饱和', groups.saturation, source.channels),
                recipeSheet('淡彩光', groups.pastel, source.channels),
                recipeSheet('情景模式', groups.scenes, source.channels),
                brightnessSheet(groups.brightness, source.channels),
                spectrumSheet(allRecipes, source.wavelengths),
                brightnessSpectrumSheet(groups.brightness, source.wavelengths)
            ]
        };
    }

    function buildSingleWorkbookSpec(context) {
        const source = context || {};
        const recipes = source.recipe ? [source.recipe] : [];
        const brightness = Array.isArray(source.brightness) ? source.brightness : [];
        return {
            sheets: [
                infoSheet(source.metadata, { 单点配方: recipes.length, 亮度配方: brightness.length }, '单点导出'),
                recipeSheet('单点配方', recipes, source.channels),
                brightnessSheet(brightness, source.channels),
                spectrumSheet(recipes, source.wavelengths),
                brightnessSpectrumSheet(brightness, source.wavelengths)
            ]
        };
    }

    return Object.freeze({
        DEFAULT_MIN_CCT,
        DEFAULT_MAX_CCT,
        DEFAULT_CCT_STEP,
        DEFAULT_BRIGHTNESS_LEVELS,
        buildCctRange,
        percentToUint16,
        buildRecipeColumns,
        buildRecipeRow,
        buildBrightnessColumns,
        buildBrightnessRow,
        buildSpectrumRows,
        buildBrightnessSpectrumColumns,
        buildBrightnessSpectrumRows,
        buildBatchWorkbookSpec,
        buildSingleWorkbookSpec,
        safeChannelKey
    });
});
