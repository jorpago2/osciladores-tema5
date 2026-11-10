import { initRF } from './rf.mjs?v=20261110-rf1';
import { derived, simulateEnvelope, phaseNoiseDb, integratedJitter, phaseTrace } from './model.mjs?v=20261110-rf1';

const $ = id => document.getElementById(id);
const colors = { purple: '#6853cf', orange: '#c57b43', ink: '#514b60', muted: '#9a92a6', grid: '#eeeaf3', gray: '#bfbac9', green: '#3c8071' };
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const state = { fMHz: 2400, Q: 10, gain: 1.33, vsat: 1, power: 0, nf: 6, flicker: 3, offset: 4, probe: 0.4, exaggeration: 0.45, tab: 'start', mod: 'pm', rfV: 30, rfGm: 4, rfQ: 10, rfC: 1, rfTail: 2, rfStep: 0 };
const limits = { rfV:[-50,50], rfGm:[0.5,8], rfQ:[5,20], rfC:[0.5,2], rfTail:[1,4], rfStep:[0,5], fMHz:[500,6000], Q:[5,100], gain:[0,3], power:[-10,20], nf:[0,20], flicker:[0,5], offset:[2,9], probe:[0,2], exaggeration:[0,1] };
let playing = !reducedMotion, energyPlaying = !reducedMotion, phasePlaying = !reducedMotion, progress = reducedMotion ? 1 : 0, elapsed = 0, lastFrame = 0, lastPaint = 0;
let curve = [], d, duration, cycles, savedCurve = null, toastTimer;
const trace = phaseTrace({ rmsRad: 1, count: 1200, seed: 5 });
const format = (n, digits = 2) => n.toLocaleString('es-ES', { maximumFractionDigits: digits, minimumFractionDigits: digits });
const freqText = f => f >= 1e9 ? `${format(f / 1e9, 3)} GHz` : f >= 1e6 ? `${format(f / 1e6, f % 1e6 === 0 ? 0 : 1)} MHz` : f >= 1e3 ? `${format(f / 1e3, f % 1e3 === 0 ? 0 : 1)} kHz` : `${format(f, 0)} Hz`;
const noiseParams = () => ({ fMHz:state.fMHz, Q:state.Q, noiseFloor:10 * Math.log10(10 ** (state.nf/10) * 1.380649e-23 * 290 / (2 * 1e-3 * 10 ** (state.power/10))), flickerHz:state.flicker === 0 ? 0 : 10 ** state.flicker });
const maxOffset = () => state.fMHz * 1e5;
const jitterHigh = () => Math.min(1e6, maxOffset());

function restoreHash() {
  const p = new URLSearchParams(location.hash.slice(1));
  for (const [key,[lo,hi]] of Object.entries(limits)) {
    if (!p.has(key)) continue;
    const value = Number(p.get(key));
    if (Number.isFinite(value)) state[key] = Math.min(hi, Math.max(lo, value));
  }
  if (['start','energy','noise','circuit'].includes(p.get('tab'))) state.tab = p.get('tab');
  if (['pm','am'].includes(p.get('mod'))) state.mod = p.get('mod');
}
restoreHash();
const rf = initRF(state);

