window.RoadMetrics = (() => {
  const P = window.RoadPhotometry;
  const thresholds = {
    BL:[110,500,1000,2500,5000], BM:[220,1000,2500,5000,8500], BH:[110,500,1000,2500,5000],
    UL:[0,10,50,500,1000], UH:[0,10,50,500,1000], VH:[10,100,225,500,750], FH:[660,1800,5000,7500,12000]
  };
  function grade(value, limits) { const index=limits.findIndex(limit=>value<=limit+1e-8);return index<0?5:index; }
  function bugFromFlux(flux, quadrilateral, upperKnown=true) {
    const b=Math.max(...['BL','BM','BH'].map(key=>grade(flux[key],thresholds[key])));
    const u=upperKnown?Math.max(grade(flux.UL,thresholds.UL),grade(flux.UH,thresholds.UH)):null;
    const g=Math.max(grade(flux.FVH,thresholds.VH),grade(flux.BVH,thresholds.VH),grade(flux.FH,thresholds.FH),grade(flux.BH,quadrilateral?thresholds.FH:thresholds.BH));
    return {b,u,g,text:`B${b}-U${u===null?'?':u}-G${g}`};
  }
  function beam(d,c) {
    const values=Array.from({length:721},(_,i)=>{const angle=i*.5-180;return {angle,value:P.intensity(d,angle<0?(c+180)%360:c,Math.abs(angle))};});
    const maximum=Math.max(...values.map(p=>p.value)),index=values.findIndex(p=>p.value===maximum),half=maximum/2;
    if(maximum<=0)return null;
    let left=index,right=index;while(left>0&&values[left].value>=half)left--;while(right<values.length-1&&values[right].value>=half)right++;
    if(left===0&&values[0].value>=half||right===values.length-1&&values.at(-1).value>=half)return null;
    const cross=(a,b)=>a.angle+(half-a.value)/(b.value-a.value)*(b.angle-a.angle);
    return {angle:cross(values[right-1],values[right])-cross(values[left],values[left+1]),peak:maximum};
  }
  function evaluate(d,z,total,o=0,zeroUplight=false) {
    const sum=(side,a,b)=>z.slice(a/10,b/10).reduce((s,q)=>s+q[side],0),flux={};
    for(const [side,prefix] of [['front','F'],['back','B']])for(const [a,b,key] of [[0,30,'L'],[30,60,'M'],[60,80,'H'],[80,90,'VH']])flux[prefix+key]=sum(side,a,b);
    flux.UL=sum('front',90,100)+sum('back',90,100);flux.UH=sum('front',100,180)+sum('back',100,180);
    const octants=Array(8).fill(0);let peak={c:0,g:0,i:0},max80=0,max90=0,maxUpper=0,maxHigh=0,maxTransverse=0;
    const planes=[];
    for(let c=0;c<360;c+=2){let integral=0;for(let g=0;g<=180;g++){const i=P.intensity(d,c,g);if(i>peak.i)peak={c,g,i};if(g===80)max80=Math.max(max80,i);if(g===90)max90=Math.max(max90,i);if(g>=90)maxUpper=Math.max(maxUpper,i);if(g>=80)maxHigh=Math.max(maxHigh,i);if(g>0&&g<180){const v=i*P.rad*2*P.rad*Math.sin(g*P.rad);integral+=v;octants[Math.floor(c/45)]+=v;}}planes.push(integral);}
    const avg=octants.reduce((a,b)=>a+b,0)/8;
    const quad=avg>0&&octants.every(v=>Math.abs(v-avg)<=avg*.1);
    const planeAverage=planes.reduce((a,b)=>a+b,0)/planes.length;
    const circular=planeAverage>0&&planes.every(v=>Math.abs(v-planeAverage)<=planeAverage*.1);
    const peakProjection=Math.abs(Math.tan(peak.g*P.rad)*Math.sin((peak.c-o)*P.rad));
    const length=peakProjection<1?'Very Short':peakProjection<2.25?'Short':peakProjection<3.75?'Medium':peakProjection<6?'Long':'Beyond 6MH';
    // Half-maximum trace within the same longitudinal region as the peak.
    const [from,to]=peakProjection<1?[0,1]:peakProjection<2.25?[1,2.25]:peakProjection<3.75?[2.25,3.75]:[3.75,6];
    let minTransverse=0;
    for(let c=0;c<360;c+=2)for(let g=0;g<89.5;g+=.5){if(P.intensity(d,c,g)<peak.i*.5)continue;const t=Math.tan(g*P.rad),long=Math.abs(t*Math.sin((c-o)*P.rad)),cross=t*Math.cos((c-o)*P.rad);if(long>=from&&long<to){maxTransverse=Math.max(maxTransverse,cross);minTransverse=Math.min(minTransverse,cross);}}
    const type=circular?'Type V':quad?'Type VS':maxTransverse<=1&&minTransverse>=-1?'Type I':maxTransverse<=1.75?'Type II':maxTransverse<=2.75?'Type III':'Type IV';
    const lowerKnown=d.vertical[0]===0&&d.vertical.at(-1)>=90;
    const upperKnown=lowerKnown&&(d.vertical.at(-1)>=180 || zeroUplight);
    const normalization=d.lumens>0?d.lumens*d.lamps:total;
    const high=maxHigh/normalization*1000,upper=maxUpper/normalization*1000;
    const cutoff=!upperKnown?'Upper hemisphere required':upper<=1e-8&&high<=100?'Full cut-off':upper<=25&&high<=100?'Cut-off':upper<=50&&high<=200?'Semi cut-off':'Non cut-off';
    const bug=lowerKnown?bugFromFlux(flux,quad,upperKnown):{b:null,u:null,g:null,text:'B?-U?-G?'};
    return {flux,bug,upperKnown,quad,type,length,cutoff,peak,max80:max80/normalization*1000,max90:max90/normalization*1000,beam0:beam(d,0),beam90:beam(d,90)};
  }
  return {evaluate,bugFromFlux,beam};
})();
