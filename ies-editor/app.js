(() => {
  const $ = (id) => document.getElementById(id);
  const form = $('iesForm');
  const preview = $('iesPreview');
  const canvas = $('curveCanvas');
  const ctx = canvas.getContext('2d');
  const report = $('report');
  const reportPolar = $('reportPolar');
  const reportCtx = reportPolar.getContext('2d');
  const fields = {
    manufacturer: $('manufacturer'), serial: $('serial'), date: $('date'), ledCount: $('ledCount'),
    singleFlux: $('singleFlux'), beamAngle: $('beamAngle'), beamAngleC90: $('beamAngleC90'), efficiency: $('efficiency'), length: $('length'),
    width: $('width'), height: $('height'), power: $('power'), notes: $('notes'), iesType: $('iesType'), distributionShape: $('distributionShape'), generationMode: $('generationMode')
  };
  const generatedVertical = Array.from({ length: 181 }, (_, i) => i);
  const simpleHorizontal = [0];
  const advancedHorizontal = [0, 90, 180, 270];
  const defaultAdvancedAngles = Array.from({ length: 10 }, (_, i) => i * 10);
  let current = null;
  let uploaded = null;
  let advancedPopulated = false;

  function num(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function fmt(value, digits = 2) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return '-';
    return String(Number(parsed.toFixed(digits)));
  }

  function esc(value) {
    return String(value ?? '').replace(/[&<>]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[ch]));
  }

  function safeName(value) {
    return String(value || 'luminaire').replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '') || 'luminaire';
  }

  function wrapNumbers(values, perLine = 10) {
    const lines = [];
    for (let i = 0; i < values.length; i += perLine) lines.push(values.slice(i, i + perLine).join(' '));
    return lines.join('\n');
  }

  function getFormData() {
    return {
      manufacturer: fields.manufacturer.value.trim() || 'CDN',
      serial: fields.serial.value.trim() || 'spot01',
      date: fields.date.value.trim() || new Date().toISOString().slice(0, 10).replaceAll('-', ''),
      ledCount: Math.max(1, Math.round(num(fields.ledCount.value, 1))),
      singleFlux: Math.max(0.01, num(fields.singleFlux.value, 1000)),
      beamAngle: Math.min(120, Math.max(0.01, num(fields.beamAngle.value, 36))),
      beamAngleC90: Math.min(120, Math.max(0.01, num(fields.beamAngleC90?.value, num(fields.beamAngle.value, 36)))),
      efficiency: Math.min(1, Math.max(0.01, num(fields.efficiency.value, 1))),
      length: Math.max(0, num(fields.length.value, 0.1)),
      width: Math.max(0, num(fields.width.value, 0.1)),
      height: Math.max(0, num(fields.height.value, 0.1)),
      power: Math.max(0.01, num(fields.power.value, 10)),
      generationMode: fields.generationMode?.value || 'simple',
      symmetryMode: fields.iesType?.value || 'symmetric',
      distributionShape: fields.distributionShape?.value || 'lambertian',
      notes: fields.notes.value.trim()
    };
  }

  function distributionShapeFactor(shape) {
    return {
      soft: 1.45,
      standard: 2.1,
      sharp: 2.8,
      'very-sharp': 3.6
    }[shape] || 0;
  }

  function distributionShapeName(shape) {
    return {
      lambertian: 'Lambertian / cosine',
      soft: 'Soft teardrop',
      standard: 'Standard teardrop',
      sharp: 'Sharp teardrop',
      'very-sharp': 'Very sharp'
    }[shape] || 'Lambertian / cosine';
  }

  function rawIntensity(angle, beamAngle, shape = 'lambertian') {
    const clampedBeam = Math.min(120, Math.max(0.01, beamAngle));
    const theta = Math.abs(angle);
    if (theta >= 90) return 0;
    const halfBeam = Math.min(89.999, Math.max(0.005, clampedBeam / 2));
    const shapeFactor = distributionShapeFactor(shape);
    if (shapeFactor > 0) {
      return Math.pow(2, -Math.pow(theta / halfBeam, shapeFactor));
    }
    const exponent = Math.log(0.5) / Math.log(Math.cos(halfBeam * Math.PI / 180));
    return Math.pow(Math.cos(theta * Math.PI / 180), exponent);
  }

  function rawProfile(beamAngle, shape) {
    return generatedVertical.map((angle) => rawIntensity(angle, beamAngle, shape));
  }

  function scaleProfilesToFlux(profiles, data) {
    let integral = 0;
    for (let i = 0; i < generatedVertical.length - 1; i += 1) {
      const a1 = generatedVertical[i] * Math.PI / 180;
      const a2 = generatedVertical[i + 1] * Math.PI / 180;
      const v1 = profiles.reduce((sum, profile) => sum + (profile[i] || 0), 0) / profiles.length;
      const v2 = profiles.reduce((sum, profile) => sum + (profile[i + 1] || 0), 0) / profiles.length;
      integral += ((v1 * Math.sin(a1) + v2 * Math.sin(a2)) / 2) * (a2 - a1);
    }
    const flux = data.ledCount * data.singleFlux * data.efficiency;
    const scale = flux / Math.max(0.0001, 2 * Math.PI * integral);
    return profiles.map((profile) => profile.map((value) => value * scale));
  }

  function buildSimpleCandela(data) {
    const c0Raw = rawProfile(data.beamAngle, data.distributionShape);
    if (data.symmetryMode !== 'four-plane') return scaleProfilesToFlux([c0Raw], data);
    const c90Raw = rawProfile(data.beamAngleC90 || data.beamAngle, data.distributionShape);
    const scaled = scaleProfilesToFlux([c0Raw, c90Raw], data);
    return [scaled[0], scaled[1], scaled[0].slice(), scaled[1].slice()];
  }

  function isFourPlaneMode() {
    return (fields.iesType?.value || 'symmetric') === 'four-plane';
  }

  function simpleCandelaValue(angle, data = getFormData(), plane = 'c0') {
    const profiles = buildSimpleCandela({ ...data, generationMode: 'simple' });
    const selected = plane === 'c90' && profiles[1] ? profiles[1] : profiles[0];
    const index = Math.min(selected.length - 1, Math.max(0, Math.round(angle)));
    return selected[index] || 0;
  }

  function populateAdvancedRowsFromSimple() {
    const tbody = $('advancedRows');
    if (!tbody) return;
    const data = getFormData();
    tbody.innerHTML = defaultAdvancedAngles.map((angle) => {
      const c0 = fmt(simpleCandelaValue(angle, data, 'c0'), angle === 90 ? 3 : 2);
      const c90 = fmt(simpleCandelaValue(angle, data, 'c90'), angle === 90 ? 3 : 2);
      return `<tr><td><input class="adv-angle" type="number" value="${angle}" step="10"></td><td><input class="adv-c0" type="number" value="${c0}" step="0.01"></td><td class="c90-col"><input class="adv-c90" type="number" value="${c90}" step="0.01"></td></tr>`;
    }).join('');
    advancedPopulated = true;
    syncIesTypeUI();
  }

  function advancedRows() {
    const rows = Array.from(document.querySelectorAll('#advancedRows tr')).map((row) => ({
      angle: Math.min(90, Math.max(0, num(row.querySelector('.adv-angle')?.value, NaN))),
      c0: Math.max(0, num(row.querySelector('.adv-c0')?.value, NaN)),
      c90: Math.max(0, num(row.querySelector('.adv-c90')?.value, NaN))
    })).filter((row) => Number.isFinite(row.angle) && Number.isFinite(row.c0) && Number.isFinite(row.c90))
      .sort((a, b) => a.angle - b.angle);
    const unique = [];
    rows.forEach((row) => {
      if (unique.length && Math.abs(unique[unique.length - 1].angle - row.angle) < 0.0001) unique[unique.length - 1] = row;
      else unique.push(row);
    });
    if (!unique.some((row) => Math.abs(row.angle) < 0.0001)) unique.unshift({ angle: 0, c0: 1000, c90: 1000 });
    if (!unique.some((row) => Math.abs(row.angle - 90) < 0.0001)) unique.push({ angle: 90, c0: 0, c90: 0 });
    return unique.sort((a, b) => a.angle - b.angle);
  }

  function interpolateKeyRows(rows, angle, key) {
    if (angle <= rows[0].angle) return rows[0][key];
    for (let i = 0; i < rows.length - 1; i += 1) {
      const a = rows[i];
      const b = rows[i + 1];
      if (angle <= b.angle) {
        const span = Math.max(0.0001, b.angle - a.angle);
        const t = (angle - a.angle) / span;
        const start = Math.max(0, a[key]);
        const end = Math.max(0, b[key]);
        if (start > 0 && end > 0) return Math.exp(Math.log(start) + (Math.log(end) - Math.log(start)) * t);
        return start + (end - start) * t;
      }
    }
    return rows[rows.length - 1][key];
  }

  function smoothAdvancedProfile(rows, key) {
    const source = rows.map((row) => ({ angle: row.angle, value: row[key] }));
    const smoothed = interpolateCurvePoints(source, 1);
    const byAngle = new Map(smoothed.map((point) => [Math.round(point.angle * 1000) / 1000, point.value]));
    return generatedVertical.map((angle) => byAngle.get(angle) ?? interpolateKeyRows(rows, angle, key));
  }

  function buildAdvancedCandela() {
    const rows = advancedRows();
    const c0 = smoothAdvancedProfile(rows, 'c0');
    if (!isFourPlaneMode()) return [c0];
    const c90 = smoothAdvancedProfile(rows, 'c90');
    return [c0, c90, c0.slice(), c90.slice()];
  }

  function generatedPhotometry(data) {
    if (data.generationMode === 'advanced') {
      return {
        verticalAngles: generatedVertical,
        horizontalAngles: data.symmetryMode === 'four-plane' ? advancedHorizontal : simpleHorizontal,
        candela: buildAdvancedCandela(),
        modeLabel: data.symmetryMode === 'four-plane' ? 'Advanced angle table / C0-C90-C180-C270' : 'Advanced angle table / C0-C180 symmetric'
      };
    }
    const simpleCandela = buildSimpleCandela(data);
    return {
      verticalAngles: generatedVertical,
      horizontalAngles: data.symmetryMode === 'four-plane' ? advancedHorizontal : simpleHorizontal,
      candela: simpleCandela,
      modeLabel: `${data.symmetryMode === 'four-plane' ? 'C0-C90-C180-C270' : 'C0-C180 symmetric'} / ${distributionShapeName(data.distributionShape)}`
    };
  }

  function buildGeneratedIES(data, photometry) {
    const lines = [
      'IESNA:LM-63-2002',
      `[TEST] ${data.serial}`,
      '[TESTLAB] CDN Lighting',
      `[ISSUEDATE] ${data.date}`,
      `[MANUFAC] ${data.manufacturer}`,
      `[LUMCAT] ${data.serial}`,
      `[LUMINAIRE] ${data.serial}`,
      '[LAMPCAT] LED',
      `[LAMP] ${data.ledCount} LED, ${fmt(data.singleFlux, 2)} lm each`,
      `[MORE] ${data.notes || 'Generated by CDN IES Editor.'}`,
      `[MORE] Generation mode: ${photometry.modeLabel}`,
      'TILT=NONE',
      [data.ledCount, fmt(data.singleFlux * data.efficiency, 4), 1, photometry.verticalAngles.length, photometry.horizontalAngles.length, 1, 2, fmt(data.width, 4), fmt(data.length, 4), fmt(data.height, 4)].join(' '),
      `1 1 ${fmt(data.power, 4)}`,
      wrapNumbers(photometry.verticalAngles.map((angle) => fmt(angle, 2))),
      wrapNumbers(photometry.horizontalAngles.map((angle) => fmt(angle, 2))),
      wrapNumbers(photometry.candela.flat().map((value) => fmt(value, 4)), 8),
      ''
    ];
    return lines.join('\n');
  }

  function decodeIESBuffer(buffer) {
    const decoders = [
      () => new TextDecoder('utf-8', { fatal: true }).decode(buffer),
      () => new TextDecoder('gb18030').decode(buffer),
      () => new TextDecoder('gbk').decode(buffer),
      () => new TextDecoder('utf-8').decode(buffer)
    ];
    for (const decode of decoders) {
      try {
        const text = decode();
        if ((text.match(/\uFFFD/g) || []).length < 3) return text;
      } catch (error) {}
    }
    return new TextDecoder('utf-8').decode(buffer);
  }

  function parseKeywords(lines) {
    const read = (names) => {
      for (const line of lines) {
        const trimmed = line.trim();
        const upper = trimmed.toUpperCase();
        for (const name of names) {
          const key = `[${name}]`;
          if (upper.startsWith(key)) return trimmed.slice(key.length).trim();
        }
      }
      return '';
    };
    return {
      manufacturer: read(['MANUFAC']),
      serial: read(['LUMINAIRE', 'LUMCAT', 'TEST']),
      date: read(['ISSUEDATE', 'TESTDATE'])
    };
  }

  function tokenizePhotometricBody(text) {
    const lines = text.replace(/\r/g, '').split('\n');
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
    return nums;
  }

  function parseIES(text, fileName = 'uploaded.ies') {
    const normalized = text.replace(/\r/g, '');
    const lines = normalized.split('\n');
    const nums = tokenizePhotometricBody(normalized);
    if (nums.length < 13) throw new Error('IES photometric data is incomplete.');
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
    const expected = verticalCount * horizontalCount;
    if (verticalCount <= 0 || horizontalCount <= 0 || nums.length - i < expected) throw new Error(`IES candela matrix is incomplete. Expected ${expected}, got ${nums.length - i}.`);
    const candela = [];
    for (let h = 0; h < horizontalCount; h += 1) {
      candela.push(nums.slice(i, i + verticalCount).map((value) => value * multiplier));
      i += verticalCount;
    }
    return { text: normalized, fileName, lines, keywords: parseKeywords(lines), lampCount, lumensPerLamp, multiplier, verticalAngles, horizontalAngles, photometricType, unitsType, width, length, height, power, candela };
  }

  function makeGeneratedParsed() {
    const data = getFormData();
    const photometry = generatedPhotometry(data);
    const text = buildGeneratedIES(data, photometry);
    return parseIES(text, `${safeName(data.manufacturer)}-${safeName(data.serial)}.ies`);
  }

  function normalizeDegrees(angle) {
    return ((angle % 360) + 360) % 360;
  }

  function nearlyEqual(a, b, tolerance = 0.001) {
    return Math.abs(a - b) <= tolerance;
  }

  function integrateProfileZone(angles, profile, minAngle = -Infinity, maxAngle = Infinity) {
    const pairs = angles.map((angle, index) => ({ angle, value: Math.max(0, profile[index] || 0) })).sort((a, b) => a.angle - b.angle);
    let integral = 0;
    for (let i = 0; i < pairs.length - 1; i += 1) {
      const from = Math.min(Math.abs(pairs[i].angle), Math.abs(pairs[i + 1].angle));
      const to = Math.max(Math.abs(pairs[i].angle), Math.abs(pairs[i + 1].angle));
      if (to <= minAngle || from >= maxAngle) continue;
      const a1 = Math.abs(pairs[i].angle) * Math.PI / 180;
      const a2 = Math.abs(pairs[i + 1].angle) * Math.PI / 180;
      const y1 = pairs[i].value * Math.sin(a1);
      const y2 = pairs[i + 1].value * Math.sin(a2);
      integral += Math.abs(((y1 + y2) / 2) * (a2 - a1));
    }
    return integral;
  }

  function integrateAngularSeries(pairs, closeCircle = false) {
    if (pairs.length < 2) return 0;
    let integral = 0;
    for (let i = 0; i < pairs.length - 1; i += 1) integral += ((pairs[i].value + pairs[i + 1].value) / 2) * Math.abs(pairs[i + 1].angle - pairs[i].angle) * Math.PI / 180;
    if (closeCircle) integral += ((pairs[pairs.length - 1].value + pairs[0].value) / 2) * Math.abs((pairs[0].angle + 360) - pairs[pairs.length - 1].angle) * Math.PI / 180;
    return integral;
  }

  function integrateHorizontal(data, valuesByPlane) {
    if (data.horizontalAngles.length <= 1) return 2 * Math.PI * (valuesByPlane[0] || 0);
    const pairs = data.horizontalAngles.map((angle, index) => ({ angle: data.photometricType === 1 ? normalizeDegrees(angle) : angle, value: valuesByPlane[index] || 0 }))
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

  function fluxOf(data) {
    const verticalIntegrals = data.candela.map((profile) => integrateProfileZone(data.verticalAngles, profile));
    return integrateHorizontal(data, verticalIntegrals);
  }

  function zoneFlux(data, minAngle, maxAngle) {
    const verticalIntegrals = data.candela.map((profile) => integrateProfileZone(data.verticalAngles, profile, minAngle, maxAngle));
    return integrateHorizontal(data, verticalIntegrals);
  }

  function peakOf(data) {
    let peak = { value: -Infinity, hAngle: 0, vAngle: 0 };
    data.candela.forEach((profile, hIndex) => {
      profile.forEach((value, vIndex) => {
        if (value > peak.value) peak = { value, hAngle: data.horizontalAngles[hIndex] || 0, vAngle: data.verticalAngles[vIndex] || 0 };
      });
    });
    return peak;
  }

  function nearestIndex(values, target, cyclic = false) {
    let best = 0;
    let distance = Infinity;
    values.forEach((value, index) => {
      const current = cyclic ? Math.abs((((value - target) % 360) + 540) % 360 - 180) : Math.abs(value - target);
      if (current < distance) { distance = current; best = index; }
    });
    return best;
  }

  function planeIndexTypeC(data, target) {
    const values = data.horizontalAngles;
    const min = Math.min(...values);
    const max = Math.max(...values);
    let mapped = normalizeDegrees(target);
    if (min >= -0.001 && max <= 90.001) {
      mapped %= 180;
      if (mapped > 90) mapped = 180 - mapped;
      return nearestIndex(values, mapped);
    }
    if (min >= -0.001 && max <= 180.001) {
      if (mapped > 180) mapped = 360 - mapped;
      return nearestIndex(values, mapped);
    }
    return nearestIndex(values, mapped, true);
  }

  function nearestPlaneIndex(data, target) {
    return data.photometricType === 1 ? planeIndexTypeC(data, target) : nearestIndex(data.horizontalAngles, target);
  }

  function typeCCurve(data, a, b, label, color) {
    const aIndex = nearestPlaneIndex(data, a);
    const bIndex = nearestPlaneIndex(data, b);
    const aProfile = data.candela[aIndex] || [];
    const bProfile = data.candela[bIndex] || aProfile;
    const forward = data.verticalAngles.map((angle, index) => ({ angle: Math.abs(angle), value: aProfile[index] || 0 }));
    const backward = data.verticalAngles.map((angle, index) => ({ angle: -Math.abs(angle), value: bProfile[index] || 0 })).reverse();
    return { label, color, points: backward.concat(forward) };
  }

  function typeBAngleForDisplay(angle, angles) {
    const min = Math.min(...angles);
    const max = Math.max(...angles);
    return min >= -0.001 && max <= 180.001 && (max - min) > 120 ? angle - 90 : angle;
  }

  function typeBTarget(angles) {
    const min = Math.min(...angles);
    const max = Math.max(...angles);
    return min >= -0.001 && max <= 180.001 && angles.some((angle) => nearlyEqual(angle, 90)) ? 90 : 0;
  }

  function typeBCurveFromPlane(data, target, label, color) {
    const hIndex = nearestPlaneIndex(data, target);
    const profile = data.candela[hIndex] || [];
    return { label: `${label} H${fmt(data.horizontalAngles[hIndex], 1)}`, color, points: data.verticalAngles.map((angle, index) => ({ angle: typeBAngleForDisplay(angle, data.verticalAngles), value: profile[index] || 0 })) };
  }

  function typeBCurveAcrossPlanes(data, target, label, color) {
    const vIndex = nearestIndex(data.verticalAngles, target);
    return { label: `${label} V${fmt(data.verticalAngles[vIndex], 1)}`, color, points: data.horizontalAngles.map((angle, index) => ({ angle: typeBAngleForDisplay(angle, data.horizontalAngles), value: (data.candela[index] || [])[vIndex] || 0 })) };
  }

  function curvesOf(data) {
    if (data.photometricType === 2) return [typeBCurveFromPlane(data, typeBTarget(data.horizontalAngles), 'main vertical', '#ff2b2b'), typeBCurveAcrossPlanes(data, typeBTarget(data.verticalAngles), 'main horizontal', '#58d7ff')];
    return [typeCCurve(data, 0, 180, 'C0/180', '#ff2b2b'), typeCCurve(data, 90, 270, 'C90/270', '#58d7ff')];
  }

  function halfInterpolate(a, b, half) {
    const delta = b.value - a.value;
    if (Math.abs(delta) < 0.000001) return b.angle;
    return a.angle + ((half - a.value) / delta) * (b.angle - a.angle);
  }

  function beamAngleFromPoints(points) {
    const usable = points.filter((point) => Number.isFinite(point.angle) && Number.isFinite(point.value)).sort((a, b) => a.angle - b.angle);
    if (usable.length < 2) return 0;
    const peak = Math.max(...usable.map((point) => point.value), 0);
    if (peak <= 0) return 0;
    const peakIndex = usable.findIndex((point) => point.value === peak);
    const half = peak / 2;
    let left = usable[0].angle;
    let right = usable[usable.length - 1].angle;
    for (let i = peakIndex; i > 0; i -= 1) {
      if (usable[i - 1].value <= half) { left = halfInterpolate(usable[i - 1], usable[i], half); break; }
    }
    for (let i = peakIndex; i < usable.length - 1; i += 1) {
      if (usable[i + 1].value <= half) { right = halfInterpolate(usable[i], usable[i + 1], half); break; }
    }
    return Math.abs(right - left);
  }

  function niceCandelaScale(value) {
    const max = Math.max(1, Number(value) || 1);
    const exponent = Math.floor(Math.log10(max));
    const base = Math.pow(10, exponent);
    const normalized = max / base;
    const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 2.5 ? 2.5 : normalized <= 3 ? 3 : normalized <= 5 ? 5 : 10;
    return step * base;
  }

  function previewCandelaScale(peakValue) {
    const targetPeakFill = 1;
    return Math.max(1, Number(peakValue) || 1) / targetPeakFill;
  }

  function interpolateCurvePoints(points, step = 0.5) {
    const sorted = points
      .filter((point) => Number.isFinite(point.angle) && Number.isFinite(point.value))
      .sort((a, b) => a.angle - b.angle);
    const unique = [];
    sorted.forEach((point) => {
      if (unique.length && Math.abs(unique[unique.length - 1].angle - point.angle) < 0.0001) {
        unique[unique.length - 1] = point.value > unique[unique.length - 1].value ? point : unique[unique.length - 1];
      } else {
        unique.push(point);
      }
    });
    if (unique.length < 4) return unique;

    const xs = unique.map((point) => point.angle);
    const ys = unique.map((point) => Math.max(0, point.value || 0));
    const slopes = [];
    const deltas = [];
    for (let i = 0; i < xs.length - 1; i += 1) {
      const dx = xs[i + 1] - xs[i];
      deltas[i] = dx ? (ys[i + 1] - ys[i]) / dx : 0;
    }
    slopes[0] = deltas[0] || 0;
    slopes[xs.length - 1] = deltas[deltas.length - 1] || 0;
    for (let i = 1; i < xs.length - 1; i += 1) {
      slopes[i] = deltas[i - 1] * deltas[i] <= 0 ? 0 : (deltas[i - 1] + deltas[i]) / 2;
    }
    for (let i = 0; i < deltas.length; i += 1) {
      if (Math.abs(deltas[i]) < 0.000001) {
        slopes[i] = 0;
        slopes[i + 1] = 0;
      }
    }

    const sampled = [];
    for (let i = 0; i < xs.length - 1; i += 1) {
      const x0 = xs[i];
      const x1 = xs[i + 1];
      const span = x1 - x0;
      if (span <= 0) continue;
      const count = Math.max(1, Math.ceil(span / step));
      for (let j = 0; j < count; j += 1) {
        const t = j / count;
        const h00 = 2 * t * t * t - 3 * t * t + 1;
        const h10 = t * t * t - 2 * t * t + t;
        const h01 = -2 * t * t * t + 3 * t * t;
        const h11 = t * t * t - t * t;
        const value = h00 * ys[i] + h10 * span * slopes[i] + h01 * ys[i + 1] + h11 * span * slopes[i + 1];
        sampled.push({ angle: x0 + t * span, value: Math.max(0, value) });
      }
    }
    sampled.push({ angle: xs[xs.length - 1], value: ys[ys.length - 1] });
    return sampled;
  }

  function drawReportStylePreview(targetCanvas, targetCtx, data) {
    const cssWidth = Math.max(320, Math.round(targetCanvas.clientWidth || 560));
    const cssHeight = Math.round(cssWidth * 483 / 508);
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    targetCanvas.width = Math.round(cssWidth * ratio);
    targetCanvas.height = Math.round(cssHeight * ratio);
    targetCtx.setTransform(ratio, 0, 0, ratio, 0, 0);
    targetCtx.clearRect(0, 0, cssWidth, cssHeight);
    targetCtx.fillStyle = '#ffffff';
    targetCtx.fillRect(0, 0, cssWidth, cssHeight);

    const curves = curvesOf(data);
    const peak = peakOf(data);
    const scaleMax = previewCandelaScale(peak.value);
    const cx = cssWidth / 2;
    const cy = 0;
    const radius = cssHeight * 0.79;
    const bottomY = cy + radius;

    targetCtx.save();
    targetCtx.strokeStyle = '#111111';
    targetCtx.lineWidth = 1.15;

    for (let ring = 1; ring <= 5; ring += 1) {
      targetCtx.beginPath();
      targetCtx.arc(cx, cy, radius * ring / 5, Math.PI * 0.04, Math.PI * 0.96);
      targetCtx.stroke();
    }

    for (let angle = -90; angle <= 90; angle += 15) {
      const rad = angle * Math.PI / 180;
      targetCtx.beginPath();
      targetCtx.moveTo(cx, cy);
      targetCtx.lineTo(cx + Math.sin(rad) * radius, cy + Math.cos(rad) * radius);
      targetCtx.stroke();
    }
    targetCtx.restore();

    const previewCurves = data.horizontalAngles.length > 1 ? curves.slice(0, 2) : curves.slice(0, 1);
    previewCurves.forEach((curve, curveIndex) => {
      const points = interpolateCurvePoints(curve.points
        .filter((point) => Number.isFinite(point.angle) && Number.isFinite(point.value) && point.angle >= -90 && point.angle <= 90)
        .sort((a, b) => a.angle - b.angle), 0.25);

      targetCtx.save();
      targetCtx.strokeStyle = '#050505';
      targetCtx.lineWidth = Math.max(curveIndex === 0 ? 2.8 : 2.1, cssWidth * (curveIndex === 0 ? 0.006 : 0.0045));
      if (curveIndex > 0) targetCtx.setLineDash([8, 6]);
      targetCtx.lineJoin = 'round';
      targetCtx.lineCap = 'round';
      targetCtx.beginPath();
      points.forEach((point, index) => {
        const rad = point.angle * Math.PI / 180;
        const r = radius * Math.max(0, point.value || 0) / scaleMax;
        const x = cx + Math.sin(rad) * r;
        const y = cy + Math.cos(rad) * r;
        if (index === 0) targetCtx.moveTo(x, y);
        else targetCtx.lineTo(x, y);
      });
      targetCtx.stroke();
      targetCtx.setLineDash([]);
      targetCtx.restore();
    });

    targetCtx.save();
    targetCtx.fillStyle = '#050505';
    const labelSize = cssWidth < 420 ? Math.max(13, cssWidth * 0.039) : Math.max(18, cssWidth * 0.052);
    const imaxSize = cssWidth < 420 ? Math.max(12, cssWidth * 0.034) : Math.max(17, cssWidth * 0.047);
    targetCtx.font = `${labelSize}px Arial, Helvetica, sans-serif`;
    targetCtx.textBaseline = 'alphabetic';
    targetCtx.textAlign = 'left';
    targetCtx.fillText('30°', 10, bottomY + 28);
    targetCtx.textAlign = 'right';
    targetCtx.fillText('30°', cssWidth - 10, bottomY + 28);
    targetCtx.textAlign = 'center';
    targetCtx.fillText(`${fmt(scaleMax, scaleMax >= 100 ? 0 : 1)}cd`, cx, bottomY + (cssWidth < 420 ? 32 : 38));
    targetCtx.fillText('0°', cx, bottomY + (cssWidth < 420 ? 56 : 72));
    targetCtx.textAlign = 'right';
    targetCtx.font = `${imaxSize}px Arial, Helvetica, sans-serif`;
    targetCtx.fillText(`Imax=${fmt(peak.value, peak.value >= 100 ? 0 : 1)}cd`, cssWidth - 10, cssHeight - (cssWidth < 420 ? 9 : 22));
    targetCtx.restore();
  }

  function drawPolar(targetCanvas, targetCtx, data, title, subtitle, footer, showDark = true) {
    if (showDark) {
      drawReportStylePreview(targetCanvas, targetCtx, data);
      return;
    }
    const cssSize = Math.max(320, Math.round(targetCanvas.clientWidth || 560));
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    targetCanvas.width = Math.round(cssSize * ratio);
    targetCanvas.height = Math.round(cssSize * ratio);
    targetCtx.setTransform(ratio, 0, 0, ratio, 0, 0);
    targetCtx.clearRect(0, 0, cssSize, cssSize);
    targetCtx.fillStyle = showDark ? '#f8f4ee' : '#ffffff';
    targetCtx.fillRect(0, 0, cssSize, cssSize);
    const curves = curvesOf(data);
    const peak = peakOf(data);
    const max = Math.max(peak.value, ...curves.flatMap((curve) => curve.points.map((point) => point.value)), 1);
    const top = 92;
    const bottom = 64;
    const available = cssSize - top - bottom;
    const cx = cssSize / 2;
    const cy = top + available / 2;
    const radius = Math.max(72, Math.min(cssSize * 0.34, available / 2 - 18));
    targetCtx.strokeStyle = showDark ? 'rgba(59,54,48,0.16)' : '#222';
    targetCtx.lineWidth = 1;
    for (let ring = 1; ring <= 4; ring += 1) {
      targetCtx.beginPath();
      targetCtx.arc(cx, cy, radius * ring / 4, 0, Math.PI * 2);
      targetCtx.stroke();
    }
    for (let angle = -180; angle < 180; angle += 15) {
      const rad = angle * Math.PI / 180;
      targetCtx.beginPath();
      targetCtx.moveTo(cx, cy);
      targetCtx.lineTo(cx + Math.sin(rad) * radius, cy + Math.cos(rad) * radius);
      targetCtx.stroke();
    }
    targetCtx.fillStyle = showDark ? '#6f6a62' : '#111';
    targetCtx.font = '12px Segoe UI, Arial';
    targetCtx.textAlign = 'center';
    targetCtx.textBaseline = 'middle';
    [-150, -120, -90, -60, -30, 0, 30, 60, 90, 120, 150, 180].forEach((angle) => {
      const rad = angle * Math.PI / 180;
      targetCtx.fillText(String(angle), cx + Math.sin(rad) * (radius + 25), cy + Math.cos(rad) * (radius + 25));
    });
    curves.forEach((curve) => {
      targetCtx.strokeStyle = curve.color;
      targetCtx.lineWidth = 2.5;
      targetCtx.beginPath();
      interpolateCurvePoints(curve.points, 0.5).forEach((point, index) => {
        const rad = point.angle * Math.PI / 180;
        const r = radius * (point.value / max);
        const x = cx + Math.sin(rad) * r;
        const y = cy + Math.cos(rad) * r;
        if (index === 0) targetCtx.moveTo(x, y); else targetCtx.lineTo(x, y);
      });
      targetCtx.stroke();
    });
    const beam = beamAngleFromPoints(curves[0]?.points || []);
    targetCtx.textAlign = 'left';
    targetCtx.textBaseline = 'alphabetic';
    targetCtx.fillStyle = showDark ? '#26231e' : '#111';
    targetCtx.font = '18px Segoe UI, Arial';
    targetCtx.fillText(title, 28, 34);
    targetCtx.fillStyle = showDark ? '#6f6a62' : '#222';
    targetCtx.font = '13px Segoe UI, Arial';
    targetCtx.fillText(subtitle, 28, 56);
    targetCtx.fillText(`Beam angle: ${fmt(beam, 2)}°`, 28, 76);
    targetCtx.textAlign = 'right';
    targetCtx.fillText(`Scale max ${fmt(max, 1)} cd`, cssSize - 28, 56);
    targetCtx.textAlign = 'left';
    targetCtx.fillText(footer, 28, cssSize - 26);
  }

  function updateStats(data) {
    const flux = fluxOf(data);
    const peak = peakOf(data);
    const beam = beamAngleFromPoints(curvesOf(data)[0]?.points || []);
    $('totalFlux').textContent = `${fmt(flux, 1)} lm`;
    $('maxCd').textContent = `${fmt(peak.value, 1)} cd`;
    $('efficacy').textContent = data.power > 0 ? `${fmt(flux / data.power, 1)} lm/W` : '-';
    $('beamValue').textContent = `${fmt(beam, 2)}°`;
    $('beamLabel').textContent = `${typeName(data.photometricType)} / H ${fmt(data.horizontalAngles[0], 1)} to ${fmt(data.horizontalAngles[data.horizontalAngles.length - 1], 1)} / V ${fmt(data.verticalAngles[0], 1)} to ${fmt(data.verticalAngles[data.verticalAngles.length - 1], 1)} / Beam ${fmt(beam, 2)}°`;
    drawPolar(canvas, ctx, data, 'Photometric distribution curves', `Red: ${curvesOf(data)[0].label} / Blue: ${curvesOf(data)[1]?.label || '-'}`, `Global peak ${fmt(peak.value, 1)} cd @ H${fmt(peak.hAngle, 1)} / V${fmt(peak.vAngle, 1)}`, true);
  }

  function hideReport() {
    report.classList.add('hidden');
  }

  function typeName(type) {
    if (type === 1) return 'Type C';
    if (type === 2) return 'Type B';
    return `Type ${type}`;
  }

  function tableRows(rows) {
    return `<table>${rows.map((row) => `<tr><th>${esc(row[0])}</th><td>${esc(row[1])}</td></tr>`).join('')}</table>`;
  }

  function candelaTable(data) {
    const head = `<tr><th>V / H</th>${data.horizontalAngles.map((angle) => `<th>${fmt(angle, 1)}</th>`).join('')}</tr>`;
    const body = data.verticalAngles.map((angle, vIndex) => `<tr><th>${fmt(angle, 1)}</th>${data.horizontalAngles.map((_, hIndex) => `<td>${fmt((data.candela[hIndex] || [])[vIndex] || 0, 3)}</td>`).join('')}</tr>`).join('');
    return `<table class='wide-table'><thead>${head}</thead><tbody>${body}</tbody></table>`;
  }

  function zonalTable(data) {
    const luminaireLumens = fluxOf(data);
    const lampLumens = data.lampCount * data.lumensPerLamp;
    const zones = [];
    for (let start = 0; start < 180; start += 10) zones.push([`${start}-${start + 10}`, zoneFlux(data, start, start + 10)]);
    const body = zones.map(([zone, lumens]) => `<tr><td>${zone}</td><td>${fmt(lumens, 2)}</td><td>${lampLumens > 0 ? fmt(lumens / lampLumens * 100, 2) : '-'}</td><td>${luminaireLumens > 0 ? fmt(lumens / luminaireLumens * 100, 2) : '-'}</td></tr>`).join('');
    return `<table><thead><tr><th>Zone</th><th>Lumens</th><th>%Lamp</th><th>%Fixt</th></tr></thead><tbody>${body}</tbody></table>`;
  }

  function reportDescription(data) {
    const tiltIndex = data.lines.findIndex((line) => /^\s*TILT\s*=/i.test(line));
    const sourceLines = tiltIndex >= 0 ? data.lines.slice(0, tiltIndex + 1) : data.lines.slice(0, 20);
    return sourceLines.join('\n');
  }

  function buildReport(data) {
    const luminaireLumens = fluxOf(data);
    const lampLumens = data.lampCount * data.lumensPerLamp;
    const peak = peakOf(data);
    const beam = beamAngleFromPoints(curvesOf(data)[0]?.points || []);
    $('reportFileName').textContent = data.fileName || `${safeName(data.keywords.manufacturer || 'CDN')}-${safeName(data.keywords.serial || 'generated')}.ies`;
    $('reportDescription').textContent = reportDescription(data);
    $('reportCharacteristics').innerHTML = tableRows([
      ['Lumens Per Lamp', `${fmt(data.lumensPerLamp, 2)} (${fmt(data.lampCount, 0)} lamp)`],
      ['Total Lamp Lumens', fmt(lampLumens, 2)],
      ['Luminaire Lumens', fmt(luminaireLumens, 2)],
      ['Total Luminaire Efficiency', lampLumens > 0 ? `${fmt(luminaireLumens / lampLumens * 100, 2)} %` : '-'],
      ['Luminaire Efficacy Rating', data.power > 0 ? fmt(luminaireLumens / data.power, 1) : '-'],
      ['Total Luminaire Watts', fmt(data.power, 4)],
      ['Photometric Type', typeName(data.photometricType)],
      ['Beam Angle (FWHM)', `${fmt(beam, 2)}°`],
      ['Maximum Candela', `${fmt(peak.value, 1)} cd @ H${fmt(peak.hAngle, 1)} / V${fmt(peak.vAngle, 1)}`],
      ['Luminous Length', `${fmt(data.length, 4)} m`],
      ['Luminous Width', `${fmt(data.width, 4)} m`],
      ['Luminous Height', `${fmt(data.height, 4)} m`]
    ]);
    $('reportCandela').innerHTML = candelaTable(data);
    $('reportZonal').innerHTML = zonalTable(data);
    $('reportUGR').textContent = peak.value > 0 ? 'UGR table is not calculated in this browser version. Offending-zone validation can be added later.' : 'Unable to calculate UGR - No candela in offending zones';
    drawPolar(reportPolar, reportCtx, data, 'POLAR GRAPH', `#1 ${curvesOf(data)[0].label} / #2 ${curvesOf(data)[1]?.label || '-'}`, `Maximum Candela = ${fmt(peak.value, 1)} Located At Horizontal Angle = ${fmt(peak.hAngle, 1)}, Vertical Angle = ${fmt(peak.vAngle, 1)}`, false);
    report.classList.remove('hidden');
    report.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function setUploadedFields(data) {
    fields.manufacturer.value = data.keywords.manufacturer || 'CDN';
    fields.serial.value = data.keywords.serial || 'uploaded-ies';
    fields.date.value = data.keywords.date || '';
    fields.ledCount.value = String(Math.max(1, Math.round(data.lampCount || 1)));
    fields.singleFlux.value = fmt(data.lumensPerLamp || 0, 3);
    fields.efficiency.value = data.lumensPerLamp > 0 ? fmt(fluxOf(data) / Math.max(0.001, data.lampCount * data.lumensPerLamp), 3) : '1';
    fields.length.value = fmt(data.length || 0, 4);
    fields.width.value = fmt(data.width || 0, 4);
    fields.height.value = fmt(data.height || 0, 4);
    fields.power.value = fmt(data.power || 0, 4);
    fields.beamAngle.value = fmt(beamAngleFromPoints(curvesOf(data)[0]?.points || []), 2);
    if (fields.beamAngleC90) fields.beamAngleC90.value = fmt(beamAngleFromPoints(curvesOf(data)[1]?.points || curvesOf(data)[0]?.points || []), 2);
    if (fields.iesType) fields.iesType.value = data.horizontalAngles.length > 1 ? 'four-plane' : 'symmetric';
    if (fields.distributionShape) fields.distributionShape.value = 'lambertian';
    fields.notes.value = 'Uploaded IES file. Original photometric data is preserved.';
    syncIesTypeUI();
  }

  function updateGeneratedPreview() {
    syncGenerationModeUI();
    current = makeGeneratedParsed();
    current.fileName = `${safeName(fields.manufacturer.value || 'CDN')}-${safeName(fields.serial.value || 'spot01')}.ies`;
    preview.textContent = current.text;
    $('fileName').textContent = current.fileName;
    updateStats(current);
  }

  function downloadCurrentIES() {
    const data = uploaded || current || makeGeneratedParsed();
    const blob = new Blob([data.text], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = data.fileName || `${safeName(fields.manufacturer.value || 'CDN')}-${safeName(fields.serial.value || 'spot01')}.ies`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(link.href);
  }

  function sendToInteriorCalculator() {
    if (!uploaded) updateGeneratedPreview();
    const data = uploaded || current || makeGeneratedParsed();
    const fileName = data.fileName || `${safeName(fields.manufacturer.value || 'CDN')}-${safeName(fields.serial.value || 'spot01')}.ies`;
    const payload = {
      fileName,
      text: data.text || preview.textContent || '',
      sentAt: Date.now()
    };
    try {
      sessionStorage.setItem('interior-lighting-pending-ies', JSON.stringify(payload));
    } catch (error) {
      localStorage.setItem('interior-lighting-pending-ies', JSON.stringify(payload));
    }
    window.location.href = '../interior-lighting/?from=ies-editor';
  }

  function resetFields() {
    uploaded = null;
    fields.manufacturer.value = 'CDN'; fields.serial.value = 'Downlight'; fields.date.value = '20260626'; fields.ledCount.value = '1';
    fields.singleFlux.value = '1000'; fields.beamAngle.value = '36'; if (fields.beamAngleC90) fields.beamAngleC90.value = '36'; fields.efficiency.value = '1'; fields.length.value = '0.1';
    fields.width.value = '0.1'; fields.height.value = '0.1'; fields.power.value = '10'; fields.notes.value = 'Generated by CDN IES Editor.';
    if (fields.iesType) fields.iesType.value = 'symmetric';
    if (fields.generationMode) fields.generationMode.value = 'simple';
    if (fields.distributionShape) fields.distributionShape.value = 'lambertian';
    advancedPopulated = false;
    syncIesTypeUI();
    hideReport();
    updateGeneratedPreview();
  }

  function syncIesTypeUI() {
    const showC90 = isFourPlaneMode();
    document.querySelectorAll('.c90-beam-field').forEach((node) => { node.hidden = !showC90; });
    document.querySelectorAll('.c90-col').forEach((node) => { node.hidden = !showC90; });
    document.querySelectorAll('.adv-c90').forEach((input) => {
      if (showC90 && !input.value) input.value = input.closest('tr')?.querySelector('.adv-c0')?.value || '0';
    });
  }

  function syncGenerationModeUI() {
    const editor = $('advancedEditor');
    const advanced = (fields.generationMode?.value || 'simple') === 'advanced';
    if (editor) editor.hidden = !advanced;
    if (advanced && !advancedPopulated) {
      populateAdvancedRowsFromSimple();
    }
    syncIesTypeUI();
  }

  form.addEventListener('input', (event) => {
    if (!event.target.closest('#advancedRows') && event.target !== fields.generationMode && (fields.generationMode?.value || 'simple') !== 'advanced') advancedPopulated = false;
    uploaded = null; hideReport(); updateGeneratedPreview();
  });
  form.addEventListener('change', (event) => {
    if (event.target === fields.generationMode && fields.generationMode.value === 'advanced') populateAdvancedRowsFromSimple();
    if (event.target === fields.iesType) syncIesTypeUI();
    uploaded = null; hideReport(); updateGeneratedPreview();
  });
  $('downloadBtn').addEventListener('click', downloadCurrentIES);
  $('calcBtn').addEventListener('click', sendToInteriorCalculator);
  $('reportBtn').addEventListener('click', () => { if (!uploaded) updateGeneratedPreview(); buildReport(uploaded || current); });
  $('copyBtn').addEventListener('click', () => navigator.clipboard.writeText(preview.textContent));
  $('resetBtn').addEventListener('click', resetFields);
  $('upload').addEventListener('change', (event) => {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        uploaded = parseIES(decodeIESBuffer(reader.result), file.name);
        current = uploaded;
        if (fields.generationMode) fields.generationMode.value = 'simple';
        syncGenerationModeUI();
        setUploadedFields(uploaded);
        preview.textContent = uploaded.text;
        $('fileName').textContent = file.name;
        updateStats(uploaded);
        buildReport(uploaded);
      } catch (error) {
        fields.notes.value = `Read failed: ${error.message || error}`;
      }
    };
    reader.readAsArrayBuffer(file);
  });
  window.addEventListener('resize', () => { if (current) updateStats(current); if (!report.classList.contains('hidden') && (uploaded || current)) drawPolar(reportPolar, reportCtx, uploaded || current, 'POLAR GRAPH', 'Photometric report graph', 'Resized', false); });
  syncGenerationModeUI();
  updateGeneratedPreview();
  hideReport();
})();

