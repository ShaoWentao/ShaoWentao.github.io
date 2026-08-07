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

    async function runOptimization({ targetMode = 'current', cuisine = 'comprehensive', selectedId = 'dish_red_braised_meat' }) {
        const page = await browser.newPage();
        await page.setViewport({ width: 1600, height: 1000 });
        await page.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil: 'networkidle0' });
        await page.waitForFunction(() => document.documentElement.dataset.appReady === 'true');
        await page.click('#analysis-tab-dining');
        await page.waitForFunction(() => !document.getElementById('analysis-pane-dining').hidden);
        await page.select('#dining-cuisine-profile', cuisine);
        await page.click(`#dining-material-selector [data-material-id="${selectedId}"]`);
        await page.waitForFunction(() => Boolean(document.getElementById('dining-before-preview')?.dataset.rendered), { timeout: 15000 });
        const modeBeforePixels = await sampleCanvas(page, 'dining-before-preview');
        await page.select('#dining-target-mode', targetMode);
        const originalPixels = await sampleCanvas(page, 'dining-before-preview');
        await page.evaluate(() => {
            window.__recommendedModeResult = null;
            const listener = event => {
                if (!event.detail?.cuisineProfileId) return;
                window.__recommendedModeResult = event.detail;
                document.removeEventListener('spectral-material-optimization-result', listener);
            };
            document.addEventListener('spectral-material-optimization-result', listener);
        });
        await page.evaluate(() => document.getElementById('dining-light-apply')?.click());
        await page.waitForFunction(() => Boolean(window.__recommendedModeResult), { timeout: 90000 });
        await page.waitForFunction(() => document.getElementById('dining-light-apply')?.disabled === false, { timeout: 90000 });
        await page.waitForFunction(() => ['dining-before-preview', 'dining-after-preview'].every(id =>
            Boolean(document.getElementById(id)?.dataset.rendered)
        ), { timeout: 15000 });

        const result = await page.evaluate(() => ({
            detail: window.__recommendedModeResult,
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
        const recommended = await runOptimization({
            targetMode: 'recommended', cuisine: 'comprehensive', selectedId: 'dish_green_vegetable'
        });
        assert.equal(recommended.detail.targetMode, 'recommended');
        assert.equal(recommended.detail.cuisineProfileId, 'comprehensive');
        assert.equal(recommended.detail.referenceCct, 3500);
        assert.equal(recommended.detail.referenceDuv, 0);
        assert.ok(recommended.detail.optimizationBaselineSnapshot,
            'recommended mode must expose the target-colour-point baseline used by the optimizer');
        assert.ok(Math.abs(recommended.detail.optimizationBaselineSnapshot.metrics.cct - 3500) <= 100);
        assert.ok(Math.abs(recommended.detail.optimizationBaselineSnapshot.metrics.duv) <= 0.0015);
        assert.ok(Math.abs(recommended.detail.afterSnapshot.metrics.cct - 3500) <= 100);
        assert.ok(Math.abs(recommended.detail.afterSnapshot.metrics.duv) <= 0.0015);
        assert.equal(recommended.detail.applied, true,
            'recommended mode must apply the cuisine colour point even when no extra preference gain is found');
        assert.equal(recommended.detail.recommendedTargetApplied, true);
        assert.deepEqual(recommended.originalPixels, recommended.modeBeforePixels,
            'switching target mode must not recolour the optimization-before image');
        assert.deepEqual(recommended.beforePixels, recommended.originalPixels,
            'the optimization-before image must remain the source photograph after optimization');
        assert.ok(Number.isFinite(recommended.detail.relativeOutputChangePercent));
        assert.equal(recommended.targetCctSlider, 3500);
        assert.equal(recommended.targetDuvSlider, 0);
        assert.match(recommended.targetCctLabel, /3500 K/);
        assert.match(recommended.targetDuvLabel, /0\.0000/);
        assert.match(recommended.beforeCaption, /原始图片|优化前/);
        assert.match(recommended.summary, /菜系推荐色点|菜系加权得分/);

        const beef = await runOptimization({
            targetMode: 'current', cuisine: 'comprehensive', selectedId: 'dish_red_braised_meat'
        });
        const green = await runOptimization({
            targetMode: 'current', cuisine: 'comprehensive', selectedId: 'dish_green_vegetable'
        });
        assert.deepEqual(
            green.detail.afterSnapshot.channels.map(channel => channel.value),
            beef.detail.afterSnapshot.channels.map(channel => channel.value),
            'selecting a dish for preview must not change the cuisine optimization recipe'
        );
        assert.deepEqual(green.detail.after, beef.detail.after,
            'selecting a dish for preview must not change the cuisine objective result');
    } finally {
        await browser.close();
        await new Promise(resolve => server.close(resolve));
    }

    console.log('dining cuisine-recommended-mode regression tests passed');
})().catch(error => {
    console.error(error);
    process.exit(1);
});
