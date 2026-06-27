(() => {
  function frame() {
    return document.getElementById('fullReportFrame');
  }

  function injectPrintReset() {
    const iframe = frame();
    const doc = iframe && iframe.contentDocument;
    if (!doc || !doc.head) return;
    if (doc.getElementById('embedded-report-print-reset-style')) return;
    const style = doc.createElement('style');
    style.id = 'embedded-report-print-reset-style';
    style.textContent = `
      @media print {
        @page { size: A4; margin: 0; }
        html, body {
          width: 210mm !important;
          min-width: 210mm !important;
          margin: 0 !important;
          padding: 0 !important;
          overflow: visible !important;
          background: #fff !important;
        }
        .layout,
        .paper-wrap,
        .editor-report-scale-holder,
        .editor-report-scale-shell,
        #extraPages {
          display: block !important;
          width: 210mm !important;
          max-width: 210mm !important;
          height: auto !important;
          min-height: 0 !important;
          margin: 0 !important;
          padding: 0 !important;
          border: 0 !important;
          overflow: visible !important;
          background: #fff !important;
          transform: none !important;
          contain: none !important;
          content-visibility: visible !important;
        }
        .paper {
          width: 210mm !important;
          min-width: 210mm !important;
          max-width: 210mm !important;
          margin: 0 !important;
          box-shadow: none !important;
          transform: none !important;
          contain: none !important;
          content-visibility: visible !important;
        }
      }
    `;
    doc.head.appendChild(style);
  }

  function preparePrint() {
    injectPrintReset();
    const iframe = frame();
    const doc = iframe && iframe.contentDocument;
    if (!doc) return;
    const holder = doc.querySelector('.editor-report-scale-holder');
    const shell = doc.querySelector('.editor-report-scale-shell');
    if (holder) {
      holder.style.width = '';
      holder.style.height = '';
    }
    if (shell) {
      shell.style.width = '';
      shell.style.transform = '';
    }
  }

  document.addEventListener('click', (event) => {
    if (event.target && event.target.id === 'fullReportPrintBtn') {
      preparePrint();
      setTimeout(preparePrint, 60);
    }
  }, true);

  window.addEventListener('beforeprint', preparePrint);
  window.addEventListener('DOMContentLoaded', () => {
    const iframe = frame();
    if (iframe) iframe.addEventListener('load', () => {
      setTimeout(injectPrintReset, 160);
      setTimeout(injectPrintReset, 600);
    });
    setInterval(injectPrintReset, 1800);
  });
})();
