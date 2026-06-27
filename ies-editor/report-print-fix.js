(() => {
  function frame() {
    return document.getElementById('fullReportFrame');
  }

  function injectFix(doc) {
    if (!doc || doc.getElementById('editor-final-print-fix')) return;
    const style = doc.createElement('style');
    style.id = 'editor-final-print-fix';
    style.textContent = `
      @media print {
        @page { size: A4; margin: 0; }
        html, body {
          width: 210mm !important;
          min-width: 210mm !important;
          margin: 0 !important;
          padding: 0 !important;
          background: #fff !important;
          overflow: visible !important;
        }
        .topbar, .panel, .render-progress {
          display: none !important;
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
          background: #fff !important;
          overflow: visible !important;
          transform: none !important;
          contain: none !important;
          content-visibility: visible !important;
        }
        .paper {
          box-sizing: border-box !important;
          width: 210mm !important;
          height: 296.5mm !important;
          min-height: 296.5mm !important;
          max-height: 296.5mm !important;
          margin: 0 !important;
          padding: 11.5mm 14mm 8mm !important;
          box-shadow: none !important;
          overflow: hidden !important;
          transform: none !important;
          contain: none !important;
          content-visibility: visible !important;
          page-break-before: auto !important;
          break-before: auto !important;
          page-break-after: auto !important;
          break-after: auto !important;
          page-break-inside: avoid !important;
          break-inside: avoid-page !important;
        }
        .paper.print-page-break {
          page-break-after: always !important;
          break-after: page !important;
        }
        .paper.print-last-page {
          page-break-after: auto !important;
          break-after: auto !important;
        }
        .candela-distribution-table th,
        .candela-distribution-table td {
          padding-top: 1.7px !important;
          padding-bottom: 1.7px !important;
          height: 14.3px !important;
        }
      }
    `;
    doc.head.appendChild(style);
  }

  function unwrapScaleForPrint(doc) {
    const wrap = doc.querySelector('.paper-wrap');
    const shell = doc.querySelector('.editor-report-scale-shell');
    const holder = doc.querySelector('.editor-report-scale-holder');
    if (!wrap || !shell || !holder) return;
    while (shell.firstChild) wrap.insertBefore(shell.firstChild, holder);
    holder.remove();
  }

  function markPages(doc) {
    const papers = Array.from(doc.querySelectorAll('.paper'));
    papers.forEach((paper, index) => {
      const isLast = index === papers.length - 1;
      paper.classList.toggle('print-page-break', !isLast);
      paper.classList.toggle('print-last-page', isLast);
      paper.style.width = '210mm';
      paper.style.height = '296.5mm';
      paper.style.minHeight = '296.5mm';
      paper.style.maxHeight = '296.5mm';
      paper.style.margin = '0';
      paper.style.padding = '11.5mm 14mm 8mm';
      paper.style.pageBreakBefore = 'auto';
      paper.style.breakBefore = 'auto';
      paper.style.pageBreakInside = 'avoid';
      paper.style.breakInside = 'avoid-page';
      paper.style.pageBreakAfter = isLast ? 'auto' : 'always';
      paper.style.breakAfter = isLast ? 'auto' : 'page';
    });
  }

  function applyFinalPrintFix() {
    const f = frame();
    const doc = f && f.contentDocument;
    if (!doc) return;
    injectFix(doc);
    unwrapScaleForPrint(doc);
    markPages(doc);
  }

  document.addEventListener('click', (event) => {
    if (event.target && event.target.id === 'fullReportPrintBtn') {
      applyFinalPrintFix();
      setTimeout(applyFinalPrintFix, 30);
      setTimeout(applyFinalPrintFix, 70);
    }
  }, true);

  window.addEventListener('beforeprint', applyFinalPrintFix);
  window.addEventListener('DOMContentLoaded', () => {
    setInterval(() => {
      const f = frame();
      if (f && f.contentDocument) injectFix(f.contentDocument);
    }, 1500);
  });
})();
