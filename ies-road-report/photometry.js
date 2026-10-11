/* Type C sampling follows the symmetry conventions used by IES Editor. */
window.RoadPhotometry = (() => {
  const rad = Math.PI / 180;
  function parse(text) {
    const lines = text.replace(/\r/g, '').split('\n');
    const t = lines.findIndex(line => /^\s*TILT\s*=/i.test(line));
    if (t < 0 || !/^\s*TILT\s*=\s*NONE\s*$/i.test(lines[t])) throw Error('仅支持 TILT=NONE 的 IES 文件');
    const n = lines.slice(t + 1).join(' ').trim().split(/[\s,]+/).map(Number);
    const [lamps, lumens, multiplier, nv, nh, type, units, width, length, height, , , power] = n;
    if (type !== 1) throw Error('道路报告需要 Type C 光度数据');
    if (![nv,nh].every(v => Number.isInteger(v) && v > 0) || nv * nh > 2000000 || n.length < 13 + nv + nh + nv * nh || !n.every(Number.isFinite)) throw Error('IES 数据不完整或无效');
    const vertical = n.slice(13,13 + nv), horizontal = n.slice(13 + nv,13 + nv + nh);
    if ([vertical,horizontal].some(a => a.some((v,i) => i && v <= a[i-1])) || vertical[0] < 0 || vertical.at(-1) > 180) throw Error('角度序列无效');
    const end = horizontal.at(-1);
    if (horizontal[0] !== 0 || !(nh === 1 || [90,180,360].some(v => Math.abs(end-v)<.01) || end>=270)) throw Error('不支持该 C 平面覆盖范围');
    const matrix = Array.from({length:nh},(_,i) => n.slice(13+nv+nh+i*nv,13+nv+nh+(i+1)*nv).map(v => Math.max(0,v*multiplier)));
    const keywords = Object.fromEntries(lines.filter(l => /^\[/.test(l)).map(l => {const m=l.match(/^\[([^\]]+)\](.*)$/);return m?[m[1].toUpperCase(),m[2].trim()]:['',''];}));
    return {vertical,horizontal,matrix,lamps,lumens,power,width,length,height,units,keywords,peak:Math.max(...matrix.map(row => Math.max(...row)))};
  }
  function interpolate(a, values, x) {
    if(x<a[0] || x>a.at(-1)) return 0;
    let i=0;while(i<a.length-2 && a[i+1]<x)i++;
    if(a.length===1)return values[0];
    const f=(x-a[i])/(a[i+1]-a[i]);return values[i]*(1-f)+values[i+1]*f;
  }
  function intensity(d,c,g) {
    c=((c%360)+360)%360;
    const a=d.horizontal,end=a.at(-1);
    if(a.length===1)return interpolate(d.vertical,d.matrix[0],g);
    if(end<=90.01){c%=180;if(c>90)c=180-c;}else if(end<=180.01 && c>180)c=360-c;
    const values=d.matrix.map(row => interpolate(d.vertical,row,g));
    if(c>end)return values.at(-1)+(values[0]-values.at(-1))*(c-end)/(360-end);
    return interpolate(a,values,c);
  }
  function zones(d,orientation=0) {
    const result=Array.from({length:18},()=>({front:0,back:0}));
    for(let c=1;c<360;c+=2)for(let g=.5;g<180;g++){
      const flux=intensity(d,c,g)*2*rad*(Math.cos((g-.5)*rad)-Math.cos((g+.5)*rad));
      const side=Math.cos((c-orientation)*rad)>=0?'front':'back';result[Math.floor(g/10)][side]+=flux;
    }
    return result;
  }
  function ground(d,x,y,h,tilt=0,orientation=0) {
    const a=orientation*rad,t=tilt*rad;
    const forward=x*Math.cos(a)+y*Math.sin(a),side=-x*Math.sin(a)+y*Math.cos(a);
    const localForward=forward*Math.cos(t)-h*Math.sin(t),down=forward*Math.sin(t)+h*Math.cos(t);
    const r=Math.hypot(x,y,h),g=Math.acos(Math.max(-1,Math.min(1,down/r)))/rad;
    const c=Math.atan2(side,localForward)/rad+orientation;
    return {i:intensity(d,c,g),e:intensity(d,c,g)*h/(r*r*r)};
  }
  function withFlux(d,target,sourceFlux) {
    if(!Number.isFinite(target)||target<=0||!Number.isFinite(sourceFlux)||sourceFlux<=0)throw Error('整灯光通量必须为大于 0 的有效数值');
    const scale=target/sourceFlux;
    return {...d,peak:d.peak*scale,matrix:d.matrix.map(row=>row.map(value=>value*scale))};
  }
  return {parse,intensity,zones,ground,withFlux,rad};
})();
