'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const puppeteer = require('puppeteer');

const ROOT = __dirname;
const CORE_MODULES = [
    'SpectralMath',
    'ChromaticityDiagram',
    'ColourQuality',
    'CandidateShortlist',
    'METAMER_OPTIMIZER',
    'MetamerWorkerClient',
    'SpdImport',
    'SceneOptimizerCore',
    'SceneOptimizerWorkerClient',
    'MuseumLightData',
    'MuseumDamageModel',
    'MuseumOptimizer',
    'MuseumPanel',
    'CctJourney',
    'SPECTRAL_BUILD_INFO',
    'RECIPE_EXPORT',
    'ProfessionalDataLoader',
    'SpectralProfessional'
];

function createServer() {
    return require('./local-server.js').createLocalServer();
}

async function inspectPage(browser, url) {
    const page = await browser.newPage();
    const errors = [];
    const failedRequests = [];
    let workerCount = 0;
    page.on('pageerror', error => errors.push(error.message));
    page.on('workercreated', () => { workerCount += 1; });
    page.on('requestfailed', request => failedRequests.push({
        url: request.url(),
        error: request.failure() && request.failure().errorText
    }));
    try {
        await page.goto(url, { waitUntil: 'load', timeout: 30000 });
        await page.waitForFunction(() => document.querySelectorAll('[id^="ch-slider-"]').length === 4,
            { timeout: 15000 });
        await page.evaluate(() => document.getElementById('mode-checkbox').click());
        await page.waitForFunction(() => document.querySelectorAll('[id^="ch-slider-"]').length === 6,
            { timeout: 15000 });
        await page.click('[data-metamer-profile="saturation"]');
        await page.waitForFunction(() =>
            document.getElementById('metamer-status')?.textContent.startsWith('高饱和完成'),
        { timeout: 90000 });
        const state = await page.evaluate(moduleNames => ({
            protocol: location.protocol,
            readyState: document.readyState,
            modules: Object.fromEntries(moduleNames.map(name => [name, Boolean(window[name])])),
            channelCount: document.querySelectorAll('[id^="ch-slider-"]').length,
            metamerStatus: document.getElementById('metamer-status')?.textContent || '',
            professionalStatus: document.getElementById('professional-data-status')?.textContent || '',
            buildVersion: document.getElementById('build-version')?.textContent || '',
            bodyVisible: getComputedStyle(document.body).visibility !== 'hidden' &&
                getComputedStyle(document.body).display !== 'none',
            appReady: document.documentElement.dataset.appReady || '',
            loadingOverlayExists: Boolean(document.getElementById('app-loading-overlay')),
            compatibilityWarning: document.getElementById('local-file-warning')?.textContent.trim() || '',
            compatibilityWarningHidden: Boolean(document.getElementById('local-file-warning')?.hidden)
        }), CORE_MODULES);
        return { state, errors, failedRequests, workerCount };
    } finally {
        await page.close();
    }
}

(async () => {
    const server = createServer();
    await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', resolve);
    });
    const browser = await puppeteer.launch({ headless: true });
    try {
        const httpResult = await inspectPage(browser, `http://127.0.0.1:${server.address().port}/`);
        const fileUrl = `file:///${path.resolve(ROOT, 'index.html').replace(/\\/g, '/')}`;
        const fileResult = await inspectPage(browser, fileUrl);
        console.log(JSON.stringify({ httpResult, fileResult }, null, 2));

        assert.deepEqual(fileResult.state.modules, httpResult.state.modules,
            'core module availability must be consistent between HTTP and local-file loading');
        assert.ok(Object.values(fileResult.state.modules).every(Boolean),
            'all declared modules must load in local-file mode');
        assert.equal(fileResult.state.channelCount, httpResult.state.channelCount,
            'channel controls must initialize consistently');
        assert.match(httpResult.state.professionalStatus, /已加载/,
            'HTTP loading must include the CIE S 026 professional data');
        assert.equal(httpResult.state.appReady, 'true',
            'HTTP mode must reach the complete ready state');
        assert.ok(httpResult.workerCount >= 1,
            'HTTP high-saturation mode must use a Web Worker');
        assert.equal(httpResult.state.compatibilityWarningHidden, true,
            'HTTP mode must not show the local-file compatibility warning');
        assert.match(fileResult.state.professionalStatus, /start-local\.bat/,
            'local-file mode must identify the supported local-server entry');
        assert.equal(fileResult.state.metamerStatus, httpResult.state.metamerStatus,
            'local-file fallback must produce the same high-saturation result');
        assert.equal(fileResult.state.appReady, 'degraded',
            'local-file mode must reach an explicit compatibility state');
        assert.equal(httpResult.state.loadingOverlayExists, false,
            'HTTP mode must not create a full-screen loading overlay');
        assert.equal(fileResult.state.loadingOverlayExists, false,
            'local-file mode must not create a full-screen loading overlay');
        assert.equal(httpResult.state.bodyVisible, true,
            'HTTP workbench must remain visible during module loading');
        assert.equal(fileResult.state.bodyVisible, true,
            'local-file workbench must remain visible in compatibility mode');
        assert.equal(fileResult.state.compatibilityWarningHidden, false,
            'local-file mode must show a clear launch warning');
        assert.match(fileResult.state.compatibilityWarning, /HTTP|start-local/i,
            'local-file warning must identify the supported local-server launch method');
        assert.doesNotMatch(fileResult.state.compatibilityWarning, /Electron/i,
            'local-file warning must not advertise the removed Electron package');
        assert.deepEqual(httpResult.failedRequests, [],
            `HTTP loading must not leave failed resources: ${JSON.stringify(httpResult.failedRequests)}`);
        assert.deepEqual(fileResult.failedRequests, [],
            `local-file mode must avoid failed resource requests: ${JSON.stringify(fileResult.failedRequests)}`);
        assert.deepEqual(fileResult.errors, [],
            `local-file loading must not raise page errors: ${fileResult.errors.join('; ')}`);
    } finally {
        await browser.close();
        await new Promise(resolve => server.close(resolve));
    }
})().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
