(() => {
  const REPORT_URL = '../ies-report/';
  let frameLoadToken = 0;

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
      hint: zh ? '点击“生成 IES 报告”后，这里会直接载入完整报告页面。原 ies-report 独立页面仍然保留。' : 'After clicking Generate IES Report, the full report page is loaded here. The standalone ies-report page remains unchanged.',
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
      .full-report-card { border:1px solid var(--line); background:rgba(18,22,27,.82); }
      .full-report-head { display:flex; justify-content:space-between; align-items:flex-start; gap:18px; padding:16px 18px; border-bottom:1px solid var(--line); }
      .full-report-head h2 { margin:0; font-size:18px; line-height:1.2; }
      .full-report-head p { margin:6px 0 0; color:var(--muted); font-size:12px; line-height:1.55; }
      .full-report-actions { display:flex; gap:10px; flex-wrap:wrap; }
      .full-report-status { padding:10px 18px; border-bottom:1px solid var(--line); color:#dbe3ea; font-size:12px; line-height:1.45; }
      .full-report-frame-wrap { height:auto; overflow:hidden; background:#fff; }
      #fullReportFrame { width:100%; min-height:1180px; display:block; border:0; background:#fff; }
      @media (max-width:700px) {
        .full-report-embed { padding:0 12px 42px; }
        .full-report-head { display:block; padding:14px; }
        .full-report-actions { display:grid; grid-template-columns:1fr; margin-top:12px; }
        .full-report-actions button { width:100%; }
        .full-report-status { padding:10px 14px; }
        #fullReportFrame { min-height:900px; }
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
            <p id="fullReportHint"></p>
          </div>
          <div class="full-report-actions">
            <button type="button" id="fullReportPrintBtn"></button>
            <button type="button" id="fullReportReloadBtn"></button>
          </div>
        </div>
        <div class="full-report-status" id="fullReportStatus"></div>
        <div class="full-report-frame-wrap"><iframe id="fullReportFrame" title="Full photometric report"></iframe></div>
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
    const hint = $('fullReportHint');
    const printBtn = $('fullReportPrintBtn');
    const reloadBtn = $('fullReportReloadBtn');
    if (title) title.textContent = label('title');
    if (hint) hint.textContent = label('hint');
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
        body { background:#fff !important; }
        .topbar, .panel { display:none !important; }
        .layout { display:block !important; width:100% !important; padding:0 !important; margin:0 !important; }
        .paper-wrap { display:block !important; width:100% !important; padding:12px !important; margin:0 !important; border:0 !important; background:#fff !important; overflow:visible !important; }
        .paper { margin:0 auto 24px !important; }
      }
    `;
    doc.head.appendChild(style);
  }

  function resizeFrame(frame) {
    try {
      const doc = frame.contentDocument;
      if (!doc) return;
      const height = Math.max(
        doc.body ? doc.body.scrollHeight : 0,
        doc.documentElement ? doc.documentElement.scrollHeight : 0,
        1000
      );
      frame.style.height = `${height + 40}px`;
    } catch (error) {}
  }

  function pushIESToReportFrame(frame, iesText, fileName, token) {
    try {
      const win = frame.contentWindow;
      const doc = frame.contentDocument;
      if (!win || !doc) throw new Error('iframe not ready');
      injectEmbeddedStyle(doc);
      syncReportLanguage(doc);
      const input = doc.getElementById('iesFile');
      if (!input) throw new Error('IES input not found');
      const file = new win.File([iesText], fileName, { type: 'text/plain' });
      const dt = new win.DataTransfer();
      dt.items.add(file);
      input.files = dt.files;
      input.dispatchEvent(new win.Event('change', { bubbles: true }));
      setStatus('ready');
      let count = 0;
      const timer = setInterval(() => {
        if (token !== frameLoadToken || count > 20) return clearInterval(timer);
        syncReportLanguage(doc);
        injectEmbeddedStyle(doc);
        resizeFrame(frame);
        count += 1;
      }, 350);
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
    setStatus('loading');
    const frame = $('fullReportFrame');
    const token = ++frameLoadToken;
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
      if (frame && frame.contentDocument) syncReportLanguage(frame.contentDocument);
    });
  });
})();
