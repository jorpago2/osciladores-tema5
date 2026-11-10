# Oscila · Tema 5

Laboratorio interactivo para estudiar el arranque, la estabilización de amplitud y el ruido de fase de un oscilador con resistencia negativa. Está orientado a la asignatura CSAF y funciona en el navegador.

[Abrir la aplicación](https://jorpago2.github.io/osciladores-tema5/) · [Repositorio en GitHub](https://github.com/jorpago2/osciladores-tema5)

## Uso en clase

- **Arranque** muestra cómo evoluciona una pequeña perturbación inicial. Modifica la aportación del bloque activo para pasar del decaimiento al crecimiento y observa la estabilización de la envolvente.
- **Equilibrio** relaciona la amplitud con la conductancia activa y el balance de potencia del resonador. Permite localizar el punto donde la energía aportada compensa las pérdidas.
- **Ruido de fase** representa la densidad espectral relativa a la portadora. Compara el efecto de Q, la potencia de señal, el factor de ruido y la esquina de flicker. Puedes conservar una curva de referencia y exportar datos en CSV.
- **Circuito real** desarrolla un ejemplo con operacional mediante seis pasos y un esquema que destaca los componentes implicados. Permite cambiar el signo de la tensión, comprobar la corriente entregada y observar cómo las pérdidas de la bobina afectan al arranque.

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

## Circuito con un operacional

El ejemplo utiliza un OPA197 alimentado a ±5 V como convertidor de impedancia negativa. El nodo del resonador se conecta a la entrada no inversora. La entrada inversora tiene Rg = 10 kΩ a masa y una realimentación desde la salida formada por Rf1 = 3,3 kΩ y Rf2 = 6,8 kΩ en serie. Dos diodos 1N4148 en antiparalelo puentean Rf2. La resistencia RN, inicialmente de 6,8 kΩ, conecta la salida con el nodo del resonador. Se proponen condensadores de desacoplo de 100 nF desde cada alimentación a masa.

Con señal pequeña, los diodos apenas conducen y la ganancia no inversora es K = 2,01. Como la salida tiene mayor magnitud que la tensión del resonador, RN devuelve corriente hacia él. Definiendo i como la corriente que entra al bloque activo, se obtiene

$$
v_o=Kv,\qquad i=\frac{v-v_o}{R_N}
=-\frac{K-1}{R_N}v,\qquad
R_\mathrm{neg}=-\frac{R_N}{K-1}.
$$

Los valores iniciales dan Rneg ≈ −6,733 kΩ. Al invertir el signo de v, también se invierten la salida y la corriente, por lo que el producto v·i sigue siendo negativo. La energía entregada al resonador procede de las fuentes de alimentación del operacional.

El resonador usa L = 10 mH, C = 10 nF y un resistor externo Rp = 10 kΩ. Las pérdidas de la bobina se representan mediante una resistencia serie rL, cuyo valor inicial de 20 Ω es una hipótesis del ejemplo y no la especificación de un componente seleccionado. A la frecuencia de cancelación de susceptancias se cumple

$$
\omega_r^2=\frac{1}{LC}-\left(\frac{r_L}{L}\right)^2,
\qquad G_\mathrm{pérdidas}=\frac{1}{R_p}+\frac{r_LC}{L},
\qquad g_0=\frac{(K-1)/R_N}{G_\mathrm{pérdidas}}.
$$

Con los ajustes iniciales, la resonancia queda en unos 15,912 kHz y g₀ ≈ 1,238. El aporte nominal supera las pérdidas y permite el arranque. Manteniendo los demás valores, el umbral se alcanza cuando rL ≈ 48,53 Ω. La aproximación de alto Q del resonador es Q ≈ 8,33 con las pérdidas iniciales, sin interpretar este valor como una extracción exacta de su ancho de banda.

Cuando aumenta la amplitud, los diodos conducen alternativamente y reducen la contribución de Rf2. La ganancia incremental tiende a 1 + Rf1/Rg = 1,33. El modelo aproxima los diodos mediante una caída fija de 0,6 V y calcula la componente fundamental de la corriente para una tensión sinusoidal. El balance armónico predice una amplitud de unos 1,47 V de pico en el resonador con los valores iniciales. Esta cifra es una estimación del modelo, sin incluir la dinámica del OPA197 ni la característica real de los diodos.

El circuito es una propuesta concreta para explicar el mecanismo y no se ha construido ni validado experimentalmente. Para montarlo hay que comprobar las pérdidas y la autorresonancia de la bobina, la carga de medida, el desacoplo y los límites del operacional. Esta vista trabaja alrededor de 16 kHz y mantiene sus parámetros independientes de los controles en MHz de las otras tres pestañas.

La topología se explica en [el curso de electrónica de Analog Devices](https://wiki.analog.com/university/courses/electronics/text/chapter-4#negative_impedance_converter). Las hojas de datos del [OPA197](https://www.ti.com/lit/ds/symlink/opa197.pdf) y de la [1N4148](https://www.vishay.com/docs/81857/1n4148.pdf) describen sus límites, encapsulados y comportamiento real.

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

Los 26 tests comprueban las relaciones del resonador, el umbral y el equilibrio, el decaimiento, la ecuación diferencial de la envolvente, el escalado con Q, los límites del espectro, la conversión a jitter y la reproducibilidad de la traza conceptual. También verifican las corrientes del NIC, su simetría, la limitación con diodos, la conductancia fundamental y el efecto de las pérdidas de la bobina. La integral analítica de ruido se contrasta con una cuadratura independiente y la cuadratura del NIC se compara con la expresión analítica de una senoide recortada. Son comprobaciones del modelo matemático y del código, sin validación experimental de un circuito físico.

La interfaz general está en `index.html`, `style.css` y `app.mjs`. El modelo de envolvente y ruido está en `model.mjs`, con sus pruebas en `model.test.mjs`. La vista del circuito está en `nic.mjs` y utiliza `nic-model.mjs`, cuyas pruebas están en `nic-model.test.mjs`. El servidor local está en `serve.mjs`. GitHub Pages sirve directamente estos archivos estáticos.
