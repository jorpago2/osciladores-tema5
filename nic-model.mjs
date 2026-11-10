/**
 * Quasi-static educational model of a current-inversion negative impedance
 * converter. The op-amp's non-inverting input is the tank node v. Its inverting
 * input has Rg to ground and Rf1 + Rf2 to the output. Antiparallel diodes across
 * Rf2 are idealized as a symmetric fixed-voltage clamp, not a device simulation.
 * Rn connects the output to the tank node. Currents are positive INTO the NIC.
 * Values use volts, amperes, ohms, farads, henries and hertz.
 */

const DEFAULTS = Object.freeze({
  rn: 8200, rp: 10000, rf1: 3300, rf2: 6800, rg: 10000,
  L: 0.01, C: 1e-8, vd: 0.6, limiter: true, coilR: 0,
});

function parameters(options = {}) {
  const p = { ...DEFAULTS, ...options };
  for (const name of ['rn', 'rp', 'rf2', 'rg', 'L', 'C', 'vd']) {
    if (!Number.isFinite(p[name]) || p[name] <= 0) {
      throw new RangeError(`${name} must be finite and positive`);
    }
  }
  if (!Number.isFinite(p.rf1) || p.rf1 < 0) {
    throw new RangeError('rf1 must be finite and nonnegative');
  }
  if (!Number.isFinite(p.coilR) || p.coilR < 0) {
    throw new RangeError('coilR must be finite and nonnegative');
  }
  if (p.coilR >= Math.sqrt(p.L / p.C)) {
    throw new RangeError('coilR is too large for a nonzero susceptance resonance');
  }
  if (typeof p.limiter !== 'boolean') throw new TypeError('limiter must be boolean');
  return p;
}

function values(p) {
  const excessGain = (p.rf1 + p.rf2) / p.rg;
  // At the resonance of C || (coilR + jωL), the inductor's conductance is
  // coilR*C/L. Rp is the separate, external parallel resistor.
  const gConductance = 1 / p.rp + p.coilR * p.C / p.L;
  const effectiveRp = 1 / gConductance;
  const gSmall = effectiveRp * excessGain / p.rn;
  // This Q is the conventional high-Q parallel approximation, not an exact
  // extraction of the bandwidth of the lossy series-inductor network.
  const Qapprox = effectiveRp * Math.sqrt(p.C / p.L);
  return {
    kSmall: 1 + excessGain,
    rNeg: -p.rn / excessGain,
    gSmall,
    f0: Math.sqrt(1 / (p.L * p.C) - (p.coilR / p.L) ** 2) / (2 * Math.PI),
    Q: Qapprox,
    Qapprox, gConductance, effectiveRp,
    diodeOnset: p.vd * p.rg / p.rf2,
    gLarge: p.limiter ? effectiveRp * p.rf1 / (p.rg * p.rn) : gSmall,
  };
}

export function nicValues(options = {}) {
  return values(parameters(options));
}

/** No output rail clipping is imposed. The headroom flag is illustrative. */
export function nicPoint(v, options = {}) {
  if (!Number.isFinite(v)) throw new RangeError('v must be finite');
  const p = parameters(options);
  const rf2Linear = v * p.rf2 / p.rg;
  const rf2Voltage = p.limiter
    ? Math.max(-p.vd, Math.min(p.vd, rf2Linear))
    : rf2Linear;
  const vOut = v * (1 + p.rf1 / p.rg) + rf2Voltage;
  const i = (v - vOut) / p.rn;
  return {
    v, vOut, i, rf2Voltage,
    diodesConducting: p.limiter && Math.abs(rf2Linear) > p.vd,
    power: v * i,
    kEffective: v === 0 ? values(p).kSmall : vOut / v,
    withinLinearHeadroom: Math.abs(vOut) <= 4,
  };
}

function simpson(fn, low, high, intervals = 96) {
  if (low === high) return 0;
  const h = (high - low) / intervals;
  let sum = fn(low) + fn(high);
  for (let n = 1; n < intervals; n += 1) {
    sum += (n % 2 === 0 ? 2 : 4) * fn(low + n * h);
  }
  return sum * h / 3;
}

function compensation(amplitude, p, derived) {
  if (amplitude === 0 || !p.limiter || amplitude <= derived.diodeOnset) {
    return derived.gSmall;
  }
  // Quarter-wave symmetry gives the fundamental current coefficient. Splitting
  // at diode turn-on removes the derivative discontinuity from each subinterval.
  const turnOn = Math.asin(derived.diodeOnset / amplitude);
  const integrand = theta => {
    const sine = Math.sin(theta);
    const voltage = amplitude * sine;
    const providedCurrent = (p.rf1 / p.rg * voltage
      + Math.min(p.rf2 / p.rg * voltage, p.vd)) / p.rn;
    return providedCurrent * sine;
  };
  const fundamentalCurrent = 4 / Math.PI * (
    simpson(integrand, 0, turnOn)
    + simpson(integrand, turnOn, Math.PI / 2)
  );
  return derived.effectiveRp * fundamentalCurrent / amplitude;
}

/** Magnitude of active fundamental conductance divided by total tank loss. */
export function effectiveCompensation(amplitude, options = {}) {
  if (!Number.isFinite(amplitude) || amplitude < 0) {
    throw new RangeError('amplitude must be finite and nonnegative');
  }
  const p = parameters(options);
  return compensation(amplitude, p, values(p));
}

/**
 * Harmonic-balance prediction for a sinusoidal tank voltage. This does not
 * include finite bandwidth, actual diode I-V or op-amp clipping. Winding loss
 * is included through its equivalent conductance at the resonance frequency.
 * Return 0 without small-signal startup, Infinity without finite stabilization.
 */
export function equilibriumAmplitude(options = {}) {
  const p = parameters(options);
  const derived = values(p);
  if (derived.gSmall <= 1) return 0;
  if (derived.gLarge >= 1) return Infinity;
  let low = derived.diodeOnset;
  let high = 2 * low;
  while (compensation(high, p, derived) > 1) {
    high *= 2;
    if (!Number.isFinite(high)) return Infinity;
  }
  for (let iteration = 0; iteration < 64; iteration += 1) {
    const middle = (low + high) / 2;
    if (compensation(middle, p, derived) > 1) low = middle;
    else high = middle;
  }
  return (low + high) / 2;
}