function sizeCanvas(id) {
  const canvas = $(id), width = canvas.clientWidth, height = Number(canvas.getAttribute('height'));
  if (!width) return null;
  if (!canvas.dataset.height) canvas.dataset.height = height;
  const h = Number(canvas.dataset.height), ratio = Math.min(devicePixelRatio || 1, 2);
  canvas.style.height = `${h}px`;
  if (canvas.width !== Math.round(width * ratio) || canvas.height !== Math.round(h * ratio)) {
    canvas.width = Math.round(width * ratio); canvas.height = Math.round(h * ratio);
  }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(ratio,0,0,ratio,0,0); ctx.clearRect(0,0,width,h);
  return { ctx, width, height:h };
}
function plot(id, options = {}) {
  const result = sizeCanvas(id); if (!result) return null;
  const {ctx,width,height} = result;
  const left = options.left ?? 48, right = 18, top = 23, bottom = options.bottom ?? 33;
  const w = width-left-right, h = height-top-bottom;
  const xmin = options.xmin ?? 0, xmax = options.xmax ?? 1, ymin = options.ymin ?? 0, ymax = options.ymax ?? 1;
  const x = v => left+(v-xmin)/(xmax-xmin)*w, y = v => top+(ymax-v)/(ymax-ymin)*h;
  ctx.font = '9px "Segoe UI", sans-serif'; ctx.fillStyle = colors.muted; ctx.lineWidth = 1;
  for (const v of options.yticks ?? []) {
    ctx.strokeStyle = colors.grid; ctx.beginPath(); ctx.moveTo(left,y(v)); ctx.lineTo(width-right,y(v)); ctx.stroke();
    ctx.textAlign = 'right'; ctx.fillText(options.yformat ? options.yformat(v) : format(v,1),left-9,y(v)+3);
  }
  for (const v of options.xticks ?? []) {
    ctx.strokeStyle = colors.grid; ctx.beginPath(); ctx.moveTo(x(v),top); ctx.lineTo(x(v),height-bottom); ctx.stroke();
    ctx.textAlign = 'center'; ctx.fillText(options.xformat ? options.xformat(v) : format(v,0),x(v),height-bottom+17);
  }
  ctx.fillStyle = colors.muted; ctx.textAlign = 'left'; if(options.ylabel) ctx.fillText(options.ylabel,left,11);
  ctx.textAlign = 'right'; if(options.xlabel) ctx.fillText(options.xlabel,width-right,height-2);
  return {...result,x,y,left,right,top,bottom,w,h};
}
function line(p, points, color, width = 2, dashed = false, fill = false) {
  const {ctx,x,y,left,top,w,h} = p;
  ctx.save(); ctx.beginPath(); ctx.rect(left,top,w,h); ctx.clip();
  ctx.beginPath(); points.forEach(([a,b],i) => i ? ctx.lineTo(x(a),y(b)) : ctx.moveTo(x(a),y(b)));
  if(fill && points.length){ctx.lineTo(x(points.at(-1)[0]),top+h);ctx.lineTo(x(points[0][0]),top+h);ctx.closePath();ctx.fillStyle=color;ctx.fill();}
  else{ctx.strokeStyle=color;ctx.lineWidth=width;ctx.setLineDash(dashed?[4,4]:[]);ctx.stroke();}
  ctx.restore();
}
function dot(p, xx, yy, color=colors.purple, r=4) { const {ctx,x,y}=p;ctx.beginPath();ctx.arc(x(xx),y(yy),r,0,Math.PI*2);ctx.fillStyle=color;ctx.fill();ctx.strokeStyle='white';ctx.lineWidth=2;ctx.stroke(); }
function currentAmplitude(){const index=Math.min(curve.length-1,Math.round(progress*(curve.length-1)));return curve[index]?.a??0.01;}

