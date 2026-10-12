(function(root) {
  function parse(text) {
    const points=[];
    for(const [index,line] of text.replace(/^\uFEFF/,'').split(/\r?\n/).entries()) {
      const s=line.trim();
      if(!s || /^[#;]/.test(s))continue;
      if(!points.length && /^(wavelength|lambda|波长)\b/i.test(s))continue;
      const tokens=/[\t; ]/.test(s)?s.split(/[\t; ]+/):s.split(',');
      if(tokens.length!==2)throw Error(`第 ${index+1} 行须包含波长和光谱值两列`);
      const [w,p]=tokens.map(t=>Number(t.replace(',','.')));
      if(!Number.isFinite(w)||!Number.isFinite(p)||w<250||w>2500||p<0)throw Error(`第 ${index+1} 行数值无效`);
      if(points.length && w<=points.at(-1)[0])throw Error('波长须递增且不能重复');
      points.push([w,p]);
    }
    if(points.length<2 || !points.some(p=>p[1]>0))throw Error('需要至少两个采样点及有效光谱值');
    return points;
  }
  function analyze(points,table) {
    let j=0;
    const xyz=[0,0,0];
    // Integrate on the official 1 nm CMF grid; never extrapolate missing spectrum.
    for(const [w,...cmf] of table) {
      if(w<points[0][0]||w>points.at(-1)[0])continue;
      while(j<points.length-2 && points[j+1][0]<w)j++;
      const [a,p]=points[j], [b,q]=points[j+1];
      const value=p+(q-p)*(w-a)/(b-a);
      for(let k=0;k<3;k++)xyz[k]+=value*cmf[k];
    }
    const [X,Y,Z]=xyz,sum=X+Y+Z,den=X+15*Y+3*Z;
    if(!(sum>0))throw Error('光谱在可见波段没有有效能量');
    return {x:X/sum,y:Y/sum,u:4*X/den,v:9*Y/den,peak:points.reduce((a,b)=>b[1]>a[1]?b:a)[0],full:points[0][0]<=380&&points.at(-1)[0]>=780};
  }
  const api={parse,analyze};
  if(typeof module!=='undefined')module.exports=api;else root.Spectrum=api;
})(globalThis);
