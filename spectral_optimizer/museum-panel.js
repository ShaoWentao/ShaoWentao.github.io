(function (root) {
    'use strict';

    var DATA = root.MuseumLightData;
    var DAMAGE = root.MuseumDamageModel;
    var OPTIMIZER = root.MuseumOptimizer;
    var PREVIEW = root.MaterialPreviewColor;
    var defaultExhibit = DATA && typeof DATA.getDefaultExhibit === 'function' ? DATA.getDefaultExhibit() : DATA && DATA.exhibit;
    var selectedExhibitId = defaultExhibit ? defaultExhibit.id : '';
    var selectedSampleId = defaultExhibit ? defaultExhibit.defaultSampleId : '';
    var latestSpd = [];
    var latestMetrics = null;
    var currentEvaluation = null;
    var lastOptimization = null;
    var previewToken = 0;
    var cutoutPromises = {};
    var regionMaskPromises = {};

    function byId(id) { return document.getElementById(id); }
    function clamp(value, min, max) { return Math.max(min, Math.min(max, Number(value) || 0)); }
    function escapeHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    }
    function signed(value, digits) {
        var number = Number(value);
        if (!Number.isFinite(number)) return '—';
        return (number >= 0 ? '+' : '') + number.toFixed(digits == null ? 2 : digits);
    }
    function numberInput(id, fallback) {
        var element = byId(id);
        var value = Number(element && element.value);
        return Number.isFinite(value) ? value : fallback;
    }
    function metricCct(metrics) {
        return Number(metrics && metrics.quality ? metrics.quality.cct : metrics && metrics.cct) || 0;
    }
    function metricDuv(metrics) {
        var value = metrics && metrics.quality ? metrics.quality.duv : metrics && metrics.duv;
        return Number.isFinite(Number(value)) ? Number(value) : 0;
    }
    function metricQuality(metrics) {
        var source = metrics && metrics.quality ? metrics.quality : metrics || {};
        return {
            ra: Number(source.ra) || 0,
            r9: Number(source.r9) || 0,
            rf: Number(source.rf) || 0,
            rg: Number(source.rg) || 0
        };
    }
    function currentExhibit() {
        return DATA && DATA.getExhibit ? DATA.getExhibit(selectedExhibitId) : null;
    }
    function currentSamples() {
        return DATA && typeof DATA.getExhibitSamples === 'function'
            ? DATA.getExhibitSamples(selectedExhibitId) : [];
    }
    function selectedModeId() {
        return byId('museum-mode') ? byId('museum-mode').value : 'low-light-recognition';
    }
    function selectedModeSettings() {
        var mode = selectedModeId();
        var strength = byId('museum-strength') ? byId('museum-strength').value : 'recommended';
        return DATA.resolveModeSettings(mode, strength, selectedExhibitId);
    }

    function renderExhibitSelector() {
        var selector = byId('museum-exhibit');
        if (!selector || !DATA || typeof DATA.listExhibits !== 'function') return;
        selector.innerHTML = DATA.listExhibits().map(function (exhibit) {
            return '<option value="' + escapeHtml(exhibit.id) + '">' + escapeHtml(exhibit.nameCN) + '</option>';
        }).join('');
        selector.value = selectedExhibitId;
    }

    function renderExhibitSummary() {
        var exhibit = currentExhibit();
        if (!exhibit) return;
        var samples = currentSamples();
        if (byId('museum-panel-title')) byId('museum-panel-title').textContent = exhibit.nameCN + '展示效果对比';
        var showcase = document.querySelector('#museum-panel .museum-showcase');
        if (showcase) showcase.setAttribute('aria-label', exhibit.nameCN + '展示对比');
        if (byId('museum-reflectance-canvas')) {
            byId('museum-reflectance-canvas').setAttribute('aria-label', exhibit.nameCN + '色样工程反射率曲线');
        }
        if (byId('museum-exhibit-name')) byId('museum-exhibit-name').textContent = exhibit.nameCN;
        if (byId('museum-exhibit-description')) byId('museum-exhibit-description').textContent = exhibit.descriptionCN;
        if (byId('museum-exhibit-sample-count')) {
            byId('museum-exhibit-sample-count').textContent = samples.length + '个色样用于算法计算，可按需查看。';
        }
        if (byId('museum-sample-selector')) {
            byId('museum-sample-selector').setAttribute('aria-label', exhibit.nameCN + '工程色样');
        }
        if (byId('museum-preview-note') && exhibit.previewNoteCN) {
            byId('museum-preview-note').textContent = exhibit.previewNoteCN;
        }
    }

    function renderFindingCards() {
        var target = byId('museum-visual-findings');
        var exhibit = currentExhibit();
        if (!target || !exhibit) return;
        target.innerHTML = (exhibit.findings || []).map(function (finding) {
            return '<article data-museum-finding="' + escapeHtml(finding.id) + '"><span>' +
                escapeHtml(finding.labelCN) + '</span><strong>等待优化</strong></article>';
        }).join('');
    }

    function renderMetricCards() {
        var target = byId('museum-result-metrics');
        var exhibit = currentExhibit();
        if (!target || !exhibit) return;
        var baseMetrics = [
            ['cct', 'CCT'], ['duv', 'Duv'], ['ra', 'Ra'], ['r9', 'R9'], ['rf', 'Rf'], ['rg', 'Rg'],
            ['meanDeltaE00', '平均 ΔE00'], ['maxDeltaE00', '最大 ΔE00']
        ];
        var groups = exhibit.evaluationProfile && exhibit.evaluationProfile.distinctionGroups || {};
        var distinctionMetrics = Object.keys(groups).map(function (key) {
            return [key, groups[key].labelCN || key];
        });
        target.innerHTML = baseMetrics.concat(distinctionMetrics).map(function (metric) {
            return '<div data-museum-metric="' + escapeHtml(metric[0]) + '"><small>' +
                escapeHtml(metric[1]) + '</small><strong>--</strong></div>';
        }).join('');
    }

    function renderSampleSelector() {
        var selector = byId('museum-sample-selector');
        if (!selector || !DATA) return;
        selector.innerHTML = '';
        currentSamples().forEach(function (sample) {
            var button = document.createElement('button');
            button.type = 'button';
            button.dataset.museumSampleId = sample.id;
            button.setAttribute('aria-pressed', sample.id === selectedSampleId ? 'true' : 'false');
            button.innerHTML = '<strong>' + escapeHtml(sample.nameCN) + '</strong>' +
                '<small>权重 ' + sample.weight.toFixed(2) + '</small>';
            button.addEventListener('click', function () {
                selectedSampleId = sample.id;
                renderSampleSelector();
                renderSampleDetail();
            });
            selector.appendChild(button);
        });
    }

    function renderSampleDetail() {
        var sample = DATA && DATA.getSample(selectedSampleId);
        if (!sample) return;
        if (byId('museum-sample-name')) byId('museum-sample-name').textContent = sample.nameCN;
        if (byId('museum-sample-description')) byId('museum-sample-description').textContent = sample.colourRoleCN;
        if (byId('museum-sample-role')) byId('museum-sample-role').textContent = '颜色作用 · ' + sample.targetHueZone;
        if (byId('museum-sample-limits')) {
            byId('museum-sample-limits').innerHTML = [
                '允许 ΔE00 ≤ ' + sample.allowedDeltaE00.toFixed(1),
                '允许 |Δh| ≤ ' + sample.allowedDeltaH.toFixed(1) + '°',
                '目标 ΔC ' + signed(sample.targetDeltaC, 1)
            ].map(function (text) { return '<span>' + text + '</span>'; }).join('');
        }
        drawReflectance(sample);
    }

    function drawReflectance(sample) {
        var canvas = byId('museum-reflectance-canvas');
        if (!canvas || !sample) return;
        var ctx = canvas.getContext('2d');
        var width = canvas.width;
        var height = canvas.height;
        ctx.clearRect(0, 0, width, height);
        ctx.strokeStyle = '#cdd3da';
        ctx.lineWidth = 1;
        for (var grid = 0; grid <= 4; grid++) {
            var y = 12 + grid * (height - 38) / 4;
            ctx.beginPath(); ctx.moveTo(42, y); ctx.lineTo(width - 14, y); ctx.stroke();
        }
        ctx.strokeStyle = '#315c91';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        sample.reflectance.forEach(function (value, index) {
            var x = 42 + index / (sample.reflectance.length - 1) * (width - 58);
            var y = 12 + (1 - value) * (height - 38);
            if (index === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        });
        ctx.stroke();
        ctx.fillStyle = '#68717c';
        ctx.font = '12px sans-serif';
        ctx.fillText('380 nm', 42, height - 8);
        ctx.fillText('780 nm', width - 62, height - 8);
    }

    function calculateExposure() {
        if (!DAMAGE) return null;
        try {
            return DAMAGE.calculateExposure({
                currentIlluminance: numberInput('museum-current-illuminance', 50),
                targetIlluminance: numberInput('museum-target-illuminance', 50),
                dailyHours: numberInput('museum-daily-hours', 8),
                annualDays: numberInput('museum-annual-days', 300)
            });
        } catch (error) {
            return null;
        }
    }

    function formatInteger(value) {
        return Number(value || 0).toLocaleString('zh-CN', { maximumFractionDigits: 0 });
    }

    function renderExposure() {
        var exposure = calculateExposure();
        if (!exposure) return;
        if (byId('museum-current-daily-exposure')) byId('museum-current-daily-exposure').textContent = formatInteger(exposure.current.dailyLxHours);
        if (byId('museum-current-annual-exposure')) byId('museum-current-annual-exposure').textContent = formatInteger(exposure.current.annualLxHours);
        if (byId('museum-target-daily-exposure')) byId('museum-target-daily-exposure').textContent = formatInteger(exposure.target.dailyLxHours);
        if (byId('museum-target-annual-exposure')) byId('museum-target-annual-exposure').textContent = formatInteger(exposure.target.annualLxHours);
        if (byId('museum-exposure-summary')) {
            byId('museum-exposure-summary').textContent = formatInteger(exposure.target.annualLxHours) + ' lx·h/年';
        }
        if (byId('museum-exposure-note')) {
            byId('museum-exposure-note').textContent = exposure.disclaimerCN + ' 目标相对当前 ' + signed(exposure.changePercent, 1) + '%。';
        }
    }

    function renderModeCopy() {
        var settings = selectedModeSettings();
        if (byId('museum-mode-title')) byId('museum-mode-title').textContent = settings.nameCN;
        if (byId('museum-mode-description')) {
            byId('museum-mode-description').textContent = settings.descriptionCN;
        }
    }

    function loadCutout(exhibit) {
        var source = exhibit && exhibit.appearanceSource ? exhibit.appearanceSource.file : '';
        if (!source) return Promise.resolve(null);
        if (cutoutPromises[source]) return cutoutPromises[source];
        cutoutPromises[source] = new Promise(function (resolve) {
            var image = new Image();
            if (/^https?:\/\//i.test(source)) image.crossOrigin = 'anonymous';
            image.onload = function () { resolve(image); };
            image.onerror = function () { resolve(null); };
            image.src = source;
        });
        return cutoutPromises[source];
    }

    function decodeRegionMask(payload, config) {
        if (!payload || !config || payload.encoding !== 'pair-base64') return null;
        var width = Number(payload.width);
        var height = Number(payload.height);
        var palette = Array.isArray(payload.palette) ? payload.palette.slice() : [];
        if (!Number.isInteger(width) || width <= 0 || !Number.isInteger(height) || height <= 0 || !palette.length) return null;
        try {
            var encoded = Array.isArray(payload.rleChunks) ? payload.rleChunks.join('') : String(payload.rle || '');
            var binary = atob(encoded);
            var values = new Uint8Array(width * height);
            var cursor = 0;
            for (var index = 0; index + 1 < binary.length; index += 2) {
                var count = binary.charCodeAt(index);
                var code = binary.charCodeAt(index + 1);
                if (code >= palette.length || cursor + count > values.length) return null;
                values.fill(code, cursor, cursor + count);
                cursor += count;
            }
            if (cursor !== values.length) return null;
            var classified = 0;
            var counts = {};
            palette.forEach(function (sampleId) {
                if (sampleId) counts[sampleId] = 0;
            });
            for (var pixel = 0; pixel < values.length; pixel++) {
                var value = values[pixel];
                if (value > 0) classified++;
                var sampleId = palette[value] || '';
                if (sampleId) counts[sampleId] = (counts[sampleId] || 0) + 1;
            }
            return {
                mode: config.type || payload.type || 'rle-json',
                status: 'ready',
                width: width,
                height: height,
                palette: palette,
                values: values,
                counts: counts,
                coverage: Number.isFinite(Number(payload.coverage)) ? Number(payload.coverage) : classified / values.length,
                unclassified: Number.isFinite(Number(payload.unclassified)) ? Number(payload.unclassified) : (values.length - classified) / values.length
            };
        } catch (error) {
            return null;
        }
    }

    function loadRegionMask(exhibit) {
        var config = exhibit && exhibit.previewProfile ? exhibit.previewProfile.regionMask : null;
        if (!config || !config.file) return Promise.resolve(null);
        if (regionMaskPromises[config.file]) return regionMaskPromises[config.file];
        regionMaskPromises[config.file] = fetch(config.file, { cache: 'no-store' })
            .then(function (response) {
                if (!response.ok) throw new Error('Region mask request failed');
                return response.json();
            })
            .then(function (payload) { return decodeRegionMask(payload, config); })
            .catch(function () { return null; });
        return regionMaskPromises[config.file];
    }

    function createRegionResolver(mask, drawRect) {
        if (!mask || mask.status !== 'ready' || !drawRect || drawRect.width <= 0 || drawRect.height <= 0) return null;
        return function (x, y) {
            if (x < drawRect.x || y < drawRect.y || x >= drawRect.x + drawRect.width || y >= drawRect.y + drawRect.height) return null;
            var maskX = clamp(Math.floor((x - drawRect.x) / drawRect.width * mask.width), 0, mask.width - 1);
            var maskY = clamp(Math.floor((y - drawRect.y) / drawRect.height * mask.height), 0, mask.height - 1);
            var code = mask.values[maskY * mask.width + maskX];
            return mask.palette[code] || '';
        };
    }

    function sampleIdForPixel(exhibit, red, green, blue, x, y, regionResolver) {
        if (regionResolver) {
            var maskedSampleId = regionResolver(x, y);
            if (maskedSampleId !== null) return maskedSampleId;
        }
        return sampleIdForRgb(exhibit, red, green, blue);
    }

    function drawFallback(ctx, width, height, exhibit) {
        if (exhibit && exhibit.category === 'ink-painting') {
            ctx.save();
            var paperWidth = width * 0.46;
            var paperHeight = height * 0.92;
            var left = (width - paperWidth) / 2;
            var top = (height - paperHeight) / 2;
            ctx.fillStyle = '#d9cbb3';
            ctx.fillRect(left, top, paperWidth, paperHeight);
            ctx.strokeStyle = 'rgba(57, 55, 51, 0.72)';
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.lineWidth = Math.max(2, width * 0.008);
            ctx.beginPath();
            ctx.moveTo(left + paperWidth * 0.22, top + paperHeight * 0.82);
            ctx.bezierCurveTo(left + paperWidth * 0.35, top + paperHeight * 0.66,
                left + paperWidth * 0.52, top + paperHeight * 0.52,
                left + paperWidth * 0.68, top + paperHeight * 0.24);
            ctx.stroke();
            ctx.lineWidth = Math.max(1.2, width * 0.004);
            [0.28, 0.39, 0.52, 0.64, 0.74].forEach(function (ratio, index) {
                ctx.beginPath();
                ctx.moveTo(left + paperWidth * (0.28 + index * 0.07), top + paperHeight * ratio);
                ctx.quadraticCurveTo(left + paperWidth * 0.50, top + paperHeight * (ratio - 0.05),
                    left + paperWidth * 0.72, top + paperHeight * (ratio - 0.12));
                ctx.stroke();
            });
            ctx.fillStyle = 'rgba(48, 47, 44, 0.64)';
            ctx.beginPath();
            ctx.ellipse(left + paperWidth * 0.56, top + paperHeight * 0.36,
                paperWidth * 0.13, paperHeight * 0.045, -0.45, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#9e3f32';
            ctx.fillRect(left + paperWidth * 0.12, top + paperHeight * 0.86, paperWidth * 0.09, paperWidth * 0.09);
            ctx.fillRect(left + paperWidth * 0.78, top + paperHeight * 0.90, paperWidth * 0.07, paperWidth * 0.07);
            ctx.restore();
            return;
        }
        if (exhibit && exhibit.category === 'bronze') {
            ctx.save();
            ctx.translate(width / 2, height * 0.54);
            var vesselWidth = width * 0.55;
            var vesselHeight = height * 0.48;
            var bronzeGradient = ctx.createLinearGradient(-vesselWidth / 2, 0, vesselWidth / 2, 0);
            bronzeGradient.addColorStop(0, '#5d5440');
            bronzeGradient.addColorStop(0.45, '#81765a');
            bronzeGradient.addColorStop(0.72, '#557c6c');
            bronzeGradient.addColorStop(1, '#3e554c');
            ctx.fillStyle = bronzeGradient;
            ctx.beginPath();
            ctx.moveTo(-vesselWidth * 0.42, -vesselHeight * 0.36);
            ctx.quadraticCurveTo(-vesselWidth * 0.54, 0, -vesselWidth * 0.40, vesselHeight * 0.34);
            ctx.quadraticCurveTo(0, vesselHeight * 0.48, vesselWidth * 0.40, vesselHeight * 0.34);
            ctx.quadraticCurveTo(vesselWidth * 0.54, 0, vesselWidth * 0.42, -vesselHeight * 0.36);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = '#2c332f';
            ctx.lineWidth = Math.max(2, width * 0.006);
            ctx.stroke();
            ctx.beginPath();
            ctx.ellipse(0, -vesselHeight * 0.36, vesselWidth * 0.42, vesselHeight * 0.10, 0, 0, Math.PI * 2);
            ctx.fillStyle = '#4b655b';
            ctx.fill();
            ctx.stroke();
            ctx.strokeStyle = 'rgba(37, 45, 41, 0.86)';
            ctx.lineWidth = Math.max(1.5, width * 0.004);
            [-0.17, 0.02, 0.20].forEach(function (ratio) {
                ctx.beginPath();
                ctx.ellipse(0, vesselHeight * ratio, vesselWidth * (0.34 - ratio * 0.06), vesselHeight * 0.055, 0, 0, Math.PI * 2);
                ctx.stroke();
            });
            for (var motif = -4; motif <= 4; motif++) {
                ctx.beginPath();
                var motifX = motif * vesselWidth * 0.085;
                ctx.moveTo(motifX - vesselWidth * 0.035, -vesselHeight * 0.05);
                ctx.lineTo(motifX, vesselHeight * 0.06);
                ctx.lineTo(motifX + vesselWidth * 0.035, -vesselHeight * 0.05);
                ctx.stroke();
            }
            ctx.fillStyle = 'rgba(99, 149, 125, 0.70)';
            ctx.beginPath();
            ctx.ellipse(-vesselWidth * 0.20, -vesselHeight * 0.10, vesselWidth * 0.11, vesselHeight * 0.07, -0.25, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.ellipse(vesselWidth * 0.19, vesselHeight * 0.13, vesselWidth * 0.13, vesselHeight * 0.08, 0.32, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
            return;
        }
        ctx.save();
        ctx.translate(width / 2, height * 0.53);
        var vase = ctx.createRadialGradient(-width * .08, -height * .12, 8, 0, 0, width * .28);
        vase.addColorStop(0, '#fffefa');
        vase.addColorStop(.65, '#e9eef0');
        vase.addColorStop(1, '#aeb8bd');
        ctx.fillStyle = vase;
        ctx.beginPath();
        ctx.moveTo(-width * .09, -height * .37);
        ctx.lineTo(width * .09, -height * .37);
        ctx.bezierCurveTo(width * .08, -height * .29, width * .17, -height * .24, width * .22, -height * .13);
        ctx.bezierCurveTo(width * .31, height * .05, width * .27, height * .25, width * .18, height * .34);
        ctx.bezierCurveTo(width * .08, height * .41, -width * .08, height * .41, -width * .18, height * .34);
        ctx.bezierCurveTo(-width * .27, height * .25, -width * .31, height * .05, -width * .22, -height * .13);
        ctx.bezierCurveTo(-width * .17, -height * .24, -width * .08, -height * .29, -width * .09, -height * .37);
        ctx.fill();
        ctx.strokeStyle = '#315b91';
        ctx.lineWidth = Math.max(3, width * .008);
        for (var band = -2; band <= 2; band++) {
            ctx.beginPath();
            ctx.ellipse(0, band * height * .09, width * (.13 + Math.abs(band) * .015), height * .035, 0, 0, Math.PI * 2);
            ctx.stroke();
        }
        ctx.lineWidth = Math.max(2, width * .005);
        for (var petal = 0; petal < 8; petal++) {
            ctx.save();
            ctx.rotate(petal * Math.PI / 4);
            ctx.beginPath();
            ctx.ellipse(width * .09, 0, width * .055, height * .025, 0, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }
        ctx.restore();
    }

    function drawSource(ctx, canvas, image, blurPx, exhibit) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (!image) {
            drawFallback(ctx, canvas.width, canvas.height, exhibit);
            return null;
        }
        var scale = Math.min(
            canvas.width * 0.88 / image.naturalWidth,
            canvas.height * 0.94 / image.naturalHeight
        );
        var width = image.naturalWidth * scale;
        var height = image.naturalHeight * scale;
        var x = (canvas.width - width) / 2;
        var y = (canvas.height - height) / 2;
        ctx.save();
        ctx.filter = Number(blurPx) > 0 ? 'blur(' + Number(blurPx).toFixed(2) + 'px)' : 'none';
        ctx.drawImage(image, x, y, width, height);
        ctx.restore();
        return { x: x, y: y, width: width, height: height };
    }

    function sampleIdForRgb(exhibit, red, green, blue) {
        var profile = exhibit && exhibit.previewProfile || {};
        var fallback = profile.fallbackSampleId || exhibit && exhibit.defaultSampleId || '';
        var max = Math.max(red, green, blue);
        var min = Math.min(red, green, blue);
        var saturation = max - min;
        var luminance = red * .2126 + green * .7152 + blue * .0722;
        if (profile.classifier === 'blue-white-ceramic') {
            if (blue > red + 22 && blue > green + 10) {
                return luminance < 105 || blue - red > 75 ? 'cobalt_deep' : 'cobalt_light';
            }
            if (luminance > 190 && saturation < 55) return 'glaze_white';
            if (luminance < 95) return 'glaze_shadow';
            if (blue > red + 8 && blue >= green) return 'blue_white_transition';
            return fallback;
        }
        if (profile.classifier === 'ink-on-paper') {
            if (red > green + 18 && red > blue + 20 && saturation > 24) return 'seal_red';
            if (luminance >= 188) return 'paper_warm';
            if (luminance >= 150 && saturation < 42) return 'paper_shadow';
            if (luminance >= 112) return 'ink_light';
            if (luminance >= 62) return 'ink_mid';
            return 'ink_deep';
        }
        if (profile.classifier === 'bronze-patina') {
            if (luminance >= 170 && saturation < 34) return '';
            if (luminance < 55) return 'relief_recess';
            if (green > red + 7 && blue > red + 3) {
                return luminance >= 115 ? 'patina_light' : 'patina_green';
            }
            if (red > blue + 10 && green > blue + 4) {
                return luminance >= 120 ? 'bronze_highlight' : 'bronze_base';
            }
            if (luminance < 88) return 'bronze_shadow';
            return fallback;
        }
        if (profile.classifier === 'qingbai-jade') {
            if (luminance < 112) return 'jade_carved_recess';
            if (luminance >= 202) return 'jade_polished_highlight';
            if (green > red + 5 && green > blue + 3) return 'jade_green_transition';
            if (luminance >= 178 && saturation <= 18) return 'jade_milky_light';
            if (luminance >= 174 && blue >= red - 1 && green >= blue) return 'jade_translucent_edge';
            return fallback;
        }
        if (profile.classifier === 'black-lacquer-gold') {
            if (luminance < 24) return 'lacquer_deep_black';
            if (saturation <= 20 && luminance >= 75) return 'lacquer_surface_detail';
            if (red >= 115 && red - green >= 62 && green - blue <= 38) return 'lacquer_vermilion';
            if (red >= 135 && green >= 82 && blue <= green * 0.68 && luminance >= 105) return 'maki_gold_bright';
            if (red >= 68 && green >= 42 && blue <= green * 0.78 && red >= green && luminance >= 52) return 'maki_gold_aged';
            return fallback;
        }
        if (profile.classifier === 'silk-embroidery') {
            if (luminance < 55) return 'textile_dark_thread';
            if (saturation <= 55 && luminance >= 175) return 'textile_stitch_highlight';
            if ((blue >= red + 14 && blue >= green - 6) ||
                (green >= red + 14 && blue >= red + 5)) return 'textile_blue_green';
            if (red >= 105 && red - green >= 34 && Math.abs(green - blue) <= 30) return 'textile_red_pink';
            if (red >= 105 && green >= 72 && red >= green && green - blue >= 24 &&
                (red - green >= 38 || green - blue >= 55)) return 'textile_golden_thread';
            return fallback;
        }
        if (profile.classifier === 'cloisonne-enamel') {
            if (red >= 115 && red - green >= 35 && red - blue >= 45) return 'cloisonne_red';
            if (blue >= red + 25 && blue >= green + 18) return 'cloisonne_cobalt_blue';
            if (green >= red + 12 && blue >= red + 8) return 'cloisonne_blue_green';
            if (luminance >= 175 && red >= green + 16 && green >= blue + 35) return 'cloisonne_gilt_wire';
            if (red >= 135 && green >= 100 && red >= green + 18 && green >= blue + 45) return 'cloisonne_yellow';
            return fallback;
        }
        if (profile.classifier === 'painted-wood-guanyin') {
            if (luminance < 55) return 'guanyin_dark_wood_recess';
            if (luminance >= 185 && saturation <= 45) return 'guanyin_quartz_highlight';
            if (green >= red + 14 && blue >= red + 10) return 'guanyin_blue_green_pigment';
            if (red >= 115 && red - green >= 55 && red - blue >= 65) return 'guanyin_warm_red';
            if (red >= 145 && green >= 100 && red >= green + 20 && red - green <= 70 &&
                green - blue >= 38 && luminance >= 115) return 'guanyin_gilt';
            return fallback;
        }
        if (profile.classifier === 'oil-still-life-roesen') {
            if (luminance < 45) return 'oil_dark_background';
            if (luminance >= 165 && saturation <= 80) return 'oil_light_petals';
            if (blue >= red + 6 && blue >= green + 7) return 'oil_blue_violet';
            if (green >= red - 5 && green >= blue + 9 && red - green <= 10) return 'oil_green_foliage';
            if (green >= 100 && green >= blue + 38 && red >= green + 5 && red - green <= 60) return 'oil_yellow_gold';
            if (green >= 48 && green >= blue + 18 && red >= green + 5 && red - green <= 28) return 'oil_yellow_gold';
            if (red >= 55 && red >= green + 20 && red >= blue + 28) return 'oil_red_orange';
            return '';
        }
        return fallback;
    }

    function classifySampleForRgb(exhibitId, red, green, blue) {
        var exhibit = DATA && DATA.getExhibit ? DATA.getExhibit(exhibitId) : null;
        return exhibit ? sampleIdForRgb(exhibit, Number(red), Number(green), Number(blue)) : '';
    }

    function removeExhibitBackground(ctx, canvas, exhibit) {
        var profile = exhibit && exhibit.previewProfile || {};
        var mode = profile.backgroundMode || 'none';
        if (mode !== 'edge-transparent') return { mode: mode, removedPixels: 0 };
        var thresholds = profile.backgroundThresholds || {};
        var maxSaturation = Number.isFinite(Number(thresholds.maxSaturation)) ? Number(thresholds.maxSaturation) : 26;
        var minLuminance = Number.isFinite(Number(thresholds.minLuminance)) ? Number(thresholds.minLuminance) : 18;
        var highLuminance = Number.isFinite(Number(thresholds.highLuminance)) ? Number(thresholds.highLuminance) : 165;
        try {
            var width = canvas.width;
            var height = canvas.height;
            var pixelCount = width * height;
            var imageData = ctx.getImageData(0, 0, width, height);
            var candidates = new Uint8Array(pixelCount);
            var visited = new Uint8Array(pixelCount);
            var queue = new Int32Array(pixelCount);
            for (var pixel = 0; pixel < pixelCount; pixel++) {
                var offset = pixel * 4;
                var alpha = imageData.data[offset + 3];
                if (alpha <= 8) {
                    candidates[pixel] = 1;
                    continue;
                }
                var red = imageData.data[offset];
                var green = imageData.data[offset + 1];
                var blue = imageData.data[offset + 2];
                var maximum = Math.max(red, green, blue);
                var minimum = Math.min(red, green, blue);
                var saturation = maximum - minimum;
                var luminance = red * 0.2126 + green * 0.7152 + blue * 0.0722;
                var sampleId = sampleIdForRgb(exhibit, red, green, blue);
                if (!sampleId ||
                    (saturation <= maxSaturation && luminance >= minLuminance) ||
                    (luminance >= highLuminance && saturation <= maxSaturation * 1.5)) {
                    candidates[pixel] = 1;
                }
            }
            var head = 0;
            var tail = 0;
            function enqueue(pixel) {
                if (pixel < 0 || pixel >= pixelCount || visited[pixel] || !candidates[pixel]) return;
                visited[pixel] = 1;
                queue[tail++] = pixel;
            }
            for (var x = 0; x < width; x++) {
                enqueue(x);
                enqueue((height - 1) * width + x);
            }
            for (var y = 0; y < height; y++) {
                enqueue(y * width);
                enqueue(y * width + width - 1);
            }
            while (head < tail) {
                var current = queue[head++];
                var currentX = current % width;
                if (currentX > 0) enqueue(current - 1);
                if (currentX < width - 1) enqueue(current + 1);
                if (current >= width) enqueue(current - width);
                if (current < pixelCount - width) enqueue(current + width);
            }
            var removedPixels = 0;
            for (var index = 0; index < pixelCount; index++) {
                if (!visited[index]) continue;
                var alphaIndex = index * 4 + 3;
                if (imageData.data[alphaIndex] > 8) removedPixels++;
                imageData.data[alphaIndex] = 0;
            }
            ctx.putImageData(imageData, 0, 0);
            return { mode: mode, removedPixels: removedPixels };
        } catch (error) {
            return { mode: mode, removedPixels: 0 };
        }
    }

    function deltaMap(evaluation, baselineEvaluation, differenceMode, gain) {
        var map = {};
        if (!evaluation) return map;
        var baseById = {};
        if (baselineEvaluation) baselineEvaluation.perSample.forEach(function (item) { baseById[item.materialId] = item; });
        evaluation.perSample.forEach(function (item) {
            var sourceLab;
            var targetLab;
            if (differenceMode && baseById[item.materialId]) {
                sourceLab = baseById[item.materialId].candidate.lab;
                targetLab = item.candidate.lab;
            } else {
                sourceLab = item.reference.lab;
                targetLab = item.candidate.lab;
            }
            map[item.materialId] = [
                (targetLab[0] - sourceLab[0]) * gain,
                (targetLab[1] - sourceLab[1]) * gain,
                (targetLab[2] - sourceLab[2]) * gain
            ];
        });
        return map;
    }

    function mergeDeltaMaps(primary, secondary) {
        var merged = {};
        Object.keys(primary || {}).concat(Object.keys(secondary || {})).forEach(function (sampleId) {
            if (merged[sampleId]) return;
            var first = primary && primary[sampleId] ? primary[sampleId] : [0, 0, 0];
            var second = secondary && secondary[sampleId] ? secondary[sampleId] : [0, 0, 0];
            merged[sampleId] = [0, 1, 2].map(function (index) {
                return (Number(first[index]) || 0) + (Number(second[index]) || 0);
            });
        });
        return merged;
    }

    function applyDeltaMapToCanvas(ctx, canvas, map, exhibit, regionResolver) {
        if (!PREVIEW || !map) return;
        try {
            var imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            for (var index = 0; index < imageData.data.length; index += 4) {
                if (imageData.data[index + 3] <= 8) continue;
                var pixel = index / 4;
                var x = pixel % canvas.width;
                var y = Math.floor(pixel / canvas.width);
                var red = imageData.data[index];
                var green = imageData.data[index + 1];
                var blue = imageData.data[index + 2];
                var sampleId = sampleIdForPixel(exhibit, red, green, blue, x, y, regionResolver);
                var delta = map[sampleId] || [0, 0, 0];
                var mapped = PREVIEW.mapRgb([red, green, blue], delta);
                imageData.data[index] = mapped[0];
                imageData.data[index + 1] = mapped[1];
                imageData.data[index + 2] = mapped[2];
            }
            ctx.putImageData(imageData, 0, 0);
        } catch (error) {
            // Cross-origin photo rendering can prevent pixel reads. The unmodified visual reference remains visible.
        }
    }

    function applyDisplayToneToCanvas(ctx, canvas, saturation, contrast) {
        var previewSaturation = clamp(Number.isFinite(Number(saturation)) ? Number(saturation) : 1, 0, 2);
        var previewContrast = clamp(Number.isFinite(Number(contrast)) ? Number(contrast) : 1, 0.5, 1.5);
        if (Math.abs(previewSaturation - 1) <= 1e-9 && Math.abs(previewContrast - 1) <= 1e-9) {
            return { saturation: previewSaturation, contrast: previewContrast };
        }
        try {
            var imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            for (var index = 0; index < imageData.data.length; index += 4) {
                if (imageData.data[index + 3] <= 8) continue;
                var red = imageData.data[index];
                var green = imageData.data[index + 1];
                var blue = imageData.data[index + 2];
                var luminance = red * 0.2126 + green * 0.7152 + blue * 0.0722;
                var saturatedRed = luminance + (red - luminance) * previewSaturation;
                var saturatedGreen = luminance + (green - luminance) * previewSaturation;
                var saturatedBlue = luminance + (blue - luminance) * previewSaturation;
                imageData.data[index] = clamp(Math.round(128 + (saturatedRed - 128) * previewContrast), 0, 255);
                imageData.data[index + 1] = clamp(Math.round(128 + (saturatedGreen - 128) * previewContrast), 0, 255);
                imageData.data[index + 2] = clamp(Math.round(128 + (saturatedBlue - 128) * previewContrast), 0, 255);
            }
            ctx.putImageData(imageData, 0, 0);
        } catch (error) {
            // Keep the source image when pixel access is unavailable.
        }
        return { saturation: previewSaturation, contrast: previewContrast };
    }

    function applyRecognitionBoostToCanvas(ctx, canvas, amount, exhibit, regionResolver) {
        var boost = clamp(amount, 0, 1);
        var profile = exhibit && exhibit.previewProfile || {};
        var recognitionIds = profile.recognitionSampleIds || [];
        var localSettings = profile.localRecognition || {};
        if (boost <= 0 || !recognitionIds.length) return 0;
        try {
            var imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            for (var index = 0; index < imageData.data.length; index += 4) {
                if (imageData.data[index + 3] <= 8) continue;
                var pixel = index / 4;
                var x = pixel % canvas.width;
                var y = Math.floor(pixel / canvas.width);
                var red = imageData.data[index];
                var green = imageData.data[index + 1];
                var blue = imageData.data[index + 2];
                var sampleId = sampleIdForPixel(exhibit, red, green, blue, x, y, regionResolver);
                if (!recognitionIds.includes(sampleId)) continue;
                var region = localSettings[sampleId] || {};
                var luminance = red * 0.2126 + green * 0.7152 + blue * 0.0722;
                var localContrast = 1 + boost * (Number(region.contrast) || 0);
                var localSaturation = 1 + boost * (Number(region.saturation) || 0);
                var lightnessOffset = boost * (Number(region.lightness) || 0);
                var adjustedLuminance = 128 + (luminance - 128) * localContrast + lightnessOffset;
                imageData.data[index] = clamp(Math.round(adjustedLuminance + (red - luminance) * localSaturation), 0, 255);
                imageData.data[index + 1] = clamp(Math.round(adjustedLuminance + (green - luminance) * localSaturation), 0, 255);
                imageData.data[index + 2] = clamp(Math.round(adjustedLuminance + (blue - luminance) * localSaturation), 0, 255);
            }
            ctx.putImageData(imageData, 0, 0);
        } catch (error) {
            // Keep the globally adjusted image when pixel access is unavailable.
        }
        return boost;
    }

    function captureLuminanceReference(ctx, canvas, exhibit, regionResolver) {
        var profile = exhibit && exhibit.previewProfile || {};
        if (profile.luminanceLock !== 'anchor') return null;
        var anchorSampleId = exhibit && exhibit.evaluationProfile
            ? exhibit.evaluationProfile.anchorSampleId : '';
        if (!anchorSampleId) return null;
        try {
            var imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            var pixelCount = canvas.width * canvas.height;
            var mask = new Uint8Array(pixelCount);
            var sum = 0;
            var count = 0;
            for (var pixel = 0; pixel < pixelCount; pixel++) {
                var offset = pixel * 4;
                if (imageData.data[offset + 3] <= 8) continue;
                var x = pixel % canvas.width;
                var y = Math.floor(pixel / canvas.width);
                var red = imageData.data[offset];
                var green = imageData.data[offset + 1];
                var blue = imageData.data[offset + 2];
                if (sampleIdForPixel(exhibit, red, green, blue, x, y, regionResolver) !== anchorSampleId) continue;
                mask[pixel] = 1;
                sum += red * 0.2126 + green * 0.7152 + blue * 0.0722;
                count++;
            }
            if (count < 32) return null;
            return {
                mode: 'anchor',
                sampleId: anchorSampleId,
                mask: mask,
                mean: sum / count,
                count: count
            };
        } catch (error) {
            return null;
        }
    }

    function maskedLuminance(imageData, mask) {
        if (!imageData || !mask) return NaN;
        var sum = 0;
        var count = 0;
        for (var pixel = 0; pixel < mask.length; pixel++) {
            if (!mask[pixel]) continue;
            var offset = pixel * 4;
            if (imageData.data[offset + 3] <= 8) continue;
            sum += imageData.data[offset] * 0.2126 +
                imageData.data[offset + 1] * 0.7152 +
                imageData.data[offset + 2] * 0.0722;
            count++;
        }
        return count ? sum / count : NaN;
    }

    function measureSubjectLuminance(ctx, canvas, exhibit) {
        try {
            var imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            var sum = 0;
            var count = 0;
            for (var index = 0; index < imageData.data.length; index += 4) {
                if (imageData.data[index + 3] <= 8) continue;
                var red = imageData.data[index];
                var green = imageData.data[index + 1];
                var blue = imageData.data[index + 2];
                if (!sampleIdForRgb(exhibit, red, green, blue)) continue;
                sum += red * 0.2126 + green * 0.7152 + blue * 0.0722;
                count++;
            }
            return count ? sum / count : NaN;
        } catch (error) {
            return NaN;
        }
    }

    function applyLuminanceLock(ctx, canvas, reference, targetOverride) {
        if (!reference || !reference.mask) {
            return { mode: 'none', sampleId: '', target: NaN, final: NaN, correction: 0 };
        }
        try {
            var imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            var target = Number.isFinite(Number(targetOverride)) ? Number(targetOverride) : reference.mean;
            var correction = 0;
            for (var pass = 0; pass < 2; pass++) {
                var current = maskedLuminance(imageData, reference.mask);
                if (!Number.isFinite(current)) break;
                var delta = target - current;
                if (Math.abs(delta) <= 0.05) break;
                correction += delta;
                for (var pixel = 0; pixel < reference.mask.length; pixel++) {
                    var offset = pixel * 4;
                    if (imageData.data[offset + 3] <= 8) continue;
                    imageData.data[offset] = clamp(Math.round(imageData.data[offset] + delta), 0, 255);
                    imageData.data[offset + 1] = clamp(Math.round(imageData.data[offset + 1] + delta), 0, 255);
                    imageData.data[offset + 2] = clamp(Math.round(imageData.data[offset + 2] + delta), 0, 255);
                }
            }
            ctx.putImageData(imageData, 0, 0);
            return {
                mode: reference.mode,
                sampleId: reference.sampleId,
                target: target,
                final: maskedLuminance(imageData, reference.mask),
                correction: correction
            };
        } catch (error) {
            return { mode: 'none', sampleId: '', target: NaN, final: NaN, correction: 0 };
        }
    }

    function drawPreviewBackground(ctx, canvas) {
        ctx.save();
        ctx.globalCompositeOperation = 'destination-over';
        ctx.fillStyle = '#17191d';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.restore();
    }

    function applyExhibitDisplayAdjustments(profile, exhibit, mode, phase) {
        var result = Object.assign({}, profile);
        var modeAdjustments = exhibit && exhibit.previewProfile && exhibit.previewProfile.displayAdjustments
            ? exhibit.previewProfile.displayAdjustments[mode] : null;
        if (!modeAdjustments) return result;
        var adjustments = phase && modeAdjustments[phase] ? modeAdjustments[phase] : modeAdjustments;
        ['saturation', 'contrast', 'blurPx', 'spectralGain', 'recognitionBoost'].forEach(function (key) {
            if (Number.isFinite(Number(adjustments[key]))) result[key] = Number(adjustments[key]);
        });
        result.saturation = clamp(result.saturation + (Number(adjustments.saturationOffset) || 0), 0.7, 1.3);
        result.contrast = clamp(result.contrast + (Number(adjustments.contrastOffset) || 0), 0.7, 1.3);
        result.spectralGain *= Number.isFinite(Number(adjustments.spectralGainScale))
            ? Number(adjustments.spectralGainScale) : 1;
        result.recognitionBoost *= Number.isFinite(Number(adjustments.recognitionBoostScale))
            ? Number(adjustments.recognitionBoostScale) : 1;
        return result;
    }

    function currentDisplayProfile(mode, exhibit) {
        var profile;
        if (mode === 'fidelity') {
            profile = { saturation: 1, contrast: 1, blurPx: 0.12, spectralGain: 0.08, recognitionBoost: 0 };
        } else if (mode === 'colour-enhancement') {
            profile = { saturation: 0.98, contrast: 0.99, blurPx: 0.25, spectralGain: 0.12, recognitionBoost: 0 };
        } else {
            profile = { saturation: 0.94, contrast: 0.96, blurPx: 0.8, spectralGain: 0.12, recognitionBoost: 0 };
        }
        return applyExhibitDisplayAdjustments(profile, exhibit, mode, 'current');
    }

    function optimizedDisplayProfile(mode, applied, exhibit) {
        if (!applied) return currentDisplayProfile(mode, exhibit);
        var strength = byId('museum-strength') ? byId('museum-strength').value : 'recommended';
        if (mode === 'fidelity') {
            if (strength === 'soft') return applyExhibitDisplayAdjustments({ saturation: 1, contrast: 1, blurPx: 0.1, spectralGain: 0.08, recognitionBoost: 0 }, exhibit, mode, 'optimized');
            if (strength === 'strong') return applyExhibitDisplayAdjustments({ saturation: 1.01, contrast: 1.02, blurPx: 0.04, spectralGain: 0.16, recognitionBoost: 0 }, exhibit, mode, 'optimized');
            return applyExhibitDisplayAdjustments({ saturation: 1, contrast: 1.01, blurPx: 0.06, spectralGain: 0.12, recognitionBoost: 0 }, exhibit, mode, 'optimized');
        }
        if (mode === 'colour-enhancement') {
            if (strength === 'soft') return applyExhibitDisplayAdjustments({ saturation: 1.05, contrast: 1.03, blurPx: 0.12, spectralGain: 0.28, recognitionBoost: 0.25 }, exhibit, mode, 'optimized');
            if (strength === 'strong') return applyExhibitDisplayAdjustments({ saturation: 1.11, contrast: 1.07, blurPx: 0.04, spectralGain: 0.5, recognitionBoost: 0.45 }, exhibit, mode, 'optimized');
            return applyExhibitDisplayAdjustments({ saturation: 1.08, contrast: 1.05, blurPx: 0.08, spectralGain: 0.38, recognitionBoost: 0.35 }, exhibit, mode, 'optimized');
        }
        if (strength === 'soft') return applyExhibitDisplayAdjustments({ saturation: 1.01, contrast: 1.04, blurPx: 0.15, spectralGain: 0.16, recognitionBoost: 0.55 }, exhibit, mode, 'optimized');
        if (strength === 'strong') return applyExhibitDisplayAdjustments({ saturation: 1.035, contrast: 1.08, blurPx: 0.04, spectralGain: 0.3, recognitionBoost: 1 }, exhibit, mode, 'optimized');
        return applyExhibitDisplayAdjustments({ saturation: 1.02, contrast: 1.06, blurPx: 0.08, spectralGain: 0.22, recognitionBoost: 0.75 }, exhibit, mode, 'optimized');
    }

    function drawPreview(canvasId, image, options, token) {
        var canvas = byId(canvasId);
        if (!canvas) return;
        var settings = options || {};
        var exhibit = settings.exhibit || currentExhibit();
        var ctx = canvas.getContext('2d', { willReadFrequently: true });
        var blurPx = clamp(Number(settings.blurPx) || 0, 0, 3);
        var drawRect = drawSource(ctx, canvas, image, blurPx, exhibit);
        var regionMask = settings.regionMask || null;
        var regionResolver = createRegionResolver(regionMask, drawRect);
        var background = removeExhibitBackground(ctx, canvas, exhibit);
        var luminanceReference = settings.preserveLuminance
            ? captureLuminanceReference(ctx, canvas, exhibit, regionResolver) : null;
        var baseMap = settings.baseEvaluation
            ? deltaMap(settings.baseEvaluation, null, false, Number(settings.baseGain) || 0.25) : {};
        var effectMap = settings.evaluation
            ? deltaMap(settings.evaluation, settings.baselineEvaluation, Boolean(settings.differenceMode), Number(settings.gain) || 0.25) : {};
        applyDeltaMapToCanvas(ctx, canvas, mergeDeltaMaps(baseMap, effectMap), exhibit, regionResolver);
        var tone = applyDisplayToneToCanvas(ctx, canvas, settings.saturation, settings.contrast);
        var recognitionBoost = applyRecognitionBoostToCanvas(ctx, canvas, settings.recognitionBoost, exhibit, regionResolver);
        var luminanceLock = settings.preserveLuminance
            ? applyLuminanceLock(ctx, canvas, luminanceReference, settings.luminanceTarget) :
            { mode: 'none', sampleId: '', target: NaN, final: NaN, correction: 0 };
        var subjectLuminance = measureSubjectLuminance(ctx, canvas, exhibit);
        var displayIlluminance = Number(settings.illuminance);
        drawPreviewBackground(ctx, canvas);
        canvas.dataset.exhibitId = exhibit ? exhibit.id : '';
        canvas.dataset.appearanceSource = exhibit && exhibit.appearanceSource ? exhibit.appearanceSource.file : '';
        canvas.dataset.backgroundMode = background.mode;
        canvas.dataset.backgroundRemovedPixels = String(background.removedPixels);
        canvas.dataset.previewSaturation = String(tone.saturation);
        canvas.dataset.previewContrast = String(tone.contrast);
        canvas.dataset.previewBlurPx = String(blurPx);
        canvas.dataset.spectralDisplayGain = String(Number(settings.gain) || 0.25);
        canvas.dataset.recognitionBoost = String(recognitionBoost);
        canvas.dataset.luminanceLockMode = luminanceLock.mode;
        canvas.dataset.luminanceLockSample = luminanceLock.sampleId;
        canvas.dataset.luminanceTarget = Number.isFinite(luminanceLock.target) ? String(luminanceLock.target) : '';
        canvas.dataset.luminanceFinal = Number.isFinite(luminanceLock.final) ? String(luminanceLock.final) : '';
        canvas.dataset.luminanceCorrection = String(luminanceLock.correction);
        canvas.dataset.subjectLuminance = Number.isFinite(subjectLuminance) ? String(subjectLuminance) : '';
        canvas.dataset.regionMaskMode = regionMask ? regionMask.mode : '';
        canvas.dataset.regionMaskStatus = regionMask ? regionMask.status :
            (exhibit && exhibit.previewProfile && exhibit.previewProfile.regionMask ? 'fallback-rgb' : 'none');
        canvas.dataset.regionMaskCoverage = regionMask && Number.isFinite(regionMask.coverage) ? String(regionMask.coverage) : '';
        canvas.dataset.regionMaskUnclassified = regionMask && Number.isFinite(regionMask.unclassified) ? String(regionMask.unclassified) : '';
        canvas.dataset.regionMaskWidth = regionMask ? String(regionMask.width) : '';
        canvas.dataset.regionMaskHeight = regionMask ? String(regionMask.height) : '';
        canvas.dataset.previewMode = settings.mode || 'low-light-recognition';
        canvas.dataset.displayIlluminance = Number.isFinite(displayIlluminance) ? String(displayIlluminance) : '';
        canvas.dataset.displayToneGain = '1';
        canvas.dataset.previewModel = 'museum-mode-specific';
        canvas.dataset.rendered = String(token);
        return {
            luminanceTarget: Number.isFinite(luminanceLock.target) ? luminanceLock.target : NaN,
            luminanceSampleId: luminanceLock.sampleId
        };
    }

    function renderPreviews() {
        var token = ++previewToken;
        var currentIlluminance = numberInput('museum-current-illuminance', 50);
        var targetIlluminance = numberInput('museum-target-illuminance', 50);
        var beforeEvaluation = lastOptimization && lastOptimization.beforeEvaluation
            ? lastOptimization.beforeEvaluation : currentEvaluation;
        var afterEvaluation = lastOptimization && lastOptimization.afterEvaluation
            ? lastOptimization.afterEvaluation : currentEvaluation;
        var mode = selectedModeId();
        var exhibit = currentExhibit();
        Promise.all([loadCutout(exhibit), loadRegionMask(exhibit)]).then(function (assets) {
            if (token !== previewToken) return;
            var image = assets[0];
            var regionMask = assets[1];
            var currentProfile = currentDisplayProfile(mode, exhibit);
            var optimizedProfile = optimizedDisplayProfile(mode, Boolean(lastOptimization && lastOptimization.applied), exhibit);
            var preserveLuminance = mode === 'low-light-recognition' &&
                exhibit && exhibit.previewProfile && exhibit.previewProfile.luminanceLock === 'anchor';
            var currentRender = drawPreview('museum-current-preview', image, {
                exhibit: exhibit,
                mode: mode,
                evaluation: beforeEvaluation,
                gain: currentProfile.spectralGain,
                saturation: currentProfile.saturation,
                contrast: currentProfile.contrast,
                blurPx: currentProfile.blurPx,
                recognitionBoost: currentProfile.recognitionBoost,
                preserveLuminance: preserveLuminance,
                regionMask: regionMask,
                illuminance: currentIlluminance
            }, token);
            drawPreview('museum-optimized-preview', image, {
                exhibit: exhibit,
                mode: mode,
                baseEvaluation: beforeEvaluation,
                baseGain: currentProfile.spectralGain,
                evaluation: afterEvaluation,
                baselineEvaluation: beforeEvaluation,
                differenceMode: true,
                gain: optimizedProfile.spectralGain,
                saturation: optimizedProfile.saturation,
                contrast: optimizedProfile.contrast,
                blurPx: optimizedProfile.blurPx,
                recognitionBoost: optimizedProfile.recognitionBoost,
                preserveLuminance: preserveLuminance,
                regionMask: regionMask,
                luminanceTarget: currentRender && currentRender.luminanceTarget,
                illuminance: targetIlluminance
            }, token);
            if (byId('museum-current-preview-caption')) {
                byId('museum-current-preview-caption').textContent = Math.round(currentIlluminance) + ' lx · ' +
                    (beforeEvaluation ? Math.round(beforeEvaluation.cct) + ' K' : '等待光谱');
            }
            if (byId('museum-optimized-preview-caption')) {
                byId('museum-optimized-preview-caption').textContent = lastOptimization
                    ? Math.round(targetIlluminance) + ' lx · ' + (afterEvaluation ? Math.round(afterEvaluation.cct) + ' K' : '优化结果')
                    : '运行优化后显示';
            }
        });
    }

    function metricValue(name, evaluation) {
        if (!evaluation) return '—';
        var quality = evaluation.quality || {};
        var map = {
            cct: Math.round(evaluation.cct) + ' K',
            duv: signed(evaluation.duv, 4),
            ra: Number(quality.ra).toFixed(0),
            r9: Number(quality.r9).toFixed(0),
            rf: Number(quality.rf).toFixed(0),
            rg: Number(quality.rg).toFixed(0),
            meanDeltaE00: evaluation.weightedMeanDeltaE00.toFixed(2),
            maxDeltaE00: evaluation.maxDeltaE00.toFixed(2)
        };
        if (Object.prototype.hasOwnProperty.call(map, name)) return map[name];
        var distinction = evaluation.distinction && evaluation.distinction[name];
        return distinction && Number.isFinite(Number(distinction.candidate))
            ? Number(distinction.candidate).toFixed(2) : '—';
    }

    function renderMetrics(evaluation) {
        document.querySelectorAll('#museum-result-metrics [data-museum-metric]').forEach(function (card) {
            var target = card.querySelector('strong');
            if (target) target.textContent = metricValue(card.dataset.museumMetric, evaluation);
        });
    }

    function distinctionFinding(beforeEvaluation, afterEvaluation, key) {
        if (!beforeEvaluation || !afterEvaluation || !beforeEvaluation.distinction || !afterEvaluation.distinction) {
            return { text: '等待优化', tone: '' };
        }
        var before = Number(beforeEvaluation.distinction[key] && beforeEvaluation.distinction[key].candidate) || 0;
        var after = Number(afterEvaluation.distinction[key] && afterEvaluation.distinction[key].candidate) || 0;
        var ratio = (after - before) / Math.max(Math.abs(before), 0.25);
        if (ratio >= 0.08) return { text: '明显提升', tone: 'strong' };
        if (ratio >= 0.025) return { text: '有所提升', tone: 'positive' };
        if (ratio > -0.025) return { text: '基本保持', tone: 'stable' };
        return { text: '有所下降', tone: 'warning' };
    }

    function renderVisualFindings(beforeEvaluation, afterEvaluation) {
        var exhibit = currentExhibit();
        if (!exhibit) return;
        (exhibit.findings || []).forEach(function (definition) {
            var finding = { text: '等待优化', tone: '' };
            if (definition.type === 'anchor-stability' && afterEvaluation) {
                var afterAnchor = afterEvaluation.anchor || afterEvaluation.white;
                var beforeAnchor = beforeEvaluation && (beforeEvaluation.anchor || beforeEvaluation.white);
                var afterDelta = Number(afterAnchor && afterAnchor.deltaE00) || 0;
                var beforeDelta = Number(beforeAnchor && beforeAnchor.deltaE00);
                if (definition.stabilityBasis === 'absolute') {
                    finding = afterDelta <= 1
                        ? { text: '基本保持', tone: 'stable' }
                        : afterDelta <= 2.5
                            ? { text: '轻微偏移', tone: 'warning' }
                            : { text: '偏移明显', tone: 'warning' };
                } else if (Number.isFinite(beforeDelta)) {
                    var deltaChange = afterDelta - beforeDelta;
                    finding = Math.abs(deltaChange) <= 0.5
                        ? { text: '基本保持', tone: 'stable' }
                        : deltaChange < -0.5
                            ? { text: '有所改善', tone: 'positive' }
                            : deltaChange <= 1
                                ? { text: '轻微偏移', tone: 'warning' }
                                : { text: '偏移明显', tone: 'warning' };
                } else {
                    finding = afterDelta <= 1
                        ? { text: '稳定', tone: 'stable' }
                        : afterDelta <= 2.5
                            ? { text: '轻微偏移', tone: 'warning' }
                            : { text: '偏移明显', tone: 'warning' };
                }
            } else if (definition.type === 'distinction') {
                finding = distinctionFinding(beforeEvaluation, afterEvaluation, definition.distinctionKey);
            }
            var card = document.querySelector('#museum-visual-findings [data-museum-finding="' + definition.id + '"]');
            if (!card) return;
            var target = card.querySelector('strong');
            if (target) target.textContent = finding.text;
            card.dataset.tone = finding.tone;
        });
    }

    function renderSampleResults(evaluation) {
        var target = byId('museum-sample-results');
        if (!target || !DATA) return;
        var byResult = {};
        if (evaluation) evaluation.perSample.forEach(function (result) { byResult[result.materialId] = result; });
        target.innerHTML = currentSamples().map(function (sample) {
            var result = byResult[sample.id];
            return '<article class="museum-sample-result"><header><strong>' + escapeHtml(sample.nameCN) + '</strong><small>权重 ' + sample.weight.toFixed(2) + '</small></header>' +
                '<div><span>ΔE00</span><strong>' + (result ? result.deltaE00.toFixed(2) : '—') + '</strong></div>' +
                '<div><span>ΔC</span><strong>' + (result ? signed(result.deltaC, 2) : '—') + '</strong></div>' +
                '<div><span>Δh</span><strong>' + (result ? signed(result.deltaH, 2) + '°' : '—') + '</strong></div></article>';
        }).join('');
    }

    function drawSpdComparison(beforeSpd, afterSpd) {
        var canvas = byId('museum-optimization-spd');
        if (!canvas) return;
        var ctx = canvas.getContext('2d');
        var before = Array.from(beforeSpd || []);
        var after = Array.from(afterSpd || []);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = '#d0d5da';
        ctx.beginPath(); ctx.moveTo(42, 12); ctx.lineTo(42, canvas.height - 28); ctx.lineTo(canvas.width - 14, canvas.height - 28); ctx.stroke();
        var maximum = Math.max.apply(Math, before.concat(after).concat([1]));
        function line(values, color) {
            if (!values.length) return;
            ctx.strokeStyle = color;
            ctx.lineWidth = 2;
            ctx.beginPath();
            values.forEach(function (value, index) {
                var x = 42 + index / Math.max(1, values.length - 1) * (canvas.width - 58);
                var y = 12 + (1 - value / maximum) * (canvas.height - 40);
                if (index === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
            });
            ctx.stroke();
        }
        line(before, '#8c9299');
        line(after, '#315c91');
    }

    function renderChannels(beforeChannels, afterChannels) {
        var target = byId('museum-optimization-channels');
        if (!target) return;
        var beforeMap = Object.fromEntries((beforeChannels || []).map(function (item) { return [item.id, item]; }));
        target.innerHTML = (afterChannels || beforeChannels || []).map(function (item) {
            var before = beforeMap[item.id] ? Number(beforeMap[item.id].value) : Number(item.value);
            var after = Number(item.value);
            return '<div class="museum-channel-row"><span>' + escapeHtml(item.name || item.id) + '</span>' +
                '<span class="museum-channel-track"><i style="--museum-channel-value:' + clamp(after, 0, 100) + '%"></i></span>' +
                '<strong>' + before.toFixed(1) + '% → ' + after.toFixed(1) + '%</strong></div>';
        }).join('');
    }

    function updateCurrentEvaluation() {
        var cct = metricCct(latestMetrics);
        if (!latestSpd.length || !(cct > 0) || !OPTIMIZER) {
            currentEvaluation = null;
            renderMetrics(null);
            renderSampleResults(null);
            renderVisualFindings(null, null);
            renderPreviews();
            return;
        }
        try {
            currentEvaluation = OPTIMIZER.evaluateExhibit(latestSpd, {
                cct: cct,
                duv: metricDuv(latestMetrics),
                quality: metricQuality(latestMetrics),
                exhibitId: selectedExhibitId
            });
        } catch (error) {
            currentEvaluation = null;
        }
        if (!lastOptimization) {
            renderMetrics(currentEvaluation);
            renderSampleResults(currentEvaluation);
            renderVisualFindings(null, null);
        }
        if (byId('museum-reference')) {
            byId('museum-reference').textContent = currentEvaluation
                ? Math.round(currentEvaluation.cct) + ' K · Duv ' + signed(currentEvaluation.duv, 4)
                : '等待有效光谱';
        }
        if (byId('museum-current-cct') && cct > 0) byId('museum-current-cct').value = String(Math.round(cct));
        if (byId('museum-current-preview-caption')) byId('museum-current-preview-caption').textContent = currentEvaluation
            ? Math.round(currentEvaluation.cct) + ' K · 当前配方' : '等待光谱';
        renderPreviews();
    }

    function setBusy(busy, message, tone) {
        var button = byId('museum-optimize-button');
        if (button) {
            button.disabled = busy;
            button.textContent = busy ? '正在优化…' : '开始展品优化';
        }
        var status = byId('museum-optimization-status');
        if (status) {
            status.textContent = message || '';
            status.dataset.tone = tone || '';
        }
    }

    function invalidateResult(message) {
        if (!lastOptimization) return;
        lastOptimization = null;
        if (byId('museum-result-conclusion')) byId('museum-result-conclusion').textContent = '条件已改变';
        if (byId('museum-result-summary')) byId('museum-result-summary').textContent = '请重新运行展品优化';
        renderMetrics(currentEvaluation);
        renderSampleResults(currentEvaluation);
        renderVisualFindings(null, null);
        renderPreviews();
        setBusy(false, message || '条件已改变，请重新运行。', 'warning');
    }

    function requestOptimization() {
        if (!root.dispatchEvent || !DATA) return;
        var duvMin = numberInput('museum-duv-min', -0.001);
        var duvMax = numberInput('museum-duv-max', 0.001);
        if (duvMin > duvMax) {
            setBusy(false, 'Duv 下限不能高于上限。', 'error');
            return;
        }
        var exhibit = currentExhibit();
        if (!exhibit) {
            setBusy(false, '未找到可用展品配置。', 'error');
            return;
        }
        var mode = byId('museum-mode').value;
        var strength = byId('museum-strength').value;
        setBusy(true, '正在搜索' + exhibit.nameCN + '光谱配方…', 'working');
        document.dispatchEvent(new CustomEvent('spectral-museum-optimization-request', {
            detail: {
                optimizationDomain: 'museum',
                exhibitId: exhibit.id,
                mode: mode,
                strength: strength,
                currentIlluminance: numberInput('museum-current-illuminance', 50),
                targetIlluminance: numberInput('museum-target-illuminance', 50),
                currentCct: numberInput('museum-current-cct', metricCct(latestMetrics) || 4000),
                targetCct: numberInput('museum-target-cct', 3500),
                duvRange: [duvMin, duvMax],
                dailyHours: numberInput('museum-daily-hours', 8),
                annualDays: numberInput('museum-annual-days', 300),
                sampleIds: exhibit.sampleIds.slice()
            }
        }));
    }

    function handleResult(event) {
        var detail = event.detail || {};
        if (detail.optimizationDomain !== 'museum' && !detail.exhibitId) return;
        if (detail.exhibitId && detail.exhibitId !== selectedExhibitId) return;
        if (detail.error) {
            setBusy(false, detail.error, 'error');
            return;
        }
        lastOptimization = detail;
        var evaluation = detail.afterEvaluation || currentEvaluation;
        renderMetrics(evaluation);
        renderSampleResults(evaluation);
        renderVisualFindings(detail.beforeEvaluation || currentEvaluation, evaluation);
        renderPreviews();
        drawSpdComparison(detail.beforeSnapshot && detail.beforeSnapshot.spd, detail.afterSnapshot && detail.afterSnapshot.spd);
        renderChannels(detail.beforeSnapshot && detail.beforeSnapshot.channels, detail.afterSnapshot && detail.afterSnapshot.channels);
        if (byId('museum-result-conclusion')) byId('museum-result-conclusion').textContent = detail.applied ? '展品配方已应用' : '保留当前配方';
        if (byId('museum-result-summary')) {
            var exhibit = currentExhibit();
            var groups = exhibit && exhibit.evaluationProfile && exhibit.evaluationProfile.distinctionGroups || {};
            var primaryKey = Object.keys(groups)[0];
            var primaryValue = evaluation && primaryKey && evaluation.distinction && evaluation.distinction[primaryKey]
                ? evaluation.distinction[primaryKey].candidate.toFixed(2) : '—';
            var primaryLabel = primaryKey && groups[primaryKey] ? groups[primaryKey].labelCN : '关键区域辨识度';
            byId('museum-result-summary').textContent = detail.message ||
                ('平均 ΔE00 ' + (evaluation ? evaluation.weightedMeanDeltaE00.toFixed(2) : '—') +
                    ' · ' + primaryLabel + ' ' + primaryValue);
        }
        if (byId('museum-optimized-preview-caption')) byId('museum-optimized-preview-caption').textContent = detail.applied
            ? '优化后配方' : '当前范围未应用新配方';
        var exhibitName = currentExhibit() ? currentExhibit().nameCN : '展品';
        setBusy(false, detail.message || (detail.applied ? exhibitName + '优化完成。' : '当前条件下未应用新配方。'), detail.applied ? 'success' : 'warning');
    }

    function bind() {
        if (byId('museum-exhibit')) {
            byId('museum-exhibit').addEventListener('change', function () {
                var exhibit = DATA.getExhibit(byId('museum-exhibit').value);
                if (!exhibit) return;
                selectedExhibitId = exhibit.id;
                selectedSampleId = exhibit.defaultSampleId;
                lastOptimization = null;
                currentEvaluation = null;
                if (exhibit.lightingDefaults) {
                    if (byId('museum-target-illuminance') && Number.isFinite(Number(exhibit.lightingDefaults.targetIlluminance))) {
                        byId('museum-target-illuminance').value = String(exhibit.lightingDefaults.targetIlluminance);
                    }
                    if (byId('museum-target-cct') && Number.isFinite(Number(exhibit.lightingDefaults.targetCct))) {
                        byId('museum-target-cct').value = String(exhibit.lightingDefaults.targetCct);
                    }
                }
                renderExhibitSummary();
                renderSampleSelector();
                renderSampleDetail();
                renderFindingCards();
                renderMetricCards();
                renderModeCopy();
                renderSampleResults(null);
                renderVisualFindings(null, null);
                updateCurrentEvaluation();
                setBusy(false, '已切换至' + exhibit.nameCN + '。', '');
            });
        }
        ['museum-current-illuminance', 'museum-target-illuminance', 'museum-current-cct', 'museum-target-cct',
            'museum-duv-min', 'museum-duv-max', 'museum-daily-hours', 'museum-annual-days'].forEach(function (id) {
            var element = byId(id);
            if (!element) return;
            element.addEventListener('input', function () {
                renderExposure();
                if (lastOptimization) invalidateResult('照明条件已改变，请重新运行。');
                else renderPreviews();
            });
        });
        ['museum-mode', 'museum-strength'].forEach(function (id) {
            var element = byId(id);
            if (!element) return;
            element.addEventListener('change', function () {
                renderModeCopy();
                if (lastOptimization) invalidateResult('优化目标已改变，请重新运行。');
                else renderPreviews();
            });
        });
        if (byId('museum-optimize-button')) byId('museum-optimize-button').addEventListener('click', requestOptimization);
        document.addEventListener('spectral-museum-optimization-result', handleResult);
    }

    function update(spd, metrics) {
        latestSpd = spd && typeof spd.length === 'number' ? Array.from(spd) : [];
        latestMetrics = metrics || null;
        updateCurrentEvaluation();
    }

    function init() {
        if (!DATA || !DAMAGE || !byId('museum-panel')) return;
        renderExhibitSelector();
        renderExhibitSummary();
        renderSampleSelector();
        renderSampleDetail();
        renderFindingCards();
        renderMetricCards();
        renderExposure();
        renderModeCopy();
        renderSampleResults(null);
        renderVisualFindings(null, null);
        renderPreviews();
        bind();
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();

    root.MuseumPanel = Object.freeze({
        update: update,
        classifySampleForRgb: classifySampleForRgb
    });
})(typeof window !== 'undefined' ? window : globalThis);
