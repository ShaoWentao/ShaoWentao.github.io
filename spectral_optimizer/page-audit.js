'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const puppeteer = require('puppeteer');
const { createLocalServer } = require('./local-server.js');

const VIEWPORTS = [
    { name: 'desktop-1600', width: 1600, height: 900 },
    { name: 'desktop-1366', width: 1366, height: 768 },
    { name: 'tablet-landscape', width: 1024, height: 768 },
    { name: 'tablet-portrait', width: 768, height: 1024 },
    { name: 'mobile', width: 390, height: 844 }
];

async function startServer() {
    const server = createLocalServer();
    await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', resolve);
    });
    return server;
}

async function waitReady(page) {
    await page.waitForFunction(() => document.documentElement.dataset.appReady === 'true', { timeout: 30000 });
    await page.waitForSelector('.channel-row');
    await new Promise(resolve => setTimeout(resolve, 250));
}

async function setRange(page, selector, value) {
    await page.$eval(selector, (el, next) => {
        el.value = String(next);
        el.dispatchEvent(new Event('input', { bubbles: true }));
    }, value);
    await new Promise(resolve => setTimeout(resolve, 350));
}

async function collectLayout(page, viewport) {
    return page.evaluate(({ name, width, height }) => {
        const rectOf = element => {
            if (!element) return null;
            const rect = element.getBoundingClientRect();
            return {
                x: Math.round(rect.x * 10) / 10,
                y: Math.round(rect.y * 10) / 10,
                width: Math.round(rect.width * 10) / 10,
                height: Math.round(rect.height * 10) / 10,
                bottom: Math.round(rect.bottom * 10) / 10
            };
        };
        const visible = element => {
            if (!element || element.closest('details:not([open])')) return false;
            const style = getComputedStyle(element);
            const rect = element.getBoundingClientRect();
            return !element.hidden && style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
        };
        const majorSelectors = [
            '#workbench-sidebar', '#workbench-summary', '#workbench-results',
            '#spd-panel', '#chromaticity-panel', '#emitter-preview', '#analysis-workspace',
            '#analysis-pane-colour', '#analysis-pane-material',
            '#material-panel', '#app-footer'
        ];
        const panels = Object.fromEntries(majorSelectors.map(selector => [selector, rectOf(document.querySelector(selector))]));
        const interactive = Array.from(document.querySelectorAll('button, input:not([type="hidden"]), select, summary'))
            .filter(visible)
            .map(element => {
                const rect = element.getBoundingClientRect();
                return {
                    tag: element.tagName.toLowerCase(),
                    id: element.id || '',
                    className: String(element.className || '').slice(0, 80),
                    width: Math.round(rect.width),
                    height: Math.round(rect.height),
                    text: (element.getAttribute('aria-label') || element.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 70)
                };
            });
        const undersized = interactive.filter(item => {
            if (item.tag === 'input') return false;
            return item.width < 28 || item.height < 28;
        });
        const clipped = Array.from(document.querySelectorAll('button, label, h1, h2, h3, p, strong, small, span'))
            .filter(visible)
            .filter(element => {
                if (element.classList.contains('visually-hidden')) return false;
                if (element.closest('.material-category-tabs, .material-selector, .schedule-stage-list')) return false;
                const style = getComputedStyle(element);
                if (style.whiteSpace === 'nowrap' && style.overflow === 'hidden' && style.textOverflow === 'ellipsis') return false;
                return element.scrollWidth > element.clientWidth + 3 || element.scrollHeight > element.clientHeight + 3;
            })
            .slice(0, 30)
            .map(element => ({
                tag: element.tagName.toLowerCase(),
                id: element.id || '',
                className: String(element.className || '').slice(0, 80),
                text: (element.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 90),
                client: [element.clientWidth, element.clientHeight],
                scroll: [element.scrollWidth, element.scrollHeight]
            }));
        return {
            viewport: { name, width, height },
            document: {
                clientWidth: document.documentElement.clientWidth,
                scrollWidth: document.documentElement.scrollWidth,
                scrollHeight: document.documentElement.scrollHeight,
                horizontalOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
            },
            panels,
            interactiveCount: interactive.length,
            undersized: undersized.slice(0, 40),
            clipped,
            channelCount: document.querySelectorAll('.channel-row').length,
            scheduleRows: document.querySelectorAll('.schedule-stage-row').length,
            pastelCount: document.querySelectorAll('.pastel-color-card').length,
            materialCount: document.querySelectorAll('#material-selector > button:not(.import-material-btn)').length
        };
    }, viewport);
}

