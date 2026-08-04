'use strict';

const assert = require('node:assert/strict');
const puppeteer = require('puppeteer');
const { createLocalServer } = require('./local-server.js');

function sampleCanvas(page, id) {
    return page.evaluate(canvasId => {
        const canvas = document.getElementById(canvasId);
        const context = canvas.getContext('2d');
        return [[0.2, 0.2], [0.5, 0.5], [0.8, 0.8]].map(([x, y]) =>
            [...context.getImageData(
                Math.floor(canvas.width * x),
                Math.floor(canvas.height * y),
                1,
                1
            ).data]
        );
    }, id);
}

(async () => {
    const server = createLocalServer();
    await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', resolve);
    });
    const browser = await puppeteer.launch({ headless: true });

    async function runOptimization({ targetMode = 'current', selectedId = 'food_grilled_beef' }) {
        const page = await browser.newPage();
        await page.setViewport({ width: 1600, height: 1000 });
        await page.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil: 'networkidle0' });
        await page.waitForFunction(() => document.documentElement.dataset.appReady === 'true');
        await page.click('#analysis-tab-dining');
        await page.waitForFunction(() => !document.getElementById('analysis-pane-dining').hidden);
        await page.click(`#dining-material-selector [data-material-id="${selectedId}"]`);
        await page.waitForFunction(() => Boolean(document.getElementById('dining-before-preview')?.dataset.rendered));
        const modeBeforePixels = await sampleCanvas(page, 'dining-before-preview');
        await page.select('#dining-target-mode', targetMode);
        const originalPixels = await sampleCanvas(page, 'dining-before-preview');
        await page.evaluate(() => {
            window.__sceneModeResult = null;
            document.addEventListener('spectral-material-optimization-result', event => {
                if (event.detail?.diningProfileId) window.__sceneModeResult = event.detail;
            }, { once: true });
        });
        await page.click('#dining-light-apply');
        await page.waitForFunction(() => Boolean(window.__sceneModeResult), { timeout: 90000 });
        await page.waitForFunction(() => document.getElementById('dining-light-apply')?.disabled === false, { timeout: 90000 });
        await page.waitForFunction(() => ['dining-before-preview', 'dining-after-preview'].every(id =>
            Boolean(document.getElementById(id)?.dataset.rendered)
        ), { timeout: 10000 });

        const result = await page.evaluate(() => ({
            detail: window.__sceneModeResult,
            targetCctSlider: Number(document.getElementById('target-cct-slider')?.value),
            targetDuvSlider: Number(document.getElementById('target-duv-slider')?.value),
            targetCctLabel: document.getElementById('target-cct-val')?.textContent || '',
            targetDuvLabel: document.getElementById('target-duv-val')?.textContent || '',
            beforeCaption: document.getElementById('dining-before-caption')?.textContent || '',
            afterCaption: document.getElementById('dining-after-caption')?.textContent || '',
            summary: document.getElementById('dining-optimization-summary')?.textContent || ''
        }));
        result.modeBeforePixels = modeBeforePixels;
        result.originalPixels = originalPixels;
        result.beforePixels = await sampleCanvas(page, 'dining-before-preview');
        result.afterPixels = await sampleCanvas(page, 'dining-after-preview');
        await page.close();
        return result;
    }

    try {
        const scene = await runOptimization({ targetMode: 'scene', selectedId: 'food_leafy_green' });
        assert.equal(scene.detail.targetMode, 'scene');
        assert.equal(scene.detail.referenceCct, 3500);
        assert.equal(scene.detail.referenceDuv, 0);
        assert.ok(scene.detail.optimizationBaselineSnapshot,
            'scene mode must expose the target-colour-point baseline used by the spectral optimizer');
        assert.ok(Math.abs(scene.detail.optimizationBaselineSnapshot.metrics.cct - 3500) <= 100,
            'scene optimization baseline must first reach the recommended CCT');
        assert.ok(Math.abs(scene.detail.optimizationBaselineSnapshot.metrics.duv) <= 0.0015,
            'scene optimization baseline must first reach the recommended Duv tolerance');
        assert.ok(Math.abs(scene.detail.afterSnapshot.metrics.cct - 3500) <= 100,
            'the applied scene recipe must remain at the recommended CCT');
        assert.ok(Math.abs(scene.detail.afterSnapshot.metrics.duv) <= 0.0015,
            'the applied scene recipe must remain within the recommended Duv tolerance');
        assert.equal(scene.detail.applied, true,
            'scene mode must apply the recommended colour point even when no extra spectral preference gain is found');
        assert.equal(scene.detail.sceneTargetApplied, true);
        assert.deepEqual(scene.originalPixels, scene.modeBeforePixels,
            'switching to the scene target mode must not recolour the optimization-before image');
        assert.deepEqual(scene.beforePixels, scene.originalPixels,
            'the optimization-before image must remain the unchanged source photograph after optimization');
        assert.ok(Number.isFinite(scene.detail.relativeOutputChangePercent),
            'scene mode must report the relative illuminance change caused by channel limits');
        assert.equal(scene.targetCctSlider, 3500,
            'applying the scene target must synchronize the global target CCT');
        assert.equal(scene.targetDuvSlider, 0,
            'applying the scene target must synchronize the global target Duv');
        assert.match(scene.targetCctLabel, /3500 K/);
        assert.match(scene.targetDuvLabel, /0\.0000/);
        assert.match(scene.beforeCaption, /原始图片|优化前/);
        assert.match(scene.summary, /场景推荐色点|场景加权得分/);

        const beef = await runOptimization({ targetMode: 'current', selectedId: 'food_grilled_beef' });
        const green = await runOptimization({ targetMode: 'current', selectedId: 'food_leafy_green' });
        assert.deepEqual(
            green.detail.afterSnapshot.channels.map(channel => channel.value),
            beef.detail.afterSnapshot.channels.map(channel => channel.value),
            'selecting a food for preview must not change the global dining optimization recipe'
        );
        assert.deepEqual(green.detail.after, beef.detail.after,
            'selecting a food for preview must not change the dining objective result');
    } finally {
        await browser.close();
        await new Promise(resolve => server.close(resolve));
    }

    console.log('dining scene-mode regression tests passed');
})().catch(error => {
    console.error(error);
    process.exit(1);
});
