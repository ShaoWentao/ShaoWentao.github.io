(function (root, factory) {
    const api = factory(root);
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) root.RECIPE_BATCH_EXPORT = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
    'use strict';

    const DEFAULT_RANGE = Object.freeze({ minK: 1600, maxK: 12000, stepK: 100 });
    let adapter = null;
    let dialog = null;
    let activeTask = null;
    let testOptions = null;
    let initialized = false;
    const debug = {
        running: false,
        completed: false,
        cancelled: false,
        progress: 0,
        phase: '',
        fileName: '',
        sheetNames: [],
        rowCounts: [],
        recipeCounts: null,
        error: ''
    };

    function cloneDebug() {
        return JSON.parse(JSON.stringify(debug));
    }

    function ensureModules() {
        if (!root.BATCH_RECIPE_EXPORT ||
            typeof root.BATCH_RECIPE_EXPORT.buildBatchWorkbookSpec !== 'function' ||
            typeof root.BATCH_RECIPE_EXPORT.buildSingleWorkbookSpec !== 'function') {
            throw new Error('批量配方数据模块未加载。');
        }
        if (!root.XLSX_WORKBOOK || typeof root.XLSX_WORKBOOK.downloadWorkbook !== 'function') {
            throw new Error('XLSX工作簿模块未加载。');
        }
    }

    function createDialog() {
        if (typeof document === 'undefined') return null;
        const existing = document.getElementById('recipe-export-dialog');
        if (existing) return existing;
        const element = document.createElement('dialog');
        element.id = 'recipe-export-dialog';
        element.className = 'recipe-export-dialog';
        element.setAttribute('aria-labelledby', 'recipe-export-title');
        element.innerHTML = `
            <div class="recipe-export-dialog__panel">
                <header class="recipe-export-dialog__header">
                    <div>
                        <h2 id="recipe-export-title">导出配方</h2>
                        <p>导出控制器通道值、验证指标和完整光谱数据。</p>
                    </div>
                    <button type="button" id="recipe-export-close" class="recipe-export-dialog__close" aria-label="关闭导出窗口">×</button>
                </header>
                <fieldset class="recipe-export-options">
                    <legend>导出范围</legend>
                    <label class="recipe-export-option is-selected">
                        <input type="radio" id="recipe-export-single" name="recipe-export-mode" value="single" checked>
                        <span><strong>当前单点</strong><small>当前目标点、当前模式和当前通道输出</small></span>
                    </label>
                    <label class="recipe-export-option">
                        <input type="radio" id="recipe-export-batch" name="recipe-export-mode" value="batch">
                        <span><strong>批量配方</strong><small>1600–12000 K，每100 K生成常规、高显色和高饱和，并包含32个淡彩光、5个情景及独立亮度配方</small></span>
                    </label>
                </fieldset>
                <div class="recipe-export-summary" id="recipe-export-summary">
                    单点工作簿包含“说明、单点配方、亮度配方、光谱数据、亮度光谱”5个子表；亮度节点为100%、75%、50%、25%、10%、5%、1%。
                </div>
                <div class="recipe-export-progress" id="recipe-export-progress" hidden>
                    <div class="recipe-export-progress__line">
                        <strong id="recipe-export-progress-text">准备计算…</strong>
                        <span id="recipe-export-progress-percent">0%</span>
                    </div>
                    <progress id="recipe-export-progress-bar" max="100" value="0">0%</progress>
                </div>
                <p class="recipe-export-status" id="recipe-export-status" role="status" aria-live="polite"></p>
                <div class="recipe-export-dialog__actions">
                    <button type="button" id="recipe-export-cancel" class="recipe-export-cancel" disabled>取消</button>
                    <button type="button" id="recipe-export-start" class="recipe-export-start">开始导出</button>
                </div>
            </div>`;
        document.body.appendChild(element);
        return element;
    }

    function elements() {
        return {
            single: document.getElementById('recipe-export-single'),
            batch: document.getElementById('recipe-export-batch'),
            start: document.getElementById('recipe-export-start'),
            cancel: document.getElementById('recipe-export-cancel'),
            close: document.getElementById('recipe-export-close'),
            progress: document.getElementById('recipe-export-progress'),
            progressText: document.getElementById('recipe-export-progress-text'),
            progressPercent: document.getElementById('recipe-export-progress-percent'),
            progressBar: document.getElementById('recipe-export-progress-bar'),
            status: document.getElementById('recipe-export-status'),
            summary: document.getElementById('recipe-export-summary')
        };
    }

    function selectedMode() {
        return document.querySelector('input[name="recipe-export-mode"]:checked')?.value || 'single';
    }

    function updateOptionUi() {
        const ui = elements();
        document.querySelectorAll('.recipe-export-option').forEach(label => {
            label.classList.toggle('is-selected', Boolean(label.querySelector('input:checked')));
        });
        if (ui.summary) {
            ui.summary.textContent = selectedMode() === 'batch'
                ? '批量工作簿包含“说明、常规、高显色、高饱和、淡彩光、情景模式、亮度配方、光谱数据、亮度光谱”9个子表；亮度节点为100%、75%、50%、25%、10%、5%、1%。'
                : '单点工作簿包含“说明、单点配方、亮度配方、光谱数据、亮度光谱”5个子表；亮度节点为100%、75%、50%、25%、10%、5%、1%。';
        }
    }

    function resetUi() {
        const ui = elements();
        if (ui.single) ui.single.checked = true;
        if (ui.progress) ui.progress.hidden = true;
        if (ui.progressBar) ui.progressBar.value = 0;
        if (ui.progressText) ui.progressText.textContent = '准备计算…';
        if (ui.progressPercent) ui.progressPercent.textContent = '0%';
        if (ui.status) {
            ui.status.textContent = '';
            ui.status.classList.remove('is-error', 'is-success');
        }
        if (ui.start) {
            ui.start.disabled = false;
            ui.start.textContent = '开始导出';
        }
        if (ui.cancel) ui.cancel.disabled = true;
        updateOptionUi();
    }

    function openDialog() {
        if (!dialog) dialog = createDialog();
        if (!dialog) return;
        resetUi();
        if (typeof dialog.showModal === 'function') dialog.showModal();
        else dialog.setAttribute('open', '');
    }

    function closeDialog() {
        if (!dialog) return;
        if (typeof dialog.close === 'function') dialog.close();
        else dialog.removeAttribute('open');
    }

    function setRunning(running) {
        const ui = elements();
        debug.running = running;
        if (ui.start) ui.start.disabled = running;
        if (ui.close) ui.close.disabled = running;
        if (ui.cancel) ui.cancel.disabled = !running;
        document.querySelectorAll('input[name="recipe-export-mode"]').forEach(input => {
            input.disabled = running;
        });
        if (ui.progress) ui.progress.hidden = !running && debug.progress === 0;
        if (dialog) dialog.setAttribute('aria-busy', String(running));
    }

    function setStatus(message, type) {
        const ui = elements();
        if (!ui.status) return;
        ui.status.textContent = message || '';
        ui.status.classList.toggle('is-error', type === 'error');
        ui.status.classList.toggle('is-success', type === 'success');
    }

    function updateProgress(phase, completed, total) {
        const ui = elements();
        const progress = total > 0 ? Math.max(0, Math.min(100, completed / total * 100)) : 0;
        const rounded = Math.round(progress);
        debug.phase = phase;
        debug.progress = progress;
        if (ui.progress) ui.progress.hidden = false;
        if (ui.progressText) ui.progressText.textContent = `${phase} · ${completed}/${total}`;
        if (ui.progressPercent) ui.progressPercent.textContent = `${rounded}%`;
        if (ui.progressBar) {
            ui.progressBar.value = progress;
            ui.progressBar.textContent = `${rounded}%`;
        }
    }

    function fileStamp(date = new Date()) {
        const pad = value => String(value).padStart(2, '0');
        return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}`;
    }

    function workbookDebug(spec, fileName, counts) {
        debug.fileName = fileName;
        debug.sheetNames = spec.sheets.map(sheet => sheet.name);
        debug.rowCounts = spec.sheets.map(sheet => sheet.rows.length);
        debug.recipeCounts = counts || null;
    }

    function assertActive(task) {
        if (!task || task.cancelled || activeTask !== task) {
            const error = new Error('Batch recipe export cancelled');
            error.name = 'AbortError';
            error.code = 'RECIPE_EXPORT_CANCELLED';
            throw error;
        }
    }

    function yieldToUi() {
        return new Promise(resolve => setTimeout(resolve, 0));
    }

    function metadataFromContext(context, exportedAt, range) {
        return {
            exportedAt: exportedAt.toISOString(),
            source: context.source,
            channelCount: context.channels.length,
            cctRange: `${range.minK}–${range.maxK} K`,
            cctStepK: range.stepK,
            targetRg: context.targetRg,
            brightnessLevels: range.brightnessLevels || root.BATCH_RECIPE_EXPORT.DEFAULT_BRIGHTNESS_LEVELS,
            brightnessModel: '固定通道SPD同比例缩放（未导入分级实测SPD）'
        };
    }

    async function exportSingle() {
        ensureModules();
        const context = adapter.createContext();
        const timestamp = new Date();
        const recipe = await adapter.buildSingleRecipe(context);
        const brightnessLevels = root.BATCH_RECIPE_EXPORT.DEFAULT_BRIGHTNESS_LEVELS.slice();
        const brightness = [];
        updateProgress('当前单点', 1, 1 + brightnessLevels.length);
        for (const level of brightnessLevels) {
            brightness.push(await adapter.buildBrightnessRecipe(context, recipe, level));
            updateProgress('亮度配方', 1 + brightness.length, 1 + brightnessLevels.length);
            await yieldToUi();
        }
        const spec = root.BATCH_RECIPE_EXPORT.buildSingleWorkbookSpec({
            channels: context.channels,
            metadata: metadataFromContext(context, timestamp, {
                minK: context.current.targetCctK,
                maxK: context.current.targetCctK,
                stepK: 0,
                brightnessLevels
            }),
            recipe,
            brightness,
            wavelengths: context.wavelengths
        });
        const fileName = `spectral-recipe-single-${context.channels.length}ch-${fileStamp(timestamp)}.xlsx`;
        workbookDebug(spec, fileName, { single: 1, brightness: brightness.length, total: 1 + brightness.length });
        root.XLSX_WORKBOOK.downloadWorkbook(fileName, spec);
        debug.progress = 100;
        debug.completed = true;
        setStatus('单点配方已生成。', 'success');
        return spec;
    }

    function resolvedBatchOptions(options) {
        const source = { ...DEFAULT_RANGE, ...(testOptions || {}), ...(options || {}) };
        return {
            minK: Number(source.minK),
            maxK: Number(source.maxK),
            stepK: Number(source.stepK),
            pastelLimit: Number.isFinite(Number(source.pastelLimit)) ? Math.max(0, Math.floor(Number(source.pastelLimit))) : null,
            sceneLimit: Number.isFinite(Number(source.sceneLimit)) ? Math.max(0, Math.floor(Number(source.sceneLimit))) : null,
            brightnessLevels: (Array.isArray(source.brightnessLevels)
                ? source.brightnessLevels
                : root.BATCH_RECIPE_EXPORT.DEFAULT_BRIGHTNESS_LEVELS)
                .map(value => Math.round(Number(value)))
                .filter((value, index, values) => value >= 1 && value <= 100 && values.indexOf(value) === index),
            skipDownload: source.skipDownload === true
        };
    }

    async function exportBatch(options) {
        ensureModules();
        const range = resolvedBatchOptions(options);
        const context = adapter.createContext();
        const ccts = root.BATCH_RECIPE_EXPORT.buildCctRange(range.minK, range.maxK, range.stepK);
        const pastelSamples = range.pastelLimit == null
            ? context.pastelSamples
            : context.pastelSamples.slice(0, range.pastelLimit);
        const scheduleStages = range.sceneLimit == null
            ? context.scheduleStages
            : context.scheduleStages.slice(0, range.sceneLimit);
        const baseTotal = ccts.length * 3 + pastelSamples.length + scheduleStages.length;
        const total = baseTotal * (1 + range.brightnessLevels.length);
        const task = { cancelled: false };
        activeTask = task;
        debug.completed = false;
        debug.cancelled = false;
        debug.error = '';
        debug.progress = 0;
        setRunning(true);
        setStatus('正在生成批量配方，请保持页面开启。');

        const regular = [];
        const fidelity = [];
        const saturation = [];
        const pastel = [];
        const scenes = [];
        const brightness = [];
        let completed = 0;
        try {
            for (const cctK of ccts) {
                assertActive(task);
                regular.push(await adapter.buildRegularRecipe(context, cctK));
                completed += 1;
                updateProgress('常规', completed, total);
                await yieldToUi();
            }

            let fidelitySeed = null;
            for (let index = 0; index < ccts.length; index++) {
                assertActive(task);
                const recipe = await adapter.buildMetamerRecipe(
                    context,
                    'fidelity',
                    ccts[index],
                    regular[index],
                    fidelitySeed
                );
                fidelity.push(recipe);
                fidelitySeed = recipe.values;
                completed += 1;
                updateProgress('高显色', completed, total);
                await yieldToUi();
            }

            let saturationSeed = null;
            for (let index = 0; index < ccts.length; index++) {
                assertActive(task);
                const recipe = await adapter.buildMetamerRecipe(
                    context,
                    'saturation',
                    ccts[index],
                    regular[index],
                    saturationSeed
                );
                saturation.push(recipe);
                saturationSeed = recipe.values;
                completed += 1;
                updateProgress('高饱和', completed, total);
                await yieldToUi();
            }

            let pastelSeed = null;
            for (const sample of pastelSamples) {
                assertActive(task);
                const recipe = await adapter.buildPastelRecipe(context, sample, pastelSeed);
                pastel.push(recipe);
                pastelSeed = recipe.values;
                completed += 1;
                updateProgress('淡彩光', completed, total);
                await yieldToUi();
            }

            for (const stage of scheduleStages) {
                assertActive(task);
                scenes.push(await adapter.buildSceneRecipe(context, stage));
                completed += 1;
                updateProgress('情景模式', completed, total);
                await yieldToUi();
            }

            const baseRecipes = [...regular, ...fidelity, ...saturation, ...pastel, ...scenes];
            for (const baseRecipe of baseRecipes) {
                for (const level of range.brightnessLevels) {
                    assertActive(task);
                    brightness.push(await adapter.buildBrightnessRecipe(context, baseRecipe, level));
                    completed += 1;
                    updateProgress('亮度配方', completed, total);
                    if (brightness.length % 20 === 0) await yieldToUi();
                }
            }

            assertActive(task);
            const timestamp = new Date();
            const spec = root.BATCH_RECIPE_EXPORT.buildBatchWorkbookSpec({
                channels: context.channels,
                metadata: metadataFromContext(context, timestamp, range),
                regular,
                fidelity,
                saturation,
                pastel,
                scenes,
                brightness,
                wavelengths: context.wavelengths
            });
            const fileName = `spectral-recipes-${context.channels.length}ch-${fileStamp(timestamp)}.xlsx`;
            workbookDebug(spec, fileName, {
                regular: regular.length,
                fidelity: fidelity.length,
                saturation: saturation.length,
                pastel: pastel.length,
                scenes: scenes.length,
                brightness: brightness.length,
                baseTotal,
                total
            });
            if (!range.skipDownload) root.XLSX_WORKBOOK.downloadWorkbook(fileName, spec);
            debug.progress = 100;
            debug.completed = true;
            updateProgress('工作簿完成', total, total);
            setStatus(`已生成 ${baseTotal} 条基础配方和 ${brightness.length} 条亮度节点。`, 'success');
            return spec;
        } catch (error) {
            const cancelled = error && (error.name === 'AbortError' || error.code === 'RECIPE_EXPORT_CANCELLED' || error.code === 'METAMER_CANCELLED');
            if (cancelled) {
                debug.cancelled = true;
                setStatus('批量导出已取消。');
                return null;
            }
            debug.error = error && error.message ? error.message : String(error);
            setStatus(`导出失败：${debug.error}`, 'error');
            throw error;
        } finally {
            if (activeTask === task) activeTask = null;
            setRunning(false);
        }
    }

    function cancelActiveExport() {
        if (!activeTask) return false;
        activeTask.cancelled = true;
        debug.cancelled = true;
        if (adapter && typeof adapter.cancelActive === 'function') adapter.cancelActive();
        setStatus('正在取消批量计算…');
        return true;
    }

    async function startSelectedExport() {
        if (debug.running) return;
        debug.completed = false;
        debug.cancelled = false;
        debug.error = '';
        try {
            if (selectedMode() === 'batch') await exportBatch();
            else {
                setRunning(true);
                const ui = elements();
                if (ui.progress) ui.progress.hidden = false;
                updateProgress('当前单点', 0, 1 + root.BATCH_RECIPE_EXPORT.DEFAULT_BRIGHTNESS_LEVELS.length);
                await exportSingle();
                setRunning(false);
            }
        } catch (error) {
            debug.error = error && error.message ? error.message : String(error);
            setStatus(`导出失败：${debug.error}`, 'error');
            setRunning(false);
        }
    }

    function wireDialog() {
        const ui = elements();
        ui.single?.addEventListener('change', updateOptionUi);
        ui.batch?.addEventListener('change', updateOptionUi);
        ui.start?.addEventListener('click', startSelectedExport);
        ui.cancel?.addEventListener('click', cancelActiveExport);
        ui.close?.addEventListener('click', () => {
            if (!debug.running) closeDialog();
        });
        dialog?.addEventListener('cancel', event => {
            if (debug.running) {
                event.preventDefault();
                cancelActiveExport();
            }
        });
    }

    function initialize(config) {
        if (initialized) return api;
        adapter = config || {};
        const required = [
            'createContext',
            'buildSingleRecipe',
            'buildRegularRecipe',
            'buildMetamerRecipe',
            'buildPastelRecipe',
            'buildSceneRecipe',
            'buildBrightnessRecipe'
        ];
        required.forEach(name => {
            if (typeof adapter[name] !== 'function') throw new TypeError(`Recipe export adapter requires ${name}`);
        });
        dialog = createDialog();
        wireDialog();
        const button = adapter.button || document.getElementById('export-recipe-btn');
        button?.addEventListener('click', openDialog);
        initialized = true;
        return api;
    }

    function setBatchOptionsForTesting(options) {
        testOptions = options ? { ...options } : null;
    }

    const api = Object.freeze({
        initialize,
        openDialog,
        exportSingle,
        exportBatch,
        cancelActiveExport,
        setBatchOptionsForTesting,
        getDebugState: cloneDebug
    });
    return api;
});
