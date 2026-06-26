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
    return { lampCount, lumensPerLamp, photometricType, unitsType, width, length, height, power, verticalAngles, horizontalAngles, candela };
  }

  function highAngleStats(data) {
    let peak = 0;
    let highPeak = 0;
    let weighted = 0;
    let weight = 0;
    data.candela.forEach((profile) => {
      profile.forEach((value, index) => {
        const angle = Math.abs(data.verticalAngles[index] || 0);
        peak = Math.max(peak, value);
        if (angle >= 55 && angle <= 90 && value > 0.01) {
          const w = Math.max(0.01, Math.sin(angle * Math.PI / 180));
          highPeak = Math.max(highPeak, value);
          weighted += value * w;
          weight += w;
        }
      });
    });
    return { peak, highPeak, highAverage: weight > 0 ? weighted / weight : 0 };
  }

  function luminousArea(data) {
    const candidates = [
      Math.abs((data.width || 0) * (data.length || 0)),
      Math.abs((data.width || 0) * (data.height || 0)),
      Math.abs((data.length || 0) * (data.height || 0))
    ].filter((value) => value > 0);
    return candidates.length ? Math.max(...candidates) : 0;
  }

  function standardUgrValue(data, roomX, roomY, reflectance) {
    const stats = highAngleStats(data);
    const area = luminousArea(data);
    if (stats.highPeak <= 0.01 || stats.peak <= 0) return null;
    const [rc, rw, rf] = reflectance.split('/').map(Number);
    const reflectanceFactor = Math.max(0.35, (rc * 0.45 + rw * 0.45 + rf * 0.10) / 100);
    const roomFactor = Math.sqrt((roomX * roomY) / 16);
    const positionIndex = Math.max(1.15, 1.45 + Math.abs(roomX - roomY) * 0.035);
    const apparentArea = area > 0 ? area : 0.01;
    const luminance = stats.highAverage / apparentArea;
    const solidAngle = Math.min(0.12, Math.max(0.00005, apparentArea / (2.5 * 2.5)));
    const backgroundLuminance = 60 * reflectanceFactor * Math.max(0.65, roomFactor);
    const glareSum = (luminance * luminance * solidAngle * roomFactor) / (positionIndex * positionIndex);
    const value = 8 * Math.log10(Math.max(1.0001, 0.25 * glareSum / Math.max(1, backgroundLuminance)));
    return Math.max(0, Math.min(35, value));
  }

  function buildStandardTable(data) {
    const stats = highAngleStats(data);
    if (stats.highPeak <= 0.01) return 'Unable to calculate UGR - No candela in offending zones';

    const reflectanceSets = ['70/50/20', '70/30/20', '50/50/20', '50/30/20', '30/30/20', '0/0/20'];
    const roomSizes = [2, 4, 8, 12];
    const lines = [];
    lines.push('UGR TABLE - STANDARD CONDITIONS');
    lines.push('Reflectance format: Ceiling / Wall / Floor');
    lines.push('Room size format: XH x YH, where H is mounting height above eye level');
    lines.push('');
    reflectanceSets.forEach((reflectance) => {
      lines.push(`Reflectance ${reflectance}`);
      lines.push(`XH/YH      ${roomSizes.map((size) => String(size).padStart(5, ' ')).join('')}`);
      roomSizes.forEach((x) => {
        const row = roomSizes.map((y) => {
          const value = standardUgrValue(data, x, y, reflectance);
          return value === null ? '  -  ' : String(Math.round(value)).padStart(5, ' ');
        }).join('');
        lines.push(`${String(x).padStart(5, ' ')}      ${row}`);
      });
      lines.push('');
    });
    lines.push('Note: This browser table uses standard report conditions and the IES high-angle candela data.');
    lines.push('For final certification, use a validated photometric report engine.');
    return lines.join('\n');
  }

  function refreshUGR() {
    const report = $('report');
    const target = $('reportUGR');
    const preview = $('iesPreview');
    if (!report || !target || !preview || report.classList.contains('hidden')) return;
    const text = preview.textContent || '';
    if (!text.trim()) return;
    try {
      target.textContent = buildStandardTable(parseIES(text));
    } catch (error) {
      target.textContent = `Unable to calculate UGR - ${error.message || error}`;
    }
  }

  document.addEventListener('click', (event) => {
    if (event.target && event.target.id === 'reportBtn') setTimeout(refreshUGR, 80);
  });
  document.addEventListener('change', (event) => {
    if (event.target && event.target.id === 'upload') setTimeout(refreshUGR, 180);
  });
  const report = $('report');
  if (report) {
    new MutationObserver(() => setTimeout(refreshUGR, 20)).observe(report, { attributes: true, childList: true, subtree: true });
  }
})();
