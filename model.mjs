/**
 * Averaged educational model of a parallel LC negative-conductance oscillator.
 * The active one-port is represented by its fundamental-frequency conductance
 * Gn(A) = Gn0 / (1 + (A / vsat)^2). It is not a transistor-level model.
 * All public time and frequency quantities use seconds and hertz, except fMHz.
 */

const TWO_PI = 2 * Math.PI;

function finite(value, name) {
  if (!Number.isFinite(value)) throw new RangeError(`${name} must be finite`);
  return value;
}

function positive(value, name) {
  finite(value, name);
  if (value <= 0) throw new RangeError(`${name} must be positive`);
  return value;
}

function nonnegative(value, name) {
  finite(value, name);
  if (value < 0) throw new RangeError(`${name} must be nonnegative`);
  return value;
}

export function derived({ fMHz, Q, gain, vsat }) {
  const f0 = positive(fMHz, 'fMHz') * 1e6;
  positive(Q, 'Q');
  nonnegative(gain, 'gain');
  positive(vsat, 'vsat');
  const w0 = TWO_PI * f0;
  const C = 1e-12;
  const L = 1 / (w0 * w0 * C);
  const Gp = w0 * C / Q;
  return {
    f0, w0, C, L, Gp,
    Rp: 1 / Gp,
    Aeq: vsat * Math.sqrt(Math.max(gain - 1, 0)),
    tau: 2 * Q / w0,
  };
}

// Exact implicit integral of dx/ds = 2x(g - 1 - x)/(1 + x),
// where x = (A/vsat)^2 and s = t/tau. Log-domain bisection keeps A >= 0
// and avoids time-step instability during rapid growth or long ring-downs.
function logOnePlusExp(value) {
  return value > 0 ? value + Math.log1p(Math.exp(-value)) : Math.log1p(Math.exp(value));
}

function dimensionlessTime(logAmplitude, logInitial, gain, growing) {
  const logX = 2 * logAmplitude;
  const logX0 = 2 * logInitial;
  const a = gain - 1;
  if (a === 0) {
    return 0.5 * (Math.exp(-logX) - Math.exp(-logX0) - (logX - logX0));
  }
  if (growing) {
    const logA = Math.log(a);
    const gap = Math.log(-Math.expm1(logX - logA));
    const gap0 = Math.log(-Math.expm1(logX0 - logA));
    return ((logX - logX0) - gain * (gap - gap0)) / (2 * a);
  }
  // This form avoids subtracting two nearly equal logarithms when g is near 1.
  const correction = a > 0
    ? Math.log(-Math.expm1(Math.log(a) - logX))
    : logOnePlusExp(Math.log(-a) - logX);
  const correction0 = a > 0
    ? Math.log(-Math.expm1(Math.log(a) - logX0))
    : logOnePlusExp(Math.log(-a) - logX0);
  return -0.5 * (logX - logX0) - gain * (correction - correction0) / (2 * a);
}

export function envelopeAt(timeSeconds, params, seed = 0.01) {
  nonnegative(timeSeconds, 'timeSeconds');
  nonnegative(seed, 'seed');
  const { Aeq, tau } = derived(params);
  if (timeSeconds === 0 || seed === 0) return seed;
  const { gain, vsat } = params;
  const s = timeSeconds / tau;
  if (gain === 0) return seed * Math.exp(-s);
  if (Aeq > 0 && Math.abs(seed - Aeq) <= Aeq * 1e-14) return Aeq;
  const logInitial = Math.log(seed / vsat);
  const growing = gain > 1 && seed < Aeq;
  let lo = growing
    ? logInitial
    : gain > 1 ? Math.log(Aeq / vsat) : Math.max(logInitial - s, -745);
  let hi = growing ? Math.log(Aeq / vsat) : logInitial;
  if (!growing && gain <= 1 && dimensionlessTime(lo, logInitial, gain, false) < s) return 0;
  for (let iteration = 0; iteration < 72; iteration += 1) {
    const mid = (lo + hi) / 2;
    if (mid === lo || mid === hi) break;
    const elapsed = dimensionlessTime(mid, logInitial, gain, growing);
    if (growing ? elapsed < s : elapsed > s) lo = mid;
    else hi = mid;
  }
  return vsat * Math.exp((lo + hi) / 2);
}

