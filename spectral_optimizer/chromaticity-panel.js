'use strict';

(function initChromaticityPanel(globalScope) {
    const VIEW_ORDER = Object.freeze(['cie1931', 'cie1976']);
    const DETAIL_IDS = Object.freeze({
        contribution: 'spd-contribution-details'
    });
    let initialized = false;
    let refreshFrame = 0;
    let settleFrame = 0;
    let resizeObserver = null;

    function getStore() {
        return globalScope.SpectralWorkspaceStore || null;
    }

    function formatNumber(value, digits = 4, prefix = '') {
        return Number.isFinite(value) ? `${prefix}${value.toFixed(digits)}` : '--';
    }

    function updateSummary(result) {
        const chromaticity = result?.chromaticity || {};
        const xy = document.getElementById('chromaticity-summary-xy');
        const upvp = document.getElementById('chromaticity-summary-upvp');
        if (xy) xy.textContent = `x ${formatNumber(chromaticity.x)} · y ${formatNumber(chromaticity.y)}`;
        if (upvp) upvp.textContent = `u′ ${formatNumber(chromaticity.up)} · v′ ${formatNumber(chromaticity.vp)}`;
    }

    function drawVisibleView(view) {
        if (view === 'cie1931') {
            globalScope.SpectralAppCharts?.refreshCie1931?.();
            return;
        }
        globalScope.SpectralProfessional?.refresh?.();
    }

    function refreshVisible(view) {
        const pane = document.getElementById(
            view === 'cie1931' ? 'chromaticity-pane-1931' : 'chromaticity-pane-1976'
        );
        if (pane && !pane.hidden) {
            pane.getBoundingClientRect();
            drawVisibleView(view);
        }

        globalScope.cancelAnimationFrame(refreshFrame);
        globalScope.cancelAnimationFrame(settleFrame);
        refreshFrame = globalScope.requestAnimationFrame(() => {
            settleFrame = globalScope.requestAnimationFrame(() => {
                const store = getStore();
                const activeView = store?.getSnapshot().chromaticityView;
                const settledPane = document.getElementById(
                    view === 'cie1931' ? 'chromaticity-pane-1931' : 'chromaticity-pane-1976'
                );
                if (activeView !== view || !settledPane || settledPane.hidden) return;
                drawVisibleView(view);
            });
        });
    }

    function bindSizeObserver() {
        if (typeof globalScope.ResizeObserver !== 'function') return;
        const wrappers = [
            { element: document.getElementById('cie1976-canvas-wrapper'), view: 'cie1976' },
            { element: document.getElementById('cie-canvas-wrapper'), view: 'cie1931' }
        ].filter(item => item.element);
        if (!wrappers.length) return;

        const viewByElement = new Map(wrappers.map(item => [item.element, item.view]));
        resizeObserver = new globalScope.ResizeObserver(entries => {
            const activeView = getStore()?.getSnapshot().chromaticityView;
            for (const entry of entries) {
                const view = viewByElement.get(entry.target);
                const width = entry.contentRect?.width || 0;
                const height = entry.contentRect?.height || 0;
                if (view === activeView && width >= 40 && height >= 40) {
                    refreshVisible(view);
                    break;
                }
            }
        });
        for (const item of wrappers) resizeObserver.observe(item.element);
    }

    function applyView(view, { refresh = true } = {}) {
        const normalized = VIEW_ORDER.includes(view) ? view : 'cie1931';
        for (const button of document.querySelectorAll('.chromaticity-tabs [data-chromaticity-view]')) {
            const selected = button.dataset.chromaticityView === normalized;
            button.setAttribute('aria-selected', selected ? 'true' : 'false');
            button.setAttribute('tabindex', selected ? '0' : '-1');
            button.classList.toggle('is-selected', selected);
        }

        const pane1976 = document.getElementById('chromaticity-pane-1976');
        const pane1931 = document.getElementById('chromaticity-pane-1931');
        if (pane1976) pane1976.hidden = normalized !== 'cie1976';
        if (pane1931) pane1931.hidden = normalized !== 'cie1931';
        if (refresh) refreshVisible(normalized);
    }

    function moveFocus(button, action) {
        const currentIndex = VIEW_ORDER.indexOf(button.dataset.chromaticityView);
        if (currentIndex < 0) return;
        let nextIndex = currentIndex;
        if (action === 'next') nextIndex = (currentIndex + 1) % VIEW_ORDER.length;
        if (action === 'previous') nextIndex = (currentIndex - 1 + VIEW_ORDER.length) % VIEW_ORDER.length;
        if (action === 'first') nextIndex = 0;
        if (action === 'last') nextIndex = VIEW_ORDER.length - 1;
        const nextView = VIEW_ORDER[nextIndex];
        const nextButton = document.querySelector(`.chromaticity-tabs [data-chromaticity-view="${nextView}"]`);
        if (!nextButton) return;
        getStore()?.setChromaticityView(nextView);
        nextButton.focus();
    }

    function bindChannelToggle() {
        const toggle = document.getElementById('chromaticity-channel-points');
        if (!toggle) return;
        toggle.addEventListener('change', () => {
            globalScope.SpectralAppCharts?.setChannelPointsVisible?.(toggle.checked);
            globalScope.SpectralProfessional?.setChannelPointsVisible?.(toggle.checked);
        });
    }

    function applyDetailState(details) {
        for (const [key, id] of Object.entries(DETAIL_IDS)) {
            const element = document.getElementById(id);
            if (element) element.open = Boolean(details?.[key]);
        }
    }

    function bindDetailState(store) {
        for (const [key, id] of Object.entries(DETAIL_IDS)) {
            const element = document.getElementById(id);
            if (!element) continue;
            element.addEventListener('toggle', () => {
                store.setDetails({ [key]: element.open });
            });
        }
    }

    function bindTabs() {
        for (const button of document.querySelectorAll('.chromaticity-tabs [data-chromaticity-view]')) {
            button.addEventListener('click', () => {
                getStore()?.setChromaticityView(button.dataset.chromaticityView);
            });
            button.addEventListener('keydown', event => {
                const actions = {
                    ArrowLeft: 'previous',
                    ArrowRight: 'next',
                    Home: 'first',
                    End: 'last'
                };
                const action = actions[event.key];
                if (!action) return;
                event.preventDefault();
                moveFocus(button, action);
            });
        }
    }

    function init() {
        if (initialized) return;
        initialized = true;
        const store = getStore();
        if (!store) return;
        bindTabs();
        bindChannelToggle();
        bindDetailState(store);
        bindSizeObserver();
        store.subscribe(snapshot => {
            updateSummary(snapshot.currentResult);
            applyView(snapshot.chromaticityView);
            applyDetailState(snapshot.details);
        });
    }

    globalScope.SpectralChromaticityPanel = Object.freeze({
        init,
        applyView,
        updateSummary,
        refreshVisible
    });

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
}(window));
