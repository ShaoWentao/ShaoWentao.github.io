(function (root) {
    'use strict';

    var alphaData = null;
    var latest = null;
    var selectedCurves = new Set();
    var contributionMetric = 'photopic';

    var curveMeta = {
        photopic: { label: 'Photopic V(λ)', color: '#5f6368' },
        cyanopic: { label: 'S-cone-opic', shortLabel: 'S-cone', color: '#2f80ed' },
        chloropic: { label: 'M-cone-opic', shortLabel: 'M-cone', color: '#28a96b' },
        erythropic: { label: 'L-cone-opic', shortLabel: 'L-cone', color: '#e45151' },
        rhodopic: { label: 'Rhodopic', shortLabel: 'Rod', color: '#7b61c9' },
        melanopic: { label: 'Melanopic', shortLabel: 'Mel', color: '#00a7a7' }
    };

    function number(value, digits) {
        return Number.isFinite(value) ? value.toFixed(digits) : '--';
    }

    function parseCsv(text) {
        var rows = text.trim().split(/\r?\n/);
        var result = {
            wavelengths: [],
            cyanopic: [],
            chloropic: [],
            erythropic: [],
            rhodopic: [],
            melanopic: []
        };
        rows.forEach(function (line) {
            var cells = line.split(',');
            if (cells.length < 6) return;
            result.wavelengths.push(Number(cells[0]));
            result.cyanopic.push(Number.isFinite(Number(cells[1])) ? Number(cells[1]) : 0);
            result.chloropic.push(Number.isFinite(Number(cells[2])) ? Number(cells[2]) : 0);
            result.erythropic.push(Number.isFinite(Number(cells[3])) ? Number(cells[3]) : 0);
            result.rhodopic.push(Number.isFinite(Number(cells[4])) ? Number(cells[4]) : 0);
            result.melanopic.push(Number.isFinite(Number(cells[5])) ? Number(cells[5]) : 0);
        });
        return result.wavelengths.length === 401 ? result : null;
    }

    function loadOfficialData() {
        return fetch('cie-alpha-opic-action-spectra.csv')
            .then(function (response) {
                if (!response.ok) throw new Error('CIE S 026 data unavailable');
                return response.text();
            })
            .then(function (text) {
                alphaData = parseCsv(text);
                if (!alphaData) throw new Error('Invalid CIE S 026 data');
                document.dispatchEvent(new CustomEvent('spectral-professional-curves-ready'));
                if (latest) render(latest);
            })
            .catch(function () {
                var status = document.getElementById('professional-data-status');
                if (status) status.textContent = 'CIE S 026 数据未加载；请通过网页服务器访问。';
            });
    }

    function injectUi() {
        var controls = document.querySelector('.spd-controls');
        if (controls && !document.getElementById('action-curve-menu')) {
            var details = document.createElement('details');
            details.className = 'action-curve-menu';
            details.id = 'action-curve-menu';
            details.innerHTML =
                '<summary>作用曲线</summary>' +
                '<div class="action-curve-popover">' +
                Object.keys(curveMeta).map(function (key) {
                    return '<label><input type="checkbox" value="' + key + '">' +
                        '<span style="--curve-color:' + curveMeta[key].color + '"></span>' +
                        curveMeta[key].label + '</label>';
                }).join('') +
                '<small>仅作为归一化参考曲线叠加，不参与 SPD 计算。</small></div>';
            controls.prepend(details);
            details.addEventListener('change', function (event) {
                var input = event.target;
                if (!input.matches('input[type="checkbox"]')) return;
                if (input.checked) selectedCurves.add(input.value);
                else selectedCurves.delete(input.value);
                document.dispatchEvent(new CustomEvent('spectral-professional-overlay-change'));
            });
        }

        var chartsRow = document.querySelector('.charts-row');
        var cie1931Panel = document.getElementById('cie-panel');
        if (chartsRow && cie1931Panel && !document.getElementById('cie1976-panel')) {
            var cie1976Panel = document.createElement('div');
            cie1976Panel.className = 'cie1976-panel glass-card';
            cie1976Panel.id = 'cie1976-panel';
            cie1976Panel.innerHTML =
                '<div class="cie-header"><h2>CIE 1976 色度图</h2>' +
                    '<strong class="cie1976-coordinate" id="professional-upvp">u′ -- · v′ --</strong>' +
                '</div>' +
                '<div class="cie1976-canvas-wrapper">' +
                    '<canvas id="professional-cie1976" aria-label="CIE 1976 u prime v prime 色度图"></canvas>' +
                '</div>';
            cie1931Panel.insertAdjacentElement('afterend', cie1976Panel);
        }

        var dashboard = document.getElementById('metrics-dashboard');
        if (!dashboard || document.getElementById('professional-analysis-panel')) return;
        var panel = document.createElement('details');
        panel.className = 'professional-analysis-panel glass-card';
        panel.id = 'professional-analysis-panel';
        panel.innerHTML =
            '<summary><span><strong>专业分析</strong><small>CIE 坐标、α-opic 响应与通道贡献</small></span><span>展开</span></summary>' +
            '<div class="professional-analysis-body">' +
                '<div class="professional-coordinate-grid">' +
                    '<div><span>主波长</span><strong id="professional-dominant">-- nm</strong></div>' +
                    '<div><span>色纯度</span><strong id="professional-purity">--%</strong></div>' +
                '</div>' +
                '<section class="alpha-opic-section">' +
                    '<div class="professional-subhead"><div><strong>CIE S 026 α-opic DER</strong><small>相对于同照度 D65 的光感受器响应</small></div></div>' +
                    '<div class="alpha-opic-grid" id="alpha-opic-grid"></div>' +
                '</section>' +
                '<section class="channel-contribution-section">' +
                    '<div class="professional-subhead"><div><strong>单通道贡献</strong><small>当前配方下可线性分解的响应占比</small></div>' +
                    '<select id="channel-contribution-metric" aria-label="选择通道贡献指标">' +
                        '<option value="photopic">Photopic</option>' +
                        '<option value="cyanopic">S-cone-opic</option>' +
                        '<option value="chloropic">M-cone-opic</option>' +
                        '<option value="erythropic">L-cone-opic</option>' +
                        '<option value="rhodopic">Rhodopic</option>' +
                        '<option value="melanopic">Melanopic</option>' +
                        '<option value="radiant">相对辐射功率</option>' +
                    '</select></div>' +
                    '<div class="channel-contribution-list" id="channel-contribution-list"></div>' +
                    '<p>Rf、Rg 与 R9 是混合光谱的综合色彩评价，不能拆成可相加的单通道贡献，因此不在此表中显示。</p>' +
                '</section>' +
                '<p class="professional-data-status" id="professional-data-status">作用光谱：CIE S 026:2018 官方 1 nm 数据。</p>' +
            '</div>';
        dashboard.appendChild(panel);
        panel.addEventListener('toggle', function () {
            if (panel.open && latest) requestAnimationFrame(function () { renderDiagrams(latest); });
        });
        panel.querySelector('#channel-contribution-metric').addEventListener('change', function (event) {
            contributionMetric = event.target.value;
            if (latest) renderContributions(latest);
        });
    }

    function integrate(values, weights) {
        var sum = 0;
        var length = Math.min(values.length, weights.length);
        for (var i = 0; i < length; i++) sum += values[i] * weights[i];
        return sum;
    }

    function normalizeCurve(values) {
        var max = Math.max.apply(null, values);
        return max > 0 ? values.map(function (value) { return value / max; }) : values.slice();
    }

    function getCurve(key, fallback) {
        if (key === 'photopic') return fallback && fallback.photopic;
        if (alphaData && alphaData[key]) return alphaData[key];
        if (key === 'melanopic') return fallback && fallback.melanopic;
        return null;
    }

    function xyToProfessional(x, y) {
        var denominator = -2 * x + 12 * y + 3;
        return {
            u: denominator ? 4 * x / denominator : NaN,
            v: denominator ? 6 * y / denominator : NaN,
            up: denominator ? 4 * x / denominator : NaN,
            vp: denominator ? 9 * y / denominator : NaN
        };
    }

    function locusXy(wavelength, fallback) {
        var index = Math.max(0, Math.min(400, Math.round(wavelength - 380)));
        var xBar = fallback.xBar[index] || 0;
        var yBar = fallback.yBar[index] || 0;
        var zBar = fallback.zBar[index] || 0;
        var sum = xBar + yBar + zBar;
        return sum > 0 ? { x: xBar / sum, y: yBar / sum } : null;
    }

    function dominantWavelengthAndPurity(x, y, fallback) {
        var white = { x: 0.3127, y: 0.3290 };
        var tx = x - white.x;
        var ty = y - white.y;
        var targetLength = Math.hypot(tx, ty);
        if (targetLength < 1e-7) return { wavelength: NaN, purity: 0 };
        var best = null;
        for (var wavelength = 380; wavelength <= 700; wavelength++) {
            var point = locusXy(wavelength, fallback);
            if (!point) continue;
            var lx = point.x - white.x;
            var ly = point.y - white.y;
            var locusLength = Math.hypot(lx, ly);
            if (locusLength < 1e-7) continue;
            var alignment = (tx * lx + ty * ly) / (targetLength * locusLength);
            if (alignment <= 0) continue;
            var cross = Math.abs(tx * ly - ty * lx) / locusLength;
            var score = cross + (1 - alignment) * 0.05;
            if (!best || score < best.score) {
                best = { score: score, wavelength: wavelength, purity: targetLength / locusLength * 100 };
            }
        }
        return best || { wavelength: NaN, purity: NaN };
    }

    function wavelengthRgb(wavelength) {
        var hue;
        if (wavelength < 440) hue = 270 - (wavelength - 380) * 0.75;
        else if (wavelength < 490) hue = 225 - (wavelength - 440) * 1.5;
        else if (wavelength < 560) hue = 180 - (wavelength - 490) * 1.55;
        else if (wavelength < 610) hue = 72 - (wavelength - 560) * 1.05;
        else hue = 20 - (wavelength - 610) * 0.20;
        return 'hsl(' + Math.max(0, hue) + ' 82% 46%)';
    }

    function transformXy(x, y, mode) {
        var coordinates = xyToProfessional(x, y);
        return mode === '1960'
            ? { x: coordinates.u, y: coordinates.v }
            : { x: coordinates.up, y: coordinates.vp };
    }

    function drawCoordinateDiagram(canvas, payload, mode) {
        if (!canvas || !payload.fallback) return;
        var rect = canvas.getBoundingClientRect();
        if (rect.width < 40 || rect.height < 40) return;
        var dpr = Math.min(2, root.devicePixelRatio || 1);
        canvas.width = Math.round(rect.width * dpr);
        canvas.height = Math.round(rect.height * dpr);
        var ctx = canvas.getContext('2d');
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        var width = rect.width;
        var height = rect.height;
        var padding = { left: 42, right: 18, top: 16, bottom: 34 };
        var availableWidth = width - padding.left - padding.right;
        var availableHeight = height - padding.top - padding.bottom;
        var plotSize = Math.min(availableWidth, availableHeight);
        padding.left += (availableWidth - plotSize) / 2;
        padding.top += (availableHeight - plotSize) / 2;
        var plotWidth = plotSize;
        var plotHeight = plotSize;
        var xMax = 0.65;
        var yMax = mode === '1960' ? 0.60 : 0.65;
        function px(value) { return padding.left + value / xMax * plotWidth; }
        function py(value) { return padding.top + plotHeight - value / yMax * plotHeight; }

        ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = '#fbfaf7';
        ctx.fillRect(0, 0, width, height);
        ctx.lineWidth = 1;
        ctx.font = '10px "JetBrains Mono", monospace';
        ctx.fillStyle = '#8b8378';
        for (var tick = 0; tick <= 0.6; tick += 0.1) {
            ctx.strokeStyle = 'rgba(70, 64, 56, 0.10)';
            ctx.beginPath();
            ctx.moveTo(px(tick), padding.top);
            ctx.lineTo(px(tick), padding.top + plotHeight);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(padding.left, py(tick));
            ctx.lineTo(padding.left + plotWidth, py(tick));
            ctx.stroke();
            ctx.textAlign = 'center';
            ctx.fillText(tick.toFixed(1), px(tick), height - 9);
            ctx.textAlign = 'right';
            ctx.fillText(tick.toFixed(1), padding.left - 7, py(tick) + 3);
        }

        var locus = [];
        for (var wavelength = 380; wavelength <= 700; wavelength++) {
            var xy = locusXy(wavelength, payload.fallback);
            if (!xy) continue;
            var point = transformXy(xy.x, xy.y, mode);
            locus.push({ wavelength: wavelength, x: point.x, y: point.y });
        }
        if (locus.length) {
            var cacheKey = Math.round(width) + 'x' + Math.round(height) + '@' + dpr;
            if (!canvas._cie1976Background || canvas._cie1976Background.key !== cacheKey) {
                var offscreen = document.createElement('canvas');
                offscreen.width = Math.round(width * dpr);
                offscreen.height = Math.round(height * dpr);
                var offCtx = offscreen.getContext('2d');
                offCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
                offCtx.beginPath();
                offCtx.moveTo(px(locus[0].x), py(locus[0].y));
                for (var locusIndex = 1; locusIndex < locus.length; locusIndex++) {
                    offCtx.lineTo(px(locus[locusIndex].x), py(locus[locusIndex].y));
                }
                offCtx.closePath();
                offCtx.clip();

                // Use the same XYZ-to-sRGB projection as the CIE 1931 chart.
                // Each u'v' sample is converted back to xy before rendering.
                var sampleStep = 0.006;
                for (var upValue = 0; upValue <= xMax; upValue += sampleStep) {
                    for (var vpValue = 0; vpValue <= yMax; vpValue += sampleStep) {
                        var inverseDenominator = 6 * upValue - 16 * vpValue + 12;
                        if (Math.abs(inverseDenominator) < 1e-9) continue;
                        var sampleX = 9 * upValue / inverseDenominator;
                        var sampleY = 4 * vpValue / inverseDenominator;
                        if (sampleY <= 0 || sampleX < 0 || sampleX + sampleY > 1) continue;
                        var tristimulusX = sampleX / sampleY;
                        var tristimulusY = 1;
                        var tristimulusZ = (1 - sampleX - sampleY) / sampleY;
                        var red = Math.max(0, 3.2406 * tristimulusX - 1.5372 * tristimulusY - 0.4986 * tristimulusZ);
                        var green = Math.max(0, -0.9689 * tristimulusX + 1.8758 * tristimulusY + 0.0415 * tristimulusZ);
                        var blue = Math.max(0, 0.0557 * tristimulusX - 0.2040 * tristimulusY + 1.0570 * tristimulusZ);
                        var maximum = Math.max(red, green, blue);
                        if (maximum <= 0) continue;
                        red /= maximum;
                        green /= maximum;
                        blue /= maximum;
                        function gamma(value) {
                            return value <= 0.0031308
                                ? 12.92 * value
                                : 1.055 * Math.pow(value, 1 / 2.4) - 0.055;
                        }
                        offCtx.fillStyle = 'rgb(' +
                            Math.round(gamma(red) * 255) + ',' +
                            Math.round(gamma(green) * 255) + ',' +
                            Math.round(gamma(blue) * 255) + ')';
                        offCtx.fillRect(
                            px(upValue),
                            py(vpValue) - plotHeight * sampleStep / yMax,
                            plotWidth * sampleStep / xMax + 1,
                            plotHeight * sampleStep / yMax + 1
                        );
                    }
                }
                canvas._cie1976Background = { key: cacheKey, canvas: offscreen };
            }
            ctx.drawImage(canvas._cie1976Background.canvas, 0, 0, width, height);

            // Redraw the coordinate grid above the computed colour field.
            for (var gridTick = 0; gridTick <= 0.6; gridTick += 0.1) {
                ctx.strokeStyle = 'rgba(70, 64, 56, 0.16)';
                ctx.beginPath();
                ctx.moveTo(px(gridTick), padding.top);
                ctx.lineTo(px(gridTick), padding.top + plotHeight);
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(padding.left, py(gridTick));
                ctx.lineTo(padding.left + plotWidth, py(gridTick));
                ctx.stroke();
            }
        }
        var d65 = transformXy(0.3127, 0.3290, mode);
        var current = transformXy(payload.x, payload.y, mode);

        // Planckian locus and representative correlated-colour-temperature
        // ticks in CIE 1976 u'v'.
        var planckian = [];
        if (root.SpectralMath && typeof root.SpectralMath.planckianXy === 'function') {
            for (var temperature = 1600; temperature <= 12000; temperature += 50) {
                var planckXy = root.SpectralMath.planckianXy(temperature);
                var planckPoint = transformXy(planckXy.x, planckXy.y, '1976');
                planckian.push({ temperature: temperature, x: planckPoint.x, y: planckPoint.y });
            }
        }
        if (planckian.length) {
            ctx.beginPath();
            ctx.strokeStyle = '#171717';
            ctx.lineWidth = 1.8;
            planckian.forEach(function (point, index) {
                if (index === 0) ctx.moveTo(px(point.x), py(point.y));
                else ctx.lineTo(px(point.x), py(point.y));
            });
            ctx.stroke();

            var cctTicks = [2000, 3000, 4000, 6500, 12000];
            var cctLabelOffsets = {
                2000: { x: 8, y: -8 },
                3000: { x: 12, y: 3 },
                4000: { x: 12, y: 14 },
                6500: { x: -38, y: 4 },
                12000: { x: -38, y: 15 }
            };
            ctx.font = '8px "JetBrains Mono", monospace';
            ctx.fillStyle = '#24211d';
            cctTicks.forEach(function (temperature) {
                var pointIndex = Math.max(0, Math.min(
                    planckian.length - 1,
                    Math.round((temperature - 1600) / 50)
                ));
                var point = planckian[pointIndex];
                var previous = planckian[Math.max(0, pointIndex - 1)];
                var next = planckian[Math.min(planckian.length - 1, pointIndex + 1)];
                var tangentX = px(next.x) - px(previous.x);
                var tangentY = py(next.y) - py(previous.y);
                var tangentLength = Math.hypot(tangentX, tangentY) || 1;
                var normalX = -tangentY / tangentLength;
                var normalY = tangentX / tangentLength;
                ctx.beginPath();
                ctx.lineWidth = 1;
                ctx.strokeStyle = 'rgba(23, 23, 23, 0.72)';
                ctx.moveTo(px(point.x) - normalX * 10, py(point.y) - normalY * 10);
                ctx.lineTo(px(point.x) + normalX * 10, py(point.y) + normalY * 10);
                ctx.stroke();
                var label = (temperature / 1000) + 'k';
                var offset = cctLabelOffsets[temperature];
                var labelX = px(point.x) + offset.x;
                var labelY = py(point.y) + offset.y;
                ctx.textAlign = 'left';
                ctx.lineWidth = 3;
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.92)';
                ctx.strokeText(label, labelX, labelY);
                ctx.fillStyle = '#24211d';
                ctx.fillText(label, labelX, labelY);
            });

            var nearestPlanckian = planckian.reduce(function (nearest, point) {
                var distance = Math.hypot(current.x - point.x, current.y - point.y);
                return !nearest || distance < nearest.distance
                    ? { point: point, distance: distance }
                    : nearest;
            }, null);
            if (nearestPlanckian) {
                ctx.setLineDash([4, 4]);
                ctx.strokeStyle = 'rgba(30, 30, 30, 0.55)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(px(current.x), py(current.y));
                ctx.lineTo(px(nearestPlanckian.point.x), py(nearestPlanckian.point.y));
                ctx.stroke();
                ctx.setLineDash([]);
            }
        }

        // Convex hull of the currently available LED channel chromaticities.
        var gamutPoints = (payload.channels || []).filter(function (channel) {
            return Number.isFinite(channel.x) && Number.isFinite(channel.y);
        }).map(function (channel) {
            var transformed = transformXy(channel.x, channel.y, '1976');
            return { x: transformed.x, y: transformed.y, channel: channel };
        }).sort(function (a, b) { return a.x - b.x || a.y - b.y; });
        if (gamutPoints.length >= 3) {
            function cross(origin, a, b) {
                return (a.x - origin.x) * (b.y - origin.y) -
                    (a.y - origin.y) * (b.x - origin.x);
            }
            var lowerHull = [];
            var upperHull = [];
            gamutPoints.forEach(function (point) {
                while (lowerHull.length >= 2 &&
                    cross(lowerHull[lowerHull.length - 2], lowerHull[lowerHull.length - 1], point) <= 0) {
                    lowerHull.pop();
                }
                lowerHull.push(point);
            });
            gamutPoints.slice().reverse().forEach(function (point) {
                while (upperHull.length >= 2 &&
                    cross(upperHull[upperHull.length - 2], upperHull[upperHull.length - 1], point) <= 0) {
                    upperHull.pop();
                }
                upperHull.push(point);
            });
            var hull = lowerHull.slice(0, -1).concat(upperHull.slice(0, -1));
            ctx.beginPath();
            ctx.setLineDash([6, 4]);
            ctx.strokeStyle = '#8c6414';
            ctx.lineWidth = 1.6;
            hull.forEach(function (point, index) {
                if (index === 0) ctx.moveTo(px(point.x), py(point.y));
                else ctx.lineTo(px(point.x), py(point.y));
            });
            ctx.closePath();
            ctx.stroke();
            ctx.setLineDash([]);
        }
        gamutPoints.forEach(function (point) {
            ctx.beginPath();
            ctx.fillStyle = point.channel.color;
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 1.5;
            ctx.arc(px(point.x), py(point.y), 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
        });

        ctx.fillStyle = '#fff';
        ctx.strokeStyle = '#6f685f';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(px(d65.x), py(d65.y), 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#756e64';
        ctx.textAlign = 'left';
        ctx.fillText('D65', px(d65.x) + 7, py(d65.y) - 5);

        ctx.fillStyle = '#1479d1';
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(px(current.x), py(current.y), 5.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#176cab';
        ctx.fillText('当前', px(current.x) + 8, py(current.y) + 4);

        ctx.fillStyle = '#6f685f';
        ctx.textAlign = 'right';
        ctx.fillText(mode === '1960' ? 'u' : 'u′', width - 5, height - 9);
        ctx.save();
        ctx.translate(11, 16);
        ctx.fillText(mode === '1960' ? 'v' : 'v′', 0, 0);
        ctx.restore();
    }

    function renderDiagrams(payload) {
        drawCoordinateDiagram(document.getElementById('professional-cie1976'), payload, '1976');
    }

    function renderAlphaOpic(payload) {
        var grid = document.getElementById('alpha-opic-grid');
        if (!grid || !alphaData || !payload.fallback || !payload.fallback.d65) return;
        var photopic = payload.fallback.photopic;
        var samplePhotopic = integrate(payload.spd, photopic);
        var d65Photopic = integrate(payload.fallback.d65, photopic);
        var keys = ['cyanopic', 'chloropic', 'erythropic', 'rhodopic', 'melanopic'];
        grid.innerHTML = keys.map(function (key) {
            var curve = getCurve(key, payload.fallback);
            var sampleRatio = samplePhotopic > 0 ? integrate(payload.spd, curve) / samplePhotopic : 0;
            var d65Ratio = d65Photopic > 0 ? integrate(payload.fallback.d65, curve) / d65Photopic : 0;
            var der = d65Ratio > 0 ? sampleRatio / d65Ratio : NaN;
            return '<div title="' + curveMeta[key].label + '"><span style="--curve-color:' + curveMeta[key].color + '">' +
                (curveMeta[key].shortLabel || curveMeta[key].label) + '</span><strong>' +
                number(der, 2) + '</strong><small>DER</small></div>';
        }).join('');
    }

    function renderContributions(payload) {
        var list = document.getElementById('channel-contribution-list');
        if (!list) return;
        var curve = contributionMetric === 'radiant' ? null : getCurve(contributionMetric, payload.fallback);
        if (contributionMetric !== 'radiant' && !curve) {
            list.innerHTML = '<p>该标准作用曲线尚未加载。</p>';
            return;
        }
        var rows = payload.channels.map(function (channel) {
            var values = channel.spd.map(function (value) { return value * channel.duty; });
            var amount = curve ? integrate(values, curve) : values.reduce(function (sum, value) { return sum + value; }, 0);
            return { id: channel.id, name: channel.name, color: channel.color, amount: amount };
        });
        var total = rows.reduce(function (sum, row) { return sum + row.amount; }, 0);
        rows.forEach(function (row) { row.share = total > 0 ? row.amount / total * 100 : 0; });
        rows.sort(function (a, b) { return b.share - a.share; });
        list.innerHTML = rows.map(function (row) {
            return '<div class="channel-contribution-row"><span class="channel-contribution-name"><i style="--channel-color:' +
                row.color + '"></i>' + row.name + '</span><span class="channel-contribution-track"><b style="width:' +
                row.share.toFixed(2) + '%;--channel-color:' + row.color + '"></b></span><strong>' +
                row.share.toFixed(1) + '%</strong></div>';
        }).join('');
    }

    function render(payload) {
        latest = payload;
        var coordinates = xyToProfessional(payload.x, payload.y);
        var dominant = dominantWavelengthAndPurity(payload.x, payload.y, payload.fallback);
        var upvp = document.getElementById('professional-upvp');
        var dominantEl = document.getElementById('professional-dominant');
        var purityEl = document.getElementById('professional-purity');
        if (upvp) upvp.textContent = 'u′ ' + number(coordinates.up, 4) + ' · v′ ' + number(coordinates.vp, 4);
        if (dominantEl) dominantEl.textContent = Number.isFinite(dominant.wavelength) ? dominant.wavelength + ' nm' : '--';
        if (purityEl) purityEl.textContent = Number.isFinite(dominant.purity) ? Math.min(100, dominant.purity).toFixed(1) + '%' : '--';
        renderDiagrams(payload);
        renderAlphaOpic(payload);
        renderContributions(payload);
    }

    function drawActionCurves(options) {
        if (!selectedCurves.size) return;
        selectedCurves.forEach(function (key) {
            var source = getCurve(key, options.fallback);
            if (!source || !source.length) return;
            var values = normalizeCurve(source);
            options.ctx.save();
            options.ctx.beginPath();
            options.ctx.setLineDash([4, 4]);
            options.ctx.strokeStyle = curveMeta[key].color;
            options.ctx.globalAlpha = 0.78;
            options.ctx.lineWidth = 1.7;
            values.forEach(function (value, index) {
                var x = options.plotX + index / (values.length - 1) * options.plotW;
                var y = options.plotY + options.plotH - value * options.plotH;
                if (index === 0) options.ctx.moveTo(x, y);
                else options.ctx.lineTo(x, y);
            });
            options.ctx.stroke();
            options.ctx.restore();
        });
    }

    function init() {
        injectUi();
        loadOfficialData();
    }

    root.SpectralProfessional = {
        init: init,
        update: render,
        drawActionCurves: drawActionCurves
    };

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})(window);
