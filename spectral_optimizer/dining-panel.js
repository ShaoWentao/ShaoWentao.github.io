(function (root) {
    'use strict';

    var DINING = root.DiningLightData;
    var COLOR = root.MaterialColor;
    var PREVIEW = root.MaterialPreviewColor;
    var builtInMaterials = DINING ? DINING.listMaterials() : [];
    var uploadedFoods = [];
    var selectedId = builtInMaterials[0] ? builtInMaterials[0].id : '';
    var latestSpd = null;
    var latestMetrics = null;
    var latestResults = [];
    var lastOptimization = null;
    var uploadImageDataUrl = '';
    var previewRenderToken = 0;
    var PREVIEW_GAIN = 3;
    var BEFORE_PREVIEW_SATURATION = 0.72;

    function byId(id) { return document.getElementById(id); }
    function escapeHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    }
    function signed(value, digits) {
        var number = Number(value);
        return (number >= 0 ? '+' : '') + number.toFixed(digits == null ? 2 : digits);
    }
    function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
    function allMaterials() { return builtInMaterials.concat(uploadedFoods); }
    function materialById(id) {
        return allMaterials().find(function (material) { return material.id === id; }) || null;
    }
    function materialDisplayName(id, fallback) {
        var material = materialById(id);
        return material && material.nameCN ? material.nameCN : (fallback || id || '—');
    }
    function resultById(results, id) {
        return (results || []).find(function (result) { return result.materialId === id; }) || null;
    }

    function appearanceUrl(material) {
        var source = material && material.appearanceSource || {};
        return source.dataUrl || source.file || source.fallbackFile || '';
    }

    function fallbackAppearanceUrl(material) {
        var source = material && material.appearanceSource || {};
        return source.dataUrl ? '' : (source.fallbackFile || '');
    }

    function appearanceStyle(material, filter) {
        var url = appearanceUrl(material);
        var fallback = fallbackAppearanceUrl(material);
        if (!url) return '--texture-url:none;--texture-x:50%;--texture-y:50%;--texture-size:cover;--appearance-filter:none;';
        var layers = "url('" + url + "')" + (fallback && fallback !== url ? ",url('" + fallback + "')" : '');
        return '--texture-url:' + layers + ';--texture-x:50%;--texture-y:50%;--texture-size:cover;--appearance-filter:' + (filter || 'none') + ';';
    }

    function setAppearance(id, material, filter) {
        var target = byId(id);
        if (!target) return;
        target.style.cssText = appearanceStyle(material, filter);
        target.classList.toggle('is-placeholder', !appearanceUrl(material));
    }

    function metricCct(metrics) {
        return Number(metrics && metrics.quality ? metrics.quality.cct : metrics && metrics.cct) || 0;
    }

    function calculateBatch(spd, cct) {
        if (!spd || typeof spd.length !== 'number' || !COLOR) return [];
        return allMaterials().map(function (material) {
            try {
                return COLOR.calculateMaterialDelta(spd, { material: material, cct: cct });
            } catch (error) {
                return null;
            }
        }).filter(Boolean);
    }

    function populateCuisineProfiles() {
        var select = byId('dining-cuisine-profile');
        if (!select || !DINING || typeof DINING.listCuisineProfiles !== 'function') return;
        select.innerHTML = DINING.listCuisineProfiles().map(function (profile) {
            return '<option value="' + profile.id + '">' + escapeHtml(profile.nameCN) + '</option>';
        }).join('');
        if (select.options.length) select.value = 'comprehensive';
    }

    function populateUploadTemplates() {
        var select = byId('dining-food-upload-template');
        if (!select) return;
        select.innerHTML = builtInMaterials.map(function (material) {
            return '<option value="' + material.id + '">' + escapeHtml(material.nameCN) + '</option>';
        }).join('');
        if (select.options.length) select.value = builtInMaterials[0].id;
    }

    function selectedCuisineProfile() {
        return DINING && typeof DINING.getCuisineProfile === 'function'
            ? DINING.getCuisineProfile(byId('dining-cuisine-profile') ? byId('dining-cuisine-profile').value : 'comprehensive')
            : null;
    }

    function selectedLevel() {
        return byId('dining-preference-level') ? byId('dining-preference-level').value : 'recommended';
    }

    function selectedTargetMode() {
        return byId('dining-target-mode') ? byId('dining-target-mode').value : 'current';
    }

    function selectedGoal() {
        return byId('dining-optimization-goal') ? byId('dining-optimization-goal').value : 'preference';
    }

    function activeBuiltInMaterialIds(cuisineProfile) {
        if (!cuisineProfile) return [];
        if (DINING && typeof DINING.resolveMaterialIds === 'function') {
            return DINING.resolveMaterialIds(cuisineProfile.id);
        }
        return cuisineProfile.dishTypeIds.slice();
    }

    function optimizationMaterialIds(cuisineProfile) {
        var activeIds = activeBuiltInMaterialIds(cuisineProfile);
        var activeSet = new Set(activeIds);
        return activeIds.concat(uploadedFoods.filter(function (food) {
            return activeSet.has(DINING && typeof DINING.migrateTemplateId === 'function'
                ? DINING.migrateTemplateId(food.templateId) : food.templateId);
        }).map(function (food) { return food.id; }));
    }

    function updateProfileCopy() {
        var cuisineProfile = selectedCuisineProfile();
        if (!cuisineProfile) return;
        var activeCount = activeBuiltInMaterialIds(cuisineProfile).length;
        var recommendation = byId('dining-light-recommendation');
        var description = byId('dining-light-description');
        var target = byId('dining-target-summary');
        if (recommendation) recommendation.textContent = '推荐 ' + cuisineProfile.recommendedCct + ' K · 适用范围 ' +
            cuisineProfile.cctRange[0] + '–' + cuisineProfile.cctRange[1] + ' K · Duv ' + Number(cuisineProfile.recommendedDuv).toFixed(4);
        if (description) description.textContent = cuisineProfile.nameCN + ' · ' + cuisineProfile.descriptionCN +
            ' 当前有' + activeCount + '类菜式参与优化。' + (cuisineProfile.cameraProxy
                ? ' 当前推荐同时考虑手机拍摄下的浅色稳定性。' : '');
        if (target) {
            var currentCctValue = metricCct(latestMetrics);
            var currentCct = currentCctValue > 0 ? Math.round(currentCctValue) + ' K' : '等待计算';
            target.textContent = selectedTargetMode() === 'recommended'
                ? '将采用菜系推荐色点 ' + cuisineProfile.recommendedCct + ' K · Duv ' + Number(cuisineProfile.recommendedDuv).toFixed(4)
                : '将保持当前色点 ' + currentCct;
        }
    }

    function thumbnailCaption(material, result, participating) {
        if (material.isUserFood) return (participating ? '参与优化' : '当前菜系不参与') + ' · ' + material.templateNameCN;
        var dishes = material.representativeDishesCN || '';
        if (!participating) return '当前菜系不参与 · ' + dishes;
        return (result ? 'ΔE00 ' + result.deltaE00.toFixed(2) : '参与优化') + (dishes ? ' · ' + dishes : '');
    }

    function renderSelector() {
        var selector = byId('dining-material-selector');
        if (!selector) return;
        selector.innerHTML = '';
        var cuisineProfile = selectedCuisineProfile();
        var activeSet = new Set(optimizationMaterialIds(cuisineProfile));
        allMaterials().forEach(function (material) {
            var item = document.createElement('div');
            item.className = 'dining-food-selector-item';
            var button = document.createElement('button');
            button.type = 'button';
            var participating = activeSet.has(material.id);
            button.dataset.materialId = material.id;
            button.dataset.participating = participating ? 'true' : 'false';
            button.className = (material.id === selectedId ? 'is-selected ' : '') + (participating ? '' : 'is-inactive');
            button.setAttribute('aria-pressed', material.id === selectedId ? 'true' : 'false');
            var result = resultById(latestResults, material.id);
            button.innerHTML = '<span class="material-thumb' + (appearanceUrl(material) ? '' : ' is-placeholder') + '" style="' + appearanceStyle(material, 'none') + '"></span>' +
                '<span class="material-selector-copy"><strong>' + escapeHtml(material.nameCN) + '</strong><small>' +
                escapeHtml(thumbnailCaption(material, result, participating)) + '</small></span>';
            button.addEventListener('click', function () {
                selectedId = material.id;
                renderSelector();
                renderDetail();
            });
            item.appendChild(button);
            if (material.isUserFood) {
                var remove = document.createElement('button');
                remove.type = 'button';
                remove.className = 'dining-food-delete';
                remove.title = '删除此食材照片';
                remove.setAttribute('aria-label', '删除' + material.nameCN);
                remove.textContent = '×';
                remove.addEventListener('click', function () {
                    uploadedFoods = uploadedFoods.filter(function (food) { return food.id !== material.id; });
                    if (selectedId === material.id) selectedId = builtInMaterials[0] ? builtInMaterials[0].id : '';
                    latestResults = latestSpd ? calculateBatch(latestSpd, metricCct(latestMetrics)) : [];
                    if (lastOptimization) invalidateOptimizationResult('参与优化的食材已改变，请重新运行。');
                    else {
                        renderSelector();
                        renderDetail();
                        summarizeProfile();
                    }
                });
                item.appendChild(remove);
            }
            selector.appendChild(item);
        });
    }

    function metricsHtml(result) {
        if (!result) return '<span>等待有效光谱</span>';
        return '<span><small>ΔE00</small><strong>' + result.deltaE00.toFixed(2) + '</strong></span>' +
            '<span><small>ΔL*</small><strong>' + signed(result.deltaL) + '</strong></span>' +
            '<span><small>ΔC*</small><strong>' + signed(result.deltaC) + '</strong></span>' +
            '<span><small>Δh</small><strong>' + signed(result.deltaH) + '°</strong></span>';
    }

    function previewDelta(beforeResult, afterResult) {
        var beforeLab = beforeResult && beforeResult.candidate && beforeResult.candidate.lab;
        var afterLab = afterResult && afterResult.candidate && afterResult.candidate.lab;
        if (!PREVIEW || !beforeLab || !afterLab) return [0, 0, 0];
        return PREVIEW.deltaBetween(beforeLab, afterLab).map(function (value) {
            return clamp(value * PREVIEW_GAIN, -18, 18);
        });
    }

    function drawPreviewImage(canvasId, material, deltaLab, token, saturation) {
        var canvas = byId(canvasId);
        var source = appearanceUrl(material);
        if (!canvas) return;
        var previewSaturation = clamp(Number.isFinite(Number(saturation)) ? Number(saturation) : 1, 0, 2);
        canvas.dataset.previewSaturation = String(previewSaturation);
        if (!source) {
            var emptyContext = canvas.getContext('2d');
            emptyContext.clearRect(0, 0, canvas.width, canvas.height);
            emptyContext.fillStyle = '#ece9e3';
            emptyContext.fillRect(0, 0, canvas.width, canvas.height);
            emptyContext.fillStyle = '#77716a';
            emptyContext.font = '16px sans-serif';
            emptyContext.textAlign = 'center';
            emptyContext.fillText('完整菜式照片待补齐', canvas.width / 2, canvas.height / 2);
            canvas.dataset.imageSource = '';
            canvas.dataset.rendered = String(token);
            return;
        }
        var fallbackSource = fallbackAppearanceUrl(material);
        var triedFallback = false;
        var image = new Image();
        image.onload = function () {
            if (token !== previewRenderToken) return;
            canvas.dataset.imageSource = image.currentSrc || image.src;
            var context = canvas.getContext('2d', { willReadFrequently: true });
            var scale = Math.max(canvas.width / image.naturalWidth, canvas.height / image.naturalHeight);
            var width = image.naturalWidth * scale;
            var height = image.naturalHeight * scale;
            context.clearRect(0, 0, canvas.width, canvas.height);
            context.drawImage(image, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height);
            var delta = Array.isArray(deltaLab) ? deltaLab : [0, 0, 0];
            var hasDelta = delta.some(function (value) { return Math.abs(Number(value) || 0) > 1e-9; });
            var needsPixelMapping = Math.abs(previewSaturation - 1) > 1e-9 || (PREVIEW && hasDelta);
            if (needsPixelMapping) {
                try {
                    var pixels = context.getImageData(0, 0, canvas.width, canvas.height);
                    if (Math.abs(previewSaturation - 1) > 1e-9) {
                        for (var saturationIndex = 0; saturationIndex < pixels.data.length; saturationIndex += 4) {
                            var red = pixels.data[saturationIndex];
                            var green = pixels.data[saturationIndex + 1];
                            var blue = pixels.data[saturationIndex + 2];
                            var luminance = red * 0.2126 + green * 0.7152 + blue * 0.0722;
                            pixels.data[saturationIndex] = clamp(Math.round(luminance + (red - luminance) * previewSaturation), 0, 255);
                            pixels.data[saturationIndex + 1] = clamp(Math.round(luminance + (green - luminance) * previewSaturation), 0, 255);
                            pixels.data[saturationIndex + 2] = clamp(Math.round(luminance + (blue - luminance) * previewSaturation), 0, 255);
                        }
                    }
                    if (PREVIEW && hasDelta) {
                        var cornerSamples = [
                            [4, 4], [canvas.width - 5, 4],
                            [4, canvas.height - 5], [canvas.width - 5, canvas.height - 5]
                        ];
                        var background = [0, 1, 2].map(function (channel) {
                            return cornerSamples.reduce(function (sum, point) {
                                var offset = (point[1] * canvas.width + point[0]) * 4;
                                return sum + pixels.data[offset + channel];
                            }, 0) / cornerSamples.length;
                        });
                        for (var index = 0; index < pixels.data.length; index += 4) {
                            var mapped = PREVIEW.mapRgbWithBackground(
                                [pixels.data[index], pixels.data[index + 1], pixels.data[index + 2]],
                                delta,
                                background
                            );
                            pixels.data[index] = mapped[0];
                            pixels.data[index + 1] = mapped[1];
                            pixels.data[index + 2] = mapped[2];
                        }
                    }
                    context.putImageData(pixels, 0, 0);
                } catch (error) {
                    // Local file:// pages taint canvases loaded from sibling files.
                    // Keep the source photo when pixel access is unavailable.
                }
            }
            canvas.dataset.rendered = String(token);
        };
        image.onerror = function () {
            if (!triedFallback && fallbackSource && fallbackSource !== source) {
                triedFallback = true;
                image.removeAttribute('crossorigin');
                image.src = fallbackSource;
                return;
            }
            var context = canvas.getContext('2d');
            context.clearRect(0, 0, canvas.width, canvas.height);
            context.fillStyle = '#ece9e3';
            context.fillRect(0, 0, canvas.width, canvas.height);
            context.fillStyle = '#77716a';
            context.font = '16px sans-serif';
            context.textAlign = 'center';
            context.fillText('菜式照片加载失败', canvas.width / 2, canvas.height / 2);
            canvas.dataset.imageSource = '';
            canvas.dataset.rendered = String(token);
        };
        if (/^https?:\/\//i.test(source)) image.crossOrigin = 'anonymous';
        image.src = source;
    }

    function comparisonMetricsHtml(before, after) {
        if (!before && !after) return '<span><small>状态</small><strong>等待有效光谱</strong></span>';
        var rows = [
            ['ΔE00', 'deltaE00', ''],
            ['ΔL*', 'deltaL', ''],
            ['ΔC*', 'deltaC', ''],
            ['Δh', 'deltaH', '°']
        ];
        return rows.map(function (row) {
            var beforeValue = before ? Number(before[row[1]]) : NaN;
            var afterValue = after ? Number(after[row[1]]) : NaN;
            function format(value) {
                if (!Number.isFinite(value)) return '—';
                return (row[1] === 'deltaE00' ? value.toFixed(2) : signed(value)) + row[2];
            }
            return '<span><small>' + row[0] + '</small><strong>优化前 ' + format(beforeValue) + '</strong>' +
                '<small></small><strong>优化后 ' + format(afterValue) + '</strong></span>';
        }).join('');
    }

    function renderDetail() {
        var material = materialById(selectedId) || allMaterials()[0];
        if (!material) return;
        selectedId = material.id;
        var title = byId('dining-detail-title');
        var description = byId('dining-detail-description');
        if (title) title.textContent = material.nameCN;
        if (description) {
            description.textContent = material.isUserFood
                ? '光谱模板：' + material.templateNameCN + '。上传照片仅用于外观对比。'
                : material.intendedUseCN || '餐饮食材光色比较。';
        }

        var current = resultById(latestResults, material.id);
        var before = current;
        var after = current;
        if (lastOptimization && lastOptimization.beforeSnapshot && lastOptimization.afterSnapshot) {
            before = resultById(calculateBatch(
                lastOptimization.beforeSnapshot.spd,
                lastOptimization.referenceCct
            ), material.id);
            after = resultById(calculateBatch(
                lastOptimization.afterSnapshot.spd,
                lastOptimization.referenceCct
            ), material.id);
        }

        var comparisonMode = Boolean(lastOptimization && lastOptimization.beforeSnapshot && lastOptimization.afterSnapshot);
        var appliedComparison = comparisonMode && lastOptimization.applied === true;
        previewRenderToken += 1;
        drawPreviewImage(
            'dining-before-preview',
            material,
            [0, 0, 0],
            previewRenderToken,
            BEFORE_PREVIEW_SATURATION
        );
        drawPreviewImage(
            'dining-after-preview',
            material,
            appliedComparison ? previewDelta(before, after) : [0, 0, 0],
            previewRenderToken,
            appliedComparison ? 1 : BEFORE_PREVIEW_SATURATION
        );
        var beforeCaption = byId('dining-before-caption');
        var afterCaption = byId('dining-after-caption');
        if (beforeCaption) beforeCaption.textContent = before
            ? '低饱和基线 · 优化前 ΔE00 ' + before.deltaE00.toFixed(2)
            : '低饱和基线';
        if (afterCaption) afterCaption.textContent = appliedComparison && after
            ? (lastOptimization.recommendedTargetApplied && !lastOptimization.improved ? '菜系推荐色点配方' : '优化后配方') +
                ' · ΔE00 ' + after.deltaE00.toFixed(2)
            : comparisonMode ? '未采用 · 与原图相同' : '运行优化后显示';
        var baselineSummary = byId('dining-baseline-summary');
        if (baselineSummary) {
            var baselineMetrics = lastOptimization && lastOptimization.beforeSnapshot && lastOptimization.beforeSnapshot.metrics;
            var baselineCct = baselineMetrics && Number(baselineMetrics.cct);
            var baselineDuv = baselineMetrics && Number(baselineMetrics.duv);
            baselineSummary.textContent = Number.isFinite(baselineCct)
                ? '本次基线 ' + Math.round(baselineCct) + ' K · Duv ' + (Number.isFinite(baselineDuv) ? signed(baselineDuv, 4) : '—')
                : '本次基线：等待优化';
        }

        var metrics = byId('dining-material-metrics');
        if (metrics) {
            metrics.innerHTML = comparisonMode
                ? comparisonMetricsHtml(before, after)
                : comparisonMetricsHtml(current, null);
        }
        drawReflectance(material);
    }

    function drawReflectance(material) {
        var canvas = byId('dining-reflectance-canvas');
        if (!canvas || !material || !Array.isArray(material.reflectance)) return;
        var ctx = canvas.getContext('2d');
        var width = canvas.width;
        var height = canvas.height;
        ctx.clearRect(0, 0, width, height);
        ctx.strokeStyle = '#d5d8dc';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(38, 10);
        ctx.lineTo(38, height - 24);
        ctx.lineTo(width - 12, height - 24);
        ctx.stroke();
        ctx.strokeStyle = '#43526b';
        ctx.lineWidth = 2;
        ctx.beginPath();
        material.reflectance.forEach(function (value, index) {
            var x = 38 + index / (material.reflectance.length - 1) * (width - 52);
            var y = 10 + (1 - value) * (height - 34);
            if (index === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        });
        ctx.stroke();
    }

    function summarizeProfile() {
        var cuisineProfile = selectedCuisineProfile();
        if (!cuisineProfile || !latestResults.length) return;
        var selectedResults = optimizationMaterialIds(cuisineProfile).map(function (id) { return resultById(latestResults, id); }).filter(Boolean);
        if (!selectedResults.length) return;
        var worst = selectedResults.reduce(function (current, item) { return !current || item.deltaE00 > current.deltaE00 ? item : current; }, null);
        var reference = byId('dining-reference');
        if (reference) {
            var score = lastOptimization && lastOptimization.applied && lastOptimization.after;
            reference.textContent = score && Number.isFinite(score.weightedMeanPreferenceError)
                ? '菜系加权得分 ' + score.weightedMeanPreferenceError.toFixed(2) + ' · 最差菜式 ' +
                    materialDisplayName(score.worstMaterialId, worst.materialNameCN)
                : '待优化 · 当前最大 ΔE00 ' + worst.deltaE00.toFixed(2) + '（' + worst.materialNameCN + '）';
        }
    }

    function setBusy(busy, message, tone) {
        var button = byId('dining-light-apply');
        var controls = [
            byId('dining-cuisine-profile'),
            byId('dining-target-mode'),
            byId('dining-optimization-goal'),
            byId('dining-preference-level')
        ];
        if (button) { button.disabled = busy; button.textContent = busy ? '正在优化…' : '开始餐饮优化'; }
        controls.forEach(function (control) { if (control) control.disabled = busy; });
        if (!busy && byId('dining-preference-level')) {
            byId('dining-preference-level').disabled = selectedGoal() === 'fidelity';
        }
        var status = byId('dining-optimization-status');
        if (status) { status.textContent = message || ''; status.dataset.tone = tone || ''; }
    }

    function invalidateOptimizationResult(message) {
        if (!lastOptimization) return;
        lastOptimization = null;
        var comparison = byId('dining-optimization-comparison');
        if (comparison) comparison.hidden = true;
        var summary = byId('dining-optimization-summary');
        if (summary) summary.textContent = '条件已改变，请重新运行优化';
        var baseline = byId('dining-baseline-summary');
        if (baseline) baseline.textContent = '本次基线：等待优化';
        var cct = metricCct(latestMetrics);
        latestResults = latestSpd && cct > 0 ? calculateBatch(latestSpd, cct) : [];
        renderSelector();
        renderDetail();
        summarizeProfile();
        setBusy(false, message || '优化条件已改变，请重新运行。', 'warning');
    }

    function applyOptimization() {
        var cuisineProfile = selectedCuisineProfile();
        if (!cuisineProfile || !latestSpd || !root.dispatchEvent) return;
        var goal = selectedGoal();
        var targetMode = selectedTargetMode();
        var materialIds = optimizationMaterialIds(cuisineProfile);
        var overrides = DINING.profileOverrides(cuisineProfile.id, selectedLevel());
        uploadedFoods.forEach(function (food) {
            var migratedTemplateId = DINING && typeof DINING.migrateTemplateId === 'function'
                ? DINING.migrateTemplateId(food.templateId) : food.templateId;
            var templateOverride = overrides[migratedTemplateId];
            if (templateOverride && materialIds.includes(food.id)) overrides[food.id] = JSON.parse(JSON.stringify(templateOverride));
        });
        setBusy(true, cuisineProfile.nameCN + ' · 正在搜索餐饮光谱配方…', 'working');
        document.dispatchEvent(new CustomEvent('spectral-material-optimization-request', {
            detail: {
                goal: goal,
                mode: goal,
                level: selectedLevel(),
                scope: 'dining',
                category: 'food',
                materialIds: materialIds,
                materialModels: uploadedFoods.map(function (food) { return food; }),
                profileOverridesByMaterialId: overrides,
                cuisineProfileId: cuisineProfile.id,
                cuisineProfileName: cuisineProfile.nameCN,
                recommendedCct: cuisineProfile.recommendedCct,
                recommendedDuv: cuisineProfile.recommendedDuv,
                cameraProxy: cuisineProfile.cameraProxy,
                targetMode: targetMode,
                targetCct: cuisineProfile.recommendedCct,
                targetDuv: cuisineProfile.recommendedDuv,
                cctRange: cuisineProfile.cctRange.slice(),
                cct: metricCct(latestMetrics)
            }
        }));
    }

    function resetUploadDialog() {
        uploadImageDataUrl = '';
        if (byId('dining-food-upload-name')) byId('dining-food-upload-name').value = '';
        if (byId('dining-food-photo-input')) byId('dining-food-photo-input').value = '';
        if (byId('dining-food-photo-preview')) {
            byId('dining-food-photo-preview').hidden = true;
            byId('dining-food-photo-preview').style.backgroundImage = '';
        }
        showUploadError('');
        updateUploadSubmit();
    }

    function showUploadError(message) {
        var target = byId('dining-food-upload-error');
        if (!target) return;
        target.hidden = !message;
        target.textContent = message || '';
    }

    function updateUploadSubmit() {
        var submit = byId('dining-food-upload-submit');
        var name = byId('dining-food-upload-name');
        var template = byId('dining-food-upload-template');
        if (submit) submit.disabled = !(name && name.value.trim() && template && template.value && uploadImageDataUrl);
    }

    function closeUploadDialog() {
        var overlay = byId('dining-food-upload-overlay');
        if (overlay) overlay.hidden = true;
    }

    function openUploadDialog() {
        resetUploadDialog();
        var overlay = byId('dining-food-upload-overlay');
        if (overlay) overlay.hidden = false;
        if (byId('dining-food-upload-name')) byId('dining-food-upload-name').focus();
    }

    function loadFoodImage(file) {
        if (!file) return Promise.reject(new Error('请选择食材图片。'));
        if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return Promise.reject(new Error('图片格式仅支持 JPG、PNG 或 WebP。'));
        if (file.size > 5 * 1024 * 1024) return Promise.reject(new Error('图片文件不能超过5 MB。'));
        return new Promise(function (resolve, reject) {
            var reader = new FileReader();
            reader.onerror = function () { reject(new Error('图片读取失败。')); };
            reader.onload = function () {
                var image = new Image();
                image.onerror = function () { reject(new Error('图片无法解码。')); };
                image.onload = function () {
                    var side = Math.min(image.naturalWidth, image.naturalHeight);
                    var canvas = document.createElement('canvas');
                    canvas.width = 1024;
                    canvas.height = 1024;
                    var ctx = canvas.getContext('2d');
                    ctx.drawImage(image, (image.naturalWidth - side) / 2, (image.naturalHeight - side) / 2, side, side, 0, 0, 1024, 1024);
                    resolve(canvas.toDataURL('image/webp', 0.86));
                };
                image.src = reader.result;
            };
            reader.readAsDataURL(file);
        });
    }

    function addUploadedFood() {
        var name = byId('dining-food-upload-name').value.trim();
        var templateId = DINING && typeof DINING.migrateTemplateId === 'function'
            ? DINING.migrateTemplateId(byId('dining-food-upload-template').value)
            : byId('dining-food-upload-template').value;
        var template = DINING.getMaterial(templateId);
        if (!name || !template || !uploadImageDataUrl) return;
        var food = {
            id: 'user_food_' + Date.now().toString(36),
            name: name,
            nameCN: name,
            category: 'food',
            targetHueZone: template.targetHueZone,
            intendedUse: 'uploaded food photograph using a selected spectral template',
            intendedUseCN: '光谱模板：' + template.nameCN + '。上传照片仅用于外观对比。',
            appearanceSource: { type: 'photo', dataUrl: uploadImageDataUrl, baseFilter: 'none' },
            spectralSource: template.spectralSource,
            dataQualification: template.dataQualification,
            sourceType: 'user-photo-template',
            sourceName: template.sourceName,
            sourceUrl: '',
            sourceSample: template.id,
            reflectance: template.reflectance.slice(),
            anchors: template.anchors.map(function (pair) { return pair.slice(); }),
            isUserFood: true,
            templateId: template.id,
            templateNameCN: template.nameCN,
            representativeDishesCN: template.representativeDishesCN
        };
        uploadedFoods.push(food);
        selectedId = food.id;
        latestResults = latestSpd ? calculateBatch(latestSpd, metricCct(latestMetrics)) : [];
        closeUploadDialog();
        if (lastOptimization) invalidateOptimizationResult('参与优化的食材已改变，请重新运行。');
        else {
            renderSelector();
            renderDetail();
            summarizeProfile();
        }
    }

    function bindUpload() {
        if (byId('dining-food-upload-open')) byId('dining-food-upload-open').addEventListener('click', openUploadDialog);
        ['dining-food-upload-cancel', 'dining-food-upload-secondary'].forEach(function (id) {
            if (byId(id)) byId(id).addEventListener('click', closeUploadDialog);
        });
        if (byId('dining-food-upload-name')) byId('dining-food-upload-name').addEventListener('input', updateUploadSubmit);
        if (byId('dining-food-upload-template')) byId('dining-food-upload-template').addEventListener('change', updateUploadSubmit);
        if (byId('dining-food-photo-input')) byId('dining-food-photo-input').addEventListener('change', function (event) {
            showUploadError('');
            uploadImageDataUrl = '';
            updateUploadSubmit();
            loadFoodImage(event.target.files && event.target.files[0]).then(function (dataUrl) {
                uploadImageDataUrl = dataUrl;
                var preview = byId('dining-food-photo-preview');
                if (preview) {
                    preview.hidden = false;
                    preview.style.backgroundImage = "url('" + dataUrl + "')";
                }
                updateUploadSubmit();
            }).catch(function (error) {
                showUploadError(error.message || '图片处理失败。');
                updateUploadSubmit();
            });
        });
        if (byId('dining-food-upload-submit')) byId('dining-food-upload-submit').addEventListener('click', addUploadedFood);
        if (byId('dining-food-upload-overlay')) byId('dining-food-upload-overlay').addEventListener('click', function (event) {
            if (event.target === event.currentTarget) closeUploadDialog();
        });
    }

    function bind() {
        function conditionsChanged(message) {
            updateProfileCopy();
            renderSelector();
            renderDetail();
            if (lastOptimization) invalidateOptimizationResult(message);
            else summarizeProfile();
        }
        if (byId('dining-cuisine-profile')) byId('dining-cuisine-profile').addEventListener('change', function () {
            conditionsChanged('菜系或餐饮类型已改变，请重新运行优化。');
        });
        if (byId('dining-target-mode')) byId('dining-target-mode').addEventListener('change', function () {
            conditionsChanged('色点模式已改变，请重新运行优化。');
        });
        if (byId('dining-optimization-goal')) byId('dining-optimization-goal').addEventListener('change', function () {
            if (byId('dining-preference-level')) byId('dining-preference-level').disabled = selectedGoal() === 'fidelity';
            conditionsChanged('优化策略已改变，请重新运行优化。');
        });
        if (byId('dining-preference-level')) byId('dining-preference-level').addEventListener('change', function () {
            conditionsChanged('增强程度已改变，请重新运行优化。');
        });
        if (byId('dining-light-apply')) byId('dining-light-apply').addEventListener('click', applyOptimization);
        bindUpload();

        document.addEventListener('spectral-material-optimization-result', function (event) {
            var detail = event.detail || {};
            if (!detail.cuisineProfileId) return;
            if (detail.error) {
                setBusy(false, detail.cuisineProfileName + ' · ' + detail.error, 'error');
                return;
            }
            var after = detail.after || null;
            var applied = detail.applied === true;
            var outputChange = Number(detail.relativeOutputChangePercent);
            var outputWarning = applied && Number.isFinite(outputChange) && Math.abs(outputChange) > 5;
            var outputMessage = outputWarning
                ? '相对照度 Y ' + signed(outputChange, 1) + '%，受当前通道输出上限影响。'
                : '';
            var resultTitle = detail.cuisineProfileName || '餐饮光色';
            var statusMessage = detail.message || (applied
                ? resultTitle + ' · 配方已应用。'
                : resultTitle + ' · 没有应用新配方。');
            if (outputMessage) statusMessage += ' ' + outputMessage;
            setBusy(false, statusMessage, outputWarning ? 'warning' : applied ? 'success' : 'warning');
            lastOptimization = Object.assign({}, detail, {
                improved: Boolean(detail.improved),
                applied: applied,
                recommendedTargetApplied: detail.recommendedTargetApplied === true
            });
            var summaryParts = [
                detail.cuisineProfileName || '',
                '参考 ' + Math.round(detail.referenceCct || 0) + ' K',
                detail.materialCount + '类菜式'
            ].filter(Boolean);
            if (detail.recommendedTargetApplied) summaryParts.push('菜系推荐色点已应用');
            if (Number.isFinite(outputChange) && (detail.recommendedTargetApplied || Math.abs(outputChange) >= 0.05)) {
                summaryParts.push('相对照度 Y ' + signed(outputChange, 1) + '%');
            }
            if (after && Number.isFinite(after.weightedMeanPreferenceError)) {
                summaryParts.push('菜系加权得分 ' + after.weightedMeanPreferenceError.toFixed(2));
                summaryParts.push('最差 ' + materialDisplayName(after.worstMaterialId, '—'));
            }
            if (!applied) summaryParts.push(detail.message || '没有应用新配方');
            if (root.OptimizationComparison && detail.beforeSnapshot && detail.afterSnapshot) {
                root.OptimizationComparison.render('dining', detail, {
                    summary: summaryParts.join(' · '),
                    labels: { before: '优化前', after: '优化后' }
                });
            }
            if (applied && detail.afterSnapshot && detail.afterSnapshot.spd) {
                latestSpd = Array.from(detail.afterSnapshot.spd);
                latestMetrics = detail.afterSnapshot.metrics || latestMetrics;
                latestResults = calculateBatch(latestSpd, detail.referenceCct);
            }
            renderSelector();
            renderDetail();
            summarizeProfile();
        });
    }

    function update(spd, metrics) {
        latestSpd = spd && typeof spd.length === 'number' ? Array.from(spd) : [];
        latestMetrics = metrics || null;
        var cct = metricCct(latestMetrics);
        latestResults = cct > 0 ? calculateBatch(latestSpd, cct) : [];
        lastOptimization = null;
        updateProfileCopy();
        renderSelector();
        renderDetail();
        summarizeProfile();
    }

    function init() {
        if (!DINING || !COLOR || !byId('dining-panel')) return;
        populateCuisineProfiles();
        populateUploadTemplates();
        updateProfileCopy();
        renderSelector();
        renderDetail();
        bind();
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();

    root.DiningPanel = Object.freeze({ update: update });
})(typeof window !== 'undefined' ? window : globalThis);
