(function (root, factory) {
    const api = factory(root);
    if (typeof module === 'object' && module.exports) module.exports = api;
    root.CctJourney = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
    'use strict';

    function setupPresetTemperatures() {
        if (typeof document === 'undefined') return;

        function mount() {
            const container = document.querySelector('.presets-section .preset-buttons');
            if (!container) return false;

            const temperatures = [1800, 2200, 2700, 3000, 3500, 4000, 5000, 5500, 6000, 6500, 12000];
            const buttons = temperatures.map(function (cct) {
                return '<button class="preset-btn compact" data-preset="cct-' + cct + '" title="Planckian reference ' + cct + 'K">' + cct + 'K</button>';
            });
            buttons.push('<button class="preset-btn compact reset" data-preset="reset" title="Reset all sliders to 0%">重置</button>');
            container.innerHTML = buttons.join('');
            return true;
        }

        if (!mount() && document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', mount, { once: true });
        }
    }

    function setupPresetOptimizerSync() {
        if (typeof document === 'undefined') return;

        document.addEventListener('click', function (event) {
            const target = event.target;
            const button = target && target.closest
                ? target.closest('.presets-section .preset-btn[data-preset^="cct-"]')
                : null;
            if (!button) return;

            const cct = parseInt(button.dataset.preset.replace('cct-', ''), 10);
            if (!Number.isFinite(cct)) return;

            const cctSlider = document.getElementById('target-cct-slider');
            const duvSlider = document.getElementById('target-duv-slider');

            if (cctSlider) {
                cctSlider.value = String(cct);
                cctSlider.dispatchEvent(new Event('input', { bubbles: true }));
            }
            if (duvSlider) {
                duvSlider.value = '0';
                duvSlider.dispatchEvent(new Event('input', { bubbles: true }));
            }
        });
    }

    function setupPresetsToggle() {
        if (typeof document === 'undefined') return;

        function mount() {
            const section = document.querySelector('.presets-section');
            const heading = section && section.querySelector('h3');
            const buttons = section && section.querySelector('.preset-buttons');
            if (!section || !heading || !buttons || section.querySelector('.presets-toggle')) return;

            const toggle = document.createElement('button');
            toggle.type = 'button';
            toggle.className = 'presets-toggle';
            toggle.setAttribute('aria-expanded', 'false');
            toggle.setAttribute('aria-controls', 'preset-buttons');
            toggle.innerHTML = '<strong>快速预设 <span>Presets</span></strong><span class="presets-toggle-icon" aria-hidden="true">⌄</span>';

            buttons.id = 'preset-buttons';
            buttons.hidden = true;
            heading.replaceWith(toggle);

            toggle.addEventListener('click', function () {
                const expanded = toggle.getAttribute('aria-expanded') === 'true';
                toggle.setAttribute('aria-expanded', String(!expanded));
                buttons.hidden = expanded;
            });
        }

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', mount, { once: true });
        } else {
            mount();
        }
    }

    function loadVisitorCounter() {
        if (typeof document === 'undefined' || document.querySelector('script[data-visitor-counter-loader]')) return;
        const script = document.createElement('script');
        script.defer = true;
        script.dataset.visitorCounterLoader = 'true';
        script.src = '../assets/visitor-counter.js';
        document.head.appendChild(script);
    }

    function freezeScene(scene) {
        if (scene.optimization && typeof scene.optimization === 'object') {
            Object.freeze(scene.optimization);
        }
        return Object.freeze(scene);
    }

    const HUMAN_CENTRED_SCENES = Object.freeze([
        freezeScene({
            id: 'morning-transition',
            labelZh: '\u6668\u95f4\u8fc7\u6e21',
            labelEn: 'Morning Transition',
            cctK: 3500,
            duv: 0,
            illuminanceLux: 250,
            emphasis: 'moderate-daytime-circadian-support'
        }),
        freezeScene({
            id: 'daytime-focus',
            labelZh: '\u65e5\u95f4\u4e13\u6ce8',
            labelEn: 'Daytime Focus',
            cctK: 5000,
            duv: 0,
            illuminanceLux: 400,
            emphasis: 'higher-daytime-melanopic-and-cla2-response'
        }),
        freezeScene({
            id: 'collaboration',
            labelZh: '\u534f\u4f5c\u4ea4\u6d41',
            labelEn: 'Collaboration',
            cctK: 4000,
            duv: 0,
            illuminanceLux: 300,
            emphasis: 'balanced-facial-appearance-colour-fidelity-and-circadian-support'
        }),
        freezeScene({
            id: 'colour-vitality',
            labelZh: '\u8272\u5f69\u6d3b\u529b',
            labelEn: 'Colour Vitality',
            cctK: 3500,
            duv: 0,
            illuminanceLux: 300,
            emphasis: 'high-fidelity-and-rg-105-115',
            optimization: {
                mode: 'gamut',
                targetRg: 115,
                secondaryMetric: 'ra'
            }
        }),
        freezeScene({
            id: 'evening-wind-down',
            labelZh: '\u591c\u95f4\u653e\u677e',
            labelEn: 'Evening Wind-down',
            cctK: 2700,
            duv: 0,
            illuminanceLux: 75,
            emphasis: 'lower-melanopic-and-cla2-stimulus'
        }),
        freezeScene({
            id: 'night-low-disturbance',
            labelZh: '\u591c\u95f4\u4f4e\u5e72\u6270',
            labelEn: 'Night Low Disturbance',
            cctK: 2000,
            duv: 0,
            illuminanceLux: 10,
            emphasis: 'minimize-melanopic-and-cla2-stimulus'
        })
    ]);

    function buildCctJourney() {
        const ascending = [1600];
        for (let cctK = 2000; cctK <= 12000; cctK += 500) ascending.push(cctK);
        return ascending.concat(ascending.slice(0, -1).reverse());
    }

    function sceneById(id) {
        if (typeof id !== 'string') return null;
        return HUMAN_CENTRED_SCENES.find(function (scene) {
            return scene.id === id;
        }) || null;
    }

    function prepareOptimizerOptions(options, profile) {
        if (!profile || profile.mode !== 'gamut' || !Number.isFinite(profile.targetRg) ||
            !options || typeof options.evaluateSpd !== 'function') return options;

        const targetRg = profile.targetRg;
        const originalEvaluateSpd = options.evaluateSpd;
        return Object.assign({}, options, {
            targetRg,
            evaluateSpd: function (spd) {
                const metrics = originalEvaluateSpd(spd);
                if (!metrics || !Number.isFinite(metrics.rg)) return metrics;

                const secondaryValue = Number.isFinite(metrics.ra)
                    ? metrics.ra
                    : (Number.isFinite(metrics.rf) ? metrics.rf : 0);
                const primaryError = Math.abs(metrics.rg - targetRg);
                const secondaryPenalty = Math.max(0, 100 - secondaryValue);

                return Object.assign({}, metrics, {
                    rg: targetRg - (primaryError * 1000 + secondaryPenalty * 0.001)
                });
            }
        });
    }

    function setupSceneOptimizationAdapter() {
        if (!root || !root.METAMER_OPTIMIZER ||
            typeof root.METAMER_OPTIMIZER.optimizeMetamer !== 'function') return;

        const originalOptimizeMetamer = root.METAMER_OPTIMIZER.optimizeMetamer;
        if (!originalOptimizeMetamer.__sceneProfileAware) {
            const wrappedOptimizeMetamer = function (options) {
                return originalOptimizeMetamer(prepareOptimizerOptions(
                    options,
                    root.__spectralSceneOptimizationProfile
                ));
            };
            wrappedOptimizeMetamer.__sceneProfileAware = true;
            root.METAMER_OPTIMIZER.optimizeMetamer = wrappedOptimizeMetamer;
        }

        if (typeof document === 'undefined') return;
        document.addEventListener('click', function (event) {
            const target = event.target;
            const button = target && target.closest
                ? target.closest('.opt-preset-btn[data-scene]')
                : null;
            if (!button) return;

            const scene = sceneById(button.dataset.scene);
            const profile = scene && scene.optimization ? scene.optimization : null;
            root.__spectralSceneOptimizationProfile = profile;
            setTimeout(function () {
                if (root.__spectralSceneOptimizationProfile === profile) {
                    root.__spectralSceneOptimizationProfile = null;
                }
            }, 0);
        }, true);
    }

    setupPresetTemperatures();
    setupPresetOptimizerSync();
    setupPresetsToggle();
    loadVisitorCounter();
    setupSceneOptimizationAdapter();

    return {
        buildCctJourney,
        HUMAN_CENTRED_SCENES,
        sceneById,
        prepareOptimizerOptions
    };
});