import { rfValues, rfPoint, effectiveRFCompensation, rfEquilibrium } from './rf-model.mjs?v=20261110-rf1';

export function initRF(state) {
  const $ = id => document.getElementById(id);
  const fmt = (n, digits = 2) => n.toLocaleString('es-ES', {minimumFractionDigits:digits,maximumFractionDigits:digits});
  const signed = (n,digits=2) => `${n>0?'+':''}${fmt(n,digits)}`;
  const opts = () => ({gmMilli:state.rfGm,q:state.rfQ,itMilli:state.rfTail,cPf:state.rfC});
  const steps = [
    {
      title:'1. La corriente de cola polariza los dos NMOS',
      text:'M3 establece aproximadamente la corriente IT. En reposo, dos transistores iguales reparten esa corriente por igual. Las inductancias llevan la alimentación a los drenadores. El parámetro gm expresa cuánto cambia la corriente de cada MOSFET cuando cambia su tensión puerta–fuente.',
      equation:'I<sub>D1,0</sub> = I<sub>D2,0</sub> = I<sub>T</sub>/2',
      parts:['tail','m1','m2','tank'],
      example:(p,d)=>`Con IT = ${fmt(d.iTail*1e3,1)} mA, cada rama conduce ${fmt(d.iTail*1e3/2,2)} mA en reposo. El valor gm = ${fmt(d.gm*1e3,1)} mS corresponde a cada transistor, no a la suma del par.`,
    },
    {
      title:'2. Una perturbación separa las dos tensiones',
      text:'Supón que el drenador 1 sube ligeramente y el drenador 2 baja. La conexión cruzada lleva esa bajada a la puerta de M1 y la subida a la puerta de M2. En modo diferencial, las fuentes comunes permanecen aproximadamente a masa de pequeña señal.',
      equation:'v<sub>d</sub> = v₁ − v₂<br>Δv<sub>GS1</sub> = −v<sub>d</sub>/2<br>Δv<sub>GS2</sub> = +v<sub>d</sub>/2',
      parts:['port','cross','m1','m2'],
      example:p=>`Para vd = ${signed(p.vDiff*1e3,0)} mV, las variaciones de puerta son ${signed(-p.vDiff*1e3/2,1)} mV en M1 y ${signed(p.vDiff*1e3/2,1)} mV en M2. Cambia el signo de la perturbación para invertir los papeles.`,
    },
    {
      title:'3. Las corrientes refuerzan el desequilibrio',
      text:'Con v1 mayor que v2, M1 conduce menos y extrae menos corriente del nodo 1, que tiende a subir. M2 conduce más y descarga el nodo 2, que tiende a bajar. Las dos etapas en fuente común se realimentan de forma regenerativa. El LC determina la frecuencia a la que se sostiene el intercambio de energía.',
      equation:'ΔI<sub>D1</sub> ≈ −g<sub>m</sub>v<sub>d</sub>/2<br>ΔI<sub>D2</sub> ≈ +g<sub>m</sub>v<sub>d</sub>/2',
      parts:['cross','m1','m2','port'],
      example:p=>`El modelo de reparto da ID1 = ${fmt(p.id1*1e3,3)} mA e ID2 = ${fmt(p.id2*1e3,3)} mA. Ambas son corrientes totales positivas. Lo que cambia de signo es su variación respecto al punto de polarización.`,
    },
    {
      title:'4. Entre los drenadores aparece −2/gm',
      text:'Define la corriente incremental del puerto como id = (ΔID1 − ΔID2)/2. Al sustituir las variaciones de corriente, su signo resulta contrario al de vd. El par presenta una resistencia negativa al tanque diferencial y aporta energía RF procedente de la alimentación.',
      equation:'i<sub>d</sub> = −g<sub>m</sub>v<sub>d</sub>/2<br>R<sub>neg,d</sub> = v<sub>d</sub>/i<sub>d</sub> = −2/g<sub>m</sub>',
      parts:['port','m1','m2'],
      example:(p,d)=>`Con gm = ${fmt(d.gm*1e3,1)} mS por transistor, Rneg,d = ${fmt(d.rNeg,0)} Ω. Para la perturbación actual, la aproximación lineal da id = ${signed(p.iLinear*1e6,1)} µA.`,
    },
    {
      title:'5. La conductancia negativa debe superar las pérdidas',
      text:'El tanque pierde energía en inductancias, transistores y carga. Esas pérdidas se reúnen en Rp,d. La perturbación crece si gm/2 supera 1/Rp,d. Una mayor Q reduce las pérdidas, mientras una mayor gm aumenta el aporte de pequeña señal.',
      equation:'g₀ = g<sub>m</sub>R<sub>p,d</sub>/2<br>g₀ &gt; 1 para arrancar',
      parts:['tank','m1','m2'],
      example:(p,d)=>`Rp,d = ${fmt(d.Rp,1)} Ω y el umbral es gm = ${fmt(d.gmThreshold*1e3,2)} mS por NMOS. El valor actual da g₀ = ${fmt(d.gSmall,3)}${d.gSmall>1?', con margen nominal de arranque.':', sin crecimiento sostenido.'}`,
    },
    {
      title:'6. La corriente se conmuta entre las ramas',
      text:'Al crecer la oscilación, el par dirige la corriente de cola alternativamente hacia M1 y M2. La corriente RF queda limitada y disminuye la conductancia negativa efectiva. En régimen permanente, la energía que aporta su componente fundamental compensa la energía disipada en el tanque.',
      equation:'I<sub>D1</sub> + I<sub>D2</sub> ≈ I<sub>T</sub><br>|i<sub>d</sub>| ≤ I<sub>T</sub>/2',
      parts:['tail','m1','m2','tank'],
      example:(p,d)=>`Con IT = ${fmt(d.iTail*1e3,1)} mA, el modelo limita |id| a ${fmt(d.iTail*1e3/2,2)} mA. El gráfico inferior usa una ley de reparto suave para estimar el equilibrio, sin atribuirle la precisión de un modelo de proceso.`,
    },
  ];
  function slider(id,value,text){const el=$(id);el.value=value;el.style.setProperty('--fill',`${100*(Number(el.value)-Number(el.min))/(Number(el.max)-Number(el.min))}%`);$(`${id}-out`).textContent=text;}
  function focusParts(parts){$('rf-schematic').classList.toggle('rf-focused',Boolean(parts));document.querySelectorAll('[data-rf-part]').forEach(el=>el.classList.toggle('rf-highlight',parts?.includes(el.dataset.rfPart)));}
  function frame(id,xmin,xmax,ymin,ymax,ylabel,xlabel){const el=$(id),width=Math.max(330,el.clientWidth||660),height=245,left=52,right=width-18,top=27,bottom=202;el.setAttribute('viewBox',`0 0 ${width} ${height}`);return{el,left,right,top,bottom,x:v=>left+(v-xmin)/(xmax-xmin)*(right-left),y:v=>bottom-(v-ymin)/(ymax-ymin)*(bottom-top),body:`<text x="${left}" y="13" class="rf-chart-label">${ylabel}</text><text x="${right}" y="240" text-anchor="end" class="rf-chart-label">${xlabel}</text>`};}
  function grid(g,xticks,yticks){for(const v of xticks){g.body+=`<path d="M${g.x(v)} ${g.top}V${g.bottom}" class="rf-chart-grid"/><text x="${g.x(v)}" y="222" text-anchor="middle" class="rf-chart-label">${fmt(v,Number.isInteger(v)?0:1)}</text>`;}for(const v of yticks){g.body+=`<path d="M${g.left} ${g.y(v)}H${g.right}" class="rf-chart-grid"/><text x="${g.left-8}" y="${g.y(v)+4}" text-anchor="end" class="rf-chart-label">${fmt(v,Number.isInteger(v)?0:1)}</text>`;}}
  function path(g,points,cls){g.body+=`<path d="${points.map(([x,y],i)=>`${i?'L':'M'}${g.x(x).toFixed(2)} ${g.y(y).toFixed(2)}`).join(' ')}" class="${cls}"/>`;}
  function drawIV(p,d){const ytop=Math.max(30,Math.ceil(d.gm*.05/2*1e6/50)*50),g=frame('rf-iv',-50,50,-ytop*1.1,ytop*1.1,'Corriente RF i_d · µA','Tensión diferencial vd · mV');grid(g,[-50,-25,0,25,50],[-ytop,0,ytop]);path(g,[[-50,0],[50,0]],'rf-chart-axis');path(g,[[-50,d.gm*.05/2*1e6],[50,-d.gm*.05/2*1e6]],'rf-chart-reference');path(g,Array.from({length:121},(_,i)=>{const v=-.05+i*.1/120;return[v*1e3,rfPoint(v,opts()).i*1e6];}),'rf-chart-main');g.body+=`<circle cx="${g.x(p.vDiff*1e3)}" cy="${g.y(p.i*1e6)}" r="5" class="rf-chart-dot"/>`;g.el.innerHTML=g.body;}
  function drawLimiter(d){const amp=rfEquilibrium(opts()),xmax=Math.max(1.5,Math.ceil(amp*1.25*2)/2),ymax=Math.max(1.6,Math.ceil(d.gSmall*1.1*2)/2),g=frame('rf-limiter-chart',0,xmax,0,ymax,'Compensación fundamental / pérdidas','Amplitud diferencial · V de pico');grid(g,[0,xmax/3,2*xmax/3,xmax],[0,1,ymax]);path(g,[[0,d.gSmall],[xmax,d.gSmall]],'rf-chart-reference');path(g,[[0,1],[xmax,1]],'rf-chart-loss');path(g,Array.from({length:161},(_,i)=>{const a=i*xmax/160;return[a,effectiveRFCompensation(a,opts())];}),'rf-chart-main');if(amp>0){g.body+=`<circle cx="${g.x(amp)}" cy="${g.y(1)}" r="5" class="rf-chart-dot"/><text x="${g.x(amp)+7}" y="${g.y(1)-10}" class="rf-chart-label">≈ ${fmt(amp,2)} V</text>`;}g.el.innerHTML=g.body;$('rf-amplitude-result').textContent=amp>0?`El balance de este modelo estima ${fmt(amp,2)} V de pico entre drenadores, aproximadamente ${fmt(amp/2,2)} V de variación por nodo. La excursión admisible de un circuito real debe comprobarse con su proceso CMOS.`:'Con estos ajustes no hay margen inicial de arranque. La limitación de corriente no sustituye el requisito gm Rp,d / 2 > 1.';}
  let lastKey='';
  function render(){const d=rfValues(opts()),p=rfPoint(state.rfV/1000,opts());state.rfStep=Math.max(0,Math.min(5,Math.round(state.rfStep)));slider('rf-voltage',state.rfV,`${signed(state.rfV,0)} mV`);slider('rf-gm',state.rfGm,`${fmt(state.rfGm,1)} mS`);slider('rf-q',state.rfQ,`${fmt(state.rfQ,0)}`);slider('rf-cap',state.rfC,`${fmt(state.rfC,2)} pF`);slider('rf-tail',state.rfTail,`${fmt(state.rfTail,1)} mA`);$('rf-frequency').textContent=`${fmt(d.f0/1e9,3)} GHz`;
    const texts={'rf-svg-vdiff':`vd = ${signed(state.rfV,0)} mV`,'rf-svg-id1':`ID1 = ${fmt(p.id1*1e3,3)} mA`,'rf-svg-id2':`ID2 = ${fmt(p.id2*1e3,3)} mA`,'rf-svg-gm':`gm = ${fmt(state.rfGm,1)} mS por NMOS`,'rf-svg-cap':`Cd = ${fmt(state.rfC,2)} pF`,'rf-svg-tail':`IT = ${fmt(state.rfTail,1)} mA`};for(const[id,text]of Object.entries(texts)){if($(id))$(id).textContent=text;}
    $('rf-out-id').textContent=`${fmt(p.id1*1e3,3)} / ${fmt(p.id2*1e3,3)} mA`;$('rf-out-i').textContent=`${signed(p.i*1e6,1)} µA`;$('rf-out-r').textContent=`${fmt(d.rNeg,0)} Ω`;$('rf-out-rp').textContent=`${fmt(d.Rp,1)} Ω`;$('rf-out-threshold').textContent=`${fmt(d.gmThreshold*1e3,2)} mS`;$('rf-start-status').classList.toggle('off',d.gSmall<=1);$('rf-start-status').innerHTML=`<strong>${d.gSmall>1?'El par supera las pérdidas':'No hay margen de arranque'}</strong>g₀ = ${fmt(d.gSmall,3)}. ${d.gSmall>1?`El aporte de pequeña señal supera las pérdidas un ${fmt((d.gSmall-1)*100,1)} %.`:'La pequeña perturbación no crece.'}`;
    const step=steps[state.rfStep];$('rf-step-title').textContent=step.title;$('rf-step-text').textContent=step.text;$('rf-step-equation').innerHTML=step.equation;$('rf-step-example').textContent=step.example(p,d);$('rf-step-count').textContent=`Paso ${state.rfStep+1} de 6`;$('rf-prev').disabled=state.rfStep===0;$('rf-next').disabled=state.rfStep===5;document.querySelectorAll('[data-rf-step]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.rfStep)===state.rfStep)));focusParts(step.parts);drawIV(p,d);const key=`${state.rfGm}/${state.rfQ}/${state.rfTail}/${state.rfC}/${$('rf-limiter-chart').clientWidth}`;if(key!==lastKey){drawLimiter(d);lastKey=key;}}
  for(const[id,key]of[['rf-voltage','rfV'],['rf-gm','rfGm'],['rf-q','rfQ'],['rf-cap','rfC'],['rf-tail','rfTail']])$(id).addEventListener('input',e=>{state[key]=Number(e.target.value);render();});
  document.querySelectorAll('[data-rf-step]').forEach(b=>b.addEventListener('click',()=>{state.rfStep=Number(b.dataset.rfStep);render();}));$('rf-prev').addEventListener('click',()=>{state.rfStep=Math.max(0,state.rfStep-1);render();});$('rf-next').addEventListener('click',()=>{state.rfStep=Math.min(5,state.rfStep+1);render();});$('rf-show-all').addEventListener('click',()=>focusParts(null));$('rf-reset').addEventListener('click',()=>{Object.assign(state,{rfV:30,rfGm:4,rfQ:10,rfC:1,rfTail:2,rfStep:0});render();});return{render};
}
