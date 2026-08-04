(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) root.SceneOptimizerWorkerClient = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    function createCancellationError(message) {
        const error = new Error(message || 'Scene optimization was cancelled');
        error.name = 'AbortError';
        error.code = 'SCENE_OPTIMIZER_CANCELLED';
        return error;
    }

    function createSceneOptimizerWorkerClient(options) {
        const config = options || {};
        const WorkerCtor = config.WorkerCtor === undefined
            ? (typeof Worker === 'function' ? Worker : null)
            : config.WorkerCtor;
        const workerUrl = config.workerUrl || 'scene-optimizer-worker.js';
        let active = null;
        let requestId = 0;

        function release(task, terminate) {
            if (!task) return;
            task.worker.onmessage = null;
            task.worker.onerror = null;
            if (terminate !== false && typeof task.worker.terminate === 'function') task.worker.terminate();
            if (active === task) active = null;
        }

        function cancel(message) {
            if (!active) return false;
            const task = active;
            release(task, true);
            task.reject(createCancellationError(message));
            return true;
        }

        function optimize(payload) {
            if (typeof WorkerCtor !== 'function') {
                return Promise.reject(new Error('Web Worker is unavailable'));
            }
            cancel('A newer scene optimization replaced this request');
            const id = ++requestId;
            let worker;
            try {
                worker = new WorkerCtor(workerUrl);
            } catch (error) {
                return Promise.reject(error);
            }
            return new Promise(function (resolve, reject) {
                const task = { id, worker, resolve, reject };
                active = task;
                worker.onmessage = function (event) {
                    const data = event && event.data ? event.data : {};
                    if (active !== task || data.requestId !== id) return;
                    release(task, true);
                    if (data.error) reject(new Error(data.error));
                    else resolve(data.result);
                };
                worker.onerror = function (event) {
                    if (active !== task) return;
                    const message = event && event.message ? event.message : 'Scene optimizer worker failed';
                    if (event && typeof event.preventDefault === 'function') event.preventDefault();
                    release(task, true);
                    reject(new Error(message));
                };
                try {
                    worker.postMessage({
                        type: 'optimize-scene',
                        requestId: id,
                        payload
                    });
                } catch (error) {
                    release(task, true);
                    reject(error);
                }
            });
        }

        return {
            optimize,
            cancel,
            isSupported() { return typeof WorkerCtor === 'function'; }
        };
    }

    return { createSceneOptimizerWorkerClient, createCancellationError };
});
