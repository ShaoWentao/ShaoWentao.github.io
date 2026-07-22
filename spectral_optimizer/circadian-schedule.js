(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    root.CIRCADIAN_SCHEDULE = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    const DEFAULT_STAGES = Object.freeze([
        Object.freeze({ id: 'morning', time: '07:00', sceneId: 'morning-transition', labelZh: '晨间唤醒', labelEn: 'Morning' }),
        Object.freeze({ id: 'daytime', time: '09:00', sceneId: 'daytime-focus', labelZh: '日间专注', labelEn: 'Daytime' }),
        Object.freeze({ id: 'collaboration', time: '13:00', sceneId: 'collaboration', labelZh: '协作交流', labelEn: 'Collaboration' }),
        Object.freeze({ id: 'evening', time: '17:30', sceneId: 'evening-wind-down', labelZh: '傍晚过渡', labelEn: 'Evening' }),
        Object.freeze({ id: 'night', time: '21:30', sceneId: 'night-low-disturbance', labelZh: '夜间低干扰', labelEn: 'Night' })
    ]);

    function timeToMinutes(value) {
        const match = /^(\d{1,2}):(\d{2})$/.exec(String(value || ''));
        if (!match) return NaN;
        const hours = Number(match[1]);
        const minutes = Number(match[2]);
        return hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60 ? hours * 60 + minutes : NaN;
    }

    function normalizeStages(stages) {
        return stages.map(stage => ({ ...stage, minute: timeToMinutes(stage.time) }))
            .filter(stage => Number.isFinite(stage.minute))
            .sort((a, b) => a.minute - b.minute);
    }

    function stateAt(stages, minuteOfDay, transitionMinutes = 30) {
        const ordered = normalizeStages(stages);
        if (!ordered.length) return null;
        const minute = ((minuteOfDay % 1440) + 1440) % 1440;
        let activeIndex = ordered.findLastIndex(stage => stage.minute <= minute);
        if (activeIndex < 0) activeIndex = ordered.length - 1;
        const active = ordered[activeIndex];
        const previous = ordered[(activeIndex - 1 + ordered.length) % ordered.length];
        let elapsed = minute - active.minute;
        if (elapsed < 0) elapsed += 1440;
        return {
            active,
            previous,
            progress: transitionMinutes > 0 ? Math.max(0, Math.min(1, elapsed / transitionMinutes)) : 1
        };
    }

    function blendScenes(previous, active, progress) {
        const mix = (a, b) => a + (b - a) * progress;
        return {
            cctK: mix(previous.cctK, active.cctK),
            duv: mix(previous.duv || 0, active.duv || 0),
            illuminanceLux: mix(previous.illuminanceLux, active.illuminanceLux),
            emphasis: active.emphasis
        };
    }

    function advanceSimulationMinute(currentMinute, stepMinutes = 15) {
        const current = Number.isFinite(currentMinute) ? currentMinute : 0;
        const step = Number.isFinite(stepMinutes) && stepMinutes > 0 ? stepMinutes : 15;
        return Math.min(1440, current + step);
    }

    function formatMinuteOfDay(minuteOfDay) {
        const minute = Math.max(0, Math.min(1440, Math.round(Number(minuteOfDay) || 0)));
        if (minute === 1440) return '24:00';
        const hours = Math.floor(minute / 60);
        const minutes = minute % 60;
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    }

    return Object.freeze({
        DEFAULT_STAGES,
        timeToMinutes,
        normalizeStages,
        stateAt,
        blendScenes,
        advanceSimulationMinute,
        formatMinuteOfDay
    });
});
