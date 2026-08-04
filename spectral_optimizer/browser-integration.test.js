'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const puppeteer = require('puppeteer');

const ROOT = __dirname;
const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.csv': 'text/csv; charset=utf-8',
    '.png': 'image/png',
    '.svg': 'image/svg+xml'
};

function createServer() {
    return http.createServer((request, response) => {
        const pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
        const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
        const filePath = path.resolve(ROOT, relative);
        if (!filePath.startsWith(ROOT + path.sep) && filePath !== path.join(ROOT, 'index.html')) {
            response.writeHead(403).end('forbidden');
            return;
        }
        fs.readFile(filePath, (error, data) => {
            if (error) {
                response.writeHead(404).end('not found');
                return;
            }
            response.setHeader('Content-Type', MIME[path.extname(filePath)] || 'application/octet-stream');
            response.end(data);
        });
    });
}

(async () => {
    const server = createServer();
    await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', resolve);
    });

    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    const pageErrors = [];
    let workerCount = 0;
    page.on('pageerror', error => pageErrors.push(error.message));
    page.on('workercreated', () => { workerCount += 1; });

    try {
        const url = `http://127.0.0.1:${server.address().port}/`;
        await page.goto(url, { waitUntil: 'load' });
        await page.waitForFunction(() =>
            document.getElementById('professional-data-status') &&
            document.getElementById('professional-data-status').textContent.includes('已加载'),
        { timeout: 10000 });

        const initial = await page.evaluate(() => ({
            profile: document.querySelector('input[name="metamer-profile"]:checked')?.value,
            selected: document.querySelector('.metamer-profile-button.is-selected')?.dataset.metamerProfile,
            cctMin: document.getElementById('target-cct-slider')?.min,
            buildVersion: document.getElementById('build-version')?.textContent
        }));
        assert.equal(initial.profile, 'off');
        assert.equal(initial.selected, 'off');
        assert.equal(initial.cctMin, '1600');
        assert.match(initial.buildVersion, /^v1\.0\.0 · ALG 2026\.07-p2/,
            'browser footer must display the shared build version');

        await page.evaluate(() => document.getElementById('mode-checkbox').click());
        await page.waitForFunction(() => document.querySelectorAll('[id^="ch-slider-"]').length === 6,
            { timeout: 10000 });

        const clickStarted = Date.now();
        await page.click('[data-metamer-profile="saturation"]');
        const clickElapsedMs = Date.now() - clickStarted;
        await page.waitForFunction(() =>
            document.getElementById('metamer-status')?.textContent.startsWith('高饱和完成'),
        { timeout: 90000 });

        const saturation = await page.evaluate(() => ({
            profile: document.querySelector('input[name="metamer-profile"]:checked')?.value,
            selected: document.querySelector('.metamer-profile-button.is-selected')?.dataset.metamerProfile,
            status: document.getElementById('metamer-status')?.textContent,
            duvDisabled: document.getElementById('target-duv-slider')?.disabled,
            rg: document.getElementById('val-rg')?.textContent,
            rf: document.getElementById('val-rf')?.textContent,
            ra: document.getElementById('val-cri')?.textContent,
            r9: document.getElementById('val-r9')?.textContent,
            deltaUv: Number(document.getElementById('metamer-colour-delta')?.dataset.deltaUv)
        }));
        assert.equal(saturation.profile, 'saturation');
        assert.equal(saturation.selected, 'saturation');
        assert.equal(saturation.duvDisabled, true, 'high-saturation mode must lock Duv');
        assert.match(saturation.status, /Rg \d+ · Rf \d+ · Ra \d+ · R9 -?\d+/,
            'high-saturation status must report all four colour metrics');
        const reported = saturation.status.match(/Rg (\d+) · Rf (\d+) · Ra (\d+) · R9 (-?\d+)/);
        assert.equal(Number.parseInt(saturation.rg, 10), Number(reported[1]),
            'Rg card must be committed before the completion status is announced');
        assert.equal(Number.parseInt(saturation.rf, 10), Number(reported[2]),
            'Rf card must be committed before the completion status is announced');
        assert.equal(Number.parseInt(saturation.ra, 10), Number(reported[3]),
            'Ra card must be committed before the completion status is announced');
        assert.equal(Number.parseInt(saturation.r9, 10), Number(reported[4]),
            'R9 card must be committed before the completion status is announced');
        assert.ok(Number.isFinite(saturation.deltaUv) && saturation.deltaUv <= 0.0005 + 1e-9,
            `high-saturation colour point drifted by ${saturation.deltaUv}`);
        assert.ok(workerCount >= 1, 'browser mode must create a metamer Web Worker');

        await page.click('[data-metamer-profile="saturation"]');
        await page.click('[data-metamer-profile="fidelity"]');
        await page.waitForFunction(() =>
            document.getElementById('metamer-status')?.textContent.startsWith('高显色完成'),
        { timeout: 90000 });
        const fidelity = await page.evaluate(() => ({
            profile: document.querySelector('input[name="metamer-profile"]:checked')?.value,
            selected: document.querySelector('.metamer-profile-button.is-selected')?.dataset.metamerProfile,
            status: document.getElementById('metamer-status')?.textContent,
            deltaUv: Number(document.getElementById('metamer-colour-delta')?.dataset.deltaUv)
        }));
        assert.equal(fidelity.profile, 'fidelity', 'latest profile must remain active');
        assert.equal(fidelity.selected, 'fidelity', 'latest profile button must remain selected');
        assert.match(fidelity.status, /^高显色完成 · Rf \d+ · Ra \d+ · R9 -?\d+$/,
            'a stale saturation result must not replace the latest fidelity result');
        assert.ok(Number.isFinite(fidelity.deltaUv) && fidelity.deltaUv <= 0.0005 + 1e-9,
            `high-fidelity colour point drifted by ${fidelity.deltaUv}`);
        assert.ok(workerCount >= 3, 'rapid profile switching must create replacement workers');

        await page.click('[data-metamer-profile="off"]');
        await page.waitForFunction(() =>
            document.querySelector('input[name="metamer-profile"]:checked')?.value === 'off');
        const regular = await page.evaluate(() => ({
            status: document.getElementById('metamer-status')?.textContent,
            duvDisabled: document.getElementById('target-duv-slider')?.disabled,
            professional: document.getElementById('professional-data-status')?.textContent
        }));
        assert.equal(regular.status, '常规模式');
        assert.equal(regular.duvDisabled, false, 'regular mode must unlock Duv');
        assert.match(regular.professional, /已加载/, 'professional CIE data must load over HTTP');

        const exportedWorkbook = await page.evaluate(async () => {
            let capturedBlob = null;
            const originalCreateObjectUrl = URL.createObjectURL;
            const originalRevokeObjectUrl = URL.revokeObjectURL;
            const originalAnchorClick = HTMLAnchorElement.prototype.click;
            URL.createObjectURL = blob => {
                capturedBlob = blob;
                return 'blob:captured-recipe';
            };
            URL.revokeObjectURL = () => {};
            HTMLAnchorElement.prototype.click = function() {};
            try {
                document.getElementById('export-recipe-btn').click();
                document.getElementById('recipe-export-start').click();
                const timeoutAt = performance.now() + 10000;
                while (!capturedBlob && performance.now() < timeoutAt) {
                    await new Promise(resolve => setTimeout(resolve, 20));
                }
                const bytes = capturedBlob ? new Uint8Array(await capturedBlob.arrayBuffer()) : null;
                return {
                    type: capturedBlob?.type || '',
                    signature: bytes ? Array.from(bytes.slice(0, 4)) : [],
                    debug: window.RECIPE_BATCH_EXPORT?.getDebugState() || null
                };
            } finally {
                URL.createObjectURL = originalCreateObjectUrl;
                URL.revokeObjectURL = originalRevokeObjectUrl;
                HTMLAnchorElement.prototype.click = originalAnchorClick;
            }
        });
        assert.equal(exportedWorkbook.type,
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        assert.deepEqual(exportedWorkbook.signature, [80, 75, 3, 4], 'XLSX must use a ZIP container');
        assert.deepEqual(exportedWorkbook.debug?.sheetNames, ['说明', '单点配方', '亮度配方', '光谱数据', '亮度光谱']);
        assert.equal(exportedWorkbook.debug?.rowCounts?.[1], 1);
        assert.equal(exportedWorkbook.debug?.rowCounts?.[2], 7);
        assert.equal(exportedWorkbook.debug?.rowCounts?.[3], 81);
        assert.equal(exportedWorkbook.debug?.rowCounts?.[4], 7);
        assert.deepEqual(pageErrors, [], `browser page errors: ${pageErrors.join('; ')}`);

        console.log('browser integration tests: PASS');
        console.log(JSON.stringify({ clickElapsedMs, workerCount, saturation, fidelity }, null, 2));
    } finally {
        await browser.close();
        await new Promise(resolve => server.close(resolve));
    }
})().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
