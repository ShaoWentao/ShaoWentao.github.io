(() => {
  const $=id=>document.getElementById(id);
  const groups=[
    ['样品信息', [['sample','样品','LED'],['spec','规格'],['sampleNo','样品编号'],['manufacturer','厂家'],['date','测试日期','','datetime-local'],['sampleStatus','样品状态'],['instrument','仪器'],['tester','测试人'],['assessor','审核人']]],
    ['测试条件', [['temperature','温度（°C）','','number'],['rh','相对湿度（%）','','number'],['ip','IP'],['time','积分时间（ms）','','number'],['mode','测试模式'],['sensitivity','灵敏度']]],
    ['仪器色度结果', [['cct','色温（K）','','number'],['duv','Duv','','number'],['sdcm','SDCM','','number'],['dominant','主波长（nm）','','number'],['purity','色纯度（%）','','number'],['fwhm','半峰宽（nm）','','number'],['ratio','RGB 比例'],['ra','Ra','','number'],['rf','TM-30 Rf','','number'],['rg','TM-30 Rg','','number'],...Array.from({length:15},(_,i)=>['r'+(i+1),'R'+(i+1),'','number'])]],
    ['光度与电参数', [['flux','实测光通量（lm）','','number'],['radiant','实测辐射通量（mW）','','number'],['voltage','电压（V）','','number'],['current','电流（A）','','number'],['power','实测功率（W）','','number'],['pf','功率因数','','number'],['frequency','频率（Hz）','','number']]],
    ['报告页脚', [['footer','机构名称','EVERFINE CORPORATION'],['website','网址','http://www.everfine.cn']]]
  ];
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function field([id,label,value='',type='text']) {
    return `<label>${label}<input id="${id}" type="${type}" value="${esc(value)}" ${type==='datetime-local'?'step="1"':type==='number'?`step="any" ${id==='duv'||/^r\d+$/.test(id)||id==='ra'?'':'min="0"'} ${id==='rh'||id==='purity'?'max="100"':id==='pf'?'max="1"':''}`:''}></label>`;
  }
  $('fields').innerHTML=groups.map(([title,items],i)=>i===0?items.map(field).join(''):`<details><summary>${title}</summary>${items.map(field).join('')}</details>`).join('');
  let points=null,metrics=null,revision=0,reference=false,instrumentChart=null,chartRevision=0;
  const tablePromise=fetch('CIE_xyz_1931_2deg.csv').then(r=>{if(!r.ok)throw Error('色度数据加载失败');return r.text();}).then(t=>t.trim().split(/\r?\n/).map(r=>r.split(',').map(Number)));
  tablePromise.catch(()=>{});
  const val=id=>$(id).value.trim();
  const text=id=>esc(val(id)||'—');
  const row=(label,value)=>`<div class="row"><span>${label}</span><span>: ${value}</span></div>`;
  function fittedLines() {
    $('paper').querySelectorAll('.report-line,.row span:last-child,.cri span').forEach(el=>{
      let size=parseFloat(getComputedStyle(el).fontSize);
      while(el.scrollWidth>el.clientWidth+1 && size>8){size-=.25;el.style.fontSize=size+'px';}
    });
  }
  function render() {
    $('print').disabled=true;
    if(!points)return;
    if(!$('controls').checkValidity()){$('status').textContent='请检查参数数值';return;}
    const eff=val('flux')!==''&&Number(val('power'))>0?(Number(val('flux'))/Number(val('power'))).toFixed(2):'—';
    const range=`${points[0][0]}nm-${points.at(-1)[0]}nm`;
    $('paper').innerHTML=`<header class="report-head"><div class="brand"><img src="cdn-logo.png" alt="西顿照明"></div><h2>Spectrum Test Report</h2></header>
      <div class="meta sample-meta">${row('Sample',text('sample'))}${row('Date',text('date').replace('T',' '))}${row('Specification',text('spec'))}${row('Sam. Status',text('sampleStatus'))}${row('Sample No.',text('sampleNo'))}${row('Instrument',text('instrument'))}${row('Manufacturer',text('manufacturer'))}${row('Test by',text('tester'))}<div></div>${row('Assessor',text('assessor'))}</div>
      <h3 class="condition-title">Test Condition</h3><div class="meta condition-meta">${row('Temprature',text('temperature')+'Deg')}${row('RH',text('rh')+'%')}${row('WL Range',range)}${row('IP',text('ip'))}${row('Test Mode',text('mode'))}${row('T',text('time')+' ms')}<div></div>${row('Sensitivity',text('sensitivity'))}</div>
      <h3 class="spectrum-title">Spectrum</h3><div class="graphs"><canvas id="spectrum" width="1234" height="720"></canvas><canvas id="chromaticity" width="766" height="720"></canvas></div>
      <h3 class="color-title">Colorimetric Parameters</h3><div class="results color-results">
      <div class="report-line">Chromaticity Coordinate: x = ${metrics.x.toFixed(4)} y = ${metrics.y.toFixed(4)} / u' = ${metrics.u.toFixed(4)} v' = ${metrics.v.toFixed(4)} (duv=${text('duv')})</div>
      <div class="report-line">CCT= ${text('cct')}K &nbsp;&nbsp;&nbsp;&nbsp; Prcp WL: &nbsp; Ld=${text('dominant')}nm &nbsp;&nbsp; Purity=${text('purity')}%</div>
      <div class="report-line">Peak WL: &nbsp; Lp=${metrics.peak}nm &nbsp; FWHM: &nbsp; =${text('fwhm')}nm &nbsp; Ratio:${text('ratio')}</div>
      <div class="report-line render-index">Render Index: Ra = ${text('ra')} TM30:Rf=${text('rf')} Rg=${text('rg')}</div>
      <div class="cri">${Array.from({length:7},(_,i)=>`<span>R${i+1} =${text('r'+(i+1))}</span>`).join('')}</div>
      <div class="cri">${Array.from({length:8},(_,i)=>`<span>R${i+8}${i<2?' =':'='}${text('r'+(i+8))}</span>`).join('')}</div></div>
      <h3 class="photometric-title">Photometric &amp; Radiometric Parameters</h3><div class="results photometric-results report-line">Flux &nbsp;= ${text('flux')} lm &nbsp; Eff. : ${eff} lm/W &nbsp; Fe &nbsp;= ${text('radiant')} mW</div>
      <h3 class="electrical-title">Electrical parameters</h3><div class="results electrical-results report-line">V = ${text('voltage')} V &nbsp;&nbsp; I = ${text('current')} A &nbsp;&nbsp; P = ${text('power')} W PF = ${text('pf')} F=${text('frequency')} Hz</div>
      <div class="note">Relative SPD${metrics.full?'':' · Partial spectral coverage'}${reference?' · Reference spectrum; not a measured luminaire test':''}</div><footer>${text('footer')}<small>${val('website')?text('website'):''}</small></footer>`;
    $('paper').hidden=false;$('empty').hidden=true;
    fittedLines();drawSpectrum();drawChromaticity();resize();
    $('print').disabled=false;
    $('status').textContent=`${points.length} 个采样点 · 相对 SPD${metrics.full?'':' · 可见波段覆盖不完整'}${reference?' · 示例光谱，非实测报告':''}`;
  }
  function drawSpectrum() {
    const c=$('spectrum'),ctx=c.getContext('2d'),W=308.5,H=180;
    ctx.scale(4,4);
    const lo=Math.min(350,points[0][0]),hi=Math.max(1000,points.at(-1)[0]),max=Math.max(...points.map(p=>p[1]));
    const x=w=>20+(w-lo)/(hi-lo)*(W-32),y=p=>162-p/max*123;
    ctx.fillStyle='white';ctx.fillRect(0,0,W,H);ctx.font='6.35px Courier New';ctx.fillStyle='#222';ctx.fillText('Spectrum',0,10);ctx.fillText('1.0 = relative peak',190,11);
    ctx.strokeStyle='#777';ctx.lineWidth=.4;ctx.beginPath();ctx.moveTo(20,14);ctx.lineTo(20,162);ctx.lineTo(W-12,162);ctx.stroke();
    for(let i=0;i<=6;i++){const v=i/5;ctx.fillText(v.toFixed(1),4,y(v*max)+2);}
    for(let i=0;i<=4;i++){const w=lo+(hi-lo)*i/4;ctx.fillText(Math.round(w),x(w)-6,172);}
    const gradient=ctx.createLinearGradient(x(350),0,x(780),0);
    [[350,'#000000'],[420,'#4500ff'],[450,'#0000ff'],[490,'#00ffff'],[530,'#00ff00'],[580,'#ffff00'],[620,'#ff0000'],[700,'#350000'],[780,'#000000']].forEach(([w,col])=>gradient.addColorStop((w-350)/430,col));
    ctx.beginPath();ctx.moveTo(x(points[0][0]),y(0));points.forEach(([w,p])=>ctx.lineTo(x(w),y(p)));ctx.lineTo(x(points.at(-1)[0]),y(0));ctx.closePath();ctx.fillStyle=gradient;ctx.fill();
    ctx.fillStyle='#222';ctx.fillText('Wavelength(nm)',130,H-3);
  }
  async function drawChromaticity() {
    const canvas=$('chromaticity');if(!canvas)return;
    const ctx=canvas.getContext('2d');ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,766,720);ctx.scale(4,4);
    ctx.fillStyle='white';ctx.fillRect(0,0,191.5,180);
    if(instrumentChart){ctx.drawImage(instrumentChart,0,0,191.5,180);return;}
    const loX=Math.max(0,metrics.x-.0175),loY=Math.max(0,metrics.y-.0175);
    const x=v=>18+(v-loX)/.035*164,y=v=>162-(v-loY)/.035*139;
    ctx.fillStyle='#222';ctx.font='bold 7.94px Courier New';ctx.fillText(`SDCM:${val('sdcm')||'—'}`,63,14);
    ctx.strokeStyle='#ddd';ctx.lineWidth=.4;ctx.setLineDash([3,3]);ctx.font='4.44px Arial';
    for(let i=0;i<=7;i++){const vx=loX+i*.005;ctx.beginPath();ctx.moveTo(x(vx),y(loY));ctx.lineTo(x(vx),y(loY+.035));ctx.stroke();ctx.fillText(vx.toFixed(3),x(vx)-5,171);}
    for(let i=0;i<=4;i++){const vy=loY+i*.035/4;ctx.beginPath();ctx.moveTo(x(loX),y(vy));ctx.lineTo(x(loX+.035),y(vy));ctx.stroke();ctx.fillText(vy.toFixed(3),0,y(vy)+1);}
    ctx.setLineDash([]);ctx.strokeStyle='#aaa';ctx.strokeRect(18,23,164,139);
    ctx.strokeStyle='#e55';ctx.lineWidth=.5;const px=x(metrics.x),py=y(metrics.y);ctx.beginPath();ctx.moveTo(px-3,py);ctx.lineTo(px+3,py);ctx.moveTo(px,py-3);ctx.lineTo(px,py+3);ctx.stroke();
    ctx.fillStyle='#555';ctx.font='4.44px Arial';ctx.fillText('Reference ellipse not supplied',65,177);
  }
  function resize() {
    if(window.innerWidth>760){$('paper').style.zoom='';return;}
    $('paper').style.zoom=Math.min(1,(window.innerWidth-28)/794);
  }
  $('file').addEventListener('change',async()=>{
    const file=$('file').files[0],rev=++revision;
    if(!file)return;
    chartRevision++;instrumentChart=null;$('colorChart').value='';
    $('print').disabled=true;$('status').textContent='正在读取光谱…';
    try {
      const content=await file.text(),table=await tablePromise;
      if(rev!==revision)return;
      const parsed=Spectrum.parse(content),result=Spectrum.analyze(parsed,table);
      points=parsed;metrics=result;reference=/^LED_3000K\./i.test(file.name);$('spec').value=file.name.replace(/\.[^.]+$/,'');
      $('status').textContent=`${points.length} 个采样点 · 相对 SPD${metrics.full?'':' · 可见波段覆盖不完整'}${/^LED_3000K\./i.test(file.name)?' · 示例光谱，非实测报告':''}`;
      render();
    }catch(e){if(rev!==revision)return;points=null;metrics=null;$('paper').hidden=true;$('empty').hidden=false;$('status').textContent=e.message;$('print').disabled=true;}
  });
  $('controls').addEventListener('input',e=>{if(e.target.id!=='file')render();});
  $('colorChart').addEventListener('change',async()=>{
    const file=$('colorChart').files[0],rev=++chartRevision;if(!file)return;
    const url=URL.createObjectURL(file),img=new Image();
    try{img.src=url;await img.decode();if(rev!==chartRevision)return;instrumentChart=img;render();}
    catch{$('status').textContent='色容差图无法读取';}finally{URL.revokeObjectURL(url);}
  });
  $('clearChart').addEventListener('click',()=>{chartRevision++;instrumentChart=null;$('colorChart').value='';render();});
  $('controls').addEventListener('submit',e=>e.preventDefault());
  $('print').addEventListener('click',async()=>{render();await drawChromaticity();if(!$('print').disabled)window.print();});
  window.addEventListener('resize',resize);
})();
