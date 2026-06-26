(() => {
  const RED = '#d71920';
  const BLUE = '#0047b3';
  const $ = (id) => document.getElementById(id);

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
    let nums = lines.slice(tiltIndex + 1).join(' ')
      .replace(/\[[^\]]+\][^\r\n]*/g, ' ')
      .replace(/,/g, ' ')
      .split(/\s+/)
      .filter(Boolean)
      .map(Number)
      .filter(Number.isFinite);
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
    const candela = [];
    for (let h = 0; h < horizontalCount; h += 1) {
      candela.push(nums.slice(i, i + verticalCount).map((value) => value * multiplier));
      i += verticalCount;
    }
    return { lampCount, lumensPerLamp, multiplier, photometricType, unitsType, width, length, height, power, verticalAngles, horizontalAngles, candela };
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

  function topCurve(data, target, label, color) {
    const index = planeIndex(data, target);
    const profile = data.candela[index] || [];
    const left = data.verticalAngles.map((angle, i) => ({ angle: -Math.abs(angle), value: profile[i] || 0 })).reverse();
    const right = data.verticalAngles.map((angle, i) => ({ angle: Math.abs(angle), value: profile[i] || 0 }));
    return { label, color, points: left.concat(right) };
  }

  function bottomCurve(data, target, label, color) {
    const index = planeIndex(data, target);
    const profile = data.candela[index] || [];
    const right = data.verticalAngles.map((angle, i) => ({ angle: 180 - Math.abs(angle), value: profile[i] || 0 })).reverse();
    const left = data.verticalAngles.map((angle, i) => ({ angle: -180 + Math.abs(angle), value: profile[i] || 0 }));
    return { label, color, points: right.concat(left) };
  }

  function curves(data) {
    if (data.photometricType === 2) {
      return [topCurve(data, 90, 'main vertical', RED), bottomCurve(data, 0, 'main horizontal', BLUE)];
    }
    return [topCurve(data, 0, 'C0/180', RED), bottomCurve(data, 90, 'C90/270', BLUE)];
  }

  function beamAngle(points) {
    const usable = points.filter((p) => Number.isFinite(p.angle) && Number.isFinite(p.value)).sort((a, b) => a.angle - b.angle);
    const topHalf = usable.filter((p) => Math.abs(p.angle) <= 90);
    const arr = topHalf.length ? topHalf : usable;
    if (arr.length < 2) return 0;
    const peak = Math.max(...arr.map((p) => p.value), 0);
    if (peak <= 0) return 0;
    const half = peak / 2;
    const peakIndex = arr.findIndex((p) => p.value === peak);
    let left = arr[0].angle;
    let right = arr[arr.length - 1].angle;
    function interp(a, b) {
      const delta = b.value - a.value;
      if (Math.abs(delta) < 0.000001) return b.angle;
      return a.angle + ((half - a.value) / delta) * (b.angle - a.angle);
    }
    for (let i = peakIndex; i > 0; i -= 1) {
      if (arr[i - 1].value <= half) { left = interp(arr[i - 1], arr[i]); break; }
    }
    for (let i = peakIndex; i < arr.length - 1; i += 1) {
      if (arr[i + 1].value <= half) { right = interp(arr[i], arr[i + 1]); break; }
    }
    return Math.abs(right - left);
  }

  function peak(data) {
    let result = { value: 0, hAngle: 0, vAngle: 0 };
    data.candela.forEach((profile, hIndex) => {
      profile.forEach((value, vIndex) => {
        if (value > result.value) result = { value, hAngle: data.horizontalAngles[hIndex] || 0, vAngle: data.verticalAngles[vIndex] || 0 };
      });
    });
    return result;
  }

  function draw(canvas, data, dark = true) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const cssSize = Math.max(320, Math.round(canvas.clientWidth || 560));
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(cssSize * ratio);
    canvas.height = Math.round(cssSize * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, cssSize, cssSize);
    ctx.fillStyle = dark ? '#0e1216' : '#fff';
    ctx.fillRect(0, 0, cssSize, cssSize);

    const curveList = curves(data);
    const pk = peak(data);
    const max = Math.max(pk.value, ...curveList.flatMap((curve) => curve.points.map((p) => p.value)), 1);
    const top = 92;
    const bottom = 64;
    const available = cssSize - top - bottom;
    const cx = cssSize / 2;
    const cy = top + available / 2;
    const radius = Math.max(72, Math.min(cssSize * 0.34, available / 2 - 18));

    ctx.strokeStyle = dark ? 'rgba(255,255,255,.13)' : '#222';
    ctx.lineWidth = 1;
    for (let ring = 1; ring <= 4; ring += 1) {
      ctx.beginPath();
      ctx.arc(cx, cy, radius * ring / 4, 0, Math.PI * 2);
      ctx.stroke();
    }
    for (let angle = -180; angle < 180; angle += 15) {
      const rad = angle * Math.PI / 180;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.sin(rad) * radius, cy - Math.cos(rad) * radius);
      ctx.stroke();
    }

    ctx.fillStyle = dark ? '#aeb7c2' : '#111';
    ctx.font = '12px Segoe UI, Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    [-150, -120, -90, -60, -30, 0, 30, 60, 90, 120, 150, 180].forEach((angle) => {
      const rad = angle * Math.PI / 180;
      ctx.fillText(String(angle), cx + Math.sin(rad) * (radius + 25), cy - Math.cos(rad) * (radius + 25));
    });

    [curveList[1], curveList[0]].filter(Boolean).forEach((curve) => {
      ctx.strokeStyle = curve.color;
      ctx.lineWidth = curve.color === RED ? 3.2 : 2.8;
      ctx.beginPath();
      curve.points.forEach((point, index) => {
        const rad = point.angle * Math.PI / 180;
        const r = radius * (point.value / max);
        const x = cx + Math.sin(rad) * r;
        const y = cy - Math.cos(rad) * r;
        if (index === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.stroke();
    });

    const beam = beamAngle(curveList[0]?.points || []);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = dark ? '#dce4eb' : '#111';
    ctx.font = '18px Segoe UI, Arial';
    ctx.fillText(dark ? 'Photometric distribution curves' : 'POLAR GRAPH', 28, 34);
    ctx.fillStyle = dark ? '#aeb7c2' : '#222';
    ctx.font = '13px Segoe UI, Arial';
    ctx.fillText(`Red: ${curveList[0]?.label || '-'} / Blue: ${curveList[1]?.label || '-'}`, 28, 56);
    ctx.fillText(`Beam angle: ${fmt(beam, 2)}°`, 28, 76);
    ctx.textAlign = 'right';
    ctx.fillText(`Scale max ${fmt(max, 1)} cd`, cssSize - 28, 56);
    ctx.textAlign = 'left';
    ctx.fillText(`Global peak ${fmt(pk.value, 1)} cd @ H${fmt(pk.hAngle, 1)} / V${fmt(pk.vAngle, 1)}`, 28, cssSize - 26);

    const beamLabel = $('beamLabel');
    if (dark && beamLabel) {
      beamLabel.textContent = `${data.photometricType === 2 ? 'Type B' : 'Type C'} / Red upper / Blue lower / Beam ${fmt(beam, 2)}°`;
    }
    const beamValue = $('beamValue');
    if (dark && beamValue) beamValue.textContent = `${fmt(beam, 2)}°`;
  }

  function refresh() {
    const text = $('iesPreview')?.textContent || '';
    if (!text.trim()) return;
    try {
      const data = parseIES(text);
      draw($('curveCanvas'), data, true);
      const report = $('report');
      if (report && !report.classList.contains('hidden')) draw($('reportPolar'), data, false);
    } catch (error) {}
  }

  document.addEventListener('click', (event) => {
    if (event.target && (event.target.id === 'reportBtn' || event.target.id === 'resetBtn')) setTimeout(refresh, 160);
  });
  document.addEventListener('change', (event) => {
    if (event.target && event.target.id === 'upload') setTimeout(refresh, 240);
  });
  window.addEventListener('resize', () => setTimeout(refresh, 80));
  new MutationObserver(() => setTimeout(refresh, 30)).observe($('iesPreview'), { childList: true, characterData: true, subtree: true });
  setTimeout(refresh, 120);
})();
