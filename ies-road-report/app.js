(() => {
  const $ = id => document.getElementById(id);
  const P = window.RoadPhotometry;
  let data = null;
  let sourceFlux = 0;
  let timer;
  let fileRevision = 0;
  function initializeFlux() {
    sourceFlux=P.zones(data).reduce((sum,zone)=>sum+zone.front+zone.back,0);
    $('totalFlux').value=Number(sourceFlux.toPrecision(12)).toString();
    $('totalFlux').disabled=false;
  }
  function initializeParameters() {
    const k=data.keywords;
    const fields={type:k.LUMTYPE||k.TYPE||'',dimensions:[data.width,data.length,data.height].join(' × ')+(data.units===1?' ft':' m'),aperture:k.APERTURE||'',weight:k.WEIGHT||'',testNo:k.TEST||'',shieldAngle:k.SHIELDINGANGLE||'',testConditions:k.TESTCONDITIONS||'',measuredPower:data.power,ratedPower:k.NOMINALPOWER||'',ratedVoltage:k.VOLTAGE||'',nominalFlux:data.lumens>0?data.lumens*data.lamps:'',lampCount:data.lamps,testVoltage:k.TESTVOLTAGE||'',flashArea:k.FLASHAREA||'',sli:k.SLI||'',testSpeed:k.TESTSPEED||'',testSystem:k.TESTSYSTEM||k.SYSTEM||'',temperature:k.TEMPERATURE||'',humidity:k.HUMIDITY||'',testDistance:k.TESTDISTANCE||'',operator:k.OPERATOR||'',date:/^\d{4}-\d{2}-\d{2}$/.test(k.TESTDATE||'')?k.TESTDATE:''};
    Object.entries(fields).forEach(([id,v])=>$(id).value=v);
    if(k.TESTLAB)$('lab').value=k.TESTLAB;
  }
  function render() {
    if (!data) return;
    const h = Number($('height').value), tilt = Number($('tilt').value);
    if (!(h >= .1 && h <= 100) || !Number.isFinite(tilt) || Math.abs(tilt) > 60) {
      $('status').textContent = '请填写有效安装高度和倾角';
      $('print').disabled = true;
      return;
    }
    try {
      if(!$('controls').checkValidity())throw Error('请检查参数数值：功率和面积不得为负，光源数量须为正整数');
      const adjusted=P.withFlux(data,Number($('totalFlux').value),sourceFlux);
      adjusted.power=Number($('measuredPower').value);
      adjusted.lamps=Number($('lampCount').value);
      if(!Number.isInteger(adjusted.lamps)||adjusted.lamps<1)throw Error('光源数量须为正整数');
      adjusted.lumens=$('nominalFlux').value===''?-1:Number($('nominalFlux').value)/adjusted.lamps;
      const zones = P.zones(adjusted, Number($('orientation').value));
      const total = zones.reduce((s, z) => s + z.front + z.back, 0);
      $('pages').innerHTML = RoadReportTemplate.build(adjusted, zones, total);
      RoadReportTemplate.draw(adjusted, zones, total);
      const count = document.querySelectorAll('.paper').length;
      $('count').textContent = count + ' 页';
      $('empty').hidden = true;
      const metrics=RoadMetrics.evaluate(adjusted,zones,total,Number($('orientation').value),$('zeroUplight').checked);
      $('status').textContent = `已生成 ${count} 页 · ${total.toFixed(2)} lm · ${metrics.bug.text}${metrics.upperKnown?'':' · U评级需上半球数据或无上射光确认'}`;
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
      initializeFlux();
      initializeParameters();
      $('zeroUplight').checked = false;
      const k = data.keywords;
      $('model').value = k.LUMCAT || file.name;
      $('manufacturer').value = k.MANUFAC || '';
      $('name').value = k.LUMINAIRE || 'Streetlight';
      $('spec').value = k.LAMP || '';
      $('remarks').value = k.OTHER || '';
      render();
    } catch (error) {
      data = null;
      $('totalFlux').value='';
      $('totalFlux').disabled=true;
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
    initializeFlux();
    initializeParameters();
    $('model').value = 'SAMPLE-19D (synthetic)';
    $('manufacturer').value = 'Demo';
    $('name').value = 'Underground Light';
    $('spec').value = '2700K 19D';
    $('remarks').value = 'Synthetic demonstration data';
    $('zeroUplight').checked = true;
    render();
  });
  $('controls').addEventListener('input', event => {
    if (event.target.id === 'file') return;
    $('print').disabled=true;
    clearTimeout(timer);
    timer = setTimeout(render, 250);
  });
  $('controls').addEventListener('submit', event => event.preventDefault());
  $('print').addEventListener('click', () => { clearTimeout(timer); render(); if (!$('print').disabled) window.print(); });
})();
