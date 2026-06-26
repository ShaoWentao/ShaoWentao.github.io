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
      .ugr-status { border:1px solid #222; background:#fff; color:#000; padding:18px 20px; font-family:Consolas, "Courier New", monospace; font-size:13px; line-height:1.55; }
      .ugr-status strong { display:block; margin-bottom:8px; font-size:14px; }
      .ugr-status table { width:100%; border-collapse:collapse; margin-top:12px; font-family:Consolas, "Courier New", monospace; font-size:12px; }
      .ugr-status th, .ugr-status td { border-top:1px solid #ddd; padding:6px 8px; text-align:left; }
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

  function luminousArea(data) {
    const candidates = [
      Math.abs((data.width || 0) * (data.length || 0)),
      Math.abs((data.width || 0) * (data.height || 0)),
      Math.abs((data.length || 0) * (data.height || 0))
    ].filter((value) => value > 0);
    return candidates.length ? Math.max(...candidates) : 0;
  }

  function buildUGRStatus(data) {
    const peak = maxCandela(data);
    const offending = offendingZoneCandela(data);
    const area = luminousArea(data);
    const noOffendingCandela = offending.max <= Math.max(0.01, peak * 0.0005);

    if (noOffendingCandela) {
      return `
        <div class="ugr-status">
          <strong>Unable to calculate UGR - No candela in offending zones</strong>
          <table>
            <tr><th>Maximum Candela</th><td>${fmt(peak, 1)} cd</td></tr>
            <tr><th>Offending-zone Candela</th><td>${fmt(offending.max, 3)} cd max / ${fmt(offending.avg, 3)} cd avg</td></tr>
            <tr><th>Checked Vertical Zone</th><td>55° to 90°</td></tr>
          </table>
        </div>
      `;
    }

    return `
      <div class="ugr-status">
        <strong>UGR table withheld - standard calculation module required</strong>
        <div>The previous table values were removed because they were generated by an estimated glare model, not by the standard UGR tabular method.</div>
        <table>
          <tr><th>Maximum Candela</th><td>${fmt(peak, 1)} cd</td></tr>
          <tr><th>Offending-zone Candela</th><td>${fmt(offending.max, 3)} cd max / ${fmt(offending.avg, 3)} cd avg</td></tr>
          <tr><th>Luminous Area</th><td>${area > 0 ? `${fmt(area, 6)} m²` : 'Not available'}</td></tr>
          <tr><th>Required for valid UGR</th><td>Room dimensions, luminaire layout, observer direction, reflectance set, background luminance and Guth position index.</td></tr>
        </table>
      </div>
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
      target.innerHTML = buildUGRStatus(data);
    } catch (error) {
      target.innerHTML = `<div class="ugr-status"><strong>Unable to calculate UGR</strong>${String(error.message || error)}</div>`;
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