function recalculate(reset = false) {
  d = derived(state);
  // A fixed physical window in cycles makes changes in Q directly comparable.
  cycles = 200; duration = cycles / d.f0;
  curve = simulateEnvelope(state, duration, 700);
  if(reset) progress=0;
  syncControls(); draw();
}
function updateSlider(id,value,text) {
  const el=$(id); el.value=value; el.style.setProperty('--fill',`${100*(Number(el.value)-Number(el.min))/(Number(el.max)-Number(el.min))}%`);
  if($(`${id}-out`)) $(`${id}-out`).textContent=text;
}
function syncControls() {
  $('offset').max=String(Math.log10(maxOffset()));
  state.offset=Math.min(state.offset,Number($('offset').max));
  updateSlider('gain',state.gain,`${format(state.gain)} ×`); updateSlider('energy-gain',state.gain,`${format(state.gain)} ×`);
  updateSlider('q',state.Q,`Q = ${format(state.Q,0)}`); updateSlider('noise-q',state.Q,format(state.Q,0));
  updateSlider('freq',state.fMHz,freqText(state.fMHz*1e6)); updateSlider('noise-freq',state.fMHz,freqText(state.fMHz*1e6));
  updateSlider('probe',state.probe,`${format(state.probe)} V`); updateSlider('power',state.power,`${format(state.power,0)} dBm`);
  updateSlider('nf',state.nf,`${format(state.nf,0)} dB`); updateSlider('flicker',state.flicker,state.flicker===0?'Sin flicker':freqText(10**state.flicker));
  updateSlider('offset',state.offset,freqText(10**state.offset)); updateSlider('exaggeration',state.exaggeration,`${format(state.exaggeration*100,0)} %`);
  $('inductance').textContent=d.L>=1e-6?`${format(d.L*1e6)} µH`:`${format(d.L*1e9)} nH`;
  $('resistance').textContent=d.Rp>=1000?`${format(d.Rp/1000)} kΩ`:`${format(d.Rp,0)} Ω`;
  $('aeq').textContent=`${format(d.Aeq,3)} V de pico`;
  $('start-status').classList.toggle('off',state.gain<=1);
  $('start-status').innerHTML=state.gain>1?`<strong>Hay margen para arrancar</strong>El aporte inicial supera las pérdidas un ${format((state.gain-1)*100,0)} %. La amplitud tiende a ${format(d.Aeq)} V.`:state.gain===1?'<strong>En el umbral</strong>La compensación iguala las pérdidas solo para señal muy pequeña. Una amplitud finita decae lentamente.':'<strong>La oscilación se apaga</strong>La energía aportada no compensa las pérdidas. La perturbación inicial se amortigua.';
  document.querySelectorAll('[data-preset]').forEach(b=>b.classList.toggle('selected',b.dataset.preset===(state.gain===1?'threshold':state.gain>1?'on':'off')));
  const effective=state.gain/(1+state.probe**2), diff=effective-1;
  $('balance-status').classList.toggle('off',diff<-.005);
  const direction=state.probe===0?'Sin semilla no arranca':Math.abs(diff)<.005?'Aporte y pérdidas se equilibran':diff>0?'La amplitud tiende a crecer':'La amplitud tiende a disminuir';
  $('balance-status').innerHTML=`<strong>${direction}</strong>En esta amplitud, |G<sub>d</sub>| / G<sub>r</sub> = ${format(effective,3)}. ${state.probe===0?'El modelo determinista permanece en cero.':Math.abs(diff)<.005?'El balance de energía es aproximadamente nulo.':diff>0?'El balance de energía es positivo.':'Las pérdidas superan el aporte.'}`;
  $('balance-caption').textContent=state.gain>1?'A la izquierda del cruce, la amplitud crece. A la derecha, decrece. Así se recupera el equilibrio después de una perturbación.':'Con g ≤ 1, no existe un equilibrio de amplitud positiva. Para cualquier amplitud finita, el aporte es menor que las pérdidas.';
  const np=noiseParams(), jitter=integratedJitter(np,1e3,jitterHigh());
  $('jitter-band').textContent=`Jitter RMS · 1 kHz–${freqText(jitterHigh())}`;
  $('noise-assumptions').textContent=`Esta vista supone una portadora estable. Su potencia se fija de forma independiente y g no interviene. T = 290 K. El jitter integra de 1 kHz a ${freqText(jitterHigh())}. Limitamos Δf a 0,1 f₀ para explorar ruido cercano a la portadora.`;
  $('offset-label').textContent=`ℒ a ${freqText(10**state.offset)}`;
  $('noise-readout').textContent=`${format(phaseNoiseDb(10**state.offset,np),1)} dBc/Hz`;
  $('leeson-readout').textContent=freqText(d.f0/(2*state.Q));
  $('leeson-example').textContent=`Con f₀ = ${freqText(d.f0)} y Q = ${format(state.Q,0)}, fL = ${freqText(d.f0/(2*state.Q))}. La línea vertical de la gráfica marca esa distancia a la portadora. Al duplicar Q, esta esquina se desplaza a la mitad y el ruido próximo mejora aproximadamente 6 dB, manteniendo el resto de parámetros.`;
  $('jitter-readout').textContent=jitter.sigmaT>=1e-9?`${format(jitter.sigmaT*1e9)} ns`:`${format(jitter.sigmaT*1e12)} ps`;
  document.querySelectorAll('[data-mod]').forEach(b=>b.classList.toggle('selected',b.dataset.mod===state.mod));
  $('phase-heading').textContent=state.mod==='pm'?'Los cruces por cero ya no llegan a tiempo':'La altura cambia, los cruces se mantienen';
  $('phase-caption').textContent=(state.mod==='pm'?'En fase cambia el ángulo del fasor, mientras su longitud permanece constante.':'En amplitud cambia la longitud del fasor, mientras su ángulo sigue la referencia ideal.')+' Esta animación conceptual exagera las fluctuaciones y no sintetiza el espectro de Leeson de arriba.';
}
function drawStart() {
  const ymax=Math.max(.013,d.Aeq*1.22), scale=state.gain<=1?1000:1;
  const p=plot('envelope',{xmax:cycles,ymax,xticks:[0,40,80,120,160,200],yticks:[0,ymax/3,2*ymax/3,ymax],yformat:v=>format(v*scale,scale===1000?0:2),xlabel:'Tiempo en ciclos de f₀',ylabel:scale===1000?'Amplitud · mV':'Amplitud · V'});
  if(p){
    line(p,[[0,d.Aeq],[cycles,d.Aeq]],colors.gray,1,true);
    const points=curve.slice(0,Math.round(progress*(curve.length-1))+1).map(v=>[v.t*d.f0,v.a]);
    line(p,points,'#6853cf0d',1,false,true);line(p,points,colors.purple,2.4);
    if(points.length)dot(p,...points.at(-1));
    if(state.gain>1){p.ctx.fillStyle=colors.muted;p.ctx.font='10px "Segoe UI"';p.ctx.textAlign='right';p.ctx.fillText(`A∞ = ${format(d.Aeq)} V`,p.width-20,p.y(d.Aeq)-9);}
  }
  const amplitude=currentAmplitude(), waveMax=Math.max(.013,d.Aeq*1.2), waveScale=state.gain<=1?1000:1;
  const wave=plot('wave',{xmax:5,ymin:-waveMax,ymax:waveMax,yticks:[-waveMax,0,waveMax],yformat:v=>format(v*waveScale,waveScale===1000?0:1),xticks:[0,1,2,3,4,5],xlabel:'Detalle · ciclos',ylabel:waveScale===1000?'mV':'V',bottom:27});
  if(wave)line(wave,Array.from({length:500},(_,i)=>[i/499*5,amplitude*Math.cos(2*Math.PI*(i/499*5-progress*cycles))]),colors.purple,1.8);
  $('time-readout').textContent=`t = ${format(progress*duration*1e9,1)} ns`;
  $('wave-scale').textContent=`A = ${amplitude<.1?format(amplitude*1000,2)+' mV':format(amplitude,3)+' V'}`;
  $('energy-dot').setAttribute('cx',String(260+(elapsed*.0001%1)*85));
  $('energy-dot').setAttribute('opacity',state.gain===0?'0':'1');
}
function drawEnergy() {
  const p=plot('balance',{xmax:2,ymax:3.3,yticks:[0,1,2,3],xticks:[0,.5,1,1.5,2],xformat:v=>format(v,1),yformat:v=>String(v),xlabel:'Amplitud de pico · V',ylabel:'Conductancia / Gᵣ'});
  if(p){
    line(p,[[0,1],[2,1]],colors.orange,1.5,true);
    line(p,Array.from({length:400},(_,i)=>{const a=i/399*2;return[a,state.gain/(1+a*a)]}),colors.purple,2.4);
    if(state.gain>1){line(p,[[d.Aeq,0],[d.Aeq,1]],colors.gray,1,true);dot(p,d.Aeq,1,colors.green,5);p.ctx.fillStyle=colors.green;p.ctx.font='10px "Segoe UI"';p.ctx.textAlign='left';p.ctx.fillText('Equilibrio estable',p.x(d.Aeq)+9,p.y(1)-11);}
    const y=state.gain/(1+state.probe**2);line(p,[[state.probe,0],[state.probe,y]],'#bfb2e6',1,true);dot(p,state.probe,y);
    p.ctx.font='11px "Segoe UI"';p.ctx.fillStyle=colors.purple;p.ctx.textAlign='center';
    if(state.probe>0&&Math.abs(y-1)>.005)p.ctx.fillText(y>1?'crece →':'← decrece',p.x(Math.max(.3,Math.min(1.7,state.probe))),p.y(y)-13);
  }
  drawEnergyTanks();
}
function drawEnergyTanks(){
  const angle=elapsed*.00065,electric=Math.cos(angle)**2,magnetic=1-electric;
  $('electric-fill').style.height=`${electric*100}%`; $('magnetic-fill').style.height=`${magnetic*100}%`;
  $('electric-value').textContent=`${format(electric*100,0)} % de E total`; $('magnetic-value').textContent=`${format(magnetic*100,0)} % de E total`;
}
function drawSpectrum() {
  const params=noiseParams(), maxLog=Math.log10(maxOffset()), values=Array.from({length:500},(_,i)=>{const x=2+(maxLog-2)*i/499;return[x,phaseNoiseDb(10**x,params)]});
  const saved=savedCurve?Array.from({length:500},(_,i)=>{const x=2+(Math.min(maxLog,Math.log10(savedCurve.fMHz*1e5))-2)*i/499;return[x,phaseNoiseDb(10**x,savedCurve)]}):null;
  const ymin=Math.floor(Math.min(params.noiseFloor,savedCurve?.noiseFloor??params.noiseFloor)/20)*20-5;
  const ymax=Math.ceil(Math.max(values[0][1],saved?.[0][1]??-999)/20)*20+5;
  const yticks=[];for(let v=Math.ceil(ymin/20)*20;v<=ymax;v+=20)yticks.push(v);
  const p=plot('spectrum',{xmin:2,xmax:maxLog,ymin,ymax,xticks:[2,3,4,5,6,7,8,9].filter(v=>v<=maxLog),xformat:v=>['100','1k','10k','100k','1M','10M','100M','1G'][v-2],yticks,yformat:v=>String(v),xlabel:'Separación Δf · Hz (escala logarítmica)',ylabel:'ℒ(Δf) · dBc/Hz',left:44});
  if(!p)return;
  line(p,[[2,params.noiseFloor],[maxLog,params.noiseFloor]],colors.gray,1,true);
  if(saved)line(p,saved,colors.orange,1.7,true);
  line(p,values,'#6853cf08',1,false,true);line(p,values,colors.purple,2.4);
  const fL=Math.log10(d.f0/(2*state.Q));
  if(fL>=2&&fL<=maxLog){line(p,[[fL,ymin],[fL,ymax]],'#d4cdeb',1,true);p.ctx.fillStyle=colors.muted;p.ctx.font='9px "Segoe UI"';p.ctx.textAlign='left';p.ctx.fillText('fL',p.x(fL)+4,p.top+13);}
  const marker=phaseNoiseDb(10**state.offset,params);line(p,[[state.offset,ymin],[state.offset,marker]],'#b5a5e8',1,true);dot(p,state.offset,marker,colors.purple,4.5);
}
function noiseAt(index){const base=((index%trace.length)+trace.length)%trace.length;return trace[Math.floor(base)];}
function drawPhase() {
  const shift=elapsed*.012, intensity=state.exaggeration;
  const p=plot('phase-wave',{xmax:4,ymin:-1.7,ymax:1.7,yticks:[-1,0,1],yformat:v=>String(v),xticks:[0,1,2,3,4],xlabel:'Tiempo normalizado · ciclos',ylabel:'Amplitud normalizada',left:28});
  if(p){
    const ideal=[],noisy=[];
    for(let i=0;i<500;i++){const x=i/499*4,theta=x*2*Math.PI,err=Math.tanh(noiseAt(i+shift))*intensity*1.4;ideal.push([x,Math.cos(theta)]);noisy.push([x,state.mod==='pm'?Math.cos(theta+err):(1+err*.45)*Math.cos(theta)]);}
    line(p,ideal,colors.gray,1.5,true);line(p,noisy,colors.purple,2);
  }
  const r=sizeCanvas('phasor');if(!r)return;
  const {ctx,width,height}=r,cx=width/2,cy=height/2-3,radius=Math.min(width*.34,60),theta=elapsed*.00055,err=Math.tanh(noiseAt(shift+250))*intensity*1.4;
  ctx.strokeStyle=colors.grid;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(8,cy);ctx.lineTo(width-8,cy);ctx.moveTo(cx,cy-radius-12);ctx.lineTo(cx,cy+radius+12);ctx.stroke();
  ctx.beginPath();ctx.arc(cx,cy,radius,0,Math.PI*2);ctx.setLineDash([3,4]);ctx.strokeStyle='#d8d1e5';ctx.stroke();ctx.setLineDash([]);
  function arrow(a,len,color,lineWidth){ctx.beginPath();ctx.moveTo(cx,cy);const xx=cx+Math.cos(a)*len,yy=cy-Math.sin(a)*len;ctx.lineTo(xx,yy);ctx.strokeStyle=color;ctx.lineWidth=lineWidth;ctx.stroke();ctx.beginPath();ctx.arc(xx,yy,3,0,Math.PI*2);ctx.fillStyle=color;ctx.fill();}
  arrow(theta,radius,colors.gray,1.5);arrow(theta+(state.mod==='pm'?err:0),radius*(state.mod==='am'?1+err*.45:1),colors.purple,2.5);
  if(state.mod==='pm'){ctx.beginPath();ctx.arc(cx,cy,radius*.45,Math.min(-theta,-theta-err),Math.max(-theta,-theta-err));ctx.strokeStyle=colors.orange;ctx.lineWidth=2;ctx.stroke();}
  ctx.font='9px "Segoe UI"';ctx.textAlign='center';ctx.fillStyle=colors.muted;ctx.fillText(state.mod==='pm'?'Varía el ángulo φ':'Varía el módulo A',cx,height-9);
}
function draw(){if(state.tab==='circuit')rf.render();if(state.tab==='start')drawStart();if(state.tab==='energy')drawEnergy();if(state.tab==='noise'){drawSpectrum();drawPhase();}}

