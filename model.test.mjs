import test from 'node:test';
import assert from 'node:assert/strict';
import { derived, powerBalance, envelopeAt, simulateEnvelope, phaseNoiseDb, integratedJitter, phaseTrace } from './model.mjs';

const base = { fMHz: 10, Q: 60, gain: 1.6, vsat: 1, noiseFloor: -150, flickerHz: 1000 };
const close = (actual, expected, relative = 1e-8) => assert.ok(
  Math.abs(actual - expected) <= relative * Math.max(Math.abs(expected), 1e-30),
  `${actual} differs from ${expected}`,
);

test('parallel resonator parameters obey resonance and loaded Q', () => {
  const p = derived(base);
  close(1 / Math.sqrt(p.L * p.C), p.w0);
  close(p.Rp * Math.sqrt(p.C / p.L), base.Q);
  close(p.Gp * p.Rp, 1);
  close(p.tau, 2 * base.Q / p.w0);
});

test('zero conductance produces the exact exponential passive ring-down', () => {
  const p = { ...base, gain: 0 };
  const { tau } = derived(p);
  close(envelopeAt(5 * tau, p, 0.4), 0.4 * Math.exp(-5));
});

test('subthreshold and threshold oscillations decay', () => {
  for (const gain of [0.3, 0.95, 1, 1 - 1e-10]) {
    const p = { ...base, gain };
    const { tau } = derived(p);
    const curve = simulateEnvelope(p, 30 * tau, 200, 0.4);
    assert.equal(derived(p).Aeq, 0);
    assert.ok(curve.every((point, i) => point.a >= 0 && (!i || point.a <= curve[i - 1].a)));
    assert.ok(curve.at(-1).a < 0.4);
  }
});

test('threshold solution satisfies the exact implicit integral', () => {
  const p = { ...base, gain: 1 };
  const { tau } = derived(p);
  const a0 = 0.6;
  const s = 4;
  const x0 = (a0 / p.vsat) ** 2;
  const x = (envelopeAt(s * tau, p, a0) / p.vsat) ** 2;
  close(0.5 * (1 / x - 1 / x0 - Math.log(x / x0)), s);
});

test('growth and oversized initial conditions both converge to a stable amplitude', () => {
  for (const gain of [1.2, 1.6, 2.5]) {
    const p = { ...base, gain };
    const { tau, Aeq } = derived(p);
    close(envelopeAt(1000 * tau, p), Aeq, 1e-8);
    close(envelopeAt(1000 * tau, p, 5), Aeq, 1e-8);
    close(gain / (1 + (Aeq / p.vsat) ** 2), 1);
  }
});

test('envelope derivative matches the averaged ODE', () => {
  for (const gain of [0.5, 1, 1.6, 3]) {
    const p = { ...base, gain };
    const { tau } = derived(p);
    for (const seed of [0.08, 2]) {
      const time = 2 * tau;
      const dt = 1e-4 * tau;
      const amplitude = envelopeAt(time, p, seed);
      const derivative = (envelopeAt(time + dt, p, seed) - envelopeAt(time - dt, p, seed)) / (2 * dt);
      const expected = (gain / (1 + (amplitude / p.vsat) ** 2) - 1) * amplitude / tau;
      close(derivative, expected, 1e-6);
    }
  }
});

test('zero seed remains zero and no artificial noise is injected', () => {
  assert.equal(envelopeAt(1, base, 0), 0);
  assert.equal(envelopeAt(0, base, 0.02), 0.02);
});

test('very long subthreshold ring-downs reach floating-point zero without overflow', () => {
  assert.equal(envelopeAt(10, { ...base, gain: 0.5 }), 0);
});

test('doubling Q doubles the envelope timescale at fixed conductance ratio', () => {
  const t = 8 * derived(base).tau;
  close(envelopeAt(t, base), envelopeAt(2 * t, { ...base, Q: 2 * base.Q }));
});

