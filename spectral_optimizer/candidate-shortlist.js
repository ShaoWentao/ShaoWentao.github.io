(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) root.CandidateShortlist = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    function selectCandidateShortlist(candidates, options) {
        if (!Array.isArray(candidates)) throw new TypeError('candidates must be an array');
        const config = options || {};
        const maxCandidates = config.maxCandidates === undefined ? 512 : Number(config.maxCandidates);
        const precisionFraction = config.precisionFraction === undefined
            ? 0.5
            : Number(config.precisionFraction);
        if (!Number.isInteger(maxCandidates) || maxCandidates < 1) {
            throw new RangeError('maxCandidates must be a positive integer');
        }
        if (!Number.isFinite(precisionFraction) || precisionFraction < 0 || precisionFraction > 1) {
            throw new RangeError('precisionFraction must be between 0 and 1');
        }
        if (candidates.length <= maxCandidates) return candidates.slice();

        const ranked = candidates.slice().sort(function (left, right) {
            const leftError = Number.isFinite(left && left.deltaUv) ? left.deltaUv : Infinity;
            const rightError = Number.isFinite(right && right.deltaUv) ? right.deltaUv : Infinity;
            if (leftError !== rightError) return leftError - rightError;
            return (left && Number.isFinite(left.sequence) ? left.sequence : 0) -
                (right && Number.isFinite(right.sequence) ? right.sequence : 0);
        });
        const precisionCount = Math.min(maxCandidates,
            Math.max(1, Math.round(maxCandidates * precisionFraction)));
        const selected = ranked.slice(0, precisionCount);
        const selectedSet = new Set(selected);
        const remainingSlots = maxCandidates - selected.length;
        if (remainingSlots <= 0) return selected;

        const coveragePool = candidates.filter(candidate => !selectedSet.has(candidate));
        for (let slot = 0; slot < remainingSlots && coveragePool.length; slot++) {
            const index = Math.min(
                coveragePool.length - 1,
                Math.floor((slot + 0.5) * coveragePool.length / remainingSlots)
            );
            selected.push(coveragePool[index]);
        }
        return selected;
    }

    return { selectCandidateShortlist };
});
