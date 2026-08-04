(function (root, factory) {
    'use strict';
    const createWorkbenchSummary = factory();
    if (root && root.document) root.WorkbenchSummary = createWorkbenchSummary(root.document);
    if (typeof module !== 'undefined' && module.exports) module.exports = { createWorkbenchSummary };
})(typeof window !== 'undefined' ? window : globalThis, function () {
    'use strict';

    function createWorkbenchSummary(documentRef) {
        function set(id, value) {
            const element = documentRef && documentRef.getElementById(id);
            if (element) element.textContent = value;
        }
        function finite(value) { return Number.isFinite(Number(value)); }
        function integer(value) { return finite(value) ? Math.round(Number(value)).toLocaleString('en-US') : '--'; }
        function duv(value) { return finite(value) ? `${Number(value) >= 0 ? '+' : ''}${Number(value).toFixed(4)}` : '--'; }

        function clear() {
            ['summary-cct-value','summary-duv-value','summary-rf-value','summary-rg-value',
                'summary-medi-value','summary-cs-value','summary-mel-value'].forEach(id => set(id, '--'));
            set('summary-cct-note', '目标 --');
            set('summary-duv-note', '目标 --');
            set('summary-medi-note', '眼部照度 --');
            set('summary-cs-note', '--');
        }

        function updateCsCondition(snapshot = {}) {
            set('summary-cs-value', finite(snapshot.cs) && Number(snapshot.cs) >= 0 ? Number(snapshot.cs).toFixed(3) : '--');
            const exposure = finite(snapshot.exposureHours) ? `${Number(snapshot.exposureHours).toFixed(1)} h` : '--';
            const field = snapshot.visualFieldLabel || '';
            set('summary-cs-note', field ? `${exposure} · ${field}` : exposure);
        }

        function update(snapshot = {}) {
            set('summary-cct-value', finite(snapshot.cct) && Number(snapshot.cct) > 0 ? `${integer(snapshot.cct)} K` : '--');
            set('summary-cct-note', finite(snapshot.targetCct) ? `目标 ${integer(snapshot.targetCct)} K` : '目标 --');
            set('summary-duv-value', duv(snapshot.duv));
            set('summary-duv-note', finite(snapshot.targetDuv) ? `目标 ${duv(snapshot.targetDuv)}` : '目标 --');
            set('summary-rf-value', finite(snapshot.rf) && Number(snapshot.rf) > 0 ? integer(snapshot.rf) : '--');
            set('summary-rg-value', finite(snapshot.rg) && Number(snapshot.rg) > 0 ? integer(snapshot.rg) : '--');
            set('summary-medi-value', finite(snapshot.melanopicEdi) && Number(snapshot.melanopicEdi) >= 0
                ? `${integer(snapshot.melanopicEdi)} lx` : '--');
            set('summary-medi-note', finite(snapshot.eyeIlluminance)
                ? `眼部照度 ${integer(snapshot.eyeIlluminance)} lx` : '眼部照度 --');
            updateCsCondition(snapshot);
            set('summary-mel-value', finite(snapshot.melanopicDer) && Number(snapshot.melanopicDer) >= 0
                ? Number(snapshot.melanopicDer).toFixed(2) : '--');
        }

        clear();
        return Object.freeze({ update, updateCsCondition, clear });
    }

    return createWorkbenchSummary;
});
