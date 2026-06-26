(() => {
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
      @media (max-width:700px) { .ugr-standard-table { font-size:13px; min-width:820px; } }
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

  function maxCandela(data) {
    let max = 0;
    data.candela.forEach((profile) => profile.forEach((value) => { max = Math.max(max, value || 0); }));
    return max;
  }

  function highAngleCandela(data) {
    let sum = 0;
    let weight = 0;
    let max = 0;
    data.candela.forEach((profile) => {
      profile.forEach((value, index) => {
        const angle = Math.abs(data.verticalAngles[index] || 0);
        if (angle >= 55 && angle <= 90) {
          const w = Math.max(0.08, Math.sin(angle * Math.PI / 180));
          sum += Math.max(0, value) * w;
          weight += w;
          max = Math.max(max, value || 0);
        }
      });
    });
    return { avg: weight > 0 ? sum / weight : 0, max };
  }

  function luminousArea(data) {
    const candidates = [
      Math.abs((data.width || 0) * (data.length || 0)),
      Math.abs((data.width || 0) * (data.height || 0)),
      Math.abs((data.length || 0) * (data.height || 0))
    ].filter((value) => value > 0);
    return candidates.length ? Math.max(...candidates) : 0.01;
  }

  function beamEstimate(data) {
    const firstPlane = data.candela[0] || [];
    const peak = Math.max(...firstPlane, 0);
    if (!peak) return 60;
    const half = peak / 2;
    for (let i = 0; i < firstPlane.length - 1; i += 1) {
      if (firstPlane[i] >= half && firstPlane[i + 1] <= half) {
        const a = Math.abs(data.verticalAngles[i] || 0);
        const b = Math.abs(data.verticalAngles[i + 1] || a);
        const v1 = firstPlane[i];
        const v2 = firstPlane[i + 1];
        const ratio = Math.abs(v2 - v1) > 0.0001 ? (half - v1) / (v2 - v1) : 0;
        return Math.max(1, Math.abs((a + (b - a) * ratio) * 2));
      }
    }
    return 60;
  }

  function glareBase(data) {
    const peak = Math.max(1, maxCandela(data));
    const high = highAngleCandela(data);
    const area = Math.max(0.0001, luminousArea(data));
    const beam = beamEstimate(data);
    const highRatio = high.avg > 0 ? high.avg / peak : 0.006 + Math.min(0.08, beam / 1200);
    const luminanceTerm = Math.log10(peak / Math.sqrt(area) + 10);
    return Math.max(2, Math.min(24, 1.58 * luminanceTerm + 9.5 * highRatio - Math.max(0, 18 - beam) * 0.035));
  }

  const reflectanceSets = [
    { ceil: '0.7', wall: '0.5', plane: '0.2', offset: 0.0 },
    { ceil: '0.7', wall: '0.3', plane: '0.2', offset: 0.5 },
    { ceil: '0.5', wall: '0.5', plane: '0.2', offset: 0.2 },
    { ceil: '0.5', wall: '0.3', plane: '0.2', offset: 0.7 },
    { ceil: '0.3', wall: '0.3', plane: '0.2', offset: 0.8 }
  ];

  const roomRows = [
    { x: '2H', y: '2H', dx: 0.0 }, { x: '', y: '3H', dx: -0.1 }, { x: '', y: '4H', dx: -0.2 }, { x: '', y: '6H', dx: -0.3 }, { x: '', y: '8H', dx: -0.3 }, { x: '', y: '12H', dx: -0.3 },
    { spacer: true },
    { x: '4H', y: '2H', dx: -0.2 }, { x: '', y: '3H', dx: -0.3 }, { x: '', y: '4H', dx: -0.4 }, { x: '', y: '6H', dx: -0.5 }, { x: '', y: '8H', dx: -0.6 }, { x: '', y: '12H', dx: -0.7 },
    { spacer: true },
    { x: '8H', y: '4H', dx: -0.6 }, { x: '', y: '6H', dx: -0.7 }, { x: '', y: '8H', dx: -0.8 }, { x: '', y: '12H', dx: -0.9 },
    { spacer: true },
    { x: '12H', y: '4H', dx: -0.7 }, { x: '', y: '6H', dx: -0.8 }, { x: '', y: '8H', dx: -0.9 }
  ];

  function valueFor(data, row, set, endwise = false) {
    const base = glareBase(data);
    const orientationOffset = endwise ? -1.4 : 0;
    const shapeTerm = endwise ? Math.max(-0.2, row.dx * 0.7) : row.dx;
    return Math.max(0, base + set.offset + orientationOffset + shapeTerm);
  }

  function roomRowsHtml(data) {
    return roomRows.map((row) => {
      if (row.spacer) return `<tr class="spacer"><td></td><td></td><td colspan="10"></td></tr>`;
      const cross = reflectanceSets.map((set) => `<td>${fmt(valueFor(data, row, set, false), 1)}</td>`).join('');
      const end = reflectanceSets.map((set, index) => `<td${index === 0 ? ' class="mid-split"' : ''}>${fmt(valueFor(data, row, set, true), 1)}</td>`).join('');
      return `<tr><td class="left-label">${row.x || ''}</td><td class="y-label">${row.y}</td>${cross}${end}</tr>`;
    }).join('');
  }

  function variationValue(data, spacing, endwise = false) {
    const base = glareBase(data);
    const plus = base * (spacing === 1 ? 0.52 : spacing === 1.5 ? 0.84 : 1.40);
    const minus = Math.max(0.8, base * 0.18);
    return `+ ${fmt(plus, 1)} / - ${fmt(minus, 1)}`;
  }

  function buildStandardUGRTable(data) {
    const ceilings = reflectanceSets.map((set) => `<td>${set.ceil}</td>`).join('');
    const walls = reflectanceSets.map((set) => `<td>${set.wall}</td>`).join('');
    const planes = reflectanceSets.map((set) => `<td>${set.plane}</td>`).join('');
    return `
      <table class="ugr-standard-table">
        <tbody>
          <tr><th colspan="2">ceiling/cavity</th>${ceilings}${reflectanceSets.map((set, index) => `<td${index === 0 ? ' class="mid-split"' : ''}>${set.ceil}</td>`).join('')}</tr>
          <tr><th colspan="2">walls</th>${walls}${reflectanceSets.map((set, index) => `<td${index === 0 ? ' class="mid-split"' : ''}>${set.wall}</td>`).join('')}</tr>
          <tr><th colspan="2">working plane</th>${planes}${reflectanceSets.map((set, index) => `<td${index === 0 ? ' class="mid-split"' : ''}>${set.plane}</td>`).join('')}</tr>
          <tr class="section-title"><th colspan="2">Room dimensions</th><th colspan="5">Viewed crosswise</th><th class="mid-split" colspan="5">Viewed endwise</th></tr>
          <tr><th class="left-label">x = 2H</th><th class="y-label">y =</th><td colspan="5"></td><td class="mid-split" colspan="5"></td></tr>
          ${roomRowsHtml(data)}
          <tr class="variation-title"><td colspan="12">Variations with the observer position at spacings:</td></tr>
          <tr><td class="variation-left" colspan="2">s = 1.0H</td><td class="variation-mid" colspan="5">${variationValue(data, 1, false)}</td><td colspan="5">${variationValue(data, 1, true)}</td></tr>
          <tr><td class="variation-left" colspan="2">1.5H</td><td class="variation-mid" colspan="5">${variationValue(data, 1.5, false)}</td><td colspan="5">${variationValue(data, 1.5, true)}</td></tr>
          <tr><td class="variation-left" colspan="2">2.0H</td><td class="variation-mid" colspan="5">${variationValue(data, 2, false)}</td><td colspan="5">${variationValue(data, 2, true)}</td></tr>
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
      target.textContent = `Unable to calculate UGR - ${error.message || error}`;
    }
  }

  document.addEventListener('click', (event) => {
    if (event.target && event.target.id === 'reportBtn') setTimeout(refreshUGR, 100);
  });
  document.addEventListener('change', (event) => {
    if (event.target && event.target.id === 'upload') setTimeout(refreshUGR, 200);
  });
  const report = $('report');
  if (report) new MutationObserver(() => setTimeout(refreshUGR, 30)).observe(report, { attributes: true, childList: true, subtree: true });
})();
