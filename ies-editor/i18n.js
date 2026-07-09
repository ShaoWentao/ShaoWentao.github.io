(() => {
  const STORAGE_KEY = 'ies-editor-language';
  const DEFAULT_LANG = 'en';
  const MAINLAND_CHINA = 'CN';

  const text = {
    en: {
      docTitle: 'IES Editor | Shao Wentao',
      brandTitle: 'IES Editor',
      brandSub: 'Browser photometric file tool',
      navHome: 'Home',
      navGenerate: 'Generate',
      navPreview: 'Preview',
      navReport: 'IES Report',
      eyebrow: 'Photometric file generator',
      heroTitle: 'IES File Generator',
      heroDesc: 'Generate a photometric file from luminaire parameters, preview Type C distribution curves, and export clean report pages when needed.',
      actionGenerate: 'Generate IES',
      actionPreview: 'Preview Curve',
      actionReport: 'Open Report Tool',
      sectionTitle: 'Build photometric files with a cleaner workflow',
      generatorTitle: 'Generator Inputs',
      generatorBadge: 'CDN default',
      manufacturer: 'Luminaire manufacturer',
      serial: 'Luminaire serial number',
      iesType: 'IES type',
      typeSymmetric: 'Type C / C0-C180 symmetric',
      typeFourPlane: 'Type C / C0-C90-C180-C270',
      date: 'Date',
      ledNumber: 'LED number',
      singleFlux: 'Flux for single LED',
      efficiency: 'Luminaire efficiency',
      beamAngle: 'C0-180 beam angle',
      beamAngleC90: 'C90-270 beam angle',
      power: 'Power of luminaire (W)',
      generationMode: 'Generation mode',
      modeSimple: 'Simple parameters',
      modeAdvanced: 'Advanced angle table',
      distributionShape: 'Distribution shape',
      shapeLambertian: 'Lambertian / cosine',
      shapeSoft: 'Soft teardrop',
      shapeStandard: 'Standard teardrop',
      shapeSharp: 'Sharp teardrop',
      shapeVerySharp: 'Very sharp',
      surfaceShape: 'Luminous surface shape',
      length: 'Length of luminous surface (m)',
      width: 'Width of luminous surface (m)',
      diameter: 'Diameter of luminous surface (m)',
      height: 'Height of luminous surface (m)',
      notes: 'Description / keywords',
      generateReport: 'Generate IES Report',
      download: 'Download IES',
      copy: 'Copy text',
      reset: 'Reset',
      upload: 'Open existing IES file',
      helpNote: 'The indoor report pages are hidden on first load. They appear after Generate IES Report or after a file is uploaded and parsed successfully.',
      distribution: 'Distribution Preview',
      totalFlux: 'Total luminaire flux',
      peakCandela: 'Peak candela',
      efficacy: 'Estimated efficacy',
      beamFwhm: 'Beam angle FWHM',
      previewTitle: 'IES Preview',
      reportTitle: 'IES INDOOR REPORT',
      reportFile: 'PHOTOMETRIC FILENAME :',
      descInfo: 'DESCRIPTION INFORMATION (From Photometric File)',
      characteristics: 'CHARACTERISTICS',
      candela: 'CANDELA TABULATION',
      zonal: 'ZONAL LUMEN SUMMARY',
      ugr: 'UGR TABLE - CORRECTED',
      polar: 'POLAR GRAPH',
      languageLabel: 'Language',
      optionZh: '中文',
      optionEn: 'English'
    },
    zh: {
      docTitle: 'IES 编辑器 | Shao Wentao',
      brandTitle: 'IES 编辑器',
      brandSub: '浏览器端配光文件工具',
      navHome: '首页',
      navGenerate: '生成',
      navPreview: '预览',
      navReport: 'IES 报告',
      eyebrow: '配光文件生成器',
      heroTitle: 'IES 文件生成器',
      heroDesc: '根据灯具参数生成配光文件，预览 Type C 配光曲线，并在需要时导出清爽专业的报告页面。',
      actionGenerate: '生成 IES',
      actionPreview: '预览曲线',
      actionReport: '打开报告工具',
      sectionTitle: '用更清晰的流程生成配光文件',
      generatorTitle: '生成参数',
      generatorBadge: 'CDN 默认',
      manufacturer: '灯具制造商',
      serial: '灯具型号 / 编号',
      iesType: 'IES 类型',
      typeSymmetric: 'Type C / C0-C180 对称',
      typeFourPlane: 'Type C / C0-C90-C180-C270',
      date: '日期',
      ledNumber: 'LED 数量',
      singleFlux: '单颗 LED 光通量',
      efficiency: '灯具效率',
      beamAngle: 'C0-180 光束角',
      beamAngleC90: 'C90-270 光束角',
      power: '灯具功率 (W)',
      generationMode: '生成模式',
      modeSimple: '简易参数',
      modeAdvanced: '高级角度表',
      distributionShape: '配光形状',
      shapeLambertian: '朗伯体 / 余弦',
      shapeSoft: '柔和水滴型',
      shapeStandard: '标准水滴型',
      shapeSharp: '锐利水滴型',
      shapeVerySharp: '极窄型',
      surfaceShape: '发光面形状',
      length: '发光面长度 (m)',
      width: '发光面宽度 (m)',
      diameter: '发光面直径 (m)',
      height: '发光面高度 (m)',
      notes: '描述 / 关键词',
      generateReport: '生成 IES 报告',
      download: '下载 IES',
      copy: '复制文本',
      reset: '重置',
      upload: '打开已有 IES 文件',
      helpNote: '室内报告页面初始隐藏。点击生成 IES 报告，或上传文件并解析成功后，报告页面会自动展开。',
      distribution: '配光预览',
      totalFlux: '灯具总光通量',
      peakCandela: '峰值光强',
      efficacy: '估算光效',
      beamFwhm: '半峰光束角',
      previewTitle: 'IES 文本预览',
      reportTitle: 'IES 室内照明报告',
      reportFile: '配光文件名：',
      descInfo: '说明信息（来自配光文件）',
      characteristics: '特性参数',
      candela: '光强表',
      zonal: '区域光通量汇总',
      ugr: 'UGR 表 - 修正后',
      polar: '极坐标配光图',
      languageLabel: '语言',
      optionZh: '中文',
      optionEn: 'English'
    }
  };

  function t(lang, key) {
    return (text[lang] && text[lang][key]) || text.en[key] || '';
  }

  function setText(selector, value) {
    const node = document.querySelector(selector);
    if (node) node.textContent = value;
  }

  function setLabel(forId, value) {
    const node = document.querySelector(`label[for="${forId}"]`);
    if (node) node.textContent = value;
  }

  function applyLanguage(lang) {
    const finalLang = lang === 'zh' ? 'zh' : 'en';
    document.documentElement.lang = finalLang === 'zh' ? 'zh-CN' : 'en';
    document.title = t(finalLang, 'docTitle');

    setText('.brand strong', t(finalLang, 'brandTitle'));
    setText('.brand span span', t(finalLang, 'brandSub'));
    const navLinks = document.querySelectorAll('.nav a');
    if (navLinks[0]) navLinks[0].textContent = t(finalLang, 'navHome');
    if (navLinks[1]) navLinks[1].textContent = t(finalLang, 'navGenerate');
    if (navLinks[2]) navLinks[2].textContent = t(finalLang, 'navPreview');
    if (navLinks[3]) navLinks[3].textContent = t(finalLang, 'navReport');

    setText('.eyebrow', t(finalLang, 'eyebrow'));
    setText('.hero h1', t(finalLang, 'heroTitle'));
    setText('.hero p', t(finalLang, 'heroDesc'));
    const heroActions = document.querySelectorAll('.hero-actions a');
    if (heroActions[0]) heroActions[0].textContent = t(finalLang, 'actionGenerate');
    if (heroActions[1]) heroActions[1].textContent = t(finalLang, 'actionPreview');
    if (heroActions[2]) heroActions[2].textContent = t(finalLang, 'actionReport');
    setText('.section-title', t(finalLang, 'sectionTitle'));
    setText('aside.panel .panel-head h2', t(finalLang, 'generatorTitle'));
    setText('aside.panel .panel-head span', t(finalLang, 'generatorBadge'));

    setLabel('manufacturer', t(finalLang, 'manufacturer'));
    setLabel('serial', t(finalLang, 'serial'));
    setLabel('iesType', t(finalLang, 'iesType'));
    const iesType = document.querySelector('#iesType');
    if (iesType) {
      const symmetric = iesType.querySelector('option[value="symmetric"]');
      const fourPlane = iesType.querySelector('option[value="four-plane"]');
      if (symmetric) symmetric.textContent = t(finalLang, 'typeSymmetric');
      if (fourPlane) fourPlane.textContent = t(finalLang, 'typeFourPlane');
    }
    setLabel('date', t(finalLang, 'date'));
    setLabel('ledCount', t(finalLang, 'ledNumber'));
    setLabel('singleFlux', t(finalLang, 'singleFlux'));
    setLabel('efficiency', t(finalLang, 'efficiency'));
    setLabel('beamAngle', t(finalLang, 'beamAngle'));
    setLabel('beamAngleC90', t(finalLang, 'beamAngleC90'));
    setLabel('power', t(finalLang, 'power'));
    setLabel('generationMode', t(finalLang, 'generationMode'));
    const generationMode = document.querySelector('#generationMode');
    if (generationMode) {
      const simple = generationMode.querySelector('option[value="simple"]');
      const advanced = generationMode.querySelector('option[value="advanced"]');
      if (simple) simple.textContent = t(finalLang, 'modeSimple');
      if (advanced) advanced.textContent = t(finalLang, 'modeAdvanced');
    }
    setLabel('distributionShape', t(finalLang, 'distributionShape'));
    const distributionShape = document.querySelector('#distributionShape');
    if (distributionShape) {
      const lambertian = distributionShape.querySelector('option[value="lambertian"]');
      const soft = distributionShape.querySelector('option[value="soft"]');
      const standard = distributionShape.querySelector('option[value="standard"]');
      const sharp = distributionShape.querySelector('option[value="sharp"]');
      const verySharp = distributionShape.querySelector('option[value="very-sharp"]');
      if (lambertian) lambertian.textContent = t(finalLang, 'shapeLambertian');
      if (soft) soft.textContent = t(finalLang, 'shapeSoft');
      if (standard) standard.textContent = t(finalLang, 'shapeStandard');
      if (sharp) sharp.textContent = t(finalLang, 'shapeSharp');
      if (verySharp) verySharp.textContent = t(finalLang, 'shapeVerySharp');
    }
    setLabel('surfaceShape', t(finalLang, 'surfaceShape'));
    setLabel('length', t(finalLang, 'length'));
    setLabel('width', t(finalLang, 'width'));
    setLabel('diameter', t(finalLang, 'diameter'));
    setLabel('height', t(finalLang, 'height'));
    setLabel('notes', t(finalLang, 'notes'));
    setLabel('upload', t(finalLang, 'upload'));

    const reportBtn = document.getElementById('reportBtn');
    const downloadBtn = document.getElementById('downloadBtn');
    const copyBtn = document.getElementById('copyBtn');
    const resetBtn = document.getElementById('resetBtn');
    if (reportBtn) reportBtn.textContent = t(finalLang, 'generateReport');
    if (downloadBtn) downloadBtn.textContent = t(finalLang, 'download');
    if (copyBtn) copyBtn.textContent = t(finalLang, 'copy');
    if (resetBtn) resetBtn.textContent = t(finalLang, 'reset');
    setText('.notes', t(finalLang, 'helpNote'));

    const panelHeads = document.querySelectorAll('.main-grid .panel .panel-head h2');
    if (panelHeads[0]) panelHeads[0].textContent = t(finalLang, 'distribution');
    if (panelHeads[1]) panelHeads[1].textContent = t(finalLang, 'previewTitle');

    const statLabels = document.querySelectorAll('.stat span');
    if (statLabels[0]) statLabels[0].textContent = t(finalLang, 'totalFlux');
    if (statLabels[1]) statLabels[1].textContent = t(finalLang, 'peakCandela');
    if (statLabels[2]) statLabels[2].textContent = t(finalLang, 'efficacy');
    if (statLabels[3]) statLabels[3].textContent = t(finalLang, 'beamFwhm');

    setText('.report-title h2', t(finalLang, 'reportTitle'));
    const reportFileLabel = document.querySelector('.report-title span');
    const reportFileName = document.getElementById('reportFileName');
    if (reportFileLabel && reportFileName && reportFileLabel.firstChild) {
      reportFileLabel.firstChild.textContent = `${t(finalLang, 'reportFile')} `;
    }
    const reportHeadings = document.querySelectorAll('.report-page h3');
    if (reportHeadings[0]) reportHeadings[0].textContent = t(finalLang, 'descInfo');
    if (reportHeadings[1]) reportHeadings[1].textContent = t(finalLang, 'characteristics');
    if (reportHeadings[2]) reportHeadings[2].textContent = t(finalLang, 'candela');
    if (reportHeadings[3]) reportHeadings[3].textContent = t(finalLang, 'zonal');
    if (reportHeadings[4]) reportHeadings[4].textContent = t(finalLang, 'ugr');
    if (reportHeadings[5]) reportHeadings[5].textContent = t(finalLang, 'polar');

    const selector = document.getElementById('languageSelect');
    const label = document.getElementById('languageLabel');
    if (label) label.textContent = t(finalLang, 'languageLabel');
    if (selector) {
      selector.value = finalLang;
      const zh = selector.querySelector('option[value="zh"]');
      const en = selector.querySelector('option[value="en"]');
      if (zh) zh.textContent = t(finalLang, 'optionZh');
      if (en) en.textContent = t(finalLang, 'optionEn');
    }

    window.iesEditorLanguage = finalLang;
    window.dispatchEvent(new CustomEvent('ies-language-change', { detail: { language: finalLang } }));
  }

  async function fetchWithTimeout(url, timeoutMs = 1800) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { signal: controller.signal, cache: 'no-store' });
      if (!response.ok) throw new Error(String(response.status));
      return await response.json();
    } finally {
      clearTimeout(timer);
    }
  }

  async function detectCountry() {
    const services = [
      async () => (await fetchWithTimeout('https://api.country.is/')).country,
      async () => (await fetchWithTimeout('https://ipapi.co/json/')).country_code,
      async () => (await fetchWithTimeout('https://ipwho.is/?fields=country_code')).country_code
    ];
    for (const service of services) {
      try {
        const code = String(await service()).toUpperCase();
        if (/^[A-Z]{2}$/.test(code)) return code;
      } catch (error) {}
    }
    return '';
  }

  async function resolveInitialLanguage() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'zh' || saved === 'en') return saved;
    const country = await detectCountry();
    if (country === MAINLAND_CHINA) return 'zh';
    if (country) return 'en';
    const browserLang = (navigator.language || '').toLowerCase();
    return browserLang === 'zh-cn' || browserLang.startsWith('zh-hans') ? 'zh' : DEFAULT_LANG;
  }

  function bindSwitcher() {
    const selector = document.getElementById('languageSelect');
    if (!selector) return;
    selector.addEventListener('change', () => {
      const lang = selector.value === 'zh' ? 'zh' : 'en';
      localStorage.setItem(STORAGE_KEY, lang);
      applyLanguage(lang);
    });
  }

  window.iesApplyLanguage = applyLanguage;

  window.addEventListener('DOMContentLoaded', async () => {
    bindSwitcher();
    const lang = await resolveInitialLanguage();
    applyLanguage(lang);
  });
})();
