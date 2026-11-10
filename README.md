# Oscila · Tema 5

Laboratorio interactivo para estudiar el arranque, la estabilización de amplitud y el ruido de fase de un oscilador con resistencia negativa. Está orientado a la asignatura CSAF y funciona en el navegador.

[Abrir la aplicación](https://jorpago2.github.io/osciladores-tema5/) · [Repositorio en GitHub](https://github.com/jorpago2/osciladores-tema5)

## Uso en clase

- **Arranque** muestra cómo evoluciona una pequeña perturbación inicial. Modifica la aportación del bloque activo para pasar del decaimiento al crecimiento y observa la estabilización de la envolvente.
- **Equilibrio** relaciona la amplitud con la conductancia activa y el balance de potencia del resonador. Permite localizar el punto donde la energía aportada compensa las pérdidas.
- **Ruido de fase** representa la densidad espectral relativa a la portadora. Compara el efecto de Q, la potencia de señal, el factor de ruido y la esquina de flicker. Puedes conservar una curva de referencia y exportar datos en CSV.
- **MOSFET a GHz** desarrolla un oscilador LC con dos NMOS acoplados en cruz mediante seis pasos y un esquema que destaca los componentes implicados. Permite invertir la tensión diferencial, seguir el reparto de corriente y comprobar cómo la transconductancia y las pérdidas determinan el arranque.

Una secuencia útil consiste en comparar valores de g inferiores y superiores a uno, localizar la amplitud de equilibrio y duplicar Q manteniendo g constante. Después, en la vista de ruido, puede estudiarse cómo cambia el espectro al aumentar Q o la potencia de señal.

## Modelo de oscilación

Las tres primeras vistas parten de f₀ = 2,4 GHz, Q = 10 y g = 1,33. La frecuencia puede variarse entre 0,5 y 6 GHz. El resonador es un RLC paralelo con C = 1 pF y sus parámetros cumplen

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

## Circuito con MOSFET a GHz

El ejemplo representa un oscilador LC diferencial con dos NMOS de radiofrecuencia acoplados en cruz. La puerta de M1 se conecta al drenador de M2 y la puerta de M2 al drenador de M1. Cada drenador recibe alimentación desde VDD = 1,8 V a través de una bobina de 2,2 nH. Un condensador equivalente de 1 pF une ambos drenadores y las fuentes comparten un tercer NMOS que se aproxima como una fuente de corriente de cola de 2 mA, fijada por Vbias. En el punto de polarización simétrico, cada transistor del par conduce 1 mA.

La explicación sigue el recorrido de una pequeña perturbación. Si sube la tensión del drenador de M1 y baja la de M2, la puerta de M1 recibe una tensión menor y su corriente disminuye. Al mismo tiempo, la puerta de M2 recibe una tensión mayor y su corriente aumenta. Ese reparto refuerza la diferencia de tensión inicial. La alimentación proporciona la energía que repone las pérdidas del resonador.

Definimos la tensión diferencial como v_d = v₁ − v₂ y la corriente diferencial que entra al bloque activo como i_d = (ΔI_D1 − ΔI_D2)/2. Con gm como transconductancia de **cada MOSFET**, el modelo simétrico de pequeña señal da

$$
\Delta I_{D1}=-\frac{g_m}{2}v_d,\qquad
\Delta I_{D2}=+\frac{g_m}{2}v_d,\qquad
 i_d=-\frac{g_m}{2}v_d,\qquad
R_{\mathrm{neg,d}}=-\frac{2}{g_m}.
$$

El factor dos corresponde a la resistencia vista entre los dos drenadores. No debe confundirse con la resistencia de un medio circuito referido a masa. Para gm = 4 mS por transistor, Rneg,d = −500 Ω. Una tensión diferencial de +50 mV produce, en esta aproximación, I_D1 = 0,9 mA e I_D2 = 1,1 mA. La corriente diferencial vale −0,1 mA, aunque ambas corrientes totales de drenador siguen siendo positivas. El producto v_d·i_d negativo expresa la potencia que el bloque activo entrega al resonador.

Las dos bobinas se modelan sin acoplamiento magnético mutuo, por lo que L_d = L₁ + L₂ = 4,4 nH. La capacidad diferencial C_d = 1 pF incluye las capacidades parásitas equivalentes. Las pérdidas y la carga se agrupan en un Q cargado de 10. Así se obtiene

$$
f_0=\frac{1}{2\pi\sqrt{L_d C_d}}\approx 2{,}399\ \mathrm{GHz},\qquad
R_{p,d}=Q\omega_0L_d\approx 663{,}3\ \Omega,
$$

$$
g_0=\frac{g_mR_{p,d}}{2}\approx 1{,}327,\qquad
g_{m,\mathrm{umbral}}=\frac{2}{R_{p,d}}\approx 3{,}015\ \mathrm{mS}.
$$

Con los valores iniciales, la conductancia negativa supera las pérdidas y una perturbación puede crecer. El Q cargado ya engloba las pérdidas representadas en Rp,d y la capacidad total ya incluye los parásitos indicados, por lo que no deben sumarse de nuevo.

Para mostrar cómo se limita la amplitud, la vista utiliza un reparto de corriente conductual, con I_T como corriente de cola

$$
i_d(v_d)=-\frac{I_T}{2}\tanh\left(\frac{g_m v_d}{I_T}\right),\qquad
I_{D1}=\frac{I_T}{2}+i_d,\qquad
I_{D2}=\frac{I_T}{2}-i_d.
$$

Este modelo conserva la pendiente de pequeña señal y limita las corrientes de los transistores entre cero e I_T. La componente fundamental de i_d se calcula para una tensión diferencial sinusoidal y se compara con las pérdidas del tanque. Con los ajustes iniciales, el balance predice una amplitud diferencial de unos 0,602 V de pico, equivalente a unos 0,301 V de pico en cada nodo. La función tanh es una aproximación didáctica del reparto de corriente y no una ecuación exacta de un MOSFET ni una simulación de un proceso de fabricación. Este cálculo es independiente del modelo de saturación de las vistas generales.

La topología es propia de circuitos integrados de radiofrecuencia. Los valores propuestos constituyen una especificación nominal de ejemplo, sin asignar una tecnología ni un kit de diseño de proceso, o PDK. No se han determinado W/L, Vbias, límites de tensión ni modelos de ruido de transistores concretos. Tampoco se ha fabricado ni medido este ejemplo. Su realización requiere seleccionar los NMOS y verificar polarización, parásitos, pérdidas, carga y geometría de las bobinas con los modelos del proceso. Los drenadores pueden superar VDD durante la oscilación, de modo que sus límites admisibles deben comprobarse con ese mismo proceso.

[El curso de circuitos integrados de radiofrecuencia de JKU](https://iic-jku.github.io/radio-frequency-integrated-circuits/slides/oscillator.html) desarrolla la resistencia diferencial −2/gm y el resonador del par cruzado. Como referencia de una implementación fabricada y medida a frecuencias de GHz, [Yao y colaboradores presentan un conjunto de VCO LC de 3,7 a 10 GHz en CMOS de 55 nm](https://www.mdpi.com/2079-9292/11/12/1897). Sus resultados pertenecen a aquel diseño y no son prestaciones atribuidas al ejemplo de esta aplicación.

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

Las 26 pruebas se reparten entre 14 comprobaciones del modelo general y 12 del circuito RF. Cubren las relaciones del resonador, el umbral y el equilibrio, el decaimiento, la ecuación diferencial de la envolvente, el escalado con Q, los límites del espectro, la conversión a jitter y la reproducibilidad de la traza conceptual. En el circuito RF se comprueban las convenciones diferenciales, la resistencia negativa, el reparto y los límites de corriente, la conductancia fundamental y el balance de amplitud. La integral analítica de ruido se contrasta con una cuadratura independiente. Son comprobaciones del modelo matemático y del código, sin validación experimental de un circuito físico.

La interfaz general está en `index.html`, `style.css` y `app.mjs`. El modelo de envolvente y ruido está en `model.mjs`, con sus pruebas en `model.test.mjs`. La vista del circuito RF está en `rf.mjs` y `rf.css`, y utiliza `rf-model.mjs`, cuyas pruebas están en `rf-model.test.mjs`. El esquema se conserva en `rf-schematic.svg` y está incorporado también en el HTML para mostrarse sin una petición adicional. El servidor local está en `serve.mjs`. GitHub Pages sirve directamente estos archivos estáticos.
