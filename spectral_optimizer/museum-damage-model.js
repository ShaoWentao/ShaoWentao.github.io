(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) root.MuseumDamageModel = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    const DISCLAIMER = '累计曝光量用于照明条件比较，本原型不输出绝对损伤结论。';

    function finiteInRange(name, value, min, max) {
        const number = Number(value);
        if (!Number.isFinite(number) || number < min || number > max) {
            throw new RangeError(name + ' must be between ' + min + ' and ' + max);
        }
        return number;
    }

    function exposure(illuminance, dailyHours, annualDays) {
        const dailyLxHours = illuminance * dailyHours;
        return {
            illuminance,
            dailyLxHours,
            annualLxHours: dailyLxHours * annualDays
        };
    }

    function calculateExposure(options) {
        const settings = options || {};
        const currentIlluminance = finiteInRange('currentIlluminance', settings.currentIlluminance, 0, 1000000);
        const targetIlluminance = finiteInRange('targetIlluminance', settings.targetIlluminance, 0, 1000000);
        const dailyHours = finiteInRange('dailyHours', settings.dailyHours, 0, 24);
        const annualDays = finiteInRange('annualDays', settings.annualDays, 0, 366);
        const current = exposure(currentIlluminance, dailyHours, annualDays);
        const target = exposure(targetIlluminance, dailyHours, annualDays);
        const changePercent = current.annualLxHours > 0
            ? (target.annualLxHours / current.annualLxHours - 1) * 100
            : 0;
        return Object.freeze({
            current: Object.freeze(current),
            target: Object.freeze(target),
            changePercent,
            dailyHours,
            annualDays,
            disclaimerCN: DISCLAIMER
        });
    }

    return Object.freeze({
        disclaimerCN: DISCLAIMER,
        calculateExposure
    });
});
