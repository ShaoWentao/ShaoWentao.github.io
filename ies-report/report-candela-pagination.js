(() => {
  const STATE = {
    sourceName: '',
    fileText: '',
    running: false,
    lastSignature: '',
    reading: false
  };

  function $(selector, root = document) {
    return root.querySelector(selector);
  }

  function $all(selector, root = document) {
    return Array.from(root.querySelectorAll(selector));
  }

  function num(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function fmt(value, digits = 2) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return '0';
    return String(Number(parsed.toFixed(digits)));
  }

  function candelaCellValue(value) {
    const v = Math.abs(Number(value || 0));
    if (v >= 1000) return fmt(value, 0);
    if (v >= 100) return fmt(value, 1);
    if (v >= 10) return fmt(value, 2);
    if (v >= 1) return fmt(value, 2);
    if (v > 0) return fmt(value, 2);
    return '0.00';
  }

  function tokenizePhotometricBody(text) {
    const lines = text.replace(/\r/g, '').split('\n');
    const tiltIndex = lines.findIndex((line) => /^\s*TILT\s*=/i.test(line));
    if (tiltIndex < 0) return [];
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
    const nums = tokenizePhotometricBody(text || '');
    if (nums.length < 13) return null;
    let i = 0;
    const lampCount = nums[i++];
    const lumensPerLamp = nums[i++];
    const multiplier = nums[i++];
    const verticalCount = Math.round(nums[i++]);
    const horizontalCount = Math.round(nums[i++]);
    const photometricType = Math.round(nums[i++]);
    i += 4;
    i += 3;
    if (verticalCount <= 0 || horizontalCount <= 0) return null;
    const verticalAngles = nums.slice(i, i + verticalCount); i += verticalCount;
    const horizontalAngles = nums.slice(i, i + horizontalCount); i += horizontalCount;
    const expected = verticalCount * horizontalCount;
    if (nums.length - i < expected) return null;
    const candela = [];
    for (let h = 0; h < horizontalCount; h += 1) {
      candela.push(nums.slice(i, i + verticalCount).map((value) => value * multiplier));
      i += verticalCount;
    }
    return { lampCount, lumensPerLamp, verticalAngles, horizontalAngles, photometricType, candela };
  }

  function normalizeDegrees(angle) {
    return ((angle % 360) + 360) % 360;
  }

  function sortedUnique(values) {
    return values.map(Number).filter(Number.isFinite).sort((a, b) => a - b)
      .filter((value, index, array) => index === 0 || Math.abs(value - array[index - 1]) > 0.001);
  }

  function interpolate(x0, y0, x1, y1, x) {
    if (Math.abs(x1 - x0) < 0.000001) return y0;
    const t = (x - x0) / (x1 - x0);
    return y0 + (y1 - y0) * t;
  }

  function interpolateByAngle(angles, values, target, cyclic = false) {
    if (!angles.length || !values.length) return 0;
    if (angles.length === 1) return values[0] || 0;
    const pairs = angles.map((angle, index) => ({ angle: cyclic ? normalizeDegrees(angle) : Number(angle), value: Number(values[index] || 0) }))
      .filter((item) => Number.isFinite(item.angle) && Number.isFinite(item.value))
      .sort((a, b) => a.angle - b.angle)
      .filter((item, index, array) => index === 0 || Math.abs(item.angle - array[index - 1].angle) > 0.001);
    if (!pairs.length) return 0;
    let x = cyclic ? normalizeDegrees(target) : Number(target);
    if (!Number.isFinite(x)) return 0;
    if (!cyclic) {
      if (x <= pairs[0].angle) return pairs[0].value;
      if (x >= pairs[pairs.length - 1].angle) return pairs[pairs.length - 1].value;
    } else if (x < pairs[0].angle) {
      x += 360;
    }
    for (let i = 0; i < pairs.length - 1; i += 1) {
      const a = pairs[i];
      const b = pairs[i + 1];
      if (x >= a.angle && x <= b.angle) return interpolate(a.angle, a.value, b.angle, b.value, x);
    }
    if (cyclic) {
      const a = pairs[pairs.length - 1];
      const b = { angle: pairs[0].angle + 360, value: pairs[0].value };
      return interpolate(a.angle, a.value, b.angle, b.value, x);
    }
    return pairs[pairs.length - 1].value;
  }

  function mapTypeCAngle(data, cAngle) {
    const values = sortedUnique(data.horizontalAngles || []);
    if (values.length <= 1) return values[0] || 0;
    const min = values[0];
    const max = values[values.length - 1];
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

  function intensityAt(data, cAngle, gamma) {
    const g = Math.abs(num(gamma));
    const vertical = (data.verticalAngles || []).map((angle) => Math.abs(num(angle)));
    const planeValues = (data.candela || []).map((profile) => interpolateByAngle(vertical, profile, g, false));
    if (!planeValues.length) return 0;
    if ((data.horizontalAngles || []).length <= 1) return Math.max(0, planeValues[0] || 0);
    const c = data.photometricType === 1 ? mapTypeCAngle(data, cAngle) : cAngle;
    const span = Math.max(...data.horizontalAngles) - Math.min(...data.horizontalAngles);
    return Math.max(0, interpolateByAngle(data.horizontalAngles, planeValues, c, span >= 359));
  }

  function targetCPlanes(data) {
    const source = sortedUnique(data.horizontalAngles || []);
    if (source.length <= 1) return [0];
    return source;
  }

  function cloneOuter(selector, sourcePage) {
    const node = $(selector, sourcePage);
    return node ? node.outerHTML : '';
  }

  function buildFallbackFooter() {
    const first = $('.footer-data');
    return first ? first.outerHTML : '<footer class="footer-data report-footer-data"></footer>';
  }

  function buildCandelaTable(data, gammaRows, planes, pageIndex, pageCount) {
    const blankCount = Math.max(0, 14 - planes.length);
    const blankHeads = Array.from({ length: blankCount }, () => '<th class="blank-col"></th>').join('');
    const emptyCells = Array.from({ length: blankCount }, () => '<td class="blank-col"></td>').join('');
    const rows = gammaRows.map((angle) => {
      const cells = planes.map((target) => `<td>${candelaCellValue(intensityAt(data, target, angle))}</td>`).join('');
      return `<tr><td class="gamma-col">${fmt(angle, Math.abs(angle % 1) > 0.001 ? 1 : 0)}</td>${cells}${emptyCells}</tr>`;
    }).join('');
    return `
      <div class="candela-caption-row"><span>Table--${pageIndex}${pageCount > 1 ? ` / ${pageCount}` : ''}</span><span>UNIT:&nbsp; cd</span></div>
      <div class="candela-table-frame">
        <table class="simple-table candela-distribution-table candela-auto-table">
          <tr><th class="gamma-col">C(DEG)</th>${planes.map((target) => `<th>${fmt(target, Math.abs(target % 1) > 0.001 ? 1 : 0)}</th>`).join('')}${blankHeads}</tr>
          <tr><th class="gamma-col">γ (DEG)</th>${Array.from({ length: planes.length + blankCount }, () => '<th></th>').join('')}</tr>
          ${rows}
        </table>
      </div>`;
  }

  function getCandelaSourceData(sourcePage) {
    const parsed = parseIES(STATE.fileText);
    if (parsed) return parsed;
    const table = $('.candela-distribution-table', sourcePage);
    if (!table) return null;
    const headerCells = $all('tr:first-child th', table).slice(1).map((cell) => cell.textContent.trim()).filter(Boolean).map(Number).filter(Number.isFinite);
    const bodyRows = $all('tr', table).slice(2).filter((row) => row.querySelector('.gamma-col') && row.querySelector('.gamma-col').textContent.trim() !== '');
    const verticalAngles = bodyRows.map((row) => num(row.querySelector('.gamma-col').textContent.trim(), NaN)).filter(Number.isFinite);
    const candela = headerCells.map((_, planeIndex) => bodyRows.map((row) => num($all('td', row)[planeIndex + 1]?.textContent, 0)));
    return { verticalAngles, horizontalAngles: headerCells, photometricType: 1, candela };
  }

  function isEmbeddedMode() {
    return /(?:\?|&)embedded=1(?:&|$)/.test(window.location.search || '');
  }

  function hasPendingIESFile() {
    const input = document.getElementById('iesFile');
    return !!(input && input.files && input.files[0]);
  }

  function updatePageNumbers() {
    const papers = $all('.paper');
    const total = papers.length;
    const totalInput = document.getElementById('pageTotal');
    if (totalInput) totalInput.value = String(total);
    papers.forEach((paper, index) => {
      const pageNo = $('.page-no', paper);
      if (!pageNo) return;
      if (document.body.classList.contains('report-lang-zh')) pageNo.textContent = `第 ${index + 1} 页　共 ${total} 页`;
      else pageNo.textContent = `Page ${index + 1} Of ${total}`;
    });
  }

  function rowsPerCandelaPage(planes) {
    if (planes.length > 18) return 24;
    if (planes.length > 12) return 28;
    return 32;
  }

  function paginateCandelaTable() {
    if (STATE.running) return;
    if (!STATE.fileText && (STATE.reading || isEmbeddedMode() || hasPendingIESFile())) {
      if (hasPendingIESFile() && !STATE.reading) readCurrentFile();
      return;
    }
    const sourcePage = $('.candela-page:not(.candela-auto-page)');
    if (!sourcePage) return;
    const sourceTable = $('.candela-distribution-table', sourcePage);
    if (!sourceTable) return;
    const data = getCandelaSourceData(sourcePage);
    if (!data || !data.verticalAngles || !data.verticalAngles.length) return;
    const planes = targetCPlanes(data);
    const gammas = sortedUnique(data.verticalAngles.map((angle) => Math.abs(angle)));
    const signature = `${gammas.length}|${planes.join(',')}|${STATE.fileText.length}|${document.body.className}`;
    if (sourcePage.dataset.candelaPaginated === signature) return;
    STATE.running = true;
    try {
      $all('.candela-auto-page').forEach((page) => page.remove());
      const header = cloneOuter('.report-head', sourcePage);
      const info = cloneOuter('.luminance-info-table', sourcePage);
      const footer = cloneOuter('.report-footer-data', sourcePage) || cloneOuter('.footer-data', sourcePage) || buildFallbackFooter();
      const titleText = $('.page-title', sourcePage)?.textContent || 'LUMINOUS DISTRIBUTION INTENSITY DATA';
      const rowsPerPage = rowsPerCandelaPage(planes);
      const chunks = [];
      for (let i = 0; i < gammas.length; i += rowsPerPage) chunks.push(gammas.slice(i, i + rowsPerPage));
      const pages = chunks.map((chunk, index) => {
        const continuation = index === 0 ? '' : ' <span class="candela-continuation">(Continued)</span>';
        return `<article class="paper compact-page candela-page candela-auto-page">
          ${header}
          <h2 class="page-title">${titleText}${continuation}</h2>
          ${info}
          <div class="candela-auto-content">
            ${buildCandelaTable(data, chunk, planes, index + 1, chunks.length)}
          </div>
          ${footer}
        </article>`;
      }).join('');
      sourcePage.insertAdjacentHTML('afterend', pages);
      sourcePage.remove();
      const firstAuto = $('.candela-auto-page');
      if (firstAuto) firstAuto.dataset.candelaPaginated = signature;
      updatePageNumbers();
    } finally {
      STATE.running = false;
    }
  }

  function schedulePaginate(delay = 180) {
    window.clearTimeout(schedulePaginate.timer);
    schedulePaginate.timer = window.setTimeout(paginateCandelaTable, delay);
  }

  function readCurrentFile() {
    const input = document.getElementById('iesFile');
    const file = input && input.files && input.files[0];
    if (!file) return;
    STATE.reading = true;
    STATE.sourceName = file.name || '';
    const reader = new FileReader();
    reader.onload = () => {
      STATE.fileText = String(reader.result || '');
      STATE.reading = false;
      schedulePaginate(300);
    };
    reader.onerror = () => {
      STATE.reading = false;
      schedulePaginate(300);
    };
    reader.readAsText(file);
  }

  function init() {
    injectStyle();
    const input = document.getElementById('iesFile');
    if (input) input.addEventListener('change', () => {
      STATE.fileText = '';
      readCurrentFile();
      schedulePaginate(600);
    });
    readCurrentFile();
    const target = document.getElementById('extraPages') || document.body;
    const observer = new MutationObserver(() => schedulePaginate(220));
    observer.observe(target, { childList: true, subtree: true });
    window.addEventListener('beforeprint', () => {
      paginateCandelaTable();
      updatePageNumbers();
    });
    schedulePaginate(800);
  }

  function injectStyle() {
    if (document.getElementById('candela-pagination-style')) return;
    const style = document.createElement('style');
    style.id = 'candela-pagination-style';
    style.textContent = `
      .candela-auto-page { position: relative; display:flex; flex-direction:column; height:1358px; min-height:1358px; max-height:1358px; overflow:hidden; }
      .candela-auto-page .report-head { flex:0 0 auto; }
      .candela-auto-page .page-title { flex:0 0 auto; margin:18px 0 9px; font-size:17px; letter-spacing:0; text-indent:0; white-space:nowrap; }
      .candela-auto-page .luminance-info-table { flex:0 0 auto; margin-bottom:6px; font-size:8px; }
      .candela-auto-page .luminance-info-table td { padding:3px 5px; }
      .candela-auto-content { flex:1 1 auto; min-height:0; overflow:hidden; display:flex; flex-direction:column; }
      .candela-caption-row { flex:0 0 auto; margin:0 0 3px; }
      .candela-table-frame { flex:1 1 auto; min-height:0; overflow:hidden; }
      .candela-auto-page .report-footer-data, .candela-auto-page .footer-data { flex:0 0 auto; margin-top:auto; padding-top:8px; font-size:9.5px; line-height:1.18; }
      .candela-continuation { font-size:12px; letter-spacing:0; }
      .candela-auto-table { table-layout:fixed; font-family:"Courier New", Courier, monospace; font-size:7.0px; line-height:1.0; border:1.2px solid #000; }
      .candela-auto-table th, .candela-auto-table td { border:1px solid #000; padding:1px 0.8px; height:11.2px; text-align:center; vertical-align:middle; white-space:nowrap; }
      .candela-auto-table .gamma-col { width:48px; }
      .candela-auto-table .blank-col { color:transparent; }
      @media print {
        .paper.candela-auto-page { box-sizing:border-box !important; display:flex !important; flex-direction:column !important; width:210mm !important; height:297mm !important; min-height:297mm !important; max-height:297mm !important; overflow:hidden !important; page-break-inside:avoid !important; break-inside:avoid-page !important; }
        .candela-auto-page .page-title { margin:12px 0 7px !important; font-size:14px !important; }
        .candela-auto-page .luminance-info-table { margin-bottom:5px !important; font-size:7.2px !important; }
        .candela-auto-page .luminance-info-table td { padding:2.2px 4px !important; }
        .candela-caption-row { margin-bottom:2px !important; }
        .candela-auto-page .report-footer-data, .candela-auto-page .footer-data { margin-top:auto !important; padding-top:6px !important; font-size:8.4px !important; line-height:1.12 !important; }
        .candela-auto-table { font-size:6.25px !important; line-height:1 !important; }
        .candela-auto-table th, .candela-auto-table td { padding:0.7px 0.5px !important; height:9.65px !important; }
      }
    `;
    document.head.appendChild(style);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
