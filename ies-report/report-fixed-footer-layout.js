(() => {
  function $(selector, root = document) {
    return root.querySelector(selector);
  }

  function $all(selector, root = document) {
    return Array.from(root.querySelectorAll(selector));
  }

  function injectStyle() {
    if (document.getElementById('report-fixed-footer-layout-style')) return;
    const style = document.createElement('style');
    style.id = 'report-fixed-footer-layout-style';
    style.textContent = `
      @media screen {
        .paper {
          box-sizing: border-box;
          height: 1358px;
          min-height: 1358px;
          max-height: 1358px;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        .paper > .report-head,
        .paper > .page-title,
        .paper > .report-title {
          flex: 0 0 auto;
        }
        .paper > .footer-data,
        .paper > .report-footer-data,
        .paper footer.footer-data,
        .paper footer.report-footer-data {
          flex: 0 0 auto;
          margin-top: auto !important;
        }
        .paper > .charts,
        .paper > .luminance-body,
        .paper > .zonal-table,
        .paper > .candela-auto-content {
          min-height: 0;
        }
      }

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
        .layout,
        .paper-wrap,
        #extraPages {
          display: block !important;
          width: 210mm !important;
          max-width: 210mm !important;
          margin: 0 !important;
          padding: 0 !important;
          border: 0 !important;
          background: #fff !important;
          overflow: visible !important;
        }
        .paper {
          box-sizing: border-box !important;
          width: 210mm !important;
          height: 297mm !important;
          min-height: 297mm !important;
          max-height: 297mm !important;
          margin: 0 !important;
          padding: 12mm 14mm 10mm !important;
          display: flex !important;
          flex-direction: column !important;
          overflow: hidden !important;
          box-shadow: none !important;
          page-break-inside: avoid !important;
          break-inside: avoid-page !important;
          page-break-after: always !important;
          break-after: page !important;
        }
        .paper.report-print-last {
          page-break-after: auto !important;
          break-after: auto !important;
        }
        .paper > .report-head,
        .paper > .page-title,
        .paper > .report-title {
          flex: 0 0 auto !important;
        }
        .paper > .footer-data,
        .paper > .report-footer-data,
        .paper footer.footer-data,
        .paper footer.report-footer-data {
          flex: 0 0 auto !important;
          margin-top: auto !important;
        }
        .paper > .charts,
        .paper > .luminance-body,
        .paper > .candela-auto-content,
        .paper > .mini-svg,
        .paper > table,
        .paper > .zonal-label,
        .paper > .zonal-notes,
        .paper > .page-check-note,
        .paper > .report-note {
          min-height: 0 !important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function markLastPage() {
    const papers = $all('.paper');
    papers.forEach((paper, index) => {
      paper.classList.toggle('report-print-last', index === papers.length - 1);
    });
  }

  function updatePageNumbers() {
    const papers = $all('.paper');
    const total = papers.length;
    const totalInput = document.getElementById('pageTotal');
    if (totalInput && total) totalInput.value = String(total);
    papers.forEach((paper, index) => {
      const pageNo = $('.page-no', paper);
      if (!pageNo || !total) return;
      if (document.body.classList.contains('report-lang-zh')) {
        pageNo.textContent = `第 ${index + 1} 页　共 ${total} 页`;
      } else {
        pageNo.textContent = `Page ${index + 1} Of ${total}`;
      }
    });
  }

  function applyLayout() {
    injectStyle();
    markLastPage();
    updatePageNumbers();
  }

  function scheduleApply(delay = 80) {
    clearTimeout(scheduleApply.timer);
    scheduleApply.timer = setTimeout(applyLayout, delay);
  }

  function init() {
    applyLayout();
    const root = document.getElementById('extraPages') || document.querySelector('.paper-wrap') || document.body;
    const observer = new MutationObserver(() => scheduleApply(120));
    observer.observe(root, { childList: true, subtree: true, attributes: true });
    window.addEventListener('beforeprint', applyLayout);
    window.addEventListener('afterprint', applyLayout);
    window.addEventListener('resize', () => scheduleApply(120));
    setTimeout(applyLayout, 300);
    setTimeout(applyLayout, 900);
    setTimeout(applyLayout, 1800);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
