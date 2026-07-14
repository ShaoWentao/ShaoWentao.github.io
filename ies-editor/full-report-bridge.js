(() => {
  const REPORT_URL = '../ies-report/';
  let frameLoadToken = 0;
  let lastFrameHeight = 0;
  let lastScale = 0;
  let lastPaperWidth = 0;
  let reportObserver = null;
  let resizeTimer = 0;

  function $(id) {
    return document.getElementById(id);
  }

  function textOf(id) {
    const node = $(id);
    return node ? node.textContent || '' : '';
  }

  function currentLanguage() {
    if (window.iesEditorLanguage === 'zh' || window.iesEditorLanguage === 'en') return window.iesEditorLanguage;
    const selected = $('languageSelect') && $('languageSelect').value;
    if (selected === 'zh' || selected === 'en') return selected;
    return (document.documentElement.lang || '').toLowerCase().startsWith('zh') ? 'zh' : 'en';
  }

  function label(key) {
    const zh = currentLanguage() === 'zh';
    const dict = {
      title: zh ? '完整光度报告' : 'Full Photometric Report',
      hint: '',
      loading: zh ? '正在生成完整报告...' : 'Generating full report...',
      ready: zh ? '完整报告已生成，可在下方预览或打印保存 PDF。' : 'Full report generated. Preview below or print/save as PDF.',
      noIES: zh ? '没有可用的 IES 文本，请先生成或上传 IES。' : 'No IES text available. Generate or upload an IES file first.',
      print: zh ? '打印 / 保存 PDF' : 'Print / Save PDF',
      reload: zh ? '重新载入完整报告' : 'Reload full report',
      failed: zh ? '完整报告载入失败，请重新生成或刷新页面。' : 'Full report failed to load. Please generate again or refresh the page.'
    };
    return dict[key] || key;
  }

  function ensureStyle() {
    if ($('full-report-bridge-style')) return;
    const style = document.createElement('style');
    style.id = 'full-report-bridge-style';
    style.textContent = `
      #report.report { display:none !important; }
      .full-report-embed { padding:0 clamp(18px,5vw,64px) 72px; }
      .full-report-embed.hidden { display:none; }
      .full-report-card { border:1px solid var(--line); background:rgba(18,22,27,.82); min-width:0; }
      .full-report-head { display:flex; justify-content:space-between; align-items:flex-start; gap:18px; padding:16px 18px; border-bottom:1px solid var(--line); }
      .full-report-head h2 { margin:0; font-size:18px; line-height:1.2; }
      .full-report-head p { margin:6px 0 0; color:var(--muted); font-size:12px; line-height:1.55; }
      .full-report-actions { display:flex; gap:10px; flex-wrap:wrap; }
      .full-report-status { padding:10px 18px; border-bottom:1px solid var(--line); color:#dbe3ea; font-size:12px; line-height:1.45; }
      .full-report-frame-wrap { width:100%; height:auto; overflow:hidden; background:#fff; contain:layout paint; }
      #fullReportFrame { width:100%; min-height:1180px; display:block; border:0; background:#fff; overflow:hidden; visibility:hidden; }
      .full-report-embed.is-ready #fullReportFrame { visibility:visible; }
      @media (max-width:700px) {
        .full-report-embed { padding:0 12px 42px; }
        .full-report-head { display:block; padding:14px; }
        .full-report-actions { display:grid; grid-template-columns:1fr; margin-top:12px; }
        .full-report-actions button { width:100%; }
        .full-report-status { padding:10px 14px; }
        #fullReportFrame { min-height:680px; }
      }
    `;
    document.head.appendChild(style);
  }

  function ensureSection() {
    ensureStyle();
    let section = $('fullReportEmbed');
    if (section) return section;
    section = document.createElement('section');
    section.id = 'fullReportEmbed';
    section.className = 'full-report-embed hidden';
    section.innerHTML = `
      <div class="full-report-card">
        <div class="full-report-head">
          <div>
            <h2 id="fullReportTitle"></h2>
          </div>
          <div class="full-report-actions">
            <button type="button" id="fullReportPrintBtn"></button>
            <button type="button" id="fullReportReloadBtn"></button>
          </div>
        </div>
        <div class="full-report-status" id="fullReportStatus"></div>
        <div class="full-report-frame-wrap"><iframe id="fullReportFrame" title="Full photometric report" scrolling="no"></iframe></div>
      </div>
    `;
    const simpleReport = $('report');
    if (simpleReport && simpleReport.parentNode) simpleReport.insertAdjacentElement('afterend', section);
    else document.querySelector('main')?.appendChild(section);
    $('fullReportPrintBtn').addEventListener('click', () => {
      const frame = $('fullReportFrame');
      if (frame && frame.contentWindow) {
        frame.contentWindow.focus();
        frame.contentWindow.print();
      }
    });
    $('fullReportReloadBtn').addEventListener('click', () => loadFullReport());
    updateLabels();
    return section;
  }

  function updateLabels() {
    const title = $('fullReportTitle');
    const printBtn = $('fullReportPrintBtn');
    const reloadBtn = $('fullReportReloadBtn');
    if (title) title.textContent = label('title');
    if (printBtn) printBtn.textContent = label('print');
    if (reloadBtn) reloadBtn.textContent = label('reload');
  }

  function setStatus(keyOrText, raw = false) {
    const status = $('fullReportStatus');
    if (!status) return;
    status.textContent = raw ? keyOrText : label(keyOrText);
  }

  function getIESText() {
    return textOf('iesPreview').trim();
  }

  function getIESFileName() {
    const name = textOf('fileName').trim();
    if (name) return name.endsWith('.ies') ? name : `${name}.ies`;
    const serial = $('serial') && $('serial').value ? $('serial').value.trim() : 'generated';
    return `${serial || 'generated'}.ies`;
  }

  function syncReportLanguage(doc) {
    const desired = currentLanguage();
    const body = doc.body;
    const toggle = doc.getElementById('languageToggle');
    if (!body || !toggle) return;
    const isZh = body.classList.contains('report-lang-zh');
    const isEn = body.classList.contains('report-lang-en');
    if (desired === 'zh' && !isZh) toggle.click();
    if (desired === 'en' && !isEn) toggle.click();
  }

  function injectEmbeddedStyle(doc) {
    if (doc.getElementById('editor-embedded-report-style')) return;
    const style = doc.createElement('style');
    style.id = 'editor-embedded-report-style';
    style.textContent = `
      @media screen {
        html, body { width:100% !important; max-width:100% !important; overflow-x:hidden !important; background:#fff !important; }
        .topbar, .panel { display:none !important; }
        .layout { display:block !important; width:100% !important; max-width:100% !important; padding:0 !important; margin:0 !important; overflow:hidden !important; }
        .paper-wrap { display:block !important; width:100% !important; max-width:100% !important; padding:12px 0 !important; margin:0 !important; border:0 !important; background:#fff !important; overflow:hidden !important; }
        .editor-report-scale-holder { width:calc(var(--editor-paper-width, 960px) * var(--editor-report-scale, 1)); height:calc(var(--editor-report-height, 1358px) * var(--editor-report-scale, 1)); margin:0 auto !important; overflow:hidden !important; }
        .editor-report-scale-shell { width:var(--editor-paper-width, 960px); transform:translateZ(0) scale(var(--editor-report-scale, 1)); transform-origin:top left; overflow:visible !important; will-change:transform; }
        .editor-report-scale-shell .paper { margin:0 0 24px !important; }
      }
    `;
    doc.head.appendChild(style);
  }

  function ensureReportScaleWrapper(doc) {
    const wrap = doc.querySelector('.paper-wrap');
    if (!wrap) return null;
    let holder = doc.querySelector('.editor-report-scale-holder');
    let shell = doc.querySelector('.editor-report-scale-shell');
    if (holder && shell) return { holder, shell };

    holder = doc.createElement('div');
    holder.className = 'editor-report-scale-holder';
    shell = doc.createElement('div');
    shell.className = 'editor-report-scale-shell';

    while (wrap.firstChild) shell.appendChild(wrap.firstChild);
    holder.appendChild(shell);
    wrap.appendChild(holder);
    return { holder, shell };
  }

  function applyReportScale(frame) {
    const doc = frame.contentDocument;
    if (!doc) return false;
    const parts = ensureReportScaleWrapper(doc);
    if (!parts) return false;
    const { holder, shell } = parts;
    const paper = shell.querySelector('.paper');
    const paperWidth = Math.max(1, Math.ceil((paper && paper.offsetWidth) || 960));
    const available = Math.max(280, Math.floor(frame.clientWidth || frame.getBoundingClientRect().width || 360));
    const scale = Math.min(1, Math.max(0.28, (available - 2) / paperWidth));
    const contentHeight = Math.max(680, Math.ceil(shell.scrollHeight || shell.getBoundingClientRect().height || 1358));
    const holderWidth = Math.ceil(paperWidth * scale);
    const holderHeight = Math.ceil(contentHeight * scale);

    const changed = Math.abs(scale - lastScale) > 0.002 || Math.abs(paperWidth - lastPaperWidth) > 2 || Math.abs(holder.offsetHeight - holderHeight) > 10;
    if (!changed) return false;

    doc.documentElement.style.setProperty('--editor-paper-width', `${paperWidth}px`);
    doc.documentElement.style.setProperty('--editor-report-scale', String(scale));
    doc.documentElement.style.setProperty('--editor-report-height', `${contentHeight}px`);
    holder.style.width = `${holderWidth}px`;
    holder.style.height = `${holderHeight}px`;
    lastScale = scale;
    lastPaperWidth = paperWidth;
    return true;
  }

  function resizeFrame(frame) {
    try {
      const doc = frame.contentDocument;
      if (!doc) return;
      injectEmbeddedStyle(doc);
      applyReportScale(frame);
      const holder = doc.querySelector('.editor-report-scale-holder');
      const targetHeight = Math.max(680, Math.ceil((holder ? holder.offsetHeight : 0) + 36));
      if (Math.abs(targetHeight - lastFrameHeight) > 12) {
        frame.style.height = `${targetHeight}px`;
        lastFrameHeight = targetHeight;
      }
      const section = $('fullReportEmbed');
      if (section) section.classList.add('is-ready');
    } catch (error) {}
  }

  function scheduleResize(frame, token, delay = 120) {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (token !== frameLoadToken) return;
      requestAnimationFrame(() => resizeFrame(frame));
    }, delay);
  }

  function scheduleResizeSeries(frame, token, delays = [120, 320, 700, 1300, 2200, 4000, 7000, 10000]) {
    delays.forEach((delay) => {
      setTimeout(() => {
        if (token !== frameLoadToken) return;
        requestAnimationFrame(() => resizeFrame(frame));
      }, delay);
    });
  }

  function observeReport(frame, token) {
    try {
      if (reportObserver) reportObserver.disconnect();
      reportObserver = null;
      const doc = frame.contentDocument;
      const win = frame.contentWindow;
      if (!doc || !win) return;
      const root = doc.querySelector('.paper-wrap') || doc.body;
      reportObserver = new win.MutationObserver(() => scheduleResize(frame, token, 160));
      reportObserver.observe(root, { childList: true, subtree: true, attributes: true });
      win.addEventListener('resize', () => scheduleResize(frame, token, 120));
    } catch (error) {}
  }

  function pushIESToReportFrame(frame, iesText, fileName, token) {
    try {
      const win = frame.contentWindow;
      const doc = frame.contentDocument;
      if (!win || !doc) throw new Error('iframe not ready');
      injectEmbeddedStyle(doc);
      ensureReportScaleWrapper(doc);
      observeReport(frame, token);
      syncReportLanguage(doc);
      const input = doc.getElementById('iesFile');
      if (!input) throw new Error('IES input not found');
      const file = new win.File([iesText], fileName, { type: 'text/plain' });
      const dt = new win.DataTransfer();
      dt.items.add(file);
      input.files = dt.files;
      input.dispatchEvent(new win.Event('change', { bubbles: true }));
      setStatus('ready');
      scheduleResizeSeries(frame, token);
    } catch (error) {
      setStatus(label('failed') + ` ${error.message || error}`, true);
    }
  }

  function loadFullReport() {
    const section = ensureSection();
    updateLabels();
    const iesText = getIESText();
    if (!iesText || !/TILT\s*=/i.test(iesText)) {
      section.classList.remove('hidden');
      setStatus('noIES');
      return;
    }
    section.classList.remove('hidden');
    section.classList.remove('is-ready');
    lastFrameHeight = 0;
    lastScale = 0;
    lastPaperWidth = 0;
    if (reportObserver) reportObserver.disconnect();
    reportObserver = null;
    setStatus('loading');
    const frame = $('fullReportFrame');
    const token = ++frameLoadToken;
    frame.style.height = '';
    frame.onload = () => {
      if (token !== frameLoadToken) return;
      setTimeout(() => pushIESToReportFrame(frame, iesText, getIESFileName(), token), 120);
    };
    frame.src = `${REPORT_URL}?embedded=1&from=ies-editor&t=${Date.now()}`;
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function waitForPreviewAndLoad() {
    let tries = 0;
    const timer = setInterval(() => {
      tries += 1;
      if (/TILT\s*=/i.test(getIESText()) || tries > 30) {
        clearInterval(timer);
        loadFullReport();
      }
    }, 160);
  }

  window.iesEditorLoadFullReport = loadFullReport;

  window.addEventListener('DOMContentLoaded', () => {
    ensureSection();
    const reportBtn = $('reportBtn');
    const upload = $('upload');
    if (reportBtn) reportBtn.addEventListener('click', () => setTimeout(loadFullReport, 260));
    if (upload) upload.addEventListener('change', () => waitForPreviewAndLoad());
    window.addEventListener('ies-language-change', () => {
      updateLabels();
      const frame = $('fullReportFrame');
      if (frame && frame.contentDocument) {
        syncReportLanguage(frame.contentDocument);
        scheduleResizeSeries(frame, frameLoadToken, [80, 300, 700, 1300]);
      }
    });
    window.addEventListener('resize', () => {
      const frame = $('fullReportFrame');
      if (frame && frame.contentDocument) scheduleResizeSeries(frame, frameLoadToken, [120, 380, 900]);
    });
  });
})();
