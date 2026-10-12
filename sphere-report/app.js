(() => {
  const $=id=>document.getElementById(id);
  const groups=[
    ['样品信息', [['sample','样品','LED'],['spec','规格'],['sampleNo','样品编号'],['manufacturer','厂家'],['date','测试日期','','datetime-local'],['sampleStatus','样品状态'],['instrument','仪器'],['tester','测试人'],['assessor','审核人']]],
    ['测试条件', [['temperature','温度（°C）','','number'],['rh','相对湿度（%）','','number'],['ip','IP'],['time','积分时间（ms）','','number'],['mode','测试模式'],['sensitivity','灵敏度']]],
    ['仪器色度结果', [['cct','色温（K）','','number'],['duv','Duv','','number'],['sdcm','SDCM','','number'],['dominant','主波长（nm）','','number'],['purity','色纯度（%）','','number'],['fwhm','半峰宽（nm）','','number'],['ratio','RGB 比例'],['ra','Ra','','number'],['rf','TM-30 Rf','','number'],['rg','TM-30 Rg','','number'],...Array.from({length:15},(_,i)=>['r'+(i+1),'R'+(i+1),'','number'])]],
    ['光度与电参数', [['flux','实测光通量（lm）','','number'],['radiant','实测辐射通量（mW）','','number'],['voltage','电压（V）','','number'],['current','电流（A）','','number'],['power','实测功率（W）','','number'],['pf','功率因数','','number'],['frequency','频率（Hz）','','number']]],
    ['报告页脚', [['footer','机构名称'],['website','网址']]]
  ];
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function field([id,label,value='',type='text']) {
    return `<label>${label}<input id="${id}" type="${type}" value="${esc(value)}" ${type==='number'?`step="any" ${id==='duv'?'':'min="0"'} ${id==='rh'||id==='purity'?'max="100"':id==='pf'?'max="1"':''}`:''}></label>`;
  }
  $('fields').innerHTML=groups.map(([title,items],i)=>i===0?items.map(field).join(''):`<details><summary>${title}</summary>${items.map(field).join('')}</details>`).join('');
  let points=null,metrics=null,revision=0,reference=false;
  const tablePromise=fetch('CIE_xyz_1931_2deg.csv').then(r=>{if(!r.ok)throw Error('色度数据加载失败');return r.text();}).then(t=>t.trim().split(/\r?\n/).map(r=>r.split(',').map(Number)));
  tablePromise.catch(()=>{});
  const val=id=>$(id).value.trim();
  const text=id=>esc(val(id)||'—');
  const row=(label,value)=>`<div class="row"><span>${label}</span><span>: ${value}</span></div>`;
  function render() {
    $('print').disabled=true;
    if(!points)return;
    if(!$('controls').checkValidity()){$('status').textContent='请检查参数数值';return;}
    const eff=val('flux')!==''&&Number(val('power'))>0?(Number(val('flux'))/Number(val('power'))).toFixed(2):'—';
    const range=`${points[0][0]}–${points.at(-1)[0]} nm`;
    $('paper').innerHTML=`<header class="report-head"><div class="brand"><img src="cdn-logo.png" alt="西顿照明"></div><h2>Spectrum Test Report</h2></header>
      <div class="meta">${row('Sample',text('sample'))}${row('Date',text('date').replace('T',' '))}${row('Specification',text('spec'))}${row('Sam. Status',text('sampleStatus'))}${row('Sample No.',text('sampleNo'))}${row('Instrument',text('instrument'))}${row('Manufacturer',text('manufacturer'))}${row('Test by',text('tester'))}${row('Assessor',text('assessor'))}</div>
      <h3>Test Condition</h3><div class="meta">${row('Temperature',text('temperature')+' °C')}${row('RH',text('rh')+' %')}${row('WL Range',range)}${row('IP',text('ip'))}${row('Test Mode',text('mode'))}${row('T',text('time')+' ms')}${row('Sensitivity',text('sensitivity'))}</div>
      <h3>Spectrum</h3><div class="graphs"><canvas id="spectrum" width="820" height="490"></canvas><canvas id="chromaticity" width="500" height="490"></canvas></div>
      <h3>Colorimetric Parameters</h3><div class="results">Chromaticity Coordinate: x = ${metrics.x.toFixed(4)} y = ${metrics.y.toFixed(4)} / u′ = ${metrics.u.toFixed(4)} v′ = ${metrics.v.toFixed(4)}<br>CCT = ${text('cct')} K &nbsp; Duv = ${text('duv')} &nbsp; SDCM = ${text('sdcm')}<br>Prcp WL: Ld = ${text('dominant')} nm &nbsp; Purity = ${text('purity')} %<br>Peak WL: Lp = ${metrics.peak} nm &nbsp; FWHM = ${text('fwhm')} nm &nbsp; Ratio: ${text('ratio')}<br>Render Index: Ra = ${text('ra')} &nbsp; TM30: Rf = ${text('rf')} Rg = ${text('rg')}<div class="cri">${Array.from({length:15},(_,i)=>`<span>R${i+1} = ${text('r'+(i+1))}</span>`).join('')}</div></div>
      <h3>Photometric &amp; Radiometric Parameters</h3><div class="results">Flux = ${text('flux')} lm &nbsp; Eff. = ${eff} lm/W &nbsp; Fe = ${text('radiant')} mW</div>
      <h3>Electrical Parameters</h3><div class="results">V = ${text('voltage')} V &nbsp; I = ${text('current')} A &nbsp; P = ${text('power')} W<br>PF = ${text('pf')} &nbsp; F = ${text('frequency')} Hz</div>
      <div class="note">Relative SPD · CIE 1931 2° · ${range}${metrics.full?'':' · Partial spectral coverage'}${reference?' · Reference spectrum; not a measured luminaire test':''}</div><footer>${text('footer')}<small>${val('website')?text('website'):''}</small></footer>`;
    $('paper').hidden=false;$('empty').hidden=true;
    drawSpectrum();drawChromaticity();resize();
    $('print').disabled=false;
  }
  function drawSpectrum() {
    const c=$('spectrum'),ctx=c.getContext('2d'),W=c.width,H=c.height;
    const lo=points[0][0],hi=points.at(-1)[0],max=Math.max(...points.map(p=>p[1]));
    const x=w=>60+(w-lo)/(hi-lo)*(W-80),y=p=>H-60-p/max*(H-110);
    ctx.fillStyle='white';ctx.fillRect(0,0,W,H);ctx.font='18px Arial';ctx.fillStyle='#222';ctx.fillText('Relative spectral power',16,26);
    ctx.strokeStyle='#ddd';ctx.lineWidth=1;
    for(let i=0;i<=5;i++){const v=i/5;ctx.beginPath();ctx.moveTo(60,y(v*max));ctx.lineTo(W-20,y(v*max));ctx.stroke();ctx.fillText(v.toFixed(1),14,y(v*max)+6);const w=lo+(hi-lo)*v;ctx.fillText(Math.round(w),x(w)-18,H-32);}
    const gradient=ctx.createLinearGradient(x(380),0,x(780),0);['#6727bb','#2547e8','#009bc3','#30c347','#ffe000','#ff6d00','#d60000'].forEach((col,i)=>gradient.addColorStop(i/6,col));
    ctx.beginPath();ctx.moveTo(x(lo),y(0));points.forEach(([w,p])=>ctx.lineTo(x(w),y(p)));ctx.lineTo(x(hi),y(0));ctx.closePath();ctx.fillStyle=gradient;ctx.fill();
    ctx.beginPath();points.forEach(([w,p],i)=>i?ctx.lineTo(x(w),y(p)):ctx.moveTo(x(w),y(p)));ctx.strokeStyle='#333';ctx.lineWidth=1.5;ctx.stroke();ctx.fillStyle='#222';ctx.fillText('Wavelength (nm)',W/2-60,H-7);
  }
  async function drawChromaticity() {
    const canvas=$('chromaticity'),ctx=canvas.getContext('2d'),table=await tablePromise;
    if(!canvas.isConnected)return;
    const x=v=>55+v/.8*405,y=v=>430-v/.9*370;
    ctx.fillStyle='white';ctx.fillRect(0,0,500,490);ctx.fillStyle='#222';ctx.font='18px Arial';ctx.fillText('CIE 1931 chromaticity',100,26);ctx.strokeStyle='#ddd';ctx.lineWidth=1;
    for(let i=0;i<=8;i++){ctx.beginPath();ctx.moveTo(x(i/10),y(0));ctx.lineTo(x(i/10),y(.9));ctx.stroke();ctx.fillText((i/10).toFixed(1),x(i/10)-10,455);ctx.beginPath();ctx.moveTo(x(0),y(i/10));ctx.lineTo(x(.8),y(i/10));ctx.stroke();ctx.fillText((i/10).toFixed(1),10,y(i/10)+5);}
    ctx.beginPath();table.filter(r=>r[0]>=380&&r[0]<=780).forEach(([,X,Y,Z],i)=>{const s=X+Y+Z;i?ctx.lineTo(x(X/s),y(Y/s)):ctx.moveTo(x(X/s),y(Y/s));});ctx.closePath();ctx.strokeStyle='#444';ctx.lineWidth=2;ctx.stroke();
    ctx.strokeStyle='#d7363f';ctx.lineWidth=3;const px=x(metrics.x),py=y(metrics.y);ctx.beginPath();ctx.moveTo(px-9,py);ctx.lineTo(px+9,py);ctx.moveTo(px,py-9);ctx.lineTo(px,py+9);ctx.stroke();ctx.fillStyle='#222';ctx.fillText(`x ${metrics.x.toFixed(4)}  y ${metrics.y.toFixed(4)}`,90,480);
  }
  function resize() {
    if(window.innerWidth>760){$('paper').style.zoom='';return;}
    $('paper').style.zoom=Math.min(1,(window.innerWidth-28)/794);
  }
  $('file').addEventListener('change',async()=>{
    const file=$('file').files[0],rev=++revision;
    if(!file)return;
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
  $('controls').addEventListener('submit',e=>e.preventDefault());
  $('print').addEventListener('click',async()=>{render();await drawChromaticity();if(!$('print').disabled)window.print();});
  window.addEventListener('resize',resize);
})();
