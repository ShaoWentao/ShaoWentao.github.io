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
    const page = await browser.newPage();
    const pageErrors = [];
    const blockedNetworkImages = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    await page.setRequestInterception(true);
    page.on('request', request => {
        const url = new URL(request.url());
        if (url.hostname !== '127.0.0.1' && request.resourceType() === 'image') {
            blockedNetworkImages.push(request.url());
            request.abort();
            return;
        }
        request.continue();
    });

    try {
        await page.setViewport({ width: 1440, height: 960 });
        await page.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil: 'networkidle0' });
        await page.waitForFunction(() => document.documentElement.dataset.appReady === 'true');
        await page.click('#analysis-tab-dining');
        await page.waitForFunction(() => !document.getElementById('analysis-pane-dining').hidden);

        const dishes = await page.evaluate(() => window.DiningLightData.listMaterials().map(dish => ({
            id: dish.id,
            expectedUrl: dish.appearanceSource.file,
            fallbackUrl: dish.appearanceSource.fallbackFile
        })));

        const loaded = [];
        for (const dish of dishes) {
            const previousToken = await page.$eval('#dining-before-preview', canvas => canvas.dataset.rendered || '');
            await page.click(`#dining-material-selector [data-material-id="${dish.id}"]`);
            await page.waitForFunction((token, expectedUrl) => {
                const canvas = document.getElementById('dining-before-preview');
                return Boolean(canvas?.dataset.rendered) &&
                    canvas.dataset.rendered !== token &&
                    new URL(canvas.dataset.imageSource).pathname.endsWith('/' + expectedUrl);
            }, { timeout: 20000 }, previousToken, dish.expectedUrl);
            loaded.push(await page.$eval('#dining-before-preview', canvas => canvas.dataset.imageSource || ''));
        }

        assert.equal(loaded.length, 12);
        assert.deepEqual(loaded.map(url => new URL(url).pathname.replace(/^\//, '')),
            dishes.map(dish => dish.expectedUrl),
            'all dish previews must load their selected local photographs');
        assert.deepEqual(blockedNetworkImages, [], 'dish previews must not request network images');
        assert.deepEqual(pageErrors, []);

        console.log('dining image loading test passed', { loaded: loaded.length });
    } finally {
        await page.close();
        await browser.close();
        await new Promise(resolve => server.close(resolve));
    }
})().catch(error => {
    console.error(error);
    process.exit(1);
});
