'use strict';

(function initWorkspaceState(globalScope) {
    const VALID_CHROMATICITY_VIEWS = new Set(['cie1976', 'cie1931']);
    const VALID_ANALYSIS_TABS = new Set(['colour', 'material', 'dining']);
    const DETAIL_KEYS = Object.freeze(['chromaticity', 'health', 'contribution']);

    function cloneValue(value) {
        if (value === null || typeof value !== 'object') return value;
        if (value instanceof ArrayBuffer) return value.slice(0);
        if (ArrayBuffer.isView(value)) {
            if (value instanceof DataView) {
                return new DataView(value.buffer.slice(0), value.byteOffset, value.byteLength);
            }
            return new value.constructor(value);
        }
        if (Array.isArray(value)) return value.map(cloneValue);

        const copy = {};
        for (const [key, nestedValue] of Object.entries(value)) {
            copy[key] = cloneValue(nestedValue);
        }
        return copy;
    }

    function valuesEqual(left, right) {
        if (Object.is(left, right)) return true;
        if (left === null || right === null) return false;
        if (typeof left !== 'object' || typeof right !== 'object') return false;

        if (ArrayBuffer.isView(left) || ArrayBuffer.isView(right)) {
            if (!ArrayBuffer.isView(left) || !ArrayBuffer.isView(right)) return false;
            if (left.constructor !== right.constructor || left.byteLength !== right.byteLength) return false;
            const leftBytes = new Uint8Array(left.buffer, left.byteOffset, left.byteLength);
            const rightBytes = new Uint8Array(right.buffer, right.byteOffset, right.byteLength);
            return leftBytes.every((value, index) => value === rightBytes[index]);
        }

        if (Array.isArray(left) || Array.isArray(right)) {
            if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
            return left.every((value, index) => valuesEqual(value, right[index]));
        }

        const leftKeys = Object.keys(left);
        const rightKeys = Object.keys(right);
        if (leftKeys.length !== rightKeys.length) return false;
        return leftKeys.every(key => Object.prototype.hasOwnProperty.call(right, key)
            && valuesEqual(left[key], right[key]));
    }

    function createWorkspaceState() {
        let state = {
            chromaticityView: 'cie1931',
            analysisTab: 'colour',
            details: {
                chromaticity: false,
                health: false,
                contribution: false
            },
            currentResult: null
        };
        const listeners = new Set();

        function getSnapshot() {
            return cloneValue(state);
        }

        function notify() {
            for (const listener of listeners) listener(getSnapshot());
        }

        function replaceState(nextState) {
            if (valuesEqual(state, nextState)) return false;
            state = nextState;
            notify();
            return true;
        }

        function setChromaticityView(view) {
            if (!VALID_CHROMATICITY_VIEWS.has(view) || state.chromaticityView === view) return false;
            return replaceState({ ...state, chromaticityView: view });
        }

        function setAnalysisTab(tab) {
            if (!VALID_ANALYSIS_TABS.has(tab) || state.analysisTab === tab) return false;
            return replaceState({ ...state, analysisTab: tab });
        }

        function setDetails(patch) {
            if (!patch || typeof patch !== 'object') return false;
            const nextDetails = { ...state.details };
            for (const key of DETAIL_KEYS) {
                if (typeof patch[key] === 'boolean') nextDetails[key] = patch[key];
            }
            if (valuesEqual(nextDetails, state.details)) return false;
            return replaceState({ ...state, details: nextDetails });
        }

        function setCurrentResult(result) {
            const nextResult = result === null ? null : cloneValue(result);
            if (valuesEqual(state.currentResult, nextResult)) return false;
            return replaceState({ ...state, currentResult: nextResult });
        }

        function subscribe(listener) {
            if (typeof listener !== 'function') throw new TypeError('listener must be a function');
            listeners.add(listener);
            listener(getSnapshot());
            return function unsubscribe() {
                listeners.delete(listener);
            };
        }

        return Object.freeze({
            getSnapshot,
            setChromaticityView,
            setAnalysisTab,
            setDetails,
            setCurrentResult,
            subscribe
        });
    }

    const api = Object.freeze({ createWorkspaceState });

    if (globalScope && typeof globalScope === 'object') {
        globalScope.SpectralWorkspaceState = api;
        if (!globalScope.SpectralWorkspaceStore) {
            globalScope.SpectralWorkspaceStore = createWorkspaceState();
        }
    }

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
}(typeof globalThis !== 'undefined' ? globalThis : this));
