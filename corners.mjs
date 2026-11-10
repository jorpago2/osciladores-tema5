import { cornerFactors } from './corner-model.mjs?v=20261110-corners1';

export function initCorners(state) {
  const $=id=>document.getElementById(id);
  const fmt=(v,n=1)=>v.toLocaleString('es-ES',{maximumFractionDigits:n,minimumFractionDigits:n});
  const freq=f=>f>=1e9?`${fmt(f/1e9,2)} GHz`:f>=1e6?`${fmt(f/1e6)} MHz`:f>=1e3?`${fmt(f/1e3)} kHz`:`${fmt(f)} Hz`;
  const reference=()=>state.fMHz*1e6/(2*state.Q);
  const ratio=()=>state.cornerMode===0?(state.flicker===0?0:10**state.flicker/reference()):[0,.01,100,1][state.cornerMode];
  const powerLabel=n=>n===0?'1':`10${String(n).split('').map(c=>({'-':'⁻','0':'⁰','1':'¹','2':'²','3':'³','4':'⁴','5':'⁵','6':'⁶','7':'⁷','8':'⁸','9':'⁹'}[c])).join('')}`;
  let lastKey='';
  function regimes(r) {
    let items;
    if(!state.cornerL&&!state.cornerF) items=[['Toda la banda','0','Solo queda el suelo blanco.']];
    else if(!state.cornerL) items=r>0?[['Δf ≪ fc','−10','Domina el factor de flicker.'],['Δf ≫ fc','0','El factor tiende a uno.']]:[['Toda la banda','0','No hay término de flicker.']];
    else if(!state.cornerF||r===0) items=[['Δf ≪ fL','−20','Domina el factor de Leeson.'],['Δf ≫ fL','0','El factor tiende a uno.']];
    else if(Math.abs(Math.log10(r))<.3) items=[['Δf ≪ fc, fL','−30','Se combinan ambos efectos.'],['fc ≈ fL','Transición','No hay una región intermedia amplia.'],['Δf ≫ fc, fL','0','Los dos factores tienden a uno.']];
    else items=[['Δf ≪ fc, fL','−30','Se combinan 1/Δf y 1/Δf².'],r<1?['fc ≪ Δf ≪ fL','−20','Domina el factor de Leeson.']:['fL ≪ Δf ≪ fc','−10','Domina el factor de flicker.'],['Δf ≫ fc, fL','0','Los dos factores tienden a uno.']];
    $('corner-regimes').innerHTML=items.map(([range,slope,explanation])=>`<div><span>${range}</span><strong>${slope}${slope==='Transición'?'':' dB/déc.'}</strong><small>${explanation}</small></div>`).join('');
  }
  function draw(r,lo,hi,point) {
    const svg=$('corner-chart'),width=Math.max(300,svg.clientWidth||700),height=290,left=45,right=width-18,top=30,bottom=247;
    svg.setAttribute('viewBox',`0 0 ${width} ${height}`);
    const options={ratio:r,leeson:Boolean(state.cornerL),flicker:Boolean(state.cornerF)};
    const ymax=Math.max(10,Math.ceil(cornerFactors(10**lo,options).totalDb/20)*20);
    const x=v=>left+(v-lo)/(hi-lo)*(right-left),y=v=>bottom-v/ymax*(bottom-top);
    let out=`<text x="${left}" y="12" class="corner-chart-label">Incremento sobre el suelo blanco · dB</text>`;
    const ystep=ymax<=20?5:ymax<=80?20:40;
    for(let v=0;v<=ymax;v+=ystep) out+=`<path d="M${left} ${y(v)}H${right}" class="corner-chart-grid"/><text x="${left-8}" y="${y(v)+3}" text-anchor="end" class="corner-chart-label">${v}</text>`;
    const tickStep=Math.max(1,Math.ceil((hi-lo)/(width<500?4:7)));
    for(let v=Math.ceil(lo/tickStep)*tickStep;v<=hi;v+=tickStep) out+=`<path d="M${x(v)} ${top}V${bottom}" class="corner-chart-grid"/><text x="${x(v)}" y="266" text-anchor="middle" class="corner-chart-label">${powerLabel(v)}</text>`;
    out+=`<text x="${right}" y="286" text-anchor="end" class="corner-chart-label">Separación normalizada Δf / fL →</text>`;
    if(state.cornerL) out+=`<path d="M${x(0)} ${top}V${bottom}" stroke="#318194" class="corner-chart-marker"/><text x="${x(0)+5}" y="41" class="corner-chart-label leeson">fL</text>`;
    if(state.cornerF&&r>0) out+=`<path d="M${x(Math.log10(r))} ${top}V${bottom}" stroke="#c57b43" class="corner-chart-marker"/><text x="${x(Math.log10(r))+5}" y="${Math.abs(Math.log10(r))<.4?57:41}" class="corner-chart-label flicker">fc</text>`;
    const data=Array.from({length:401},(_,i)=>{const z=lo+(hi-lo)*i/400;return {z,...cornerFactors(10**z,options)};});
    const curve=(key,color,weight,dashed=false)=>`<path class="corner-chart-line" stroke="${color}" stroke-width="${weight}" ${dashed?'stroke-dasharray="6 4"':''} d="${data.map((p,i)=>`${i?'L':'M'}${x(p.z).toFixed(2)} ${y(p[key]).toFixed(2)}`).join(' ')}"/>`;
    if(state.cornerL)out+=curve('leesonDb','#318194',1.8,true);
    if(state.cornerF&&r>0)out+=curve('flickerDb','#c57b43',1.8,true);
    out+=curve('totalDb','#6853cf',2.8);
    out+=`<path d="M${x(state.cornerProbe)} ${y(point.totalDb)}V${bottom}" stroke="#b5a5e8" class="corner-chart-marker"/><circle cx="${x(state.cornerProbe)}" cy="${y(point.totalDb)}" r="4.5" fill="#6853cf" stroke="white" stroke-width="2"/>`;
    $('corner-chart-content').innerHTML=out;
    $('corner-chart-desc').textContent=`Curvas de los factores de Leeson y flicker en dB frente a Δf/fL. fc/fL = ${r.toPrecision(3)}. En el punto elegido, el incremento combinado es ${fmt(point.totalDb)} dB y la pendiente local es ${fmt(point.slope)} dB por década.`;
  }
  function render() {
    state.cornerMode=Math.max(0,Math.min(3,Math.round(state.cornerMode)));
    const r=ratio(),logR=r>0?Math.log10(r):0,lo=Math.floor(Math.min(0,logR))-2,hi=Math.ceil(Math.max(0,logR))+2;
    state.cornerProbe=Math.max(lo,Math.min(hi,state.cornerProbe));
    const probe=$('corner-probe');probe.min=String(lo);probe.max=String(hi);probe.value=String(state.cornerProbe);probe.style.setProperty('--fill',`${100*(state.cornerProbe-lo)/(hi-lo)}%`);
    const fL=reference(),fc=state.flicker===0?0:10**state.flicker;
    $('corner-leeson-value').textContent=state.cornerMode===0?`fL = ${freq(fL)}`:'fL es la referencia del eje';
    $('corner-flicker-value').textContent=state.cornerMode===0?(fc>0?`fc = ${freq(fc)}`:'Sin flicker en estos ajustes'):`fc = ${fmt(r,r<1?2:0)} × fL`;
    $('corner-mode-note').textContent=state.cornerMode===0?`Se usan los ajustes del espectro, con f₀ = ${freq(state.fMHz*1e6)} y Q = ${fmt(state.Q,0)}. Cambia Q o la esquina de flicker en sus controles para desplazar las marcas.`:'Este esquema compara el orden de las esquinas sin asignarles una frecuencia física. Los ajustes del oscilador se mantienen. Vuelve a «Ajustes del espectro» para ver su relación actual.';
    document.querySelectorAll('[data-corner-scenario]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.cornerScenario)===state.cornerMode)));
    $('corner-include-leeson').checked=Boolean(state.cornerL);$('corner-include-flicker').checked=Boolean(state.cornerF);
    const at=10**state.cornerProbe,p=cornerFactors(at,{ratio:r,leeson:Boolean(state.cornerL),flicker:Boolean(state.cornerF)});
    $('corner-probe-out').textContent=state.cornerMode===0?`Δf = ${freq(at*fL)}`:`Δf/fL = ${at<.001||at>=1000?at.toExponential(1).replace('.',','):fmt(at,at<.1?3:2)}`;
    $('corner-leeson-db').textContent=`+${fmt(p.leesonDb)} dB`;$('corner-flicker-db').textContent=`+${fmt(p.flickerDb)} dB`;$('corner-total-db').textContent=`+${fmt(p.totalDb)} dB`;$('corner-slope').textContent=`${fmt(p.slope)} dB/déc.`;
    regimes(r);
    const key=[r,lo,hi,state.cornerProbe,state.cornerL,state.cornerF,$('corner-chart').clientWidth].join('/');
    if(key!==lastKey){draw(r,lo,hi,p);lastKey=key;}
  }
  document.querySelectorAll('[data-corner-scenario]').forEach(b=>b.addEventListener('click',()=>{state.cornerMode=Number(b.dataset.cornerScenario);const r=ratio();state.cornerProbe=r>0?Math.log10(r)/2:0;render();}));
  $('corner-include-leeson').addEventListener('change',e=>{state.cornerL=Number(e.target.checked);render();});
  $('corner-include-flicker').addEventListener('change',e=>{state.cornerF=Number(e.target.checked);render();});
  $('corner-probe').addEventListener('input',e=>{state.cornerProbe=Number(e.target.value);render();});
  document.querySelectorAll('[data-open-corners]').forEach(b=>b.addEventListener('click',()=>{$('corners-comparison').scrollIntoView({block:'start',behavior:'smooth'});}));
  return {render};
}
