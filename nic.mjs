import { nicValues, nicPoint, effectiveCompensation, equilibriumAmplitude } from './nic-model.mjs';

/** The physical-component example deliberately has its own parameters. */
export function initNic(state) {
  const $ = id => document.getElementById(id);
  const fmt = (n, digits = 2) => n.toLocaleString('es-ES', { minimumFractionDigits: digits, maximumFractionDigits: digits });
  const signed = (n, digits = 2) => `${n > 0 ? '+' : ''}${fmt(n, digits)}`;
  const options = () => ({ rn: state.nicRn, coilR: state.nicCoil });
  const steps = [
    {
      title: '1. El resonador presenta una pequeña tensión',
      text: 'La tensión v del LC llega a la entrada no inversora, marcada con +. Como la corriente de entrada del operacional es muy pequeña, esta conexión apenas carga el resonador. Una perturbación inicial puede proceder del ruido del circuito.',
      equation: 'v<sub>+</sub> = v &nbsp; · &nbsp; i<sub>+</sub> ≈ 0',
      parts: ['resonator', 'port', 'amp'],
      example: p => `En el instante elegido, v = ${signed(p.v)} V. El control representa una muestra de la oscilación, sin conectar una fuente externa al nodo.`,
    },
    {
      title: '2. La realimentación local fija la ganancia',
      text: 'La red que vuelve a la entrada − hace que el operacional ajuste su salida hasta mantener v− aproximadamente igual a v+. Con poca señal, D1 y D2 están sin conducir y Rf1 y Rf2 se suman. La salida tiene el mismo signo que v y una magnitud mayor.',
      equation: 'K = 1 + (3,3 + 6,8)/10 = 2,01<br>v<sub>o</sub> ≈ 2,01 v',
      parts: ['amp', 'feedback', 'port'],
      example: p => `Para v = ${signed(p.v)} V, la salida es vo ≈ ${signed(p.vOut, 3)} V. La alimentación de ±5 V permite este recorrido de señal.`,
    },
    {
      title: '3. La salida devuelve corriente a través de RN',
      text: 'RN une la salida con el nodo del resonador. Si v es positiva, vo es aún más positiva y la corriente fluye desde la salida hacia el LC. En el semiciclo negativo se invierten ambas tensiones y también el sentido de la corriente.',
      equation: 'i = (v − v<sub>o</sub>)/R<sub>N</sub>',
      parts: ['port', 'amp', 'rn'],
      example: p => p.v === 0 ? 'En este instante, v = vo = 0 y la corriente es cero. Cambia el control de tensión para observar cualquiera de los semiciclos.' : `i = (${signed(p.v)} − (${signed(p.vOut, 3)})) / ${fmt(state.nicRn / 1000, 1)} kΩ = ${signed(p.i * 1e6, 1)} µA. La referencia i apunta hacia el NIC.`,
    },
    {
      title: '4. El puerto presenta una resistencia negativa',
      text: 'Al sustituir vo = Kv, la corriente entrante tiene signo contrario a la tensión. Por eso la pendiente i/v es negativa. El puerto entrega energía al resonador, y esa energía procede de la alimentación del operacional.',
      equation: 'i = −(K − 1)v/R<sub>N</sub><br>R<sub>neg</sub> = −R<sub>N</sub>/(K − 1)',
      parts: ['port', 'rn', 'amp'],
      example: (p, d) => `La resistencia de pequeña señal es ${fmt(d.rNeg / 1000, 3)} kΩ. En el instante elegido, v·i = ${fmt(p.power * 1e6, 2)} µW${p.v === 0 ? ', pues la tensión es cero.' : ', con signo negativo porque el NIC entrega potencia.'}`,
    },
    {
      title: '5. La oscilación arranca si el aporte supera las pérdidas',
      text: 'L y C intercambian energía cerca de su resonancia. RΝ permite al amplificador reponer la energía disipada por Rp y por la bobina. Para que la perturbación crezca, la magnitud de la conductancia negativa debe superar la conductancia total de pérdidas.',
      equation: '|G<sub>neg</sub>| = (K − 1)/R<sub>N</sub><br>g<sub>0</sub> = |G<sub>neg</sub>| / G<sub>pérdidas</sub> &gt; 1',
      parts: ['resonator', 'rn', 'amp'],
      example: (p, d) => `Con los valores elegidos, |Gneg| = ${fmt((2.01 - 1) / state.nicRn * 1e6, 1)} µS y Gpérdidas = ${fmt(d.gConductance * 1e6, 1)} µS. Por tanto, g₀ = ${fmt(d.gSmall, 3)}${d.gSmall > 1 ? ' y hay margen nominal de arranque.' : ' y no hay crecimiento sostenido.'}`,
    },
    {
      title: '6. Los diodos moderan el crecimiento',
      text: 'Cuando aumenta la oscilación, D1 y D2 conducen alternativamente y puentean parte de Rf2. Así disminuyen la ganancia efectiva y la corriente que devuelve RN. La amplitud puede estabilizarse cuando el aporte medio iguala las pérdidas, antes de que la salida alcance los raíles de alimentación.',
      equation: 'K<sub>incremental, grande</sub> → 1 + 3,3/10 = 1,33',
      parts: ['feedback', 'limit', 'amp'],
      example: (p, d) => `En la aproximación de diodos de 0,6 V, empiezan a actuar cuando |v| supera aproximadamente ${fmt(d.diodeOnset, 2)} V. El gráfico inferior muestra el balance sobre un ciclo completo.`,
    },
  ];

  function slider(id, value, text) {
    const input = $(id); input.value = value;
    input.style.setProperty('--fill', `${100 * (Number(input.value) - Number(input.min)) / (Number(input.max) - Number(input.min))}%`);
    $(`${id}-out`).textContent = text;
  }
  function focusParts(parts) {
    $('nic-schematic').classList.toggle('nic-focused', Boolean(parts));
    document.querySelectorAll('[data-nic-part]').forEach(el => el.classList.toggle('nic-highlight', parts?.includes(el.dataset.nicPart)));
  }

  function graphFrame(id, ymax, ymin, xmax, xmin, ylabel, xlabel) {
    const el = $(id), width = Math.max(330, el.clientWidth || 660), height = 245;
    el.setAttribute('viewBox', `0 0 ${width} ${height}`);
    const left = 51, right = width - 20, top = 28, bottom = height - 42;
    const x = v => left + (v - xmin) / (xmax - xmin) * (right - left);
    const y = v => bottom - (v - ymin) / (ymax - ymin) * (bottom - top);
    let body = `<text x="${left}" y="13" class="nic-chart-label">${ylabel}</text><text x="${right}" y="240" text-anchor="end" class="nic-chart-label">${xlabel}</text>`;
    return { el, x, y, left, right, top, bottom, body };
  }
  function addGrid(graph, xticks, yticks) {
    for (const v of xticks) {
      const x = graph.x(v); graph.body += `<path d="M${x} ${graph.top}V${graph.bottom}" class="nic-chart-grid"/><text x="${x}" y="${graph.bottom + 19}" text-anchor="middle" class="nic-chart-label">${fmt(v, Number.isInteger(v) ? 0 : Math.abs(v) < 1 ? 2 : 1)}</text>`;
    }
    for (const v of yticks) {
      const y = graph.y(v); graph.body += `<path d="M${graph.left} ${y}H${graph.right}" class="nic-chart-grid"/><text x="${graph.left - 9}" y="${y + 4}" text-anchor="end" class="nic-chart-label">${fmt(v, Number.isInteger(v) ? 0 : Math.abs(v) < 1 ? 2 : 1)}</text>`;
    }
  }
  function path(graph, points, style) {
    graph.body += `<path d="${points.map(([a, b], i) => `${i ? 'L' : 'M'}${graph.x(a).toFixed(2)} ${graph.y(b).toFixed(2)}`).join(' ')}" class="${style}"/>`;
  }
  function drawIV(point) {
    const graph = graphFrame('nic-iv', 90, -90, .5, -.5, 'Corriente entrante i · µA', 'Tensión v · V');
    addGrid(graph, [-.5, -.25, 0, .25, .5], [-80, -40, 0, 40, 80]);
    path(graph, [[-.5, 0], [.5, 0]], 'nic-chart-axis');
    path(graph, [[0, -90], [0, 90]], 'nic-chart-axis');
    path(graph, [-.5, .5].map(v => [v, nicPoint(v, options()).i * 1e6]), 'nic-chart-main');
    graph.body += `<circle cx="${graph.x(point.v)}" cy="${graph.y(point.i * 1e6)}" r="5" class="nic-chart-dot"/>`;
    graph.el.innerHTML = graph.body;
  }
  function drawLimiter(d) {
    const amplitude = equilibriumAmplitude(options());
    const graph = graphFrame('nic-limiter-chart', 1.65, 0, 3, 0, 'Compensación fundamental / pérdidas', 'Amplitud de v · V de pico');
    addGrid(graph, [0, 1, 2, 3], [0, .5, 1, 1.5]);
    path(graph, [[0, d.gSmall], [3, d.gSmall]], 'nic-chart-reference');
    path(graph, [[0, 1], [3, 1]], 'nic-chart-loss');
    const points = Array.from({ length: 161 }, (_, i) => { const a = 3 * i / 160; return [a, effectiveCompensation(a, options())]; });
    path(graph, points, 'nic-chart-main');
    if (amplitude > 0 && amplitude <= 3) {
      path(graph, [[amplitude, 0], [amplitude, 1]], 'nic-chart-reference');
      graph.body += `<circle cx="${graph.x(amplitude)}" cy="${graph.y(1)}" r="5" class="nic-chart-dot"/><text x="${graph.x(amplitude) + 8}" y="${graph.y(1) - 10}" class="nic-chart-label">≈ ${fmt(amplitude, 2)} V</text>`;
    }
    graph.el.innerHTML = graph.body;
    $('nic-amplitude-result').textContent = amplitude > 0 && Number.isFinite(amplitude)
      ? `Con estos valores, el balance armónico simplificado estima A ≈ ${fmt(amplitude, 2)} V de pico en el LC y |vo|máx ≈ ${fmt(nicPoint(amplitude, options()).vOut, 2)} V. Son valores del modelo aproximado.`
      : 'Con estos valores no hay margen de arranque. El limitador de amplitud no puede compensar un aporte inicial insuficiente.';
  }

  let lastLimiterKey = '';
  function render() {
    const d = nicValues(options()), p = nicPoint(state.nicV, options());
    state.nicStep = Math.min(5, Math.max(0, Math.round(state.nicStep)));
    slider('nic-voltage', state.nicV, `${signed(state.nicV)} V`);
    slider('nic-rn', state.nicRn, `${fmt(state.nicRn / 1000, 1)} kΩ`);
    slider('nic-coil', state.nicCoil, `${fmt(state.nicCoil, 0)} Ω`);
    $('nic-svg-v').textContent = `${signed(p.v)} V`;
    $('nic-svg-vo').textContent = `${signed(p.vOut, 3)} V`;
    $('nic-svg-i').textContent = `${signed(p.i * 1e6, 1)} µA`;
    $('nic-svg-rn').textContent = `${fmt(state.nicRn / 1000, 1)} kΩ`;
    $('nic-svg-coil').textContent = `${fmt(state.nicCoil, 0)} Ω`;
    $('nic-current-flow').setAttribute('d', p.v > 0 ? 'M685 103H610' : 'M610 103H685');
    $('nic-current-flow').style.opacity = p.v === 0 ? 0 : 1;
    $('nic-out-v').textContent = `${signed(p.vOut, 3)} V`;
    $('nic-out-i').textContent = `${signed(p.i * 1e6, 1)} µA`;
    $('nic-out-r').textContent = `${fmt(d.rNeg / 1000, 3)} kΩ`;
    $('nic-out-p').textContent = `${fmt(p.power * 1e6, 2)} µW`;
    $('nic-start-status').classList.toggle('off', d.gSmall <= 1);
    $('nic-start-status').innerHTML = `<strong>${d.gSmall > 1 ? 'Arranque nominal posible' : 'Las pérdidas impiden el arranque'}</strong>g₀ = ${fmt(d.gSmall, 3)}. ${d.gSmall > 1 ? `El aporte inicial supera las pérdidas un ${fmt((d.gSmall - 1) * 100, 1)} %.` : 'La pequeña perturbación no crece.'} La resonancia del modelo es ${fmt(d.f0 / 1000, 2)} kHz.`;
    const step = steps[state.nicStep];
    $('nic-step-title').textContent = step.title;
    $('nic-step-text').textContent = step.text;
    $('nic-step-equation').innerHTML = step.equation;
    $('nic-step-example').textContent = step.example(p, d);
    $('nic-step-count').textContent = `Paso ${state.nicStep + 1} de 6`;
    $('nic-prev').disabled = state.nicStep === 0;
    $('nic-next').disabled = state.nicStep === 5;
    document.querySelectorAll('[data-nic-step]').forEach(button => button.setAttribute('aria-pressed', String(Number(button.dataset.nicStep) === state.nicStep)));
    focusParts(step.parts);
    drawIV(p);
    const limiterKey = `${state.nicRn}/${state.nicCoil}/${$('nic-limiter-chart').clientWidth}`;
    if (lastLimiterKey !== limiterKey) { drawLimiter(d); lastLimiterKey = limiterKey; }
  }
  for (const [id, key] of [['nic-voltage', 'nicV'], ['nic-rn', 'nicRn'], ['nic-coil', 'nicCoil']]) {
    $(id).addEventListener('input', event => { state[key] = Number(event.target.value); render(); });
  }
  document.querySelectorAll('[data-nic-step]').forEach(button => button.addEventListener('click', () => { state.nicStep = Number(button.dataset.nicStep); render(); }));
  $('nic-prev').addEventListener('click', () => { state.nicStep = Math.max(0, state.nicStep - 1); render(); });
  $('nic-next').addEventListener('click', () => { state.nicStep = Math.min(5, state.nicStep + 1); render(); });
  $('nic-show-all').addEventListener('click', () => focusParts(null));
  $('nic-reset').addEventListener('click', () => { state.nicV = .2; state.nicRn = 6800; state.nicCoil = 20; state.nicStep = 0; render(); });
  return { render };
}
