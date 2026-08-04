(function (root) {
    'use strict';

    function byId(id) {
        return document.getElementById(id);
    }

    function integrateSceneControls(currentLight) {
        const schedule = byId('schedule-mode-panel');
        if (!currentLight || !schedule) return;

        let scenes = byId('current-light-scenes');
        if (!scenes) {
            scenes = document.createElement('div');
            scenes.className = 'current-light-scenes';
            scenes.id = 'current-light-scenes';
            currentLight.appendChild(scenes);
        }

        const previewStage = currentLight.querySelector('.emitter-preview-stage');
        const journey = document.querySelector('.journey-controls');
        const autoToggle = schedule.querySelector('.schedule-auto-toggle');
        const clockRow = schedule.querySelector('.schedule-clock-row');
        let previewControls = currentLight.querySelector('.current-light-preview-controls');
        if (!previewControls && previewStage) {
            previewControls = document.createElement('div');
            previewControls.className = 'current-light-preview-controls';
            previewStage.appendChild(previewControls);
        }
        if (journey && previewControls && journey.parentElement !== previewControls) previewControls.appendChild(journey);
        if (autoToggle && clockRow && autoToggle.parentElement !== clockRow) clockRow.appendChild(autoToggle);
        const autoLabel = autoToggle?.querySelector('span');
        if (autoLabel) autoLabel.textContent = '自动运行';

        schedule.setAttribute('aria-label', '情景模拟与自动运行');
        scenes.appendChild(schedule);
        currentLight.classList.add('has-scene-controls');
    }

    function init() {
        const sidebar = byId('workbench-sidebar');
        const results = byId('workbench-results');
        const coreCharts = byId('workbench-core-charts');
        const analysis = byId('analysis-workspace');
        if (!sidebar || !results || !coreCharts || !analysis) return;

        const controls = byId('controls-panel');
        const presets = byId('preset-panel');
        const whiteTarget = byId('white-target-panel');
        const circadian = byId('circadian-condition-panel');
        const optimizer = byId('optimizer-section');
        const currentLight = byId('emitter-preview');
        const exportButton = byId('export-recipe-btn');

        if (controls) {
            controls.classList.add('workbench-control-card');
            sidebar.appendChild(controls);
        }
        if (whiteTarget) sidebar.appendChild(whiteTarget);
        if (presets) sidebar.appendChild(presets);
        if (circadian) sidebar.appendChild(circadian);

        if (exportButton) {
            const actions = document.createElement('div');
            actions.className = 'workbench-sidebar-actions';
            actions.appendChild(exportButton);
            sidebar.appendChild(actions);
        }

        if (optimizer) optimizer.remove();
        if (currentLight) {
            integrateSceneControls(currentLight);
            coreCharts.after(currentLight);
        }

        document.documentElement.dataset.workbenchLayout = 'a';
        document.dispatchEvent(new CustomEvent('spectral-workbench-layout-ready'));
    }

    init();
    root.SpectralWorkbenchLayout = Object.freeze({ init });
})(typeof window !== 'undefined' ? window : globalThis);
