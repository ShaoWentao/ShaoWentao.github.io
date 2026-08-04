'use strict';
const assert = require('node:assert/strict');
const puppeteer = require('puppeteer');
const { createLocalServer } = require('./local-server.js');

const VIEWPORTS = [
  { name: 'desktop-1600', width: 1600, height: 900, summaryColumns: 7, shellColumns: 2, chartsSideBySide: true },
  { name: 'desktop-1366', width: 1366, height: 768, summaryColumns: 4, shellColumns: 2, chartsSideBySide: true },
  { name: 'tablet-landscape', width: 1024, height: 768, summaryColumns: 4, shellColumns: 2, chartsSideBySide: false },
  { name: 'tablet-portrait', width: 768, height: 1024, summaryColumns: 4, shellColumns: 1, chartsSideBySide: false },
  { name: 'mobile', width: 390, height: 844, summaryColumns: 2, shellColumns: 1, chartsSideBySide: false }
];

function delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
function columnCount(template) { return template.split(/\s+/).filter(Boolean).length; }

(async () => {
  const server = createLocalServer();
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const browser = await puppeteer.launch({ headless: true });
  try {
    const results = [];
    for (const viewport of VIEWPORTS) {
      const page = await browser.newPage();
      const pageErrors = [];
      page.on('pageerror', error => pageErrors.push(error.message));
      await page.setViewport({ width: viewport.width, height: viewport.height });
      await page.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil: 'networkidle0' });
      await page.waitForFunction(() => document.documentElement.dataset.appReady === 'true');
      await delay(120);

      const data = await page.evaluate(() => {
        function rect(id) {
          const element = document.getElementById(id);
          const box = element.getBoundingClientRect();
          return { left: box.left, top: box.top, right: box.right, bottom: box.bottom, width: box.width, height: box.height };
        }
        const shell = document.getElementById('app-main');
        const summary = document.getElementById('workbench-summary');
        const spd = rect('spd-panel');
        const chromaticity = rect('chromaticity-panel');
        const currentLight = rect('emitter-preview');
        const analysis = rect('analysis-workspace');
        const materialPanel = document.getElementById('material-panel');
        const visibleControls = [...document.querySelectorAll('#workbench-sidebar button, #workbench-sidebar select, .analysis-workspace-tabs button')]
          .filter(element => {
            const style = getComputedStyle(element);
            const box = element.getBoundingClientRect();
            return style.display !== 'none' && style.visibility !== 'hidden' && box.width > 0 && box.height > 0 && !element.closest('details:not([open])');
          })
          .map(element => ({ id: element.id, className: String(element.className), height: element.getBoundingClientRect().height }));
        return {
          shellColumns: getComputedStyle(shell).gridTemplateColumns.split(/\s+/).filter(Boolean).length,
          summaryColumns: getComputedStyle(summary).gridTemplateColumns.split(/\s+/).filter(Boolean).length,
          shell: rect('app-main'),
          sidebar: rect('workbench-sidebar'),
          results: rect('workbench-results'),
          spd,
          chromaticity,
          currentLight,
          analysis,
          materialParent: materialPanel.parentElement?.id || '',
          materialPaneHidden: document.getElementById('analysis-pane-material').hidden,
          visibleControls,
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          activePane: [...document.querySelectorAll('[data-analysis-pane]')].filter(pane => !pane.hidden).map(pane => pane.dataset.analysisPane),
          summaryValues: [...document.querySelectorAll('.summary-card strong')].map(element => element.textContent)
        };
      });

      assert.equal(data.overflow, 0, `${viewport.name} horizontal overflow: ${JSON.stringify(data)}`);
      assert.equal(data.shellColumns, viewport.shellColumns, `${viewport.name} shell columns`);
      assert.equal(data.summaryColumns, viewport.summaryColumns, `${viewport.name} summary columns`);
      assert.deepEqual(data.activePane, ['colour']);
      assert.ok(data.shell.left >= 0 && data.shell.right <= viewport.width + 0.5, `${viewport.name} shell bounds`);
      assert.ok(data.sidebar.left >= data.shell.left - 0.5 && data.sidebar.right <= data.shell.right + 0.5);
      assert.ok(data.results.left >= data.shell.left - 0.5 && data.results.right <= data.shell.right + 0.5);
      assert.equal(data.materialParent, 'analysis-pane-material', `${viewport.name} material ownership`);
      assert.equal(data.materialPaneHidden, true, `${viewport.name} material must stay hidden on colour tab`);
      assert.ok(data.summaryValues.every(value => !/--/.test(value)), `${viewport.name} summary must be populated`);
      assert.ok(data.visibleControls.every(control => control.height >= 30),
        `${viewport.name} undersized control: ${JSON.stringify(data.visibleControls.filter(control => control.height < 30))}`);

      if (viewport.chartsSideBySide) {
        assert.ok(Math.abs(data.spd.top - data.chromaticity.top) <= 1, `${viewport.name} core chart tops`);
        assert.ok(data.spd.width > data.chromaticity.width, `${viewport.name} SPD must be wider`);
        assert.ok(Math.abs(data.spd.bottom - data.chromaticity.bottom) <= 16, `${viewport.name} core chart bottoms`);
      } else {
        assert.ok(data.chromaticity.top > data.spd.bottom, `${viewport.name} core charts must stack`);
        assert.ok(Math.abs(data.spd.width - data.chromaticity.width) <= 1, `${viewport.name} stacked chart widths`);
      }

      if (viewport.width >= 1180) {
        assert.ok(data.currentLight.height >= 130 && data.currentLight.height <= 190,
          `${viewport.name} current-light and scene height ${data.currentLight.height}`);
      } else if (viewport.width > 720) {
        assert.ok(data.currentLight.height >= 200 && data.currentLight.height <= 330,
          `${viewport.name} stacked current-light and scene height ${data.currentLight.height}`);
      } else {
        assert.ok(data.currentLight.height <= 430,
          `${viewport.name} mobile current-light and scene height ${data.currentLight.height}`);
      }
      assert.deepEqual(pageErrors, [], `${viewport.name} page errors: ${pageErrors.join('; ')}`);
      results.push({ viewport: viewport.name, data });
      await page.close();
    }
    console.log('workbench responsive browser tests passed');
    console.log(JSON.stringify(results.map(result => ({
      viewport: result.viewport,
      shellColumns: result.data.shellColumns,
      summaryColumns: result.data.summaryColumns,
      chartHeights: [result.data.spd.height, result.data.chromaticity.height],
      currentLightHeight: result.data.currentLight.height,
      overflow: result.data.overflow
    })), null, 2));
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
