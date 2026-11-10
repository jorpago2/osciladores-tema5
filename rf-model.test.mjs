import test from 'node:test';
import assert from 'node:assert/strict';
import { rfValues, rfPoint, effectiveRFCompensation, rfEquilibrium } from './rf-model.mjs';

function close(actual, expected, relative = 1e-10, absolute = 1e-12) {
  assert.ok(Math.abs(actual - expected) <= absolute + relative * Math.abs(expected),
    `${actual} does not match ${expected}`);
}

test('GHz example uses total differential L and C and loaded parallel loss', () => {
  const d = rfValues();
  close(d.L, 4.4e-9); close(d.C, 1e-12);
  close(d.f0, 1 / (2 * Math.PI * Math.sqrt(4.4e-21)));
  assert.ok(d.f0 > 2.39e9 && d.f0 < 2.41e9);
  close(d.Rp, 663.32495807108);
  close(d.gLoss, 1 / d.Rp);
  close(d.deltaCorner, d.f0 / 20);
  close(d.omega * d.L, 1 / (d.omega * d.C));
});

test('differential negative resistance includes the factor two for per-device gm', () => {
  const d = rfValues();
  close(d.gm, .004); close(d.iTail, .002);
  close(d.rNeg, -500);
  close(d.gSmall, 1.32664991614216);
  const p = rfPoint(1e-6);
  close(p.iLinear / p.vDiff, -d.gm / 2);
  close(p.i / p.vDiff, -d.gm / 2, 1e-10);
  close(p.i, (p.id1 - p.id2) / 2);
});

test('current steering keeps both drain currents nonnegative and obeys tail KCL', () => {
  const d = rfValues();
  for (const v of [-1e6, -3, -.5, -.05, 0, .05, .5, 3, 1e6]) {
    const p = rfPoint(v);
    assert.ok(p.id1 >= 0 && p.id1 <= d.iTail);
    assert.ok(p.id2 >= 0 && p.id2 <= d.iTail);
    close(p.id1 + p.id2, d.iTail);
    close(p.deltaId1 + p.deltaId2, 0);
    close(p.id1, d.iTail / 2 + p.deltaId1);
    close(p.i, (p.id1 - p.id2) / 2);
  }
});

test('opposite differential voltages exchange drain currents and preserve delivered power', () => {
  for (const v of [.001, .05, .3, 2]) {
    const positive = rfPoint(v), negative = rfPoint(-v);
    close(positive.id1, negative.id2);
    close(positive.id2, negative.id1);
    close(positive.i, -negative.i);
    close(positive.power, negative.power);
    assert.ok(positive.power < 0 && negative.power < 0);
  }
});

test('zero voltage has zero differential current without removing dc bias', () => {
  const p = rfPoint(0);
  close(p.id1, .001); close(p.id2, .001);
  close(p.i, 0); close(p.power, 0);
});

test('startup threshold is gm greater than twice the differential loss conductance', () => {
  const d = rfValues();
  const gmAtThreshold = d.gmThreshold * 1e3;
  close(rfValues({ gmMilli: gmAtThreshold }).gSmall, 1);
  assert.equal(rfEquilibrium({ gmMilli: gmAtThreshold * .99 }), 0);
  assert.ok(rfEquilibrium({ gmMilli: gmAtThreshold * 1.01 }) > 0);
  assert.equal(rfEquilibrium({ gmMilli: 0 }), 0);
  assert.equal(rfValues({ gmMilli: 0 }).rNeg, -Infinity);
  close(rfPoint(.3, { gmMilli: 0 }).i, 0);
});

test('fundamental conductance approaches the small-signal result without cancellation', () => {
  const d = rfValues();
  close(effectiveRFCompensation(0), d.gSmall);
  close(effectiveRFCompensation(1e-200), d.gSmall);
  close(effectiveRFCompensation(1e-5), d.gSmall, 2e-9);
});

test('fundamental quadrature agrees with independent full-cycle midpoint integration', () => {
  const d = rfValues();
  for (const amplitude of [.02, .3, 1.5]) {
    const count = 20000;
    let sum = 0;
    for (let n = 0; n < count; n += 1) {
      const theta = 2 * Math.PI * (n + .5) / count;
      const sine = Math.sin(theta);
      const suppliedCurrent = -rfPoint(amplitude * sine).i;
      sum += suppliedCurrent * sine;
    }
    const fundamental = 2 * sum / count;
    close(effectiveRFCompensation(amplitude), fundamental * d.Rp / amplitude, 1e-8);
  }
});

test('large-signal current fundamental tends to twice the tail current over pi', () => {
  const d = rfValues(), amplitude = 500;
  const fundamental = effectiveRFCompensation(amplitude) * amplitude / d.Rp;
  close(fundamental, 2 * d.iTail / Math.PI, 2e-6);
});

test('limiting decreases compensation monotonically and gives a stable harmonic balance', () => {
  const amplitudes = [0, .01, .1, .5, 1, 2, 5];
  const gains = amplitudes.map(a => effectiveRFCompensation(a));
  for (let n = 1; n < gains.length; n += 1) assert.ok(gains[n] < gains[n - 1]);
  const a = rfEquilibrium(), d = rfValues();
  assert.ok(a > 0 && a < d.amplitudeUpperBound);
  close(effectiveRFCompensation(a), 1, 1e-9);
  assert.ok(effectiveRFCompensation(a * .99) > 1);
  assert.ok(effectiveRFCompensation(a * 1.01) < 1);
});

test('higher loaded Q increases startup margin and tail current scales behavioral swing', () => {
  close(rfValues({ q: 20 }).gSmall, 2 * rfValues().gSmall);
  close(rfEquilibrium({ itMilli: 4 }), 2 * rfEquilibrium(), 1e-9);
  close(rfValues({ cPf: 4 }).f0, rfValues().f0 / 2);
});

test('nonphysical domains and nonfinite voltages are rejected', () => {
  for (const key of ['q', 'itMilli', 'cPf', 'lNh']) {
    for (const value of [0, -1, NaN, Infinity]) {
      assert.throws(() => rfValues({ [key]: value }), RangeError);
    }
  }
  for (const value of [-1, NaN, Infinity]) assert.throws(() => rfValues({ gmMilli: value }), RangeError);
  for (const value of [NaN, Infinity]) assert.throws(() => rfPoint(value), RangeError);
  for (const value of [-1, NaN, Infinity]) assert.throws(() => effectiveRFCompensation(value), RangeError);
});
