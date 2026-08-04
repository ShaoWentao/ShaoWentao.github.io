(function (root) {
    'use strict';

    const REQUIRED_MODULES = Object.freeze(['core', 'material', 'professional']);
    const states = new Map();
    let finalized = false;

    function showLocalFileWarning() {
        const warning = document.getElementById('local-file-warning');
        if (!warning) return;
        const isLocalFile = root.location && root.location.protocol === 'file:';
        warning.hidden = !isLocalFile;
    }

    function snapshot() {
        return Object.fromEntries(states);
    }

    function updateLocalState(name, state, message) {
        if (name === 'material') {
            const element = document.getElementById('material-loading-state');
            if (element) {
                element.textContent = state === 'ready'
                    ? '材质分析已就绪'
                    : (message || '材质分析暂不可用');
                element.hidden = state === 'ready';
            }
        }
    }

    function emitState(name, state, message) {
        updateLocalState(name, state, message);
        document.dispatchEvent(new CustomEvent('spectral-module-state-change', {
            detail: { name, state, message: message || '', states: snapshot() }
        }));
    }

    function finalize() {
        if (finalized) return;
        const settled = REQUIRED_MODULES.every(name => states.has(name));
        if (!settled) return;

        finalized = true;
        const complete = REQUIRED_MODULES.every(name => states.get(name) === 'ready');
        document.documentElement.dataset.appReady = complete ? 'true' : 'degraded';
        showLocalFileWarning();
        document.dispatchEvent(new CustomEvent('spectral-app-ready', {
            detail: { complete, states: snapshot() }
        }));
    }

    function settle(name, state, message) {
        if (!REQUIRED_MODULES.includes(name) || states.has(name)) return;
        states.set(name, state);
        emitState(name, state, message);
        finalize();
    }

    function markReady(name, message) {
        settle(name, 'ready', message);
    }

    function markFailed(name, message) {
        settle(name, 'failed', message);
    }

    root.SpectralAppReadiness = Object.freeze({ markReady, markFailed, snapshot });

    showLocalFileWarning();
    root.setTimeout(function () {
        REQUIRED_MODULES.forEach(function (name) {
            if (states.has(name)) return;
            states.set(name, 'failed');
            emitState(name, 'failed', '模块加载超时，已进入兼容模式。');
        });
        finalize();
    }, 15000);
})(typeof window !== 'undefined' ? window : globalThis);
