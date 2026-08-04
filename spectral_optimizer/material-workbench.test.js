'use strict';
const assert = require('node:assert/strict');
const puppeteer = require('puppeteer');
const { createLocalServer } = require('./local-server.js');

function delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

(async () => {
  const server = createLocalServer();
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const browser = await puppeteer.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    await page.setViewport({ width: 1600, height: 1000 });
    await page.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil: 'networkidle0' });
    await page.waitForFunction(() => document.documentElement.dataset.appReady === 'true');
    await page.evaluate(() => window.AnalysisWorkspace.activate('material'));
    await page.waitForFunction(() => {
      const name = document.getElementById('material-detail-title')?.textContent || '';
      const deltaE = document.querySelector('#material-delta-e strong')?.textContent || '';
      return name && !/--/.test(deltaE);
    });
    const initial = await page.evaluate(() => {
      const figures = [...document.querySelectorAll('#material-panel .material-compare figure')].map(element => {
        const rect = element.getBoundingClientRect();
        return { width: rect.width, height: rect.height };
      });
      const detail = document.querySelector('.material-detail');
      const reference = document.getElementById('material-reference-appearance');
      const current = document.getElementById('material-current-appearance');
      return {
        analysisTab: window.AnalysisWorkspace.current(),
        detailName: document.getElementById('material-detail-title').textContent,
        deltaE: document.querySelector('#material-delta-e strong').textContent,
        columns: getComputedStyle(detail).gridTemplateColumns.split(/\s+/).filter(Boolean).length,
        figures,
        reflectanceOpen: document.getElementById('material-reflectance-details').open,
        referenceBlend: getComputedStyle(reference).backgroundBlendMode,
        currentBlend: getComputedStyle(current).backgroundBlendMode,
        referenceFilter: getComputedStyle(reference).filter,
        currentFilter: getComputedStyle(current).filter,
        referenceChip: getComputedStyle(reference, '::after').content,
        currentChip: getComputedStyle(current, '::after').content,
        previewMode: document.getElementById('material-preview-mode')?.textContent || ''
      };
    });
    assert.equal(initial.analysisTab, 'material');
    assert.doesNotMatch(initial.detailName, /--/);
    assert.doesNotMatch(initial.deltaE, /--/);
    assert.equal(initial.columns, 4, `desktop material detail must use four columns: ${JSON.stringify(initial)}`);
    assert.equal(initial.figures.length, 2);
    assert.ok(Math.abs(initial.figures[0].width - initial.figures[1].width) <= 1);
    assert.ok(Math.abs(initial.figures[0].height - initial.figures[1].height) <= 1);
    assert.equal(initial.reflectanceOpen, false, 'reflectance chart must be collapsed by default');
    assert.equal(initial.referenceBlend, 'normal');
    assert.equal(initial.currentBlend, 'normal');
    assert.equal(initial.referenceFilter, 'none');
    assert.equal(initial.currentFilter, 'none', 'current material photo must remain unmodified before optimization');
    assert.equal(initial.referenceChip, 'none');
    assert.equal(initial.currentChip, 'none');
    assert.ok(initial.previewMode && !/3/.test(initial.previewMode), 'initial material preview must not claim visual enhancement');

    const optimizationControls = await page.evaluate(() => ({
      goal: document.getElementById('material-preference-goal')?.value || '',
      scope: Boolean(document.getElementById('material-optimization-scope')),
      scopeOptions: [...(document.getElementById('material-optimization-scope')?.options || [])].map(option => option.value),
      level: document.getElementById('material-preference-level')?.value || '',
      button: document.getElementById('material-optimize-button')?.textContent || '',
      status: document.getElementById('material-optimization-status')?.textContent || '',
      source: document.getElementById('material-preference-source')?.textContent || '',
      editor: Boolean(document.getElementById('material-preference-open'))
    }));
    assert.equal(optimizationControls.goal, 'preference');
    assert.equal(optimizationControls.scope, true);
    assert.deepEqual(optimizationControls.scopeOptions, ['selected', 'all']);
    assert.equal(optimizationControls.level, 'recommended');
    assert.equal(optimizationControls.button, '优化偏好表现');
    assert.match(optimizationControls.status, /各材质|偏好目标|彩度/);
    assert.match(optimizationControls.source, /材质专属|分类默认|用户自定义/);
    assert.equal(optimizationControls.editor, true);

    const materialIsolation = await page.evaluate(() => ({
      diningControls: Boolean(document.querySelector('#analysis-pane-material #dining-light-profile')),
      categoryTabs: Boolean(document.getElementById('material-category-tabs')),
      comparisonHidden: document.getElementById('material-optimization-comparison')?.hidden,
      ids: [...document.querySelectorAll('#material-selector [data-material-id]')].map(button => button.dataset.materialId)
    }));
    assert.equal(materialIsolation.diningControls, false);
    assert.equal(materialIsolation.categoryTabs, false);
    assert.equal(materialIsolation.comparisonHidden, true);
    assert.deepEqual(materialIsolation.ids, [
      'wood_warm_oak', 'wood_dark_walnut', 'leather_cognac', 'fabric_warm_beige',
      'leaf_green', 'skin_tone_sample', 'neutral_wall_matte'
    ]);

    await page.click('#material-preference-open');
    await page.waitForFunction(() => document.getElementById('material-preference-dialog')?.hidden === false);
    const originalTargetDc = await page.$eval('#material-pref-target-dc', element => Number(element.value));
    const editedTargetDc = Math.min(11.5, originalTargetDc + 0.4);
    await page.$eval('#material-pref-target-dc', (element, value) => { element.value = String(value); }, editedTargetDc);
    await page.click('#material-preference-save');
    await page.waitForFunction(() => document.getElementById('material-preference-dialog')?.hidden === true);
    assert.match(await page.$eval('#material-preference-source', element => element.textContent), /用户自定义/);
    await page.click('#material-preference-open');
    await page.waitForFunction(() => document.getElementById('material-preference-dialog')?.hidden === false);
    assert.equal(await page.$eval('#material-pref-target-dc', element => Number(element.value)), editedTargetDc);
    await page.click('#material-preference-reset');
    await page.waitForFunction(() => document.getElementById('material-preference-dialog')?.hidden === true);
    assert.doesNotMatch(await page.$eval('#material-preference-source', element => element.textContent), /用户自定义/);
    await page.evaluate(() => {
      window.__materialOptimizationRequest = null;
      window.__materialOptimizationResult = null;
      document.addEventListener('spectral-material-optimization-request', event => {
        window.__materialOptimizationRequest = event.detail;
      }, { once: true });
      document.addEventListener('spectral-material-optimization-result', event => {
        window.__materialOptimizationResult = event.detail;
      }, { once: true });
    });
    await page.select('#material-preference-goal', 'preference');
    await page.select('#material-preference-level', 'recommended');
    await page.select('#material-optimization-scope', 'selected');
    await page.click('#material-optimize-button');
    await page.waitForFunction(() => Boolean(window.__materialOptimizationRequest));
    const optimizationRequest = await page.evaluate(() => window.__materialOptimizationRequest);
    assert.equal(optimizationRequest.goal, 'preference');
    assert.equal(optimizationRequest.level, 'recommended');
    assert.equal(optimizationRequest.scope, 'selected');
    assert.equal(optimizationRequest.materialIds.length, 1);
    assert.equal(optimizationRequest.materialIds[0], 'wood_warm_oak');
    await page.waitForFunction(() => {
      const text = document.getElementById('material-optimization-status')?.textContent || '';
      const button = document.getElementById('material-optimize-button');
      return !button?.disabled && /平均偏好误差.*→|未找到|无法优化|优化失败/.test(text);
    }, { timeout: 20000 });
    const preferenceStatus = await page.$eval('#material-optimization-status', element => element.textContent);
    assert.match(preferenceStatus, /平均偏好误差.*→|未找到|无法优化|优化失败/);
    const optimizationResult = await page.evaluate(() => window.__materialOptimizationResult);
    assert.equal(optimizationResult.goal, 'preference');
    assert.equal(optimizationResult.level, 'recommended');
    assert.ok(optimizationResult.beforeSnapshot);
    assert.ok(optimizationResult.afterSnapshot);
    const materialComparison = await page.evaluate(() => {
      const summary = document.getElementById('material-result-summary');
      const details = document.getElementById('material-technical-details');
      const comparison = document.getElementById('material-optimization-comparison');
      return {
        summaryHidden: summary?.hidden,
        summaryHeight: summary?.getBoundingClientRect().height || 0,
        summaryText: summary?.textContent || '',
        detailsHidden: details?.hidden,
        detailsOpen: details?.open,
        comparisonHidden: comparison?.hidden,
        comparisonInsideDetails: details?.contains(comparison) || false,
        canvasWidth: document.getElementById('material-optimization-spd')?.width || 0,
        metrics: document.getElementById('material-optimization-metrics')?.textContent || '',
        channels: document.getElementById('material-optimization-channels')?.textContent || ''
      };
    });
    assert.equal(materialComparison.summaryHidden, false);
    assert.ok(materialComparison.summaryHeight > 0 && materialComparison.summaryHeight <= 140,
      'always-visible material result summary must remain compact');
    assert.match(materialComparison.summaryText, /CCT/);
    assert.match(materialComparison.summaryText, /Duv/);
    assert.match(materialComparison.summaryText, /Rf/);
    assert.match(materialComparison.summaryText, /Rg/);
    assert.match(materialComparison.summaryText, /R9/);
    assert.match(materialComparison.summaryText, /平均偏好误差/);
    assert.match(materialComparison.summaryText, /最大通道变化|通道配方未变化/);
    assert.equal(materialComparison.detailsHidden, false);
    assert.equal(materialComparison.detailsOpen, false);
    assert.equal(materialComparison.comparisonInsideDetails, true);
    assert.equal(materialComparison.comparisonHidden, false);
    assert.ok(materialComparison.canvasWidth > 0);
    assert.match(materialComparison.metrics, /CCT|Duv|Rf|Rg|R9/);
    assert.match(materialComparison.channels, /→/);
    await page.click('#material-technical-details > summary');
    await page.waitForFunction(() => document.getElementById('material-technical-details')?.open === true);
    assert.ok(await page.$eval('#material-optimization-spd', canvas => canvas.getBoundingClientRect().height > 0));
    if (optimizationResult.improved) {
      assert.ok(optimizationResult.beforeSnapshot.channels.some((channel, index) =>
        Math.abs(channel.value - optimizationResult.afterSnapshot.channels[index].value) >= 0.05),
      'successful material optimization must change at least one channel value');
      assert.ok(Number.isFinite(optimizationResult.after.weightedTargetDeltaC));
      assert.ok(Number.isFinite(optimizationResult.after.weightedMeanPreferenceError));
      assert.ok(typeof optimizationResult.after.worstMaterialId === 'string');
      assert.ok(typeof optimizationResult.after.maxDeltaE00MaterialId === 'string');
      assert.match(preferenceStatus, /最差材质/);
      assert.match(preferenceStatus, /最大 ΔE00/);
    }

    await page.evaluate(() => {
      window.__secondMaterialOptimizationResult = null;
      document.addEventListener('spectral-material-optimization-result', event => {
        if (!event.detail?.diningProfileId) window.__secondMaterialOptimizationResult = event.detail;
      }, { once: true });
    });
    await page.click('#material-optimize-button');
    await page.waitForFunction(() => Boolean(window.__secondMaterialOptimizationResult), { timeout: 20000 });
    await page.waitForFunction(() => !document.getElementById('material-optimize-button')?.disabled, { timeout: 20000 });
    const repeatedOptimization = await page.evaluate(() => window.__secondMaterialOptimizationResult);
    assert.ok(repeatedOptimization.beforeSnapshot);
    assert.ok(repeatedOptimization.afterSnapshot);
    assert.ok(Math.abs(repeatedOptimization.afterSnapshot.target.x - optimizationResult.afterSnapshot.target.x) < 1e-10,
      'repeated material optimization must keep the original target x coordinate');
    assert.ok(Math.abs(repeatedOptimization.afterSnapshot.target.y - optimizationResult.afterSnapshot.target.y) < 1e-10,
      'repeated material optimization must keep the original target y coordinate');
    assert.ok(Math.abs(repeatedOptimization.afterSnapshot.target.duv - optimizationResult.afterSnapshot.target.duv) < 1e-10,
      'repeated material optimization must keep the original target Duv');

    await page.select('#material-preference-goal', 'fidelity');
    const fidelityControls = await page.evaluate(() => ({
      levelHidden: document.getElementById('material-preference-level-field').hidden,
      editorHidden: document.getElementById('material-preference-open').hidden,
      button: document.getElementById('material-optimize-button').textContent,
      status: document.getElementById('material-optimization-status').textContent
    }));
    assert.equal(fidelityControls.levelHidden, true);
    assert.equal(fidelityControls.editorHidden, true);
    assert.equal(fidelityControls.button, '优化准确还原');
    assert.match(fidelityControls.status, /平均 ΔE00|降低平均与最大 ΔE00/);

    const textureCoverage = await page.$$eval('#material-selector > button:not(.import-material-btn) .material-thumb', thumbs =>
      thumbs.map(thumb => ({
        image: getComputedStyle(thumb).backgroundImage,
        position: getComputedStyle(thumb).backgroundPosition,
        size: getComputedStyle(thumb).backgroundSize,
        blend: getComputedStyle(thumb).backgroundBlendMode,
        chip: getComputedStyle(thumb, '::after').content,
        filter: getComputedStyle(thumb).filter
      })));
    assert.equal(textureCoverage.length, 7);
    assert.ok(textureCoverage.every(value => /assets\/material-texture-atlas\.png/.test(value.image)),
      'all original materials must use the seven-cell renderer atlas');
    assert.ok(textureCoverage.every(value => value.size === '700% 100%' && value.blend === 'normal'),
      'the original seven-cell material renderer must remain intact');
    assert.equal(new Set(textureCoverage.map(value => value.position)).size, 7,
      'each material must use a distinct atlas cell');
    assert.ok(textureCoverage.every(value => value.chip === 'none' && value.filter === 'none'));

    await page.click('#material-selector > button:not(.import-material-btn)');
    await page.waitForFunction(() => {
      const title = document.getElementById('material-detail-title')?.textContent || '';
      const deltaE = document.querySelector('#material-delta-e strong')?.textContent || '';
      return title && !/--/.test(deltaE);
    });
    const selectedMaterial = await page.evaluate(() => ({
      detailName: document.getElementById('material-detail-title').textContent,
      deltaE: document.querySelector('#material-delta-e strong').textContent
    }));
    assert.doesNotMatch(selectedMaterial.detailName, /--/);
    assert.doesNotMatch(selectedMaterial.deltaE, /--/);

    await page.setViewport({ width: 1024, height: 900 });
    await delay(220);
    assert.equal(await page.$eval('.material-detail', element => getComputedStyle(element).gridTemplateColumns.split(/\s+/).filter(Boolean).length), 2,
      'tablet material detail must use two columns');

    await page.setViewport({ width: 390, height: 844 });
    await delay(220);
    const mobile = await page.evaluate(() => {
      const detail = document.querySelector('.material-detail');
      const panel = document.getElementById('material-panel').getBoundingClientRect();
      return {
        columns: getComputedStyle(detail).gridTemplateColumns.split(/\s+/).filter(Boolean).length,
        panel: { left: panel.left, right: panel.right, width: panel.width },
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
      };
    });
    assert.equal(mobile.columns, 1);
    assert.ok(mobile.panel.left >= 0 && mobile.panel.right <= 390, JSON.stringify(mobile));
    assert.equal(mobile.overflow, 0);
    assert.deepEqual(pageErrors, [], `page errors: ${pageErrors.join('; ')}`);

    console.log('material workbench tests passed', { initial, selectedMaterial, mobile });
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
