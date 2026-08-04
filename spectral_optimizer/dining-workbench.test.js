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
        await page.waitForFunction(() => document.querySelectorAll('#dining-material-selector [data-material-id]').length === 7);

        const initial = await page.evaluate(() => {
            const thumbnails = [...document.querySelectorAll('#dining-material-selector .material-thumb')];
            const identity = document.getElementById('dining-before-preview');
            return {
                current: window.AnalysisWorkspace.current(),
                profileCount: document.getElementById('dining-light-profile')?.options.length || 0,
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
        assert.equal(initial.profileCount, 7);
        assert.equal(await page.$eval('#dining-target-mode', element => element.value), 'current');
        assert.match(initial.selectedMaterial, /^food_/);
        assert.equal(initial.comparisonHidden, true);
        assert.match(initial.target, /保持当前色点/);
        assert.equal(initial.thumbnailImages.length, 7);
        assert.equal(new Set(initial.thumbnailImages).size, 7,
            'each food category must use a distinct photograph');
        assert.ok(initial.thumbnailImages.every(value => /assets\/appearance\/foods\/[a-z-]+\.webp/.test(value)),
            'all food materials must use a dedicated project photograph');
        assert.equal(initial.thumbnailPlaceholders.filter(Boolean).length, 0,
            'all seven food categories must have a reliable photograph');
        assert.ok(initial.thumbnailImages.every(value => !/linear-gradient/i.test(value)),
            'food photographs must not be covered by a full-card colour gradient');
        assert.ok(initial.thumbnailBlends.every(value => value === 'normal'),
            'food photographs must use normal image rendering');
        assert.ok(initial.thumbnailChips.every((value, index) =>
            initial.thumbnailPlaceholders[index] ? /暂无实拍图/.test(value) : value === 'none'),
            'food thumbnails must show either a real texture or an explicit placeholder');
        assert.match(initial.identityImage, /assets\/appearance\/foods\/red-brown-cooked-meat\.webp/);
        assert.doesNotMatch(initial.identityImage, /linear-gradient/i);
        assert.equal(initial.identityBlend, 'normal');
        assert.equal(initial.identityFilter, 'none');
        assert.match(initial.uploadButton, /添加自定义食材/);
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
                if (event.detail?.diningProfileId) {
                    window.__diningRequest = event.detail;
                    window.__diningRequestCount += 1;
                }
            });
            document.addEventListener('spectral-material-optimization-result', event => {
                if (event.detail?.diningProfileId) window.__diningResult = event.detail;
            });
        });
        await page.select('#dining-light-profile', 'hotpot_barbecue');
        await page.click('#dining-light-apply');
        await page.waitForFunction(() => Boolean(window.__diningResult), { timeout: 90000 });
        await page.waitForFunction(() => document.getElementById('dining-light-apply')?.disabled === false, { timeout: 90000 });
        await page.waitForFunction(() => ['dining-before-preview', 'dining-after-preview']
            .every(id => {
                const canvas = document.getElementById(id);
                return /red-brown-cooked-meat/.test(canvas?.dataset.imageSource || '') &&
                    Boolean(canvas?.dataset.rendered);
            }), { timeout: 10000 });

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
                return [...context.getImageData(Math.floor(canvas.width / 2), Math.floor(canvas.height / 2), 1, 1).data];
            }),
            validationNote: document.getElementById('dining-photo-note')?.textContent || '',
            foodMetrics: document.getElementById('dining-material-metrics')?.textContent || ''
        }));
        assert.equal(result.detail.diningProfileId, 'hotpot_barbecue');
        const request = await page.evaluate(() => window.__diningRequest);
        assert.equal(request.targetMode, 'current');
        assert.equal(await page.evaluate(() => window.__diningRequestCount), 1,
            'one click must dispatch exactly one dining optimization request');
        assert.equal(request.targetCct, 3000);
        assert.equal(request.targetDuv, -0.0005);
        assert.deepEqual(request.cctRange, [2700, 3500]);
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
        assert.match(result.summary, /场景加权得分|最差|未找到更优配方/);
        assert.match(result.validationNote, /左图始终显示原始照片|Lab 差异.*×3|LED 通道/);
        assert.deepEqual(result.previewLabels, ['优化前', '优化后']);
        if (result.detail.applied) {
            assert.notDeepEqual(result.previewPixels[0], result.previewPixels[1],
                'an applied recipe must visibly encode the calculated before-to-after Lab change');
        } else {
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
        assert.match(baselineDisplay.caption, /原始图片.*优化前/);
        assert.match(baselineDisplay.note, new RegExp(String(Math.round(baselineCct))));
        assert.match(baselineDisplay.note, /Duv/);
        await page.click('#dining-material-selector [data-material-id="food_leafy_green"]');
        const selectedFoodBaseline = await page.evaluate(() => ({
            caption: document.getElementById('dining-before-caption')?.textContent || '',
            note: document.getElementById('dining-baseline-summary')?.textContent || ''
        }));
        assert.equal(selectedFoodBaseline.note, baselineDisplay.note,
            '切换食材不得重建本次优化的优化前色点基线');
        assert.match(selectedFoodBaseline.caption, /原始图片.*优化前/);
        // Selection only changes the inspected photograph. Restore the first
        // item before testing repeat-click determinism on the same UI state.
        await page.click('#dining-material-selector [data-material-id="food_grilled_beef"]');
        await page.waitForFunction(() => ['dining-before-preview', 'dining-after-preview']
            .every(id => {
                const canvas = document.getElementById(id);
                return /red-brown-cooked-meat/.test(canvas?.dataset.imageSource || '') &&
                    Boolean(canvas?.dataset.rendered);
            }), { timeout: 10000 });

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

        await page.select('#dining-target-mode', 'scene');
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
        await page.select('#dining-food-upload-template', 'food_tomato_red');
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
        await page.waitForFunction(() => document.querySelectorAll('#dining-material-selector [data-material-id]').length === 8);
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
            panelWidth: document.getElementById('dining-panel').getBoundingClientRect().width
        }));
        assert.equal(mobile.overflow, 0);
        assert.equal(mobile.validationColumns, 1, 'mobile dining validation must stack vertically');
        assert.ok(mobile.metricColumns <= 2, 'mobile dining metrics must use at most two columns');
        assert.ok(mobile.panelWidth <= 366);
        assert.deepEqual(pageErrors, []);

        console.log('dining workbench tests passed', {
            profileCount: initial.profileCount,
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
