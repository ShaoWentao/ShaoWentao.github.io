/* Report geometry and placement follow the supplied ten-page photometric report. */
window.RoadReportTemplate = (() => {
  const P = window.RoadPhotometry;
  const $ = id => document.getElementById(id);
  const escape = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const value = id => escape($(id).value);
  const f = n => Number.isFinite(n) ? Number(n.toPrecision(4)).toString() : '';
  const colors = ['#ff5050','#38d637','#7979ff','#29dadd','#999999','#dddd27','#ed60e8','#5ac8fa','#ff9966','#666666'];
  const levels = [.9,.8,.7,.6,.5,.4,.3,.2,.1,.05];
  const titles = ['STREETLIGHT PHOTOMETRIC TEST REPORT','STREETLIGHT ISOCANDELA DIAGRAM','COEFFICIENT OF UTILIZATION CURVE<br>AND ISOLUX DIAGRAM','ZONAL FLUX DIAGRAM','ISOCANDELA DIAGRAM','Planar Illuminance Curve','LCS REPORT','BUG REPORT','ROAD ISOCANDELA REPORT','LUMINOUS DISTRIBUTION INTENSITY DATA'];
  const table = (headers, rows, cls='') => `<table class="${cls}"><thead><tr>${headers.map(v=>`<th>${escape(v)}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr>${row.map(v=>`<td>${escape(v)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  const cv = (id,title='') => `<div class="figure figure-${id}">${title?`<h3>${title}</h3>`:''}<canvas id="${id}" width="1000" height="700"></canvas></div>`;
  function metadata(d,total) {
    const test = d.keywords.TEST || '';
    return `<table class="metadata"><tbody><tr><td colspan="3">Test: P:${f(d.power)}W &nbsp; Lamp Flux:${f(total)} lm</td></tr><tr><td>NAME: ${value('name')}</td><td>TYPE: ${escape(d.keywords.LUMCAT||'')}</td><td>WEIGHT:</td></tr><tr><td>SPEC.: ${value('spec')}</td><td>DIM.: ${[d.width,d.length,d.height].map(f).join(' × ')} ${d.units===1?'ft':'m'}</td><td>SERIAL No.: ${escape(test)}</td></tr><tr><td>MFR.: ${value('manufacturer')}</td><td>SUR.: ${escape(d.keywords.APERTURE||'')}</td><td>Shielding Angle:</td></tr></tbody></table>`;
  }
  function footer(d) {
    const step = a => a.length>1?f(a[1]-a[0]):'0';
    return `<footer><div>C Range: ${f(d.horizontal[0])} - ${f(d.horizontal.at(-1))}DEG<br>C Interval: ${step(d.horizontal)}DEG<br>Test Speed: ${escape(d.keywords.TESTSPEED||'')}<br>Temperature: ${escape(d.keywords.TEMPERATURE||'')}<br>Operators: ${escape(d.keywords.OPERATOR||'')}<br>Test Date: ${value('date')}</div><div>γ Range: ${f(d.vertical[0])} - ${f(d.vertical.at(-1))}DEG<br>γ Interval: ${step(d.vertical)}DEG<br>Test System: ${escape(d.keywords.TESTLAB||'')}<br>Humidity: ${escape(d.keywords.HUMIDITY||'')}<br>Test Distance: ${escape(d.keywords.TESTDISTANCE||'')}<br>Remarks: ${value('remarks')}</div></footer>`;
  }
  function peak(d) {
    let best={c:0,g:0,i:0};d.matrix.forEach((row,i)=>row.forEach((v,j)=>{if(v>best.i)best={c:d.horizontal[i],g:d.vertical[j],i:v};}));return best;
  }
  function band(z,side,a,b){return z.slice(a/10,b/10).reduce((s,v)=>s+v[side],0);}
  function build(d,z,total) {
    const max=peak(d),up=band(z,'front',90,180)+band(z,'back',90,180);
    const percent = n => f(n/total*100);
    const rated = d.lumens>0?d.lumens*d.lamps:null;
    const lamp = `<table class="lamp"><colgroup><col class="lamp-label"><col class="lamp-value"><col class="lamp-label"><col class="lamp-value"><col class="lamp-label"><col class="lamp-value"></colgroup><thead><tr><th colspan="2">DATA OF LAMP</th><th colspan="4">PHOTOMETRIC DATA &nbsp; Eff: ${d.power>0?f(total/d.power):''} lm/W</th></tr></thead><tbody>${[
      ['MODEL',value('model'),'Imax(cd)',f(max.i),'η street_up(%)',percent(band(z,'front',90,180))],
      ['NOMINAL POWER(W)',escape(d.keywords.NOMINALPOWER||''),'LOR(%)',rated?f(total/rated*100):'','η street_down(%)',percent(band(z,'front',0,90))],
      ['RATED VOLTAGE(V)',escape(d.keywords.VOLTAGE||''),'TOTAL FLUX(lm)',f(total),'η house_up(%)',percent(band(z,'back',90,180))],
      ['NOMINAL FLUX(lm)',rated?f(rated):'','MAXIMUM @(C,γ)',`${f(max.c)},${f(max.g)}`,'η house_down(%)',percent(band(z,'back',0,90))],
      ['LAMPS INSIDE',f(d.lamps),'η up(%)',percent(up),'76 FLASHAREA(m²)',''],
      ['TEST VOLTAGE(V)','','η down(%)',percent(total-up),'SLI','']
    ].map(row=>`<tr><td colspan="2"><span class="lamp-field-label">${row[0]}</span> ${row[1]}</td>${row.slice(2).map(v=>`<td>${v}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
    const legend=table(['ISOCANDELA DIAGRAM','cd'],[['Imax=100%',f(max.i)],...levels.map((l,i)=>[`${l*100}%`,f(l*max.i)])],'level-table');
    const normalizedAt = g => Math.max(...Array.from({length:360},(_,c)=>P.intensity(d,c,g)))/total*1000;
    const classification=`<div class="classification">Classification:<br><br>IES: <span></span><br>CIE: <span></span><br>CIE cut-off: <span></span><br>IES cut-off: <span></span><br>Max.At80: ${f(normalizedAt(80))}cd/klm<br>Max.At90: ${f(normalizedAt(90))}cd/klm<br>Max.80-90: ${f(Math.max(...Array.from({length:11},(_,i)=>normalizedAt(80+i))))}cd/klm</div>`;
    const height=Number($('height').value);
    const heightTable=table(['HEIGHT','FACTOR'],Array.from({length:12},(_,i)=>[`${i+5} m`,Math.pow(height/(i+5),2).toFixed(3)]));
    const rows=Array.from({length:18},(_,i)=>{const g=(i+1)*10,flux=z[i].front+z[i].back,cumulative=z.slice(0,i+1).reduce((s,q)=>s+q.front+q.back,0);return[g,`${g-10}-${g}`,...[0,45,90,135,180,225,270,315].map(c=>f(P.intensity(d,c,g))),f(flux),f(cumulative),`${percent(cumulative)},${rated?f(cumulative/rated*100):''}`];});
    const zones=['front','back'].flatMap(side=>[[0,30,'Low'],[30,60,'Medium'],[60,80,'High'],[80,90,'Very High']].map(([a,b,label])=>[`${side==='front'?'F':'B'}${label==='Very High'?'VH':label[0]} - ${side==='front'?'Front':'Back'}-${label}(${a}-${b})`,f(band(z,side,a,b)),percent(band(z,side,a,b))]));
    zones.splice(4,0,['Total Forward Light',f(band(z,'front',0,90)),percent(band(z,'front',0,90))]);zones.push(['Total Back Light',f(band(z,'back',0,90)),percent(band(z,'back',0,90))],['UL - Uplight-Low(90-100)',f(band(z,'front',90,100)+band(z,'back',90,100)),percent(band(z,'front',90,100)+band(z,'back',90,100))],['UH - Uplight-High(100-180)',f(band(z,'front',100,180)+band(z,'back',100,180)),percent(band(z,'front',100,180)+band(z,'back',100,180))],['Total Up Light',f(up),percent(up)]);
    const contents=[
      lamp+`<div class="twin">${cv('polar','INTENSITY DISTRIBUTION DIAGRAM<br>IN C PLANS')}${cv('cone','MAX INTENSITY CONE SURFACE<br>DISTRIBUTION DIAGRAM')}</div>`,
      `<div class="sphere-layout">${cv('street')}<div>${classification}${legend}</div></div>`,
      cv('cu','STREETLIGHT COEFFICIENT OF UTILIZATION CURVE')+`<div class="isolux-box"><h3>ROAD SURFACE ISOLUX DIAGRAM<br>ILLUMINANCE AT MH=${f(height)} m, Enadir=${f(P.ground(d,0,0,height,Number($('tilt').value),Number($('orientation').value)).e)} lx<br>TO CONVERT TO OTHER MH,MULTIPLY BY FACTOR IN THE TABLE.</h3><div class="isolux-layout">${cv('isolux')}${heightTable}</div></div>`,
      table(['γ','γ DEG','C0','C45','C90','C135','C180','C225','C270','C315','Φ zone','Φ total','%lum,lamp'],rows,'zonal'),
      cv('angular'),cv('planar','Planar Illuminance Curve'),cv('lcs','LUMINAIRE CLASSIFICATION SYSTEM(LCS) GRAPH'),
      `<div class="bug-table"><p>IESNA Luminaire Flux Distribution Table:</p>${table(['Zone','Lumens','Luminaire %'],zones)}<h3>BUG(Back,Up,Glare) Rating <span class="blank-rating"></span></h3>${table(['Zone','Downward Lumens','Upward Lumens','Total Lumens'],['back','front'].map(side=>[side==='back'?'House Side':'Street Side',f(band(z,side,0,90)),f(band(z,side,90,180)),f(band(z,side,0,180))]))}</div>`,cv('road','ROAD SURFACE ISOCANDELA DIAGRAM')
    ];
    const planes=d.horizontal.filter(c=>c<360);
    const vertical=Array.from({length:Math.floor(d.vertical.at(-1)/5)+1},(_,i)=>i*5).filter(g=>g>=d.vertical[0]);
    for(let col=0;col<planes.length;col+=12){for(let row=0;row<vertical.length;row+=37){const angles=planes.slice(col,col+12),gs=vertical.slice(row,row+37);contents.push(`<div class="candela-caption">γ(DEG) / C(DEG) &nbsp; UNIT: cd &nbsp; Table--${contents.length-8}</div>`+table(['γ',...angles.map(f)],gs.map(g=>[f(g),...angles.map(c=>f(P.intensity(d,c,g)))]),'candela'));}}
    return contents.map((content,i)=>`<article class="paper page-${Math.min(i+1,10)}"><header><span>${value('lab')}</span><span class="page-number">Page ${i+1} Of ${contents.length}</span></header><h2>${titles[Math.min(i,9)]}</h2>${[2,5].includes(i)?'':metadata(d,total)}<div class="report-body">${content}</div>${footer(d)}</article>`).join('');
  }
  function context(id,width=1000,height=700){const canvas=$(id);canvas.width=width;canvas.height=height;const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,width,height);const displayedWidth=canvas.getBoundingClientRect().width||width;const labelSize=window.matchMedia('print').matches?10:13;ctx.font=`${Math.round(labelSize*width/displayedWidth)}px "Courier New", Courier, monospace`;ctx.fillStyle='#111';ctx.lineWidth=1;return ctx;}
  function line(ctx,points,color='#aaa',width=1){ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.stroke();}
  function circle(ctx,x,y,r){ctx.strokeStyle='#aaa';ctx.lineWidth=1;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.stroke();}
  function polar(d,id,cone=false){const ctx=context(id,700,800),x=350,y=360,r=270,max=peak(d),scale=d3.tickStep(0,max.i,5)*Math.ceil(max.i/d3.tickStep(0,max.i,5));
    for(let i=1;i<=5;i++){circle(ctx,x,y,r*i/5);ctx.fillText(f(scale*i/5),x+8,y+r*i/5);}
    for(let a=-180;a<180;a+=15){line(ctx,[[x,y],[x+r*Math.sin(a*P.rad),y+r*Math.cos(a*P.rad)]]);if(a%30===0)ctx.fillText(cone?'C'+((a+360)%360):String(a),x+(r+24)*Math.sin(a*P.rad)-15,y+(r+24)*Math.cos(a*P.rad)+5);}
    if(cone){line(ctx,Array.from({length:361},(_,c)=>{const radius=P.intensity(d,c,max.g)/scale*r;return[x+radius*Math.sin(c*P.rad),y+radius*Math.cos(c*P.rad)];}),'#ff5555',2);ctx.fillText('HOUSE SIDE',450,40);ctx.fillText(`Max @ γ = ${f(max.g)}DEG STREET SIDE`,80,710);}
    else{[[0,180,'#ff5555'],[90,270,'#22cf32']].forEach(([a,b,color],i)=>{line(ctx,Array.from({length:361},(_,j)=>{const g=j-180,v=P.intensity(d,g<0?b:a,Math.abs(g))/scale*r;return[x+v*Math.sin(g*P.rad),y+v*Math.cos(g*P.rad)];}),color,2);ctx.fillStyle=color;ctx.fillText(`C${a}/${b}`,160,730+i*25);});ctx.fillStyle='#111';ctx.fillText('UNIT:cd',550,550);}
  }
  function contours(ctx,box,range,sample,thresholds,palette){const [L,T,W,H]=box,[xmin,xmax,ymin,ymax]=range,nx=181,ny=181,values=Array.from({length:nx*ny},(_,i)=>sample(xmin+(i%nx)/(nx-1)*(xmax-xmin),ymin+Math.floor(i/nx)/(ny-1)*(ymax-ymin)));
    const shapes=d3.contours().size([nx,ny]).thresholds(thresholds)(values);ctx.save();ctx.beginPath();ctx.rect(L,T,W,H);ctx.clip();ctx.translate(L,T);ctx.scale(W/nx,H/ny);const path=d3.geoPath(null,ctx);shapes.forEach((shape,i)=>{ctx.beginPath();path(shape);ctx.strokeStyle=palette[i%palette.length];ctx.lineWidth=1.4/(W/nx);ctx.stroke();});ctx.restore();}
  function sphere(d){const ctx=context('street',760,850),cx=360,cy=440,r=310;const bounds=[cx-r,cy-r,r*2,r*2];
    contours(ctx,bounds,[-1,1,-1,1],(x,y)=>{if(x*x+y*y>1)return -1;const g=Math.acos(y)/P.rad,s=Math.sin(g*P.rad);const c=s>1e-8?Math.asin(Math.max(-1,Math.min(1,x/s)))/P.rad:0;return P.intensity(d,c,g);},[...levels].reverse().map(v=>v*d.peak),[...colors].reverse());
    circle(ctx,cx,cy,r);for(let g=0;g<=180;g+=5){const points=Array.from({length:181},(_,i)=>{const c=(i-90)*P.rad;return[cx+r*Math.sin(c)*Math.sin(g*P.rad),cy+r*Math.cos(g*P.rad)];});line(ctx,points);if(g%10===0)ctx.fillText(String(g),cx+r*Math.sin(g*P.rad)+8,cy+r*Math.cos(g*P.rad));}
    for(let c=-90;c<=90;c+=5){line(ctx,Array.from({length:181},(_,g)=>[cx+r*Math.sin(c*P.rad)*Math.sin(g*P.rad),cy+r*Math.cos(g*P.rad)]));if(c%15===0)ctx.fillText(c<0?String(360+c):c===0?'C0':String(c),cx+r*Math.sin(c*P.rad)-12,cy-5);}
    ctx.fillText('γ 0',cx-15,cy+r+35);
  }
  function ground(d,x,y,h,tilt,o){return P.ground(d,y*h*Math.cos(o*P.rad)-x*h*Math.sin(o*P.rad),y*h*Math.sin(o*P.rad)+x*h*Math.cos(o*P.rad),h,tilt,o);}
  function grid(ctx,box,range,xstep=1,ystep=1,inverted=false){const[L,T,W,H]=box,[xmin,xmax,ymin,ymax]=range;for(let x=Math.ceil(xmin/xstep)*xstep;x<=xmax;x+=xstep){const px=L+(x-xmin)/(xmax-xmin)*W;line(ctx,[[px,T],[px,T+H]],'#bbb');ctx.fillStyle='#111';ctx.fillText(f(x),px-10,T+H+25);}for(let y=Math.ceil(ymin/ystep)*ystep;y<=ymax;y+=ystep){const fraction=(y-ymin)/(ymax-ymin),py=T+(inverted?1-fraction:fraction)*H;line(ctx,[[L,py],[L+W,py]],'#bbb');ctx.fillText(f(y),L-42,py+5);}}
  function plane(d,id,h,tilt,o){const ctx=context(id),angular=id==='angular',box=angular?[130,70,660,540]:[100,70,780,450],range=angular?[-30,30,-30,30]:[-7,7,-1,4];
    const thresholds=angular?levels.slice(0,9).map(l=>l*d.peak).sort((a,b)=>a-b):[.005,.01,.02,.05,.1,.3,.4,.5,.6,.8].map(l=>l*d.peak/h**2);
    contours(ctx,box,range,(x,y)=>{if(!angular)return ground(d,x,y,h,tilt,o).e;const tx=Math.tan(x*P.rad),ty=Math.tan(y*P.rad);return P.intensity(d,Math.atan2(ty,tx)/P.rad,Math.atan(Math.hypot(tx,ty))/P.rad);},thresholds,colors);
    grid(ctx,box,range,angular?3:1,angular?3:1);ctx.fillText(angular?'HORIZONTAL(DEG)':'RATIO OF DISTANCE TO MOUNTING HEIGHT',220,660);ctx.save();ctx.translate(35,440);ctx.rotate(-Math.PI/2);ctx.fillText(angular?'VERTICAL(DEG)':'STREET SIDE D/MH HOUSE SIDE',0,0);ctx.restore();thresholds.forEach((n,i)=>{ctx.fillStyle=colors[i];ctx.fillText(f(n),angular?830:80+(i%5)*170,angular?100+i*35:570+Math.floor(i/5)*25);});
  }
  function lcs(z){const ctx=context('lcs',1000,1000),cx=500,cy=490,r=385,bands=[[0,30],[30,60],[60,80],[80,90]],up=band(z,'front',90,100)+band(z,'back',90,100),upper=band(z,'front',100,180)+band(z,'back',100,180);const maximum=Math.max(up,upper,...bands.flatMap(([a,b])=>['front','back'].map(side=>band(z,side,a,b))));const scale=d3.tickStep(0,maximum,5)*Math.ceil(maximum/d3.tickStep(0,maximum,5))||1;
    function sector(a,b,v,color){ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(cx,cy);ctx.arc(cx,cy,v/scale*r,(90-b)*P.rad,(90-a)*P.rad);ctx.closePath();ctx.fill();}
    bands.forEach(([a,b])=>{sector(a,b,band(z,'front',a,b),'#93f6f6');sector(-b,-a,band(z,'back',a,b),'#0081b7');});sector(90,100,up,'#ddd56b');sector(100,180,upper,'#edd570');
    for(let i=1;i<=5;i++){circle(ctx,cx,cy,r*i/5);ctx.fillStyle='#111';ctx.fillText(`${f(scale*i/5)}${i===5?'(lm)':''}`,cx+4,cy-r*i/5+18);}
    for(const a of [-100,-90,-80,-60,-30,0,30,60,80,90,100,180]){line(ctx,[[cx,cy],[cx+r*Math.sin(a*P.rad),cy+r*Math.cos(a*P.rad)]]);ctx.fillText(String(Math.abs(a)),cx+(r+25)*Math.sin(a*P.rad)-12,cy+(r+25)*Math.cos(a*P.rad)+5);}ctx.fillText('Uplight',450,65);ctx.fillText('Back',120,850);ctx.fillText('Front',800,850);
  }
  function road(d,h,tilt,o){const ctx=context('road',900,1050),box=[190,80,490,785],range=[-1,2.75,0,6],thresholds=[.025,.05,.2,.5,.7].map(l=>l*d.peak);
    contours(ctx,box,range,(x,y)=>ground(d,x,y,h,tilt,o).i,thresholds,['#999','#24ccdc','#7171ff','#36dc36','#ff5555']);
    const [L,T,W,H]=box;for(const x of [-1,0,1,1.75,2.75]){const px=L+(x+1)/3.75*W;line(ctx,[[px,T],[px,T+H]],'#999');ctx.fillText(`${f(Math.abs(x))}MH`,px-15,T+H+30);}for(const y of [0,1,2.25,3.75,6]){const py=T+y/6*H;line(ctx,[[L,py],[L+W,py]],'#999');if(y)ctx.fillText(`${f(y)}MH`,L-80,py+5);}['Type I','Type II','Type III','Type IV'].forEach((s,i)=>ctx.fillText(s,[L+80,L+260,L+350,L+W+10][i],T+H-12));['V.Short','Short','Medium','Long'].forEach((s,i)=>ctx.fillText(s,L+W+15,T+[.5,1.625,3,4.875][i]/6*H));ctx.fillText('Pavement',L+10,T+H+70);ctx.fillText('Road',L+250,T+H+70);thresholds.forEach((v,i)=>{ctx.fillStyle=['#999','#24ccdc','#7171ff','#36dc36','#ff5555'][i];ctx.fillText(`${[2.5,5,20,50,70][i]}% ${f(v)}`,80+(i%3)*240,970+Math.floor(i/3)*28);});
  }
  function plot(ctx,box,range,series){const[L,T,W,H]=box,[xmin,xmax,ymin,ymax]=range;grid(ctx,box,range,(xmax-xmin)/12,(ymax-ymin)/10,true);ctx.save();ctx.beginPath();ctx.rect(L,T,W,H);ctx.clip();series.forEach(s=>line(ctx,s.points.map(([x,y])=>[L+(x-xmin)/(xmax-xmin)*W,T+H-(y-ymin)/(ymax-ymin)*H]),s.color,1.5));ctx.restore();}
  function draw(d,z,total){const h=Number($('height').value),tilt=Number($('tilt').value),o=Number($('orientation').value);polar(d,'polar');polar(d,'cone',true);sphere(d);plane(d,'angular',h,tilt,o);plane(d,'isolux',h,tilt,o);lcs(z);road(d,h,tilt,o);
    const ctx=context('planar',1000,850),series=[0,90].map((c,i)=>({color:i?'#b46fe7':'#df5555',points:Array.from({length:301},(_,j)=>{const x=(j/300*5-2.5)*h;return[x,P.ground(d,x*Math.cos(c*P.rad),x*Math.sin(c*P.rad),h,tilt,o).e];})}));const ymax=d3.tickStep(0,Math.max(...series.flatMap(s=>s.points.map(p=>p[1]))),10);const top=Math.ceil(Math.max(...series.flatMap(s=>s.points.map(p=>p[1])))/ymax)*ymax||1;plot(ctx,[110,70,760,650],[-2.5*h,2.5*h,0,top],series);ctx.fillText(`MH = ${f(h)} m`,120,35);ctx.fillText('C0/180',720,35);ctx.fillText('C90/270',720,60);ctx.fillText('Distance(m)',420,795);ctx.fillText('E(lx)',30,70);
    const cu=context('cu',1000,500),angles=[0,5,10,15,20],curves=angles.map((angle,i)=>{const points=[];for(const side of [-1,1]){let sum=0;const part=[[0,0]];for(let k=1;k<81;k++){const x=(k-.5)*.05;for(let y=-15;y<=15;y+=.1)sum+=ground(d,y,side*x,h,angle,o).e*h*h*.005;part.push([side*k*.05,total?sum/total*100:0]);}points.push(...(side<0?part.reverse():part));}return{points,color:['#ff5555','#888','#368c39','#6b9d70','#89bd91'][i]};});plot(cu,[60,40,885,365],[-2,4,0,100],curves);cu.fillText('CU(%)',15,25);cu.fillText('HOUSE SIDE',150,460);cu.fillText('STREET SIDE',380,460);cu.fillText('RATIO OF DISTANCE TO MOUNTING HEIGHT',560,480);angles.forEach((a,i)=>{cu.fillStyle=curves[i].color;cu.fillText(`${a.toFixed(1)}(DEG)`,95,80+i*28);});
  }
  return {build,draw};
})();
