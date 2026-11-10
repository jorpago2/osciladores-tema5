# Oscila · Tema 5

Laboratorio interactivo para estudiar el arranque, la estabilización de amplitud y el ruido de fase de un oscilador con resistencia negativa. Está orientado a la asignatura CSAF y funciona en el navegador.

[Abrir la aplicación](https://jorpago2.github.io/osciladores-tema5/) · [Repositorio en GitHub](https://github.com/jorpago2/osciladores-tema5)

## Uso en clase

- **Arranque** muestra cómo evoluciona una pequeña perturbación inicial. Modifica la aportación del bloque activo para pasar del decaimiento al crecimiento y observa la estabilización de la envolvente.
- **Equilibrio** relaciona la amplitud con la conductancia activa y el balance de potencia del resonador. Permite localizar el punto donde la energía aportada compensa las pérdidas.
- **Ruido de fase** representa la densidad espectral relativa a la portadora. Compara el efecto de Q, la potencia de señal, el factor de ruido y la esquina de flicker. Puedes conservar una curva de referencia y exportar datos en CSV.

Una secuencia útil consiste en comparar valores de g inferiores y superiores a uno, localizar la amplitud de equilibrio y duplicar Q manteniendo g constante. Después, en la vista de ruido, puede estudiarse cómo cambia el espectro al aumentar Q o la potencia de señal.

## Modelo de oscilación

El resonador es un RLC paralelo con C = 100 pF. Sus parámetros cumplen

$$
f_0=\frac{1}{2\pi\sqrt{LC}},\qquad G_p=\frac{1}{R_p}=\frac{\omega_0 C}{Q}.
$$

El bloque activo se representa mediante una conductancia negativa equivalente a la frecuencia fundamental. Definimos g como la relación entre su magnitud de pequeña señal y las pérdidas del resonador

$$
G_d(A)=-\frac{gG_p}{1+(A/V_s)^2},\qquad
\frac{dA}{dt}=\frac{\omega_0}{2Q}\left[\frac{g}{1+(A/V_s)^2}-1\right]A.
$$

La semilla inicial es de 10 mV y Vₛ = 1 V. Para g > 1, la amplitud estable es Aₑ = Vₛ√(g − 1). Para g < 1, la perturbación decae. En g = 1, la compensación solo es exacta en el límite de pequeña señal, de modo que una amplitud finita también decae lentamente por la saturación.

La envolvente se obtiene mediante la integral implícita de la ecuación y una búsqueda en escala logarítmica. Con una semilla exactamente nula permanecería en cero, ya que esta ecuación no inyecta ruido continuo. Se supone una oscilación casi sinusoidal y Q suficientemente alto. El modelo no incluye transistores, armónicos, desplazamiento de frecuencia ni conversión AM–PM.

## Ruido de fase y jitter

Se utiliza una forma simplificada del modelo de Leeson con T = 290 K y la convención de banda lateral única del Tema 5

$$
\mathcal{L}(\Delta f)=10\log_{10}\left\{
\frac{FkT}{2P_s}
\left[1+\left(\frac{f_0}{2Q\Delta f}\right)^2\right]
\left(1+\frac{f_c}{\Delta f}\right)
\right\}.
$$

F es el factor de ruido lineal, Pₛ se expresa en vatios y ℒ en dBc/Hz. El suelo blanco deriva de FkT/(2Pₛ). Esta vista presupone una portadora estacionaria y trata Pₛ como un parámetro independiente de g y de la envolvente de arranque. Los offsets se limitan a Δf ≤ 0,1f₀. El modelo permite estudiar tendencias y no predice el centro exacto de la portadora ni las espurias de un circuito real. El mecanismo y sus aproximaciones se desarrollan en [The Leeson effect, de Enrico Rubiola](https://arxiv.org/abs/physics/0502143) y en [la introducción al ruido de osciladores de Analog Devices](https://www.analog.com/en/resources/analog-dialogue/articles/pll-for-high-frequency-receivers-and-transmitters-2.html).

El jitter RMS se calcula entre 1 kHz y min(1 MHz, 0,1f₀). La integración es analítica y conserva el factor dos que convierte la densidad de banda lateral única en varianza de fase

$$
\sigma_\varphi^2=2\int_{f_\mathrm{bajo}}^{f_\mathrm{alto}}
10^{\mathcal{L}(\Delta f)/10}\,d\Delta f,
\qquad \sigma_t=\frac{\sigma_\varphi}{2\pi f_0}.
$$

Es jitter de fase expresado como error temporal, con aproximación de fase pequeña y dentro de la banda indicada. Estas relaciones se recogen en [la documentación de medida de Keysight](https://helpfiles.keysight.com/csg/e5052b/measurement/phase_noise_measurement/confirming_result_of_phase_noise_measurement.htm).

La animación de fase y amplitud es una ilustración conceptual independiente, con variaciones ampliadas para hacerlas visibles. Su traza reproducible no sintetiza el espectro de Leeson ni sirve para obtener el jitter numérico mostrado.

## Desarrollo local y comprobaciones

Se necesita una versión reciente de Node.js. No hay dependencias que instalar ni proceso de compilación.

```sh
npm start
```

Abre [la vista local](http://127.0.0.1:4173) en el navegador. Para ejecutar las pruebas

```sh
npm test
```

Los 14 tests comprueban las relaciones del resonador, el umbral y el equilibrio, el decaimiento, la ecuación diferencial de la envolvente, el escalado con Q, los límites del espectro, la conversión a jitter y la reproducibilidad de la traza conceptual. La integral analítica se contrasta con una cuadratura independiente. Son comprobaciones del modelo matemático y del código, sin validación experimental de un circuito físico.

La interfaz está en `index.html`, `style.css` y `app.mjs`. El modelo independiente está en `model.mjs`, sus pruebas en `model.test.mjs` y el servidor local en `serve.mjs`. GitHub Pages sirve directamente estos archivos estáticos.
