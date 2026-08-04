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
    const pageErrors = [];
    const consoleErrors = [];
    try {
        const page = await browser.newPage();
        page.on('pageerror', error => pageErrors.push(error.message));
        page.on('console', message => {
            if (message.type() === 'error') consoleErrors.push(message.text());
        });
        await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 1 });
        await page.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil: 'networkidle0' });
        await page.waitForFunction(() => document.documentElement.dataset.appReady === 'true');

        await page.evaluate(() => {
            window.__recipeDownloads = [];
            HTMLAnchorElement.prototype.click = function () {
                window.__recipeDownloads.push({ download: this.download, href: this.href });
            };
        });

        const initialState = await page.evaluate(() => ({
            cct: document.getElementById('target-cct-slider')?.value,
            duv: document.getElementById('target-duv-slider')?.value,
            illuminance: document.getElementById('eye-illuminance')?.value,
            mode: document.getElementById('mode-checkbox')?.checked,
            channels: [...document.querySelectorAll('.channel-slider')].map(slider => ({ id: slider.id, value: slider.value }))
        }));

        await page.click('#export-recipe-btn');
        const initialDialog = await page.evaluate(() => ({
            exists: Boolean(document.getElementById('recipe-export-dialog')),
            open: Boolean(document.getElementById('recipe-export-dialog')?.open),
            single: Boolean(document.getElementById('recipe-export-single')?.checked),
            batch: Boolean(document.getElementById('recipe-export-batch')?.checked)
        }));
        assert.deepEqual(initialDialog, { exists: true, open: true, single: true, batch: false });

        await page.click('#recipe-export-start');
        await page.waitForFunction(() => {
            const state = window.RECIPE_BATCH_EXPORT?.getDebugState();
            return state && !state.running && state.completed && state.sheetNames.length === 5;
        }, { timeout: 60000 });
        const single = await page.evaluate(() => ({
            debug: window.RECIPE_BATCH_EXPORT.getDebugState(),
            downloads: window.__recipeDownloads.slice(),
            status: document.getElementById('recipe-export-status')?.textContent
        }));
        assert.deepEqual(single.debug.sheetNames, ['说明', '单点配方', '亮度配方', '光谱数据', '亮度光谱']);
        assert.equal(single.debug.rowCounts[1], 1);
        assert.equal(single.debug.rowCounts[2], 7);
        assert.equal(single.debug.rowCounts[3], 81);
        assert.equal(single.debug.rowCounts[4], 7);
        assert.deepEqual(single.debug.recipeCounts, { single: 1, brightness: 7, total: 8 });
        assert.match(single.debug.fileName, /^spectral-recipe-single-\d+ch-\d{8}-\d{4}\.xlsx$/);
        assert.equal(single.downloads.length, 1);
        assert.equal(single.downloads[0].download, single.debug.fileName);
        assert.match(single.status, /已生成/);

        await page.click('#recipe-export-close');
        await page.evaluate(() => {
            window.RECIPE_BATCH_EXPORT.setBatchOptionsForTesting({
                minK: 1600,
                maxK: 1700,
                stepK: 100,
                pastelLimit: 2,
                sceneLimit: 2,
                brightnessLevels: [100, 50]
            });
        });
        await page.click('#export-recipe-btn');
        await page.click('#recipe-export-batch');
        await page.click('#recipe-export-start');
        await page.waitForFunction(() => {
            const state = window.RECIPE_BATCH_EXPORT?.getDebugState();
            return state && !state.running && (state.completed || state.error);
        }, { timeout: 180000 });

        const batch = await page.evaluate(() => ({
            debug: window.RECIPE_BATCH_EXPORT.getDebugState(),
            downloads: window.__recipeDownloads.slice(),
            progress: document.getElementById('recipe-export-progress-bar')?.value,
            state: {
                cct: document.getElementById('target-cct-slider')?.value,
                duv: document.getElementById('target-duv-slider')?.value,
                illuminance: document.getElementById('eye-illuminance')?.value,
                mode: document.getElementById('mode-checkbox')?.checked,
                channels: [...document.querySelectorAll('.channel-slider')].map(slider => ({ id: slider.id, value: slider.value }))
            }
        }));
        assert.equal(batch.debug.error, '', `batch export failed: ${batch.debug.error}`);
        assert.equal(batch.debug.completed, true);
        assert.deepEqual(batch.debug.sheetNames, ['说明', '常规', '高显色', '高饱和', '淡彩光', '情景模式', '亮度配方', '光谱数据', '亮度光谱']);
        assert.deepEqual(batch.debug.recipeCounts, {
            regular: 2,
            fidelity: 2,
            saturation: 2,
            pastel: 2,
            scenes: 2,
            brightness: 20,
            baseTotal: 10,
            total: 30
        });
        assert.deepEqual(batch.debug.rowCounts.slice(1, 6), [2, 2, 2, 2, 2]);
        assert.equal(batch.debug.rowCounts[6], 20);
        assert.equal(batch.debug.rowCounts[7], 10 * 81);
        assert.equal(batch.debug.rowCounts[8], 20);
        assert.equal(Math.round(batch.progress), 100);
        assert.equal(batch.downloads.length, 2);
        assert.match(batch.downloads[1].download, /^spectral-recipes-\d+ch-\d{8}-\d{4}\.xlsx$/);
        assert.deepEqual(batch.state, initialState, 'batch export must not change target controls or channel sliders');

        await page.click('#recipe-export-close');
        await page.evaluate(() => {
            window.RECIPE_BATCH_EXPORT.setBatchOptionsForTesting({
                minK: 1600,
                maxK: 3000,
                stepK: 100,
                pastelLimit: 0,
                sceneLimit: 0,
                brightnessLevels: [100, 50],
                skipDownload: true
            });
        });
        await page.click('#export-recipe-btn');
        await page.click('#recipe-export-batch');
        await page.click('#recipe-export-start');
        await page.waitForFunction(() => {
            const state = window.RECIPE_BATCH_EXPORT?.getDebugState();
            return state && state.running && state.progress > 0;
        }, { timeout: 60000 });
        await page.click('#recipe-export-cancel');
        await page.waitForFunction(() => {
            const state = window.RECIPE_BATCH_EXPORT?.getDebugState();
            return state && !state.running && state.cancelled;
        }, { timeout: 60000 });
        const cancelled = await page.evaluate(() => ({
            debug: window.RECIPE_BATCH_EXPORT.getDebugState(),
            downloads: window.__recipeDownloads.length
        }));
        assert.equal(cancelled.debug.completed, false);
        assert.equal(cancelled.debug.cancelled, true);
        assert.equal(cancelled.downloads, 2, 'cancelled export must not download a workbook');

        assert.deepEqual(pageErrors, [], `page errors: ${pageErrors.join('\n')}`);
        assert.deepEqual(consoleErrors, [], `console errors: ${consoleErrors.join('\n')}`);
        console.log('recipe export browser tests passed', {
            singleSheets: single.debug.sheetNames.length,
            batchSheets: batch.debug.sheetNames.length,
            batchRecipes: batch.debug.recipeCounts.total,
            brightnessRows: batch.debug.rowCounts[6],
            spectrumRows: batch.debug.rowCounts[7],
            brightnessSpectrumRows: batch.debug.rowCounts[8],
            cancelledAt: cancelled.debug.progress
        });
    } finally {
        await browser.close();
        await new Promise(resolve => server.close(resolve));
    }
})().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
