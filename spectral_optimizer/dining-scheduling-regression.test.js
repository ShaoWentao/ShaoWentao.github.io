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
    page.on('pageerror', error => pageErrors.push(error.message));

    try {
        await page.setViewport({ width: 1440, height: 960 });
        await page.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil: 'networkidle0' });
        await page.waitForFunction(() => document.documentElement.dataset.appReady === 'true');
        await page.click('#analysis-tab-dining');
        await page.waitForFunction(() => !document.getElementById('analysis-pane-dining').hidden);

        await page.evaluate(() => {
            window.__diningSchedulingResult = null;
            window.__blockedDiningFrameCount = 0;

            const originalRequestAnimationFrame = window.requestAnimationFrame.bind(window);
            window.requestAnimationFrame = function (callback) {
                if (window.__blockedDiningFrameCount === 0) {
                    window.__blockedDiningFrameCount += 1;
                    window.requestAnimationFrame = originalRequestAnimationFrame;
                    return 1;
                }
                return originalRequestAnimationFrame(callback);
            };

            const listener = event => {
                if (!event.detail?.cuisineProfileId) return;
                window.__diningSchedulingResult = event.detail;
                document.removeEventListener('spectral-material-optimization-result', listener);
            };
            document.addEventListener('spectral-material-optimization-result', listener);
        });

        await page.click('#dining-light-apply');
        await page.waitForFunction(() => Boolean(window.__diningSchedulingResult), { timeout: 30000 });
        await page.waitForFunction(() => document.getElementById('dining-light-apply')?.disabled === false, { timeout: 30000 });

        const state = await page.evaluate(() => ({
            blockedFrameCount: window.__blockedDiningFrameCount,
            result: window.__diningSchedulingResult,
            buttonDisabled: document.getElementById('dining-light-apply')?.disabled,
            buttonText: document.getElementById('dining-light-apply')?.textContent || '',
            status: document.getElementById('dining-optimization-status')?.textContent || ''
        }));

        assert.equal(state.blockedFrameCount, 1,
            'the regression setup must suppress the first animation-frame callback');
        assert.equal(state.result.cuisineProfileId, 'comprehensive');
        assert.equal(state.buttonDisabled, false,
            'dining optimization must release the busy state even when the first animation frame never runs');
        assert.equal(state.buttonText, '开始餐饮优化');
        assert.doesNotMatch(state.status, /正在搜索|正在优化/);
        assert.deepEqual(pageErrors, []);

        console.log('dining scheduling regression test passed');
    } finally {
        await page.close();
        await browser.close();
        await new Promise(resolve => server.close(resolve));
    }
})().catch(error => {
    console.error(error);
    process.exit(1);
});
