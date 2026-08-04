'use strict';

self.window = self;
importScripts(
    'spectral-data.js?v=20260804-material-target-lock',
    'spectral-math.js?v=20260804-material-target-lock',
    'colour-quality-data.js?v=20260804-material-target-lock',
    'colour-quality.js?v=20260804-material-target-lock',
    'candidate-shortlist.js?v=20260804-material-target-lock',
    'metamer-optimizer.js?v=20260804-material-target-lock',
    'scene-optimizer-core.js?v=20260804-material-target-lock'
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
