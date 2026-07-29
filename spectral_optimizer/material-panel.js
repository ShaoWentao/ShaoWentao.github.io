(function (root) {
    'use strict';

    var DATA = root.MATERIAL_REFLECTANCE_DATA;
    var COLOR = root.MaterialColor;
    var UPLOAD = root.MaterialUpload;
    var selectedId = 'wood_warm_oak';
    var selectedCategory = 'wood';
    var latestResults = [];
    var latestContext = null;
    var pendingFrame = 0;
    var pendingPayload = null;
    var lastKey = '';

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
        user: '我的材质'
    };

    // Only these seven visuals belong to the curated atlas. Other built-in
    // materials remain colour-only until a traceable appearance image exists.
    var texturePositions = {
        wood_warm_oak: 0,
        wood_dark_walnut: 1,
        leather_cognac: 2,
        fabric_warm_beige: 3,
        leaf_green: 4,
        neutral_wall_matte: 6
    };

    function hasTexture(material) {
        if (material.isUserMaterial && material.appearanceSource && material.appearanceSource.type === 'photo') return true;
        return material.id in texturePositions;
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

    /* ---- Curated texture atlas (7 fixed slots) ---- */

    var atlasCount = 7;

    function appearanceStyle(material, lab) {
        var color = lab ? labToRgb(lab) : 'rgb(220 220 220)';

        // User-uploaded photo
        if (material.isUserMaterial && material.appearanceSource && material.appearanceSource.type === 'photo' && material.appearanceSource.dataUrl) {
            return '--appearance-color:' + color + ";--texture-url:url('" + material.appearanceSource.dataUrl + "');--texture-x:0%;--texture-size:cover;";
        }

        // Atlas texture
        var idx = texturePositions[material.id];
        if (idx !== undefined) {
            var step = ((idx / (atlasCount - 1)) * 100).toFixed(4);
            return '--appearance-color:' + color + ";--texture-url:url('assets/material-texture-atlas.png');--texture-x:" + step + '%;--texture-size:' + (atlasCount * 100) + '% 100%;';
        }

        // Fallback — color only
        return '--appearance-color:' + color + ';--texture-url:none;--texture-x:0%;--texture-size:cover;';
    }

    function updateAppearance(elId, material, lab) {
        var el = element(elId);
        if (!el) return;
        el.style.cssText = appearanceStyle(material, lab);
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

    function renderSelector() {
        var selector = element('material-selector');
        if (!selector || !DATA) return;
        selector.innerHTML = '';

        var allMaterials = getCombinedList();

        var filtered = selectedCategory === 'all'
            ? allMaterials
            : allMaterials.filter(function (m) {
                if (selectedCategory === 'user') return !!m.isUserMaterial;
                return m.category === selectedCategory;
            });

        // Fallback: if selected material not in filtered set, pick first
        if (filtered.length > 0 && !filtered.some(function (m) { return m.id === selectedId; })) {
            selectedId = filtered[0].id;
            renderDetail();
        }

        if (filtered.length === 0) {
            // Show empty state for user category
            if (selectedCategory === 'user') {
                selector.innerHTML = '<div style="grid-column:1/-1;padding:24px;text-align:center;color:var(--text-secondary);font-size:12px">暂无自定义材质，点击下方按钮导入</div>';
            }
            // Still show import button for user tab even when empty
            if (selectedCategory === 'user') {
                renderImportButton(selector);
            }
            return;
        }

        filtered.forEach(function (material) {
            var result = latestResults.find(function (item) { return item.materialId === material.id; });
            var button = document.createElement('button');
            button.type = 'button';
            button.dataset.materialId = material.id;
            button.classList.toggle('is-selected', material.id === selectedId);
            button.setAttribute('aria-pressed', material.id === selectedId ? 'true' : 'false');

            // Visual distinction for engineering materials
            var qClass = spectralQualityClass(material);
            if (qClass === 'engineering') button.classList.add('is-engineering');

            var qLabel = spectralQualityLabel(material);
            var thumbStyle = appearanceStyle(material, result ? result.candidate.lab : null);

            var thumbHtml = '<span class="material-thumb" style="' + thumbStyle + '" aria-hidden="true"></span>';

            button.innerHTML = thumbHtml +
                '<span class="material-selector-copy">' +
                    '<strong>' + escHtml(material.nameCN) + ' <span class="selector-quality-tag selector-quality-tag--' + qClass + '">' + qLabel + '</span></strong>' +
                    '<small>' + (result ? deltaDescription(result.deltaE00) + ' · ΔE00 ' + result.deltaE00.toFixed(2) : '等待计算') + '</small>' +
                '</span>';

            // Delete button for user materials
            if (material.isUserMaterial) {
                var delBtn = document.createElement('button');
                delBtn.type = 'button';
                delBtn.className = 'material-delete-btn';
                delBtn.title = '删除此材质';
                delBtn.textContent = '×';
                delBtn.addEventListener('click', function (e) {
                    e.stopPropagation();
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

        // Import button in user tab
        if (selectedCategory === 'user') {
            renderImportButton(selector);
        }
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
        var material = DATA && DATA.getMaterial(selectedId);
        // Check user materials too
        if (!material && UPLOAD) {
            var userMats = UPLOAD.loadUserMaterials();
            material = userMats.find(function (m) { return m.id === selectedId; }) || null;
        }
        var result = latestResults.find(function (item) { return item.materialId === selectedId; });
        if (!material) return;

        element('material-detail-title').textContent = material.nameCN;
        element('material-detail-description').textContent = material.intendedUseCN || material.intendedUse;
        element('material-detail-category').textContent = categoryLabels[material.category] || material.category;

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
        if (result) {
            updateAppearance('material-reference-appearance', material, result.reference.lab);
            updateAppearance('material-current-appearance', material, result.candidate.lab);
        } else {
            updateAppearance('material-reference-appearance', material);
            updateAppearance('material-current-appearance', material);
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
        var picks = [0, 40, 80, 120, 160, 200, 240, 280, 320, 360, 400];
        return Math.round(cct) + ':' + picks.map(function (i) { return (Number(values[i]) || 0).toFixed(5); }).join(':');
    }

    function calculate(payload) {
        pendingFrame = 0;
        if (!payload || !COLOR || !DATA) return;
        var cct = Number(payload.metrics && payload.metrics.quality ? payload.metrics.quality.cct : (payload.metrics ? payload.metrics.cct : 0));
        var key = spectrumKey(payload.spd, cct);
        if (key === lastKey) return;
        lastKey = key;

        if (!(cct > 0)) {
            latestResults = [];
            latestContext = null;
        } else {
            try {
                // Calculate for built-in materials only (material-color.js uses DATA.listMaterials())
                latestResults = COLOR.calculateAllMaterials(payload.spd, { cct: cct, referenceMode: 'auto' });
                latestContext = { cct: cct, reference: cct >= 5000 ? 'CIE D 系列日光参考' : '黑体参考' };

                // Also calculate for user materials
                if (UPLOAD && typeof UPLOAD.loadUserMaterials === 'function') {
                    var userMats = UPLOAD.loadUserMaterials();
                    userMats.forEach(function (um) {
                        if (Array.isArray(um.reflectance) && um.reflectance.length === 81) {
                            try {
                                var delta = COLOR.calculateMaterialDelta(payload.spd, {
                                    material: um,
                                    cct: cct,
                                    referenceMode: 'auto'
                                });
                                latestResults.push(delta);
                            } catch (e) { /* skip malformed user material */ }
                        }
                    });
                }
            } catch (error) {
                latestResults = [];
                latestContext = null;
                console.warn('Material appearance calculation unavailable:', error);
            }
        }

        var refEl = element('material-reference');
        refEl.textContent = latestContext
            ? latestContext.reference + ' · ' + Math.round(latestContext.cct).toLocaleString() + ' K'
            : '等待有效光谱';
        renderSelector();
        renderDetail();
    }

    function update(spd, metrics) {
        pendingPayload = { spd: Array.from(spd || []), metrics: metrics };
        if (pendingFrame) return;
        pendingFrame = requestAnimationFrame(function () { calculate(pendingPayload); });

        // Persist current SPD
        try {
            var cct = Number(metrics && metrics.quality ? metrics.quality.cct : (metrics ? metrics.cct : 0)) || 0;
            if (cct > 0 && spd && spd.length > 0) {
                localStorage.setItem('spectral_optimizer_spd', JSON.stringify({
                    spd: Array.from(spd),
                    cct: Math.round(cct),
                    timestamp: Date.now()
                }));
            }
        } catch (e) { /* localStorage unavailable */ }
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
            // Switch to user tab to show the newly added material
            switchToCategory('user');
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
            return;
        }
        bindCategoryTabs();
        bindUploadDialog();
        renderSelector();
        renderDetail();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }

    root.MaterialPanel = Object.freeze({ update: update });
})(typeof globalThis !== 'undefined' ? globalThis : window);
