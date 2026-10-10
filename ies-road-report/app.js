(() => {
  const $ = id => document.getElementById(id);
  const P = window.RoadPhotometry;
  let data = null;
  let timer;
  let fileRevision = 0;
  function render() {
    if (!data) return;
    const h = Number($('height').value), tilt = Number($('tilt').value);
    if (!(h >= .1 && h <= 100) || !Number.isFinite(tilt) || Math.abs(tilt) > 60) {
      $('status').textContent = '请填写有效安装高度和倾角';
      $('print').disabled = true;
      return;
    }
    try {
      const zones = P.zones(data, Number($('orientation').value));
      const total = zones.reduce((s, z) => s + z.front + z.back, 0);
      $('pages').innerHTML = RoadReportTemplate.build(data, zones, total);
      RoadReportTemplate.draw(data, zones, total);
      const count = document.querySelectorAll('.paper').length;
      $('count').textContent = count + ' 页';
      $('empty').hidden = true;
      $('status').textContent = `已生成 ${count} 页 · ${total.toFixed(2)} lm · BUG / 配光分类待核定`;
      $('print').disabled = false;
    } catch (error) {
      $('status').textContent = error.message;
      $('print').disabled = true;
    }
  }
  $('file').addEventListener('change', async () => {
    const file = $('file').files[0], revision = ++fileRevision;
    if (!file) return;
    $('print').disabled = true;
    try {
      const buffer = await file.arrayBuffer();
      if (revision !== fileRevision) return;
      let text = new TextDecoder('utf-8').decode(buffer);
      if (text.includes('\ufffd')) text = new TextDecoder('gb18030').decode(buffer);
      const parsed = P.parse(text);
      if (parsed.peak <= 0) throw Error('文件中没有有效光强');
      data = parsed;
      const k = data.keywords;
      $('model').value = k.LUMCAT || file.name;
      $('manufacturer').value = k.MANUFAC || '';
      $('name').value = k.LUMINAIRE || 'Streetlight';
      $('spec').value = k.LAMP || '';
      $('remarks').value = k.OTHER || '';
      render();
    } catch (error) {
      data = null;
      $('pages').innerHTML = '';
      $('count').textContent = '0 页';
      $('empty').hidden = false;
      $('status').textContent = error.message;
      $('print').disabled = true;
    }
  });
  $('sample').addEventListener('click', () => {
    fileRevision++;
    const vertical = Array.from({length:91}, (_,i) => i), horizontal = [0,45,90,135,180,225,270,315,360];
    const values = horizontal.flatMap(c => vertical.map(g => 1275*Math.exp(-Math.pow(g/11,2))*(1+.08*Math.sin(c*P.rad))));
    data = P.parse(`IESNA:LM-63-2002\n[MANUFAC] Demo\n[LUMCAT] SAMPLE-19D\nTILT=NONE\n1 -1 1 91 9 1 2 .038 .038 .1\n1 1 5.8256\n${vertical.join(' ')}\n${horizontal.join(' ')}\n${values.join(' ')}`);
    $('model').value = 'SAMPLE-19D (synthetic)';
    $('manufacturer').value = 'Demo';
    $('name').value = 'Underground Light';
    $('spec').value = '2700K 19D';
    $('remarks').value = 'Synthetic demonstration data';
    render();
  });
  $('controls').addEventListener('input', event => {
    if (event.target.id === 'file') return;
    clearTimeout(timer);
    timer = setTimeout(render, 250);
  });
  $('controls').addEventListener('submit', event => event.preventDefault());
  $('print').addEventListener('click', () => { clearTimeout(timer); render(); if (!$('print').disabled) window.print(); });
})();
