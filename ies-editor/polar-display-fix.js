(() => {
  const RED = '#d71920';
  const BLUE = '#0047b3';
  const $ = (id) => document.getElementById(id);

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
    nums[i++];
    nums[i++];
    const multiplier = nums[i++];
    const verticalCount = Math.round(nums[i++]);
    const horizontalCount = Math.round(nums[i++]);
    const photometricType = Math.round(nums[i++]);
    // Skip: units, width, length, height, ballast factor, future use, input watts.
    i += 7;
    const verticalAngles = nums.slice(i, i + verticalCount); i += verticalCount;
    const horizontalAngles = nums.slice(i, i + horizontalCount); i += horizontalCount;
    const candela = [];
    for (let h = 0; h < horizontalCount; h += 1) {
      candela.push(nums.slice(i, i + verticalCount).map((value) => value * multiplier));
      i += verticalCount;
    }
    return { photometricType, verticalAngles, horizontalAngles, candela };
  }

  function normalize(angle) {
    return ((angle % 360) + 360) % 360;
  }

  function distance(a, b) {
    return Math.abs((((a - b) % 360) + 540) % 360 - 180);
  }

  function nearest(values, target, cyclic = false) {
    let best = 0;
    let dist = Infinity;
    values.forEach((value, index) => {
      const d = cyclic ? distance(value, target) : Math.abs(value - target);
      if (d < dist) { dist = d; best = index; }
    });
    return best;
  }

  function planeIndex(data, target) {
    if (data.photometricType !== 1) return nearest(data.horizontalAngles, target, false);
    const values = data.horizontalAngles;
    const min = Math.min(...values);
    const max = Math.max(...values);
    let mapped = normalize(target);
    if (min >= -0.001 && max <= 90.001) {
      mapped %= 180;
      if (mapped > 90) mapped = 180 - mapped;
      return nearest(values, mapped, false);
    }
    if (min >= -0.001 && max <= 180.001) {
      if (mapped > 180) mapped = 360 - mapped;
      return nearest(values, mapped, false);
    }
    return nearest(values, mapped, true);
  }

  function typeCCurve(data, a, b, color) {
    const aProfile = data.candela[planeIndex(data, a)] || [];
    const bProfile = data.candela[planeIndex(data, b)] || aProfile;
    const forward = data.verticalAngles.map((angle, index) => ({ angle: Math.abs(angle), value: aProfile[index] || 0 }));
    const backward = data.verticalAngles.map((angle, index) => ({ angle: -Math.abs(angle), value: bProfile[index] || 0 })).reverse();
    return { color, points: backward.concat(forward) };
  }

  function typeBAngleForDisplay(angle, angles) {
    const min = Math.min(...angles);
    const max = Math.max(...angles);
    return min >= -0.001 && max <= 180.001 && (max - min) > 120 ? angle - 90 : angle;
  }

  function typeBTarget(angles) {
    const min = Math.min(...angles);
    const max = Math.max(...angles);
    return min >= -0.001 && max <= 180.001 && angles.some((angle) => Math.abs(angle - 90) <= 0.001) ? 90 : 0;
  }

  function typeBPlane(data, target, color) {
    const profile = data.candela[planeIndex(data, target)] || [];
    return { color, points: data.verticalAngles.map((angle, index) => ({ angle: typeBAngleForDisplay(angle, data.verticalAngles), value: profile[index] || 0 })) };
  }

  function typeBAcross(data, target, color) {
    const vIndex = nearest(data.verticalAngles, target, false);
    return { color, points: data.horizontalAngles.map((angle, index) => ({ angle: typeBAngleForDisplay(angle, data.horizontalAngles), value: (data.candela[index] || [])[vIndex] || 0 })) };
  }

  function curves(data) {
    if (data.photometricType === 2) return [typeBPlane(data, typeBTarget(data.horizontalAngles), RED), typeBAcross(data, typeBTarget(data.verticalAngles), BLUE)];
    return [typeCCurve(data, 0, 180, RED), typeCCurve(data, 90, 270, BLUE)];
  }

  function maxCandela(data, curveList) {
    let max = 1;
    data.candela.forEach((profile) => profile.forEach((value) => { max = Math.max(max, value || 0); }));
    curveList.forEach((curve) => curve.points.forEach((point) => { max = Math.max(max, point.value || 0); }));
    return max;
  }

  function overlayCurves(canvas, data) {
    if (!canvas || !canvas.clientWidth) return;
    const ctx = canvas.getContext('2d');
    const cssSize = Math.max(320, Math.round(canvas.clientWidth || 560));
    const curveList = curves(data);
    const max = maxCandela(data, curveList);
    const top = 92;
    const bottom = 64;
    const available = cssSize - top - bottom;
    const cx = cssSize / 2;
    const cy = top + available / 2;
    const radius = Math.max(72, Math.min(cssSize * 0.34, available / 2 - 18));

    // Blue is drawn first, red is drawn last. This changes layer order only.
    [curveList[1], curveList[0]].filter(Boolean).forEach((curve) => {
      ctx.save();
      ctx.strokeStyle = curve.color;
      ctx.lineWidth = curve.color === RED ? 3.2 : 2.8;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.beginPath();
      curve.points.forEach((point, index) => {
        const rad = point.angle * Math.PI / 180;
        const r = radius * ((point.value || 0) / max);
        const x = cx + Math.sin(rad) * r;
        const y = cy + Math.cos(rad) * r;
        if (index === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
      ctx.restore();
    });
  }

  function refreshOnce() {
    const text = $('iesPreview')?.textContent || '';
    if (!text.trim()) return;
    try {
      const data = parseIES(text);
      overlayCurves($('curveCanvas'), data);
      const report = $('report');
      if (report && !report.classList.contains('hidden')) overlayCurves($('reportPolar'), data);
    } catch (error) {}
  }

  function refreshRepeated() {
    [0, 30, 80, 160, 320, 650, 1200].forEach((delay) => setTimeout(refreshOnce, delay));
  }

  document.addEventListener('click', (event) => {
    if (event.target && ['reportBtn', 'resetBtn', 'downloadBtn'].includes(event.target.id)) refreshRepeated();
  });
  document.addEventListener('change', (event) => {
    if (event.target && event.target.id === 'upload') refreshRepeated();
  });
  window.addEventListener('resize', refreshRepeated);
  const preview = $('iesPreview');
  if (preview) new MutationObserver(refreshRepeated).observe(preview, { childList: true, characterData: true, subtree: true });
  refreshRepeated();
})();
