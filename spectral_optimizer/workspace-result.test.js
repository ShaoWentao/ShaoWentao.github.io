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
        await page.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil: 'networkidle0' });
        await page.waitForFunction(() => document.documentElement.dataset.appReady === 'true');

        const initial = await page.evaluate(() => window.SpectralWorkspaceStore?.getSnapshot().currentResult);
        assert.ok(initial, 'workspace store must receive the current calculation result');
        assert.equal(initial.channelCount, 4);
        assert.equal(initial.source.type, 'built-in');
        assert.match(initial.source.name, /RGBW|4/);
        assert.equal(initial.target.colourMode, 'white');
        assert.equal(initial.target.profile, 'standard');

        assert.equal(initial.spectrum.wavelengths.length, 401);
        assert.equal(initial.spectrum.values.length, 401);
        assert.ok(initial.spectrum.values.some(value => value > 0));

        for (const key of ['x', 'y', 'u', 'v', 'up', 'vp']) {
            assert.ok(Number.isFinite(initial.chromaticity[key]), `${key} must be finite`);
        }
        for (const key of ['cct', 'duv', 'ra', 'r9', 'rf', 'rg', 'melanopicDER', 'melanopicEDI', 'cla2', 'cs']) {
            assert.ok(Number.isFinite(initial.metrics[key]), `${key} must be finite`);
        }

        assert.equal(initial.channels.length, 4);
        for (const channel of initial.channels) {
            assert.equal(typeof channel.id, 'string');
            assert.equal(typeof channel.name, 'string');
            assert.ok(Number.isFinite(channel.duty));
            assert.equal(channel.spd.length, 401);
        }

        const cloneCheck = await page.evaluate(() => {
            const first = window.SpectralWorkspaceStore.getSnapshot().currentResult;
            const originalSpd = first.spectrum.values[0];
            const originalChannelSpd = first.channels[0].spd[0];
            first.spectrum.values[0] = 999;
            first.channels[0].spd[0] = 999;
            first.metrics.cct = 999;
            const second = window.SpectralWorkspaceStore.getSnapshot().currentResult;
            return {
                originalSpd,
                originalChannelSpd,
                secondSpd: second.spectrum.values[0],
                secondChannelSpd: second.channels[0].spd[0],
                secondCct: second.metrics.cct
            };
        });
        assert.equal(cloneCheck.secondSpd, cloneCheck.originalSpd);
        assert.equal(cloneCheck.secondChannelSpd, cloneCheck.originalChannelSpd);
        assert.notEqual(cloneCheck.secondCct, 999);

        const resultAfterRender = await page.evaluate(() => JSON.stringify(
            window.SpectralWorkspaceStore.getSnapshot().currentResult
        ));
        assert.equal(resultAfterRender, JSON.stringify(initial),
            'reading the single research workbench must not mutate the current result snapshot');

        await page.click('[data-preset="reset"]');
        await page.waitForFunction(() => {
            const result = window.SpectralWorkspaceStore?.getSnapshot().currentResult;
            return result && result.spectrum.values.every(value => value === 0);
        });
        const empty = await page.evaluate(() => window.SpectralWorkspaceStore.getSnapshot().currentResult);
        assert.equal(empty.channelCount, 4);
        assert.equal(empty.metrics.cct, null);
        assert.equal(empty.metrics.duv, null);
        assert.equal(empty.metrics.ra, null);
        assert.equal(empty.chromaticity.x, null);
        assert.equal(empty.chromaticity.u, null);
        assert.equal(empty.channels.length, 4);

        console.log('workspace result tests passed');
    } finally {
        await browser.close();
        await new Promise(resolve => server.close(resolve));
    }
})().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
