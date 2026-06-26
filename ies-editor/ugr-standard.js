(() => {
  const $ = (id) => document.getElementById(id);
  const UGR_BASE_FLUX = 1000;

  function fmt(value, digits = 1) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return '-';
    return String(Number(parsed.toFixed(digits)));
  }

  function parseIES(text) {
    const normalized = text.replace(/\r/g, '');
    const lines = normalized.split('\n');
    const tiltIndex = lines.findIndex((line) => /^\s*TILT\s*=/i.test(line));
    if (tiltIndex < 0) throw new Error('TILT line not found.');
    const tiltValue = lines[tiltIndex].split('=').slice(1).join('=').trim().toUpperCase();
    let nums = lines.slice(tiltIndex + 1).join(' ')
      .replace(/\[[^\]]+\][^\r\n]*/g, ' ')
      .replace(/,/g, ' ')
      .split(/\s+/)
      .filter(Boolean)
      .map(Number)
      .filter(Number.isFinite);
    if (tiltValue === 'INCLUDE') {
      const tiltCount = Math.max(0, Math.round(nums[0] || 0));
      nums = nums.slice(1 + tiltCount * 2);
    }
    let i = 0;
    const lampCount = nums[i++];
    const lumensPerLamp = nums[i++];
    const multiplier = nums[i++];
    const verticalCount = Math.round(nums[i++]);
    const horizontalCount = Math.round(nums[i++]);
    const photometricType = Math.round(nums[i++]);
    const unitsType = Math.round(nums[i++]);
    const width = nums[i++];
    const length = nums[i++];
    const height = nums[i++];
    i += 2;
    const power = nums[i++];
    const verticalAngles = nums.slice(i, i + verticalCount); i += verticalCount;
    const horizontalAngles = nums.slice(i, i + horizontalCount); i += horizontalCount;
    if (verticalCount <= 0 || horizontalCount <= 0) throw new Error('Invalid angular data.');
    if (nums.length - i < verticalCount * horizontalCount) throw new Error('Incomplete candela matrix.');
    const candela = [];
    for (let h = 0; h < horizontalCount; h += 1) {
      candela.push(nums.slice(i, i + verticalCount).map((value) => value * multiplier));
      i += verticalCount;
    }
    return { lampCount, lumensPerLamp, multiplier, photometricType, unitsType, width, length, height, power, verticalAngles, horizontalAngles, candela };
  }

  function injectStyle() {
    if (document.getElementById('ugr-report-style')) return;
    const style = document.createElement('style');
    style.id = 'ugr-report-style';
    style.textContent = `
      .ugr-table-box { width:100%; overflow:auto; -webkit-overflow-scrolling:touch; }
      .ugr-standard-table { min-width:920px; width:100%; border-collapse:collapse; table-layout:fixed; font-family:Consolas, "Courier New", monospace; font-size:15px; line-height:1.18; color:#000; background:#fff; border:1.5px solid #000; }
      .ugr-standard-table th, .ugr-standard-table td { border:0; padding:5px 7px; text-align:center; font-weight:400; white-space:nowrap; }
      .ugr-standard-table .left-label { text-align:center; width:105px; }
      .ugr-standard-table .y-label { width:70px; }
      .ugr-standard-table .strong-line > th, .ugr-standard-table .strong-line > td { border-top:1.5px solid #000; }
      .ugr-standard-table .mid-split { border-left:1.5px solid #000; }
      .ugr-standard-table .section-title { border-top:1.5px solid #000; border-bottom:1.5px solid #000; }
      .ugr-standard-table .variation-title td { text-align:left; border-top:1.5px solid #000; border-bottom:1.5px solid #000; }
      .ugr-standard-table .variation-left { border-right:1.5px solid #000; }
      .ugr-standard-table .variation-mid { border-right:1.5px solid #000; }
      .ugr-standard-table .spacer td { height:18px; padding:2px; }
      .ugr-note { min-width:920px; margin:0 0 10px; padding:10px 12px; border:1px solid #bbb; background:#fafafa; color:#111; font-family:Consolas, "Courier New", monospace; font-size:12px; line-height:1.45; }
      @media (max-width:700px) { .ugr-standard-table, .ugr-note { font-size:13px; min-width:820px; } }
    `;
    document.head.appendChild(style);
  }

  function ensureTableContainer() {
    const target = $('reportUGR');
    if (!target) return null;
    if (target.tagName.toLowerCase() === 'pre') {
      const replacement = document.createElement('div');
      replacement.id = 'reportUGR';
      replacement.className = 'ugr-table-box';
      target.replaceWith(replacement);
      return replacement;
    }
    target.classList.add('ugr-table-box');
    return target;
  }

  function normalizeDegrees(angle) {
    return ((angle % 360) + 360) % 360;
  }

  function nearlyEqual(a, b, tolerance = 0.001) {
    return Math.abs(a - b) <= tolerance;
  }

  function interp1(x0, y0, x1, y1, x) {
    if (Math.abs(x1 - x0) < 0.000001) return y0;
    const t = (x - x0) / (x1 - x0);
    return y0 + (y1 - y0) * t;
  }

  function interpolateByAngle(angles, values, target, cyclic = false) {
    if (!angles.length || !values.length) return 0;
    if (angles.length === 1) return values[0] || 0;
    const pairs = angles.map((angle, index) => ({ angle: cyclic ? normalizeDegrees(angle) : angle, value: values[index] || 0 }))
      .sort((a, b) => a.angle - b.angle);
    let x = cyclic ? normalizeDegrees(target) : target;
    if (!cyclic) {
      if (x <= pairs[0].angle) return pairs[0].value;
      if (x >= pairs[pairs.length - 1].angle) return pairs[pairs.length - 1].value;
    } else if (x < pairs[0].angle) {
      x += 360;
    }
    for (let i = 0; i < pairs.length - 1; i += 1) {
      const a = pairs[i];
      const b = pairs[i + 1];
      if (x >= a.angle && x <= b.angle) return interp1(a.angle, a.value, b.angle, b.value, x);
    }
    if (cyclic) {
      const a = pairs[pairs.length - 1];
      const b = { angle: pairs[0].angle + 360, value: pairs[0].value };
      return interp1(a.angle, a.value, b.angle, b.value, x);
    }
    return pairs[pairs.length - 1].value;
  }

  function mapTypeCAngle(data, cAngle) {
    const values = data.horizontalAngles;
    const min = Math.min(...values);
    const max = Math.max(...values);
    let c = normalizeDegrees(cAngle);
    if (min >= -0.001 && max <= 90.001) {
      c %= 180;
      if (c > 90) c = 180 - c;
      return c;
    }
    if (min >= -0.001 && max <= 180.001) {
      if (c > 180) c = 360 - c;
      return c;
    }
    return c;
  }

  function candelaAt(data, gamma, cAngle) {
    const g = Math.abs(gamma);
    const vAngles = data.verticalAngles.map(Math.abs);
    const planeValues = data.candela.map((profile) => interpolateByAngle(vAngles, profile, g, false));
    if (data.horizontalAngles.length === 1) return Math.max(0, planeValues[0] || 0);
    if (data.photometricType === 1) {
      const c = mapTypeCAngle(data, cAngle);
      const cyclic = Math.max(...data.horizontalAngles) - Math.min(...data.horizontalAngles) >= 359;
      return Math.max(0, interpolateByAngle(data.horizontalAngles, planeValues, c, cyclic));
    }
    return Math.max(0, interpolateByAngle(data.horizontalAngles, planeValues, cAngle, false));
  }

  function integrateProfile(data, profile) {
    const pairs = data.verticalAngles.map((angle, index) => ({ angle: Math.abs(angle), value: Math.max(0, profile[index] || 0) }))
      .sort((a, b) => a.angle - b.angle);
    let integral = 0;
    for (let i = 0; i < pairs.length - 1; i += 1) {
      const a1 = pairs[i].angle * Math.PI / 180;
      const a2 = pairs[i + 1].angle * Math.PI / 180;
      const y1 = pairs[i].value * Math.sin(a1);
      const y2 = pairs[i + 1].value * Math.sin(a2);
      integral += Math.abs(((y1 + y2) / 2) * (a2 - a1));
    }
    return integral;
  }

  function integrateAngularSeries(pairs, closeCircle = false) {
    if (pairs.length < 2) return 0;
    let integral = 0;
    for (let i = 0; i < pairs.length - 1; i += 1) {
      integral += ((pairs[i].value + pairs[i + 1].value) / 2) * Math.abs(pairs[i + 1].angle - pairs[i].angle) * Math.PI / 180;
    }
    if (closeCircle) {
      integral += ((pairs[pairs.length - 1].value + pairs[0].value) / 2) * Math.abs((pairs[0].angle + 360) - pairs[pairs.length - 1].angle) * Math.PI / 180;
    }
    return integral;
  }

  function measuredLuminaireFlux(data) {
    const verticalIntegrals = data.candela.map((profile) => integrateProfile(data, profile));
    if (data.horizontalAngles.length <= 1) return 2 * Math.PI * (verticalIntegrals[0] || 0);
    const pairs = data.horizontalAngles.map((angle, index) => ({ angle: data.photometricType === 1 ? normalizeDegrees(angle) : angle, value: verticalIntegrals[index] || 0 }))
      .sort((a, b) => a.angle - b.angle)
      .filter((item, index, array) => index === 0 || !nearlyEqual(item.angle, array[index - 1].angle));
    if (pairs.length <= 1) return 2 * Math.PI * (pairs[0]?.value || 0);
    const first = pairs[0].angle;
    const last = pairs[pairs.length - 1].angle;
    const span = Math.max(0.001, Math.abs(last - first));
    const openIntegral = integrateAngularSeries(pairs, false);
    if (data.photometricType === 1) {
      if (span >= 359.999) return openIntegral;
      if (nearlyEqual(first, 0) && last >= 270) return integrateAngularSeries(pairs, true);
      if (nearlyEqual(first, 0) && nearlyEqual(last, 90)) return openIntegral * 4;
      if (nearlyEqual(first, 0) && nearlyEqual(last, 180)) return openIntegral * 2;
      return openIntegral * (360 / span);
    }
    return openIntegral * (360 / span);
  }

  function headerLampFlux(data) {
    return Math.max(0, (data.lampCount || 1) * (data.lumensPerLamp || 0));
  }

  function fluxForUGR(data) {
    const integrated = measuredLuminaireFlux(data);
    if (Number.isFinite(integrated) && integrated > 0.001) return integrated;
    const header = headerLampFlux(data);
    if (header > 0.001) return header;
    return 0;
  }

  function normalizeDataToBaseFlux(data) {
    const actualFlux = fluxForUGR(data);
    if (actualFlux <= 0) throw new Error('valid luminous flux is not available.');
    const scale = UGR_BASE_FLUX / actualFlux;
    return {
      ...data,
      candela: data.candela.map((profile) => profile.map((value) => value * scale)),
      ugrActualFlux: actualFlux,
      ugrBaseFlux: UGR_BASE_FLUX,
      ugrScale: scale,
      ugrFluxCorrection: 8 * Math.log10(actualFlux / UGR_BASE_FLUX)
    };
  }

  function luminousArea(data) {
    const unitFactor = data.unitsType === 1 ? 0.3048 : 1;
    const w = Math.abs((data.width || 0) * unitFactor);
    const l = Math.abs((data.length || 0) * unitFactor);
    const h = Math.abs((data.height || 0) * unitFactor);
    const candidates = [w * l, w * h, l * h].filter((value) => value > 0.000001);
    return candidates.length ? Math.max(...candidates) : 0;
  }

  function maxCandela(data) {
    let max = 0;
    data.candela.forEach((profile) => profile.forEach((value) => { max = Math.max(max, Math.max(0, value || 0)); }));
    return max;
  }

  function offendingZoneCandela(data) {
    let max = 0;
    let sum = 0;
    let count = 0;
    data.candela.forEach((profile) => {
      profile.forEach((value, index) => {
        const angle = Math.abs(data.verticalAngles[index] || 0);
        if (angle >= 55 && angle <= 90) {
          const c = Math.max(0, value || 0);
          max = Math.max(max, c);
          sum += c;
          count += 1;
        }
      });
    });
    return { max, avg: count ? sum / count : 0 };
  }

  function guthPositionIndex(tau, sigma) {
    const t = Math.max(0, Math.min(85, tau));
    const s = Math.max(0, Math.min(85, sigma));
    const exponent = (35.2 - 0.31889 * t - 1.22 * Math.exp(-2 * t / 9)) * 0.001 * s
      + (21 + 0.26667 * t - 0.002963 * t * t) * 0.00001 * s * s;
    return Math.max(1, Math.exp(exponent));
  }

  function roomSurfaceBackgroundLuminance(roomX, roomY, reflectanceSet, luminaireCount, fluxPerLuminaire) {
    const h = 1;
    const floorArea = roomX * roomY;
    const ceilingArea = floorArea;
    const wallArea = 2 * (roomX + roomY) * h;
    const totalArea = Math.max(0.001, floorArea + ceilingArea + wallArea);
    const totalFlux = Math.max(0, luminaireCount * fluxPerLuminaire);
    const weightedReflectance = (
      reflectanceSet.ceil * ceilingArea + reflectanceSet.wall * wallArea + reflectanceSet.plane * floorArea
    ) / totalArea;
    const meanSurfaceIlluminance = totalFlux / totalArea;
    const interreflectionBoost = 1 / Math.max(0.25, 1 - Math.min(0.85, weightedReflectance));
    const backgroundReflectance = Math.max(0.05, reflectanceSet.wall);
    return Math.max(0.05, meanSurfaceIlluminance * interreflectionBoost * backgroundReflectance / Math.PI);
  }

  function buildLuminairePositions(roomX, roomY, spacing) {
    const nx = Math.max(1, Math.round(roomX / spacing));
    const ny = Math.max(1, Math.round(roomY / spacing));
    const positions = [];
    for (let ix = 0; ix < nx; ix += 1) {
      const x = -roomX / 2 + (ix + 0.5) * roomX / nx;
      for (let iy = 0; iy < ny; iy += 1) {
        const y = (iy + 0.5) * roomY / ny;
        positions.push({ x, y, z: 1 });
      }
    }
    return positions;
  }

  function luminaireContribution(data, source, observerX, orientationDeg, area) {
    const dx = observerX - source.x;
    const dy = source.y;
    const dz = source.z;
    const distance2 = dx * dx + dy * dy + dz * dz;
    const distance = Math.sqrt(distance2);
    const horizontal = Math.sqrt(dx * dx + dy * dy);
    const gamma = Math.atan2(horizontal, dz) * 180 / Math.PI;
    if (gamma >= 89.9) return 0;
    const cosGamma = Math.max(0.01, dz / distance);
    const cAngle = normalizeDegrees(Math.atan2(dx, dy) * 180 / Math.PI + orientationDeg);
    const intensity = candelaAt(data, gamma, cAngle);
    if (intensity <= 0) return 0;
    const projectedArea = Math.max(0.000001, area * cosGamma);
    const luminance = intensity / projectedArea;
    const omega = projectedArea / distance2;
    if (omega <= 0.000001) return 0;
    const tau = Math.atan2(dz, Math.max(0.000001, dy)) * 180 / Math.PI;
    const sigma = Math.atan2(Math.abs(dx), Math.sqrt(dy * dy + dz * dz)) * 180 / Math.PI;
    const p = guthPositionIndex(tau, sigma);
    return luminance * luminance * omega / (p * p);
  }

  function calculateUGR1000(normalizedData, roomX, roomY, reflectanceSet, endwise = false, spacing = 1.0, observerX = 0) {
    const area = luminousArea(normalizedData);
    if (area <= 0) return null;
    const positions = buildLuminairePositions(roomX, roomY, spacing);
    const lb = roomSurfaceBackgroundLuminance(roomX, roomY, reflectanceSet, positions.length, UGR_BASE_FLUX);
    const orientationDeg = endwise ? 90 : 0;
    let sum = 0;
    positions.forEach((source) => {
      sum += luminaireContribution(normalizedData, source, observerX, orientationDeg, area);
    });
    if (sum <= 0 || lb <= 0) return null;
    const ugr1000 = 8 * Math.log10((0.25 / lb) * sum);
    return Number.isFinite(ugr1000) ? Math.max(0, ugr1000) : null;
  }

  function calculateCorrectedUGR(normalizedData, roomX, roomY, reflectanceSet, endwise = false, spacing = 1.0, observerX = 0) {
    const ugr1000 = calculateUGR1000(normalizedData, roomX, roomY, reflectanceSet, endwise, spacing, observerX);
    if (ugr1000 === null) return null;
    return Math.max(0, ugr1000 + normalizedData.ugrFluxCorrection);
  }

  const reflectanceSets = [
    { ceil: 0.7, wall: 0.5, plane: 0.2 },
    { ceil: 0.7, wall: 0.3, plane: 0.2 },
    { ceil: 0.5, wall: 0.5, plane: 0.2 },
    { ceil: 0.5, wall: 0.3, plane: 0.2 },
    { ceil: 0.3, wall: 0.3, plane: 0.2 }
  ];

  const roomRows = [
    { x: 'x = 2H', xValue: 2, y: 'y = 2H', yValue: 2 },
    { x: '', xValue: 2, y: '3H', yValue: 3 },
    { x: '', xValue: 2, y: '4H', yValue: 4 },
    { x: '', xValue: 2, y: '6H', yValue: 6 },
    { x: '', xValue: 2, y: '8H', yValue: 8 },
    { x: '', xValue: 2, y: '12H', yValue: 12 },
    { spacer: true },
    { x: '4H', xValue: 4, y: '2H', yValue: 2 },
    { x: '', xValue: 4, y: '3H', yValue: 3 },
    { x: '', xValue: 4, y: '4H', yValue: 4 },
    { x: '', xValue: 4, y: '6H', yValue: 6 },
    { x: '', xValue: 4, y: '8H', yValue: 8 },
    { x: '', xValue: 4, y: '12H', yValue: 12 },
    { spacer: true },
    { x: '8H', xValue: 8, y: '4H', yValue: 4 },
    { x: '', xValue: 8, y: '6H', yValue: 6 },
    { x: '', xValue: 8, y: '8H', yValue: 8 },
    { x: '', xValue: 8, y: '12H', yValue: 12 },
    { spacer: true },
    { x: '12H', xValue: 12, y: '4H', yValue: 4 },
    { x: '', xValue: 12, y: '6H', yValue: 6 },
    { x: '', xValue: 12, y: '8H', yValue: 8 }
  ];

  function valueCell(normalizedData, row, set, endwise = false) {
    const value = calculateCorrectedUGR(normalizedData, row.xValue, row.yValue, set, endwise, 1.0, 0);
    return value === null ? '-' : fmt(value, 1);
  }

  function roomRowsHtml(normalizedData) {
    return roomRows.map((row) => {
      if (row.spacer) return '<tr class="spacer"><td></td><td></td><td colspan="10"></td></tr>';
      const cross = reflectanceSets.map((set) => `<td>${valueCell(normalizedData, row, set, false)}</td>`).join('');
      const end = reflectanceSets.map((set, index) => `<td${index === 0 ? ' class="mid-split"' : ''}>${valueCell(normalizedData, row, set, true)}</td>`).join('');
      return `<tr><td class="left-label">${row.x || ''}</td><td class="y-label">${row.y}</td>${cross}${end}</tr>`;
    }).join('');
  }

  function variationValue(normalizedData, spacing, endwise = false) {
    const set = reflectanceSets[0];
    const roomX = 4;
    const roomY = 8;
    const center = calculateCorrectedUGR(normalizedData, roomX, roomY, set, endwise, spacing, 0);
    if (center === null) return '-';
    const offsets = [spacing * 0.25, spacing * 0.5, -spacing * 0.25, -spacing * 0.5];
    const values = offsets.map((offset) => calculateCorrectedUGR(normalizedData, roomX, roomY, set, endwise, spacing, offset)).filter((value) => value !== null);
    if (!values.length) return '-';
    const plus = Math.max(...values) - center;
    const minus = center - Math.min(...values);
    return `+ ${fmt(Math.max(0, plus), 1)} / - ${fmt(Math.max(0, minus), 1)}`;
  }

  function buildStandardUGRTable(data) {
    const area = luminousArea(data);
    const offending = offendingZoneCandela(data);
    const peak = maxCandela(data);
    if (area <= 0) {
      return '<div class="ugr-note">Unable to calculate UGR - luminous area is not available in the photometric file.</div>';
    }
    if (offending.max <= Math.max(0.001, peak * 0.00001)) {
      return `<div class="ugr-note">Unable to calculate UGR - No candela in offending zones<br>Checked vertical zone: 55° to 90°. Maximum candela in this zone: ${fmt(offending.max, 3)} cd.</div>`;
    }

    const normalizedData = normalizeDataToBaseFlux(data);
    const fluxCorrection = normalizedData.ugrFluxCorrection;
    const fluxLine = `CIE Pub.117 flux correction: UGR = UGR1000 + 8log10(F/F0), F = ${fmt(normalizedData.ugrActualFlux, 2)} lm, F0 = ${fmt(normalizedData.ugrBaseFlux, 0)} lm, 8log10(F/F0) = ${fmt(fluxCorrection, 2)}. The same F is used for this note and for every table value.`;
    const normalizedLine = `Candela data are first normalized by ${fmt(normalizedData.ugrScale, 6)} so that the IES distribution is calculated at ${fmt(UGR_BASE_FLUX, 0)} lm, then the flux correction above is added.`;

    const ceilings = reflectanceSets.map((set) => `<td>${fmt(set.ceil, 1)}</td>`).join('');
    const walls = reflectanceSets.map((set) => `<td>${fmt(set.wall, 1)}</td>`).join('');
    const planes = reflectanceSets.map((set) => `<td>${fmt(set.plane, 1)}</td>`).join('');
    const duplicateCeilings = reflectanceSets.map((set, index) => `<td${index === 0 ? ' class="mid-split"' : ''}>${fmt(set.ceil, 1)}</td>`).join('');
    const duplicateWalls = reflectanceSets.map((set, index) => `<td${index === 0 ? ' class="mid-split"' : ''}>${fmt(set.wall, 1)}</td>`).join('');
    const duplicatePlanes = reflectanceSets.map((set, index) => `<td${index === 0 ? ' class="mid-split"' : ''}>${fmt(set.plane, 1)}</td>`).join('');
    return `
      <div class="ugr-note">${normalizedLine}<br>${fluxLine}<br>H is the distance between the luminaire plane and the observer eye level. Base spacing is 1.0H.</div>
      <table class="ugr-standard-table">
        <tbody>
          <tr><th colspan="2">ceiling/cavity</th>${ceilings}${duplicateCeilings}</tr>
          <tr><th colspan="2">walls</th>${walls}${duplicateWalls}</tr>
          <tr><th colspan="2">working plane</th>${planes}${duplicatePlanes}</tr>
          <tr class="section-title"><th colspan="2">Room dimensions</th><th colspan="5">Viewed crosswise</th><th class="mid-split" colspan="5">Viewed endwise</th></tr>
          ${roomRowsHtml(normalizedData)}
          <tr class="variation-title"><td colspan="12">Variations with the observer position at spacings:</td></tr>
          <tr><td class="variation-left" colspan="2">s = 1.0H</td><td class="variation-mid" colspan="5">${variationValue(normalizedData, 1.0, false)}</td><td colspan="5">${variationValue(normalizedData, 1.0, true)}</td></tr>
          <tr><td class="variation-left" colspan="2">1.5H</td><td class="variation-mid" colspan="5">${variationValue(normalizedData, 1.5, false)}</td><td colspan="5">${variationValue(normalizedData, 1.5, true)}</td></tr>
          <tr><td class="variation-left" colspan="2">2.0H</td><td class="variation-mid" colspan="5">${variationValue(normalizedData, 2.0, false)}</td><td colspan="5">${variationValue(normalizedData, 2.0, true)}</td></tr>
        </tbody>
      </table>
    `;
  }

  function refreshUGR() {
    injectStyle();
    const report = $('report');
    const target = ensureTableContainer();
    const preview = $('iesPreview');
    if (!report || !target || !preview || report.classList.contains('hidden')) return;
    const text = preview.textContent || '';
    if (!text.trim()) return;
    try {
      const data = parseIES(text);
      target.innerHTML = buildStandardUGRTable(data);
    } catch (error) {
      target.innerHTML = `<div class="ugr-note">Unable to calculate UGR - ${String(error.message || error)}</div>`;
    }
  }

  function observeReport() {
    const report = $('report');
    const preview = $('iesPreview');
    if (!report || !preview) return;
    const observer = new MutationObserver(() => setTimeout(refreshUGR, 0));
    observer.observe(report, { attributes: true, childList: true, subtree: true, characterData: true });
    observer.observe(preview, { childList: true, characterData: true, subtree: true });
  }

  window.addEventListener('DOMContentLoaded', () => {
    injectStyle();
    observeReport();
    setTimeout(refreshUGR, 0);
  });
})();