const quizzes={
  circuit:{question:'Si v₁ sube y v₂ baja, ¿qué hace el par NMOS cruzado?',answers:['M1 conduce menos y M2 más','Ambos conducen más','M1 conduce más y M2 menos'],correct:0,feedback:'La puerta de M1 recibe v₂ y la de M2 recibe v₁. El cambio de corrientes refuerza el desequilibrio y origina la conductancia diferencial −gm/2.'},
  start:{question:'Si la compensación baja por debajo de las pérdidas, ¿qué ocurre?',answers:['La amplitud decrece','La frecuencia se duplica','La amplitud crece'],correct:0,feedback:'La amplitud decrece porque el balance de energía es negativo. El resonador pierde más energía de la que recibe.'},
  energy:{question:'Justo por encima de la amplitud estable, ¿qué hace el circuito?',answers:['Sigue creciendo','Recupera el equilibrio','Se vuelve ideal'],correct:1,feedback:'La saturación reduce el aporte por debajo de las pérdidas. Por eso la amplitud disminuye y vuelve al punto de equilibrio.'},
  noise:{question:'Si duplicas la potencia de señal y mantienes lo demás, ¿cómo cambia ℒ?',answers:['Baja unos 3 dB','Baja unos 6 dB','No cambia'],correct:0,feedback:'La densidad relativa de ruido es inversamente proporcional a la potencia de señal. Duplicarla reduce ℒ en 10 log₁₀(2) ≈ 3,01 dB en este modelo.'}
};
function setTab(tab,focus=false){
  state.tab=tab;
  document.querySelectorAll('[data-tab]').forEach(b=>{const active=b.dataset.tab===tab;b.setAttribute('aria-selected',String(active));b.tabIndex=active?0:-1;if(active&&focus)b.focus();});
  for(const key of Object.keys(quizzes))$(`panel-${key}`).hidden=key!==tab;
  $('theory-details').hidden=tab==='circuit';
  const quiz=quizzes[tab];$('challenge-question').textContent=quiz.question;$('challenge-feedback').textContent='';$('challenge-options').replaceChildren();
  quiz.answers.forEach((answer,index)=>{const button=document.createElement('button');button.textContent=answer;button.addEventListener('click',()=>{button.classList.add(index===quiz.correct?'correct':'incorrect');$('challenge-feedback').textContent=(index===quiz.correct?'Exacto. ':'Piénsalo en términos del modelo. ')+quiz.feedback;});$('challenge-options').append(button);});
  draw();
}
document.querySelectorAll('[data-tab]').forEach(button=>{button.addEventListener('click',()=>setTab(button.dataset.tab));button.addEventListener('keydown',event=>{const tabs=['start','energy','noise','circuit'],index=tabs.indexOf(state.tab);let next;if(event.key==='ArrowRight')next=tabs[(index+1)%tabs.length];if(event.key==='ArrowLeft')next=tabs[(index+tabs.length-1)%tabs.length];if(event.key==='Home')next=tabs[0];if(event.key==='End')next=tabs.at(-1);if(next){event.preventDefault();setTab(next,true);}});});
document.querySelectorAll('[data-open-circuit]').forEach(button=>button.addEventListener('click',()=>{setTab('circuit',true);$('lab').scrollIntoView({block:'start'});}));
const bindings={gain:'gain','energy-gain':'gain',q:'Q','noise-q':'Q',freq:'fMHz','noise-freq':'fMHz',probe:'probe',power:'power',nf:'nf',flicker:'flicker',offset:'offset',exaggeration:'exaggeration'};
for(const [id,key]of Object.entries(bindings))$(id).addEventListener('input',event=>{state[key]=Number(event.target.value);if(['gain','Q','fMHz'].includes(key))recalculate();else{syncControls();draw();}});
document.querySelectorAll('[data-preset]').forEach(button=>button.addEventListener('click',()=>{state.gain={off:.65,threshold:1,on:1.33}[button.dataset.preset];recalculate(true);playing=!reducedMotion;if(reducedMotion)progress=1;updatePlay();draw();}));
function updatePlay(){$('play').textContent=playing?'Ⅱ':'▶';$('play').setAttribute('aria-label',playing?'Pausar animación':'Reproducir animación');$('energy-play').textContent=energyPlaying?'Ⅱ':'▶';$('energy-play').setAttribute('aria-label',energyPlaying?'Pausar intercambio de energía':'Reproducir intercambio de energía');$('phase-play').textContent=phasePlaying?'Ⅱ':'▶';$('phase-play').setAttribute('aria-label',phasePlaying?'Pausar fluctuaciones':'Reproducir fluctuaciones');}
$('play').addEventListener('click',()=>{if(progress>=1)progress=0;playing=!playing;updatePlay();drawStart();});
$('restart').addEventListener('click',()=>{progress=0;playing=true;updatePlay();drawStart();});
$('energy-play').addEventListener('click',()=>{energyPlaying=!energyPlaying;updatePlay();});
$('phase-play').addEventListener('click',()=>{phasePlaying=!phasePlaying;updatePlay();});
$('equilibrium').addEventListener('click',()=>{state.probe=d.Aeq;syncControls();drawEnergy();});
document.querySelectorAll('[data-mod]').forEach(button=>button.addEventListener('click',()=>{state.mod=button.dataset.mod;syncControls();drawPhase();}));
$('save-curve').addEventListener('click',()=>{savedCurve={...noiseParams()};$('saved-legend').hidden=false;$('clear-curve').hidden=false;$('save-curve').textContent='↻ Actualizar curva guardada';drawSpectrum();toast('Curva guardada. Cambia Q o la potencia para comparar.');});
$('clear-curve').addEventListener('click',()=>{savedCurve=null;$('saved-legend').hidden=true;$('clear-curve').hidden=true;$('save-curve').textContent='＋ Guardar curva para comparar';drawSpectrum();});
function toast(message){$('toast').textContent=message;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),3500);}
function download(name,content){const url=URL.createObjectURL(new Blob([content],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('export-envelope').addEventListener('click',()=>download('oscila-arranque.csv',`# f0_Hz=${d.f0},Q=${state.Q},g=${state.gain},As_V=${state.vsat},semilla_V=0.01\ntiempo_s,amplitud_pico_V\n`+curve.map(p=>`${p.t},${p.a}`).join('\n')));
$('export-noise').addEventListener('click',()=>{const np=noiseParams();download('oscila-ruido-fase.csv',`# f0_Hz=${d.f0},Q=${state.Q},Ps_dBm=${state.power},NF_dB=${state.nf},fc_Hz=${np.flickerHz},T_K=290\noffset_Hz,L_dBc_por_Hz\n`+Array.from({length:501},(_,i)=>{const f=10**(2+(Math.log10(maxOffset())-2)*i/500);return`${f},${phaseNoiseDb(f,np)}`}).join('\n'));});
$('share').addEventListener('click',async()=>{const p=new URLSearchParams();for(const key of [...Object.keys(limits),'tab','mod'])p.set(key,String(state[key]));const url=new URL(location.href);url.hash=p.toString();history.replaceState(null,'',url);try{await navigator.clipboard.writeText(url.href);toast('Enlace copiado con los ajustes actuales.');}catch{toast('Los ajustes están en la dirección. Copia el enlace del navegador.');}});
window.addEventListener('hashchange',()=>{restoreHash();recalculate();setTab(state.tab);});
let resizeTimer;window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(draw,80);});
document.addEventListener('visibilitychange',()=>{lastFrame=0;});
function animate(now){
  const dt=lastFrame?Math.min(now-lastFrame,100):0;lastFrame=now;
  if(!document.hidden){
    if((state.tab==='energy'&&energyPlaying)||(state.tab==='start'&&playing)||(state.tab==='noise'&&phasePlaying))elapsed+=dt;
    if(state.tab==='start'&&playing){progress=Math.min(1,progress+dt/16000);if(progress===1){playing=false;updatePlay();drawStart();}}
    if(now-lastPaint>33){if(state.tab==='start'&&playing)drawStart();if(state.tab==='energy'&&energyPlaying)drawEnergyTanks();if(state.tab==='noise'&&phasePlaying)drawPhase();lastPaint=now;}
  }
  requestAnimationFrame(animate);
}
recalculate();setTab(state.tab);updatePlay();requestAnimationFrame(animate);
