(() => {
  const $ = (id) => document.getElementById(id);

  const copy = {
    en: {
      shape: 'Luminous surface shape',
      rectangular: 'Square / Rectangular',
      circular: 'Circular',
      diameter: 'Diameter of luminous surface (m)'
    },
    zh: {
      shape: '发光面形状',
      rectangular: '方形 / 矩形',
      circular: '圆形',
      diameter: '发光面直径（m）'
    }
  };

  function currentLanguage() {
    if (window.iesEditorLanguage === 'zh' || window.iesEditorLanguage === 'en') return window.iesEditorLanguage;
    const selected = $('languageSelect') && $('languageSelect').value;
    if (selected === 'zh' || selected === 'en') return selected;
    return (document.documentElement.lang || '').toLowerCase().startsWith('zh') ? 'zh' : 'en';
  }

  function setLabel(forId, text) {
    const label = document.querySelector(`label[for="${forId}"]`);
    if (label) label.textContent = text;
  }

  function applyLanguage() {
    const lang = currentLanguage();
    const t = copy[lang] || copy.en;
    setLabel('surfaceShape', t.shape);
    setLabel('diameter', t.diameter);
    const shape = $('surfaceShape');
    if (shape) {
      const rectangular = shape.querySelector('option[value="rectangular"]');
      const circular = shape.querySelector('option[value="circular"]');
      if (rectangular) rectangular.textContent = t.rectangular;
      if (circular) circular.textContent = t.circular;
    }
  }

  function syncDimensionsFromShape(dispatch = false) {
    const shape = $('surfaceShape');
    const rectangularFields = $('rectangularSurfaceFields');
    const circularFields = $('circularSurfaceFields');
    const diameter = $('diameter');
    const length = $('length');
    const width = $('width');
    if (!shape) return;

    const isCircular = shape.value === 'circular';
    if (rectangularFields) rectangularFields.hidden = isCircular;
    if (circularFields) circularFields.hidden = !isCircular;

    if (isCircular && diameter && length && width) {
      const d = Number(diameter.value);
      const safeDiameter = Number.isFinite(d) && d > 0 ? d : 0.045;
      length.value = String(safeDiameter);
      width.value = String(safeDiameter);
    }

    if (dispatch && length) {
      length.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }

  function loadScriptOnce(src, key) {
    if (document.querySelector(`script[data-${key}="true"]`)) return;
    const script = document.createElement('script');
    script.src = src;
    script.dataset[key] = 'true';
    document.body.appendChild(script);
  }

  function bind() {
    const shape = $('surfaceShape');
    const diameter = $('diameter');
    if (shape) shape.addEventListener('change', () => syncDimensionsFromShape(true));
    if (diameter) diameter.addEventListener('input', () => syncDimensionsFromShape(true));
    applyLanguage();
    syncDimensionsFromShape(false);
    loadScriptOnce('generator-1deg.js', 'generatorOneDegree');
    loadScriptOnce('ldt-export.js', 'ldtExport');
  }

  window.addEventListener('DOMContentLoaded', bind);
  window.addEventListener('ies-language-change', () => {
    applyLanguage();
    syncDimensionsFromShape(false);
  });
})();
