/** Factors in the simplified Leeson model, with x = offset / fL and r = fc / fL. */
export function cornerFactors(x, { ratio = 0, leeson = true, flicker = true } = {}) {
  if (!Number.isFinite(x) || x <= 0 || !Number.isFinite(ratio) || ratio < 0) {
    throw new RangeError('x must be positive and ratio nonnegative, both finite');
  }
  const leesonDb = leeson ? 10 * Math.log10(1 + 1 / x ** 2) : 0;
  const flickerDb = flicker ? 10 * Math.log10(1 + ratio / x) : 0;
  // Derivatives with respect to log10(offset), in dB per decade.
  const leesonSlope = leeson ? -20 / (1 + x ** 2) : 0;
  const flickerSlope = flicker ? -10 * ratio / (x + ratio) : 0;
  return { leesonDb, flickerDb, totalDb: leesonDb + flickerDb,
    slope: leesonSlope + flickerSlope };
}
