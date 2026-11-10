/**
 * Educational differential model of a cross-coupled NMOS LC oscillator.
 * L and C are TOTAL DIFFERENTIAL tank values. gm is that of EACH transistor.
 * q is the loaded tank Q, including the losses represented by Rp.
 * vDiff = v1 - v2 and i = (id1 - id2)/2 is the incremental current entering
 * the active differential port. Consequently, Rneg = -2/gm, not -1/gm.
 *
 * The large-signal tanh current-steering law is a behavioral interpolation.
 * It is neither a MOS square-law model nor a SPICE/PDK device simulation.
 * It omits device capacitance dynamics, finite output resistance, frequency
 * dependent gm, common-mode motion, clipping and voltage headroom limits.
 * Public derived quantities use SI units. Input control names state units.
 */

const DEFAULTS = Object.freeze({ gmMilli: 4, q: 10, itMilli: 2, cPf: 1, lNh: 4.4 });
const HALF_PI = Math.PI / 2;

function parameters(options = {}) {
  const p = { ...DEFAULTS, ...options };
  for (const name of ['q', 'itMilli', 'cPf', 'lNh']) {
    if (!Number.isFinite(p[name]) || p[name] <= 0) {
      throw new RangeError(`${name} must be finite and positive`);
    }
  }
  if (!Number.isFinite(p.gmMilli) || p.gmMilli < 0) {
    throw new RangeError('gmMilli must be finite and nonnegative');
  }
  return p;
}

function values(p) {
  const gm = p.gmMilli * 1e-3;
  const iTail = p.itMilli * 1e-3;
  const C = p.cPf * 1e-12;
  const L = p.lNh * 1e-9;
  const omega = 1 / Math.sqrt(L * C);
  const f0 = omega / (2 * Math.PI);
  const Rp = p.q * omega * L;
  const gLoss = 1 / Rp;
  const gSmall = gm * Rp / 2;
  const gmThreshold = 2 / Rp;
  const amplitudeUpperBound = 2 * iTail * Rp / Math.PI;
  for (const value of [gm, iTail, C, L, omega, f0, Rp, gLoss, gSmall, gmThreshold, amplitudeUpperBound]) {
    if (!Number.isFinite(value)) throw new RangeError('component values exceed the finite model domain');
  }
  if (C === 0 || L === 0 || iTail === 0 || omega === 0 || Rp === 0) {
    throw new RangeError('component values underflow the positive model domain');
  }
  return {
    ...p, gm, iTail, C, L, omega, f0, Rp, gLoss, gSmall, gmThreshold,
    rNeg: gm === 0 ? -Infinity : -2 / gm,
    deltaCorner: f0 / (2 * p.q),
    vScale: gm === 0 ? Infinity : iTail / gm,
    amplitudeUpperBound,
  };
}

export function rfValues(options = {}) {
  return values(parameters(options));
}

export function rfPoint(vdiff, options = {}) {
  if (!Number.isFinite(vdiff)) throw new RangeError('vdiff must be finite');
  const d = rfValues(options);
  const steering = Math.tanh(d.gm * vdiff / d.iTail);
  const deltaId1 = -d.iTail * steering / 2;
  const deltaId2 = -deltaId1;
  const id1 = d.iTail / 2 + deltaId1;
  const id2 = d.iTail - id1;
  // Computing i from the incremental current avoids subtractive cancellation
  // at extremely small voltages, while retaining i = (id1 - id2)/2.
  const i = deltaId1;
  return {
    vDiff: vdiff, id1, id2, i, deltaId1, deltaId2,
    power: vdiff * i,
    iLinear: -d.gm * vdiff / 2,
  };
}

function fundamentalCompensation(amplitude, d) {
  const drive = d.gm * amplitude / d.iTail;
  if (amplitude === 0 || d.gm === 0) return d.gSmall;
  // Expansion of the sinusoidal fundamental avoids loss of precision at A≈0.
  if (drive < 1e-3) {
    return d.gSmall * (1 - drive ** 2 / 4 + drive ** 4 / 12);
  }
  // Quarter-wave symmetry. Simpson integration resolves the smooth steering
  // waveform without interpreting harmonics as additional oscillators.
  const intervals = 256;
  const h = HALF_PI / intervals;
  const integrand = theta => {
    const sine = Math.sin(theta);
    return Math.tanh(drive * sine) * sine;
  };
  let sum = integrand(0) + integrand(HALF_PI);
  for (let n = 1; n < intervals; n += 1) {
    sum += (n % 2 ? 4 : 2) * integrand(n * h);
  }
  const integral = sum * h / 3;
  const iFundamental = 2 * d.iTail * integral / Math.PI;
  return iFundamental * d.Rp / amplitude;
}

/** Magnitude of active fundamental conductance divided by loaded tank loss. */
export function effectiveRFCompensation(amplitude, options = {}) {
  if (!Number.isFinite(amplitude) || amplitude < 0) {
    throw new RangeError('amplitude must be finite and nonnegative');
  }
  return fundamentalCompensation(amplitude, rfValues(options));
}

/**
 * Behavioral harmonic-balance amplitude for a sinusoidal differential voltage.
 * Zero means no small-signal growth. A positive result does NOT establish that
 * the chosen supply, transistor technology or output swing can realize it.
 */
export function rfEquilibrium(options = {}) {
  const d = rfValues(options);
  if (d.gSmall <= 1) return 0;
  let low = 0;
  // The current fundamental cannot exceed 2*It/π, yielding this upper bound.
  let high = d.amplitudeUpperBound;
  for (let iteration = 0; iteration < 64; iteration += 1) {
    const middle = (low + high) / 2;
    if (fundamentalCompensation(middle, d) > 1) low = middle;
    else high = middle;
  }
  return (low + high) / 2;
}
