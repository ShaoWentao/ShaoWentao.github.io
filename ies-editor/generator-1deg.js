(() => {
  const $ = (id) => document.getElementById(id);
  const verticalAngles = Array.from({ length: 181 }, (_, i) => i);
  const simpleHorizontal = [0];
  const advancedHorizontal = [0, 90, 180, 270];
  let initialized = false;

  function num(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function fmt(value, digits = 4) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return '0';
    return String(Number(parsed.toFixed(digits)));
  }

  function safeName(value) {
    return String(value || 'luminaire').replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '') || 'luminaire';
  }

  function wrapNumbers(values, perLine = 10) {
    const lines = [];
    for (let i = 0; i < values.length; i += perLine) lines.push(values.slice(i, i + perLine).join(' '));
    return lines.join('\n');
  }

  function formData() {
    return {
      manufacturer: $('manufacturer')?.value.trim() || 'CDN',
      serial: $('serial')?.value.trim() || 'spot01',
      date: $('date')?.value.trim() || new Date().toISOString().slice(0, 10).replaceAll('-', ''),
      ledCount: Math.max(1, Math.round(num($('ledCount')?.value, 1))),
      singleFlux: Math.max(0.01, num($('singleFlux')?.value, 1000)),
      beamAngle: Math.min(120, Math.max(0.01, num($('beamAngle')?.value, 36))),
      beamAngleC90: Math.min(120, Math.max(0.01, num($('beamAngleC90')?.value, num($('beamAngle')?.value, 36)))),
      efficiency: Math.min(1, Math.max(0.01, num($('efficiency')?.value, 1))),
      length: Math.max(0, num($('length')?.value, 0.1)),
      width: Math.max(0, num($('width')?.value, 0.1)),
      height: Math.max(0, num($('height')?.value, 0.1)),
      power: Math.max(0.01, num($('power')?.value, 10)),
      generationMode: $('generationMode')?.value || 'simple',
      symmetryMode: $('iesType')?.value || 'symmetric',
      distributionShape: $('distributionShape')?.value || 'lambertian',
      notes: $('notes')?.value.trim() || ''
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
    return verticalAngles.map((angle) => rawIntensity(angle, beamAngle, shape));
  }

  function scaleProfilesToFlux(profiles, data) {
    let integral = 0;
    for (let i = 0; i < verticalAngles.length - 1; i += 1) {
      const a1 = verticalAngles[i] * Math.PI / 180;
      const a2 = verticalAngles[i + 1] * Math.PI / 180;
      const v1 = profiles.reduce((sum, profile) => sum + (profile[i] || 0), 0) / profiles.length;
      const v2 = profiles.reduce((sum, profile) => sum + (profile[i + 1] || 0), 0) / profiles.length;
      integral += ((v1 * Math.sin(a1) + v2 * Math.sin(a2)) / 2) * (a2 - a1);
    }
    const luminaireFlux = data.ledCount * data.singleFlux * data.efficiency;
    const scale = luminaireFlux / Math.max(0.0001, 2 * Math.PI * integral);
    return profiles.map((profile) => profile.map((value) => value * scale));
  }

  function simpleCandelaFor(data) {
    const c0Raw = rawProfile(data.beamAngle, data.distributionShape);
    if (data.symmetryMode !== 'four-plane') return scaleProfilesToFlux([c0Raw], data);
    const c90Raw = rawProfile(data.beamAngleC90 || data.beamAngle, data.distributionShape);
    const scaled = scaleProfilesToFlux([c0Raw, c90Raw], data);
    return [scaled[0], scaled[1], scaled[0].slice(), scaled[1].slice()];
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
    const source = rows.map((row) => ({ angle: row.angle, value: Math.max(0, row[key]) }));
    const xs = source.map((point) => point.angle);
    const ys = source.map((point) => point.value);
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
    return verticalAngles.map((angle) => {
      if (angle <= xs[0]) return ys[0];
      for (let i = 0; i < xs.length - 1; i += 1) {
        if (angle <= xs[i + 1]) {
          const span = Math.max(0.0001, xs[i + 1] - xs[i]);
          const t = (angle - xs[i]) / span;
          const h00 = 2 * t * t * t - 3 * t * t + 1;
          const h10 = t * t * t - 2 * t * t + t;
          const h01 = -2 * t * t * t + 3 * t * t;
          const h11 = t * t * t - t * t;
          return Math.max(0, h00 * ys[i] + h10 * span * slopes[i] + h01 * ys[i + 1] + h11 * span * slopes[i + 1]);
        }
      }
      return ys[ys.length - 1];
    });
  }

  function advancedCandelaFor() {
    const rows = advancedRows();
    const c0 = smoothAdvancedProfile(rows, 'c0');
    if (($('iesType')?.value || 'symmetric') !== 'four-plane') return [c0];
    const c90 = smoothAdvancedProfile(rows, 'c90');
    return [c0, c90, c0.slice(), c90.slice()];
  }

  function photometryFor(data) {
    if (data.generationMode === 'advanced') {
      return {
        horizontalAngles: data.symmetryMode === 'four-plane' ? advancedHorizontal : simpleHorizontal,
        candela: advancedCandelaFor(),
        modeLabel: data.symmetryMode === 'four-plane' ? 'Advanced angle table / C0-C90-C180-C270' : 'Advanced angle table / C0-C180 symmetric'
      };
    }
    const simpleCandela = simpleCandelaFor(data);
    return {
      horizontalAngles: data.symmetryMode === 'four-plane' ? advancedHorizontal : simpleHorizontal,
      candela: simpleCandela,
      modeLabel: `${data.symmetryMode === 'four-plane' ? 'C0-C90-C180-C270' : 'C0-C180 symmetric'} / ${distributionShapeName(data.distributionShape)}`
    };
  }

  function buildIES(data, photometry) {
    return [
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
      [data.ledCount, fmt(data.singleFlux, 4), 1, verticalAngles.length, photometry.horizontalAngles.length, 1, 2, fmt(data.width, 4), fmt(data.length, 4), fmt(data.height, 4)].join(' '),
      `1 1 ${fmt(data.power, 4)}`,
      wrapNumbers(verticalAngles.map((angle) => fmt(angle, 2))),
      wrapNumbers(photometry.horizontalAngles.map((angle) => fmt(angle, 2))),
      wrapNumbers(photometry.candela.flat().map((value) => fmt(value, 4)), 8),
      ''
    ].join('\n');
  }

  function generatedFileName(data) {
    return `${safeName(data.manufacturer)}-${safeName(data.serial)}.ies`;
  }

  function hasUploadedFile() {
    const upload = $('upload');
    return !!(upload && upload.files && upload.files.length);
  }

  function updateGeneratedIES1Degree() {
    if (hasUploadedFile()) return;
    const preview = $('iesPreview');
    if (!preview) return;
    const data = formData();
    const photometry = photometryFor(data);
    preview.textContent = buildIES(data, photometry);
    const fileName = $('fileName');
    if (fileName) fileName.textContent = generatedFileName(data);
  }

  function downloadGeneratedIES(event) {
    if (hasUploadedFile()) return;
    updateGeneratedIES1Degree();
    const preview = $('iesPreview');
    if (!preview || !preview.textContent.trim()) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const data = formData();
    const blob = new Blob([preview.textContent], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = generatedFileName(data);
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(link.href);
  }

  function init() {
    if (initialized) return;
    initialized = true;
    const form = $('iesForm');
    if (form) form.addEventListener('input', () => setTimeout(updateGeneratedIES1Degree, 0));
    const reportBtn = $('reportBtn');
    if (reportBtn) reportBtn.addEventListener('click', () => setTimeout(updateGeneratedIES1Degree, 0));
    const downloadBtn = $('downloadBtn');
    if (downloadBtn) downloadBtn.addEventListener('click', downloadGeneratedIES, true);
    setTimeout(updateGeneratedIES1Degree, 0);
  }

  window.iesGenerateOneDegree = updateGeneratedIES1Degree;

  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
