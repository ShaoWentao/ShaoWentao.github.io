(() => {
  const REPORT_MODULES = [
    '../ies-report/report-fixed-footer-layout.js',
    '../ies-report/report-candela-pagination.js'
  ];

  function frame() {
    return document.getElementById('fullReportFrame');
  }

  function injectModules() {
    const iframe = frame();
    const doc = iframe && iframe.contentDocument;
    if (!doc || !doc.head) return;
    REPORT_MODULES.forEach((src) => {
      const absolute = new URL(src, window.location.href).href;
      const key = `report-module-${absolute}`;
      if (doc.querySelector(`script[data-report-module="${key}"]`)) return;
      const script = doc.createElement('script');
      script.src = absolute;
      script.dataset.reportModule = key;
      doc.head.appendChild(script);
    });
  }

  function bind() {
    const iframe = frame();
    if (!iframe) return;
    iframe.addEventListener('load', () => {
      setTimeout(injectModules, 80);
      setTimeout(injectModules, 300);
      setTimeout(injectModules, 900);
    });
    const observer = new MutationObserver(injectModules);
    observer.observe(iframe, { attributes: true, attributeFilter: ['src'] });
    setInterval(injectModules, 1500);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind);
  else bind();
})();
