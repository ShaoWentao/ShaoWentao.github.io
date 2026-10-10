(() => {
  const $=id=>document.getElementById(id), P=window.RoadPhotometry;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt=v=>Number.isFinite(v)?v.toFixed(2):'--';
  let data=null,zone=[],total=0;
  const titles=['STREETLIGHT PHOTOMETRIC TEST REPORT','STREETLIGHT ISOCANDELA DIAGRAM','COEFFICIENT OF UTILIZATION CURVE AND ISOLUX DIAGRAM','ZONAL FLUX DIAGRAM','ISOCANDELA DIAGRAM','PLANAR ILLUMINANCE CURVE','LCS REPORT','BUG REPORT','ROAD ISOCANDELA REPORT','LUMINOUS DISTRIBUTION INTENSITY DATA'];
  const field=id=>esc($(id).value);
  const table=(headers,rows)=>`<table><thead><tr>${headers.map(v=>`<th>${esc(v)}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr>${row.map(v=>`<td>${esc(v)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  function metadata(){return `<table class="metadata"><tr><td>NAME: ${field('name')}</td><td>MODEL: ${field('model')}</td></tr><tr><td>MFR.: ${field('manufacturer')}</td><td>SPEC.: ${field('spec')}</td></tr><tr><td>POWER: ${fmt(data.power)} W</td><td>TOTAL FLUX: ${fmt(total)} lm</td></tr></table>`;}
  function canvas(id,title){return `<div class="chart"><h3>${title}</h3><canvas id="${id}" width="900" height="600"></canvas></div>`;}
  function page(title,content,meta=true){return `<article class="paper"><header><span>${field('lab')}</span><span class="page-number"></span></header><h2>${title}</h2>${meta?metadata():''}${content}<footer>C range: ${data.horizontal[0]} - ${data.horizontal.at(-1)} DEG; Gamma range: ${data.vertical[0]} - ${data.vertical.at(-1)} DEG<br>Mounting height: ${field('height')} m | Tilt: ${field('tilt')} DEG | Street side center: C${field('orientation')}<br>Test date: ${field('date')} | Remarks: ${field('remarks')}</footer></article>`;}
  function chart(id,xmin,xmax,ymin,ymax,xlabel,ylabel,lines){
    const ctx=$(id).getContext('2d'),w=900,h=600,L=80,R=820,T=45,B=525;
    ctx.fillStyle='#fff';ctx.fillRect(0,0,w,h);ctx.font='20px Arial';
    const px=x=>L+(x-xmin)/(xmax-xmin)*(R-L),py=y=>B-(y-ymin)/(ymax-ymin)*(B-T);
    for(let i=0;i<=10;i++){const x=L+i*(R-L)/10,y=T+i*(B-T)/10;ctx.strokeStyle='#d9dfdc';ctx.beginPath();ctx.moveTo(x,T);ctx.lineTo(x,B);ctx.moveTo(L,y);ctx.lineTo(R,y);ctx.stroke();ctx.fillStyle='#333';ctx.fillText(fmt(xmin+i*(xmax-xmin)/10),x-15,B+30);ctx.fillText(fmt(ymax-i*(ymax-ymin)/10),5,y+6);}
    ctx.fillText(xlabel,350,585);ctx.fillText(ylabel,80,25);
    lines.forEach((line,j)=>{ctx.strokeStyle=line.color;ctx.lineWidth=3;ctx.beginPath();line.points.forEach(([x,y],i)=>i?ctx.lineTo(px(x),py(y)):ctx.moveTo(px(x),py(y)));ctx.stroke();ctx.fillStyle=line.color;ctx.fillText(line.name,100+j*180,55);});
  }
  function polar(){const ctx=$('polar').getContext('2d'),cx=450,cy=300,r=240;ctx.fillStyle='#fff';ctx.fillRect(0,0,900,600);ctx.font='18px Arial';for(let i=1;i<=5;i++){ctx.strokeStyle='#bbb';ctx.beginPath();ctx.arc(cx,cy,r*i/5,0,Math.PI*2);ctx.stroke();ctx.fillStyle='#444';ctx.fillText(fmt(data.peak*i/5),cx+8,cy+r*i/5);}for(let a=0;a<360;a+=30){ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(cx+r*Math.sin(a*P.rad),cy+r*Math.cos(a*P.rad));ctx.stroke();ctx.fillText(a+'°',cx+(r+22)*Math.sin(a*P.rad)-10,cy+(r+22)*Math.cos(a*P.rad));}[[0,180,'#d33737'],[90,270,'#326ccc']].forEach(([c1,c2,color])=>{ctx.strokeStyle=color;ctx.lineWidth=3;ctx.beginPath();for(let a=-180;a<=180;a++){const v=P.intensity(data,a<0?c2:c1,Math.abs(a))/data.peak*r;const x=cx+v*Math.sin(a*P.rad),y=cy+v*Math.cos(a*P.rad);a===-180?ctx.moveTo(x,y):ctx.lineTo(x,y);}ctx.stroke();});ctx.fillStyle='#d33737';ctx.fillText('C0/180',35,35);ctx.fillStyle='#326ccc';ctx.fillText('C90/270   UNIT: cd',220,35);}
  function map(id,mode,road=false){
    const ctx=$(id).getContext('2d'),h=Number($('height').value),tilt=Number($('tilt').value),o=Number($('orientation').value);
    const L=90,T=60,W=660,H=450,levels=[.025,.05,.1,.2,.3,.4,.5,.6,.7,.8,.9],colors=['#eedff5','#c7b5eb','#9ea3dc','#78c3de','#75d0b0','#96d66d','#d6df5b','#efc95a','#ee9d59','#e77561','#d64154'];
    const max=mode==='angle'?data.peak:mode==='lux'?P.ground(data,0,0,h,tilt,o).e||data.peak/h**2:data.peak;
    ctx.fillStyle='white';ctx.fillRect(0,0,900,600);
    const value=(u,v)=>mode==='angle'?P.intensity(data,u,v):P.ground(data,u*h,v*h,h,tilt,o)[mode==='lux'?'e':'i'];
    for(let j=0;j<150;j++)for(let i=0;i<220;i++){const u=mode==='angle'?i/219*360:(i/219*14-7),v=mode==='angle'?j/149*90:(j/149*8-4);const f=value(u,v)/max;let k=levels.findLastIndex(l=>f>=l);ctx.fillStyle=k<0?'#fff':colors[k];ctx.fillRect(L+i*3,T+j*3,3,3);}
    ctx.font='19px Arial';ctx.fillStyle='#333';for(let i=0;i<=8;i++){ctx.strokeStyle='#aaa';ctx.beginPath();ctx.moveTo(L,T+i*H/8);ctx.lineTo(L+W,T+i*H/8);ctx.stroke();ctx.fillText(mode==='angle'?fmt(i*90/8):fmt(i-4),35,T+i*H/8+5);}for(let i=0;i<=14;i+=2){ctx.beginPath();ctx.moveTo(L+i*W/14,T);ctx.lineTo(L+i*W/14,T+H);ctx.stroke();ctx.fillText(mode==='angle'?fmt(i*360/14):String(i-7),L+i*W/14-10,T+H+30);}levels.forEach((l,i)=>{ctx.fillStyle=colors[i];ctx.fillRect(770,70+i*35,18,18);ctx.fillStyle='#222';ctx.fillText(fmt(l*max),795,87+i*35);});ctx.fillText(mode==='angle'?'C (DEG) / Gamma (DEG)':'X/MH / Y/MH',280,575);ctx.fillText(mode==='lux'?'UNIT: lx':'UNIT: cd',90,30);if(road){ctx.fillText('Road projection / Street axis: C'+o,200,30);}}
  function render(){
    if(!data)return;
    const h=Number($('height').value),tilt=Number($('tilt').value),o=Number($('orientation').value);
    if(!(h>=.1&&h<=100) || !Number.isFinite(tilt)||Math.abs(tilt)>60){$('status').textContent='请填写有效安装高度和倾角';$('print').disabled=true;return;}
    $('print').disabled=false;zone=P.zones(data,o);total=zone.reduce((s,z)=>s+z.front+z.back,0);
    const sum=(side,a,b)=>zone.slice(a/10,b/10).reduce((s,z)=>s+z[side],0);
    const bands=[[0,30,'Low'],[30,60,'Medium'],[60,80,'High'],[80,90,'Very High']];
    const lcs=['front','back'].flatMap(side=>bands.map(([a,b,label])=>[`${side} ${label} (${a}-${b})`,fmt(sum(side,a,b)),fmt(sum(side,a,b)/total*100)]));
    lcs.push(...[[90,100,'Uplight Low'],[100,180,'Uplight High']].map(([a,b,label])=>[label,fmt(sum('front',a,b)+sum('back',a,b)),fmt((sum('front',a,b)+sum('back',a,b))/total*100)]));
    const contents=[canvas('polar','INTENSITY DISTRIBUTION IN C PLANES')+canvas('cone','MAX INTENSITY CONE SURFACE')+`<p class="metric">Imax: ${fmt(data.peak)} cd | Efficiency: ${data.power>0?fmt(total/data.power):'--'} lm/W</p>`,canvas('street','STREETLIGHT ISOCANDELA / C-GAMMA')+'<p class="note">IES / CIE classification: Pending verification</p>',canvas('cu','STREET / HOUSE SIDE UTILIZATION')+canvas('isolux','ROAD SURFACE ISOLUX')+'<p class="note">Single luminaire, horizontal receiving plane. Height conversion factor: (current MH / new MH)².</p>',table(['Gamma zone','Street (lm)','House (lm)','Total (lm)','Cumulative (lm)'],zone.map((z,i)=>[`${i*10}-${(i+1)*10}`,fmt(z.front),fmt(z.back),fmt(z.front+z.back),fmt(zone.slice(0,i+1).reduce((s,q)=>s+q.front+q.back,0))])),canvas('angular','ISOCANDELA / C-GAMMA'),canvas('planar','PLANAR ILLUMINANCE'),canvas('lcs','LCS FLUX BY VERTICAL ZONE'),table(['Zone','Lumens','Luminaire %'],lcs)+'<p class="note">BUG rating: Pending verification. Flux zones are calculated from IES data; no rating is assigned.</p>',canvas('road','ROAD SURFACE INTENSITY PROJECTION')+'<p class="note">Distribution type / throw classification: Pending verification.</p>'];
    const tablePages=[];const planes=data.horizontal.filter(c=>c<360);for(let start=0;start<planes.length;start+=8){const angles=planes.slice(start,start+8);for(let row=0;row<data.vertical.length;row+=32){tablePages.push(table(['Gamma / C',...angles.map(c=>'C'+c)],data.vertical.slice(row,row+32).map(v=>[v,...angles.map(c=>fmt(P.intensity(data,c,v)))])));}}
    $('pages').innerHTML=contents.map((content,i)=>page(titles[i],content)).join('')+tablePages.map(content=>page(titles[9],content)).join('');
    const papers=document.querySelectorAll('.paper');papers.forEach((p,i)=>p.querySelector('.page-number').textContent=`Page ${i+1} Of ${papers.length}`);$('count').textContent=papers.length+' 页';$('empty').hidden=true;
    polar();
    let peakG=0,peakC=0;data.matrix.forEach((row,i)=>row.forEach((v,j)=>{if(v===data.peak){peakG=data.vertical[j];peakC=data.horizontal[i];}}));
    chart('cone',0,360,0,data.peak*1.1,'C (DEG)','cd',[{name:'Gamma '+peakG+' DEG',color:'#bc3636',points:Array.from({length:361},(_,c)=>[c,P.intensity(data,c,peakG)])}]);
    map('street','angle');map('angular','angle');map('isolux','lux');map('road','intensity',true);
    const points=Array.from({length:201},(_,i)=>i/200*10-5);
    const curve=c=>points.map(x=>[x*h,P.ground(data,x*h*Math.cos(c*P.rad),x*h*Math.sin(c*P.rad),h,tilt,o).e]);
    const a=curve(0),b=curve(90);chart('planar',-5*h,5*h,0,Math.max(...a.map(p=>p[1]),...b.map(p=>p[1]))*1.1||1,'Distance (m)','E (lx)',[{name:'C0/180',color:'#c43434',points:a},{name:'C90/270',color:'#336ccc',points:b}]);
    chart('lcs',0,180,0,Math.max(...zone.map(z=>Math.max(z.front,z.back)))*1.1||1,'Gamma zone (DEG)','Flux (lm)',['front','back'].map((side,i)=>({name:side,color:i?'#336ccc':'#16a08a',points:zone.map((z,j)=>[j*10+5,z[side]])})));
    // Integrate ground illuminance over a growing strip; tilted IES directions use the same transform as the ground plots.
    const cu=['front','back'].map((side,j)=>{let accumulated=0;const p=[[0,0]];for(let k=1;k<=40;k++){const x=(k-.5)*h/10*(j?-1:1);for(let y=-10*h;y<=10*h;y+=h/10){const gx=x*Math.cos(o*P.rad)-y*Math.sin(o*P.rad),gy=x*Math.sin(o*P.rad)+y*Math.cos(o*P.rad);accumulated+=P.ground(data,gx,gy,h,tilt,o).e*h*h/100;}p.push([k/10,total?accumulated/total*100:0]);}return{name:side,color:j?'#336ccc':'#16a08a',points:p};});
    chart('cu',0,4,0,100,'Distance / MH','CU (%)',cu);$('status').textContent=`已生成 ${papers.length} 页 · ${fmt(total)} lm · 最大光强方向 C${peakC} / Gamma ${peakG}°`;
  }
  $('file').addEventListener('change',async()=>{const file=$('file').files[0];if(!file)return;try{const parsed=P.parse(await file.text());if(parsed.peak<=0)throw Error('文件中没有有效光强');data=parsed;const k=data.keywords;$('model').value=k.LUMCAT||k.LUMINAIRE||file.name;$('manufacturer').value=k.MANUFAC||'';$('name').value=k.LUMINAIRE||'Streetlight';render();}catch(e){$('status').textContent=e.message;$('print').disabled=true;}});
  $('sample').addEventListener('click',()=>{const v=Array.from({length:181},(_,i)=>i),c=[0,45,90,135,180,225,270,315,360];const values=c.flatMap(a=>v.map(g=>g<90?1500*Math.exp(-Math.pow((g-55)/22,2))*(1+.5*Math.cos(a*P.rad)):0));data=P.parse(`IESNA:LM-63-2002\n[MANUFAC] Demo\n[LUMCAT] ROAD-DEMO\nTILT=NONE\n1 -1 1 181 9 1 2 .2 .5 .1\n1 1 40\n${v.join(' ')}\n${c.join(' ')}\n${values.join(' ')}`);$('model').value='ROAD-DEMO (synthetic)';$('manufacturer').value='Demo';render();});
  let timer; $('controls').addEventListener('input',e=>{if(e.target.id==='file')return;clearTimeout(timer);timer=setTimeout(render,250);});$('controls').addEventListener('submit',e=>e.preventDefault());$('print').addEventListener('click',()=>window.print());
})();
