'use strict';

(function exposeRenderPipeline(globalScope, factory) {
    const api = factory(globalScope);
    if (globalScope && typeof globalScope === 'object') {
        globalScope.SpectralRenderPipeline = api;
    }
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
}(typeof globalThis !== 'undefined' ? globalThis : this, function createApi(globalScope) {
    function createRenderPipeline(options = {}) {
        const requestFrame = options.requestFrame
            || (callback => globalScope.requestAnimationFrame(callback));
        const cancelFrame = options.cancelFrame
            || (handle => globalScope.cancelAnimationFrame(handle));
        const requestIdle = options.requestIdle
            || (typeof globalScope.requestIdleCallback === 'function'
                ? callback => globalScope.requestIdleCallback(callback, { timeout: 180 })
                : callback => globalScope.setTimeout(
                    () => callback({ didTimeout: true, timeRemaining: () => 0 }),
                    0
                ));
        const cancelIdle = options.cancelIdle
            || (typeof globalScope.cancelIdleCallback === 'function'
                ? handle => globalScope.cancelIdleCallback(handle)
                : handle => globalScope.clearTimeout(handle));

        const onFast = typeof options.onFast === 'function' ? options.onFast : () => {};
        const onBase = typeof options.onBase === 'function' ? options.onBase : () => {};
        const onDeferred = typeof options.onDeferred === 'function' ? options.onDeferred : () => {};
        const onError = typeof options.onError === 'function' ? options.onError : () => {};

        let version = 0;
        let latestPayload = null;
        let fastHandle = null;
        let baseHandle = null;
        let idleHandle = null;

        function clearHandle(kind) {
            if (kind === 'fast' && fastHandle !== null) {
                cancelFrame(fastHandle);
                fastHandle = null;
            }
            if (kind === 'base' && baseHandle !== null) {
                cancelFrame(baseHandle);
                baseHandle = null;
            }
            if (kind === 'deferred' && idleHandle !== null) {
                cancelIdle(idleHandle);
                idleHandle = null;
            }
        }

        function clearPending() {
            clearHandle('fast');
            clearHandle('base');
            clearHandle('deferred');
        }

        function isCurrent(candidateVersion) {
            return candidateVersion === version;
        }

        function invoke(stage, callback, payload, candidateVersion) {
            try {
                callback(payload, candidateVersion, isCurrent);
            } catch (error) {
                onError(error, stage, candidateVersion);
            }
        }

        function schedule(payload) {
            version += 1;
            latestPayload = payload;
            clearPending();
            const scheduledVersion = version;

            fastHandle = requestFrame(() => {
                fastHandle = null;
                if (!isCurrent(scheduledVersion)) return;
                invoke('fast', onFast, latestPayload, scheduledVersion);
                if (!isCurrent(scheduledVersion)) return;

                baseHandle = requestFrame(() => {
                    baseHandle = null;
                    if (!isCurrent(scheduledVersion)) return;
                    invoke('base', onBase, latestPayload, scheduledVersion);
                    if (!isCurrent(scheduledVersion)) return;

                    idleHandle = requestIdle(deadline => {
                        idleHandle = null;
                        if (!isCurrent(scheduledVersion)) return;
                        const deferredPayload = latestPayload;
                        try {
                            onDeferred(deferredPayload, scheduledVersion, isCurrent, deadline);
                        } catch (error) {
                            onError(error, 'deferred', scheduledVersion);
                        }
                    });
                });
            });

            return scheduledVersion;
        }

        function cancel() {
            version += 1;
            latestPayload = null;
            clearPending();
            return version;
        }

        return Object.freeze({
            schedule,
            cancel,
            currentVersion: () => version,
            isCurrent
        });
    }

    return Object.freeze({ createRenderPipeline });
}));
