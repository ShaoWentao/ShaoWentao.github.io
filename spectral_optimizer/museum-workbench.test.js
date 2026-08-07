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
        let museumWorkerCount = 0;
        page.on('pageerror', error => pageErrors.push(error.message));
        page.on('workercreated', worker => {
            if (/scene-optimizer-worker\.js/.test(worker.url())) museumWorkerCount += 1;
        });
        await page.setViewport({ width: 1600, height: 1000 });
        await page.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil: 'networkidle0' });
        await page.waitForFunction(() => document.documentElement.dataset.appReady === 'true');

        const structure = await page.evaluate(() => ({
            tabs: [...document.querySelectorAll('.analysis-workspace-tabs [data-analysis-tab]')]
                .map(button => button.dataset.analysisTab),
            panelParent: document.getElementById('museum-panel')?.parentElement?.id || '',
            panelExists: Boolean(document.getElementById('museum-panel'))
        }));
        assert.deepEqual(structure.tabs, ['colour', 'material', 'dining', 'museum']);
        assert.equal(structure.panelExists, true);
        assert.equal(structure.panelParent, 'analysis-pane-museum');

        await page.click('#analysis-tab-museum');
        await page.waitForFunction(() => !document.getElementById('analysis-pane-museum').hidden);
        await page.waitForFunction(() => document.querySelectorAll('#museum-sample-selector [data-museum-sample-id]').length === 6);
        await page.waitForFunction(() => [...document.querySelectorAll('#museum-primary-preview-grid canvas')]
            .every(canvas => Boolean(canvas.dataset.rendered)), { timeout: 15000 });

        const initial = await page.evaluate(() => {
            const primaryStage = document.querySelector('.museum-exhibit-stage')?.getBoundingClientRect();
            const controlPanel = document.querySelector('.museum-control-panel')?.getBoundingClientRect();
            return {
                currentTab: window.AnalysisWorkspace.current(),
                sections: [...document.querySelectorAll('#museum-panel [data-museum-section]')]
                    .map(element => element.dataset.museumSection),
                samples: [...document.querySelectorAll('#museum-sample-selector [data-museum-sample-id]')]
                    .map(element => element.dataset.museumSampleId),
                sampleSwatches: document.querySelectorAll('#museum-sample-selector .museum-sample-swatch').length,
                allInputs: [
                    'museum-current-illuminance', 'museum-target-illuminance',
                    'museum-current-cct', 'museum-target-cct',
                    'museum-duv-min', 'museum-duv-max',
                    'museum-daily-hours', 'museum-annual-days',
                    'museum-exhibit', 'museum-mode', 'museum-strength'
                ].map(id => Boolean(document.getElementById(id))),
                primaryControls: [
                    'museum-exhibit', 'museum-mode', 'museum-strength', 'museum-target-illuminance',
                    'museum-target-cct', 'museum-optimize-button'
                ].map(id => document.getElementById(id)?.closest('.museum-control-panel') != null),
                primaryPreviewLabels: [...document.querySelectorAll('#museum-primary-preview-grid figcaption strong')]
                    .map(element => element.textContent.trim()),
                secondarySectionExists: Boolean(document.querySelector('#museum-panel [data-museum-section="secondary"]')),
                differencePreviewExists: Boolean(document.getElementById('museum-difference-preview')),
                gainSelectorExists: Boolean(document.getElementById('museum-preview-gain')),
                originalPreviewExists: Boolean(document.getElementById('museum-original-preview')),
                exhibitOptions: [...document.querySelectorAll('#museum-exhibit option')].map(option => ({
                    value: option.value,
                    label: option.textContent.trim()
                })),
                selectedExhibit: document.getElementById('museum-exhibit')?.value || '',
                appearanceFile: window.MuseumLightData.getExhibit('qinghua_porcelain_single')?.appearanceSource?.file || '',
                primaryCanvasPortrait: [...document.querySelectorAll('#museum-primary-preview-grid canvas')]
                    .every(canvas => canvas.height > canvas.width),
                primaryPreviewSaturations: [...document.querySelectorAll('#museum-primary-preview-grid canvas')]
                    .map(canvas => Number(canvas.dataset.previewSaturation)),
                primaryPreviewContrasts: [...document.querySelectorAll('#museum-primary-preview-grid canvas')]
                    .map(canvas => Number(canvas.dataset.previewContrast)),
                primaryPreviewBlurs: [...document.querySelectorAll('#museum-primary-preview-grid canvas')]
                    .map(canvas => Number(canvas.dataset.previewBlurPx)),
                paneBackground: getComputedStyle(document.getElementById('analysis-pane-museum')).backgroundColor,
                showcaseBackground: getComputedStyle(document.querySelector('.museum-showcase')).backgroundColor,
                controlBackground: getComputedStyle(document.querySelector('.museum-control-panel')).backgroundColor,
                findings: [...document.querySelectorAll('#museum-visual-findings [data-museum-finding]')]
                    .map(element => element.dataset.museumFinding),
                findingLabels: [...document.querySelectorAll('#museum-visual-findings [data-museum-finding] span')]
                    .map(element => element.textContent.trim()),
                dataNote: document.getElementById('museum-data-note')?.textContent || '',
                previewNote: document.getElementById('museum-preview-note')?.textContent || '',
                exposure: document.getElementById('museum-target-annual-exposure')?.textContent || '',
                exposureSummary: document.getElementById('museum-exposure-summary')?.textContent || '',
                resultMetricLabels: [...document.querySelectorAll('#museum-result-metrics [data-museum-metric]')]
                    .map(element => element.dataset.museumMetric),
                technicalOpen: document.getElementById('museum-technical-details')?.open,
                technicalOwnsSamples: document.getElementById('museum-sample-selector')?.closest('details')?.id,
                technicalOwnsMetrics: document.getElementById('museum-result-metrics')?.closest('details')?.id,
                outputCanvas: Boolean(document.getElementById('museum-optimization-spd')),
                channelOutput: Boolean(document.getElementById('museum-optimization-channels')),
                validationExists: Boolean(document.getElementById('museum-validation')),
                stageWidth: primaryStage?.width || 0,
                controlsWidth: controlPanel?.width || 0
            };
        });
        assert.equal(initial.currentTab, 'museum');
        assert.deepEqual(initial.sections, ['showcase', 'technical']);
        assert.equal(initial.samples.length, 6);
        assert.equal(initial.sampleSwatches, 0);
        assert.ok(initial.allInputs.every(Boolean));
        assert.ok(initial.primaryControls.every(Boolean));
        assert.deepEqual(initial.primaryPreviewLabels, ['当前光谱', '优化后光谱']);
        assert.equal(initial.secondarySectionExists, false);
        assert.equal(initial.differencePreviewExists, false);
        assert.equal(initial.gainSelectorExists, false);
        assert.equal(initial.originalPreviewExists, false);
        assert.deepEqual(initial.exhibitOptions, [
            { value: 'qinghua_porcelain_single', label: '青花瓷单展品' },
            { value: 'ink_bird_bamboo', label: '纸本水墨花鸟' },
            { value: 'bronze_food_vessel', label: '青铜纹饰食器' },
            { value: 'qingbai_jade_carving', label: '青白玉雕件' },
            { value: 'black_lacquer_gold_writing_box', label: '黑漆金银莳绘砚箱' },
            { value: 'embroidered_birds_flowers_panel', label: '花鸟刺绣挂屏' },
            { value: 'qing_qianlong_cloisonne_floral_vase', label: '清乾隆掐丝珐琅花卉纹瓶' },
            { value: 'northern_song_guanyin', label: '北宋彩绘木雕观音菩萨像' },
            { value: 'roesen_still_life_flowers_fruit', label: '花卉与水果静物油画' }
        ]);
        assert.equal(initial.selectedExhibit, 'qinghua_porcelain_single');
        assert.equal(initial.appearanceFile, 'assets/appearance/museum/qinghua-porcelain-cutout.png');
        assert.equal(initial.primaryCanvasPortrait, true);
        assert.deepEqual(initial.primaryPreviewSaturations, [0.94, 0.94]);
        assert.deepEqual(initial.primaryPreviewContrasts, [0.96, 0.96]);
        assert.ok(initial.primaryPreviewBlurs.every(value => value >= 0.5 && value <= 1.2));
        assert.equal(initial.paneBackground, 'rgb(255, 255, 255)');
        assert.equal(initial.showcaseBackground, 'rgb(255, 255, 255)');
        assert.equal(initial.controlBackground, 'rgb(236, 236, 240)');
        assert.deepEqual(initial.findings, ['white', 'blueWhite', 'lightDeepBlue', 'blueHierarchy']);
        assert.deepEqual(initial.findingLabels, ['白釉表现', '蓝白分离', '浅蓝/深蓝', '钴蓝纹样层次']);
        assert.match(initial.dataNote, /工程反射率模型.*不代表真实文物实测数据/);
        assert.match(initial.previewNote, /颜色保真.*低照度.*钴蓝纹样.*色彩增强.*饱和度/);
        assert.match(initial.exposure.replace(/,/g, ''), /120000/);
        assert.match(initial.exposureSummary.replace(/,/g, ''), /120000/);
        assert.deepEqual(initial.resultMetricLabels, [
            'cct', 'duv', 'ra', 'r9', 'rf', 'rg',
            'meanDeltaE00', 'maxDeltaE00', 'blueWhite', 'lightDeepBlue', 'blueHierarchy'
        ]);
        assert.equal(initial.technicalOpen, false);
        assert.equal(initial.technicalOwnsSamples, 'museum-technical-details');
        assert.equal(initial.technicalOwnsMetrics, 'museum-technical-details');
        assert.equal(initial.outputCanvas, true);
        assert.equal(initial.channelOutput, true);
        assert.equal(initial.validationExists, false);
        assert.ok(initial.stageWidth > initial.controlsWidth * 1.5,
            'exhibit comparison must occupy substantially more width than controls');

        const initialPreview = await page.evaluate(() => {
            const canvas = document.getElementById('museum-current-preview');
            const context = canvas.getContext('2d');
            const corner = context.getImageData(2, 2, 1, 1).data;
            return {
                illuminance: Number(canvas.dataset.displayIlluminance),
                toneGain: Number(canvas.dataset.displayToneGain),
                cornerLuminance: corner[0] * 0.2126 + corner[1] * 0.7152 + corner[2] * 0.0722
            };
        });
        assert.equal(initialPreview.illuminance, 50);
        assert.equal(initialPreview.toneGain, 1);
        assert.ok(initialPreview.cornerLuminance < 45,
            `transparent exhibit preview should use a neutral dark display background: ${JSON.stringify(initialPreview)}`);

        await page.select('#museum-exhibit', 'ink_bird_bamboo');
        await page.waitForFunction(() => document.getElementById('museum-panel-title')?.textContent.includes('纸本水墨花鸟'));
        await page.waitForFunction(() => document.querySelectorAll('#museum-sample-selector [data-museum-sample-id]').length === 6);
        await page.waitForFunction(() => document.getElementById('museum-current-preview')?.dataset.exhibitId === 'ink_bird_bamboo',
            { timeout: 15000 });
        await page.waitForFunction(() =>
            document.getElementById('museum-current-preview')?.dataset.regionMaskStatus === 'ready' &&
            document.getElementById('museum-optimized-preview')?.dataset.regionMaskStatus === 'ready',
            { timeout: 15000 });
        const inkView = await page.evaluate(() => ({
            selectedExhibit: document.getElementById('museum-exhibit')?.value,
            title: document.getElementById('museum-panel-title')?.textContent || '',
            samples: [...document.querySelectorAll('#museum-sample-selector [data-museum-sample-id]')]
                .map(element => element.dataset.museumSampleId),
            findings: [...document.querySelectorAll('#museum-visual-findings [data-museum-finding]')]
                .map(element => element.dataset.museumFinding),
            findingLabels: [...document.querySelectorAll('#museum-visual-findings [data-museum-finding] span')]
                .map(element => element.textContent.trim()),
            metrics: [...document.querySelectorAll('#museum-result-metrics [data-museum-metric]')]
                .map(element => element.dataset.museumMetric),
            previewNote: document.getElementById('museum-preview-note')?.textContent || '',
            modeDescription: document.getElementById('museum-mode-description')?.textContent || '',
            source: window.MuseumLightData.getExhibit('ink_bird_bamboo')?.appearanceSource?.file || '',
            lowLightMinRg: window.MuseumLightData.resolveModeSettings(
                'low-light-recognition', 'recommended', 'ink_bird_bamboo'
            ).minRg,
            canvasSource: document.getElementById('museum-current-preview')?.dataset.appearanceSource || '',
            regionMaskMode: document.getElementById('museum-current-preview')?.dataset.regionMaskMode || '',
            regionMaskStatus: document.getElementById('museum-current-preview')?.dataset.regionMaskStatus || '',
            regionMaskCoverage: Number(document.getElementById('museum-current-preview')?.dataset.regionMaskCoverage),
            regionMaskUnclassified: Number(document.getElementById('museum-current-preview')?.dataset.regionMaskUnclassified),
            optimizedRegionMaskStatus: document.getElementById('museum-optimized-preview')?.dataset.regionMaskStatus || '',
            publicMaskInspectorExists: Boolean(document.getElementById('museum-mask-inspector')),
            publicMaskControlCount: document.querySelectorAll('[data-museum-mask-view], [data-museum-mask-sample]').length
        }));
        assert.equal(inkView.selectedExhibit, 'ink_bird_bamboo');
        assert.match(inkView.title, /纸本水墨花鸟/);
        assert.deepEqual(inkView.samples, ['paper_warm', 'ink_light', 'ink_mid', 'ink_deep', 'seal_red', 'paper_shadow']);
        assert.deepEqual(inkView.findings, ['paper', 'paperInk', 'inkHierarchy', 'sealContrast']);
        assert.deepEqual(inkView.findingLabels, ['纸张底色', '纸墨分离', '浓淡墨层次', '印章红表现']);
        assert.deepEqual(inkView.metrics, [
            'cct', 'duv', 'ra', 'r9', 'rf', 'rg',
            'meanDeltaE00', 'maxDeltaE00', 'paperInk', 'inkHierarchy', 'sealContrast'
        ]);
        assert.match(inkView.previewNote, /纸张底色.*浓淡墨.*印章红/);
        assert.match(inkView.modeDescription, /纸张|墨色|灰阶/);
        assert.match(inkView.source, /assets\/appearance\/museum\/ink-bird-bamboo\.jpg$/);
        assert.equal(inkView.canvasSource, inkView.source);
        assert.equal(inkView.regionMaskMode, 'rle-json');
        assert.equal(inkView.regionMaskStatus, 'ready');
        assert.equal(inkView.optimizedRegionMaskStatus, 'ready');
        assert.equal(inkView.publicMaskInspectorExists, false);
        assert.equal(inkView.publicMaskControlCount, 0);
        assert.ok(inkView.regionMaskCoverage >= 0.95);
        assert.ok(inkView.regionMaskUnclassified <= 0.05);
        assert.ok(inkView.lowLightMinRg >= 110);

        const inkRenderToken = await page.$eval('#museum-optimized-preview', canvas => canvas.dataset.rendered);
        await page.evaluate(() => {
            const wavelengths = window.CIE_COLOUR_QUALITY_DATA.wavelengths;
            const spd = window.SpectralMath.blackbodySpd(3500, wavelengths);
            const evaluation = window.MuseumOptimizer.evaluateExhibit(spd, {
                cct: 3500,
                exhibitId: 'ink_bird_bamboo',
                quality: { ra: 96, r9: 92, rf: 94, rg: 112 },
                duv: 0
            });
            document.dispatchEvent(new CustomEvent('spectral-museum-optimization-result', {
                detail: {
                    optimizationDomain: 'museum',
                    exhibitId: 'ink_bird_bamboo',
                    applied: true,
                    beforeEvaluation: evaluation,
                    afterEvaluation: evaluation,
                    message: '水墨亮度锁定测试'
                }
            }));
        });
        await page.waitForFunction(previous => {
            const canvas = document.getElementById('museum-optimized-preview');
            return canvas?.dataset.rendered && canvas.dataset.rendered !== previous;
        }, {}, inkRenderToken);
        const inkLuminanceLock = await page.evaluate(() => {
            const current = document.getElementById('museum-current-preview');
            const optimized = document.getElementById('museum-optimized-preview');
            const currentPixels = current.getContext('2d').getImageData(0, 0, current.width, current.height).data;
            const optimizedPixels = optimized.getContext('2d').getImageData(0, 0, optimized.width, optimized.height).data;
            let difference = 0;
            let changedPixels = 0;
            let count = 0;
            for (let index = 0; index < currentPixels.length; index += 4) {
                const cr = currentPixels[index];
                const cg = currentPixels[index + 1];
                const cb = currentPixels[index + 2];
                const or = optimizedPixels[index];
                const og = optimizedPixels[index + 1];
                const ob = optimizedPixels[index + 2];
                if (Math.hypot(cr - 23, cg - 25, cb - 29) < 10 && Math.hypot(or - 23, og - 25, ob - 29) < 10) continue;
                const pixelDifference = (Math.abs(or - cr) + Math.abs(og - cg) + Math.abs(ob - cb)) / 3;
                difference += pixelDifference;
                if (pixelDifference >= 3) changedPixels += 1;
                count += 1;
            }
            return {
                currentSample: current?.dataset.luminanceLockSample || '',
                optimizedSample: optimized?.dataset.luminanceLockSample || '',
                currentFinal: Number(current?.dataset.luminanceFinal),
                optimizedFinal: Number(optimized?.dataset.luminanceFinal),
                currentCorrection: Number(current?.dataset.luminanceCorrection),
                optimizedCorrection: Number(optimized?.dataset.luminanceCorrection),
                meanRgbDifference: difference / Math.max(1, count),
                changedPixelShare: changedPixels / Math.max(1, count)
            };
        });
        assert.equal(inkLuminanceLock.currentSample, 'paper_warm');
        assert.equal(inkLuminanceLock.optimizedSample, 'paper_warm');
        assert.ok(Number.isFinite(inkLuminanceLock.currentFinal));
        assert.ok(Number.isFinite(inkLuminanceLock.optimizedFinal));
        assert.ok(Math.abs(inkLuminanceLock.optimizedFinal - inkLuminanceLock.currentFinal) <= 1,
            `ink preview must preserve paper luminance at equal illuminance: ${JSON.stringify(inkLuminanceLock)}`);
        assert.ok(inkLuminanceLock.meanRgbDifference >= 2.5,
            `ink comparison must show visible local tonal separation: ${JSON.stringify(inkLuminanceLock)}`);
        assert.ok(inkLuminanceLock.changedPixelShare >= 0.2,
            `ink comparison must visibly change enough exhibit pixels: ${JSON.stringify(inkLuminanceLock)}`);

        await page.select('#museum-exhibit', 'bronze_food_vessel');
        await page.waitForFunction(() => document.getElementById('museum-panel-title')?.textContent.includes('青铜纹饰食器'));
        await page.waitForFunction(() => document.querySelectorAll('#museum-sample-selector [data-museum-sample-id]').length === 6);
        await page.waitForFunction(() => document.getElementById('museum-current-preview')?.dataset.exhibitId === 'bronze_food_vessel',
            { timeout: 15000 });
        const bronzeView = await page.evaluate(() => ({
            selectedExhibit: document.getElementById('museum-exhibit')?.value,
            title: document.getElementById('museum-panel-title')?.textContent || '',
            samples: [...document.querySelectorAll('#museum-sample-selector [data-museum-sample-id]')]
                .map(element => element.dataset.museumSampleId),
            findings: [...document.querySelectorAll('#museum-visual-findings [data-museum-finding]')]
                .map(element => element.dataset.museumFinding),
            findingLabels: [...document.querySelectorAll('#museum-visual-findings [data-museum-finding] span')]
                .map(element => element.textContent.trim()),
            metrics: [...document.querySelectorAll('#museum-result-metrics [data-museum-metric]')]
                .map(element => element.dataset.museumMetric),
            previewNote: document.getElementById('museum-preview-note')?.textContent || '',
            modeDescription: document.getElementById('museum-mode-description')?.textContent || '',
            targetIlluminance: Number(document.getElementById('museum-target-illuminance')?.value),
            targetCct: Number(document.getElementById('museum-target-cct')?.value),
            source: window.MuseumLightData.getExhibit('bronze_food_vessel')?.appearanceSource?.file || '',
            lowLightMinRg: window.MuseumLightData.resolveModeSettings(
                'low-light-recognition', 'recommended', 'bronze_food_vessel'
            ).minRg,
            canvasSource: document.getElementById('museum-current-preview')?.dataset.appearanceSource || '',
            currentBlur: Number(document.getElementById('museum-current-preview')?.dataset.previewBlurPx),
            optimizedBlur: Number(document.getElementById('museum-optimized-preview')?.dataset.previewBlurPx),
            currentBackgroundMode: document.getElementById('museum-current-preview')?.dataset.backgroundMode || '',
            optimizedBackgroundMode: document.getElementById('museum-optimized-preview')?.dataset.backgroundMode || ''
        }));
        assert.equal(bronzeView.selectedExhibit, 'bronze_food_vessel');
        assert.match(bronzeView.title, /青铜纹饰食器/);
        assert.deepEqual(bronzeView.samples, [
            'bronze_base', 'patina_green', 'patina_light', 'bronze_highlight', 'relief_recess', 'bronze_shadow'
        ]);
        assert.deepEqual(bronzeView.findings, ['bronzeTone', 'patinaMetal', 'patinaHierarchy', 'reliefDetail']);
        assert.deepEqual(bronzeView.findingLabels, ['铜色稳定', '铜绿与金属分离', '铜绿层次', '纹饰暗部']);
        assert.deepEqual(bronzeView.metrics, [
            'cct', 'duv', 'ra', 'r9', 'rf', 'rg',
            'meanDeltaE00', 'maxDeltaE00', 'patinaMetal', 'patinaHierarchy', 'reliefDetail'
        ]);
        assert.match(bronzeView.previewNote, /铜绿.*金属本色.*纹饰/);
        assert.match(bronzeView.modeDescription, /铜绿|纹饰|暗部/);
        assert.equal(bronzeView.targetIlluminance, 80);
        assert.equal(bronzeView.targetCct, 3200);
        assert.equal(bronzeView.source, 'assets/appearance/museum/bronze-vessel-cutout.png');
        assert.equal(bronzeView.canvasSource, bronzeView.source);
        assert.ok(bronzeView.lowLightMinRg >= 110);
        assert.ok(bronzeView.currentBlur <= 0.15, `bronze current preview blur too strong: ${bronzeView.currentBlur}`);
        assert.ok(bronzeView.optimizedBlur <= 0.15, `bronze optimized preview blur too strong: ${bronzeView.optimizedBlur}`);
        assert.equal(bronzeView.currentBackgroundMode, 'none');
        assert.equal(bronzeView.optimizedBackgroundMode, 'none');
        assert.equal(await page.$('#museum-mask-inspector'), null);

        const bronzeRenderToken = await page.$eval('#museum-optimized-preview', canvas => canvas.dataset.rendered);
        await page.evaluate(() => {
            const wavelengths = window.CIE_COLOUR_QUALITY_DATA.wavelengths;
            const spd = window.SpectralMath.blackbodySpd(3200, wavelengths);
            const evaluation = window.MuseumOptimizer.evaluateExhibit(spd, {
                cct: 3200,
                exhibitId: 'bronze_food_vessel',
                quality: { ra: 94, r9: 88, rf: 90, rg: 112 },
                duv: 0
            });
            const beforeEvaluation = Object.assign({}, evaluation, {
                anchor: Object.assign({}, evaluation.anchor, { deltaE00: 1.66 }),
                white: Object.assign({}, evaluation.white, { deltaE00: 1.66 })
            });
            const afterEvaluation = Object.assign({}, evaluation, {
                anchor: Object.assign({}, evaluation.anchor, { deltaE00: 1.94 }),
                white: Object.assign({}, evaluation.white, { deltaE00: 1.94 })
            });
            document.dispatchEvent(new CustomEvent('spectral-museum-optimization-result', {
                detail: {
                    optimizationDomain: 'museum',
                    exhibitId: 'bronze_food_vessel',
                    applied: true,
                    beforeEvaluation,
                    afterEvaluation,
                    message: '青铜器可见差异测试'
                }
            }));
        });
        await page.waitForFunction(previous => {
            const canvas = document.getElementById('museum-optimized-preview');
            return canvas?.dataset.rendered && canvas.dataset.rendered !== previous;
        }, {}, bronzeRenderToken);
        const bronzeDifference = await page.evaluate(() => {
            const current = document.getElementById('museum-current-preview');
            const optimized = document.getElementById('museum-optimized-preview');
            const currentPixels = current.getContext('2d').getImageData(0, 0, current.width, current.height).data;
            const optimizedPixels = optimized.getContext('2d').getImageData(0, 0, optimized.width, optimized.height).data;
            let difference = 0;
            let changedPixels = 0;
            let currentLuminance = 0;
            let optimizedLuminance = 0;
            let count = 0;
            for (let index = 0; index < currentPixels.length; index += 4) {
                const cr = currentPixels[index];
                const cg = currentPixels[index + 1];
                const cb = currentPixels[index + 2];
                const or = optimizedPixels[index];
                const og = optimizedPixels[index + 1];
                const ob = optimizedPixels[index + 2];
                if (Math.hypot(cr - 23, cg - 25, cb - 29) < 10 && Math.hypot(or - 23, og - 25, ob - 29) < 10) continue;
                const pixelDifference = (Math.abs(or - cr) + Math.abs(og - cg) + Math.abs(ob - cb)) / 3;
                difference += pixelDifference;
                if (pixelDifference >= 3) changedPixels += 1;
                currentLuminance += cr * 0.2126 + cg * 0.7152 + cb * 0.0722;
                optimizedLuminance += or * 0.2126 + og * 0.7152 + ob * 0.0722;
                count += 1;
            }
            return {
                meanRgbDifference: difference / Math.max(1, count),
                changedPixelShare: changedPixels / Math.max(1, count),
                currentMeanLuminance: currentLuminance / Math.max(1, count),
                optimizedMeanLuminance: optimizedLuminance / Math.max(1, count)
            };
        });
        assert.ok(bronzeDifference.meanRgbDifference >= 3,
            `bronze comparison must show visible patina and relief separation: ${JSON.stringify(bronzeDifference)}`);
        assert.ok(bronzeDifference.changedPixelShare >= 0.3,
            `bronze comparison must visibly change enough exhibit pixels: ${JSON.stringify(bronzeDifference)}`);
        assert.ok(Math.abs(bronzeDifference.optimizedMeanLuminance - bronzeDifference.currentMeanLuminance) /
            bronzeDifference.currentMeanLuminance <= 0.03,
            `bronze comparison must keep comparable display brightness: ${JSON.stringify(bronzeDifference)}`);
        assert.equal(await page.$eval(
            '#museum-visual-findings [data-museum-finding="bronzeTone"] strong',
            element => element.textContent.trim()
        ), '基本保持');

        await page.select('#museum-exhibit', 'qingbai_jade_carving');
        await page.waitForFunction(() => document.getElementById('museum-panel-title')?.textContent.includes('青白玉雕件'));
        await page.waitForFunction(() => document.querySelectorAll('#museum-sample-selector [data-museum-sample-id]').length === 6);
        await page.waitForFunction(() => document.getElementById('museum-current-preview')?.dataset.exhibitId === 'qingbai_jade_carving',
            { timeout: 30000 });
        const jadeView = await page.evaluate(() => ({
            selectedExhibit: document.getElementById('museum-exhibit')?.value,
            samples: [...document.querySelectorAll('#museum-sample-selector [data-museum-sample-id]')]
                .map(element => element.dataset.museumSampleId),
            findings: [...document.querySelectorAll('#museum-visual-findings [data-museum-finding]')]
                .map(element => element.dataset.museumFinding),
            findingLabels: [...document.querySelectorAll('#museum-visual-findings [data-museum-finding] span')]
                .map(element => element.textContent.trim()),
            source: window.MuseumLightData.getExhibit('qingbai_jade_carving')?.appearanceSource?.file || '',
            canvasSource: document.getElementById('museum-current-preview')?.dataset.appearanceSource || '',
            backgroundMode: document.getElementById('museum-current-preview')?.dataset.backgroundMode || '',
            removedPixels: Number(document.getElementById('museum-current-preview')?.dataset.backgroundRemovedPixels),
            targetIlluminance: Number(document.getElementById('museum-target-illuminance')?.value),
            targetCct: Number(document.getElementById('museum-target-cct')?.value),
            lowLightMinRg: window.MuseumLightData.resolveModeSettings(
                'low-light-recognition', 'recommended', 'qingbai_jade_carving'
            ).minRg
        }));
        assert.equal(jadeView.selectedExhibit, 'qingbai_jade_carving');
        assert.deepEqual(jadeView.samples, [
            'jade_body', 'jade_milky_light', 'jade_green_transition',
            'jade_translucent_edge', 'jade_polished_highlight', 'jade_carved_recess'
        ]);
        assert.deepEqual(jadeView.findings, ['jadeTone', 'jadeLayers', 'jadeTranslucency', 'jadeCarving']);
        assert.deepEqual(jadeView.findingLabels, ['玉色稳定', '青白层次', '通透感', '雕纹细节']);
        assert.equal(jadeView.source, 'assets/appearance/museum/qingbai-jade-carving-cutout.png');
        assert.equal(jadeView.canvasSource, jadeView.source);
        assert.equal(jadeView.backgroundMode, 'none');
        assert.equal(jadeView.removedPixels, 0);
        assert.equal(jadeView.targetIlluminance, 60);
        assert.equal(jadeView.targetCct, 3500);
        assert.ok(jadeView.lowLightMinRg >= 110);

        const jadeRenderToken = await page.$eval('#museum-optimized-preview', canvas => canvas.dataset.rendered);
        await page.evaluate(() => {
            const wavelengths = window.CIE_COLOUR_QUALITY_DATA.wavelengths;
            const spd = window.SpectralMath.blackbodySpd(3500, wavelengths);
            const evaluation = window.MuseumOptimizer.evaluateExhibit(spd, {
                cct: 3500,
                exhibitId: 'qingbai_jade_carving',
                quality: { ra: 94, r9: 86, rf: 90, rg: 112 },
                duv: 0
            });
            document.dispatchEvent(new CustomEvent('spectral-museum-optimization-result', {
                detail: {
                    optimizationDomain: 'museum',
                    exhibitId: 'qingbai_jade_carving',
                    applied: true,
                    beforeEvaluation: evaluation,
                    afterEvaluation: evaluation,
                    message: '青白玉可见差异测试'
                }
            }));
        });
        await page.waitForFunction(previous => {
            const canvas = document.getElementById('museum-optimized-preview');
            return canvas?.dataset.rendered && canvas.dataset.rendered !== previous;
        }, {}, jadeRenderToken);
        const jadeDifference = await page.evaluate(() => {
            const current = document.getElementById('museum-current-preview');
            const optimized = document.getElementById('museum-optimized-preview');
            const currentPixels = current.getContext('2d').getImageData(0, 0, current.width, current.height).data;
            const optimizedPixels = optimized.getContext('2d').getImageData(0, 0, optimized.width, optimized.height).data;
            let difference = 0;
            let changedPixels = 0;
            let currentLuminance = 0;
            let optimizedLuminance = 0;
            let count = 0;
            for (let index = 0; index < currentPixels.length; index += 4) {
                const cr = currentPixels[index];
                const cg = currentPixels[index + 1];
                const cb = currentPixels[index + 2];
                const or = optimizedPixels[index];
                const og = optimizedPixels[index + 1];
                const ob = optimizedPixels[index + 2];
                if (Math.hypot(cr - 23, cg - 25, cb - 29) < 10 && Math.hypot(or - 23, og - 25, ob - 29) < 10) continue;
                const pixelDifference = (Math.abs(or - cr) + Math.abs(og - cg) + Math.abs(ob - cb)) / 3;
                difference += pixelDifference;
                if (pixelDifference >= 3) changedPixels += 1;
                currentLuminance += cr * 0.2126 + cg * 0.7152 + cb * 0.0722;
                optimizedLuminance += or * 0.2126 + og * 0.7152 + ob * 0.0722;
                count += 1;
            }
            return {
                meanRgbDifference: difference / Math.max(1, count),
                changedPixelShare: changedPixels / Math.max(1, count),
                currentMeanLuminance: currentLuminance / Math.max(1, count),
                optimizedMeanLuminance: optimizedLuminance / Math.max(1, count),
                currentAnchor: Number(current.dataset.luminanceFinal),
                optimizedAnchor: Number(optimized.dataset.luminanceFinal)
            };
        });
        assert.ok(jadeDifference.meanRgbDifference >= 2.8,
            `jade comparison must show visible qingbai, translucent-edge and carving separation: ${JSON.stringify(jadeDifference)}`);
        assert.ok(jadeDifference.changedPixelShare >= 0.25,
            `jade comparison must visibly change enough exhibit pixels: ${JSON.stringify(jadeDifference)}`);
        assert.ok(Math.abs(jadeDifference.optimizedMeanLuminance - jadeDifference.currentMeanLuminance) /
            jadeDifference.currentMeanLuminance <= 0.04,
            `jade comparison must keep comparable display brightness: ${JSON.stringify(jadeDifference)}`);
        assert.ok(Math.abs(jadeDifference.optimizedAnchor - jadeDifference.currentAnchor) <= 1,
            `jade body luminance must remain locked: ${JSON.stringify(jadeDifference)}`);

        await page.select('#museum-exhibit', 'black_lacquer_gold_writing_box');
        await page.waitForFunction(() => document.getElementById('museum-panel-title')?.textContent.includes('黑漆金银莳绘砚箱'));
        await page.waitForFunction(() => document.querySelectorAll('#museum-sample-selector [data-museum-sample-id]').length === 6);
        await page.waitForFunction(() => document.getElementById('museum-current-preview')?.dataset.exhibitId === 'black_lacquer_gold_writing_box',
            { timeout: 30000 });
        const lacquerView = await page.evaluate(() => ({
            selectedExhibit: document.getElementById('museum-exhibit')?.value,
            samples: [...document.querySelectorAll('#museum-sample-selector [data-museum-sample-id]')]
                .map(element => element.dataset.museumSampleId),
            findings: [...document.querySelectorAll('#museum-visual-findings [data-museum-finding]')]
                .map(element => element.dataset.museumFinding),
            findingLabels: [...document.querySelectorAll('#museum-visual-findings [data-museum-finding] span')]
                .map(element => element.textContent.trim()),
            source: window.MuseumLightData.getExhibit('black_lacquer_gold_writing_box')?.appearanceSource?.file || '',
            canvasSource: document.getElementById('museum-current-preview')?.dataset.appearanceSource || '',
            backgroundMode: document.getElementById('museum-current-preview')?.dataset.backgroundMode || '',
            removedPixels: Number(document.getElementById('museum-current-preview')?.dataset.backgroundRemovedPixels),
            targetIlluminance: Number(document.getElementById('museum-target-illuminance')?.value),
            targetCct: Number(document.getElementById('museum-target-cct')?.value),
            lowLightMinRg: window.MuseumLightData.resolveModeSettings(
                'low-light-recognition', 'recommended', 'black_lacquer_gold_writing_box'
            ).minRg,
            classifierAvailable: typeof window.MuseumPanel.classifySampleForRgb === 'function',
            classifications: typeof window.MuseumPanel.classifySampleForRgb === 'function' ? {
                blackBody: window.MuseumPanel.classifySampleForRgb('black_lacquer_gold_writing_box', 38, 31, 24),
                deepBlack: window.MuseumPanel.classifySampleForRgb('black_lacquer_gold_writing_box', 12, 12, 11),
                brightGold: window.MuseumPanel.classifySampleForRgb('black_lacquer_gold_writing_box', 190, 145, 55),
                agedGold: window.MuseumPanel.classifySampleForRgb('black_lacquer_gold_writing_box', 118, 84, 42),
                vermilion: window.MuseumPanel.classifySampleForRgb('black_lacquer_gold_writing_box', 178, 58, 36),
                surfaceDetail: window.MuseumPanel.classifySampleForRgb('black_lacquer_gold_writing_box', 148, 142, 136)
            } : {}
        }));
        assert.equal(lacquerView.selectedExhibit, 'black_lacquer_gold_writing_box');
        assert.deepEqual(lacquerView.samples, [
            'lacquer_black_body', 'lacquer_deep_black', 'maki_gold_bright',
            'maki_gold_aged', 'lacquer_vermilion', 'lacquer_surface_detail'
        ]);
        assert.deepEqual(lacquerView.findings, ['lacquerTone', 'goldBlack', 'goldHierarchy', 'lacquerDetail']);
        assert.deepEqual(lacquerView.findingLabels, ['漆色稳定', '金黑分离', '金色层次', '纹饰细节']);
        assert.equal(lacquerView.source, 'assets/appearance/museum/black-lacquer-gold-writing-box-cutout.png');
        assert.equal(lacquerView.canvasSource, lacquerView.source);
        assert.equal(lacquerView.backgroundMode, 'none');
        assert.equal(lacquerView.removedPixels, 0);
        assert.equal(lacquerView.targetIlluminance, 50);
        assert.equal(lacquerView.targetCct, 3000);
        assert.ok(lacquerView.lowLightMinRg >= 110);
        assert.equal(lacquerView.classifierAvailable, true);
        assert.deepEqual(lacquerView.classifications, {
            blackBody: 'lacquer_black_body',
            deepBlack: 'lacquer_deep_black',
            brightGold: 'maki_gold_bright',
            agedGold: 'maki_gold_aged',
            vermilion: 'lacquer_vermilion',
            surfaceDetail: 'lacquer_surface_detail'
        });

        const lacquerRenderToken = await page.$eval('#museum-optimized-preview', canvas => canvas.dataset.rendered);
        await page.evaluate(() => {
            const wavelengths = window.CIE_COLOUR_QUALITY_DATA.wavelengths;
            const spd = window.SpectralMath.blackbodySpd(3000, wavelengths);
            const evaluation = window.MuseumOptimizer.evaluateExhibit(spd, {
                cct: 3000,
                exhibitId: 'black_lacquer_gold_writing_box',
                quality: { ra: 93, r9: 84, rf: 88, rg: 112 },
                duv: 0
            });
            document.dispatchEvent(new CustomEvent('spectral-museum-optimization-result', {
                detail: {
                    optimizationDomain: 'museum',
                    exhibitId: 'black_lacquer_gold_writing_box',
                    applied: true,
                    beforeEvaluation: evaluation,
                    afterEvaluation: evaluation,
                    message: '黑漆描金可见差异测试'
                }
            }));
        });
        await page.waitForFunction(previous => {
            const canvas = document.getElementById('museum-optimized-preview');
            return canvas?.dataset.rendered && canvas.dataset.rendered !== previous;
        }, {}, lacquerRenderToken);
        const lacquerDifference = await page.evaluate(() => {
            const current = document.getElementById('museum-current-preview');
            const optimized = document.getElementById('museum-optimized-preview');
            const currentPixels = current.getContext('2d').getImageData(0, 0, current.width, current.height).data;
            const optimizedPixels = optimized.getContext('2d').getImageData(0, 0, optimized.width, optimized.height).data;
            let difference = 0;
            let changedPixels = 0;
            let currentLuminance = 0;
            let optimizedLuminance = 0;
            let count = 0;
            for (let index = 0; index < currentPixels.length; index += 4) {
                const cr = currentPixels[index];
                const cg = currentPixels[index + 1];
                const cb = currentPixels[index + 2];
                const or = optimizedPixels[index];
                const og = optimizedPixels[index + 1];
                const ob = optimizedPixels[index + 2];
                if (Math.hypot(cr - 23, cg - 25, cb - 29) < 7 && Math.hypot(or - 23, og - 25, ob - 29) < 7) continue;
                const pixelDifference = (Math.abs(or - cr) + Math.abs(og - cg) + Math.abs(ob - cb)) / 3;
                difference += pixelDifference;
                if (pixelDifference >= 3) changedPixels += 1;
                currentLuminance += cr * 0.2126 + cg * 0.7152 + cb * 0.0722;
                optimizedLuminance += or * 0.2126 + og * 0.7152 + ob * 0.0722;
                count += 1;
            }
            return {
                meanRgbDifference: difference / Math.max(1, count),
                changedPixelShare: changedPixels / Math.max(1, count),
                currentMeanLuminance: currentLuminance / Math.max(1, count),
                optimizedMeanLuminance: optimizedLuminance / Math.max(1, count),
                currentAnchor: Number(current.dataset.luminanceFinal),
                optimizedAnchor: Number(optimized.dataset.luminanceFinal)
            };
        });
        assert.ok(lacquerDifference.meanRgbDifference >= 2.8,
            `lacquer comparison must show visible gold-black, aged-gold and surface-detail separation: ${JSON.stringify(lacquerDifference)}`);
        assert.ok(lacquerDifference.changedPixelShare >= 0.25,
            `lacquer comparison must visibly change enough exhibit pixels: ${JSON.stringify(lacquerDifference)}`);
        assert.ok(Math.abs(lacquerDifference.optimizedMeanLuminance - lacquerDifference.currentMeanLuminance) /
            lacquerDifference.currentMeanLuminance <= 0.04,
            `lacquer comparison must keep comparable display brightness: ${JSON.stringify(lacquerDifference)}`);
        assert.ok(Math.abs(lacquerDifference.optimizedAnchor - lacquerDifference.currentAnchor) <= 1,
            `black lacquer body luminance must remain locked: ${JSON.stringify(lacquerDifference)}`);

        await page.select('#museum-mode', 'low-light-recognition');
        await page.select('#museum-strength', 'strong');
        await page.evaluate(() => {
            window.__lacquerOptimizationResult = null;
            document.addEventListener('spectral-museum-optimization-result', event => {
                if (event.detail?.exhibitId === 'black_lacquer_gold_writing_box') {
                    window.__lacquerOptimizationResult = event.detail;
                }
            }, { once: true });
        });
        await page.click('#museum-optimize-button');
        await page.waitForFunction(() => Boolean(window.__lacquerOptimizationResult), { timeout: 90000 });
        await page.waitForFunction(() => document.getElementById('museum-optimize-button')?.disabled === false, { timeout: 90000 });
        const lacquerOptimization = await page.evaluate(() => {
            const detail = window.__lacquerOptimizationResult;
            const limits = window.MuseumLightData.resolveModeSettings(
                'low-light-recognition', 'strong', 'black_lacquer_gold_writing_box'
            );
            return {
                applied: detail.applied,
                rf: detail.afterEvaluation?.quality?.rf,
                rg: detail.afterEvaluation?.quality?.rg,
                cct: detail.afterEvaluation?.cct,
                duv: detail.afterEvaluation?.duv,
                minRf: limits.minRf,
                minRg: limits.minRg,
                maxRg: limits.maxRg,
                findings: [...document.querySelectorAll('#museum-visual-findings [data-museum-finding] strong')]
                    .map(element => element.textContent.trim())
            };
        });
        assert.equal(lacquerOptimization.applied, true);
        assert.ok(lacquerOptimization.rf >= lacquerOptimization.minRf,
            `lacquer recipe must satisfy configured Rf minimum: ${JSON.stringify(lacquerOptimization)}`);
        assert.ok(lacquerOptimization.rg >= lacquerOptimization.minRg && lacquerOptimization.rg <= lacquerOptimization.maxRg,
            `lacquer recipe must satisfy configured Rg range: ${JSON.stringify(lacquerOptimization)}`);
        assert.ok(Math.abs(lacquerOptimization.cct - 3000) <= 80,
            `lacquer recipe must stay near target CCT: ${JSON.stringify(lacquerOptimization)}`);
        assert.ok(lacquerOptimization.duv >= -0.001 && lacquerOptimization.duv <= 0.001,
            `lacquer recipe must stay inside Duv range: ${JSON.stringify(lacquerOptimization)}`);
        assert.ok(lacquerOptimization.findings.every(value => value && value !== '等待优化'));

        await page.select('#museum-exhibit', 'embroidered_birds_flowers_panel');
        await page.waitForFunction(() => document.getElementById('museum-panel-title')?.textContent.includes('花鸟刺绣挂屏'));
        await page.waitForFunction(() => document.querySelectorAll('#museum-sample-selector [data-museum-sample-id]').length === 6);
        await page.waitForFunction(() => document.getElementById('museum-current-preview')?.dataset.exhibitId === 'embroidered_birds_flowers_panel',
            { timeout: 30000 });
        const textileView = await page.evaluate(() => ({
            selectedExhibit: document.getElementById('museum-exhibit')?.value,
            samples: [...document.querySelectorAll('#museum-sample-selector [data-museum-sample-id]')]
                .map(element => element.dataset.museumSampleId),
            findings: [...document.querySelectorAll('#museum-visual-findings [data-museum-finding]')]
                .map(element => element.dataset.museumFinding),
            findingLabels: [...document.querySelectorAll('#museum-visual-findings [data-museum-finding] span')]
                .map(element => element.textContent.trim()),
            source: window.MuseumLightData.getExhibit('embroidered_birds_flowers_panel')?.appearanceSource?.file || '',
            canvasSource: document.getElementById('museum-current-preview')?.dataset.appearanceSource || '',
            backgroundMode: document.getElementById('museum-current-preview')?.dataset.backgroundMode || '',
            removedPixels: Number(document.getElementById('museum-current-preview')?.dataset.backgroundRemovedPixels),
            targetIlluminance: Number(document.getElementById('museum-target-illuminance')?.value),
            targetCct: Number(document.getElementById('museum-target-cct')?.value),
            lowLightMinRg: window.MuseumLightData.resolveModeSettings(
                'low-light-recognition', 'recommended', 'embroidered_birds_flowers_panel'
            ).minRg,
            classifierAvailable: typeof window.MuseumPanel.classifySampleForRgb === 'function',
            classifications: typeof window.MuseumPanel.classifySampleForRgb === 'function' ? {
                ground: window.MuseumPanel.classifySampleForRgb('embroidered_birds_flowers_panel', 192, 160, 112),
                redPink: window.MuseumPanel.classifySampleForRgb('embroidered_birds_flowers_panel', 190, 92, 88),
                blueGreen: window.MuseumPanel.classifySampleForRgb('embroidered_birds_flowers_panel', 68, 92, 106),
                golden: window.MuseumPanel.classifySampleForRgb('embroidered_birds_flowers_panel', 188, 145, 72),
                dark: window.MuseumPanel.classifySampleForRgb('embroidered_birds_flowers_panel', 42, 43, 35),
                highlight: window.MuseumPanel.classifySampleForRgb('embroidered_birds_flowers_panel', 205, 188, 160)
            } : {}
        }));
        assert.equal(textileView.selectedExhibit, 'embroidered_birds_flowers_panel');
        assert.deepEqual(textileView.samples, [
            'textile_ground_warm', 'textile_red_pink', 'textile_blue_green',
            'textile_golden_thread', 'textile_dark_thread', 'textile_stitch_highlight'
        ]);
        assert.deepEqual(textileView.findings, ['textileTone', 'textileColourSeparation', 'threadHierarchy', 'stitchDetail']);
        assert.deepEqual(textileView.findingLabels, ['织物底色', '综合色彩分离', '丝线层次', '针脚细节']);
        assert.equal(textileView.source, 'assets/appearance/museum/embroidered-birds-flowers-panel-cutout.png');
        assert.equal(textileView.canvasSource, textileView.source);
        assert.equal(textileView.backgroundMode, 'none');
        assert.equal(textileView.removedPixels, 0);
        assert.equal(textileView.targetIlluminance, 50);
        assert.equal(textileView.targetCct, 3500);
        assert.ok(textileView.lowLightMinRg >= 110);
        assert.equal(textileView.classifierAvailable, true);
        assert.deepEqual(textileView.classifications, {
            ground: 'textile_ground_warm',
            redPink: 'textile_red_pink',
            blueGreen: 'textile_blue_green',
            golden: 'textile_golden_thread',
            dark: 'textile_dark_thread',
            highlight: 'textile_stitch_highlight'
        });

        const textileRenderToken = await page.$eval('#museum-optimized-preview', canvas => canvas.dataset.rendered);
        await page.evaluate(() => {
            const wavelengths = window.CIE_COLOUR_QUALITY_DATA.wavelengths;
            const spd = window.SpectralMath.blackbodySpd(3500, wavelengths);
            const evaluation = window.MuseumOptimizer.evaluateExhibit(spd, {
                cct: 3500,
                exhibitId: 'embroidered_birds_flowers_panel',
                quality: { ra: 93, r9: 88, rf: 88, rg: 112 },
                duv: 0
            });
            document.dispatchEvent(new CustomEvent('spectral-museum-optimization-result', {
                detail: {
                    optimizationDomain: 'museum',
                    exhibitId: 'embroidered_birds_flowers_panel',
                    applied: true,
                    beforeEvaluation: evaluation,
                    afterEvaluation: evaluation,
                    message: '花鸟刺绣可见差异测试'
                }
            }));
        });
        await page.waitForFunction(previous => {
            const canvas = document.getElementById('museum-optimized-preview');
            return canvas?.dataset.rendered && canvas.dataset.rendered !== previous;
        }, {}, textileRenderToken);
        const textileDifference = await page.evaluate(() => {
            const current = document.getElementById('museum-current-preview');
            const optimized = document.getElementById('museum-optimized-preview');
            const currentPixels = current.getContext('2d').getImageData(0, 0, current.width, current.height).data;
            const optimizedPixels = optimized.getContext('2d').getImageData(0, 0, optimized.width, optimized.height).data;
            let difference = 0;
            let changedPixels = 0;
            let currentLuminance = 0;
            let optimizedLuminance = 0;
            let count = 0;
            for (let index = 0; index < currentPixels.length; index += 4) {
                const cr = currentPixels[index];
                const cg = currentPixels[index + 1];
                const cb = currentPixels[index + 2];
                const or = optimizedPixels[index];
                const og = optimizedPixels[index + 1];
                const ob = optimizedPixels[index + 2];
                if (Math.hypot(cr - 23, cg - 25, cb - 29) < 7 && Math.hypot(or - 23, og - 25, ob - 29) < 7) continue;
                const pixelDifference = (Math.abs(or - cr) + Math.abs(og - cg) + Math.abs(ob - cb)) / 3;
                difference += pixelDifference;
                if (pixelDifference >= 3) changedPixels += 1;
                currentLuminance += cr * 0.2126 + cg * 0.7152 + cb * 0.0722;
                optimizedLuminance += or * 0.2126 + og * 0.7152 + ob * 0.0722;
                count += 1;
            }
            return {
                meanRgbDifference: difference / Math.max(1, count),
                changedPixelShare: changedPixels / Math.max(1, count),
                currentMeanLuminance: currentLuminance / Math.max(1, count),
                optimizedMeanLuminance: optimizedLuminance / Math.max(1, count),
                currentAnchor: Number(current.dataset.luminanceFinal),
                optimizedAnchor: Number(optimized.dataset.luminanceFinal)
            };
        });
        assert.ok(textileDifference.meanRgbDifference >= 2.5,
            `textile comparison must show visible colour, thread and stitch separation: ${JSON.stringify(textileDifference)}`);
        assert.ok(textileDifference.changedPixelShare >= 0.25,
            `textile comparison must visibly change enough exhibit pixels: ${JSON.stringify(textileDifference)}`);
        assert.ok(Math.abs(textileDifference.optimizedMeanLuminance - textileDifference.currentMeanLuminance) /
            textileDifference.currentMeanLuminance <= 0.04,
            `textile comparison must keep comparable display brightness: ${JSON.stringify(textileDifference)}`);
        assert.ok(Math.abs(textileDifference.optimizedAnchor - textileDifference.currentAnchor) <= 1,
            `textile ground luminance must remain locked: ${JSON.stringify(textileDifference)}`);

        await page.select('#museum-mode', 'low-light-recognition');
        await page.select('#museum-strength', 'strong');
        await page.evaluate(() => {
            window.__textileOptimizationResult = null;
            document.addEventListener('spectral-museum-optimization-result', event => {
                if (event.detail?.exhibitId === 'embroidered_birds_flowers_panel') {
                    window.__textileOptimizationResult = event.detail;
                }
            }, { once: true });
        });
        await page.click('#museum-optimize-button');
        await page.waitForFunction(() => Boolean(window.__textileOptimizationResult), { timeout: 90000 });
        await page.waitForFunction(() => document.getElementById('museum-optimize-button')?.disabled === false, { timeout: 90000 });
        const textileOptimization = await page.evaluate(() => {
            const detail = window.__textileOptimizationResult;
            const limits = window.MuseumLightData.resolveModeSettings(
                'low-light-recognition', 'strong', 'embroidered_birds_flowers_panel'
            );
            return {
                applied: detail.applied,
                rf: detail.afterEvaluation?.quality?.rf,
                rg: detail.afterEvaluation?.quality?.rg,
                cct: detail.afterEvaluation?.cct,
                duv: detail.afterEvaluation?.duv,
                minRf: limits.minRf,
                minRg: limits.minRg,
                maxRg: limits.maxRg,
                findings: [...document.querySelectorAll('#museum-visual-findings [data-museum-finding] strong')]
                    .map(element => element.textContent.trim())
            };
        });
        assert.equal(textileOptimization.applied, true);
        assert.ok(textileOptimization.rf >= textileOptimization.minRf,
            `textile recipe must satisfy configured Rf minimum: ${JSON.stringify(textileOptimization)}`);
        assert.ok(textileOptimization.rg >= textileOptimization.minRg && textileOptimization.rg <= textileOptimization.maxRg,
            `textile recipe must satisfy configured Rg range: ${JSON.stringify(textileOptimization)}`);
        assert.ok(Math.abs(textileOptimization.cct - 3500) <= 80,
            `textile recipe must stay near target CCT: ${JSON.stringify(textileOptimization)}`);
        assert.ok(textileOptimization.duv >= -0.001 && textileOptimization.duv <= 0.001,
            `textile recipe must stay inside Duv range: ${JSON.stringify(textileOptimization)}`);
        assert.ok(textileOptimization.findings.every(value => value && value !== '等待优化'));
        assert.equal(textileOptimization.findings[0], '基本保持',
            `textile ground colour should remain stable under the optimized recipe: ${JSON.stringify(textileOptimization)}`);

        await page.select('#museum-exhibit', 'qing_qianlong_cloisonne_floral_vase');
        await page.waitForFunction(() => document.getElementById('museum-panel-title')?.textContent.includes('清乾隆掐丝珐琅花卉纹瓶'));
        await page.waitForFunction(() => document.querySelectorAll('#museum-sample-selector [data-museum-sample-id]').length === 6);
        await page.waitForFunction(() => document.getElementById('museum-current-preview')?.dataset.exhibitId === 'qing_qianlong_cloisonne_floral_vase',
            { timeout: 30000 });
        const cloisonneView = await page.evaluate(() => ({
            selectedExhibit: document.getElementById('museum-exhibit')?.value,
            samples: [...document.querySelectorAll('#museum-sample-selector [data-museum-sample-id]')]
                .map(element => element.dataset.museumSampleId),
            findings: [...document.querySelectorAll('#museum-visual-findings [data-museum-finding]')]
                .map(element => element.dataset.museumFinding),
            findingLabels: [...document.querySelectorAll('#museum-visual-findings [data-museum-finding] span')]
                .map(element => element.textContent.trim()),
            source: window.MuseumLightData.getExhibit('qing_qianlong_cloisonne_floral_vase')?.appearanceSource?.file || '',
            canvasSource: document.getElementById('museum-current-preview')?.dataset.appearanceSource || '',
            backgroundMode: document.getElementById('museum-current-preview')?.dataset.backgroundMode || '',
            removedPixels: Number(document.getElementById('museum-current-preview')?.dataset.backgroundRemovedPixels),
            targetIlluminance: Number(document.getElementById('museum-target-illuminance')?.value),
            targetCct: Number(document.getElementById('museum-target-cct')?.value),
            lowLightMinRg: window.MuseumLightData.resolveModeSettings(
                'low-light-recognition', 'recommended', 'qing_qianlong_cloisonne_floral_vase'
            ).minRg,
            classifierAvailable: typeof window.MuseumPanel.classifySampleForRgb === 'function',
            classifications: typeof window.MuseumPanel.classifySampleForRgb === 'function' ? {
                ground: window.MuseumPanel.classifySampleForRgb('qing_qianlong_cloisonne_floral_vase', 190, 190, 180),
                cobalt: window.MuseumPanel.classifySampleForRgb('qing_qianlong_cloisonne_floral_vase', 48, 72, 138),
                blueGreen: window.MuseumPanel.classifySampleForRgb('qing_qianlong_cloisonne_floral_vase', 56, 112, 122),
                red: window.MuseumPanel.classifySampleForRgb('qing_qianlong_cloisonne_floral_vase', 182, 68, 58),
                yellow: window.MuseumPanel.classifySampleForRgb('qing_qianlong_cloisonne_floral_vase', 188, 154, 68),
                gilt: window.MuseumPanel.classifySampleForRgb('qing_qianlong_cloisonne_floral_vase', 214, 184, 118)
            } : {}
        }));
        assert.equal(cloisonneView.selectedExhibit, 'qing_qianlong_cloisonne_floral_vase');
        assert.deepEqual(cloisonneView.samples, [
            'cloisonne_ground_light', 'cloisonne_cobalt_blue', 'cloisonne_blue_green',
            'cloisonne_red', 'cloisonne_yellow', 'cloisonne_gilt_wire'
        ]);
        assert.deepEqual(cloisonneView.findings, [
            'cloisonneTone', 'cloisonneColourSeparation', 'cloisonneBlueGreen', 'cloisonneWireDetail'
        ]);
        assert.deepEqual(cloisonneView.findingLabels, ['珐琅底色稳定', '综合色彩分离', '蓝绿层次', '掐丝纹样细节']);
        assert.equal(cloisonneView.source, 'assets/appearance/museum/qing-qianlong-cloisonne-floral-vase-cutout.png');
        assert.equal(cloisonneView.canvasSource, cloisonneView.source);
        assert.equal(cloisonneView.backgroundMode, 'none');
        assert.equal(cloisonneView.removedPixels, 0);
        assert.equal(cloisonneView.targetIlluminance, 80);
        assert.equal(cloisonneView.targetCct, 3500);
        assert.ok(cloisonneView.lowLightMinRg >= 110);
        assert.equal(cloisonneView.classifierAvailable, true);
        assert.deepEqual(cloisonneView.classifications, {
            ground: 'cloisonne_ground_light',
            cobalt: 'cloisonne_cobalt_blue',
            blueGreen: 'cloisonne_blue_green',
            red: 'cloisonne_red',
            yellow: 'cloisonne_yellow',
            gilt: 'cloisonne_gilt_wire'
        });

        const cloisonneRenderToken = await page.$eval('#museum-optimized-preview', canvas => canvas.dataset.rendered);
        await page.evaluate(() => {
            const wavelengths = window.CIE_COLOUR_QUALITY_DATA.wavelengths;
            const spd = window.SpectralMath.blackbodySpd(3500, wavelengths);
            const evaluation = window.MuseumOptimizer.evaluateExhibit(spd, {
                cct: 3500,
                exhibitId: 'qing_qianlong_cloisonne_floral_vase',
                quality: { ra: 93, r9: 88, rf: 88, rg: 112 },
                duv: 0
            });
            document.dispatchEvent(new CustomEvent('spectral-museum-optimization-result', {
                detail: {
                    optimizationDomain: 'museum',
                    exhibitId: 'qing_qianlong_cloisonne_floral_vase',
                    applied: true,
                    beforeEvaluation: evaluation,
                    afterEvaluation: evaluation,
                    message: '掐丝珐琅可见差异测试'
                }
            }));
        });
        await page.waitForFunction(previous => {
            const canvas = document.getElementById('museum-optimized-preview');
            return canvas?.dataset.rendered && canvas.dataset.rendered !== previous;
        }, {}, cloisonneRenderToken);
        const cloisonneDifference = await page.evaluate(() => {
            const current = document.getElementById('museum-current-preview');
            const optimized = document.getElementById('museum-optimized-preview');
            const currentPixels = current.getContext('2d').getImageData(0, 0, current.width, current.height).data;
            const optimizedPixels = optimized.getContext('2d').getImageData(0, 0, optimized.width, optimized.height).data;
            let difference = 0;
            let changedPixels = 0;
            let currentLuminance = 0;
            let optimizedLuminance = 0;
            let count = 0;
            for (let index = 0; index < currentPixels.length; index += 4) {
                const cr = currentPixels[index];
                const cg = currentPixels[index + 1];
                const cb = currentPixels[index + 2];
                const or = optimizedPixels[index];
                const og = optimizedPixels[index + 1];
                const ob = optimizedPixels[index + 2];
                if (Math.hypot(cr - 23, cg - 25, cb - 29) < 7 && Math.hypot(or - 23, og - 25, ob - 29) < 7) continue;
                const pixelDifference = (Math.abs(or - cr) + Math.abs(og - cg) + Math.abs(ob - cb)) / 3;
                difference += pixelDifference;
                if (pixelDifference >= 3) changedPixels += 1;
                currentLuminance += cr * 0.2126 + cg * 0.7152 + cb * 0.0722;
                optimizedLuminance += or * 0.2126 + og * 0.7152 + ob * 0.0722;
                count += 1;
            }
            return {
                meanRgbDifference: difference / Math.max(1, count),
                changedPixelShare: changedPixels / Math.max(1, count),
                currentMeanLuminance: currentLuminance / Math.max(1, count),
                optimizedMeanLuminance: optimizedLuminance / Math.max(1, count),
                currentAnchor: Number(current.dataset.luminanceFinal),
                optimizedAnchor: Number(optimized.dataset.luminanceFinal)
            };
        });
        assert.ok(cloisonneDifference.meanRgbDifference >= 2.5,
            `cloisonne comparison must show visible enamel, blue-green and wire separation: ${JSON.stringify(cloisonneDifference)}`);
        assert.ok(cloisonneDifference.changedPixelShare >= 0.25,
            `cloisonne comparison must visibly change enough exhibit pixels: ${JSON.stringify(cloisonneDifference)}`);
        assert.ok(Math.abs(cloisonneDifference.optimizedMeanLuminance - cloisonneDifference.currentMeanLuminance) /
            cloisonneDifference.currentMeanLuminance <= 0.04,
            `cloisonne comparison must keep comparable display brightness: ${JSON.stringify(cloisonneDifference)}`);
        assert.ok(Math.abs(cloisonneDifference.optimizedAnchor - cloisonneDifference.currentAnchor) <= 1,
            `cloisonne ground luminance must remain locked: ${JSON.stringify(cloisonneDifference)}`);

        await page.select('#museum-mode', 'low-light-recognition');
        await page.select('#museum-strength', 'strong');
        await page.evaluate(() => {
            window.__cloisonneOptimizationResult = null;
            document.addEventListener('spectral-museum-optimization-result', event => {
                if (event.detail?.exhibitId === 'qing_qianlong_cloisonne_floral_vase') {
                    window.__cloisonneOptimizationResult = event.detail;
                }
            }, { once: true });
        });
        await page.click('#museum-optimize-button');
        await page.waitForFunction(() => Boolean(window.__cloisonneOptimizationResult), { timeout: 90000 });
        await page.waitForFunction(() => document.getElementById('museum-optimize-button')?.disabled === false, { timeout: 90000 });
        const cloisonneOptimization = await page.evaluate(() => {
            const detail = window.__cloisonneOptimizationResult;
            const limits = window.MuseumLightData.resolveModeSettings(
                'low-light-recognition', 'strong', 'qing_qianlong_cloisonne_floral_vase'
            );
            return {
                applied: detail.applied,
                rf: detail.afterEvaluation?.quality?.rf,
                rg: detail.afterEvaluation?.quality?.rg,
                cct: detail.afterEvaluation?.cct,
                duv: detail.afterEvaluation?.duv,
                minRf: limits.minRf,
                minRg: limits.minRg,
                maxRg: limits.maxRg,
                findings: [...document.querySelectorAll('#museum-visual-findings [data-museum-finding] strong')]
                    .map(element => element.textContent.trim())
            };
        });
        assert.equal(cloisonneOptimization.applied, true);
        assert.ok(cloisonneOptimization.rf >= cloisonneOptimization.minRf,
            `cloisonne recipe must satisfy configured Rf minimum: ${JSON.stringify(cloisonneOptimization)}`);
        assert.ok(cloisonneOptimization.rg >= cloisonneOptimization.minRg && cloisonneOptimization.rg <= cloisonneOptimization.maxRg,
            `cloisonne recipe must satisfy configured Rg range: ${JSON.stringify(cloisonneOptimization)}`);
        assert.ok(Math.abs(cloisonneOptimization.cct - 3500) <= 80,
            `cloisonne recipe must stay near target CCT: ${JSON.stringify(cloisonneOptimization)}`);
        assert.ok(cloisonneOptimization.duv >= -0.001 && cloisonneOptimization.duv <= 0.001,
            `cloisonne recipe must stay inside Duv range: ${JSON.stringify(cloisonneOptimization)}`);
        assert.ok(cloisonneOptimization.findings.every(value => value && value !== '等待优化'));

        await page.select('#museum-exhibit', 'northern_song_guanyin');
        await page.waitForFunction(() => document.getElementById('museum-panel-title')?.textContent.includes('北宋彩绘木雕观音菩萨像'));
        await page.waitForFunction(() => document.querySelectorAll('#museum-sample-selector [data-museum-sample-id]').length === 6);
        await page.waitForFunction(() => document.getElementById('museum-current-preview')?.dataset.exhibitId === 'northern_song_guanyin',
            { timeout: 30000 });
        const guanyinView = await page.evaluate(() => ({
            selectedExhibit: document.getElementById('museum-exhibit')?.value,
            samples: [...document.querySelectorAll('#museum-sample-selector [data-museum-sample-id]')]
                .map(element => element.dataset.museumSampleId),
            findings: [...document.querySelectorAll('#museum-visual-findings [data-museum-finding]')]
                .map(element => element.dataset.museumFinding),
            findingLabels: [...document.querySelectorAll('#museum-visual-findings [data-museum-finding] span')]
                .map(element => element.textContent.trim()),
            source: window.MuseumLightData.getExhibit('northern_song_guanyin')?.appearanceSource?.file || '',
            canvasSource: document.getElementById('museum-current-preview')?.dataset.appearanceSource || '',
            backgroundMode: document.getElementById('museum-current-preview')?.dataset.backgroundMode || '',
            removedPixels: Number(document.getElementById('museum-current-preview')?.dataset.backgroundRemovedPixels),
            targetIlluminance: Number(document.getElementById('museum-target-illuminance')?.value),
            targetCct: Number(document.getElementById('museum-target-cct')?.value),
            classifications: {
                skin: window.MuseumPanel.classifySampleForRgb('northern_song_guanyin', 168, 126, 92),
                warmRed: window.MuseumPanel.classifySampleForRgb('northern_song_guanyin', 166, 66, 48),
                gilt: window.MuseumPanel.classifySampleForRgb('northern_song_guanyin', 188, 145, 74),
                blueGreen: window.MuseumPanel.classifySampleForRgb('northern_song_guanyin', 67, 101, 104),
                darkWood: window.MuseumPanel.classifySampleForRgb('northern_song_guanyin', 39, 32, 24),
                quartz: window.MuseumPanel.classifySampleForRgb('northern_song_guanyin', 207, 198, 184)
            }
        }));
        assert.equal(guanyinView.selectedExhibit, 'northern_song_guanyin');
        assert.deepEqual(guanyinView.samples, [
            'guanyin_skin', 'guanyin_warm_red', 'guanyin_gilt',
            'guanyin_blue_green_pigment', 'guanyin_dark_wood_recess', 'guanyin_quartz_highlight'
        ]);
        assert.deepEqual(guanyinView.findings, [
            'guanyinSkinTone', 'guanyinSkinGilt', 'guanyinPaintGilt', 'guanyinFacialDrapery'
        ]);
        assert.deepEqual(guanyinView.findingLabels, ['肤色稳定', '肤色与金饰分离', '彩绘与金色层次', '五官与衣纹细节']);
        assert.equal(guanyinView.source, 'assets/appearance/museum/northern-song-guanyin-cutout.png');
        assert.equal(guanyinView.canvasSource, guanyinView.source);
        assert.equal(guanyinView.backgroundMode, 'none');
        assert.equal(guanyinView.removedPixels, 0);
        assert.equal(guanyinView.targetIlluminance, 50);
        assert.equal(guanyinView.targetCct, 3500);
        assert.deepEqual(guanyinView.classifications, {
            skin: 'guanyin_skin',
            warmRed: 'guanyin_warm_red',
            gilt: 'guanyin_gilt',
            blueGreen: 'guanyin_blue_green_pigment',
            darkWood: 'guanyin_dark_wood_recess',
            quartz: 'guanyin_quartz_highlight'
        });

        await page.select('#museum-mode', 'low-light-recognition');
        await page.select('#museum-strength', 'strong');
        await page.evaluate(() => {
            window.__guanyinOptimizationResult = null;
            document.addEventListener('spectral-museum-optimization-result', event => {
                if (event.detail?.exhibitId === 'northern_song_guanyin') {
                    window.__guanyinOptimizationResult = event.detail;
                }
            }, { once: true });
        });
        await page.click('#museum-optimize-button');
        await page.waitForFunction(() => Boolean(window.__guanyinOptimizationResult), { timeout: 90000 });
        await page.waitForFunction(() => document.getElementById('museum-optimize-button')?.disabled === false, { timeout: 90000 });
        const guanyinOptimization = await page.evaluate(() => {
            const detail = window.__guanyinOptimizationResult;
            const limits = window.MuseumLightData.resolveModeSettings(
                'low-light-recognition', 'strong', 'northern_song_guanyin'
            );
            const current = document.getElementById('museum-current-preview');
            const optimized = document.getElementById('museum-optimized-preview');
            const currentPixels = current.getContext('2d').getImageData(0, 0, current.width, current.height).data;
            const optimizedPixels = optimized.getContext('2d').getImageData(0, 0, optimized.width, optimized.height).data;
            let difference = 0;
            let changedPixels = 0;
            let currentLuminance = 0;
            let optimizedLuminance = 0;
            let count = 0;
            for (let index = 0; index < currentPixels.length; index += 4) {
                const cr = currentPixels[index];
                const cg = currentPixels[index + 1];
                const cb = currentPixels[index + 2];
                const or = optimizedPixels[index];
                const og = optimizedPixels[index + 1];
                const ob = optimizedPixels[index + 2];
                if (Math.hypot(cr - 23, cg - 25, cb - 29) < 7 && Math.hypot(or - 23, og - 25, ob - 29) < 7) continue;
                const pixelDifference = (Math.abs(or - cr) + Math.abs(og - cg) + Math.abs(ob - cb)) / 3;
                difference += pixelDifference;
                if (pixelDifference >= 3) changedPixels += 1;
                currentLuminance += cr * 0.2126 + cg * 0.7152 + cb * 0.0722;
                optimizedLuminance += or * 0.2126 + og * 0.7152 + ob * 0.0722;
                count += 1;
            }
            return {
                applied: detail.applied,
                rf: detail.afterEvaluation?.quality?.rf,
                rg: detail.afterEvaluation?.quality?.rg,
                cct: detail.afterEvaluation?.cct,
                duv: detail.afterEvaluation?.duv,
                anchorBefore: detail.beforeEvaluation?.anchor?.deltaE00,
                anchorAfter: detail.afterEvaluation?.anchor?.deltaE00,
                paintGiltGain: detail.afterEvaluation?.distinction?.guanyinPaintGilt?.gainRatio,
                paintGiltMinimumPair: Math.min(...(detail.afterEvaluation?.distinction?.guanyinPaintGilt?.candidatePairs || [0])),
                facialDraperyGain: detail.afterEvaluation?.distinction?.guanyinFacialDrapery?.gainRatio,
                minRf: limits.minRf,
                minRg: limits.minRg,
                maxRg: limits.maxRg,
                findings: [...document.querySelectorAll('#museum-visual-findings [data-museum-finding] strong')]
                    .map(element => element.textContent.trim()),
                meanRgbDifference: difference / Math.max(1, count),
                changedPixelShare: changedPixels / Math.max(1, count),
                currentMeanLuminance: currentLuminance / Math.max(1, count),
                optimizedMeanLuminance: optimizedLuminance / Math.max(1, count),
                currentAnchor: Number(current.dataset.luminanceFinal),
                optimizedAnchor: Number(optimized.dataset.luminanceFinal)
            };
        });
        assert.equal(guanyinOptimization.applied, true);
        assert.ok(guanyinOptimization.rf >= guanyinOptimization.minRf,
            `guanyin recipe must satisfy configured Rf minimum: ${JSON.stringify(guanyinOptimization)}`);
        assert.ok(guanyinOptimization.rg >= guanyinOptimization.minRg && guanyinOptimization.rg <= guanyinOptimization.maxRg,
            `guanyin recipe must satisfy configured Rg range: ${JSON.stringify(guanyinOptimization)}`);
        assert.ok(Math.abs(guanyinOptimization.cct - 3500) <= 80,
            `guanyin recipe must stay near target CCT: ${JSON.stringify(guanyinOptimization)}`);
        assert.ok(guanyinOptimization.duv >= -0.001 && guanyinOptimization.duv <= 0.001,
            `guanyin recipe must stay inside Duv range: ${JSON.stringify(guanyinOptimization)}`);
        assert.ok(guanyinOptimization.findings.every(value => value && value !== '等待优化'));
        assert.ok(guanyinOptimization.paintGiltGain >= 0,
            `guanyin painted colour and gilt hierarchy must not decline: ${JSON.stringify(guanyinOptimization)}`);
        assert.ok(guanyinOptimization.paintGiltMinimumPair >= 20,
            `guanyin minimum painted-colour separation must remain distinct: ${JSON.stringify(guanyinOptimization)}`);
        assert.ok(guanyinOptimization.facialDraperyGain >= -0.01,
            `guanyin facial and drapery detail must remain stable: ${JSON.stringify(guanyinOptimization)}`);
        assert.ok(guanyinOptimization.meanRgbDifference >= 2.3,
            `guanyin comparison must show visible skin, gilt, pigment and carving separation: ${JSON.stringify(guanyinOptimization)}`);
        assert.ok(guanyinOptimization.changedPixelShare >= 0.2,
            `guanyin comparison must visibly change enough exhibit pixels: ${JSON.stringify(guanyinOptimization)}`);
        assert.ok(Math.abs(guanyinOptimization.optimizedMeanLuminance - guanyinOptimization.currentMeanLuminance) /
            guanyinOptimization.currentMeanLuminance <= 0.04,
            `guanyin comparison must keep comparable display brightness: ${JSON.stringify(guanyinOptimization)}`);
        assert.ok(Math.abs(guanyinOptimization.optimizedAnchor - guanyinOptimization.currentAnchor) <= 1,
            `guanyin skin luminance must remain locked: ${JSON.stringify(guanyinOptimization)}`);

        await page.select('#museum-exhibit', 'roesen_still_life_flowers_fruit');
        await page.waitForFunction(() => document.getElementById('museum-panel-title')?.textContent.includes('花卉与水果静物油画'));
        await page.waitForFunction(() => document.querySelectorAll('#museum-sample-selector [data-museum-sample-id]').length === 6);
        await page.waitForFunction(() => document.getElementById('museum-current-preview')?.dataset.exhibitId === 'roesen_still_life_flowers_fruit',
            { timeout: 30000 });
        const oilView = await page.evaluate(() => ({
            selectedExhibit: document.getElementById('museum-exhibit')?.value,
            samples: [...document.querySelectorAll('#museum-sample-selector [data-museum-sample-id]')]
                .map(element => element.dataset.museumSampleId),
            findings: [...document.querySelectorAll('#museum-visual-findings [data-museum-finding]')]
                .map(element => element.dataset.museumFinding),
            findingLabels: [...document.querySelectorAll('#museum-visual-findings [data-museum-finding] span')]
                .map(element => element.textContent.trim()),
            source: window.MuseumLightData.getExhibit('roesen_still_life_flowers_fruit')?.appearanceSource?.file || '',
            canvasSource: document.getElementById('museum-current-preview')?.dataset.appearanceSource || '',
            backgroundMode: document.getElementById('museum-current-preview')?.dataset.backgroundMode || '',
            classifications: {
                light: window.MuseumPanel.classifySampleForRgb('roesen_still_life_flowers_fruit', 220, 210, 190),
                redOrange: window.MuseumPanel.classifySampleForRgb('roesen_still_life_flowers_fruit', 170, 70, 45),
                yellowGold: window.MuseumPanel.classifySampleForRgb('roesen_still_life_flowers_fruit', 195, 150, 55),
                green: window.MuseumPanel.classifySampleForRgb('roesen_still_life_flowers_fruit', 70, 105, 55),
                blueViolet: window.MuseumPanel.classifySampleForRgb('roesen_still_life_flowers_fruit', 80, 65, 120),
                dark: window.MuseumPanel.classifySampleForRgb('roesen_still_life_flowers_fruit', 30, 25, 20),
                mutedWarm: window.MuseumPanel.classifySampleForRgb('roesen_still_life_flowers_fruit', 104, 72, 40),
                mutedGold: window.MuseumPanel.classifySampleForRgb('roesen_still_life_flowers_fruit', 96, 80, 40),
                mutedGreen: window.MuseumPanel.classifySampleForRgb('roesen_still_life_flowers_fruit', 56, 64, 40),
                mutedBlue: window.MuseumPanel.classifySampleForRgb('roesen_still_life_flowers_fruit', 64, 56, 72)
            }
        }));
        assert.equal(oilView.selectedExhibit, 'roesen_still_life_flowers_fruit');
        assert.deepEqual(oilView.samples, [
            'oil_light_petals', 'oil_red_orange', 'oil_yellow_gold',
            'oil_green_foliage', 'oil_blue_violet', 'oil_dark_background'
        ]);
        assert.deepEqual(oilView.findings, [
            'oilTone', 'oilFruitSeparation', 'oilColourHierarchy', 'oilDarkDetail'
        ]);
        assert.deepEqual(oilView.findingLabels, ['浅色综合色调稳定', '红黄水果分离', '花叶综合色彩层次', '暗部与细节辨识']);
        assert.equal(oilView.source, 'assets/appearance/museum/roesen-still-life-flowers-fruit.svg');
        assert.equal(oilView.canvasSource, oilView.source);
        assert.equal(oilView.backgroundMode, 'none');
        assert.deepEqual(oilView.classifications, {
            light: 'oil_light_petals',
            redOrange: 'oil_red_orange',
            yellowGold: 'oil_yellow_gold',
            green: 'oil_green_foliage',
            blueViolet: 'oil_blue_violet',
            dark: 'oil_dark_background',
            mutedWarm: 'oil_red_orange',
            mutedGold: 'oil_yellow_gold',
            mutedGreen: 'oil_green_foliage',
            mutedBlue: 'oil_blue_violet'
        });

        await page.select('#museum-mode', 'low-light-recognition');
        await page.select('#museum-strength', 'strong');
        await page.evaluate(() => {
            window.__oilOptimizationResult = null;
            document.addEventListener('spectral-museum-optimization-result', event => {
                if (event.detail?.exhibitId === 'roesen_still_life_flowers_fruit') {
                    window.__oilOptimizationResult = event.detail;
                }
            }, { once: true });
        });
        await page.click('#museum-optimize-button');
        await page.waitForFunction(() => Boolean(window.__oilOptimizationResult), { timeout: 90000 });
        await page.waitForFunction(() => document.getElementById('museum-optimize-button')?.disabled === false, { timeout: 90000 });
        const oilOptimization = await page.evaluate(() => {
            const detail = window.__oilOptimizationResult;
            const limits = window.MuseumLightData.resolveModeSettings(
                'low-light-recognition', 'strong', 'roesen_still_life_flowers_fruit'
            );
            const current = document.getElementById('museum-current-preview');
            const optimized = document.getElementById('museum-optimized-preview');
            const currentPixels = current.getContext('2d').getImageData(0, 0, current.width, current.height).data;
            const optimizedPixels = optimized.getContext('2d').getImageData(0, 0, optimized.width, optimized.height).data;
            let difference = 0;
            let changedPixels = 0;
            let currentLuminance = 0;
            let optimizedLuminance = 0;
            let count = 0;
            const classificationCounts = {};
            for (let index = 0; index < currentPixels.length; index += 4) {
                const cr = currentPixels[index];
                const cg = currentPixels[index + 1];
                const cb = currentPixels[index + 2];
                const or = optimizedPixels[index];
                const og = optimizedPixels[index + 1];
                const ob = optimizedPixels[index + 2];
                if (currentPixels[index + 3] <= 8 && optimizedPixels[index + 3] <= 8) continue;
                if (Math.hypot(cr - 23, cg - 25, cb - 29) < 7 && Math.hypot(or - 23, og - 25, ob - 29) < 7) continue;
                const sampleId = window.MuseumPanel.classifySampleForRgb('roesen_still_life_flowers_fruit', cr, cg, cb);
                classificationCounts[sampleId] = (classificationCounts[sampleId] || 0) + 1;
                const pixelDifference = (Math.abs(or - cr) + Math.abs(og - cg) + Math.abs(ob - cb)) / 3;
                difference += pixelDifference;
                if (pixelDifference >= 3) changedPixels += 1;
                currentLuminance += cr * 0.2126 + cg * 0.7152 + cb * 0.0722;
                optimizedLuminance += or * 0.2126 + og * 0.7152 + ob * 0.0722;
                count += 1;
            }
            return {
                applied: detail.applied,
                rf: detail.afterEvaluation?.quality?.rf,
                rg: detail.afterEvaluation?.quality?.rg,
                ra: detail.afterEvaluation?.quality?.ra,
                r9: detail.afterEvaluation?.quality?.r9,
                cct: detail.afterEvaluation?.cct,
                duv: detail.afterEvaluation?.duv,
                anchorBefore: detail.beforeEvaluation?.anchor?.deltaE00,
                anchorAfter: detail.afterEvaluation?.anchor?.deltaE00,
                fruitGain: detail.afterEvaluation?.distinction?.oilFruitSeparation?.gainRatio,
                colourGain: detail.afterEvaluation?.distinction?.oilColourHierarchy?.gainRatio,
                darkGain: detail.afterEvaluation?.distinction?.oilDarkDetail?.gainRatio,
                minRf: limits.minRf,
                minRg: limits.minRg,
                maxRg: limits.maxRg,
                findings: [...document.querySelectorAll('#museum-visual-findings [data-museum-finding] strong')]
                    .map(element => element.textContent.trim()),
                meanRgbDifference: difference / Math.max(1, count),
                changedPixelShare: changedPixels / Math.max(1, count),
                currentMeanLuminance: currentLuminance / Math.max(1, count),
                optimizedMeanLuminance: optimizedLuminance / Math.max(1, count),
                currentAnchor: Number(current.dataset.luminanceFinal),
                optimizedAnchor: Number(optimized.dataset.luminanceFinal),
                currentSubjectLuminance: Number(current.dataset.subjectLuminance),
                optimizedSubjectLuminance: Number(optimized.dataset.subjectLuminance),
                classificationCounts
            };
        });
        assert.equal(oilOptimization.applied, true);
        assert.ok(oilOptimization.rf >= oilOptimization.minRf,
            `oil-painting recipe must satisfy configured Rf minimum: ${JSON.stringify(oilOptimization)}`);
        assert.ok(oilOptimization.rg >= oilOptimization.minRg && oilOptimization.rg <= oilOptimization.maxRg,
            `oil-painting recipe must satisfy configured Rg range: ${JSON.stringify(oilOptimization)}`);
        assert.ok(Math.abs(oilOptimization.cct - 3500) <= 80,
            `oil-painting recipe must stay near target CCT: ${JSON.stringify(oilOptimization)}`);
        assert.ok(oilOptimization.duv >= -0.001 && oilOptimization.duv <= 0.001,
            `oil-painting recipe must stay inside Duv range: ${JSON.stringify(oilOptimization)}`);
        assert.ok(oilOptimization.findings.every(value => value && value !== '等待优化'));
        assert.ok(oilOptimization.anchorAfter <= 1.5,
            `oil-painting light-petal absolute colour difference must remain limited: ${JSON.stringify(oilOptimization)}`);
        assert.ok(['基本保持', '有所改善', '轻微偏移'].includes(oilOptimization.findings[0]),
            `oil-painting light-petal finding must avoid an obvious shift: ${JSON.stringify(oilOptimization)}`);
        assert.ok(oilOptimization.colourGain >= -0.01,
            `oil-painting colour hierarchy must remain stable or improve: ${JSON.stringify(oilOptimization)}`);
        assert.ok(oilOptimization.darkGain >= -0.01,
            `oil-painting dark-detail distinction must remain stable or improve: ${JSON.stringify(oilOptimization)}`);
        assert.ok(oilOptimization.meanRgbDifference >= 2.3,
            `oil-painting comparison must show visible spectral change: ${JSON.stringify(oilOptimization)}`);
        assert.ok(oilOptimization.changedPixelShare >= 0.2,
            `oil-painting comparison must visibly change enough painting pixels: ${JSON.stringify(oilOptimization)}`);
        assert.ok(Math.abs(oilOptimization.optimizedMeanLuminance - oilOptimization.currentMeanLuminance) /
            oilOptimization.currentMeanLuminance <= 0.04,
            `oil-painting comparison must keep comparable display brightness: ${JSON.stringify(oilOptimization)}`);
        assert.ok(Math.abs(oilOptimization.optimizedAnchor - oilOptimization.currentAnchor) <= 1,
            `oil-painting light-petal luminance must remain locked: ${JSON.stringify(oilOptimization)}`);

        await page.select('#museum-exhibit', 'qinghua_porcelain_single');
        await page.waitForFunction(() => document.getElementById('museum-panel-title')?.textContent.includes('青花瓷'));
        await page.waitForFunction(() => document.getElementById('museum-current-preview')?.dataset.exhibitId === 'qinghua_porcelain_single');

        await page.evaluate(() => {
            window.__museumRequest = null;
            window.__museumRequestCount = 0;
            window.__museumResult = null;
            document.addEventListener('spectral-museum-optimization-request', event => {
                window.__museumRequest = event.detail;
                window.__museumRequestCount += 1;
            });
            document.addEventListener('spectral-museum-optimization-result', event => {
                if (event.detail?.optimizationDomain === 'museum') window.__museumResult = event.detail;
            });
        });
        await page.$eval('#museum-target-illuminance', element => {
            element.value = '30';
            element.dispatchEvent(new Event('input', { bubbles: true }));
        });
        await page.waitForFunction(() => document.getElementById('museum-optimized-preview')?.dataset.displayIlluminance === '30');
        await page.waitForFunction(() => /72,?000/.test(document.getElementById('museum-target-annual-exposure')?.textContent || ''));
        await page.waitForFunction(() => /72,?000/.test(document.getElementById('museum-exposure-summary')?.textContent || ''));
        await page.select('#museum-mode', 'low-light-recognition');
        await page.select('#museum-strength', 'strong');
        await page.click('#museum-optimize-button');
        await page.waitForFunction(() => Boolean(window.__museumRequest));
        const request = await page.evaluate(() => ({
            detail: window.__museumRequest,
            count: window.__museumRequestCount
        }));
        assert.equal(request.count, 1);
        assert.equal(request.detail.optimizationDomain, 'museum');
        assert.equal(request.detail.exhibitId, 'qinghua_porcelain_single');
        assert.equal(request.detail.mode, 'low-light-recognition');
        assert.equal(request.detail.strength, 'strong');
        assert.equal(request.detail.targetIlluminance, 30);
        assert.deepEqual(request.detail.duvRange, [-0.001, 0.001]);
        assert.equal(request.detail.sampleIds.length, 6);
        await page.waitForFunction(() => Boolean(window.__museumResult), { timeout: 90000 });
        await page.waitForFunction(() => document.getElementById('museum-optimize-button')?.disabled === false, { timeout: 90000 });
        const firstResult = await page.evaluate(() => ({
            detail: window.__museumResult,
            summary: document.getElementById('museum-result-summary')?.textContent || '',
            findingValues: [...document.querySelectorAll('#museum-visual-findings [data-museum-finding] strong')]
                .map(element => element.textContent.trim()),
            sampleCards: document.querySelectorAll('#museum-sample-results .museum-sample-result').length,
            channelRows: document.querySelectorAll('#museum-optimization-channels .museum-channel-row').length,
            sixChannelMode: document.getElementById('mode-checkbox')?.checked === true,
            validationExists: Boolean(document.getElementById('museum-validation'))
        }));
        assert.equal(firstResult.detail.optimizationDomain, 'museum');
        assert.ok(museumWorkerCount >= 1, 'museum target fitting must prefer the scene optimizer worker');
        assert.equal(firstResult.detail.exhibitId, 'qinghua_porcelain_single');
        assert.ok(firstResult.detail.beforeSnapshot);
        assert.ok(firstResult.detail.afterSnapshot);
        assert.ok(firstResult.detail.beforeEvaluation);
        assert.ok(firstResult.detail.afterEvaluation);
        assert.equal(firstResult.detail.beforeEvaluation.perSample.length, 6);
        assert.equal(firstResult.detail.afterEvaluation.perSample.length, 6);
        assert.ok(Number.isFinite(firstResult.detail.afterEvaluation.distinction.blueWhite.candidate));
        assert.ok(Number.isFinite(firstResult.detail.afterEvaluation.distinction.lightDeepBlue.candidate));
        assert.ok(Number.isFinite(firstResult.detail.afterEvaluation.distinction.blueHierarchy.candidate));
        assert.equal(firstResult.detail.exposure.target.annualLxHours, 72000);
        assert.ok(firstResult.detail.afterEvaluation.quality.rg >= 110,
            `low-light recognition must produce Rg >= 110, got ${firstResult.detail.afterEvaluation.quality.rg}`);
        assert.equal(firstResult.detail.afterSnapshot.channels.length, 6);
        assert.equal(firstResult.sixChannelMode, true);
        assert.equal(firstResult.findingValues.length, 4);
        assert.ok(firstResult.findingValues.every(value => value && value !== '等待优化'));
        assert.equal(firstResult.sampleCards, 6);
        assert.equal(firstResult.channelRows, firstResult.detail.afterSnapshot.channels.length);
        assert.match(firstResult.summary, /ΔE00|蓝白辨识度|配方/);
        assert.equal(firstResult.validationExists, false);

        const previewComparison = await page.evaluate(() => {
            const current = document.getElementById('museum-current-preview');
            const optimized = document.getElementById('museum-optimized-preview');
            const currentPixels = current.getContext('2d').getImageData(0, 0, current.width, current.height).data;
            const optimizedPixels = optimized.getContext('2d').getImageData(0, 0, optimized.width, optimized.height).data;
            let currentLuminance = 0;
            let optimizedLuminance = 0;
            let rgbDifference = 0;
            let chromaDifference = 0;
            let blueChromaDifference = 0;
            let blueCount = 0;
            let count = 0;
            for (let index = 0; index < currentPixels.length; index += 4) {
                const cr = currentPixels[index];
                const cg = currentPixels[index + 1];
                const cb = currentPixels[index + 2];
                const or = optimizedPixels[index];
                const og = optimizedPixels[index + 1];
                const ob = optimizedPixels[index + 2];
                const currentBackgroundDistance = Math.hypot(cr - 23, cg - 25, cb - 29);
                const optimizedBackgroundDistance = Math.hypot(or - 23, og - 25, ob - 29);
                if (currentBackgroundDistance < 10 && optimizedBackgroundDistance < 10) continue;
                currentLuminance += cr * 0.2126 + cg * 0.7152 + cb * 0.0722;
                optimizedLuminance += or * 0.2126 + og * 0.7152 + ob * 0.0722;
                rgbDifference += (Math.abs(or - cr) + Math.abs(og - cg) + Math.abs(ob - cb)) / 3;
                const pixelChromaDifference = (Math.abs((or - og) - (cr - cg)) + Math.abs((ob - og) - (cb - cg))) / 2;
                chromaDifference += pixelChromaDifference;
                if (cb > cr + 8 && cb >= cg) {
                    blueChromaDifference += pixelChromaDifference;
                    blueCount += 1;
                }
                count += 1;
            }
            return {
                currentMeanLuminance: currentLuminance / Math.max(1, count),
                optimizedMeanLuminance: optimizedLuminance / Math.max(1, count),
                meanRgbDifference: rgbDifference / Math.max(1, count),
                meanChromaDifference: chromaDifference / Math.max(1, count),
                blueMeanChromaDifference: blueChromaDifference / Math.max(1, blueCount),
                bluePixelShare: blueCount / Math.max(1, count),
                currentIlluminance: Number(current.dataset.displayIlluminance),
                optimizedIlluminance: Number(optimized.dataset.displayIlluminance),
                currentPreviewSaturation: Number(current.dataset.previewSaturation),
                optimizedPreviewSaturation: Number(optimized.dataset.previewSaturation),
                currentPreviewContrast: Number(current.dataset.previewContrast),
                optimizedPreviewContrast: Number(optimized.dataset.previewContrast),
                currentPreviewBlur: Number(current.dataset.previewBlurPx),
                optimizedPreviewBlur: Number(optimized.dataset.previewBlurPx),
                optimizedSpectralDisplayGain: Number(optimized.dataset.spectralDisplayGain),
                optimizedPreviewMode: optimized.dataset.previewMode || '',
                optimizedRecognitionBoost: Number(optimized.dataset.recognitionBoost)
            };
        });
        assert.equal(previewComparison.currentIlluminance, 50);
        assert.equal(previewComparison.optimizedIlluminance, 30);
        assert.equal(previewComparison.currentPreviewSaturation, 0.94);
        assert.ok(previewComparison.optimizedPreviewSaturation >= 1.03 && previewComparison.optimizedPreviewSaturation <= 1.08);
        assert.equal(previewComparison.currentPreviewContrast, 0.96);
        assert.ok(previewComparison.optimizedPreviewContrast >= 1.04 && previewComparison.optimizedPreviewContrast <= 1.10);
        assert.ok(previewComparison.currentPreviewBlur >= 0.5 && previewComparison.currentPreviewBlur <= 1.2);
        assert.ok(previewComparison.optimizedPreviewBlur <= 0.2);
        assert.equal(previewComparison.optimizedPreviewMode, 'low-light-recognition');
        assert.ok(previewComparison.optimizedRecognitionBoost > 0,
            `low-light recognition must use local cobalt/transition enhancement: ${JSON.stringify(previewComparison)}`);
        assert.ok(previewComparison.optimizedSpectralDisplayGain > 0 && previewComparison.optimizedSpectralDisplayGain <= 0.35,
            `low-light spectral display gain must stay restrained to avoid obvious hue shift: ${JSON.stringify(previewComparison)}`);
        assert.ok(previewComparison.optimizedMeanLuminance >= previewComparison.currentMeanLuminance * 0.85,
            `museum previews should retain dining-style display brightness: ${JSON.stringify(previewComparison)}`);
        assert.ok(previewComparison.meanRgbDifference >= 1.5,
            `current and optimized exhibit previews need a visible but restrained overall difference: ${JSON.stringify(previewComparison)}`);
        assert.ok(previewComparison.meanChromaDifference >= 1.5 && previewComparison.meanChromaDifference <= 12,
            `exhibit preview chroma change must be visible without heavy colour cast: ${JSON.stringify(previewComparison)}`);
        assert.ok(previewComparison.blueMeanChromaDifference >= 2 && previewComparison.blueMeanChromaDifference <= 16,
            `cobalt regions need restrained local enhancement: ${JSON.stringify(previewComparison)}`);

        const firstChannels = firstResult.detail.afterSnapshot.channels.map(channel => channel.value);
        await page.evaluate(() => { window.__museumResult = null; });
        await page.click('#museum-optimize-button');
        await page.waitForFunction(() => Boolean(window.__museumResult), { timeout: 90000 });
        const secondResult = await page.evaluate(() => window.__museumResult);
        assert.deepEqual(secondResult.beforeSnapshot.channels.map(channel => channel.value),
            firstResult.detail.beforeSnapshot.channels.map(channel => channel.value),
            'repeating the same museum request must reuse the same baseline');
        assert.deepEqual(secondResult.afterSnapshot.channels.map(channel => channel.value), firstChannels,
            'repeating the same museum request must produce deterministic channel values');
        assert.equal(secondResult.afterEvaluation.weightedMeanDeltaE00,
            firstResult.detail.afterEvaluation.weightedMeanDeltaE00);

        async function previewProfileForMode(mode) {
            await page.select('#museum-mode', mode);
            await page.evaluate((detail, selectedMode) => {
                const replay = JSON.parse(JSON.stringify(detail));
                replay.mode = selectedMode;
                document.dispatchEvent(new CustomEvent('spectral-museum-optimization-result', { detail: replay }));
            }, firstResult.detail, mode);
            await page.waitForFunction(selectedMode =>
                document.getElementById('museum-optimized-preview')?.dataset.previewMode === selectedMode,
            {}, mode);
            return page.evaluate(() => {
                const canvas = document.getElementById('museum-optimized-preview');
                return {
                    mode: canvas.dataset.previewMode,
                    saturation: Number(canvas.dataset.previewSaturation),
                    contrast: Number(canvas.dataset.previewContrast),
                    blur: Number(canvas.dataset.previewBlurPx),
                    spectralGain: Number(canvas.dataset.spectralDisplayGain),
                    recognitionBoost: Number(canvas.dataset.recognitionBoost)
                };
            });
        }

        const fidelityProfile = await previewProfileForMode('fidelity');
        const lowLightProfile = await previewProfileForMode('low-light-recognition');
        const enhancementProfile = await previewProfileForMode('colour-enhancement');
        assert.equal(fidelityProfile.recognitionBoost, 0);
        assert.ok(fidelityProfile.saturation >= 0.99 && fidelityProfile.saturation <= 1.01);
        assert.ok(fidelityProfile.contrast >= 0.99 && fidelityProfile.contrast <= 1.02);
        assert.ok(fidelityProfile.spectralGain <= 0.2);
        assert.ok(lowLightProfile.recognitionBoost > 0);
        assert.ok(lowLightProfile.saturation <= 1.04);
        assert.ok(lowLightProfile.contrast > fidelityProfile.contrast);
        assert.ok(lowLightProfile.blur < 0.2);
        assert.ok(enhancementProfile.recognitionBoost <= lowLightProfile.recognitionBoost);
        assert.ok(enhancementProfile.saturation > lowLightProfile.saturation);
        assert.ok(enhancementProfile.spectralGain > lowLightProfile.spectralGain);

        await page.setViewport({ width: 390, height: 844 });
        await new Promise(resolve => setTimeout(resolve, 180));
        const mobile = await page.evaluate(() => ({
            overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
            showcaseColumns: getComputedStyle(document.querySelector('.museum-showcase-layout')).gridTemplateColumns
                .split(/\s+/).filter(Boolean).length,
            previewColumns: getComputedStyle(document.getElementById('museum-primary-preview-grid')).gridTemplateColumns
                .split(/\s+/).filter(Boolean).length,
            sampleColumns: getComputedStyle(document.getElementById('museum-sample-selector')).gridTemplateColumns
                .split(/\s+/).filter(Boolean).length,
            panelWidth: document.getElementById('museum-panel').getBoundingClientRect().width
        }));
        assert.equal(mobile.overflow, 0);
        assert.equal(mobile.showcaseColumns, 1);
        assert.equal(mobile.previewColumns, 1);
        assert.ok(mobile.sampleColumns <= 2);
        assert.ok(mobile.panelWidth <= 366);
        assert.deepEqual(pageErrors, []);

        console.log('museum exhibit comparison tests passed', {
            samples: initial.samples.length,
            targetExposure: initial.exposure,
            requestMode: request.detail.mode
        });
    } finally {
        await browser.close();
        await new Promise(resolve => server.close(resolve));
    }
})().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