async function runWorkflow(page, tempSpdPath) {
    const findings = [];
    const state = label => page.evaluate(labelName => ({
        label: labelName,
        channels: document.querySelectorAll('.channel-row').length,
        cctTarget: document.getElementById('target-cct-val')?.textContent,
        duvTarget: document.getElementById('target-duv-val')?.textContent,
        cct: document.getElementById('summary-cct-value')?.textContent,
        duv: document.getElementById('summary-duv-value')?.textContent,
        rg: document.getElementById('summary-rg-value')?.textContent,
        rf: document.getElementById('summary-rf-value')?.textContent,
        medi: document.getElementById('summary-medi-value')?.textContent,
        cs: document.getElementById('summary-cs-value')?.textContent,
        mel: document.getElementById('summary-mel-value')?.textContent,
        metamer: document.getElementById('metamer-status')?.textContent,
        schedule: document.getElementById('schedule-current-stage')?.textContent,
        journey: document.getElementById('cct-journey-status')?.textContent,
        importStatus: document.getElementById('spd-import-status')?.textContent,
        material: document.getElementById('material-detail-title')?.textContent,
        analysisTab: window.AnalysisWorkspace?.current?.() || '',
        details: {
            contribution: document.getElementById('spd-contribution-details')?.open || false
        }
    }), label);

    findings.push(await state('initial'));

    await page.$eval('#mode-checkbox', element => {
        element.checked = true;
        element.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await new Promise(resolve => setTimeout(resolve, 400));
    findings.push(await state('six-channel'));

    await page.click('[data-preset="cct-3000"]');
    await new Promise(resolve => setTimeout(resolve, 700));
    findings.push(await state('preset-3000'));

    await setRange(page, '#target-duv-slider', 0.005);
    findings.push(await state('duv-positive'));

    await page.$eval('#pastel-target-details', element => { element.open = true; element.dispatchEvent(new Event('toggle')); });
    await page.click('.pastel-color-card');
    await new Promise(resolve => setTimeout(resolve, 800));
    findings.push(await state('pastel'));

    await setRange(page, '#eye-illuminance', 600);
    await setRange(page, '#exposure-duration', 2);
    await page.select('#visual-field-factor', '2');
    await new Promise(resolve => setTimeout(resolve, 250));
    findings.push(await state('circadian-conditions'));

    await page.click('#emitter-preview .schedule-preview-btn');
    await new Promise(resolve => setTimeout(resolve, 900));
    findings.push(await state('schedule-preview'));

    await page.$eval('#schedule-auto-toggle', element => {
        element.checked = true;
        element.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await new Promise(resolve => setTimeout(resolve, 650));
    const scheduleClock = await page.$eval('#schedule-clock', el => el.textContent);
    await page.$eval('#schedule-auto-toggle', element => {
        element.checked = false;
        element.dispatchEvent(new Event('change', { bubbles: true }));
    });
    findings.push({ label: 'schedule-auto', scheduleClock });

    await page.click('#cct-journey-play');
    await new Promise(resolve => setTimeout(resolve, 700));
    findings.push(await state('journey-playing'));
    await page.click('#cct-journey-stop');

    await page.$eval('#d65-toggle', element => {
        element.checked = true;
        element.dispatchEvent(new Event('change', { bubbles: true }));
    });
    findings.push({ label: 'd65', checked: await page.$eval('#d65-toggle', el => el.checked) });

    await page.click('#analysis-tab-material');
    await page.waitForFunction(() => !document.getElementById('analysis-pane-material').hidden);
    await page.click('.material-category-tabs [data-category="stone"]');
    await new Promise(resolve => setTimeout(resolve, 250));
    findings.push(await state('material-stone'));
    await page.click('.material-category-tabs [data-category="user"]');
    await page.click('.import-material-btn');
    const uploadOpen = await page.$eval('#material-upload-overlay', el => !el.hidden);
    await page.click('#upload-dialog-cancel');
    findings.push({ label: 'material-upload-dialog', open: uploadOpen });
    await page.click('#analysis-tab-colour');
    await page.waitForFunction(() => !document.getElementById('analysis-pane-colour').hidden);

    await page.evaluate(() => {
        const details = document.getElementById('spd-contribution-details');
        if (!details) return;
        details.open = true;
        details.dispatchEvent(new Event('toggle'));
    });
    await new Promise(resolve => setTimeout(resolve, 250));
    findings.push({
        ...(await state('professional-details-open')),
        alphaCount: await page.$$eval('[data-action-curve-der]', nodes => nodes.length),
        alphaValues: await page.$$eval('[data-action-curve-der]', nodes => nodes.map(node => node.textContent.trim())),
        contributionCount: await page.$$eval('#channel-contribution-list .channel-contribution-row', nodes => nodes.length),
        xyz: await page.$eval('#professional-xyz', element => element.textContent.trim())
    });

    const actionCurveMenu = await page.$('#action-curve-menu');
    if (actionCurveMenu) {
        await page.click('#action-curve-menu > summary');
        const checkbox = await page.$('#action-curve-menu input[type="checkbox"]');
        if (checkbox) await checkbox.click();
    }
    findings.push({ label: 'action-curves', menuExists: Boolean(actionCurveMenu) });

    await page.click('[data-metamer-profile="fidelity"]');
    try {
        await page.waitForFunction(() => /完成|返回常规|无效|未找到/.test(document.getElementById('metamer-status')?.textContent || ''), { timeout: 30000 });
        findings.push(await state('fidelity'));
    } catch (error) {
        findings.push({ ...(await state('fidelity-timeout')), timeout: true });
    }

    await page.click('[data-metamer-profile="saturation"]');
    try {
        await page.waitForFunction(() => /完成|返回常规|无效|未找到/.test(document.getElementById('metamer-status')?.textContent || ''), { timeout: 30000 });
        findings.push(await state('saturation'));
    } catch (error) {
        findings.push({ ...(await state('saturation-timeout')), timeout: true });
    }

    await page.$eval('#export-recipe-btn', button => {
        window.__auditDownload = null;
        const original = HTMLAnchorElement.prototype.click;
        HTMLAnchorElement.prototype.click = function () {
            window.__auditDownload = { download: this.download, href: this.href };
            HTMLAnchorElement.prototype.click = original;
        };
        button.click();
    });
    await page.click('#recipe-export-start');
    await page.waitForFunction(() => {
        const state = window.RECIPE_BATCH_EXPORT?.getDebugState();
        return window.__auditDownload && state && !state.running && state.completed;
    }, { timeout: 30000 });
    findings.push({
        label: 'export',
        download: await page.evaluate(() => window.__auditDownload),
        sheets: await page.evaluate(() => window.RECIPE_BATCH_EXPORT?.getDebugState().sheetNames || [])
    });
    await page.click('#recipe-export-close');

    const spdInput = await page.$('#spd-import-input');
    await spdInput.uploadFile(tempSpdPath);
    await new Promise(resolve => setTimeout(resolve, 700));
    findings.push(await state('spd-import'));

    await page.click('[data-preset="reset"]');
    await new Promise(resolve => setTimeout(resolve, 350));
    findings.push(await state('reset'));

    return findings;
}

(async () => {
    const server = await startServer();
    const port = server.address().port;
    const url = `http://127.0.0.1:${port}/`;
    const tempSpdPath = path.join(os.tmpdir(), `spectral-audit-${Date.now()}.csv`);
    const rows = ['wavelength,R,G,B'];
    for (let wavelength = 380; wavelength <= 780; wavelength += 5) {
        const gaussian = (peak, sigma) => Math.exp(-0.5 * Math.pow((wavelength - peak) / sigma, 2));
        rows.push(`${wavelength},${gaussian(630, 18)},${gaussian(530, 22)},${gaussian(460, 18)}`);
    }
    fs.writeFileSync(tempSpdPath, rows.join('\n'), 'utf8');

    const browser = await puppeteer.launch({ headless: true });
    const pageErrors = [];
    const consoleErrors = [];
    try {
        const workflowPage = await browser.newPage();
        workflowPage.on('pageerror', error => pageErrors.push(error.message));
        workflowPage.on('console', message => {
            if (message.type() === 'error') consoleErrors.push(message.text());
        });
        await workflowPage.setViewport({ width: 1600, height: 900, deviceScaleFactor: 1 });
        await workflowPage.goto(url, { waitUntil: 'networkidle0' });
        await waitReady(workflowPage);
        const workflow = await runWorkflow(workflowPage, tempSpdPath);

        const layouts = [];
        for (const viewport of VIEWPORTS) {
            const page = await browser.newPage();
            page.on('pageerror', error => pageErrors.push(`${viewport.name}: ${error.message}`));
            await page.setViewport({ width: viewport.width, height: viewport.height, deviceScaleFactor: 1 });
            await page.goto(url, { waitUntil: 'networkidle0' });
            await waitReady(page);
            layouts.push(await collectLayout(page, viewport));
            await page.close();
        }

        console.log(JSON.stringify({ workflow, layouts, pageErrors, consoleErrors }, null, 2));
    } finally {
        await browser.close();
        await new Promise(resolve => server.close(resolve));
        fs.rmSync(tempSpdPath, { force: true });
    }
})().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
