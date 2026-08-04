'use strict';

const assert = require('node:assert/strict');
const puppeteer = require('puppeteer');
const { createLocalServer } = require('./local-server.js');

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

(async () => {
    const server = createLocalServer();
    await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', resolve);
    });

    const browser = await puppeteer.launch({ headless: true });
    try {
        const page = await browser.newPage();
        let workerCount = 0;
        const pageErrors = [];
        page.on('workercreated', () => { workerCount += 1; });
        page.on('pageerror', error => pageErrors.push(error.message));

        await page.setViewport({ width: 1600, height: 1100, deviceScaleFactor: 1 });
        await page.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil: 'networkidle0' });
        await page.waitForFunction(() => document.documentElement.dataset.appReady === 'true');
        await page.waitForFunction(() =>
            Number(document.documentElement.dataset.baseMetricsVersion || 0) > 0 &&
            Boolean(window.SpectralWorkspaceStore?.getSnapshot().currentResult));

        const initial = await page.evaluate(() => {
            const canvas = document.getElementById('cie-canvas');
            const rect = canvas.getBoundingClientRect();
            return {
                panelCount: document.querySelectorAll('#chromaticity-panel').length,
                old1931: Boolean(document.getElementById('cie-panel')),
                old1960: Boolean(document.getElementById('cie1960-panel')),
                old1976: Boolean(document.getElementById('cie1976-panel')),
                visible1960: Boolean(
                    document.getElementById('chromaticity-tab-1960') ||
                    document.getElementById('chromaticity-pane-1960') ||
                    document.getElementById('professional-cie1960')
                ),
                selected1976: document.getElementById('chromaticity-tab-1976')?.getAttribute('aria-selected'),
                selected1931: document.getElementById('chromaticity-tab-1931')?.getAttribute('aria-selected'),
                pane1976Hidden: document.getElementById('chromaticity-pane-1976')?.hidden,
                pane1931Hidden: document.getElementById('chromaticity-pane-1931')?.hidden,
                coordinate: document.getElementById('chromaticity-summary-upvp')?.textContent || '',
                rect: { width: rect.width, height: rect.height },
                backing: { width: canvas.width, height: canvas.height },
                result: JSON.stringify(window.SpectralWorkspaceStore?.getSnapshot().currentResult)
            };
        });

        assert.equal(initial.panelCount, 1, 'page must contain one chromaticity analysis card');
        assert.equal(initial.old1931, false, 'old independent CIE 1931 card must be removed');
        assert.equal(initial.old1960, false, 'old independent CIE 1960 card must be removed');
        assert.equal(initial.old1976, false, 'CIE 1976 must remain inside the unified card');
        assert.equal(initial.visible1960, false, 'CIE 1960 must not be exposed as a visible chart');
        assert.equal(initial.selected1976, 'false');
        assert.equal(initial.selected1931, 'true');
        assert.equal(initial.pane1976Hidden, true);
        assert.equal(initial.pane1931Hidden, false);
        assert.match(initial.coordinate, /^u′ /);
        assert.doesNotMatch(initial.coordinate, /--/);
        assert.ok(Math.abs(initial.rect.width - initial.rect.height) <= 1, 'CIE 1931 canvas must remain square');
        assert.ok(Math.abs(initial.backing.width / initial.backing.height - 1) <= 0.01,
            'CIE 1931 backing store must remain square');

        const workersBeforeSwitch = workerCount;
        await page.click('#chromaticity-tab-1976');
        await page.waitForFunction(() => !document.getElementById('chromaticity-pane-1976').hidden);
        await delay(100);

        const cie1976 = await page.evaluate(() => {
            const canvas = document.getElementById('professional-cie1976');
            const rect = canvas.getBoundingClientRect();
            return {
                selected1976: document.getElementById('chromaticity-tab-1976').getAttribute('aria-selected'),
                selected1931: document.getElementById('chromaticity-tab-1931').getAttribute('aria-selected'),
                pane1976Hidden: document.getElementById('chromaticity-pane-1976').hidden,
                pane1931Hidden: document.getElementById('chromaticity-pane-1931').hidden,
                coordinate: document.getElementById('chromaticity-summary-xy').textContent,
                duplicateCoordinate: Boolean(document.getElementById('cie1931-coordinate')),
                rect: { width: rect.width, height: rect.height },
                backing: { width: canvas.width, height: canvas.height },
                result: JSON.stringify(window.SpectralWorkspaceStore.getSnapshot().currentResult)
            };
        });

        assert.equal(cie1976.selected1976, 'true');
        assert.equal(cie1976.selected1931, 'false');
        assert.equal(cie1976.pane1976Hidden, false);
        assert.equal(cie1976.pane1931Hidden, true);
        assert.doesNotMatch(cie1976.coordinate, /--/);
        assert.equal(cie1976.duplicateCoordinate, false);
        assert.equal(cie1976.result, initial.result, 'chromaticity tab switching must preserve current result');
        assert.equal(workerCount, workersBeforeSwitch, 'chromaticity tab switching must not create workers');
        assert.ok(Math.abs(cie1976.rect.width - cie1976.rect.height) <= 1);
        assert.ok(Math.abs(cie1976.backing.width / cie1976.backing.height - 1) <= 0.01);
        await delay(80);

        await page.$eval('#cie1976-canvas-wrapper', wrapper => {
            wrapper.style.aspectRatio = '2 / 1';
        });
        await page.waitForFunction(() => {
            const rect = document.getElementById('cie1976-canvas-wrapper').getBoundingClientRect();
            return Math.abs(rect.width / rect.height - 2) <= 0.05;
        });
        await page.evaluate(() => window.SpectralProfessional.refresh());
        await page.waitForFunction(() => {
            const canvas = document.getElementById('professional-cie1976');
            return Math.abs(canvas.width / canvas.height - 2) <= 0.05;
        });
        await page.$eval('#cie1976-canvas-wrapper', wrapper => {
            wrapper.style.aspectRatio = '';
        });
        await page.waitForFunction(() => {
            const rect = document.getElementById('cie1976-canvas-wrapper').getBoundingClientRect();
            return Math.abs(rect.width / rect.height - 1) <= 0.01;
        });
        await page.evaluate(() => window.SpectralProfessional.refresh());
        await page.waitForFunction(() => {
            const canvas = document.getElementById('professional-cie1976');
            return Math.abs(canvas.width / canvas.height - 1) <= 0.01;
        }, { timeout: 1500 });

        await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
        await delay(120);
        const mobile = await page.evaluate(() => {
            const panel = document.getElementById('chromaticity-panel').getBoundingClientRect();
            const tabs = [...document.querySelectorAll('.chromaticity-tabs button')]
                .map(button => button.getBoundingClientRect());
            return {
                viewportWidth: document.documentElement.clientWidth,
                scrollWidth: document.documentElement.scrollWidth,
                panel: { left: panel.left, right: panel.right, width: panel.width },
                tabHeights: tabs.map(rect => rect.height)
            };
        });
        assert.equal(mobile.scrollWidth, mobile.viewportWidth, 'mobile page must not overflow horizontally');
        assert.ok(mobile.panel.left >= 0 && mobile.panel.right <= 390, 'chromaticity panel must fit mobile viewport');
        assert.ok(mobile.tabHeights.every(height => height >= 40), 'chromaticity tabs must be touch friendly');
        assert.deepEqual(pageErrors, [], `page errors: ${pageErrors.join('; ')}`);

        console.log('chromaticity panel tests passed');
    } finally {
        await browser.close();
        await new Promise(resolve => server.close(resolve));
    }
})().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
