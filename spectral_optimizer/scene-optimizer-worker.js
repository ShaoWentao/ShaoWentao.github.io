'use strict';

self.window = self;
importScripts(
    'spectral-data.js?v=20260804-dining-condition-baseline',
    'spectral-math.js?v=20260804-dining-condition-baseline',
    'colour-quality-data.js?v=20260804-dining-condition-baseline',
    'colour-quality.js?v=20260804-dining-condition-baseline',
    'candidate-shortlist.js?v=20260804-dining-condition-baseline',
    'metamer-optimizer.js?v=20260804-dining-condition-baseline',
    'scene-optimizer-core.js?v=20260804-dining-condition-baseline'
);

self.onmessage = function (event) {
    const message = event && event.data ? event.data : {};
    if (message.type !== 'optimize-scene') return;
    const requestId = message.requestId;
    try {
        const payload = message.payload || {};
        const result = self.SceneOptimizerCore.optimizeScene(payload);
        self.postMessage({ requestId, result });
    } catch (error) {
        self.postMessage({
            requestId,
            error: error && error.message ? error.message : String(error)
        });
    }
};
