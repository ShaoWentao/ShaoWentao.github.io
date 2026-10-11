(() => {
  const numberFrom = (value) => {
    const match = String(value || '').replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
    return match ? Number(match[0]) : NaN;
  };

  const isChinese = () => {
    const title = document.querySelector('.report-title');
    return /[\u3400-\u9fff]/.test(title ? title.textContent : '');
  };

  function updateBeamFluxLabels() {
    const totalFlux = numberFrom(document.getElementById('totalFluxText')?.textContent);
    document.querySelectorAll('.aai-svg text').forEach((node) => {
      const original = node.dataset.beamFluxValue
        ? Number(node.dataset.beamFluxValue)
        : numberFrom((node.textContent.match(/Flux\s*out\s*:\s*([\d,.]+)/i) || [])[1]);
      if (!Number.isFinite(original)) return;

      node.dataset.beamFluxValue = String(original);
      const beamAngle = numberFrom(document.getElementById('beamText')?.textContent);
      const angleText = Number.isFinite(beamAngle) ? ` ${beamAngle.toFixed(1)}°` : '';
      const shareText = Number.isFinite(totalFlux) && totalFlux > 0
        ? ` (${(original / totalFlux * 100).toFixed(1)}%${isChinese() ? ' 总光通量' : ' of total'})`
        : '';

      const label = isChinese()
        ? `光束内光通量 (FWHM${angleText}): ${original.toFixed(2)} lm${shareText}`
        : `Beam flux (FWHM${angleText}): ${original.toFixed(2)} lm${shareText}`;
      if (node.textContent !== label) node.textContent = label;
      node.setAttribute('font-size', '11');
    });
  }

  let scheduled = false;
  const scheduleUpdate = () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      updateBeamFluxLabels();
    });
  };

  const observer = new MutationObserver(scheduleUpdate);
  const start = () => {
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    scheduleUpdate();
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
