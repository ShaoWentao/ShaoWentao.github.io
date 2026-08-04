(function (root) {
    'use strict';

    function byId(id) { return document.getElementById(id); }

    function finite(value, digits) {
        return Number.isFinite(value) ? Number(value).toFixed(digits) : '--';
    }

    function signed(value, digits) {
        if (!Number.isFinite(value)) return '--';
        var rounded = Math.abs(value) < 0.5 * Math.pow(10, -digits) ? 0 : value;
        return (rounded > 0 ? '+' : '') + rounded.toFixed(digits);
    }

    function normalized(values) {
        var array = Array.from(values || [], function (value) { return Number(value) || 0; });
        var max = array.reduce(function (current, value) { return Math.max(current, value); }, 0);
        return max > 0 ? array.map(function (value) { return value / max; }) : array;
    }

    function draw(prefix, beforeSnapshot, afterSnapshot) {
        var canvas = byId(prefix + '-optimization-spd');
        if (!canvas || !beforeSnapshot || !afterSnapshot) return;
        var rect = canvas.getBoundingClientRect();
        var ratio = Math.min(2, root.devicePixelRatio || 1);
        var width = Math.max(420, Math.round(rect.width || 960));
        var height = Math.max(180, Math.round(rect.height || 220));
        canvas.width = Math.round(width * ratio);
        canvas.height = Math.round(height * ratio);
        var ctx = canvas.getContext('2d');
        ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
        ctx.clearRect(0, 0, width, height);

        var pad = { left: 42, right: 18, top: 24, bottom: 30 };
        var plotWidth = width - pad.left - pad.right;
        var plotHeight = height - pad.top - pad.bottom;
        ctx.font = '10px Arial, sans-serif';
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'rgba(42,37,30,.12)';
        ctx.fillStyle = 'rgba(42,37,30,.6)';
        [0, 0.5, 1].forEach(function (value) {
            var y = pad.top + plotHeight * (1 - value);
            ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(pad.left + plotWidth, y); ctx.stroke();
            ctx.fillText(value.toFixed(1), 8, y + 3);
        });
        [380, 480, 580, 680, 780].forEach(function (wavelength) {
            var x = pad.left + plotWidth * ((wavelength - 380) / 400);
            ctx.fillText(String(wavelength), x - 10, height - 8);
        });

        function line(values, dash, widthValue) {
            var data = normalized(values);
            if (!data.length) return;
            ctx.save();
            ctx.setLineDash(dash);
            ctx.lineWidth = widthValue;
            ctx.strokeStyle = dash.length ? 'rgba(75,82,92,.9)' : 'rgba(196,113,28,.95)';
            ctx.beginPath();
            data.forEach(function (value, index) {
                var x = pad.left + plotWidth * (index / Math.max(1, data.length - 1));
                var y = pad.top + plotHeight * (1 - Math.max(0, Math.min(1, value)));
                if (index === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
            });
            ctx.stroke();
            ctx.restore();
        }
        line(beforeSnapshot.spd, [6, 4], 1.7);
        line(afterSnapshot.spd, [], 2.3);

        ctx.fillStyle = 'rgba(75,82,92,.9)';
        ctx.fillText('优化前', pad.left, 13);
        ctx.fillStyle = 'rgba(196,113,28,.95)';
        ctx.fillText('优化后', pad.left + 52, 13);
    }

    function renderMetricRows(container, beforeSnapshot, afterSnapshot) {
        if (!container) return;
        var before = beforeSnapshot.metrics || {};
        var after = afterSnapshot.metrics || {};
        var target = afterSnapshot.target || beforeSnapshot.target || {};
        var rows = [
            ['CCT', before.cct, after.cct, 0, ' K', target.cct],
            ['Duv', before.duv, after.duv, 5, '', target.duv],
            ['x', before.x, after.x, 5, '', target.x],
            ['y', before.y, after.y, 5, '', target.y],
            ['Rf', before.rf, after.rf, 1, '', null],
            ['Rg', before.rg, after.rg, 1, '', null],
            ['Ra', before.ra, after.ra, 1, '', null],
            ['R9', before.r9, after.r9, 1, '', null],
            ['相对照度 Y', before.photopicY, after.photopicY, 3, '', before.photopicY],
            ['相对光谱功率', before.spectralPower, after.spectralPower, 3, '', null]
        ];
        container.innerHTML = rows.map(function (row) {
            var delta = Number(row[2]) - Number(row[1]);
            var targetText = Number.isFinite(row[5])
                ? '目标 ' + finite(row[5], row[3]) + row[4] + ' · '
                : '';
            return '<div class="optimization-metric-row"><span>' + row[0] + '</span><strong>' +
                finite(row[1], row[3]) + row[4] + ' → ' + finite(row[2], row[3]) + row[4] +
                '</strong><small>' + targetText + '变化 ' + signed(delta, row[3]) + row[4] + '</small></div>';
        }).join('');
    }

    function renderChannels(container, beforeSnapshot, afterSnapshot) {
        if (!container) return;
        var before = beforeSnapshot.channels || [];
        var afterById = new Map((afterSnapshot.channels || []).map(function (channel) { return [channel.id, channel]; }));
        container.innerHTML = before.map(function (channel) {
            var after = afterById.get(channel.id) || channel;
            return '<div class="optimization-channel-row"><span>' + (channel.name || channel.id) + '</span><strong>' +
                finite(channel.value, 1) + '% → ' + finite(after.value, 1) + '%</strong><small>' +
                signed(Number(after.value) - Number(channel.value), 1) + '%</small></div>';
        }).join('');
    }

    function largestChannelChange(beforeSnapshot, afterSnapshot) {
        var before = beforeSnapshot && beforeSnapshot.channels || [];
        var afterById = new Map((afterSnapshot && afterSnapshot.channels || []).map(function (channel) { return [channel.id, channel]; }));
        var largest = null;
        before.forEach(function (channel) {
            var after = afterById.get(channel.id) || channel;
            var delta = Number(after.value) - Number(channel.value);
            if (!largest || Math.abs(delta) > Math.abs(largest.delta)) {
                largest = {
                    id: channel.id,
                    name: channel.name || channel.id,
                    before: Number(channel.value),
                    after: Number(after.value),
                    delta: delta
                };
            }
        });
        return largest;
    }

    function compactMetricRows(beforeSnapshot, afterSnapshot) {
        var before = beforeSnapshot.metrics || {};
        var after = afterSnapshot.metrics || {};
        return [
            ['CCT', before.cct, after.cct, 0, ' K'],
            ['Duv', before.duv, after.duv, 5, ''],
            ['Rf', before.rf, after.rf, 1, ''],
            ['Rg', before.rg, after.rg, 1, ''],
            ['R9', before.r9, after.r9, 1, '']
        ];
    }

    function compactErrorText(detail) {
        var before = detail && detail.before || {};
        var after = detail && detail.after || {};
        var goal = detail && (detail.goal || detail.mode);
        if (goal === 'fidelity' && Number.isFinite(before.meanDeltaE00) && Number.isFinite(after.meanDeltaE00)) {
            return '平均 ΔE00 ' + finite(before.meanDeltaE00, 2) + ' → ' + finite(after.meanDeltaE00, 2) +
                ' · 最大 ' + finite(before.maxDeltaE00, 2) + ' → ' + finite(after.maxDeltaE00, 2);
        }
        if (Number.isFinite(before.weightedMeanPreferenceError) && Number.isFinite(after.weightedMeanPreferenceError)) {
            return '平均偏好误差 ' + finite(before.weightedMeanPreferenceError, 2) + ' → ' + finite(after.weightedMeanPreferenceError, 2);
        }
        return '优化前后误差已完成比较';
    }

    function buildCompactSummary(detail, options) {
        if (!detail || !detail.beforeSnapshot || !detail.afterSnapshot) return null;
        var largest = largestChannelChange(detail.beforeSnapshot, detail.afterSnapshot);
        var channelText = !largest || Math.abs(largest.delta) < 0.05
            ? '通道配方未变化'
            : '最大通道变化 ' + largest.name + ' ' + finite(largest.before, 1) + '% → ' +
                finite(largest.after, 1) + '%（' + signed(largest.delta, 1) + '%）';
        return {
            conclusion: options && options.summary ? options.summary : '优化结果已生成',
            metrics: compactMetricRows(detail.beforeSnapshot, detail.afterSnapshot),
            errorText: compactErrorText(detail),
            channelText: channelText
        };
    }

    function renderCompact(prefix, detail, options) {
        var panel = byId(prefix + '-result-summary');
        var metrics = byId(prefix + '-result-metrics');
        var conclusion = byId(prefix + '-result-conclusion');
        var error = byId(prefix + '-result-error');
        var channel = byId(prefix + '-result-channel');
        if (!panel || !metrics || !conclusion || !error || !channel) return;
        var summary = buildCompactSummary(detail, options);
        if (!summary) return;
        conclusion.textContent = summary.conclusion;
        error.textContent = summary.errorText;
        channel.textContent = summary.channelText;
        metrics.innerHTML = summary.metrics.map(function (row) {
            var delta = Number(row[2]) - Number(row[1]);
            return '<div class="material-result-metric"><span>' + row[0] + '</span><strong>' +
                finite(row[2], row[3]) + row[4] + '</strong><small>' +
                finite(row[1], row[3]) + row[4] + ' → ' + finite(row[2], row[3]) + row[4] +
                ' · ' + signed(delta, row[3]) + row[4] + '</small></div>';
        }).join('');
        panel.hidden = false;
    }

    function clear(prefix) {
        var summary = byId(prefix + '-result-summary');
        var details = byId(prefix + '-technical-details');
        var comparison = byId(prefix + '-optimization-comparison');
        if (summary) summary.hidden = true;
        if (details) {
            details.open = false;
            details.hidden = true;
        }
        if (comparison) comparison.hidden = true;
    }

    function snapshotsChanged(beforeSnapshot, afterSnapshot) {
        var before = beforeSnapshot && beforeSnapshot.channels || [];
        var afterById = new Map((afterSnapshot && afterSnapshot.channels || []).map(function (channel) { return [channel.id, channel.value]; }));
        return before.some(function (channel) {
            return Math.abs(Number(afterById.get(channel.id)) - Number(channel.value)) > 0.049;
        });
    }

    function render(prefix, detail, options) {
        var panel = byId(prefix + '-optimization-comparison');
        if (!panel || !detail || !detail.beforeSnapshot || !detail.afterSnapshot) return false;
        panel.hidden = false;
        draw(prefix, detail.beforeSnapshot, detail.afterSnapshot);
        renderMetricRows(byId(prefix + '-optimization-metrics'), detail.beforeSnapshot, detail.afterSnapshot);
        renderChannels(byId(prefix + '-optimization-channels'), detail.beforeSnapshot, detail.afterSnapshot);
        var summary = byId(prefix + '-optimization-summary');
        if (summary && options && options.summary) summary.textContent = options.summary;
        renderCompact(prefix, detail, options);
        panel.dataset.changed = snapshotsChanged(detail.beforeSnapshot, detail.afterSnapshot) ? 'true' : 'false';
        return panel.dataset.changed === 'true';
    }

    root.OptimizationComparison = Object.freeze({
        render: render,
        clear: clear,
        buildCompactSummary: buildCompactSummary,
        snapshotsChanged: snapshotsChanged
    });
})(typeof window !== 'undefined' ? window : globalThis);
