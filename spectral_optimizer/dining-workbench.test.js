'use strict';

const assert = require('node:assert/strict');
const puppeteer = require('puppeteer');
const { createLocalServer } = require('./local-server.js');

(async () => {
    const server = createLocalServer();
    await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', resolve);
    });
    const browser = await puppeteer.launch({ headless: true });
    try {
        const page = await browser.newPage();
        const pageErrors = [];
        page.on('pageerror', error => pageErrors.push(error.message));
        await page.setViewport({ width: 1600, height: 1000 });
        await page.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil: 'networkidle0' });
        await page.waitForFunction(() => document.documentElement.dataset.appReady === 'true');

        const structure = await page.evaluate(() => ({
            tabs: [...document.querySelectorAll('.analysis-workspace-tabs [data-analysis-tab]')]
                .map(button => button.dataset.analysisTab),
            materialHasDining: Boolean(document.querySelector('#analysis-pane-material #dining-light-profile')),
            materialHasFoodCategory: Boolean(document.querySelector('#analysis-pane-material [data-category="food"]')),
            diningParent: document.getElementById('dining-panel')?.parentElement?.id || ''
        }));
        assert.deepEqual(structure.tabs, ['colour', 'material', 'dining']);
        assert.equal(structure.materialHasDining, false);
        assert.equal(structure.materialHasFoodCategory, false);
        assert.equal(structure.diningParent, 'analysis-pane-dining');

        await page.click('#analysis-tab-dining');
        await page.waitForFunction(() => !document.getElementById('analysis-pane-dining').hidden);
        await page.waitForFunction(() => document.querySelectorAll('#dining-material-selector [data-material-id]').length === 12);
        await page.waitForFunction(() => Boolean(document.getElementById('dining-before-preview')?.dataset.rendered), { timeout: 15000 });

        const initial = await page.evaluate(() => {
            const thumbnails = [...document.querySelectorAll('#dining-material-selector .material-thumb')];
            const identity = document.getElementById('dining-before-preview');
            return {
                current: window.AnalysisWorkspace.current(),
                applicationSceneSelector: Boolean(document.getElementById('dining-light-profile')),
                cuisineCount: document.getElementById('dining-cuisine-profile')?.options.length || 0,
                cuisineValue: document.getElementById('dining-cuisine-profile')?.value || '',
                participatingCount: document.querySelectorAll('#dining-material-selector [data-participating="true"]').length,
                selectorColumns: getComputedStyle(document.getElementById('dining-material-selector')).gridTemplateColumns.split(/\s+/).filter(Boolean).length,
                selectedMaterial: document.querySelector('#dining-material-selector [aria-pressed="true"]')?.dataset.materialId || '',
                comparisonHidden: document.getElementById('dining-optimization-comparison')?.hidden,
                target: document.getElementById('dining-target-summary')?.textContent || '',
                thumbnailImages: thumbnails.map(element => getComputedStyle(element).backgroundImage),
                thumbnailPlaceholders: thumbnails.map(element => element.classList.contains('is-placeholder')),
                thumbnailBlends: thumbnails.map(element => getComputedStyle(element).backgroundBlendMode),
                thumbnailChips: thumbnails.map(element => getComputedStyle(element, '::after').content),
                identityImage: identity?.dataset.imageSource || '',
                identityBlend: 'normal',
                identityFilter: identity ? getComputedStyle(identity).filter : '',
                beforePreviewSaturation: Number(identity?.dataset.previewSaturation || NaN),
                afterPreviewSaturation: Number(document.getElementById('dining-after-preview')?.dataset.previewSaturation || NaN),
                uploadButton: document.getElementById('dining-food-upload-open')?.textContent || '',
                uploadDialog: Boolean(document.getElementById('dining-food-upload-overlay')),
                workflowSteps: [...document.querySelectorAll('#dining-panel [data-dining-step]')]
                    .map(element => element.dataset.diningStep),
                photoCount: document.querySelectorAll('#dining-food-validation canvas.dining-food-preview').length,
                swatchCount: document.querySelectorAll('#dining-food-validation .dining-color-swatch').length,
                technicalDetailsOpen: document.getElementById('dining-technical-details')?.open,
                layout: (() => {
                    const validation = document.getElementById('dining-food-validation')?.getBoundingClientRect();
                    const metrics = document.getElementById('dining-material-metrics')?.getBoundingClientRect();
                    return {
                        validation: validation ? { width: validation.width, height: validation.height } : null,
                        metricsTop: metrics?.top || 0
                    };
                })()
            };
        });
        assert.equal(initial.current, 'dining');
        assert.equal(initial.applicationSceneSelector, false);
        assert.equal(initial.cuisineCount, 17);
        assert.equal(initial.cuisineValue, 'comprehensive');
        assert.equal(initial.participatingCount, 12);
        assert.equal(initial.selectorColumns, 4);
        assert.equal(await page.$eval('#dining-target-mode', element => element.value), 'current');
        assert.equal(initial.selectedMaterial, 'dish_red_braised_meat');
        assert.equal(initial.comparisonHidden, true);
        assert.match(initial.target, /保持当前色点/);
        assert.equal(initial.thumbnailImages.length, 12);
        assert.equal(new Set(initial.thumbnailImages).size, 12,
            'one concrete dish photograph must not represent multiple dish visual types');
        assert.ok(initial.thumbnailImages.every(value => /images\.weserv\.nl/.test(value)),
            'all dish cards must use the close-up image endpoint');
        assert.ok(initial.thumbnailImages.every(value => /assets\/appearance\/foods\/[a-z-]+\.webp/.test(value)),
            'all dish cards must also include a local fallback photograph');
        assert.equal(initial.thumbnailPlaceholders.filter(Boolean).length, 0,
            'all twelve dish types must display a photograph');
        assert.ok(initial.thumbnailImages.every(value => !/linear-gradient/i.test(value)),
            'dish photographs must not be covered by a full-card colour gradient');
        assert.ok(initial.thumbnailBlends.every(value => value.split(',').every(item => item.trim() === 'normal')),
            'dish photographs and local fallbacks must use normal image rendering');
        assert.ok(initial.thumbnailChips.every(value => value === 'none'),
            'dish thumbnails must not show pending-image placeholder chips');
        assert.match(initial.identityImage, /8256988|red-brown-cooked-meat/);
        assert.doesNotMatch(initial.identityImage, /linear-gradient/i);
        assert.equal(initial.identityBlend, 'normal');
        assert.equal(initial.identityFilter, 'none');
        assert.equal(initial.beforePreviewSaturation, 0.72,
            'the optimization-before preview must use the reduced-saturation baseline');
        assert.equal(initial.afterPreviewSaturation, 0.72,
            'before optimization the pending after-preview must keep the same reduced-saturation baseline');
        assert.match(initial.uploadButton, /添加自定义菜式/);
        assert.equal(initial.uploadDialog, true);
        assert.deepEqual(initial.workflowSteps, ['conditions', 'foods', 'execute', 'results']);
        assert.equal(initial.photoCount, 2, 'selected food must show before and after image previews');
        assert.equal(initial.swatchCount, 0, 'normal users must not be asked to compare colour swatches');
        assert.equal(initial.technicalDetailsOpen, false, 'technical charts must be collapsed by default');
        assert.ok(initial.layout.validation && initial.layout.validation.width > 0 && initial.layout.validation.height > 0);

        await page.evaluate(() => {
            window.__diningResult = null;
            window.__diningRequest = null;
            window.__diningRequestCount = 0;
            document.addEventListener('spectral-material-optimization-request', event => {
                if (event.detail?.cuisineProfileId) {
                    window.__diningRequest = event.detail;
                    window.__diningRequestCount += 1;
                }
            });
            document.addEventListener('spectral-material-optimization-result', event => {
                if (event.detail?.cuisineProfileId) window.__diningResult = event.detail;
            });
        });
        await page.select('#dining-cuisine-profile', 'japanese');
        const japaneseFilter = await page.evaluate(() => ({
            participating: document.querySelectorAll('#dining-material-selector [data-participating="true"]').length,
            inactive: document.querySelectorAll('#dining-material-selector .is-inactive').length,
            copy: document.getElementById('dining-light-description')?.textContent || ''
        }));
        assert.equal(japaneseFilter.participating, 5);
        assert.equal(japaneseFilter.inactive, 7);
        assert.match(japaneseFilter.copy, /日料|5类菜式/);
        await page.select('#dining-cuisine-profile', 'comprehensive');
        await page.click('#dining-light-apply');
        await page.waitForFunction(() => Boolean(window.__diningResult), { timeout: 90000 });
        await page.waitForFunction(() => document.getElementById('dining-light-apply')?.disabled === false, { timeout: 90000 });
        await page.waitForFunction(() => ['dining-before-preview', 'dining-after-preview']
            .every(id => {
                const canvas = document.getElementById(id);
                return /8256988|red-brown-cooked-meat/.test(canvas?.dataset.imageSource || '') &&
                    Boolean(canvas?.dataset.rendered);
            }), { timeout: 15000 });

        const result = await page.evaluate(() => ({
            detail: window.__diningResult,
            comparisonHidden: document.getElementById('dining-optimization-comparison')?.hidden,
            canvasWidth: document.getElementById('dining-optimization-spd')?.width || 0,
            metrics: document.getElementById('dining-optimization-metrics')?.textContent || '',
            channels: document.getElementById('dining-optimization-channels')?.textContent || '',
            summary: document.getElementById('dining-optimization-summary')?.textContent || '',
            previewLabels: [...document.querySelectorAll('.dining-photo-compare figcaption strong')].map(element => element.textContent),
            previewPixels: ['dining-before-preview', 'dining-after-preview'].map(id => {
                const canvas = document.getElementById(id);
                const context = canvas.getContext('2d');
                return [[0.3, 0.45], [0.5, 0.55], [0.7, 0.45]].map(([x, y]) =>
                    [...context.getImageData(Math.floor(canvas.width * x), Math.floor(canvas.height * y), 1, 1).data]
                );
            }),
            selectedDishLabDelta: (() => {
                const detail = window.__diningResult;
                const material = window.DiningLightData.getMaterial('dish_red_braised_meat');
                const before = window.MaterialColor.calculateMaterialDelta(detail.beforeSnapshot.spd, {
                    material,
                    cct: detail.referenceCct
                }).candidate.lab;
                const after = window.MaterialColor.calculateMaterialDelta(detail.afterSnapshot.spd, {
                    material,
                    cct: detail.referenceCct
                }).candidate.lab;
                return Math.hypot(after[0] - before[0], after[1] - before[1], after[2] - before[2]);
            })(),
            validationNote: document.getElementById('dining-photo-note')?.textContent || '',
            previewSaturations: ['dining-before-preview', 'dining-after-preview'].map(id =>
                Number(document.getElementById(id)?.dataset.previewSaturation || NaN)),
            foodMetrics: document.getElementById('dining-material-metrics')?.textContent || ''
        }));
        assert.equal(result.detail.cuisineProfileId, 'comprehensive');
        const request = await page.evaluate(() => window.__diningRequest);
        assert.equal(request.targetMode, 'current');
        assert.equal(request.cuisineProfileId, 'comprehensive');
        assert.equal(request.cuisineProfileName, '综合餐饮');
        assert.equal(request.materialIds.length, 12);
        assert.equal(await page.evaluate(() => window.__diningRequestCount), 1,
            'one click must dispatch exactly one dining optimization request');
        assert.equal(request.targetCct, 3500);
        assert.equal(request.targetDuv, 0);
        assert.deepEqual(request.cctRange, [3000, 4000]);
        assert.ok(result.detail.referenceCct > 3500 && result.detail.referenceCct < 4500);
        assert.equal(result.detail.beforeSnapshot.target.cct, result.detail.referenceCct);
        assert.equal(result.detail.afterSnapshot.target.cct, result.detail.referenceCct);
        assert.ok(result.detail.beforeSnapshot);
        assert.ok(result.detail.afterSnapshot);
        assert.equal(result.comparisonHidden, false);
        assert.ok(result.canvasWidth > 0);
        assert.match(result.metrics, /CCT|Duv|Rf|Rg|R9/);
        assert.match(result.metrics, /目标/, 'dining comparison must show target colour-point values');
        assert.match(result.channels, /→/);
        assert.match(result.summary, /菜系加权得分|最差|未找到更优配方/);
        assert.doesNotMatch(result.summary, /dish_[a-z_]+/,
            'user-facing dining summaries must show dish names instead of internal material IDs');
        assert.match(result.validationNote, /优化前.*降低饱和度|Lab 差异.*×3|LED 通道/);
        assert.deepEqual(result.previewLabels, ['优化前', '优化后']);
        if (result.detail.applied) {
            assert.deepEqual(result.previewSaturations, [0.72, 1],
                'an applied optimization must compare the reduced-saturation baseline with the enhanced result');
            assert.ok(result.selectedDishLabDelta > 0,
                'an applied recipe must produce a calculated before-to-after Lab difference');
            assert.ok(result.previewPixels.every(sample => sample.length === 3),
                'both dish preview canvases must remain readable after rendering');
        } else {
            assert.deepEqual(result.previewSaturations, [0.72, 0.72],
                'without an applied recipe both previews must keep the same baseline saturation');
            assert.match(result.summary, /没有应用新配方|未找到更优配方/);
        }
        assert.match(result.foodMetrics, /优化前/);
        assert.match(result.foodMetrics, /优化后/);
        assert.match(result.foodMetrics, /ΔE00|ΔL\*|ΔC\*|Δh/);
        const baselineCct = result.detail.beforeSnapshot.metrics.cct;
        const baselineDuv = result.detail.beforeSnapshot.metrics.duv;
        const baselineDisplay = await page.evaluate(() => ({
            caption: document.getElementById('dining-before-caption')?.textContent || '',
            note: document.getElementById('dining-baseline-summary')?.textContent || ''
        }));
        assert.match(baselineDisplay.caption, /低饱和基线.*优化前/);
        assert.match(baselineDisplay.note, new RegExp(String(Math.round(baselineCct))));
        assert.match(baselineDisplay.note, /Duv/);
        await page.click('#dining-material-selector [data-material-id="dish_green_vegetable"]');
        const selectedFoodBaseline = await page.evaluate(() => ({
            caption: document.getElementById('dining-before-caption')?.textContent || '',
            note: document.getElementById('dining-baseline-summary')?.textContent || ''
        }));
        assert.equal(selectedFoodBaseline.note, baselineDisplay.note,
            '切换食材不得重建本次优化的优化前色点基线');
        assert.match(selectedFoodBaseline.caption, /低饱和基线.*优化前/);
        // Selection only changes the inspected photograph. Restore the first
        // item before testing repeat-click determinism on the same UI state.
        await page.click('#dining-material-selector [data-material-id="dish_red_braised_meat"]');
        await page.waitForFunction(() => ['dining-before-preview', 'dining-after-preview']
            .every(id => {
                const canvas = document.getElementById(id);
                return /8256988|red-brown-cooked-meat/.test(canvas?.dataset.imageSource || '') &&
                    Boolean(canvas?.dataset.rendered);
            }), { timeout: 15000 });

        const firstSnapshot = await page.evaluate(() => ({
            before: window.__diningResult.beforeSnapshot.channels.map(channel => channel.value),
            after: window.__diningResult.afterSnapshot.channels.map(channel => channel.value),
            summary: window.__diningResult.after,
            beforePixels: [
                [0.2, 0.2], [0.5, 0.5], [0.8, 0.8]
            ].map(([x, y]) => {
                const canvas = document.getElementById('dining-before-preview');
                return [...canvas.getContext('2d').getImageData(
                    Math.floor(canvas.width * x), Math.floor(canvas.height * y), 1, 1
                ).data];
            })
        }));
        await page.evaluate(() => { window.__diningResult = null; window.__diningRequest = null; });
        await page.click('#dining-light-apply');
        await page.waitForFunction(() => Boolean(window.__diningResult), { timeout: 90000 });
        await page.waitForFunction(() => ['dining-before-preview', 'dining-after-preview']
            .every(id => Boolean(document.getElementById(id)?.dataset.rendered)), { timeout: 10000 });
        const secondSnapshot = await page.evaluate(() => ({
            before: window.__diningResult.beforeSnapshot.channels.map(channel => channel.value),
            after: window.__diningResult.afterSnapshot.channels.map(channel => channel.value),
            summary: window.__diningResult.after,
            beforePixels: [
                [0.2, 0.2], [0.5, 0.5], [0.8, 0.8]
            ].map(([x, y]) => {
                const canvas = document.getElementById('dining-before-preview');
                return [...canvas.getContext('2d').getImageData(
                    Math.floor(canvas.width * x), Math.floor(canvas.height * y), 1, 1
                ).data];
            })
        }));
        assert.deepEqual(secondSnapshot.before, firstSnapshot.before,
            'repeating the same dining request must reuse the same baseline channels');
        assert.deepEqual(secondSnapshot.after, firstSnapshot.after,
            'repeating the same dining request must produce the same optimized channels');
        assert.deepEqual(secondSnapshot.summary, firstSnapshot.summary,
            'repeating the same dining request must produce the same optimization metrics');
        assert.deepEqual(secondSnapshot.beforePixels, firstSnapshot.beforePixels,
            'repeating the same dining request must render the same optimization-before image');

        await page.select('#dining-target-mode', 'recommended');
        const invalidated = await page.evaluate(() => ({
            comparisonHidden: document.getElementById('dining-optimization-comparison')?.hidden,
            summary: document.getElementById('dining-optimization-summary')?.textContent || '',
            baseline: document.getElementById('dining-baseline-summary')?.textContent || '',
            status: document.getElementById('dining-optimization-status')?.textContent || ''
        }));
        assert.equal(invalidated.comparisonHidden, true,
            'changing the target mode must hide the stale technical comparison');
        assert.match(invalidated.summary, /条件已改变/);
        assert.match(invalidated.baseline, /等待优化/);
        assert.match(invalidated.status, /色点模式已改变.*重新运行/);

        await page.click('#dining-food-upload-open');
        await page.waitForFunction(() => document.getElementById('dining-food-upload-overlay')?.hidden === false);
        await page.type('#dining-food-upload-name', '自定义番茄切面');
        await page.select('#dining-food-upload-template', 'dish_red_chili_oil');
        await page.evaluate(() => {
            const canvas = document.createElement('canvas');
            canvas.width = 64;
            canvas.height = 64;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#c74638';
            ctx.fillRect(0, 0, 64, 64);
            ctx.fillStyle = '#f4b07f';
            ctx.fillRect(8, 8, 48, 48);
            canvas.toBlob(blob => {
                const file = new File([blob], 'tomato-closeup.png', { type: 'image/png' });
                const input = document.getElementById('dining-food-photo-input');
                const transfer = new DataTransfer();
                transfer.items.add(file);
                input.files = transfer.files;
                input.dispatchEvent(new Event('change', { bubbles: true }));
            }, 'image/png');
        });
        await page.waitForFunction(() => document.getElementById('dining-food-upload-submit')?.disabled === false);
        await page.click('#dining-food-upload-submit');
        await page.waitForFunction(() => document.querySelectorAll('#dining-material-selector [data-material-id]').length === 13);
        const uploaded = await page.evaluate(() => ({
            selectedId: document.querySelector('#dining-material-selector [aria-pressed="true"]')?.dataset.materialId || '',
            title: document.getElementById('dining-detail-title')?.textContent || '',
            image: document.getElementById('dining-before-preview')?.dataset.imageSource || '',
            template: document.getElementById('dining-detail-description')?.textContent || ''
        }));
        assert.match(uploaded.selectedId, /^user_food_/);
        assert.equal(uploaded.title, '自定义番茄切面');
        assert.match(uploaded.image, /data:image\/webp|data:image\/png/);
        assert.match(uploaded.template, /番茄|光谱模板/);

        await page.evaluate(() => { window.__diningResult = null; window.__diningRequest = null; });
        await page.click('#dining-light-apply');
        await page.waitForFunction(() => Boolean(window.__diningResult), { timeout: 90000 });
        const customOptimization = await page.evaluate(() => ({ request: window.__diningRequest, result: window.__diningResult }));
        assert.ok(customOptimization.request.materialIds.includes(uploaded.selectedId));
        assert.ok(customOptimization.request.materialModels.some(material => material.id === uploaded.selectedId));
        assert.equal(customOptimization.result.materialCount, customOptimization.request.materialIds.length);
        assert.equal(await page.evaluate(() => window.__diningRequestCount), 3,
            'legacy dining bindings must not duplicate optimization requests');

        await page.setViewport({ width: 390, height: 844 });
        await new Promise(resolve => setTimeout(resolve, 180));
        const mobile = await page.evaluate(() => ({
            overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
            validationColumns: getComputedStyle(document.querySelector('.dining-photo-compare')).gridTemplateColumns
                .split(/\s+/).filter(Boolean).length,
            metricColumns: getComputedStyle(document.getElementById('dining-optimization-metrics')).gridTemplateColumns
                .split(/\s+/).filter(Boolean).length,
            selectorColumns: getComputedStyle(document.getElementById('dining-material-selector')).gridTemplateColumns
                .split(/\s+/).filter(Boolean).length,
            panelWidth: document.getElementById('dining-panel').getBoundingClientRect().width
        }));
        assert.equal(mobile.overflow, 0);
        assert.equal(mobile.validationColumns, 1, 'mobile dining validation must stack vertically');
        assert.ok(mobile.metricColumns <= 2, 'mobile dining metrics must use at most two columns');
        assert.equal(mobile.selectorColumns, 2, 'mobile dish selector must use two columns');
        assert.ok(mobile.panelWidth <= 366);
        assert.deepEqual(pageErrors, []);

        console.log('dining workbench tests passed', {
            cuisineCount: initial.cuisineCount,
            improved: result.detail.improved,
            summary: result.summary
        });
    } finally {
        await browser.close();
        await new Promise(resolve => server.close(resolve));
    }
})().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
