(function (root) {
    'use strict';

    const TAB_ORDER = ['colour', 'material', 'dining', 'museum'];
    let activeTab = 'colour';

    function byId(id) { return document.getElementById(id); }
    function store() { return root.SpectralWorkspaceStore || null; }

    function createPane(tab) {
        const pane = document.createElement('div');
        pane.className = 'analysis-workspace-pane';
        pane.id = `analysis-pane-${tab}`;
        pane.dataset.analysisPane = tab;
        pane.setAttribute('role', 'tabpanel');
        pane.setAttribute('aria-labelledby', `analysis-tab-${tab}`);
        pane.hidden = tab !== 'colour';
        return pane;
    }

    function restoreProfessionalDetails() {
        const contribution = byId('spd-contribution-details');
        const spdPanel = byId('spd-panel');
        if (contribution && spdPanel && contribution.parentElement !== spdPanel) {
            contribution.open = false;
            contribution.classList.remove('analysis-advanced-section');
            spdPanel.appendChild(contribution);
        }

    }

    function build() {
        const workspace = byId('analysis-workspace');
        const tabs = workspace?.querySelector('.analysis-workspace-tabs');
        if (!workspace || !tabs || byId('analysis-pane-colour')) return;

        const panes = Object.fromEntries(TAB_ORDER.map(tab => [tab, createPane(tab)]));
        TAB_ORDER.forEach(tab => workspace.appendChild(panes[tab]));

        const quality = workspace.querySelector('.metric-group-quality');
        const samples = byId('color-samples-panel');
        const material = byId('material-panel');
        const dining = byId('dining-panel');
        const museum = byId('museum-panel');
        if (quality) {
            quality.hidden = true;
            quality.classList.add('analysis-support-metrics');
            panes.colour.appendChild(quality);
        }
        if (samples) panes.colour.appendChild(samples);
        if (material) panes.material.appendChild(material);
        if (dining) panes.dining.appendChild(dining);
        if (museum) panes.museum.appendChild(museum);

        restoreProfessionalDetails();
    }

    function render(tab) {
        const normalized = TAB_ORDER.includes(tab) ? tab : 'colour';
        activeTab = normalized;
        document.querySelectorAll('[data-analysis-pane]').forEach(pane => {
            pane.hidden = pane.dataset.analysisPane !== normalized;
        });
        document.querySelectorAll('[data-analysis-tab]').forEach(button => {
            const selected = button.dataset.analysisTab === normalized;
            button.setAttribute('aria-selected', String(selected));
            button.tabIndex = selected ? 0 : -1;
        });
        document.documentElement.dataset.analysisTab = normalized;
    }

    function activate(tabId) {
        const normalized = TAB_ORDER.includes(tabId) ? tabId : 'colour';
        const currentStore = store();
        if (currentStore?.getSnapshot().analysisTab !== normalized) currentStore?.setAnalysisTab(normalized);
        else render(normalized);
    }

    function bind() {
        document.querySelectorAll('[data-analysis-tab]').forEach(button => {
            button.addEventListener('click', () => activate(button.dataset.analysisTab));
            button.addEventListener('keydown', event => {
                const index = TAB_ORDER.indexOf(button.dataset.analysisTab);
                let next = null;
                if (event.key === 'ArrowRight') next = TAB_ORDER[(index + 1) % TAB_ORDER.length];
                if (event.key === 'ArrowLeft') next = TAB_ORDER[(index - 1 + TAB_ORDER.length) % TAB_ORDER.length];
                if (event.key === 'Home') next = TAB_ORDER[0];
                if (event.key === 'End') next = TAB_ORDER[TAB_ORDER.length - 1];
                if (!next) return;
                event.preventDefault();
                activate(next);
                byId(`analysis-tab-${next}`)?.focus();
            });
        });

    }

    function init() {
        build();
        bind();
        const currentStore = store();
        if (currentStore) {
            currentStore.subscribe(snapshot => render(snapshot.analysisTab || 'colour'));
        } else render('colour');
    }

    init();
    root.AnalysisWorkspace = Object.freeze({ activate, current: () => activeTab });
})(typeof window !== 'undefined' ? window : globalThis);
