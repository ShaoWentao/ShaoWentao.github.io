(() => {
  const $ = (id) => document.getElementById(id);

  function currentLanguage() {
    if (window.iesEditorLanguage === 'zh' || window.iesEditorLanguage === 'en') return window.iesEditorLanguage;
    const selected = $('languageSelect') && $('languageSelect').value;
    if (selected === 'zh' || selected === 'en') return selected;
    return (document.documentElement.lang || '').toLowerCase().startsWith('zh') ? 'zh' : 'en';
  }

  function label() {
    return currentLanguage() === 'zh' ? '下载 LDT' : 'Download LDT';
  }

  function fmt(value, digits = 3) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return '0';
    return String(Number(parsed.toFixed(digits)));
  }

  function safeName(value) {
    return String(value || 'luminaire').replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '') || 'luminaire';
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
      manufacturer: read(['MANUFAC']) || $('manufacturer')?.value || 'CDN',
      luminaire: read(['LUMINAIRE', 'LUMCAT', 'TEST']) || $('serial')?.value || 'luminaire',
      date: read(['ISSUEDATE', 'TESTDATE']) || $('date')?.value || ''
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

  function parseIES(text) {
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
    if (verticalCount <= 0 || horizontalCount <= 0 || nums.length - i < expected) throw new Error('IES candela matrix is incomplete.');
    const candela = [];
    for (let h = 0; h < horizontalCount; h += 1) {
      candela.push(nums.slice(i, i + verticalCount).map((value) => value * multiplier));
      i += verticalCount;
    }
    return { lines, keywords: parseKeywords(lines), lampCount, lumensPerLamp, verticalAngles, horizontalAngles, photometricType, unitsType, width, length, height, power, candela };
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

  function interpolateByAngle(angles, values, target, cyclic = false, zeroOutside = false) {
    if (!angles.length || !values.length) return 0;
    if (angles.length === 1) return values[0] || 0;
    const pairs = angles.map((angle, index) => ({ angle: cyclic ? normalizeDegrees(angle) : angle, value: values[index] || 0 }))
      .sort((a, b) => a.angle - b.angle)
      .filter((item, index, array) => index === 0 || !nearlyEqual(item.angle, array[index - 1].angle));
    let x = cyclic ? normalizeDegrees(target) : target;
    if (!cyclic) {
      if (x < pairs[0].angle) return zeroOutside ? 0 : pairs[0].value;
      if (x > pairs[pairs.length - 1].angle) return zeroOutside ? 0 : pairs[pairs.length - 1].value;
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
    const maxG = Math.max(...data.verticalAngles.map((angle) => Math.abs(angle)));
    const zeroOutside = maxG <= 90.001 && g > maxG;
    const planeValues = data.candela.map((profile) => interpolateByAngle(data.verticalAngles.map(Math.abs), profile, g, false, zeroOutside));
    if (data.horizontalAngles.length === 1) return Math.max(0, planeValues[0] || 0);
    if (data.photometricType === 1) {
      const c = mapTypeCAngle(data, cAngle);
      const cyclic = Math.max(...data.horizontalAngles) - Math.min(...data.horizontalAngles) >= 359;
      return Math.max(0, interpolateByAngle(data.horizontalAngles, planeValues, c, cyclic));
    }
    return Math.max(0, interpolateByAngle(data.horizontalAngles, planeValues, cAngle, false));
  }

  function integrateProfileZone(angles, profile, minAngle = -Infinity, maxAngle = Infinity) {
    const pairs = angles.map((angle, index) => ({ angle: Math.abs(angle), value: Math.max(0, profile[index] || 0) })).sort((a, b) => a.angle - b.angle);
    let integral = 0;
    for (let i = 0; i < pairs.length - 1; i += 1) {
      const from = Math.min(pairs[i].angle, pairs[i + 1].angle);
      const to = Math.max(pairs[i].angle, pairs[i + 1].angle);
      if (to <= minAngle || from >= maxAngle) continue;
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

  function luminaireFlux(data) {
    const verticalIntegrals = data.candela.map((profile) => integrateProfileZone(data.verticalAngles, profile));
    const integrated = integrateHorizontal(data, verticalIntegrals);
    const header = Math.max(0, (data.lampCount || 1) * (data.lumensPerLamp || 0));
    return integrated > 0.001 ? integrated : header;
  }

  function downwardFlux(data) {
    const verticalIntegrals = data.candela.map((profile) => integrateProfileZone(data.verticalAngles, profile, 0, 90));
    return integrateHorizontal(data, verticalIntegrals);
  }

  function mm(value, unitsType) {
    const meter = unitsType === 1 ? value * 0.3048 : value;
    return Math.max(0, Math.round(meter * 1000));
  }

  function makeCPlanes(data) {
    if (data.horizontalAngles.length === 1) return { ityp: 1, isym: 1, angles: [0], dc: 0 };
    const angles = Array.from({ length: 24 }, (_, index) => index * 15);
    return { ityp: 3, isym: 0, angles, dc: 15 };
  }

  function makeGAngles(data) {
    const maxAngle = Math.max(...data.verticalAngles.map((angle) => Math.abs(angle)));
    const end = maxAngle <= 90.001 ? 90 : 180;
    return Array.from({ length: end + 1 }, (_, index) => index);
  }

  function buildLDT(data, sourceName) {
    const flux = luminaireFlux(data);
    if (flux <= 0) throw new Error('Valid luminous flux is not available.');
    const dff = Math.max(0, Math.min(100, downwardFlux(data) / flux * 100));
    const c = makeCPlanes(data);
    const gAngles = makeGAngles(data);
    const l = mm(data.length || 0, data.unitsType);
    const b = mm(data.width || 0, data.unitsType);
    const h = mm(data.height || 0, data.unitsType);
    const isCircular = $('surfaceShape')?.value === 'circular' || (l > 0 && b > 0 && Math.abs(l - b) <= 2);
    const lengthOrDiameter = isCircular ? Math.max(l, b) : l;
    const widthOrZero = isCircular ? 0 : b;
    const name = data.keywords.luminaire || safeName(sourceName).replace(/\.ies$/i, '');
    const fileStem = safeName(sourceName || name).replace(/\.ies$/i, '').slice(0, 40) || 'luminaire';
    const intensities = [];
    for (const cAngle of c.angles) {
      for (const gamma of gAngles) {
        intensities.push(fmt(candelaAt(data, gamma, cAngle) / flux * 1000, 3));
      }
    }

    const lines = [
      `${data.keywords.manufacturer || 'CDN'} / EULUMDAT / generated from IES`,
      String(c.ityp),
      String(c.isym),
      String(c.angles.length),
      fmt(c.dc, 1),
      String(gAngles.length),
      fmt(gAngles.length > 1 ? (gAngles[1] - gAngles[0]) : 0, 1),
      data.keywords.luminaire || name,
      name,
      name,
      fileStem.slice(0, 8),
      data.keywords.date || new Date().toISOString().slice(0, 10),
      String(lengthOrDiameter),
      String(widthOrZero),
      String(h),
      String(lengthOrDiameter),
      String(widthOrZero),
      String(h),
      String(h),
      String(h),
      String(h),
      fmt(dff, 1),
      '100',
      '1',
      '0',
      '1',
      '-1',
      'LED',
      fmt(flux, 1),
      '',
      '',
      fmt(data.power || 0, 2),
      '0 0 0 0 0 0 0 0 0 0',
      c.angles.map((angle) => fmt(angle, 1)).join(' '),
      gAngles.map((angle) => fmt(angle, 1)).join(' '),
      intensities.join(' '),
      ''
    ];
    return lines.join('\r\n');
  }

  function currentFileName() {
    const name = $('fileName')?.textContent.trim() || $('serial')?.value || 'luminaire';
    return safeName(name.replace(/\.ies$/i, '')) + '.ldt';
  }

  function downloadLDT() {
    const text = $('iesPreview')?.textContent || '';
    if (!/TILT\s*=/i.test(text)) {
      alert(currentLanguage() === 'zh' ? '请先生成或上传 IES 文件。' : 'Please generate or upload an IES file first.');
      return;
    }
    try {
      if (typeof window.iesGenerateOneDegree === 'function') window.iesGenerateOneDegree();
      const iesText = $('iesPreview')?.textContent || text;
      const data = parseIES(iesText);
      const ldt = buildLDT(data, $('fileName')?.textContent.trim() || 'luminaire.ies');
      const blob = new Blob([ldt], { type: 'text/plain;charset=utf-8' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = currentFileName();
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(link.href);
    } catch (error) {
      alert((currentLanguage() === 'zh' ? 'LDT 导出失败：' : 'LDT export failed: ') + (error.message || error));
    }
  }

  function ensureButton() {
    if ($('downloadLdtBtn')) return;
    const downloadBtn = $('downloadBtn');
    if (!downloadBtn || !downloadBtn.parentNode) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'downloadLdtBtn';
    btn.textContent = label();
    btn.addEventListener('click', downloadLDT);
    downloadBtn.insertAdjacentElement('afterend', btn);
  }

  function updateButtonText() {
    const btn = $('downloadLdtBtn');
    if (btn) btn.textContent = label();
  }

  function init() {
    ensureButton();
    updateButtonText();
  }

  window.addEventListener('DOMContentLoaded', init);
  window.addEventListener('ies-language-change', updateButtonText);
  if (document.readyState !== 'loading') init();
})();