test('phase-noise floor, Q and Leeson corner have expected limits', () => {
  const withoutFlicker = { ...base, flickerHz: 0 };
  const corner = base.fMHz * 1e6 / (2 * base.Q);
  close(phaseNoiseDb(corner, withoutFlicker), base.noiseFloor + 10 * Math.log10(2));
  assert.ok(Math.abs(phaseNoiseDb(corner * 1e6, withoutFlicker) - base.noiseFloor) < 1e-8);
  const change = phaseNoiseDb(10, { ...withoutFlicker, Q: base.Q * 2 }) - phaseNoiseDb(10, withoutFlicker);
  assert.ok(Math.abs(change + 6.0206) < 1e-4);
  close(phaseNoiseDb(1000, { ...base, noiseFloor: base.noiseFloor + 10 }) - phaseNoiseDb(1000, base), 10);
});

test('jitter integral agrees with independent log-grid quadrature', () => {
  const low = 1000;
  const high = 1e6;
  const n = 50000;
  let numerical = 0;
  let previousF = low;
  let previousValue = 2 * 10 ** (phaseNoiseDb(low, base) / 10);
  for (let i = 1; i <= n; i += 1) {
    const f = low * (high / low) ** (i / n);
    const value = 2 * 10 ** (phaseNoiseDb(f, base) / 10);
    numerical += (f - previousF) * (value + previousValue) / 2;
    previousF = f;
    previousValue = value;
  }
  const result = integratedJitter(base, low, high);
  close(result.variance, numerical, 2e-8);
  close(result.sigmaPhi ** 2, result.variance);
  close(result.sigmaT * 2 * Math.PI * base.fMHz * 1e6, result.sigmaPhi);
  assert.ok(integratedJitter(base, low / 10, high).sigmaPhi > result.sigmaPhi);
});

test('noiseless reference has zero integrated jitter', () => {
  const p = { ...base, noiseFloor: -Infinity };
  assert.equal(phaseNoiseDb(100, p), -Infinity);
  assert.equal(integratedJitter(p, 100, 1e6).sigmaPhi, 0);
});

test('illustrative phase trace is deterministic, centered and RMS-normalized', () => {
  const trace = phaseTrace({ rmsRad: 0.35, count: 500, seed: 7 });
  assert.deepEqual(trace, phaseTrace({ rmsRad: 0.35, count: 500, seed: 7 }));
  assert.notDeepEqual(trace, phaseTrace({ rmsRad: 0.35, count: 500, seed: 8 }));
  assert.ok(Math.abs(trace.reduce((a, b) => a + b, 0) / trace.length) < 1e-14);
  close(Math.sqrt(trace.reduce((a, b) => a + b * b, 0) / trace.length), 0.35);
  assert.deepEqual(phaseTrace({ rmsRad: 0, count: 4 }), [0, 0, 0, 0]);
});

test('invalid physical domains are rejected', () => {
  assert.throws(() => derived({ ...base, Q: 0 }), RangeError);
  assert.throws(() => envelopeAt(-1, base), RangeError);
  assert.throws(() => phaseNoiseDb(0, base), RangeError);
  assert.throws(() => integratedJitter(base, 100, 10), RangeError);
  assert.throws(() => phaseTrace({ count: 1 }), RangeError);
});


test('RF power balance matches the energy derivative of the envelope', () => {
  for (const gain of [.6, 1, 1.8]) {
    const params={...base,gain},d=derived(params),t=3*d.tau,h=1e-4*d.tau;
    const amp=envelopeAt(t,params,.1);
    const eBefore=d.C*envelopeAt(t-h,params,.1)**2/2;
    const eAfter=d.C*envelopeAt(t+h,params,.1)**2/2;
    close(powerBalance(amp,params).net,(eAfter-eBefore)/(2*h),1e-6);
  }
});

test('power bars preserve the zero seed, passive loss and threshold decay', () => {
  assert.equal(powerBalance(0,base).input,0);
  assert.equal(powerBalance(0,base).loss,0);
  assert.equal(powerBalance(.1,{...base,gain:0}).input,0);
  assert.ok(powerBalance(.01,{...base,gain:1}).net<0);
  assert.ok(Math.abs(powerBalance(derived(base).Aeq,base).net)<1e-15);
});
