(function (root) {
    'use strict';

    var DATA = root.MATERIAL_REFLECTANCE_DATA;
    var DINING = root.DiningLightData;
    var COLOR = root.MaterialColor;
    var UPLOAD = root.MaterialUpload;
    var OPTIMIZER = root.MaterialOptimizer;
    var PROFILES = root.MaterialPreferenceProfiles;
    var selectedId = 'wood_warm_oak';
    var selectedCategory = 'all';
    var latestResults = [];
    var latestContext = null;
    var lastKey = '';
    var comparisonPreview = false;
    var pendingPayload = null;
    var optimizationBusy = false;
    var sessionOverrides = {};
    var preferenceDialogMaterialId = '';
    var preferenceDialogLevel = 'recommended';

    /* ---- Category labels ---- */

    var categoryLabels = {
        wood: '木材',
        stone: '石材',
        fabric: '织物',
        leather: '皮革',
        metal: '金属',
        paint: '涂料',
        plant: '绿植',
        neutral: '中性面',
        food: '食材',
        user: '我的材质'
    };

    function textureUrl(material) {
        if (!material || !material.appearanceSource) return '';
        if (material.appearanceSource.type === 'photo' && material.appearanceSource.dataUrl) {
            return material.appearanceSource.dataUrl;
        }
        return material.appearanceSource.file || '';
    }

    function atlasVariables(material) {
        var source = material && material.appearanceSource || {};
        var grid = Array.isArray(source.atlasGrid) ? source.atlasGrid : [1, 1];
        var position = Array.isArray(source.atlasPosition) ? source.atlasPosition : [0, 0];
        var columns = Math.max(1, Number(grid[0]) || 1);
        var rows = Math.max(1, Number(grid[1]) || 1);
        var x = columns > 1 ? (Number(position[0]) || 0) / (columns - 1) * 100 : 50;
        var y = rows > 1 ? (Number(position[1]) || 0) / (rows - 1) * 100 : 50;
        return { x: x.toFixed(3) + '%', y: y.toFixed(3) + '%', size: (columns * 100) + '% ' + (rows * 100) + '%' };
    }

    function hasTexture(material) {
        return Boolean(textureUrl(material));
    }

    /* ---- Helpers ---- */

    function element(id) { return document.getElementById(id); }

    function signed(value, digits) {
        if (!Number.isFinite(value)) return '--';
        var rounded = Math.abs(value) < 0.5 * Math.pow(10, -digits) ? 0 : value;
        return (rounded > 0 ? '+' : '') + rounded.toFixed(digits);
    }

    function deltaLevel(deltaE) {
        if (!Number.isFinite(deltaE)) return '';
        if (deltaE <= 1) return 'low';
        if (deltaE <= 3) return 'medium';
        return 'high';
    }

    function deltaDescription(deltaE) {
        if (!Number.isFinite(deltaE)) return '等待光谱数据';
        if (deltaE <= 1) return '差异很小';
        if (deltaE <= 2) return '轻微差异';
        if (deltaE <= 3) return '可以察觉';
        return '差异明显';
    }

    function publishSummary(updating) {
        var material = getMaterialById(selectedId);
        var result = latestResults.find(function (item) { return item.materialId === selectedId; }) || null;
        document.dispatchEvent(new CustomEvent('spectral-material-summary', {
            detail: {
                id: material ? material.id : '',
                name: material ? material.nameCN : '等待材质数据',
                category: material ? (categoryLabels[material.category] || material.category) : '',
                reference: latestContext ? latestContext.reference + ' · ' + Math.round(latestContext.cct).toLocaleString() + ' K' : '等待有效光谱',
                deltaL: result && Number.isFinite(result.deltaL) ? result.deltaL : null,
                deltaCPercent: result && Number.isFinite(result.deltaCPercent) ? result.deltaCPercent : null,
                deltaH: result && Number.isFinite(result.deltaH) ? result.deltaH : null,
                deltaE00: result && Number.isFinite(result.deltaE00) ? result.deltaE00 : null,
                updating: Boolean(updating)
            }
        }));
    }

    function labToRgb(lab) {
        if (!Array.isArray(lab) || lab.length < 3) return 'rgb(220 220 220)';
        var L = lab[0], a = lab[1], b = lab[2];
        var fy = (L + 16) / 116;
        var fx = fy + a / 500;
        var fz = fy - b / 200;
        function inv(value) {
            var cube = value * value * value;
            return cube > 216 / 24389 ? cube : (116 * value - 16) / 903.3;
        }
        var x = 0.95047 * inv(fx);
        var y = inv(fy);
        var z = 1.08883 * inv(fz);
        var r = 3.2406 * x - 1.5372 * y - 0.4986 * z;
        var g = -0.9689 * x + 1.8758 * y + 0.0415 * z;
        var bl = 0.0557 * x - 0.2040 * y + 1.0570 * z;
        function enc(v) {
            var gamma = v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
            return Math.round(Math.max(0, Math.min(1, gamma)) * 255);
        }
        return 'rgb(' + enc(r) + ' ' + enc(g) + ' ' + enc(bl) + ')';
    }

    function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    function differenceFilter(result) {
        if (!result) return 'none';
        var scale = 3;
        var brightness = clamp(1 + result.deltaL * 0.02 * scale, 0.72, 1.32);
        var saturation = clamp(1 + result.deltaCPercent * 0.01 * scale, 0.55, 1.70);
        var hue = clamp(result.deltaH * scale, -30, 30);
        return 'brightness(' + brightness.toFixed(3) + ') ' +
            'saturate(' + saturation.toFixed(3) + ') ' +
            'hue-rotate(' + hue.toFixed(2) + 'deg)';
    }

    function composeFilters(baseFilter, difference) {
        var base = baseFilter && baseFilter !== 'none' ? baseFilter : '';
        var delta = difference && difference !== 'none' ? difference : '';
        return (base + ' ' + delta).trim() || 'none';
    }

    function appearanceStyle(material, difference) {
        var url = textureUrl(material);
        var baseFilter = material && material.appearanceSource ? material.appearanceSource.baseFilter : 'none';
        var filter = composeFilters(baseFilter, difference);
        if (url) {
            var atlas = atlasVariables(material);
            var isStandalone = !material.appearanceSource.atlasGrid;
            return '--appearance-blend:normal;--appearance-filter:' + filter + ";--texture-url:url('" + url + "');" +
                '--texture-x:' + (isStandalone ? '50%' : atlas.x) + ';' +
                '--texture-y:' + (isStandalone ? '50%' : atlas.y) + ';' +
                '--texture-size:' + (isStandalone ? 'cover' : atlas.size) + ';';
        }
        return '--appearance-blend:normal;--appearance-filter:none;--texture-url:none;--texture-x:50%;--texture-y:50%;--texture-size:cover;';
    }

    function updateAppearance(elId, material, filter) {
        var el = element(elId);
        if (!el) return;
        el.style.cssText = appearanceStyle(material, filter);
    }

    /* ---- Quality tag helpers ---- */

    function spectralQualityClass(material) {
        if (material.isUserMaterial) return 'user';
        if (material.spectralSource && material.spectralSource.type === 'measured') return 'measured';
        return 'engineering';
    }

    function spectralQualityLabel(material) {
        if (material.isUserMaterial) return '用户';
        if (material.spectralSource && material.spectralSource.type === 'measured') return '实测';
        return '工程';
    }

    /* ---- Render Selector Grid ---- */

    function getCombinedList() {
        if (!DATA) return [];
        var builtin = DATA.listMaterials();
        if (UPLOAD && typeof UPLOAD.getCombinedMaterials === 'function') {
            return UPLOAD.getCombinedMaterials(builtin);
        }
        return builtin;
    }

    function getMaterialById(id) {
        return getCombinedList().find(function (material) { return material.id === id; }) || null;
    }

    function preferenceGoal() {
        var select = element('material-preference-goal');
        return select && select.value === 'fidelity' ? 'fidelity' : 'preference';
    }

    function preferenceLevel() {
        var select = element('material-preference-level');
        var value = select ? select.value : 'recommended';
        return ['soft', 'recommended', 'vivid'].indexOf(value) >= 0 ? value : 'recommended';
    }

    function loadCurrentOverrides() {
        var persistent = {};
        try {
            if (PROFILES && typeof PROFILES.loadOverrides === 'function') {
                persistent = PROFILES.loadOverrides(root.localStorage);
            }
        } catch (error) { /* storage unavailable */ }
        return Object.assign({}, persistent, sessionOverrides);
    }

    function resolvedPreference(material, level) {
        if (!material || !PROFILES || typeof PROFILES.resolveMaterialPreference !== 'function') return null;
        return PROFILES.resolveMaterialPreference(material, level || preferenceLevel(), loadCurrentOverrides());
    }

    function preferenceSourceLabel(profile) {
        if (!profile) return '偏好模型不可用';
        if (profile.source === 'user') return '用户自定义 · 当前材质';
        if (profile.source === 'material') return '材质专属 · 工程偏好模型';
        return '分类默认 · 工程偏好模型';
    }

    function updatePreferenceSummary(material) {
        var summary = element('material-preference-summary');
        var source = element('material-preference-source');
        var targets = element('material-preference-targets');
        var open = element('material-preference-open');
        if (!summary || !source || !targets || !open) return;
        var profile = resolvedPreference(material || getMaterialById(selectedId), preferenceLevel());
        source.textContent = preferenceSourceLabel(profile);
        targets.textContent = profile
            ? '目标 ΔC* ' + signed(profile.targetDeltaC, 1) +
                ' · Δh ' + signed(profile.targetDeltaH, 1) + '°' +
                ' · ΔL* ' + signed(profile.targetDeltaL, 1) +
                ' · 最大 ΔE00 ' + profile.maxDeltaE00.toFixed(1)
            : '等待偏好参数';
        open.hidden = preferenceGoal() === 'fidelity';
    }

    function renderSelector() {
        var selector = element('material-selector');
        if (!selector || !DATA) return;
        selector.innerHTML = '';

        var materials = getCombinedList();
        if (materials.length > 0 && !materials.some(function (material) { return material.id === selectedId; })) {
            selectedId = materials[0].id;
        }

        materials.forEach(function (material) {
            var result = latestResults.find(function (item) { return item.materialId === material.id; });
            var button = document.createElement('button');
            button.type = 'button';
            button.dataset.materialId = material.id;
            button.classList.toggle('is-selected', material.id === selectedId);
            button.setAttribute('aria-pressed', material.id === selectedId ? 'true' : 'false');

            var qClass = spectralQualityClass(material);
            if (qClass === 'engineering') button.classList.add('is-engineering');
            var qLabel = spectralQualityLabel(material);
            var thumbStyle = appearanceStyle(material, 'none');
            button.innerHTML = '<span class="material-thumb" style="' + thumbStyle + '" aria-hidden="true"></span>' +
                '<span class="material-selector-copy">' +
                    '<strong>' + escHtml(material.nameCN) + ' <span class="selector-quality-tag selector-quality-tag--' + qClass + '">' + qLabel + '</span></strong>' +
                    '<small>' + (result ? deltaDescription(result.deltaE00) + ' · ΔE00 ' + result.deltaE00.toFixed(2) : '等待计算') + '</small>' +
                '</span>';

            if (material.isUserMaterial) {
                var delBtn = document.createElement('button');
                delBtn.type = 'button';
                delBtn.className = 'material-delete-btn';
                delBtn.title = '删除此材质';
                delBtn.textContent = '×';
                delBtn.addEventListener('click', function (event) {
                    event.stopPropagation();
                    deleteUserMaterial(material.id);
                });
                button.appendChild(delBtn);
            }

            button.addEventListener('click', function () {
                selectedId = material.id;
                renderSelector();
                renderDetail();
            });
            selector.appendChild(button);
        });

        renderImportButton(selector);
    }

    function renderImportButton(container) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'import-material-btn';
        btn.innerHTML = '<span style="font-size:16px">+</span> 导入材质';
        btn.addEventListener('click', showUploadDialog);
        container.appendChild(btn);
    }

    /* ---- Render Detail Panel ---- */

    function renderDetail() {
        var material = getMaterialById(selectedId);
        var result = latestResults.find(function (item) { return item.materialId === selectedId; });
        if (!material) return;

        element('material-detail-title').textContent = material.nameCN;
        element('material-detail-description').textContent = material.intendedUseCN || material.intendedUse;
        if (element('material-detail-category')) element('material-detail-category').textContent = material.isUserMaterial ? '我的材质' : '材质样本';

        // Dual-source badges
        renderSourceBadge(
            'material-appearance-source',
            hasTexture(material)
                ? material.appearanceSource
                : {
                    type: 'engineering',
                    label: '无可靠外观纹理，仅显示色彩模拟'
                },
            'appearance'
        );
        renderSourceBadge('material-spectral-source', material.spectralSource, 'spectral');

        // Reflectance source caption
        var specSrc = material.spectralSource || {};
        var refLabel, refTag, refTagClass;
        if (specSrc.type === 'measured') {
            refTag = '实测';
            refTagClass = 'reflectance-source-tag--measured';
            refLabel = (specSrc.label || '实测数据库') + '  ·  ' + (specSrc.sampleId || '');
        } else if (specSrc.type === 'user_csv') {
            refTag = '用户';
            refTagClass = 'reflectance-source-tag--user';
            refLabel = '用户 CSV 导入 · ' + (material.reflectance ? material.reflectance.length : '?') + ' 个波长点';
        } else {
            refTag = '工程参考';
            refTagClass = 'reflectance-source-tag--engineering';
            refLabel = '工程参考曲线 · 非实测标准样本';
        }
        var tagEl = element('material-reflectance-source-tag');
        if (tagEl) {
            tagEl.textContent = refTag;
            tagEl.className = 'reflectance-source-tag ' + refTagClass;
        }
        element('material-reflectance-source').textContent = refLabel;

        // Appearance swatches
        if (result && comparisonPreview) {
            updateAppearance('material-reference-appearance', material, 'none');
            updateAppearance('material-current-appearance', material, differenceFilter(result));
            if (element('material-preview-mode')) element('material-preview-mode').textContent = '差异增强 ×3';
        } else {
            updateAppearance('material-reference-appearance', material, 'none');
            updateAppearance('material-current-appearance', material, 'none');
            if (element('material-preview-mode')) element('material-preview-mode').textContent = '等待计算';
        }
        if (element('material-preview-mode') && result && !comparisonPreview) {
            element('material-preview-mode').textContent = '模拟效果';
        }
        drawReflectance(material);

        // Metric cards
        var deltaLNote = !result ? '±1 接近'
            : Math.abs(result.deltaL) <= 1 ? '明度接近'
            : result.deltaL > 0 ? '当前更亮' : '当前更暗';
        var deltaCNote = !result ? '正值更鲜艳'
            : Math.abs(result.deltaCPercent) <= 2 ? '彩度接近'
            : result.deltaC > 0 ? '当前更鲜艳' : '当前更柔和';
        var deltaHNote = !result ? '±1° 较稳定'
            : Math.abs(result.deltaH) <= 1 ? '色相稳定'
            : result.deltaH > 0 ? '色相顺时针偏移' : '色相逆时针偏移';

        setMetric('delta-l', result ? signed(result.deltaL, 2) : '--', deltaLNote);
        setMetric('delta-c-percent', result ? signed(result.deltaCPercent, 1) + '%' : '--', deltaCNote);
        setMetric('delta-h', result ? signed(result.deltaH, 2) + '°' : '--', deltaHNote);
        setMetric(
            'delta-e',
            result ? result.deltaE00.toFixed(2) : '--',
            result ? deltaDescription(result.deltaE00) + ' · ≤1 很小 / >3 明显' : '综合色差',
            result ? deltaLevel(result.deltaE00) : ''
        );
        updatePreferenceSummary(material);
        publishSummary(false);
    }

    function renderSourceBadge(elementId, source, kind) {
        var el = element(elementId);
        if (!el) return;
        if (!source) {
            el.textContent = '未标注';
            updateBadgeIndicator(elementId, 'engineering');
            return;
        }
        var type = source.type || 'engineering';
        var label = source.label || '未知来源';
        var detail = '';
        if (type === 'measured' && source.url) {
            detail = label + ' · ' + (source.sampleId || '');
        } else if (type === 'user_csv') {
            detail = label;
        } else if (type === 'photo') {
            detail = label;
        } else {
            detail = label;
            if (source.notes) detail += ' · ' + source.notes;
        }
        el.textContent = detail;

        // Update the indicator dot color
        var badgeEl = el.closest('.source-badge');
        if (badgeEl) {
            var indicator = badgeEl.querySelector('.source-badge__indicator');
            if (indicator) {
                indicator.className = 'source-badge__indicator source-badge__indicator--' +
                    (type === 'measured' ? 'measured' : type === 'user_csv' ? 'user' : 'engineering');
            }
        }
    }

    function updateBadgeIndicator(elementId, quality) {
        var el = element(elementId);
        if (!el) return;
        var badgeEl = el.closest('.source-badge');
        if (!badgeEl) return;
        var indicator = badgeEl.querySelector('.source-badge__indicator');
        if (indicator) {
            indicator.className = 'source-badge__indicator source-badge__indicator--' + quality;
        }
    }

    function setMetric(id, value, note, level) {
        var card = element('material-' + id);
        if (!card) return;
        var ve = card.querySelector('strong');
        var ne = card.querySelector('small');
        if (ve) ve.textContent = value;
        if (ne) ne.textContent = note;
        if (level) card.dataset.level = level;
        else delete card.dataset.level;
    }

    /* ---- Reflectance Chart ---- */

    function drawReflectance(material) {
        var canvas = element('material-reflectance-canvas');
        if (!canvas || !material || !Array.isArray(material.reflectance)) return;
        var values = material.reflectance;
        var rect = canvas.getBoundingClientRect();
        var ratio = Math.min(2, window.devicePixelRatio || 1);
        var width = Math.max(320, Math.round(rect.width || 720));
        var height = Math.max(120, Math.round(rect.height || 150));
        canvas.width = Math.round(width * ratio);
        canvas.height = Math.round(height * ratio);
        var ctx = canvas.getContext('2d');
        ctx.scale(ratio, ratio);

        var pad = { left: 36, right: 12, top: 12, bottom: 25 };
        var pw = width - pad.left - pad.right;
        var ph = height - pad.top - pad.bottom;
        ctx.clearRect(0, 0, width, height);
        ctx.font = '10px Arial, sans-serif';
        ctx.lineWidth = 1;

        // Grid lines
        ctx.strokeStyle = 'rgba(42, 37, 30, 0.12)';
        ctx.fillStyle = 'rgba(42, 37, 30, 0.55)';
        for (var step = 0; step <= 4; step++) {
            var v = step / 4;
            var y = pad.top + ph * (1 - v);
            ctx.beginPath();
            ctx.moveTo(pad.left, y);
            ctx.lineTo(pad.left + pw, y);
            ctx.stroke();
            ctx.fillText(v.toFixed(2), 4, y + 3);
        }

        // Wavelength labels
        [380, 480, 580, 680, 780].forEach(function (wl) {
            var x = pad.left + pw * ((wl - 380) / 400);
            ctx.fillText(String(wl), x - 10, height - 7);
        });

        // Spectral gradient stroke
        var gradient = ctx.createLinearGradient(pad.left, 0, pad.left + pw, 0);
        gradient.addColorStop(0, '#6d28a8');
        gradient.addColorStop(0.18, '#2957d5');
        gradient.addColorStop(0.38, '#1ea86d');
        gradient.addColorStop(0.58, '#d6b320');
        gradient.addColorStop(0.77, '#e76f2e');
        gradient.addColorStop(1, '#b91c1c');
        ctx.strokeStyle = gradient;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        values.forEach(function (val, i) {
            var sx = pad.left + pw * (i / (values.length - 1));
            var sy = pad.top + ph * (1 - Math.max(0, Math.min(1, val)));
            if (i === 0) ctx.moveTo(sx, sy);
            else ctx.lineTo(sx, sy);
        });
        ctx.stroke();

        // Anchor points for engineering materials
        if (material.spectralSource && material.spectralSource.type === 'engineering' && material.anchors && material.anchors.length > 0) {
            ctx.fillStyle = 'rgba(180, 140, 60, 0.7)';
            material.anchors.forEach(function (anchor) {
                var ax = pad.left + pw * ((anchor[0] - 380) / 400);
                var ay = pad.top + ph * (1 - Math.max(0, Math.min(1, anchor[1])));
                ctx.beginPath();
                ctx.arc(ax, ay, 2.5, 0, 2 * Math.PI);
                ctx.fill();
            });
        }
    }

    /* ---- Calculation ---- */

    function spectrumKey(spd, cct) {
        var values = Array.from(spd || []);
        if (!values.length) return 'empty:' + cct;
        // Sampling eleven positions allowed changes between those positions
        // to reuse stale material deltas. Hash every wavelength instead.
        var hash = 2166136261;
        values.forEach(function (value) {
            var scaled = Math.round((Number(value) || 0) * 1000000);
            hash ^= scaled;
            hash = Math.imul(hash, 16777619);
        });
        return Math.round(cct) + ':' + values.length + ':' + (hash >>> 0);
    }

    function isPayloadCurrent(payload) {
        return !payload.options || typeof payload.options.isCurrent !== 'function'
            || payload.options.isCurrent(payload.options.version);
    }

    function finishUpdating(payload) {
        var panel = element('material-panel');
        if (!panel || !isPayloadCurrent(payload)) return;
        panel.classList.remove('is-updating');
        panel.dataset.analysisVersion = String(payload.options && payload.options.version || 0);
        delete panel.dataset.pendingVersion;
        publishSummary(false);
    }

    function setUpdating(version) {
        var panel = element('material-panel');
        var refEl = element('material-reference');
        if (!panel) return;
        panel.classList.add('is-updating');
        panel.dataset.pendingVersion = String(version || 0);
        if (refEl && !/^正在更新/.test(refEl.textContent)) {
            refEl.textContent = '正在更新 · ' + (refEl.textContent || '等待有效光谱');
        }
        publishSummary(true);
    }

    function calculate(payload) {
        if (!payload || !COLOR || !DATA || !isPayloadCurrent(payload)) return;
        var cct = Number(payload.metrics && payload.metrics.quality ? payload.metrics.quality.cct : (payload.metrics ? payload.metrics.cct : 0));
        var key = spectrumKey(payload.spd, cct);
        if (key === lastKey) {
            var unchangedRef = element('material-reference');
            if (unchangedRef) unchangedRef.textContent = latestContext
                ? latestContext.reference + ' · ' + Math.round(latestContext.cct).toLocaleString() + ' K'
                : '等待有效光谱';
            finishUpdating(payload);
            return;
        }

        var nextResults = [];
        var nextContext = null;
        if (cct > 0) {
            try {
                nextResults = COLOR.calculateAllMaterials(payload.spd, { cct: cct, referenceMode: 'auto' });
                nextContext = { cct: cct, reference: cct >= 5000 ? 'CIE D 系列日光参考' : '黑体参考' };
                if (DINING && typeof DINING.listMaterials === 'function') {
                    DINING.listMaterials().forEach(function (material) {
                        try {
                            nextResults.push(COLOR.calculateMaterialDelta(payload.spd, {
                                material: material,
                                cct: cct,
                                referenceMode: 'auto'
                            }));
                        } catch (error) { /* skip malformed dining material */ }
                    });
                }
                if (UPLOAD && typeof UPLOAD.loadUserMaterials === 'function') {
                    var userMats = UPLOAD.loadUserMaterials();
                    userMats.forEach(function (um) {
                        if (Array.isArray(um.reflectance) && um.reflectance.length === 81) {
                            try {
                                nextResults.push(COLOR.calculateMaterialDelta(payload.spd, {
                                    material: um,
                                    cct: cct,
                                    referenceMode: 'auto'
                                }));
                            } catch (e) { /* skip malformed user material */ }
                        }
                    });
                }
            } catch (error) {
                nextResults = [];
                nextContext = null;
                console.warn('Material appearance calculation unavailable:', error);
            }
        }

        if (!isPayloadCurrent(payload)) return;
        lastKey = key;
        latestResults = nextResults;
        latestContext = nextContext;
        var refEl = element('material-reference');
        if (refEl) refEl.textContent = latestContext
            ? latestContext.reference + ' · ' + Math.round(latestContext.cct).toLocaleString() + ' K'
            : '等待有效光谱';
        renderSelector();
        renderDetail();
        finishUpdating(payload);
    }

    function update(spd, metrics, options) {
        var payload = { spd: Array.from(spd || []), metrics: metrics, options: options || null };
        pendingPayload = payload;
        comparisonPreview = false;
        calculate(payload);

        try {
            var cct = Number(metrics && metrics.quality ? metrics.quality.cct : (metrics ? metrics.cct : 0)) || 0;
            if (cct > 0 && spd && spd.length > 0 && isPayloadCurrent(payload)) {
                localStorage.setItem('spectral_optimizer_spd', JSON.stringify({
                    spd: Array.from(spd),
                    cct: Math.round(cct),
                    timestamp: Date.now()
                }));
            }
        } catch (e) { /* localStorage unavailable */ }
    }

    /* ---- Material appearance optimization ---- */

    function optimizationMaterialIds(scope) {
        var materials = getCombinedList().filter(function (material) {
            return Array.isArray(material.reflectance) && material.reflectance.length === 81;
        });
        if (scope === 'selected') {
            return materials.filter(function (material) { return material.id === selectedId; })
                .map(function (material) { return material.id; });
        }
        return materials.map(function (material) { return material.id; });
    }

    function selectedOptimizationResults(materialIds) {
        return latestResults.filter(function (result) {
            return materialIds.indexOf(result.materialId) >= 0 && Number.isFinite(result.deltaE00);
        });
    }

    function summarizeResults(materialIds) {
        var selected = selectedOptimizationResults(materialIds);
        if (!selected.length) return null;
        var values = selected.map(function (result) { return result.deltaE00; });
        return {
            count: selected.length,
            meanDeltaE00: values.reduce(function (sum, value) { return sum + value; }, 0) / values.length,
            maxDeltaE00: Math.max.apply(Math, values)
        };
    }

    function applyPanelProfileOverride(profile, override, level) {
        if (!profile || !override || typeof override !== 'object') return profile;
        var levelOverride = override.levels && override.levels[level] && typeof override.levels[level] === 'object'
            ? override.levels[level]
            : {};
        var merged = Object.assign({}, profile, {
            source: 'scene',
            importance: Number.isFinite(Number(override.importance)) ? Number(override.importance) : profile.importance,
            weights: Object.assign({}, profile.weights, override.weights || {})
        });
        ['targetDeltaC', 'targetDeltaH', 'targetDeltaL', 'maxAbsDeltaH', 'maxAbsDeltaL', 'maxDeltaE00']
            .forEach(function (field) {
                if (Number.isFinite(Number(levelOverride[field]))) merged[field] = Number(levelOverride[field]);
            });
        return merged;
    }

    function resolvedProfilesForIds(materialIds, level, transientOverrides) {
        var profiles = {};
        materialIds.forEach(function (materialId) {
            var material = getMaterialById(materialId);
            var profile = resolvedPreference(material, level);
            if (profile) profiles[materialId] = applyPanelProfileOverride(
                profile,
                transientOverrides && transientOverrides[materialId],
                level
            );
        });
        return profiles;
    }

    function summarizePreferenceResults(materialIds, level, transientOverrides) {
        var selected = selectedOptimizationResults(materialIds);
        if (!selected.length || !OPTIMIZER || typeof OPTIMIZER.summarizeMaterialPreference !== 'function') return null;
        var summary = OPTIMIZER.summarizeMaterialPreference(
            selected,
            resolvedProfilesForIds(materialIds, level, transientOverrides)
        );
        if (!Number.isFinite(summary.weightedMeanPreferenceError)) return null;
        summary.count = selected.length;
        return summary;
    }

    function optimizationButtonLabel(mode, busy) {
        if (busy) return '正在优化…';
        return mode === 'fidelity' ? '优化准确还原' : '优化偏好表现';
    }

    function setOptimizationStatus(message, level, busy) {
        var status = element('material-optimization-status');
        var button = element('material-optimize-button');
        var goalSelect = element('material-preference-goal');
        var scopeSelect = element('material-optimization-scope');
        var levelSelect = element('material-preference-level');
        optimizationBusy = Boolean(busy);
        if (status) {
            status.textContent = message;
            if (level) status.dataset.level = level;
            else delete status.dataset.level;
        }
        if (button) {
            button.disabled = optimizationBusy;
            button.textContent = optimizationButtonLabel(preferenceGoal(), optimizationBusy);
        }
        [goalSelect, scopeSelect, levelSelect].forEach(function (control) {
            if (control) control.disabled = optimizationBusy;
        });
    }

    function syncOptimizationControls(showCurrentSummary) {
        var goal = preferenceGoal();
        var levelField = element('material-preference-level-field');
        if (levelField) levelField.hidden = goal !== 'preference';
        var button = element('material-optimize-button');
        if (button && !optimizationBusy) button.textContent = optimizationButtonLabel(goal, false);
        updatePreferenceSummary(getMaterialById(selectedId));
        if (!showCurrentSummary || optimizationBusy) return;

        var scopeSelect = element('material-optimization-scope');
        var ids = optimizationMaterialIds(scopeSelect ? scopeSelect.value : 'selected');
        if (goal === 'fidelity') {
            var fidelity = summarizeResults(ids);
            setOptimizationStatus(fidelity
                ? '当前范围 ' + fidelity.count + ' 种材质 · 平均 ΔE00 ' + fidelity.meanDeltaE00.toFixed(2) + ' · 最大 ' + fidelity.maxDeltaE00.toFixed(2)
                : '保持目标色点，降低平均与最大 ΔE00', '', false);
            return;
        }
        var preference = summarizePreferenceResults(ids, preferenceLevel());
        setOptimizationStatus(preference
            ? '当前范围 ' + preference.count + ' 种材质 · 平均偏好误差 ' + preference.weightedMeanPreferenceError.toFixed(2) +
                ' · 平均 ΔC* ' + signed(preference.weightedMeanDeltaC, 2) +
                ' / 目标 ' + signed(preference.weightedTargetDeltaC, 2)
            : '按各材质独立偏好目标优化彩度、色相和明度', '', false);
    }

    function diningDuvText(value) {
        var number = Number(value) || 0;
        return (number > 0 ? '+' : '') + number.toFixed(4);
    }

    function selectedDiningProfile() {
        var select = element('dining-light-profile');
        if (!select || !DINING || typeof DINING.getProfile !== 'function') return null;
        return DINING.getProfile(select.value);
    }

    function renderDiningProfile() {
        var profile = selectedDiningProfile();
        var recommendation = element('dining-light-recommendation');
        var description = element('dining-light-description');
        if (!profile || !recommendation || !description) return;
        recommendation.textContent = '推荐 ' + profile.recommendedCct.toLocaleString() + ' K' +
            '（' + profile.cctRange[0].toLocaleString() + '–' + profile.cctRange[1].toLocaleString() + ' K）' +
            ' · Duv ' + diningDuvText(profile.recommendedDuv);
        description.textContent = profile.descriptionCN + ' ' + profile.noteCN;
        description.dataset.cameraProxy = profile.cameraProxy ? 'true' : 'false';
    }

    function bindDiningLight() {
        var bar = document.querySelector('.dining-light-bar');
        var select = element('dining-light-profile');
        var apply = element('dining-light-apply');
        if (!bar || !select || !apply) return;
        if (!DINING || typeof DINING.listProfiles !== 'function' || typeof DINING.profileOverrides !== 'function') {
            bar.hidden = true;
            return;
        }
        var profiles = DINING.listProfiles();
        select.innerHTML = '';
        profiles.forEach(function (profile) {
            var option = document.createElement('option');
            option.value = profile.id;
            option.textContent = profile.nameCN;
            select.appendChild(option);
        });
        if (profiles.length) select.value = profiles[0].id;
        renderDiningProfile();
        select.addEventListener('change', renderDiningProfile);

        apply.addEventListener('click', function () {
            if (optimizationBusy) return;
            var profile = selectedDiningProfile();
            if (!profile) return;
            var level = preferenceLevel();
            var sceneOverrides = DINING.profileOverrides(profile.id, level);
            var materialIds = profile.materialIds.slice();
            var before = summarizePreferenceResults(materialIds, level, sceneOverrides);
            if (!latestContext || !before || !materialIds.length) {
                setOptimizationStatus('当前没有可用于餐饮光色优化的食材计算结果。', 'error', false);
                return;
            }

            var goalSelect = element('material-preference-goal');
            if (goalSelect) goalSelect.value = 'preference';
            switchToCategory('food');
            selectedId = materialIds[0];
            renderSelector();
            renderDetail();
            syncOptimizationControls(false);
            setOptimizationStatus('正在按“' + profile.nameCN + '”的食材独立目标搜索通道配方…', '', true);
            document.dispatchEvent(new CustomEvent('spectral-material-optimization-request', {
                detail: {
                    goal: 'preference',
                    mode: 'preference',
                    level: level,
                    scope: 'dining',
                    selectedId: selectedId,
                    category: 'food',
                    materialIds: materialIds,
                    sessionOverrides: JSON.parse(JSON.stringify(sessionOverrides)),
                    profileOverridesByMaterialId: JSON.parse(JSON.stringify(sceneOverrides)),
                    diningProfileId: profile.id,
                    diningProfileName: profile.nameCN,
                    cct: latestContext.cct,
                    before: before
                }
            }));
        });
    }

    function bindMaterialOptimization() {
        var button = element('material-optimize-button');
        var goalSelect = element('material-preference-goal');
        var scopeSelect = element('material-optimization-scope');
        var levelSelect = element('material-preference-level');
        if (!button || !goalSelect || !scopeSelect || !levelSelect) return;

        button.addEventListener('click', function () {
            if (optimizationBusy) return;
            if (root.OptimizationComparison && typeof root.OptimizationComparison.clear === 'function') {
                root.OptimizationComparison.clear('material');
            }
            var goal = preferenceGoal();
            var level = preferenceLevel();
            var scope = scopeSelect.value || 'selected';
            var materialIds = optimizationMaterialIds(scope);
            var before = goal === 'fidelity'
                ? summarizeResults(materialIds)
                : summarizePreferenceResults(materialIds, level);
            if (!latestContext || !before || !materialIds.length) {
                setOptimizationStatus('当前没有可用于优化的材质计算结果。', 'error', false);
                return;
            }
            setOptimizationStatus(goal === 'fidelity'
                ? '正在搜索综合色差更低的通道配方…'
                : '正在按各材质独立偏好目标搜索通道配方…', '', true);
            document.dispatchEvent(new CustomEvent('spectral-material-optimization-request', {
                detail: {
                    goal: goal,
                    mode: goal,
                    level: level,
                    scope: scope,
                    selectedId: selectedId,
                    category: selectedId ? (getMaterialById(selectedId) || {}).category || 'all' : 'all',
                    materialIds: materialIds,
                    sessionOverrides: JSON.parse(JSON.stringify(sessionOverrides)),
                    cct: latestContext.cct,
                    before: before
                }
            }));
        });

        [goalSelect, scopeSelect, levelSelect].forEach(function (control) {
            control.addEventListener('change', function () {
                if (root.OptimizationComparison && typeof root.OptimizationComparison.clear === 'function') {
                    root.OptimizationComparison.clear('material');
                }
                syncOptimizationControls(true);
            });
        });

        document.addEventListener('spectral-material-optimization-result', function (event) {
            var detail = event.detail || {};
            if (detail.diningProfileId) return;
            var goal = detail.goal || detail.mode || preferenceGoal();
            var scenePrefix = detail.diningProfileName ? detail.diningProfileName + ' · ' : '';
            if (detail.error) {
                comparisonPreview = false;
                if (root.OptimizationComparison && typeof root.OptimizationComparison.clear === 'function') {
                    root.OptimizationComparison.clear('material');
                }
                setOptimizationStatus(scenePrefix + detail.error, 'error', false);
                return;
            }
            comparisonPreview = Boolean(detail.beforeSnapshot && detail.afterSnapshot);
            var technicalDetails = element('material-technical-details');
            if (technicalDetails && comparisonPreview) {
                technicalDetails.hidden = false;
                technicalDetails.open = true;
            }
            var comparisonChanged = root.OptimizationComparison && detail.beforeSnapshot && detail.afterSnapshot
                ? root.OptimizationComparison.render('material', detail, {
                    summary: detail.improved ? '通道配方和光谱已更新' : '当前约束下配方未发生可见变化'
                })
                : false;
            if (technicalDetails && comparisonPreview) technicalDetails.open = false;
            if (!comparisonPreview && root.OptimizationComparison && typeof root.OptimizationComparison.clear === 'function') {
                root.OptimizationComparison.clear('material');
            }
            if (!detail.improved || !detail.before || !detail.after) {
                renderDetail();
                setOptimizationStatus(scenePrefix + (detail.message || (goal === 'fidelity'
                    ? '当前色点和通道范围内未找到更低的综合色差。'
                    : '当前色点和通道范围内未找到更合适的偏好增强配方。')) +
                    (detail.beforeSnapshot ? (comparisonChanged ? ' 已显示候选配方对比。' : ' 优化前后通道值相同。') : ''), 'warning', false);
                return;
            }
            if (goal === 'preference') {
                renderDetail();
                var worstMaterial = getMaterialById(detail.after.worstMaterialId);
                var maxDeltaMaterial = getMaterialById(detail.after.maxDeltaE00MaterialId);
                var worstName = worstMaterial ? worstMaterial.nameCN : detail.after.worstMaterialId;
                var maxDeltaName = maxDeltaMaterial ? maxDeltaMaterial.nameCN : detail.after.maxDeltaE00MaterialId;
                setOptimizationStatus(
                    scenePrefix + '平均偏好误差 ' + detail.before.weightedMeanPreferenceError.toFixed(2) + ' → ' + detail.after.weightedMeanPreferenceError.toFixed(2) +
                    ' · 平均 ΔC* ' + signed(detail.after.weightedMeanDeltaC, 2) + ' / 目标 ' + signed(detail.after.weightedTargetDeltaC, 2) +
                    ' · 最差材质 ' + worstName +
                    ' · 最大 ΔE00 ' + detail.after.maxDeltaE00.toFixed(2) + '（' + maxDeltaName + '）' +
                    ' · Δu′v′ ' + detail.after.deltaUpVp.toFixed(4),
                    'success',
                    false
                );
                return;
            }
            setOptimizationStatus(
                '平均 ΔE00 ' + detail.before.meanDeltaE00.toFixed(2) + ' → ' + detail.after.meanDeltaE00.toFixed(2) +
                ' · 最大 ' + detail.before.maxDeltaE00.toFixed(2) + ' → ' + detail.after.maxDeltaE00.toFixed(2) +
                ' · Δu′v′ ' + detail.after.deltaUpVp.toFixed(4),
                'success',
                false
            );
            renderDetail();
        });

        syncOptimizationControls(false);
    }

    /* ---- Material preference editor ---- */

    function preferenceLevelLabel(level) {
        return level === 'soft' ? '柔和' : level === 'vivid' ? '鲜明' : '推荐';
    }

    function setPreferenceDialogError(message) {
        var error = element('material-preference-error');
        if (!error) return;
        error.textContent = message || '';
        error.hidden = !message;
    }

    function hidePreferenceDialog() {
        var overlay = element('material-preference-dialog');
        if (overlay) overlay.hidden = true;
        setPreferenceDialogError('');
        preferenceDialogMaterialId = '';
    }

    function showPreferenceDialog() {
        var overlay = element('material-preference-dialog');
        var material = getMaterialById(selectedId);
        if (!overlay || !material) return;
        preferenceDialogMaterialId = material.id;
        preferenceDialogLevel = preferenceLevel();
        var profile = resolvedPreference(material, preferenceDialogLevel);
        if (!profile) return;
        element('material-preference-dialog-context').textContent = material.nameCN + ' · ' + preferenceLevelLabel(preferenceDialogLevel) + '档';
        element('material-pref-target-dc').value = profile.targetDeltaC;
        element('material-pref-target-dh').value = profile.targetDeltaH;
        element('material-pref-target-dl').value = profile.targetDeltaL;
        element('material-pref-max-dh').value = profile.maxAbsDeltaH;
        element('material-pref-max-dl').value = profile.maxAbsDeltaL;
        element('material-pref-max-de').value = profile.maxDeltaE00;
        element('material-pref-importance').value = profile.importance;
        setPreferenceDialogError('');
        overlay.hidden = false;
        element('material-pref-target-dc').focus();
    }

    function preferenceFormOverride() {
        var current = loadCurrentOverrides()[preferenceDialogMaterialId] || {};
        var override = JSON.parse(JSON.stringify(current));
        override.importance = Number(element('material-pref-importance').value);
        override.levels = override.levels || {};
        override.levels[preferenceDialogLevel] = {
            targetDeltaC: Number(element('material-pref-target-dc').value),
            targetDeltaH: Number(element('material-pref-target-dh').value),
            targetDeltaL: Number(element('material-pref-target-dl').value),
            maxAbsDeltaH: Number(element('material-pref-max-dh').value),
            maxAbsDeltaL: Number(element('material-pref-max-dl').value),
            maxDeltaE00: Number(element('material-pref-max-de').value)
        };
        return override;
    }

    function bindPreferenceEditor() {
        var overlay = element('material-preference-dialog');
        var open = element('material-preference-open');
        var cancel = element('material-preference-cancel');
        var save = element('material-preference-save');
        var reset = element('material-preference-reset');
        if (!overlay || !open || !cancel || !save || !reset) return;

        open.addEventListener('click', showPreferenceDialog);
        cancel.addEventListener('click', hidePreferenceDialog);
        overlay.addEventListener('click', function (event) {
            if (event.target === overlay) hidePreferenceDialog();
        });

        save.addEventListener('click', function () {
            var material = getMaterialById(preferenceDialogMaterialId);
            if (!material || !PROFILES) return;
            var override = preferenceFormOverride();
            var validation = typeof PROFILES.validatePreferenceOverride === 'function'
                ? PROFILES.validatePreferenceOverride(override)
                : { ok: false, errors: ['偏好参数模块不可用'] };
            if (!validation.ok) {
                setPreferenceDialogError(validation.errors.join('；'));
                return;
            }
            var saved = { ok: false, errors: ['浏览器未允许保存本地设置'] };
            try {
                if (typeof PROFILES.saveOverride === 'function') {
                    saved = PROFILES.saveOverride(material.id, override, root.localStorage);
                }
            } catch (error) {
                saved = { ok: false, errors: [error && error.message ? error.message : '浏览器未允许保存本地设置'] };
            }
            if (saved.ok) delete sessionOverrides[material.id];
            else sessionOverrides[material.id] = override;
            hidePreferenceDialog();
            updatePreferenceSummary(material);
            syncOptimizationControls(true);
            setOptimizationStatus(saved.ok
                ? '已保存 ' + material.nameCN + ' 的' + preferenceLevelLabel(preferenceDialogLevel) + '档偏好参数。'
                : '参数已用于当前会话；浏览器未允许保存本地设置。', saved.ok ? 'success' : 'warning', false);
        });

        reset.addEventListener('click', function () {
            var material = getMaterialById(preferenceDialogMaterialId);
            if (!material || !PROFILES) return;
            try {
                if (typeof PROFILES.removeOverride === 'function') {
                    PROFILES.removeOverride(material.id, root.localStorage);
                }
            } catch (error) { /* storage unavailable */ }
            delete sessionOverrides[material.id];
            hidePreferenceDialog();
            updatePreferenceSummary(material);
            syncOptimizationControls(true);
            setOptimizationStatus('已恢复 ' + material.nameCN + ' 的系统偏好参数。', 'success', false);
        });
    }

    /* ---- Category Tabs ---- */

    function bindCategoryTabs() {
        var tabsContainer = element('material-category-tabs');
        if (!tabsContainer) return;
        var tabs = tabsContainer.querySelectorAll('.category-pill');
        tabs.forEach(function (tab) {
            tab.addEventListener('click', function () {
                tabs.forEach(function (t) {
                    t.classList.remove('is-selected');
                    t.setAttribute('aria-selected', 'false');
                });
                tab.classList.add('is-selected');
                tab.setAttribute('aria-selected', 'true');
                selectedCategory = tab.dataset.category;

                // Default to first material in this category
                var combined = getCombinedList();
                var catMats = combined.filter(function (m) {
                    if (selectedCategory === 'user') return !!m.isUserMaterial;
                    return m.category === selectedCategory;
                });
                if (catMats.length > 0) selectedId = catMats[0].id;

                renderSelector();
                renderDetail();
            });
        });
    }

    /* ---- Upload Dialog ---- */

    var uploadState = { csvValues: null, csvFileName: null, photoDataUrl: null };

    function showUploadDialog() {
        var overlay = element('material-upload-overlay');
        if (!overlay) return;
        resetUploadState();
        overlay.hidden = false;
        element('upload-material-name').focus();
    }

    function hideUploadDialog() {
        var overlay = element('material-upload-overlay');
        if (overlay) overlay.hidden = true;
        resetUploadState();
    }

    function resetUploadState() {
        uploadState = { csvValues: null, csvFileName: null, photoDataUrl: null };
        element('upload-material-name').value = '';
        element('upload-material-category').value = 'wood';
        element('upload-csv-preview').hidden = true;
        element('upload-csv-preview').innerHTML = '';
        element('upload-photo-preview').hidden = true;
        element('upload-photo-preview').innerHTML = '';
        element('upload-error').hidden = true;
        element('upload-dialog-submit').disabled = true;
    }

    function updateSubmitState() {
        var nameOk = element('upload-material-name').value.trim().length > 0;
        var csvOk = uploadState.csvValues && uploadState.csvValues.length === 81;
        element('upload-dialog-submit').disabled = !(nameOk && csvOk);
    }

    function showUploadError(msg) {
        var errEl = element('upload-error');
        errEl.textContent = msg;
        errEl.hidden = false;
    }

    function bindUploadDialog() {
        var overlay = element('material-upload-overlay');
        if (!overlay) return;

        // Cancel
        element('upload-dialog-cancel').addEventListener('click', hideUploadDialog);
        overlay.addEventListener('click', function (e) {
            if (e.target === overlay) hideUploadDialog();
        });

        // Name input
        element('upload-material-name').addEventListener('input', updateSubmitState);

        // CSV drop zone
        var csvZone = element('upload-csv-zone');
        var csvInput = element('material-csv-input');

        csvZone.addEventListener('click', function () { csvInput.click(); });
        csvZone.addEventListener('dragover', function (e) { e.preventDefault(); csvZone.classList.add('is-dragover'); });
        csvZone.addEventListener('dragleave', function () { csvZone.classList.remove('is-dragover'); });
        csvZone.addEventListener('drop', function (e) {
            e.preventDefault();
            csvZone.classList.remove('is-dragover');
            var file = e.dataTransfer.files[0];
            if (file) processCsvFile(file);
        });
        csvInput.addEventListener('change', function () {
            if (csvInput.files[0]) processCsvFile(csvInput.files[0]);
        });

        // Photo drop zone
        var photoZone = element('upload-photo-zone');
        var photoInput = element('material-photo-input');

        photoZone.addEventListener('click', function () { photoInput.click(); });
        photoZone.addEventListener('dragover', function (e) { e.preventDefault(); photoZone.classList.add('is-dragover'); });
        photoZone.addEventListener('dragleave', function () { photoZone.classList.remove('is-dragover'); });
        photoZone.addEventListener('drop', function (e) {
            e.preventDefault();
            photoZone.classList.remove('is-dragover');
            var file = e.dataTransfer.files[0];
            if (file) processPhotoFile(file);
        });
        photoInput.addEventListener('change', function () {
            if (photoInput.files[0]) processPhotoFile(photoInput.files[0]);
        });

        // Submit
        element('upload-dialog-submit').addEventListener('click', function () {
            var nameCN = element('upload-material-name').value.trim();
            var category = element('upload-material-category').value;
            if (!nameCN || !uploadState.csvValues) return;

            var mat = UPLOAD.createUserMaterial(nameCN, uploadState.csvValues, uploadState.photoDataUrl, category);
            var result = UPLOAD.addUserMaterial(mat);
            if (result.error) {
                showUploadError(result.error);
                return;
            }
            hideUploadDialog();
            selectedId = mat.id;
            renderSelector();
            renderDetail();
            // Trigger re-calculation with current spectrum
            if (pendingPayload) calculate(pendingPayload);
        });
    }

    function processCsvFile(file) {
        var reader = new FileReader();
        reader.onload = function () {
            var parsed = UPLOAD.parseReflectanceCSV(reader.result);
            if (parsed.error) {
                showUploadError('CSV 解析失败：' + parsed.error);
                uploadState.csvValues = null;
                uploadState.csvFileName = null;
            } else {
                element('upload-error').hidden = true;
                uploadState.csvValues = parsed.values;
                uploadState.csvFileName = file.name;
                var preview = element('upload-csv-preview');
                preview.hidden = false;
                preview.innerHTML = '<span>✅ ' + escHtml(file.name) + '</span><span>' + parsed.values.length + ' 个波长点 · ' + (parsed.hasWL ? '含波长列' : '仅反射率列') + ' · ' + parsed.originalPairs + ' 行</span>';
            }
            updateSubmitState();
        };
        reader.onerror = function () { showUploadError('文件读取失败'); };
        reader.readAsText(file);
    }

    function processPhotoFile(file) {
        UPLOAD.readPhotoFile(file).then(function (dataUrl) {
            uploadState.photoDataUrl = dataUrl;
            var preview = element('upload-photo-preview');
            preview.hidden = false;
            preview.innerHTML = '<img src="' + dataUrl + '" alt=""> <span>' + escHtml(file.name) + '</span>';
        }).catch(function (err) {
            showUploadError('照片：' + err.message);
        });
    }

    function switchToCategory(cat) {
        selectedCategory = cat;
        var tabs = element('material-category-tabs').querySelectorAll('.category-pill');
        tabs.forEach(function (t) {
            t.classList.remove('is-selected');
            t.setAttribute('aria-selected', 'false');
            if (t.dataset.category === cat) {
                t.classList.add('is-selected');
                t.setAttribute('aria-selected', 'true');
            }
        });
    }

    /* ---- User Material Deletion ---- */

    function deleteUserMaterial(id) {
        if (!confirm('确定要删除这个材质吗？删除后不可恢复。')) return;
        if (UPLOAD) UPLOAD.removeUserMaterial(id);
        if (PROFILES && typeof PROFILES.removeOverride === 'function') {
            try { PROFILES.removeOverride(id, root.localStorage); } catch (error) { /* storage unavailable */ }
        }
        delete sessionOverrides[id];
        // If the deleted material was selected, pick a new one
        if (selectedId === id) {
            var combined = getCombinedList();
            if (combined.length > 0) selectedId = combined[0].id;
        }
        renderSelector();
        renderDetail();
        // Recalculate to remove stale results
        if (pendingPayload) calculate(pendingPayload);
    }

    /* ---- HTML escaping ---- */

    function escHtml(str) {
        var div = document.createElement('div');
        div.appendChild(document.createTextNode(str));
        return div.innerHTML;
    }

    /* ---- Init ---- */

    function init() {
        if (!DATA || !COLOR) {
            var panel = element('material-panel');
            if (panel) panel.hidden = true;
            if (root.SpectralAppReadiness) {
                root.SpectralAppReadiness.markFailed('material', '材质分析模块加载失败。');
            }
            return;
        }
        bindMaterialOptimization();
        bindPreferenceEditor();
        bindUploadDialog();
        renderSelector();
        renderDetail();
        if (root.SpectralAppReadiness) {
            root.SpectralAppReadiness.markReady('material', '材质分析模块加载完成。');
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }

    root.MaterialPanel = Object.freeze({
        update: update,
        setUpdating: setUpdating,
        setOptimizationStatus: setOptimizationStatus,
        optimizationMaterialIds: optimizationMaterialIds
    });
})(typeof globalThis !== 'undefined' ? globalThis : window);