export function simulateEnvelope(params, duration, samples = 600, seed = 0.01) {
  nonnegative(duration, 'duration');
  if (!Number.isInteger(samples) || samples < 2) throw new RangeError('samples must be an integer >= 2');
  derived(params);
  nonnegative(seed, 'seed');
  return Array.from({ length: samples }, (_, index) => {
    const t = duration * index / (samples - 1);
    return { t, a: envelopeAt(t, params, seed) };
  });
}

function noiseParameters({ fMHz, Q, noiseFloor, flickerHz }) {
  const f0 = positive(fMHz, 'fMHz') * 1e6;
  positive(Q, 'Q');
  // -Infinity deliberately represents a noiseless reference.
  if (noiseFloor !== -Infinity) finite(noiseFloor, 'noiseFloor');
  nonnegative(flickerHz, 'flickerHz');
  return { f0, corner: f0 / (2 * Q), floor: 10 ** (noiseFloor / 10), flickerHz };
}

/** Single-sideband phase-noise density L(df), in dBc/Hz, at positive offset. */
export function phaseNoiseDb(offsetHz, params) {
  positive(offsetHz, 'offsetHz');
  const { corner, flickerHz } = noiseParameters(params);
  return params.noiseFloor
    + 10 * Math.log10(1 + (corner / offsetHz) ** 2)
    + 10 * Math.log10(1 + flickerHz / offsetHz);
}

/**
 * Exact integral of the simplified Leeson spectrum, with the SSB factor of 2.
 * sigmaT is RMS phase/time jitter over [low, high], not period jitter.
 * Small-angle phase modulation and a stationary finite measurement band apply.
 * Reference: Keysight E5052B, Confirming Result of Phase Noise Measurement.
 */
export function integratedJitter(params, low, high) {
  positive(low, 'low');
  positive(high, 'high');
  if (high <= low) throw new RangeError('high must be greater than low');
  const { f0, corner, floor, flickerHz } = noiseParameters(params);
  const b2 = corner ** 2;
  const integratedShape = (high - low)
    + flickerHz * Math.log(high / low)
    + b2 * (1 / low - 1 / high)
    + 0.5 * b2 * flickerHz * (1 / low ** 2 - 1 / high ** 2);
  const variance = 2 * floor * integratedShape;
  const sigmaPhi = Math.sqrt(variance);
  return { sigmaPhi, sigmaT: sigmaPhi / (TWO_PI * f0), variance, low, high };
}

function randomGenerator(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6D2B79F5;
    let x = state;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Smooth, seeded, zero-mean phase illustration with exact requested RMS.
 * It has no physical sample rate and does NOT synthesize the Leeson spectrum.
 */
export function phaseTrace({ rmsRad = 0.2, seed = 42, count = 800 } = {}) {
  nonnegative(rmsRad, 'rmsRad');
  finite(seed, 'seed');
  if (!Number.isInteger(count) || count < 2) throw new RangeError('count must be an integer >= 2');
  if (rmsRad === 0) return Array(count).fill(0);
  const random = randomGenerator(seed);
  const modes = Array.from({ length: 18 }, (_, i) => ({
    frequency: 0.7 + i * 0.47,
    phase: TWO_PI * random(),
    amplitude: (0.65 + 0.7 * random()) / (1 + i * 0.55),
  }));
  const result = Array.from({ length: count }, (_, index) => {
    const t = index / (count - 1);
    return modes.reduce((sum, mode) => sum + mode.amplitude * Math.sin(TWO_PI * mode.frequency * t + mode.phase), 0);
  });
  const mean = result.reduce((sum, value) => sum + value, 0) / count;
  const centered = result.map(value => value - mean);
  const rms = Math.sqrt(centered.reduce((sum, value) => sum + value * value, 0) / count);
  return centered.map(value => value * rmsRad / rms);
}
