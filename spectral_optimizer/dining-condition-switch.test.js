'use strict';

const assert = require('node:assert/strict');
const puppeteer = require('puppeteer');
const { createLocalServer } = require('./local-server.js');

function channelValues(snapshot) {
    return (snapshot?.channels || []).map(channel => Number(channel.value));
}

function assertChannelsClose(actual, expected, message) {
    assert.equal(actual.length, expected.length, message + ' (channel count)');
    actual.forEach((value, index) => {
        assert.ok(Math.abs(value - expected[index]) <= 0.05,
            `${message}: channel ${index} expected ${expected[index]}, got ${value}`);
    });
}

(async () => {
    const server = createLocalServer();
    await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', resolve);
    });
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    async function run({ mode, cuisine, level = 'recommended', goal = 'preference' }) {
        await page.select('#dining-target-mode', mode);
        await page.select('#dining-cuisine-profile', cuisine);
        await page.select('#dining-optimization-goal', goal);
        if (goal === 'preference') await page.select('#dining-preference-level', level);
        await page.evaluate(() => {
            window.__conditionSwitchResult = null;
            const listener = event => {
                if (!event.detail?.cuisineProfileId) return;
                window.__conditionSwitchResult = event.detail;
                document.removeEventListener('spectral-material-optimization-result', listener);
            };
            document.addEventListener('spectral-material-optimization-result', listener);
        });
        await page.click('#dining-light-apply');
        await page.waitForFunction(() => Boolean(window.__conditionSwitchResult), { timeout: 90000 });
        await page.waitForFunction(() => document.getElementById('dining-light-apply')?.disabled === false, { timeout: 90000 });
        return page.evaluate(() => window.__conditionSwitchResult);
    }

    try {
        await page.setViewport({ width: 1600, height: 1000 });
        await page.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil: 'networkidle0' });
        await page.waitForFunction(() => document.documentElement.dataset.appReady === 'true');
        await page.click('#analysis-tab-dining');
        await page.waitForFunction(() => !document.getElementById('analysis-pane-dining').hidden);

        assert.equal(await page.$('#dining-light-profile'), null,
            'application-scene selector must be removed from the dining workbench');

        const comprehensive = await run({ mode: 'recommended', cuisine: 'comprehensive', level: 'recommended' });
        const sourceChannels = channelValues(comprehensive.beforeSnapshot);
        const sourceCct = Number(comprehensive.beforeSnapshot.metrics.cct);
        const sourceY = Number(comprehensive.beforeSnapshot.metrics.photopicY);

        const western = await run({ mode: 'recommended', cuisine: 'western', level: 'vivid' });
        const japanese = await run({ mode: 'recommended', cuisine: 'japanese', level: 'soft' });
        const current = await run({ mode: 'current', cuisine: 'sichuan_hunan', level: 'vivid' });
        const comprehensiveAgain = await run({ mode: 'recommended', cuisine: 'comprehensive', level: 'recommended' });

        assert.equal(western.cuisineProfileId, 'western');
        assert.equal(japanese.cuisineProfileId, 'japanese');
        assert.equal(current.cuisineProfileId, 'sichuan_hunan');
        assert.equal(comprehensiveAgain.cuisineProfileId, 'comprehensive');

        [western, japanese, current, comprehensiveAgain].forEach((result, index) => {
            assertChannelsClose(channelValues(result.beforeSnapshot), sourceChannels,
                `condition switch run ${index + 2} must reuse the original dining source recipe`);
        });

        assert.ok(Math.abs(Number(current.referenceCct) - sourceCct) <= 5,
            'current-colour-point mode must use the original dining source colour point');

        assert.ok(Math.abs(Number(comprehensive.referenceCct) - 3500) <= 1);
        assert.ok(Math.abs(Number(western.referenceCct) - 2700) <= 1);
        assert.ok(Math.abs(Number(japanese.referenceCct) - 4000) <= 1);

        [comprehensive, western, japanese, comprehensiveAgain].forEach(result => {
            assert.ok(Math.abs(Number(result.afterSnapshot.metrics.cct) - Number(result.referenceCct)) <= 100,
                `${result.cuisineProfileId} must stay near its cuisine-recommended CCT`);
            assert.ok(Math.abs(Number(result.afterSnapshot.metrics.duv) - Number(result.referenceDuv)) <= 0.0015,
                `${result.cuisineProfileId} must stay within the cuisine-recommended Duv tolerance`);
            const expectedChange = (Number(result.afterSnapshot.metrics.photopicY) / sourceY - 1) * 100;
            assert.ok(Math.abs(Number(result.relativeOutputChangePercent) - expectedChange) <= 0.05,
                `${result.cuisineProfileId} output change must be measured from the common source baseline`);
        });

        assertChannelsClose(
            channelValues(comprehensiveAgain.afterSnapshot),
            channelValues(comprehensive.afterSnapshot),
            'returning to the same cuisine and level must reproduce the same recipe'
        );

        console.log('dining condition-switch regression tests passed');
    } finally {
        await page.close();
        await browser.close();
        await new Promise(resolve => server.close(resolve));
    }
})().catch(error => {
    console.error(error);
    process.exit(1);
});
